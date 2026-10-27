const $app = document.getElementById('app');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const STATUS = { draft: 'Bozza', review: 'Da rivedere', ready: 'Pronto', published: 'Pubblicato' };
const LIMITS = { X: 280, LinkedIn: 3000, Instagram: 2200, Facebook: 63206 };
let state = { me: null, users: [], posts: [], current: null, dirty: false, history: null };

async function api(url, opts = {}) {
  if (opts.body && !(opts.body instanceof FormData)) {
    opts = { ...opts, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(opts.body) };
  }
  const r = await fetch('/api' + url, opts);
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || 'Errore ' + r.status);
  return data;
}
function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 2200);
}
const guard = (fn) => async (...a) => { try { await fn(...a); } catch (e) { toast(e.message); } };

// ---------- auth ----------
function renderAuth(mode = 'login') {
  const reg = mode === 'register';
  $app.innerHTML = `<form class="auth card" id="f">
    <h1>InstAQ</h1><div class="mute">Post social del team: testo, foto, condivisione.</div>
    ${reg ? '<input name="name" placeholder="Nome" required>' : ''}
    <input name="email" type="email" placeholder="Email" required>
    <input name="password" type="password" placeholder="Password (min 8)" required>
    ${reg ? '<input name="teamCode" placeholder="Codice team (vuoto se sei il primo)">' : ''}
    <button class="primary">${reg ? 'Registrati' : 'Accedi'}</button>
    <a href="#" id="sw">${reg ? 'Ho già un account' : 'Crea account'}</a></form>`;
  document.getElementById('sw').onclick = (e) => { e.preventDefault(); renderAuth(reg ? 'login' : 'register'); };
  document.getElementById('f').onsubmit = guard(async (e) => {
    e.preventDefault();
    await api(reg ? '/register' : '/login', { method: 'POST', body: Object.fromEntries(new FormData(e.target)) });
    await boot();
  });
}

// ---------- data ----------
async function loadPosts(keepId) {
  state.posts = await api('/posts');
  const id = keepId ?? state.current?.id;
  state.current = state.posts.find((p) => p.id === id) || null;
}
async function boot() {
  try { state.me = await api('/me'); } catch { return renderAuth(); }
  state.users = await api('/users');
  await loadPosts();
  render();
}
const imgUrl = (id) => `/api/images/${id}`;

// ---------- render ----------
function render() {
  const { me, posts, current: p } = state;
  $app.innerHTML = `<div class="layout"><aside>
    <div class="row spread"><h1>InstAQ</h1><button id="out" title="Esci">Esci</button></div>
    <div class="mute">${esc(me.name)} · codice team: <b>${esc(me.teamCode)}</b></div>
    <button class="primary" id="new">+ Nuovo post</button>
    ${posts.map((x) => `<div class="post-item ${p?.id === x.id ? 'active' : ''}" data-id="${x.id}">
      ${x.coverId ? `<img src="${imgUrl(x.coverId)}" alt="">` : '<div class="ph"></div>'}
      <div style="min-width:0"><div class="t">${esc(x.title) || 'Senza titolo'}</div>
      <div class="row"><span class="badge ${x.status}">${STATUS[x.status]}</span>
      <span class="mute">${x.isOwner ? 'tuo' : esc(x.owner.name)}</span></div></div></div>`).join('')
      || '<div class="mute">Nessun post. Creane uno!</div>'}
  </aside><main>${p ? editor(p) : '<div class="mute">Seleziona o crea un post.</div>'}</main></div>`;
  document.getElementById('out').onclick = guard(async () => { await api('/logout', { method: 'POST' }); renderAuth(); });
  document.getElementById('new').onclick = guard(async () => {
    const np = await api('/posts', { method: 'POST', body: { title: 'Nuovo post' } });
    await loadPosts(np.id); state.history = null; render();
  });
  document.querySelectorAll('.post-item').forEach((el) => el.onclick = () => {
    if (state.dirty && !confirm('Ci sono modifiche non salvate. Cambiare post?')) return;
    state.current = state.posts.find((x) => x.id == el.dataset.id); state.dirty = false; state.history = null; render();
  });
  if (p) bindEditor(p);
}

