const $app = document.getElementById('app');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const STATUS = { draft: 'Bozza', review: 'Da rivedere', ready: 'Pronto', published: 'Pubblicato' };
const X_LIMIT = 280;
// Loghi dei social (Simple Icons, licenza CC0). X resta currentColor per il tema scuro.
const ICONS = {
  instagram: ['#FF0069', 'M7.0301.084c-1.2768.0602-2.1487.264-2.911.5634-.7888.3075-1.4575.72-2.1228 1.3877-.6652.6677-1.075 1.3368-1.3802 2.127-.2954.7638-.4956 1.6365-.552 2.914-.0564 1.2775-.0689 1.6882-.0626 4.947.0062 3.2586.0206 3.6671.0825 4.9473.061 1.2765.264 2.1482.5635 2.9107.308.7889.72 1.4573 1.388 2.1228.6679.6655 1.3365 1.0743 2.1285 1.38.7632.295 1.6361.4961 2.9134.552 1.2773.056 1.6884.069 4.9462.0627 3.2578-.0062 3.668-.0207 4.9478-.0814 1.28-.0607 2.147-.2652 2.9098-.5633.7889-.3086 1.4578-.72 2.1228-1.3881.665-.6682 1.0745-1.3378 1.3795-2.1284.2957-.7632.4966-1.636.552-2.9124.056-1.2809.0692-1.6898.063-4.948-.0063-3.2583-.021-3.6668-.0817-4.9465-.0607-1.2797-.264-2.1487-.5633-2.9117-.3084-.7889-.72-1.4568-1.3876-2.1228C21.2982 1.33 20.628.9208 19.8378.6165 19.074.321 18.2017.1197 16.9244.0645 15.6471.0093 15.236-.005 11.977.0014 8.718.0076 8.31.0215 7.0301.0839m.1402 21.6932c-1.17-.0509-1.8053-.2453-2.2287-.408-.5606-.216-.96-.4771-1.3819-.895-.422-.4178-.6811-.8186-.9-1.378-.1644-.4234-.3624-1.058-.4171-2.228-.0595-1.2645-.072-1.6442-.079-4.848-.007-3.2037.0053-3.583.0607-4.848.05-1.169.2456-1.805.408-2.2282.216-.5613.4762-.96.895-1.3816.4188-.4217.8184-.6814 1.3783-.9003.423-.1651 1.0575-.3614 2.227-.4171 1.2655-.06 1.6447-.072 4.848-.079 3.2033-.007 3.5835.005 4.8495.0608 1.169.0508 1.8053.2445 2.228.408.5608.216.96.4754 1.3816.895.4217.4194.6816.8176.9005 1.3787.1653.4217.3617 1.056.4169 2.2263.0602 1.2655.0739 1.645.0796 4.848.0058 3.203-.0055 3.5834-.061 4.848-.051 1.17-.245 1.8055-.408 2.2294-.216.5604-.4763.96-.8954 1.3814-.419.4215-.8181.6811-1.3783.9-.4224.1649-1.0577.3617-2.2262.4174-1.2656.0595-1.6448.072-4.8493.079-3.2045.007-3.5825-.006-4.848-.0608M16.953 5.5864A1.44 1.44 0 1 0 18.39 4.144a1.44 1.44 0 0 0-1.437 1.4424M5.8385 12.012c.0067 3.4032 2.7706 6.1557 6.173 6.1493 3.4026-.0065 6.157-2.7701 6.1506-6.1733-.0065-3.4032-2.771-6.1565-6.174-6.1498-3.403.0067-6.156 2.771-6.1496 6.1738M8 12.0077a4 4 0 1 1 4.008 3.9921A3.9996 3.9996 0 0 1 8 12.0077'],
  facebook: ['#0866FF', 'M9.101 23.691v-7.98H6.627v-3.667h2.474v-1.58c0-4.085 1.848-5.978 5.858-5.978.401 0 .955.042 1.468.103a8.68 8.68 0 0 1 1.141.195v3.325a8.623 8.623 0 0 0-.653-.036 26.805 26.805 0 0 0-.733-.009c-.707 0-1.259.096-1.675.309a1.686 1.686 0 0 0-.679.622c-.258.42-.374.995-.374 1.752v1.297h3.919l-.386 2.103-.287 1.564h-3.246v8.245C19.396 23.238 24 18.179 24 12.044c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.628 3.874 10.35 9.101 11.647Z'],
  x: ['currentColor', 'M14.234 10.162 22.977 0h-2.072l-7.591 8.824L7.251 0H.258l9.168 13.343L.258 24H2.33l8.016-9.318L16.749 24h6.993zm-2.837 3.299-.929-1.329L3.076 1.56h3.182l5.965 8.532.929 1.329 7.754 11.09h-3.182z'],
  whatsapp: ['#25D366', 'M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z'],
  telegram: ['#26A5E4', 'M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z'],
  linkedin: ['#0A66C2', 'M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z']
};
const icon = (k) => `<svg viewBox="0 0 24 24" width="26" height="26" fill="${ICONS[k][0]}" aria-hidden="true"><path d="${ICONS[k][1]}"/></svg>`;
// Telefono/tablet (iPadOS si presenta come Mac con touch). Su questi dispositivi la condivisione passa SEMPRE dal menu di sistema:
// non si scaricano file, perché Instagram & co. leggono la libreria foto e non la cartella Download.
// Con «Richiedi sito desktop» iOS si presenta come Mac: un Mac vero non ha touch (maxTouchPoints 0), quindi Mac/iPhone + touch = telefono o iPad.
const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
  || (navigator.maxTouchPoints > 1 && /Mac|iPhone|iPad|iPod|Android/i.test(navigator.platform + ' ' + navigator.userAgent));
