const express = require('express');
const multer = require('multer');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const PORT = process.env.PORT || 3000;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const db = new DatabaseSync(path.join(DATA_DIR, 'instaq.db'));
db.exec(`
PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE,
  pass_hash TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE);
CREATE TABLE IF NOT EXISTS posts (
  id INTEGER PRIMARY KEY, title TEXT NOT NULL DEFAULT '', text TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft', owner_id INTEGER NOT NULL REFERENCES users(id),
  cover_image_id INTEGER, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS images (
  id INTEGER PRIMARY KEY, post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  file TEXT NOT NULL, original TEXT NOT NULL, mime TEXT NOT NULL, position INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS members (
  post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (post_id, user_id));
CREATE TABLE IF NOT EXISTS revisions (
  id INTEGER PRIMARY KEY, post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id), summary TEXT NOT NULL, snapshot TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
`);

// Codice che i colleghi devono usare per registrarsi (il primo utente è libero).
const TEAM_CODE = process.env.TEAM_CODE || (() => {
  const f = path.join(DATA_DIR, 'team_code');
  if (!fs.existsSync(f)) fs.writeFileSync(f, crypto.randomBytes(4).toString('hex'));
  return fs.readFileSync(f, 'utf8').trim();
})();

const q = {
  one: (sql, ...p) => db.prepare(sql).get(...p),
  all: (sql, ...p) => db.prepare(sql).all(...p),
  run: (sql, ...p) => db.prepare(sql).run(...p),
};

// ---------- auth ----------
const hash = (pw, salt = crypto.randomBytes(16).toString('hex')) =>
  salt + ':' + crypto.scryptSync(pw, salt, 64).toString('hex');
const verify = (pw, stored) => {
  const [salt, h] = stored.split(':');
  const a = Buffer.from(h, 'hex'), b = crypto.scryptSync(pw, salt, 64);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};
const cookie = (req, name) => {
  const m = (req.headers.cookie || '').split(/;\s*/).find((c) => c.startsWith(name + '='));
  return m ? decodeURIComponent(m.slice(name.length + 1)) : null;
};
const login = (res, userId) => {
  const token = crypto.randomBytes(32).toString('hex');
  q.run('INSERT INTO sessions(token,user_id) VALUES(?,?)', token, userId);
  res.setHeader('Set-Cookie', `sid=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=2592000`);
};
const auth = (req, res, next) => {
  const t = cookie(req, 'sid');
  const u = t && q.one('SELECT u.id,u.name,u.email FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token=?', t);
  if (!u) return res.status(401).json({ error: 'Non autenticato' });
  req.user = u;
  next();
};

// ---------- posts ----------
const canAccess = (postId, userId) =>
  q.one(`SELECT p.* FROM posts p WHERE p.id=? AND (p.owner_id=? OR EXISTS
         (SELECT 1 FROM members m WHERE m.post_id=p.id AND m.user_id=?))`, postId, userId, userId);

function loadPost(p, userId) {
  return {
    id: p.id, title: p.title, text: p.text, status: p.status,
    coverId: p.cover_image_id, createdAt: p.created_at, updatedAt: p.updated_at,
    owner: q.one('SELECT id,name FROM users WHERE id=?', p.owner_id),
    isOwner: p.owner_id === userId,
    images: q.all('SELECT id,original,position FROM images WHERE post_id=? ORDER BY position', p.id),
    members: q.all('SELECT u.id,u.name FROM members m JOIN users u ON u.id=m.user_id WHERE m.post_id=?', p.id),
  };
}
const snapshot = (p) => JSON.stringify({
  title: p.title, text: p.text, status: p.status, coverId: p.coverId,
  images: p.images.map((i) => ({ id: i.id, original: i.original })),
});
function addRevision(postId, userId, summary) {
  const p = loadPost(q.one('SELECT * FROM posts WHERE id=?', postId), userId);
  q.run('INSERT INTO revisions(post_id,user_id,summary,snapshot) VALUES(?,?,?,?)', postId, userId, summary, snapshot(p));
}
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
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));
const api = express.Router();
app.use('/api', api);

api.post('/register', (req, res) => {
  const { name, email, password, teamCode } = req.body || {};
  if (!name || !email || !password || password.length < 8) return res.status(400).json({ error: 'Nome, email e password (min 8 caratteri) obbligatori' });
  const first = q.one('SELECT COUNT(*) n FROM users').n === 0;
  if (!first && teamCode !== TEAM_CODE) return res.status(403).json({ error: 'Codice team errato' });
  if (q.one('SELECT 1 FROM users WHERE email=?', email.toLowerCase())) return res.status(409).json({ error: 'Email già registrata' });
  const r = q.run('INSERT INTO users(name,email,pass_hash) VALUES(?,?,?)', name.trim(), email.toLowerCase(), hash(password));
  login(res, Number(r.lastInsertRowid));
  res.json({ ok: true });
});
api.post('/login', (req, res) => {
  const { email, password } = req.body || {};
  const u = q.one('SELECT * FROM users WHERE email=?', String(email || '').toLowerCase());
  if (!u || !verify(String(password || ''), u.pass_hash)) return res.status(401).json({ error: 'Credenziali errate' });
  login(res, u.id);
  res.json({ ok: true });
});
api.post('/logout', (req, res) => {
  const t = cookie(req, 'sid');
  if (t) q.run('DELETE FROM sessions WHERE token=?', t);
  res.setHeader('Set-Cookie', 'sid=; Path=/; Max-Age=0');
  res.json({ ok: true });
});

