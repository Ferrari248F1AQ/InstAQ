const assert = require('node:assert/strict');
const fs = require('fs'), os = require('os'), path = require('path');
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'instaq-'));
const { app } = require('./server');

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==', 'base64');
const server = app.listen(0, async () => {
  const base = `http://localhost:${server.address().port}/api`;
  const call = async (url, { method = 'GET', body, author } = {}) => {
    const init = { method, headers: {} };
    if (author) init.headers['x-author'] = encodeURIComponent(author);
    if (body instanceof FormData) init.body = body;
    else if (body) { init.body = JSON.stringify(body); init.headers['content-type'] = 'application/json'; }
    const r = await fetch(base + url, init);
    return { status: r.status, data: await r.json().catch(() => null) };
  };
  try {
    assert.equal((await call('/posts')).status, 200, 'nessun login richiesto');
    let post = (await call('/posts', { method: 'POST', body: { title: 'Lancio' }, author: 'Anna' })).data;
    const fd = new FormData();
    for (const n of ['1.png', '2.png', '3.png']) fd.append('images', new Blob([PNG], { type: 'image/png' }), n);
    post = (await call(`/posts/${post.id}/images`, { method: 'POST', body: fd, author: 'Anna' })).data;
    assert.equal(post.images.length, 3);
    assert.equal(post.coverId, post.images[0].id);

    const [i1, i2, i3] = post.images.map((i) => i.id);
    post = (await call(`/posts/${post.id}`, { method: 'PUT', body: { order: [i3, i1, i2], coverId: i2, text: 'Ciao #mondo' }, author: 'Anna' })).data;
    assert.deepEqual(post.images.map((i) => i.id), [i3, i1, i2]);
    assert.equal(post.coverId, i2);
    assert.equal((await call(`/images/${i1}`)).status, 200);

    const edited = (await call(`/posts/${post.id}`, { method: 'PUT', body: { text: 'Testo di Bob', status: 'ready' }, author: 'Bob' })).data;
    assert.equal(edited.text, 'Testo di Bob');
    assert.equal((await call('/posts')).data.length, 1);

    const revs = (await call(`/posts/${post.id}/revisions`)).data;
    assert.ok(revs.some((r) => r.author === 'Bob'));
    const old = revs.find((r) => r.snapshot.text === 'Ciao #mondo');
    assert.equal((await call(`/posts/${post.id}/revisions/${old.id}/restore`, { method: 'POST' })).data.text, 'Ciao #mondo');

    post = (await call(`/posts/${post.id}/images/${i2}`, { method: 'DELETE' })).data;
    assert.equal(post.images.length, 2);
    assert.ok(post.images.some((i) => i.id === post.coverId), 'copertina riassegnata');
    assert.equal((await call(`/posts/${post.id}`, { method: 'DELETE' })).status, 200);
    assert.equal((await call(`/posts/${post.id}`)).status, 404);
    console.log('OK: tutti i test passati');
  } catch (e) { console.error(e); process.exitCode = 1; }
  server.close();
});
