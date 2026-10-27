const express = require('express');
const multer = require('multer');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const PORT = Number(process.env.PORT) || 47213; // porta non standard, per evitare conflitti
const HOST = process.env.HOST || '0.0.0.0'; // raggiungibile dalla rete interna (cloudflared)
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const db = new DatabaseSync(path.join(DATA_DIR, 'instaq.db'));
db.exec(`
PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS posts (
  id INTEGER PRIMARY KEY, title TEXT NOT NULL DEFAULT '', text TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft', cover_image_id INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS images (
  id INTEGER PRIMARY KEY, post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  file TEXT NOT NULL, original TEXT NOT NULL, mime TEXT NOT NULL, position INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS revisions (
  id INTEGER PRIMARY KEY, post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  author TEXT NOT NULL, summary TEXT NOT NULL, snapshot TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
`);

const q = {
  one: (sql, ...p) => db.prepare(sql).get(...p),
  all: (sql, ...p) => db.prepare(sql).all(...p),
  run: (sql, ...p) => db.prepare(sql).run(...p),
};

// Nessun login: il nome (facoltativo, scelto nel browser) serve solo per la cronologia.
const authorOf = (req) => {
  try { return decodeURIComponent(req.headers['x-author'] || '').trim().slice(0, 60) || 'Anonimo'; } catch { return 'Anonimo'; }
};

function loadPost(p) {
  return {
    id: p.id, title: p.title, text: p.text, status: p.status,
    coverId: p.cover_image_id, createdAt: p.created_at, updatedAt: p.updated_at,
    images: q.all('SELECT id,original,position FROM images WHERE post_id=? ORDER BY position', p.id),
  };
}
const getPost = (id) => q.one('SELECT * FROM posts WHERE id=?', id);
const snapshot = (p) => JSON.stringify({
  title: p.title, text: p.text, status: p.status, coverId: p.coverId,
  images: p.images.map((i) => ({ id: i.id, original: i.original })),
});
const addRevision = (postId, author, summary) =>
  q.run('INSERT INTO revisions(post_id,author,summary,snapshot) VALUES(?,?,?,?)', postId, author, summary, snapshot(loadPost(getPost(postId))));
const touch = (id) => q.run('UPDATE posts SET updated_at=CURRENT_TIMESTAMP WHERE id=?', id);
function normalize(postId) { // riposiziona 0..n e garantisce una copertina valida
  const imgs = q.all('SELECT id FROM images WHERE post_id=? ORDER BY position,id', postId);
  imgs.forEach((im, i) => q.run('UPDATE images SET position=? WHERE id=?', i, im.id));
  const p = q.one('SELECT cover_image_id c FROM posts WHERE id=?', postId);
  if (!imgs.some((i) => i.id === p.c)) q.run('UPDATE posts SET cover_image_id=? WHERE id=?', imgs[0]?.id ?? null, postId);
}

const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (_, f, cb) => cb(null, crypto.randomUUID() + path.extname(f.originalname).toLowerCase().replace(/[^.a-z0-9]/g, '')),
  }),
  limits: { fileSize: 25 * 1024 * 1024, files: 20 },
  fileFilter: (_, f, cb) => cb(null, /^image\/(jpeg|png|webp|gif)$/.test(f.mimetype)),
});

const app = express();
app.set('trust proxy', 'loopback, linklocal, uniquelocal');
app.get('/healthz', (_, res) => res.send('ok'));
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));
const api = express.Router();
app.use('/api', api);

api.get('/posts', (req, res) => res.json(q.all('SELECT * FROM posts ORDER BY updated_at DESC, id DESC').map(loadPost)));
api.post('/posts', (req, res) => {
  const { title = '', text = '' } = req.body || {};
  const id = Number(q.run('INSERT INTO posts(title,text) VALUES(?,?)', title, text).lastInsertRowid);
  addRevision(id, authorOf(req), 'Post creato');
  res.json(loadPost(getPost(id)));
});

const withPost = (req, res, next) => {
  req.post = getPost(Number(req.params.id));
  return req.post ? next() : res.status(404).json({ error: 'Post non trovato' });
};

api.get('/posts/:id', withPost, (req, res) => res.json(loadPost(req.post)));

