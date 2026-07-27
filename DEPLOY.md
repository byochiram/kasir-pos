# Deploy ke VPS

Panduan ini menjalankan aplikasi sebagai **layanan systemd** di belakang nginx.
Itulah cara instance produksinya berjalan sekarang, di VPS 2 GB yang juga
menjalankan tiga proyek lain. Berkas contoh ada di `deploy/`.

Kalau Anda lebih suka Docker, `Dockerfile` dan `docker-compose.yml` juga
tersedia dan setara secara fungsi — lihat [Alternatif: Docker](#alternatif-docker)
di bagian bawah.

## Kenapa VPS, bukan Vercel

Aplikasi ini menyimpan data di SQLite — sebuah file di disk. Platform serverless
seperti Vercel memberi filesystem yang hanya bisa dibaca dan hilang setiap
invocation, jadi setiap transaksi akan lenyap beberapa detik setelah tersimpan.
Server yang selalu hidup dengan disk persisten menyelesaikan itu, sekaligus
menyediakan alamat tetap untuk webhook pembayaran.

## 0. Prasyarat

```bash
node --version   # butuh 20 atau lebih baru
nginx -v
certbot --version
```

Dua hal yang mudah terlewat:

**`better-sqlite3` dikompilasi dari sumber.** Tidak ada prebuild untuk setiap
kombinasi Node/OS, jadi siapkan toolchain-nya lebih dulu — tanpa ini `npm ci`
berhenti dengan `gyp ERR! not ok`:

```bash
sudo apt-get install -y build-essential
```

**Build jauh lebih berat daripada aplikasinya.** Proses yang sudah jalan hanya
memakai sekitar **100 MB**, tapi `next build` plus kompilasi native bisa
menyentuh 1 GB. Periksa dulu:

```bash
free -h
```

Kalau swap 0 dan sisa RAM di bawah ~1,5 GB, tambahkan swap 2 GB sekali saja:

```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

## 1. Ambil kode

```bash
sudo mkdir -p /var/www/kasir
sudo chown "$USER:$USER" /var/www/kasir
git clone --branch main https://github.com/byochiram/kasir-pos.git /var/www/kasir
cd /var/www/kasir
mkdir -p data
```

## 2. Konfigurasi

Buat `/var/www/kasir/.env` — mode 600, jangan pernah di-commit:

```bash
umask 077
cat > .env <<CFG
JWT_SECRET=$(openssl rand -hex 32)
NODE_ENV=production
PORT=3021
HOSTNAME=127.0.0.1
DATABASE_PATH=/var/www/kasir/data/kasir.db
SEED_ADMIN_PASSWORD=ganti-ini
SEED_KASIR_PASSWORD=ganti-ini-juga
MIDTRANS_SERVER_KEY=
MIDTRANS_IS_PRODUCTION=false
MIDTRANS_QRIS_ACQUIRER="airpay shopee"
CFG
```

Kedua `SEED_*` hanya dipakai saat database masih kosong.

> Nilai ber-spasi **harus diberi tanda kutip**. Berkas ini dibaca systemd lewat
> `EnvironmentFile`, dan systemd tidak memperlakukan spasi seperti shell.
> Baik systemd maupun dotenv sama-sama melepas tanda kutipnya.

`HOSTNAME=127.0.0.1` membuat aplikasi hanya bisa dihubungi dari mesin itu
sendiri; internet masuk lewat nginx, bukan langsung.

## 3. Build

```bash
npm ci                       # bukan --omit=dev: build butuh typescript & tailwind
npm run build
```

`next.config.ts` memakai `output: 'standalone'`, jadi hasilnya bundel mandiri di
`.next/standalone`. Bundel itu **tidak** menyertakan aset statis, jadi salin
sendiri setiap habis build:

```bash
cp -r .next/static  .next/standalone/.next/static
cp -r public        .next/standalone/public   # kalau ada
```

## 4. Layanan systemd

```bash
sudo cp deploy/kasir.service /etc/systemd/system/kasir.service
sudo systemctl daemon-reload
sudo systemctl enable --now kasir
```

Periksa:

```bash
systemctl status kasir
curl -i http://127.0.0.1:3021/login          # 200
curl -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3021/api/products   # 401
journalctl -u kasir -f
```

Unit-nya berjalan sebagai user biasa dengan `ProtectSystem=strict`; satu-satunya
direktori yang boleh ditulis adalah `data/`. Kalau Anda memindahkan
`DATABASE_PATH`, ubah juga `ReadWritePaths` — kalau tidak, aplikasi gagal start
dengan *read-only file system*.

## 5. Subdomain dan nginx

Tambahkan satu **A record** di pengelola DNS:

| Jenis | Nama    | Konten        | TTL   |
|-------|---------|---------------|-------|
| A     | `kasir` | IP publik VPS | 14400 |

Kalau domainnya sudah punya A record lain ke IP yang sama, cukup tambah satu
baris — jangan ubah yang lama. Pemisahan antar proyek terjadi di nginx lewat
`server_name`, bukan di DNS. Pastikan sudah menyebar sebelum lanjut:

```bash
dig +short kasir.domain-anda.com
```

Lalu pasang reverse proxy:

```bash
sudo cp deploy/nginx.conf /etc/nginx/sites-available/kasir
sudo sed -i 's/kasir.domain-anda.com/kasir.domain-anda-sungguhan.com/' /etc/nginx/sites-available/kasir
sudo ln -sfn /etc/nginx/sites-available/kasir /etc/nginx/sites-enabled/kasir
sudo nginx -t && sudo systemctl reload nginx
```

## 6. HTTPS

```bash
sudo certbot --nginx -d kasir.domain-anda.com --redirect
```

Certbot menyisipkan blok `listen 443 ssl` dan pengalihan dari port 80 ke berkas
tadi, lalu memasang timer pembaruan otomatis. HTTPS bukan opsional di sini:
cookie sesi memakai atribut `Secure` saat `NODE_ENV=production`, jadi lewat HTTP
biasa browser tidak akan menyimpannya dan login selalu gagal.

Verifikasi:

```bash
curl -sI https://kasir.domain-anda.com/login | head -1
```

> Kalau tepat setelah `reload` Anda dapat 404 dari vhost lain, ulangi sebentar
> lagi — worker lama masih melayani beberapa saat sesudah reload.

## 7. Aktifkan pembayaran QRIS

Sandbox Midtrans tidak memerlukan verifikasi badan usaha.

1. Daftar di <https://dashboard.sandbox.midtrans.com>
2. Pastikan pengalih **Environment** di sidebar menunjuk **Sandbox**, lalu
   **Settings → Access Keys** → salin *Server Key* ke `MIDTRANS_SERVER_KEY`.

   Yang menentukan aplikasi menembak sandbox atau produksi adalah
   `MIDTRANS_IS_PRODUCTION`, bukan bentuk kuncinya — jadi pastikan keduanya
   cocok: kunci sandbox dengan `MIDTRANS_IS_PRODUCTION=false`.
3. **Settings → Configuration → Payment Notification URL**:
   `https://kasir.domain-anda.com/api/payments/midtrans/webhook`
4. `sudo systemctl restart kasir`

Menguji tanpa uang asli: buat transaksi QRIS di layar kasir, buka panel
**"Mode sandbox — bayar lewat simulator"** di bawah QR, salin URL-nya, lalu
tempel ke kolom **QR Code Image Url** di
<https://simulator.sandbox.midtrans.com/qris/index>. Layar kasir berubah jadi
struk dalam beberapa detik.

> **Kalau simulator menjawab "Transaction is unsuccessful"** padahal tagihan
> berhasil dibuat dan QR tampil normal, kemungkinan besar akun sandbox Anda
> tidak diaktifkan untuk acquirer yang dipakai. Ganti `MIDTRANS_QRIS_ACQUIRER`
> ke `airpay shopee` (atau sebaliknya ke `gopay`) lalu restart.
>
> Cara memastikannya tanpa melibatkan aplikasi: buat dua tagihan uji langsung
> ke `/v2/charge` dengan masing-masing acquirer, lalu coba bayar keduanya di
> simulator. Yang berhasil itulah yang didukung akun Anda.

Endpoint webhook sengaja terbuka tanpa sesi — pemanggilnya server Midtrans,
bukan browser. Keasliannya diperiksa lewat tanda tangan SHA-512, dan notifikasi
dengan nominal yang tidak cocok akan ditolak. Notifikasi palsu tetap dijawab
`200` supaya Midtrans tidak mengulanginya; badan responsnya menyebut alasan
penolakan.

## 8. Perbarui versi

```bash
/var/www/kasir/scripts/deploy.sh
```

Skrip itu menarik perubahan, build, menyalin ulang aset standalone, restart, dan
menunggu sampai layanan merespons. Kalau ada langkah yang gagal ia berhenti
sebelum restart, jadi versi lama tetap melayani. Migrasi database berjalan
otomatis saat request pertama; isi `data/` tidak tersentuh oleh rebuild.

## Backup

Cara termudah lewat aplikasi: **Pengaturan → Backup & Pemulihan → Unduh**.
Tombol itu memakai `VACUUM INTO` sehingga hasilnya dijamin utuh.

Untuk backup terjadwal dari sisi server, jangan sekadar `cp` — menyalin file
saat aplikasi sedang menulis bisa menghasilkan salinan yang tertinggal WAL-nya.
Pakai perintah SQLite yang aman:

```bash
sqlite3 /var/www/kasir/data/kasir.db \
  ".backup '/var/backups/kasir-$(date +%F).db'"
```

Jadwalkan lewat cron saat toko tutup.

## Catatan operasional

- Aplikasi dirancang untuk **satu instance**. Jangan dijalankan dengan beberapa
  replika: SQLite menulis lewat satu koneksi, dan rate limit login disimpan di
  memori proses.
- Jaga sisa disk untuk file `kasir.db.before-restore-*` yang dibuat otomatis
  setiap kali memulihkan backup.
- Log masuk ke journald: `journalctl -u kasir`. Batasi ukurannya lewat
  `/etc/systemd/journald.conf` kalau perlu.

## Alternatif: Docker

`Dockerfile` dan `docker-compose.yml` menghasilkan susunan yang setara.
Bedanya hanya langkah 3–4 di atas:

```bash
cp .env .env.production
docker compose up -d --build
docker compose logs -f kasir-app
```

Container mengikat diri ke `127.0.0.1:3021`, jadi konfigurasi nginx di langkah 5
berlaku apa adanya. Pembaruan: `git pull && docker compose up -d --build`.

Di VPS kecil yang sudah menjalankan proyek lain, jalur systemd lebih hemat —
tidak ada daemon tambahan, dan `next build` di host bisa memanfaatkan swap yang
sudah ada.