const canShareFiles = isMobile && typeof navigator.share === 'function';

let state = { posts: [], current: null, history: null };
let saveTimer = null;
let uploading = false;
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
  $app.innerHTML = `<div class="layout"><header class="top">
    <picture class="lockup"><source media="(prefers-color-scheme: dark)" srcset="/img/lockup-neg.svg"><img src="/img/lockup.svg" alt="Università degli Studi dell'Aquila · DIIIE, Dipartimento di Ingegneria Industriale e dell'Informazione e di Economia"></picture>
    <div class="brand"><img src="/img/instaq.svg" alt="" width="36" height="36"><h1>InstAQ</h1></div>
  </header><aside>
    <button class="primary" id="new">+ Nuovo post</button>
    <div id="list" class="list">${listHtml()}</div>
    <button class="me" id="name" title="Il tuo nome compare nella cronologia delle modifiche">👤 ${getName() ? esc(getName()) : 'Imposta il tuo nome'}</button>
  </aside><main>${p ? editor(p) : '<div class="empty">Seleziona un post a sinistra<br>o creane uno nuovo.</div>'}</main></div>`;
  bindList();
  document.getElementById('name').onclick = (e) => {
    const n = prompt('Il tuo nome (compare nella cronologia delle modifiche):', getName());
    if (n !== null) { setName(n.trim()); e.target.textContent = '👤 ' + (n.trim() || 'Imposta il tuo nome'); }
  };
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
      <button id="link" title="Copia il link di questo post da mandare ai colleghi">🔗 Copia link</button>
      <div class="menu-wrap"><button data-menu="moreMenu" title="Altro">⋯</button>
        <div class="menu" id="moreMenu"><button id="hist">Cronologia modifiche</button><button id="diag">Diagnostica dispositivo</button><button class="danger" id="delpost">Elimina post</button></div></div>
    </div>
  </div>
  <div class="status"><span class="mute">Stato</span>${Object.entries(STATUS).map(([k, v]) =>
    `<button class="seg ${p.status === k ? 'on ' + k : ''}" data-status="${k}">${v}</button>`).join('')}</div>

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
  ${publishHtml(p)}
  ${state.history ? historyHtml(p) : ''}`;
}

const qrSvg = (url) => { const q = qrcode(0, 'M'); q.addData(url); q.make(); return q.createSvgTag({ cellSize: 4, margin: 0, scalable: true }); };
const NETS = [
  ['instagram', 'Instagram', 'copia il testo e scarica le foto', 'foto in ordine · testo copiato da incollare'],
  ['facebook', 'Facebook', 'copia il testo e scarica le foto', 'foto in ordine · testo copiato da incollare'],
  ['linkedin', 'LinkedIn', 'copia il testo e scarica le foto', 'salva le foto in libreria · testo copiato da incollare'],
  ['x', 'X', 'testo già scritto', 'testo già scritto'],
  ['whatsapp', 'WhatsApp', 'testo già scritto', 'testo già scritto'],
  ['telegram', 'Telegram', 'testo già scritto', 'testo già scritto'],
];
function publishHtml(p) {
  const top = canShareFiles
    ? `<button class="primary big" data-s="native">📱 Condividi con un'altra app<small>Consigliato · manda le foto già in ordine all'app che scegli; il testo viene copiato per incollarlo</small></button>`
    : isMobile ? '' : `<div class="reco"><div class="qr">${qrSvg(postLink(p.id))}</div><div>
        <b>Consigliato: continua dal telefono</b>
        <p>Inquadra il codice con la fotocamera: si apre questo post sul telefono. Lì, con «Condividi con un'altra app», mandi le foto già in ordine a Instagram o a qualsiasi altra app senza scaricare nulla (il testo viene copiato, lo incolli con un tocco).</p></div></div>`;
  return `<section>
    <div class="label"><h2>Pubblica sui social</h2><span class="mute">Usa il testo e le foto di questa pagina</span></div>
    ${top}
    <div class="mute">${canShareFiles ? 'Oppure apri direttamente un social:' : 'Oppure dal computer (ti guidiamo passo per passo):'}</div>
    <div class="socials">${NETS.map(([k, n, hPc, hPhone]) =>
      `<button class="soc" data-s="${k}">${icon(k)}<span><b>${n}</b><small>${canShareFiles ? hPhone : hPc}</small></span></button>`).join('')}</div>
    <div class="extra"><button data-s="copy">Copia solo il testo</button><button data-s="download">Scarica solo le foto</button></div>
  </section>`;
}