function editor(p) {
  return `
  <div class="card">
    <div class="row spread"><h2>Contenuto</h2>
      <select id="status" style="width:auto">${Object.entries(STATUS).map(([k, v]) => `<option value="${k}" ${p.status === k ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
    <input id="title" placeholder="Titolo interno" value="${esc(p.title)}">
    <textarea id="text" placeholder="Testo del post…">${esc(p.text)}</textarea>
    <div class="row" id="counts"></div>
    <div class="row"><button class="primary" id="save">Salva</button><span class="mute" id="saved">Ultima modifica: ${esc(p.updatedAt)}</span></div>
  </div>
  <div class="card">
    <div class="row spread"><h2>Foto</h2><span class="mute">Trascina per riordinare · ★ = foto principale (esce per prima)</span></div>
    <div class="photos" id="photos">${p.images.map((im, i) => `
      <div class="photo ${im.id === p.coverId ? 'cover' : ''}" draggable="true" data-id="${im.id}">
        <span class="n">${i + 1}</span><button class="star" data-act="cover" title="Imposta principale">★</button>
        <img src="${imgUrl(im.id)}" alt="${esc(im.original)}" draggable="false">
        <div class="bar"><span><button data-act="left">←</button> <button data-act="right">→</button></span><button class="danger" data-act="del">✕</button></div>
      </div>`).join('')}</div>
    <label class="drop" id="drop">Trascina qui le foto o clicca per sceglierle
      <input type="file" id="file" accept="image/*" multiple hidden></label>
  </div>
  <div class="card"><h2>Condividi sui social</h2>
    <div class="mute">Il testo e le foto vengono presi dalla versione salvata nel campo qui sopra.</div>
    <div class="share">
      <button class="primary" data-s="native">📤 Condividi (testo + foto)</button>
      <button data-s="instagram">Instagram</button><button data-s="x">X</button>
      <button data-s="linkedin">LinkedIn</button><button data-s="facebook">Facebook</button>
      <button data-s="whatsapp">WhatsApp</button><button data-s="telegram">Telegram</button>
      <button data-s="copy">Copia testo</button><button data-s="download">Scarica foto</button>
    </div>
  </div>
  <div class="card"><h2>Team</h2>
    <div class="mute">Proprietario: ${esc(p.owner.name)}. ${p.isOwner ? 'Scegli chi può vedere e modificare questo post:' : 'Puoi modificare il post; solo il proprietario gestisce la condivisione.'}</div>
    <div class="chips">${state.users.filter((u) => u.id !== p.owner.id).map((u) => {
      const on = p.members.some((m) => m.id === u.id);
      return `<span class="chip ${on ? 'on' : ''}" data-u="${u.id}">${esc(u.name)}</span>`;
    }).join('') || '<span class="mute">Nessun altro utente registrato. Dai ai colleghi il codice team.</span>'}</div>
  </div>
  <div class="card"><div class="row spread"><h2>Cronologia</h2><button id="hist">${state.history ? 'Nascondi' : 'Mostra'}</button></div>
    ${state.history ? `<div class="hist">${state.history.map((r) => `<div><span>${esc(r.summary)} <span class="mute">— ${esc(r.author)}, ${esc(r.created_at)}</span></span>
      <button data-rev="${r.id}">Ripristina testo</button></div>`).join('')}</div>` : ''}</div>
  ${p.isOwner ? '<button class="danger" id="delpost">Elimina post</button>' : ''}`;
}

function bindEditor(p) {
  const $ = (id) => document.getElementById(id);
  const upd = async (body) => {
    const np = await api('/posts/' + p.id, { method: 'PUT', body });
    state.posts = state.posts.map((x) => (x.id === np.id ? np : x)); state.current = np; return np;
  };
  const counts = () => {
    const len = $('text').value.length;
    $('counts').innerHTML = Object.entries(LIMITS).map(([k, m]) => `<span class="count ${len > m ? 'over' : ''}">${k}: ${len}/${m}</span>`).join('');
  };
  counts();
  const markDirty = () => { state.dirty = true; $('saved').textContent = 'Modifiche non salvate'; counts(); };
  $('title').oninput = markDirty; $('text').oninput = markDirty;
  const save = guard(async () => {
    await upd({ title: $('title').value, text: $('text').value }); state.dirty = false; toast('Salvato'); render();
  });
  $('save').onclick = save;
  document.addEventListener('keydown', function h(e) {
    if (!document.body.contains($('save'))) return document.removeEventListener('keydown', h);
    if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); save(); }
  });
  $('status').onchange = guard(async () => { await upd({ status: $('status').value }); await loadPosts(); render(); });

  // foto
  const upload = guard(async (files) => {
    const fd = new FormData(); [...files].forEach((f) => fd.append('images', f));
    const np = await api(`/posts/${p.id}/images`, { method: 'POST', body: fd });
    state.posts = state.posts.map((x) => (x.id === np.id ? np : x)); state.current = np; render();
  });
  $('file').onchange = (e) => upload(e.target.files);
  const drop = $('drop');
  drop.ondragover = (e) => { e.preventDefault(); if (e.dataTransfer.types.includes('Files')) drop.classList.add('over'); };
  drop.ondragleave = () => drop.classList.remove('over');
  drop.ondrop = (e) => { e.preventDefault(); drop.classList.remove('over'); if (e.dataTransfer.files.length) upload(e.dataTransfer.files); };
  const ids = () => p.images.map((i) => i.id);
  const reorder = guard(async (order) => { await upd({ order }); render(); });
  let dragId = null;
  document.querySelectorAll('.photo').forEach((el) => {
    const id = Number(el.dataset.id);
    el.ondragstart = () => { dragId = id; el.classList.add('drag'); };
    el.ondragend = () => el.classList.remove('drag');
    el.ondragover = (e) => e.preventDefault();
    el.ondrop = (e) => {
      e.preventDefault(); if (dragId == null || dragId === id) return;
      const o = ids().filter((x) => x !== dragId); o.splice(o.indexOf(id) + (ids().indexOf(dragId) < ids().indexOf(id) ? 1 : 0), 0, dragId);
      reorder(o);
    };
    el.querySelectorAll('button').forEach((b) => b.onclick = guard(async () => {
      const a = b.dataset.act, o = ids(), i = o.indexOf(id);
      if (a === 'cover') { await upd({ coverId: id }); render(); }
      else if (a === 'del') {
        if (!confirm('Rimuovere la foto?')) return;
        const np = await api(`/posts/${p.id}/images/${id}`, { method: 'DELETE' });
        state.posts = state.posts.map((x) => (x.id === np.id ? np : x)); state.current = np; render();
      } else {
        const j = a === 'left' ? i - 1 : i + 1; if (j < 0 || j >= o.length) return;
        [o[i], o[j]] = [o[j], o[i]]; reorder(o);
      }
    }));
  });

  // team
  document.querySelectorAll('.chip').forEach((c) => c.onclick = guard(async () => {
    if (!p.isOwner) return toast('Solo il proprietario gestisce la condivisione');
    const uid = Number(c.dataset.u), cur = p.members.map((m) => m.id);
    await upd({ members: cur.includes(uid) ? cur.filter((x) => x !== uid) : [...cur, uid] }); render();
  }));

  // cronologia
  $('hist').onclick = guard(async () => {
    state.history = state.history ? null : await api(`/posts/${p.id}/revisions`); render();
  });
  document.querySelectorAll('[data-rev]').forEach((b) => b.onclick = guard(async () => {
    const np = await api(`/posts/${p.id}/revisions/${b.dataset.rev}/restore`, { method: 'POST' });
    state.posts = state.posts.map((x) => (x.id === np.id ? np : x)); state.current = np; state.history = null; state.dirty = false; render();
  }));
  if ($('delpost')) $('delpost').onclick = guard(async () => {
    if (!confirm('Eliminare definitivamente il post e le sue foto?')) return;
    await api('/posts/' + p.id, { method: 'DELETE' }); state.current = null; await loadPosts(); render();
  });

  // condivisione: usa sempre la versione correntemente in editor
  document.querySelectorAll('[data-s]').forEach((b) => b.onclick = guard(() => share(b.dataset.s, p, $('text').value)));
}

// ---------- condivisione ----------
function orderedImages(p) { // la principale per prima, poi le altre nell'ordine scelto
  return [...p.images].sort((a, b) => (b.id === p.coverId) - (a.id === p.coverId));
}
async function imageFiles(p) {
  return Promise.all(orderedImages(p).map(async (im, i) => {
    const blob = await (await fetch(imgUrl(im.id))).blob();
    const ext = (im.original.match(/\.[a-z0-9]+$/i) || ['.jpg'])[0];
    return new File([blob], `${String(i + 1).padStart(2, '0')}-${im.original.replace(/\.[^.]+$/, '')}${ext}`, { type: blob.type });
  }));
}
async function copy(text) { await navigator.clipboard.writeText(text); }
function download(files) {
  files.forEach((f, i) => setTimeout(() => {
    const a = document.createElement('a'); a.href = URL.createObjectURL(f); a.download = f.name; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }, i * 250));
}
const open = (u) => window.open(u, '_blank', 'noopener');

async function share(kind, p, text) {
  const e = encodeURIComponent(text);
  switch (kind) {
    case 'copy': await copy(text); return toast('Testo copiato');
    case 'download': download(await imageFiles(p)); return toast('Foto in download (ordine di pubblicazione)');
    case 'native': {
      const files = await imageFiles(p);
      const data = { text, files };
      if (navigator.canShare?.(data)) { try { await navigator.share(data); } catch (err) { if (err.name !== 'AbortError') throw err; } return; }
      await copy(text); download(files);
      return toast('Condivisione nativa non supportata: testo copiato e foto scaricate');
    }
    // Instagram, Facebook e LinkedIn (per le foto) non accettano testo/foto via link: copia + scarica + apri.
    case 'instagram': await copy(text); download(await imageFiles(p)); open('https://www.instagram.com/'); return toast('Testo copiato e foto scaricate: crea il post su Instagram');
    case 'facebook': await copy(text); open('https://www.facebook.com/'); return toast('Testo copiato: incollalo nel nuovo post (aggiungi le foto da "Scarica foto")');
    case 'linkedin': await copy(text); open('https://www.linkedin.com/feed/?shareActive=true&text=' + e); return toast('Testo copiato; aggiungi le foto da "Scarica foto"');
    case 'x': return open('https://twitter.com/intent/tweet?text=' + e);
    case 'whatsapp': return open('https://wa.me/?text=' + e);
    case 'telegram': return open('https://t.me/share/url?url=%20&text=' + e);
  }
}

boot();
