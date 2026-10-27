# InstAQ — mini GitHub per post social

Scrivi il testo di un post, allega le foto (con ordine e foto principale), condividilo con il team e pubblica sui social con un tasto.

## Avvio
```
npm install
npm start          # http://localhost:3000
npm test
```
**Nessun login**: chi raggiunge l'app vede e modifica tutti i post (pensata per uso interno). Ogni post ha un link diretto (`…/#/p/ID`, tasto «🔗 Copia link») da girare ai colleghi. Il nome inserito nella barra laterale (facoltativo, salvato nel browser) compare solo nella cronologia. Dati in `data/` (SQLite + foto); cambiabile con `DATA_DIR`. Richiede Node ≥ 22.13.

## Funzioni
- **Post**: titolo interno, testo, stato (Bozza / Da rivedere / Pronto / Pubblicato), contatori caratteri per X, LinkedIn, Instagram, Facebook.
- **Foto**: upload multiplo/drag&drop, riordino con drag&drop o frecce, ★ foto principale (esce per prima nella condivisione).
- **Condivisione interna**: link diretto a ogni post, chiunque lo apra può modificarlo.
- **Cronologia** (stile git): ogni modifica registra autore e riepilogo; si può ripristinare un testo precedente.
- **Condivisione**: su telefono «Condividi con un'altra app» (testo + foto in ordine, nell'app scelta) è l'azione consigliata. Su computer un QR code porta il post sul telefono; in alternativa Instagram/Facebook/LinkedIn copiano il testo, scaricano le foto con nomi ordinati (`titolo_foto-01-di-03_PRINCIPALE.jpg`) e mostrano una guida passo-passo. X, WhatsApp, Telegram aprono con il testo già scritto.

Il QR usa l'indirizzo con cui apri l'app: per funzionare dal telefono apri l'app dall'hostname Cloudflare, non da `localhost`. Libreria QR inclusa in `public/vendor/qrcode.js` (qrcode-generator, MIT).

## Loghi
Intestazione con i loghi UnivAQ e DIIIE, estratti come SVG vettoriali dal Manuale di immagine coordinata UnivAQ (feb. 2025, pp. 65-68) in un **unico file** (`public/img/lockup.svg`, positivo; `lockup-neg.svg`, negativo bianco per il tema scuro). Vincoli del manuale rispettati:
- logo dipartimentale **affiancato** a quello istituzionale (prima UnivAQ, poi DIIIE), stessa altezza e spaziatura originale (pp. 47-48);
- stemma UnivAQ largo **4 cm** (~151 px, minimo del formato B, p. 17-18; su telefoni stretti scende a ~3,7 cm per non uscire dallo schermo);
- **area di rispetto** = 0,28 × altezza dello stemma su ogni lato (pp. 15-16), nessun elemento al suo interno;
- colori e proporzioni invariati; positivo su fondo chiaro, negativo su fondo scuro (p. 67).
`instaq.svg` è l'icona dell'app (anche favicon). Le richieste esterne di uso del logo vanno all'Ufficio Comunicazione (p. 3 del manuale).

## Limiti noti delle piattaforme
X, WhatsApp, Telegram e LinkedIn accettano il testo via link; **nessun social accetta foto via link**. Per Instagram/Facebook/LinkedIn il tasto copia il testo, scarica le foto già in ordine e apre il sito con una guida passo-passo. Su smartphone il tasto «Condividi» passa testo e foto direttamente all'app scelta. La pubblicazione automatica via API ufficiali (Meta, LinkedIn, X) richiede app e approvazioni dei singoli social: è un'estensione possibile.

## Deploy su Raspberry Pi + Cloudflare Tunnel
Porta di default **47213** (cambiabile con `PORT`), in ascolto su `0.0.0.0` (`HOST`). `deploy/install.sh` controlla le porte in ascolto e, se la 47213 è occupata, sceglie la prima libera successiva (oppure `sudo PORT=xxxx ./deploy/install.sh`; se la porta data è occupata si ferma). Negli aggiornamenti rieseguendo lo script si riusa la porta già configurata e il servizio viene riavviato.

**Installazione** (systemd, Node ≥ 22.13, Pi 5 a 64 bit):
```
git clone <repo> && cd InstAQ
sudo ./deploy/install.sh
sudo systemctl status instaq     # log: journalctl -u instaq -f
```

**Cloudflare Tunnel**: aggiungi un *public hostname* (dashboard Zero Trust → Networks → Tunnels → Public hostname) con servizio `HTTP` → `localhost:47213` (o `IP-del-Pi:47213` se cloudflared gira altrove). **Poiché l'app non ha login, l'unica protezione è l'accesso al tunnel**: se l'hostname è pubblico, chiunque conosca l'URL può leggere e modificare i post. Per limitarlo usa Cloudflare Access (policy sulle email aziendali) davanti all'hostname, oppure non pubblicarlo.

Note: `GET /healthz` per i controlli di stato; Cloudflare limita il body a 100 MB per richiesta (caricare le foto in più tornate se sono moltissime). Backup: copia `/var/lib/instaq` (database + foto).
