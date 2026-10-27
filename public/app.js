const $app = document.getElementById('app');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const STATUS = { draft: 'Bozza', review: 'Da rivedere', ready: 'Pronto', published: 'Pubblicato' };
const X_LIMIT = 280;
let state = { posts: [], current: null, history: null };
let saveTimer = null;
const getName = () => { try { return localStorage.getItem('instaq-name') || ''; } catch { return ''; } };
const setName = (n) => { try { localStorage.setItem('instaq-name', n); } catch {} };

async function api(url, opts = {}) {
  const headers = { 'X-Author': encodeURIComponent(getName()) };
  if (opts.body && !(opts.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json'; opts = { ...opts, body: JSON.stringify(opts.body) };
  }
  const r = await fetch('/api' + url, { ...opts, headers });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || 'Errore ' + r.status);
  return data;
}
function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 2600);
}
const guard = (fn) => async (...a) => { try { await fn(...a); } catch (e) { toast(e.message); } };
const imgUrl = (id) => `/api/images/${id}`;
const hashId = () => Number((location.hash.match(/^#\/p\/(\d+)/) || [])[1]) || null;
const postLink = (id) => `${location.origin}${location.pathname}#/p/${id}`;
const setPost = (np) => { state.posts = state.posts.map((x) => (x.id === np.id ? np : x)); if (state.current?.id === np.id) state.current = np; };

// ---------- dati ----------
async function loadPosts(keepId) {
  state.posts = await api('/posts');
  const id = keepId ?? state.current?.id;
  state.current = state.posts.find((p) => p.id === id) || null;
}
function select(id) {
  state.current = state.posts.find((x) => x.id === id) || null; state.history = null;
  const h = id ? `#/p/${id}` : '';
  if (location.hash !== h) history.replaceState(null, '', location.pathname + h);
}

// Salvataggio automatico di titolo e testo (nessun pulsante «Salva»)
function setSaveState(txt) { const el = document.getElementById('savestate'); if (el) el.textContent = txt; }
async function flush() {
  if (!saveTimer) return;
  clearTimeout(saveTimer); saveTimer = null;
  const t = document.getElementById('title'), x = document.getElementById('text'), p = state.current;
  if (!t || !p) return;
  setSaveState('Salvataggio…');
  try { setPost(await api('/posts/' + p.id, { method: 'PUT', body: { title: t.value, text: x.value } })); renderList(); setSaveState('Salvato ✓'); }
  catch (e) { setSaveState('Errore: non salvato'); toast(e.message); }
}
function scheduleSave() { setSaveState('…'); clearTimeout(saveTimer); saveTimer = setTimeout(flush, 800); }
window.addEventListener('beforeunload', (e) => { if (saveTimer) { flush(); e.preventDefault(); } });

// ---------- interfaccia ----------
function listHtml() {
  const p = state.current;
  return state.posts.map((x) => `<div class="post-item ${p?.id === x.id ? 'active' : ''}" data-id="${x.id}">
    ${x.coverId ? `<img src="${imgUrl(x.coverId)}" alt="">` : '<div class="ph"></div>'}
    <div class="info"><div class="t">${esc(x.title) || 'Senza titolo'}</div>
    <span class="badge ${x.status}">${STATUS[x.status]}</span></div></div>`).join('') || '<div class="mute">Nessun post. Creane uno!</div>';
}
function renderList() {
  const el = document.getElementById('list'); if (!el) return;
  el.innerHTML = listHtml(); bindList();
}
function bindList() {
  document.querySelectorAll('.post-item').forEach((el) => el.onclick = guard(async () => {
    await flush(); select(Number(el.dataset.id)); render();
  }));
}

function render() {
  const p = state.current;
  $app.innerHTML = `<div class="layout"><aside>
    <h1>InstAQ</h1>
    <button class="primary" id="new">+ Nuovo post</button>
    <div id="list" class="list">${listHtml()}</div>
    <label class="me">Firmi come <input id="name" placeholder="il tuo nome" value="${esc(getName())}"></label>
  </aside><main>${p ? editor(p) : '<div class="empty">Seleziona un post a sinistra<br>o creane uno nuovo.</div>'}</main></div>`;
  bindList();
  document.getElementById('name').onchange = (e) => setName(e.target.value.trim());
  document.getElementById('new').onclick = guard(async () => {
    await flush();
    const np = await api('/posts', { method: 'POST', body: { title: 'Nuovo post' } });
    await loadPosts(np.id); select(np.id); render();
    const t = document.getElementById('title'); t.focus(); t.select();
  });
  if (p) bindEditor(p);
}

function editor(p) {
  const photos = p.images.map((im, i) => `
    <div class="photo ${i === 0 ? 'first' : ''}" draggable="true" data-id="${im.id}">
      <img src="${imgUrl(im.id)}" alt="${esc(im.original)}" draggable="false">
      ${i === 0 ? '<span class="tag">Principale</span>' : ''}
      <div class="ctl"><button data-act="left" title="Sposta prima">◀</button><button data-act="right" title="Sposta dopo">▶</button><button data-act="del" title="Rimuovi">✕</button></div>
    </div>`).join('');
  return `
  <div class="head">
    <input id="title" class="title" placeholder="Titolo del post" value="${esc(p.title)}">
    <div class="actions">
      <select id="status" title="Stato">${Object.entries(STATUS).map(([k, v]) => `<option value="${k}" ${p.status === k ? 'selected' : ''}>${v}</option>`).join('')}</select>
      <button id="link">🔗 Copia link</button>
      <div class="menu-wrap"><button class="primary" data-menu="shareMenu">Condividi ▾</button>
        <div class="menu" id="shareMenu">
          <button data-s="native">📱 Condividi con le foto<small>dal cellulare, nell'app che scegli</small></button>
          <button data-s="instagram">Instagram<small>copia testo + scarica foto</small></button>
          <button data-s="facebook">Facebook<small>copia testo, apre Facebook</small></button>
          <button data-s="linkedin">LinkedIn<small>testo precompilato</small></button>
          <button data-s="x">X<small>testo precompilato</small></button>
          <button data-s="whatsapp">WhatsApp<small>testo precompilato</small></button>
          <button data-s="telegram">Telegram<small>testo precompilato</small></button>
          <hr><button data-s="copy">Copia solo il testo</button><button data-s="download">Scarica solo le foto</button>
        </div></div>
      <div class="menu-wrap"><button data-menu="moreMenu" title="Altro">⋯</button>
        <div class="menu" id="moreMenu"><button id="hist">Cronologia modifiche</button><button class="danger" id="delpost">Elimina post</button></div></div>
    </div>
  </div>

  <section>
    <div class="label"><h2>Foto</h2><span class="mute">La prima è quella principale · trascina per cambiare ordine</span></div>
    <div class="photos" id="photos">${photos}
      <label class="photo add" id="drop"><span class="plus">+</span>Aggiungi foto<input type="file" id="file" accept="image/*" multiple hidden></label>
    </div>
  </section>

  <section>
    <div class="label"><h2>Testo</h2><span class="mute" id="savestate">Salvato ✓</span></div>
    <textarea id="text" placeholder="Scrivi il testo del post…">${esc(p.text)}</textarea>
    <div class="mute" id="count"></div>
  </section>
  ${state.history ? historyHtml(p) : ''}`;
}

function historyHtml(p) {
  return `<section><div class="label"><h2>Cronologia</h2><button id="histclose">Chiudi</button></div>
    <div class="hist">${state.history.map((r) => {
      const changed = r.snapshot.text !== p.text || r.snapshot.title !== p.title;
      return `<div><span>${esc(r.summary)} <span class="mute">— ${esc(r.author)}, ${esc(r.created_at)}</span></span>
      ${changed ? `<button data-rev="${r.id}">Torna a questo testo</button>` : ''}</div>`;
    }).join('')}</div></section>`;
}

function bindEditor(p) {
  const $ = (id) => document.getElementById(id);
  const refresh = guard(async (body) => { setPost(await api('/posts/' + p.id, { method: 'PUT', body })); render(); });
  const counter = () => {
    const n = $('text').value.length;
    $('count').innerHTML = `${n} caratteri` + (n > X_LIMIT ? ` · <b class="over">troppo lungo per X (max ${X_LIMIT})</b>` : '');
  };
  counter();
  $('title').oninput = scheduleSave;
  $('text').oninput = () => { counter(); scheduleSave(); };
  $('status').onchange = guard(async () => { await flush(); await refresh({ status: $('status').value }); await loadPosts(); renderList(); });
  $('link').onclick = guard(async () => { await copy(postLink(p.id)); toast('Link copiato: incollalo ai colleghi'); });

  // foto
  const upload = guard(async (files) => {
    await flush(); toast('Caricamento…');
    const fd = new FormData(); [...files].forEach((f) => fd.append('images', f));
    setPost(await api(`/posts/${p.id}/images`, { method: 'POST', body: fd })); render();
  });
  $('file').onchange = (e) => upload(e.target.files);
  const grid = $('photos');
  grid.ondragover = (e) => { if (e.dataTransfer.types.includes('Files')) { e.preventDefault(); grid.classList.add('over'); } };
  grid.ondragleave = () => grid.classList.remove('over');
  grid.ondrop = (e) => { if (e.dataTransfer.files.length) { e.preventDefault(); grid.classList.remove('over'); upload(e.dataTransfer.files); } };
  const ids = () => p.images.map((i) => i.id);
  // la prima foto è sempre la principale
  const reorder = guard(async (order) => { await flush(); await refresh({ order, coverId: order[0] }); });
  let dragId = null;
  document.querySelectorAll('.photo[data-id]').forEach((el) => {
    const id = Number(el.dataset.id);
    el.ondragstart = () => { dragId = id; el.classList.add('drag'); };
    el.ondragend = () => el.classList.remove('drag');
    el.ondragover = (e) => { if (dragId != null) e.preventDefault(); };
    el.ondrop = (e) => {
      if (dragId == null || dragId === id) return; e.preventDefault();
      const o = ids(), from = o.indexOf(dragId), to = o.indexOf(id);
      o.splice(from, 1); o.splice(to, 0, dragId); dragId = null; reorder(o);
    };
    el.querySelectorAll('button').forEach((b) => b.onclick = guard(async () => {
      const a = b.dataset.act, o = ids(), i = o.indexOf(id);
      if (a === 'del') {
        if (!confirm('Rimuovere la foto?')) return;
        await flush(); setPost(await api(`/posts/${p.id}/images/${id}`, { method: 'DELETE' })); return render();
      }
      const j = a === 'left' ? i - 1 : i + 1; if (j < 0 || j >= o.length) return;
      [o[i], o[j]] = [o[j], o[i]]; reorder(o);
    }));
  });

  // menu
  document.querySelectorAll('[data-menu]').forEach((b) => b.onclick = (e) => {
    e.stopPropagation(); const m = $(b.dataset.menu), open = m.classList.contains('open');
    document.querySelectorAll('.menu').forEach((x) => x.classList.remove('open')); if (!open) m.classList.add('open');
  });
  $('hist').onclick = guard(async () => { await flush(); state.history = await api(`/posts/${p.id}/revisions`); render(); });
  $('delpost').onclick = guard(async () => {
    if (!confirm('Eliminare definitivamente il post e le sue foto?')) return;
    clearTimeout(saveTimer); saveTimer = null;
    await api('/posts/' + p.id, { method: 'DELETE' }); await loadPosts(); select(null); render();
  });
  if ($('histclose')) $('histclose').onclick = () => { state.history = null; render(); };
  document.querySelectorAll('[data-rev]').forEach((b) => b.onclick = guard(async () => {
    setPost(await api(`/posts/${p.id}/revisions/${b.dataset.rev}/restore`, { method: 'POST' })); state.history = null; render();
  }));
  document.querySelectorAll('[data-s]').forEach((b) => b.onclick = guard(async () => { await flush(); await share(b.dataset.s, state.current, $('text').value); }));
}
document.addEventListener('click', () => document.querySelectorAll('.menu.open').forEach((m) => m.classList.remove('open')));
window.addEventListener('hashchange', guard(async () => { if (hashId() !== state.current?.id) { await flush(); select(hashId()); render(); } }));

async function boot() { await loadPosts(hashId()); render(); }

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
