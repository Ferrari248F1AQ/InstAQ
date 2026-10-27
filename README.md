# InstAQ — mini GitHub per post social

Scrivi il testo di un post, allega le foto (con ordine e foto principale), condividilo con il team e pubblica sui social con un tasto.

## Avvio
```
npm install
npm start          # http://localhost:3000
npm test
```
Il primo utente registrato è libero; i colleghi si registrano con il **codice team** mostrato nella barra laterale (o `TEAM_CODE=...` come variabile d'ambiente). Dati in `data/` (SQLite + foto); cambiabile con `DATA_DIR`. Richiede Node ≥ 22.13.

## Funzioni
- **Post**: titolo interno, testo, stato (Bozza / Da rivedere / Pronto / Pubblicato), contatori caratteri per X, LinkedIn, Instagram, Facebook.
- **Foto**: upload multiplo/drag&drop, riordino con drag&drop o frecce, ★ foto principale (esce per prima nella condivisione).
- **Team**: il proprietario sceglie chi vede e **modifica** il post; i collaboratori modificano testo, foto e stato.
- **Cronologia** (stile git): ogni modifica registra autore e riepilogo; si può ripristinare un testo precedente.
- **Condivisione**: Condividi nativo (testo + foto, su mobile apre Instagram/WhatsApp ecc.), X, WhatsApp, Telegram, LinkedIn, Facebook, Instagram, Copia testo, Scarica foto.

## Limiti noti delle piattaforme
X, WhatsApp, Telegram e LinkedIn accettano il testo via link; **nessun social accetta foto via link**. Per Instagram/Facebook/LinkedIn il tasto copia il testo, scarica le foto già in ordine e apre il sito. Su smartphone il tasto «Condividi» passa testo e foto direttamente all'app scelta. La pubblicazione automatica via API ufficiali (Meta, LinkedIn, X) richiede app e approvazioni dei singoli social: è un'estensione possibile.

## Deploy su Raspberry Pi + Cloudflare Tunnel
Porta di default **8472** (cambiabile con `PORT`), in ascolto su `0.0.0.0` (`HOST`). Nessuna porta standard (80/443/3000) è usata.

**Opzione A – systemd** (Node ≥ 22.13, Pi 5 a 64 bit):
```
git clone <repo> && cd InstAQ
sudo ./deploy/install.sh
sudo systemctl status instaq     # log: journalctl -u instaq -f
sudo cat /var/lib/instaq/team_code
```
Se 8472 è occupata: `sudo systemctl edit instaq` e imposta `Environment=PORT=xxxx`.

**Opzione B – Docker**: `docker compose up -d --build` (cambia la porta a sinistra in `docker-compose.yml`). Dati nel volume `instaq-data`.

**Cloudflare Tunnel**: aggiungi un *public hostname* (dashboard Zero Trust → Networks → Tunnels → Public hostname) con servizio `HTTP` → `localhost:8472` (o `IP-del-Pi:8472` se cloudflared gira altrove). L'app rileva `X-Forwarded-Proto: https` e imposta il cookie di sessione `Secure`. Opzionale: proteggi l'hostname con Cloudflare Access come secondo livello.

Note: `GET /healthz` per i controlli di stato; Cloudflare limita il body a 100 MB per richiesta (caricare le foto in più tornate se sono moltissime). Backup: copia `/var/lib/instaq` (database + foto).
