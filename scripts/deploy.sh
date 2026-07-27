#!/usr/bin/env bash
#
# Pembaruan versi di VPS. Jalankan dari mana saja:
#
#   /var/www/kasir/scripts/deploy.sh
#
# Aman diulang: kalau salah satu langkah gagal, skrip berhenti sebelum
# me-restart layanan, jadi versi lama tetap melayani.
set -euo pipefail

APP_DIR=/var/www/kasir
SERVICE=kasir
PORT=3021

cd "$APP_DIR"

echo "==> Menarik perubahan"
git pull --ff-only

echo "==> Memasang dependensi"
# Bukan --omit=dev: next build butuh typescript dan plugin tailwind.
npm ci --no-audit --no-fund

echo "==> Build"
npm run build

# Bundel standalone hanya berisi server.js dan node_modules seperlunya —
# aset statis dan berkas public harus disalin manual setiap build.
echo "==> Menyalin aset statis ke bundel standalone"
rm -rf .next/standalone/.next/static .next/standalone/public
cp -r .next/static .next/standalone/.next/static
[ -d public ] && cp -r public .next/standalone/public

echo "==> Restart layanan"
sudo systemctl restart "$SERVICE"

echo "==> Menunggu layanan siap"
for _ in $(seq 1 30); do
  if curl -sf -o /dev/null "http://127.0.0.1:$PORT/login"; then
    echo "Selesai. Versi terpasang: $(git log --oneline -1)"
    exit 0
  fi
  sleep 1
done

echo "GAGAL: layanan tidak merespons dalam 30 detik." >&2
journalctl -u "$SERVICE" -n 30 --no-pager >&2
exit 1
