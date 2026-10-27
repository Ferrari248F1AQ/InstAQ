const assert = require('node:assert/strict');
const fs = require('fs'), os = require('os'), path = require('path');
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'instaq-'));
process.env.TEAM_CODE = 'team123';
const { app } = require('./server');

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==', 'base64');
const server = app.listen(0, async () => {
  const base = `http://localhost:${server.address().port}/api`;
  const client = () => {
    let sid = '';
    return async (url, { method = 'GET', body } = {}) => {
      const init = { method, headers: { cookie: sid } };
      if (body instanceof FormData) init.body = body;
      else if (body) { init.body = JSON.stringify(body); init.headers['content-type'] = 'application/json'; }
      const r = await fetch(base + url, init);
      const c = r.headers.get('set-cookie'); if (c) sid = c.split(';')[0];
      return { status: r.status, data: await r.json().catch(() => null) };
    };
  };
  try {
    const a = client(), b = client(), c = client();
    assert.equal((await a('/me')).status, 401);
    assert.equal((await a('/register', { method: 'POST', body: { name: 'Anna', email: 'a@x.it', password: 'password1' } })).status, 200);
    assert.equal((await b('/register', { method: 'POST', body: { name: 'Bob', email: 'b@x.it', password: 'password1', teamCode: 'no' } })).status, 403);
    assert.equal((await b('/register', { method: 'POST', body: { name: 'Bob', email: 'b@x.it', password: 'password1', teamCode: 'team123' } })).status, 200);
    assert.equal((await c('/register', { method: 'POST', body: { name: 'Cris', email: 'c@x.it', password: 'password1', teamCode: 'team123' } })).status, 200);

    let post = (await a('/posts', { method: 'POST', body: { title: 'Lancio' } })).data;
    const fd = new FormData();
    for (const n of ['1.png', '2.png', '3.png']) fd.append('images', new Blob([PNG], { type: 'image/png' }), n);
    post = (await a(`/posts/${post.id}/images`, { method: 'POST', body: fd })).data;
    assert.equal(post.images.length, 3);
    assert.equal(post.coverId, post.images[0].id);

    const [i1, i2, i3] = post.images.map((i) => i.id);
    post = (await a(`/posts/${post.id}`, { method: 'PUT', body: { order: [i3, i1, i2], coverId: i2, text: 'Ciao #mondo' } })).data;
    assert.deepEqual(post.images.map((i) => i.id), [i3, i1, i2]);
    assert.equal(post.coverId, i2);

    assert.equal((await b(`/posts/${post.id}`)).status, 404, 'non condiviso → invisibile');
    assert.equal((await b(`/images/${i1}`)).status, 404);
    await a(`/posts/${post.id}`, { method: 'PUT', body: { members: [2] } });
    assert.equal((await b(`/posts/${post.id}`)).status, 200);
    assert.equal((await b(`/images/${i1}`)).status, 200);
    assert.equal((await c(`/posts/${post.id}`)).status, 404);

    const edited = (await b(`/posts/${post.id}`, { method: 'PUT', body: { text: 'Testo di Bob', status: 'ready', members: [3] } })).data;
    assert.equal(edited.text, 'Testo di Bob');
    assert.equal(edited.members.length, 1, 'un collaboratore non cambia la condivisione');
    assert.equal((await b(`/posts/${post.id}`, { method: 'DELETE' })).status, 403);

    const revs = (await a(`/posts/${post.id}/revisions`)).data;
    assert.ok(revs.some((r) => r.author === 'Bob'));
    const old = revs.find((r) => r.snapshot.text === 'Ciao #mondo');
    const restored = (await a(`/posts/${post.id}/revisions/${old.id}/restore`, { method: 'POST' })).data;
    assert.equal(restored.text, 'Ciao #mondo');

    post = (await a(`/posts/${post.id}/images/${i2}`, { method: 'DELETE' })).data;
    assert.equal(post.images.length, 2);
    assert.ok(post.images.some((i) => i.id === post.coverId), 'copertina riassegnata');
    assert.equal((await a(`/posts/${post.id}`, { method: 'DELETE' })).status, 200);
    console.log('OK: tutti i test passati');
  } catch (e) { console.error(e); process.exitCode = 1; }
  server.close();
});