// Guida passo-passo. Telefono: menu di condivisione di sistema (le app ricevono le foto, quasi mai il testo).
// Computer: testo copiato, foto scaricate, poi si apre il sito del social.
const PASTE_PHONE = 'Il testo non arriva da solo: nel campo della didascalia <b>tieni premuto</b> e scegli <b>Incolla</b>.';
const SAVE_PHONE = 'Se l\'app non mostra le foto: nel menu scegli <b>Salva immagini</b> (finiscono nella libreria), poi selezionale <b>nell\'ordine 1, 2, 3…</b>';
const PASTE_PC = 'Incolla il testo (<b>Ctrl+V</b>, su Mac <b>⌘V</b>).';
const ORDER = (n) => `<b>nell'ordine foto-01, foto-02…</b> (la 01 è la principale)`;
const GUIDES = {
  instagram: { name: 'Instagram', url: 'https://www.instagram.com/',
    pc: (n) => ['Su Instagram clicca <b>Crea</b> (+) → <b>Post</b>.', n ? `Seleziona le ${n} foto dalla cartella Download ${ORDER(n)}.` : 'Scegli le foto.', PASTE_PC.replace('Incolla', 'Nella didascalia incolla') + ' Poi pubblica.'],
    phone: () => ['Nel menu che si apre scegli <b>Instagram</b> → <b>Post</b>.', PASTE_PHONE, SAVE_PHONE] },
  facebook: { name: 'Facebook', url: 'https://www.facebook.com/',
    pc: (n) => ['Su Facebook clicca «A cosa stai pensando?».', PASTE_PC, n ? `Aggiungi le ${n} foto ${ORDER(n)}.` : 'Pubblica.'],
    phone: () => ['Nel menu che si apre scegli <b>Facebook</b>.', PASTE_PHONE, SAVE_PHONE] },
  linkedin: { name: 'LinkedIn', url: 'https://www.linkedin.com/feed/',
    pc: (n) => ['In LinkedIn clicca <b>Inizia un post</b>.', PASTE_PC, n ? `Clicca l'icona immagine e aggiungi le ${n} foto ${ORDER(n)}. Poi pubblica.` : 'Pubblica.'],
    phone: () => ['Apri LinkedIn → <b>Inizia un post</b> e incolla il testo.'],
    // LinkedIn (come il selettore foto di iOS) legge solo la Libreria foto: le foto vanno salvate lì con «Salva immagini»
    library: (n) => [`Tocca <b>Salva le foto</b> e nel menu scegli <b>Salva ${n} immagini</b> (non «Salva su File»: LinkedIn legge solo la libreria foto).`,
      'Tocca <b>Apri LinkedIn</b> → <b>Inizia un post</b> e incolla il testo (tieni premuto nel campo e scegli <b>Incolla</b>).',
      `Aggiungi le foto dalla libreria: sono le ultime ${n} salvate e <b>la più vecchia delle ${n} è la principale</b>. Toccale in quell'ordine.`] },
  native: { name: 'un\'altra app', url: null,
    pc: () => [], phone: () => ['Nel menu che si apre scegli l\'app.', 'Instagram e altre app <b>non ricevono il testo</b>: se manca, tieni premuto nel campo della didascalia e scegli <b>Incolla</b>.'] },
};
function showGuide(kind, text, files, phone, copied) {
  const g = GUIDES[kind], n = files.length, lib = phone && !!g.library && n > 0;
  const el = document.createElement('div'); el.className = 'modal';
  el.innerHTML = `<div class="dialog"><h2>${phone ? 'Condividi su' : 'Pubblica su'} ${g.name}</h2>
    <div class="done">${copied ? '<span>✓ Testo copiato</span>' : '<span class="warn">⚠ Copia non riuscita: copia il testo qui sotto</span>'}${n ? `<span>✓ ${n} foto ${phone ? 'pronte' : 'scaricate'}</span>` : ''}</div>
    ${copied ? '' : `<textarea readonly class="copybox">${esc(text)}</textarea>`}
    <ol>${(lib ? g.library(n) : phone ? g.phone(n) : g.pc(n)).map((x) => `<li>${x}</li>`).join('')}</ol>
    <div class="row-end"><button id="gclose">Chiudi</button>${lib ? `<button id="glink">Apri ${g.name} ↗</button>` : ''}<button class="primary" id="gopen">${lib ? 'Salva le foto →' : phone ? "Scegli l'app →" : `Apri ${g.name} ↗`}</button></div></div>`;
  document.body.appendChild(el);
  const close = () => el.remove();
  el.onclick = (e) => { if (e.target === el) close(); };
  el.querySelector('#gclose').onclick = close;
  if (lib) el.querySelector('#glink').onclick = () => open(g.url);
  el.querySelector('#gopen').onclick = async () => {
    if (!phone) { open(g.url); return close(); }
    try {
      const data = lib ? { files } : n ? { files, text } : { text };   // «Salva immagini» compare solo se nel menu ci sono soltanto immagini
      if (n && navigator.canShare && !navigator.canShare(data)) { toast('Questo browser non può inviare le foto: aprilo con Safari o Chrome'); await navigator.share({ text }); return close(); }
      await navigator.share(data); if (!lib) close();   // in modalità libreria resta aperta: serve ancora «Apri LinkedIn»
    }
    catch (err) { if (err.name !== 'AbortError') toast('Condivisione non riuscita: ' + err.message); }
  };
}

