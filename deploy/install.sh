#!/usr/bin/env bash
# Installa InstAQ come servizio systemd su Raspberry Pi (Debian/Raspberry Pi OS 64 bit).
# Uso: sudo ./deploy/install.sh   (dalla cartella del repo)
set -euo pipefail
[ "$(id -u)" = 0 ] || { echo "Esegui con sudo"; exit 1; }

NODE_MAJOR=$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)
if [ "$NODE_MAJOR" -lt 22 ]; then
  echo "Serve Node >= 22.13. Installalo con:"
  echo "  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - && sudo apt-get install -y nodejs"
  exit 1
fi

# Una porta è libera se Node riesce a metterla in ascolto (test definitivo, nessuna dipendenza da ss/netstat)
in_use() { ! node -e 'const s=require("net").createServer();s.on("error",()=>process.exit(1));s.listen(+process.argv[1],"0.0.0.0",()=>s.close(()=>process.exit(0)))' "$1"; }
if [ -z "${PORT:-}" ]; then
  PORT=47213
  while in_use "$PORT"; do PORT=$((PORT + 1)); done
elif in_use "$PORT"; then
  echo "La porta $PORT è già in uso."; exit 1
fi
echo "Porta scelta: $PORT"

id instaq >/dev/null 2>&1 || useradd --system --home /var/lib/instaq --shell /usr/sbin/nologin instaq
mkdir -p /opt/instaq /var/lib/instaq
rsync -a --delete --exclude node_modules --exclude data --exclude .git ./ /opt/instaq/
(cd /opt/instaq && npm ci --omit=dev)
chown -R instaq: /var/lib/instaq
install -m 644 deploy/instaq.service /etc/systemd/system/instaq.service
sed -i "s/^Environment=PORT=.*/Environment=PORT=$PORT/" /etc/systemd/system/instaq.service
systemctl daemon-reload
systemctl enable --now instaq
sleep 1
echo "OK → http://$(hostname -I | awk '{print $1}'):$PORT  (in Cloudflare: servizio HTTP → localhost:$PORT)"
