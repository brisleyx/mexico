#!/bin/bash
# Run on the VPS as root. Clones brisleyx/mexico, writes .env (not in git),
# builds the Vite SPA, and points bonustok.site at /var/www/bonustok/dist.
# Does not change the lionshealthland.com nginx site.

set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/brisleyx/mexico.git}"
COMMIT="${COMMIT:-origin/main}"
APP_DIR="${APP_DIR:-/var/www/bonustok}"
SITE_URL="${VITE_SUPABASE_URL:-https://rlpvwxemtcdkyqhegxgn.supabase.co}"
MOCK="${VITE_PAGANOVO_MOCK:-false}"

if [ -z "${VITE_SUPABASE_ANON_KEY:-}" ]; then
  echo "Export VITE_SUPABASE_ANON_KEY before running (anon/publishable key, not the service role)."
  exit 1
fi

mkdir -p /var/www
if [ ! -d "${APP_DIR}/.git" ]; then
  git clone "${REPO_URL}" "${APP_DIR}"
fi

cd "${APP_DIR}"
git fetch origin
git checkout -B main origin/main
if [ "${COMMIT}" != "origin/main" ]; then
  git checkout "${COMMIT}"
fi

umask 077
cat > .env <<EOF
VITE_SUPABASE_URL=${SITE_URL}
VITE_SUPABASE_ANON_KEY=${VITE_SUPABASE_ANON_KEY}
VITE_PAGANOVO_MOCK=${MOCK}
EOF
chmod 600 .env

npm ci
npm run build
test -f dist/index.html

NGINX_SRC="${APP_DIR}/deploy/nginx-bonustok.conf"
if [ -f "${NGINX_SRC}" ]; then
  install -m 644 "${NGINX_SRC}" /etc/nginx/sites-available/bonustok
else
  cat > /etc/nginx/sites-available/bonustok <<'NGINX'
server {
    listen 80;
    listen [::]:80;
    server_name bonustok.site www.bonustok.site;

    root /var/www/bonustok/dist;
    index index.html;

    gzip on;
    gzip_vary on;
    gzip_types text/css application/javascript application/json image/svg+xml text/plain;

    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        try_files $uri =404;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
NGINX
fi

ln -sfn /etc/nginx/sites-available/bonustok /etc/nginx/sites-enabled/bonustok

nginx -t
systemctl reload nginx

if command -v certbot >/dev/null 2>&1; then
  certbot --nginx -d bonustok.site -d www.bonustok.site \
    --non-interactive --agree-tos --redirect \
    --register-unsafely-without-email || echo "WARN: certbot failed — HTTP is up, run certbot manually"
fi

echo "--- checks ---"
curl -sI -H "Host: bonustok.site" http://127.0.0.1/ | head -n 5
curl -sI -H "Host: lionshealthland.com" http://127.0.0.1/ | head -n 5