api.put('/posts/:id', withPost, (req, res) => {
  const b = req.body || {}, id = req.post.id, changes = [];
  const imgIds = q.all('SELECT id FROM images WHERE post_id=?', id).map((i) => i.id);
  if (typeof b.title === 'string' && b.title !== req.post.title) { q.run('UPDATE posts SET title=? WHERE id=?', b.title, id); changes.push('titolo'); }
  if (typeof b.text === 'string' && b.text !== req.post.text) { q.run('UPDATE posts SET text=? WHERE id=?', b.text, id); changes.push('testo'); }
  if (['draft', 'review', 'ready', 'published'].includes(b.status) && b.status !== req.post.status) {
    q.run('UPDATE posts SET status=? WHERE id=?', b.status, id); changes.push('stato → ' + b.status);
  }
  if (Array.isArray(b.order)) {
    const order = b.order.map(Number);
    if (order.length === imgIds.length && order.every((x) => imgIds.includes(x))) {
      const cur = q.all('SELECT id FROM images WHERE post_id=? ORDER BY position', id).map((i) => i.id);
      if (cur.join() !== order.join()) { order.forEach((x, i) => q.run('UPDATE images SET position=? WHERE id=?', i, x)); changes.push('ordine foto'); }
    }
  }
  if (b.coverId !== undefined && imgIds.includes(Number(b.coverId)) && Number(b.coverId) !== req.post.cover_image_id) {
    q.run('UPDATE posts SET cover_image_id=? WHERE id=?', Number(b.coverId), id); changes.push('foto principale');
  }
  if (changes.length) { touch(id); addRevision(id, authorOf(req), 'Modificato: ' + changes.join(', ')); }
  res.json(loadPost(getPost(id)));
});

api.delete('/posts/:id', withPost, (req, res) => {
  q.all('SELECT file FROM images WHERE post_id=?', req.post.id).forEach((i) => fs.rmSync(path.join(UPLOAD_DIR, i.file), { force: true }));
  q.run('DELETE FROM posts WHERE id=?', req.post.id);
  res.json({ ok: true });
});

api.post('/posts/:id/images', withPost, upload.array('images', 20), (req, res) => {
  const files = req.files || [];
  if (!files.length) return res.status(400).json({ error: 'Nessuna immagine valida (jpg, png, webp, gif)' });
  let pos = q.one('SELECT COALESCE(MAX(position)+1,0) n FROM images WHERE post_id=?', req.post.id).n;
  files.forEach((f) => q.run('INSERT INTO images(post_id,file,original,mime,position) VALUES(?,?,?,?,?)', req.post.id, f.filename, f.originalname, f.mimetype, pos++));
  normalize(req.post.id); touch(req.post.id);
  addRevision(req.post.id, authorOf(req), `Aggiunte ${files.length} foto`);
  res.json(loadPost(getPost(req.post.id)));
});
api.delete('/posts/:id/images/:imgId', withPost, (req, res) => {
  const im = q.one('SELECT * FROM images WHERE id=? AND post_id=?', Number(req.params.imgId), req.post.id);
  if (!im) return res.status(404).json({ error: 'Foto non trovata' });
  q.run('DELETE FROM images WHERE id=?', im.id);
  fs.rmSync(path.join(UPLOAD_DIR, im.file), { force: true });
  normalize(req.post.id); touch(req.post.id);
  addRevision(req.post.id, authorOf(req), 'Foto rimossa: ' + im.original);
  res.json(loadPost(getPost(req.post.id)));
});
api.get('/images/:imgId', (req, res) => {
  const im = q.one('SELECT * FROM images WHERE id=?', Number(req.params.imgId));
  if (!im) return res.status(404).end();
  res.type(im.mime).set('Cache-Control', 'private, max-age=3600').sendFile(path.join(UPLOAD_DIR, im.file));
});
api.get('/posts/:id/revisions', withPost, (req, res) => {
  res.json(q.all('SELECT id,summary,created_at,author,snapshot FROM revisions WHERE post_id=? ORDER BY id DESC', req.post.id)
    .map((r) => ({ ...r, snapshot: JSON.parse(r.snapshot) })));
});
api.post('/posts/:id/revisions/:revId/restore', withPost, (req, res) => {
  const r = q.one('SELECT snapshot FROM revisions WHERE id=? AND post_id=?', Number(req.params.revId), req.post.id);
  if (!r) return res.status(404).json({ error: 'Versione non trovata' });
  const s = JSON.parse(r.snapshot);
  q.run('UPDATE posts SET title=?, text=? WHERE id=?', s.title, s.text, req.post.id);
  touch(req.post.id); addRevision(req.post.id, authorOf(req), 'Ripristinato titolo/testo da una versione precedente');
  res.json(loadPost(getPost(req.post.id)));
});

api.use((err, req, res, next) => res.status(err.status || 400).json({ error: err.message }));

if (require.main === module) {
  app.listen(PORT, HOST, () => console.log(`InstAQ in ascolto su ${HOST}:${PORT} (nessun login: proteggi l'accesso a livello di rete/Cloudflare)`));
}
module.exports = { app };