function historyHtml(p) {
  return `<section><div class="label"><h2>Cronologia</h2><button id="histclose">Chiudi</button></div>
    <div class="hist">${state.history.map((r) => {
      const changed = r.snapshot.text !== p.text || r.snapshot.title !== p.title;
      return `<div><span>${esc(r.summary)} <span class="mute">— ${esc(r.author)}, ${esc(r.created_at)}</span></span>
      ${changed ? `<button data-rev="${r.id}">Torna a questo testo</button>` : ''}</div>`;
    }).join('')}</div></section>`;
}

// Foto ingrandita: clic sulla miniatura; frecce o tasti ←/→ per scorrere, Esc o clic sullo sfondo per chiudere, swipe su touch
function openLightbox(p, start) {
  const imgs = p.images; let i = start;
  const el = document.createElement('div'); el.className = 'lightbox'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'Foto ingrandita');
  el.innerHTML = `<button class="lb-close" aria-label="Chiudi">✕</button>
    ${imgs.length > 1 ? '<button class="lb-nav lb-prev" aria-label="Foto precedente">‹</button><button class="lb-nav lb-next" aria-label="Foto successiva">›</button>' : ''}
    <figure><img alt=""><figcaption></figcaption></figure>`;
  const img = el.querySelector('img'), cap = el.querySelector('figcaption');
  const show = (n) => {
    i = (n + imgs.length) % imgs.length; const im = imgs[i];
    img.src = imgUrl(im.id); img.alt = im.original;
    cap.textContent = `${i + 1} / ${imgs.length}${i === 0 ? ' · Principale' : ''} · ${im.original}`;
  };
  const key = (e) => { if (e.key === 'Escape') close(); else if (e.key === 'ArrowLeft') show(i - 1); else if (e.key === 'ArrowRight') show(i + 1); };
  const close = () => { el.remove(); document.removeEventListener('keydown', key); };
  el.onclick = (e) => { if (e.target === el || e.target.tagName === 'FIGURE') close(); };
  el.querySelector('.lb-close').onclick = close;
  if (imgs.length > 1) { el.querySelector('.lb-prev').onclick = () => show(i - 1); el.querySelector('.lb-next').onclick = () => show(i + 1); }
  let x0 = null;
  el.ontouchstart = (e) => { x0 = e.touches[0].clientX; };
  el.ontouchend = (e) => { if (x0 === null) return; const dx = e.changedTouches[0].clientX - x0; x0 = null; if (Math.abs(dx) > 50 && imgs.length > 1) show(i + (dx < 0 ? 1 : -1)); };
  document.body.appendChild(el); document.addEventListener('keydown', key); show(i);
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
  document.querySelectorAll('[data-status]').forEach((b) => b.onclick = guard(async () => {
    await flush(); await refresh({ status: b.dataset.status }); await loadPosts(); renderList();
  }));
  $('link').onclick = guard(async () => { await copy(postLink(p.id)); toast('Link copiato: incollalo ai colleghi'); });

  // foto
  // Un solo caricamento alla volta (alcuni browser mobili emettono due volte l'evento «change»);
  // se la richiesta fallisce il server potrebbe aver salvato comunque: si ricarica lo stato reale prima di far riprovare
  const upload = async (files) => {
    if (uploading || !files.length) return;
    uploading = true;
    try {
      await flush(); toast('Caricamento…');
      const fd = new FormData(); [...files].forEach((f) => fd.append('images', f));
      setPost(await api(`/posts/${p.id}/images`, { method: 'POST', body: fd })); render();
    } catch (e) {
      toast(e.message + ' — controllo cosa è stato salvato…');
      try { await loadPosts(p.id); render(); } catch {}
    } finally { uploading = false; }
  };
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
    el.onclick = (e) => { if (!e.target.closest('button')) openLightbox(p, ids().indexOf(id)); };
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
  $('diag').onclick = () => {
    let probe = false; try { probe = !!navigator.canShare?.({ files: [new File([new Uint8Array([1])], 'a.png', { type: 'image/png' })] }); } catch {}
    const rows = [['Riconosciuto come', isMobile ? 'telefono / tablet' : 'computer'], ['Condivisione con foto', canShareFiles ? 'disponibile' : 'NON disponibile'],
      ['navigator.share', typeof navigator.share === 'function' ? 'sì' : 'no'], ['canShare(file)', probe ? 'sì' : 'no'], ['HTTPS', window.isSecureContext ? 'sì' : 'NO (la condivisione richiede HTTPS)'],
      ['platform', navigator.platform], ['touch', navigator.maxTouchPoints], ['userAgent', navigator.userAgent]];
    const el = document.createElement('div'); el.className = 'modal';
    el.innerHTML = `<div class="dialog"><h2>Diagnostica dispositivo</h2><pre class="diag">${rows.map(([k, v]) => `${k}: ${esc(v)}`).join('\n')}</pre><div class="row-end"><button class="primary" id="dclose">Chiudi</button></div></div>`;
    document.body.appendChild(el); el.querySelector('#dclose').onclick = () => el.remove(); el.onclick = (e) => { if (e.target === el) el.remove(); };
  };
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
const slug = (t) => (t || 'post').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'post';
// Nomi parlanti: ordinati alfabeticamente coincidono con l'ordine di pubblicazione
// es. lancio-collezione_foto-1-di-4_PRINCIPALE.jpg, lancio-collezione_foto-2-di-4.jpg
async function imageFiles(p) {
  const imgs = orderedImages(p);
  return Promise.all(imgs.map(async (im, i) => {
    const blob = await (await fetch(imgUrl(im.id))).blob();
    const ext = (im.original.match(/\.[a-z0-9]+$/i) || ['.jpg'])[0].toLowerCase();
    const n = String(i + 1).padStart(2, '0'), tot = String(imgs.length).padStart(2, '0');
    return new File([blob], `${slug(p.title)}_foto-${n}-di-${tot}${i === 0 ? '_PRINCIPALE' : ''}${ext}`, { type: blob.type });
  }));
}
async function copy(text) { // true se copiato (su http senza HTTPS gli appunti possono non essere disponibili)
  try { await navigator.clipboard.writeText(text); return true; } catch {}
  try {
    const t = document.createElement('textarea'); t.value = text; t.style.cssText = 'position:fixed;opacity:0';
    document.body.appendChild(t); t.select(); const ok = document.execCommand('copy'); t.remove(); return ok;
  } catch { return false; }
}
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
    case 'copy': return toast((await copy(text)) ? 'Testo copiato' : 'Copia non riuscita: seleziona il testo e copialo a mano');
    case 'download': { const f = await imageFiles(p), n = f.length; download(f); return toast(`${n} foto scaricate: caricale in ordine numerico (foto-01, 02…), la prima è la principale`); }
    // Nessun social accetta il testo insieme alle foto via link: copia + guida (telefono: menu di sistema, computer: download)
    case 'native': case 'instagram': case 'facebook': case 'linkedin': {
      const phone = canShareFiles;
      if (isMobile && !phone) { await copy(text); return toast('Testo copiato. Per inviare anche le foto apri l\'app con un indirizzo HTTPS (quello di Cloudflare): il menu di condivisione del telefono lo richiede'); }
      if (kind === 'native' && !phone) return toast('Apri questo post dal telefono per condividere con le altre app');
      const copied = await copy(text);
      const files = p.images.length ? await imageFiles(p) : [];
      if (!phone && files.length) download(files);
      return showGuide(kind, text, files, phone, copied);
    }
    case 'x': return open('https://twitter.com/intent/tweet?text=' + e);
    case 'whatsapp': return open('https://wa.me/?text=' + e);
    case 'telegram': return open('https://t.me/share/url?url=%20&text=' + e);
  }
}

boot();