api.use(auth);
api.get('/me', (req, res) => res.json({ ...req.user, teamCode: TEAM_CODE }));
api.get('/users', (req, res) => res.json(q.all('SELECT id,name,email FROM users ORDER BY name')));

api.get('/posts', (req, res) => {
  const rows = q.all(`SELECT * FROM posts p WHERE p.owner_id=? OR EXISTS
    (SELECT 1 FROM members m WHERE m.post_id=p.id AND m.user_id=?) ORDER BY updated_at DESC`, req.user.id, req.user.id);
  res.json(rows.map((p) => loadPost(p, req.user.id)));
});
api.post('/posts', (req, res) => {
  const { title = '', text = '' } = req.body || {};
  const r = q.run('INSERT INTO posts(title,text,owner_id) VALUES(?,?,?)', title, text, req.user.id);
  const id = Number(r.lastInsertRowid);
  addRevision(id, req.user.id, 'Post creato');
  res.json(loadPost(q.one('SELECT * FROM posts WHERE id=?', id), req.user.id));
});

const withPost = (req, res, next) => {
  const p = canAccess(Number(req.params.id), req.user.id);
  if (!p) return res.status(404).json({ error: 'Post non trovato' });
  req.post = p;
  next();
};

api.get('/posts/:id', withPost, (req, res) => res.json(loadPost(req.post, req.user.id)));

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
  if (Array.isArray(b.members) && req.post.owner_id === req.user.id) {
    const ids = [...new Set(b.members.map(Number))].filter((u) => u !== req.user.id && q.one('SELECT 1 FROM users WHERE id=?', u));
    q.run('DELETE FROM members WHERE post_id=?', id);
    ids.forEach((u) => q.run('INSERT INTO members(post_id,user_id) VALUES(?,?)', id, u));
    changes.push('condivisione');
  }
  if (changes.length) { touch(id); addRevision(id, req.user.id, 'Modificato: ' + changes.join(', ')); }
  res.json(loadPost(q.one('SELECT * FROM posts WHERE id=?', id), req.user.id));
});

api.delete('/posts/:id', withPost, (req, res) => {
  if (req.post.owner_id !== req.user.id) return res.status(403).json({ error: 'Solo il proprietario può eliminare' });
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
  addRevision(req.post.id, req.user.id, `Aggiunte ${files.length} foto`);
  res.json(loadPost(q.one('SELECT * FROM posts WHERE id=?', req.post.id), req.user.id));
});
api.delete('/posts/:id/images/:imgId', withPost, (req, res) => {
  const im = q.one('SELECT * FROM images WHERE id=? AND post_id=?', Number(req.params.imgId), req.post.id);
  if (!im) return res.status(404).json({ error: 'Foto non trovata' });
  q.run('DELETE FROM images WHERE id=?', im.id);
  fs.rmSync(path.join(UPLOAD_DIR, im.file), { force: true });
  normalize(req.post.id); touch(req.post.id);
  addRevision(req.post.id, req.user.id, 'Foto rimossa: ' + im.original);
  res.json(loadPost(q.one('SELECT * FROM posts WHERE id=?', req.post.id), req.user.id));
});
api.get('/images/:imgId', (req, res) => {
  const im = q.one('SELECT * FROM images WHERE id=?', Number(req.params.imgId));
  if (!im || !canAccess(im.post_id, req.user.id)) return res.status(404).end();
  res.type(im.mime).set('Cache-Control', 'private, max-age=3600').sendFile(path.join(UPLOAD_DIR, im.file));
});
api.get('/posts/:id/revisions', withPost, (req, res) => {
  res.json(q.all(`SELECT r.id,r.summary,r.created_at,u.name AS author,r.snapshot FROM revisions r
    JOIN users u ON u.id=r.user_id WHERE r.post_id=? ORDER BY r.id DESC`, req.post.id)
    .map((r) => ({ ...r, snapshot: JSON.parse(r.snapshot) })));
});
api.post('/posts/:id/revisions/:revId/restore', withPost, (req, res) => {
  const r = q.one('SELECT snapshot FROM revisions WHERE id=? AND post_id=?', Number(req.params.revId), req.post.id);
  if (!r) return res.status(404).json({ error: 'Versione non trovata' });
  const s = JSON.parse(r.snapshot);
  q.run('UPDATE posts SET title=?, text=? WHERE id=?', s.title, s.text, req.post.id);
  touch(req.post.id); addRevision(req.post.id, req.user.id, 'Ripristinato titolo/testo da una versione precedente');
  res.json(loadPost(q.one('SELECT * FROM posts WHERE id=?', req.post.id), req.user.id));
});

api.use((err, req, res, next) => res.status(err.status || 400).json({ error: err.message }));

if (require.main === module) {
  app.listen(PORT, () => console.log(`InstAQ su http://localhost:${PORT}  — codice team per i colleghi: ${TEAM_CODE}`));
}
module.exports = { app };
