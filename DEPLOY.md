# Deploy ke VPS

Panduan ini mengasumsikan VPS Linux yang sudah menjalankan proyek lain, dengan
Docker dan nginx terpasang. Semua nilai contoh (port, domain) boleh diganti.

## Kenapa VPS, bukan Vercel

Aplikasi ini menyimpan data di SQLite — sebuah file di disk. Platform serverless
seperti Vercel memberi filesystem yang hanya bisa dibaca dan hilang setiap
invocation, jadi setiap transaksi akan lenyap beberapa detik setelah tersimpan.
Server yang selalu hidup dengan volume persisten menyelesaikan itu, sekaligus
menyediakan alamat tetap untuk webhook pembayaran.

## 1. Siapkan berkas

```bash
git clone https://github.com/byochiram/kasir-pos.git
cd kasir-pos
cp .env.example .env.production
```

Isi `.env.production`:

```bash
JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))")
```

Ganti juga `SEED_ADMIN_PASSWORD` dan `SEED_KASIR_PASSWORD` sebelum menjalankan
pertama kali — keduanya hanya dipakai saat database masih kosong.

## 2. Jalankan

```bash
docker compose up -d --build
docker compose logs -f kasir-app
```

Container mengikat diri ke `127.0.0.1:3021`, **tidak** langsung ke internet.
Kalau port itu bentrok dengan proyek lain, ubah di `docker-compose.yml`.

Cek port yang sedang dipakai di VPS:

```bash
ss -tlnp | grep LISTEN
```

## 3. Reverse proxy nginx

Buat `/etc/nginx/sites-available/kasir`:

```nginx
server {
    listen 80;
    server_name kasir.domain-anda.com;

    location / {
        proxy_pass http://127.0.0.1:3021;
        proxy_http_version 1.1;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        # Dipakai aplikasi untuk rate limit login; tanpa ini semua request
        # terlihat berasal dari alamat yang sama.
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade           $http_upgrade;
        proxy_set_header Connection        'upgrade';
    }

    # Unggahan restore backup bisa besar; default nginx hanya 1 MB.
    client_max_body_size 210M;
}
```

Aktifkan dan pasang HTTPS:

```bash
sudo ln -s /etc/nginx/sites-available/kasir /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d kasir.domain-anda.com
```

Arahkan dulu A record subdomain ke IP VPS sebelum menjalankan certbot.

## 4. Aktifkan pembayaran QRIS

Sandbox Midtrans tidak memerlukan verifikasi badan usaha.

1. Daftar di <https://dashboard.sandbox.midtrans.com>
2. Pastikan pengalih **Environment** di sidebar dashboard menunjuk **Sandbox**,
   lalu **Settings → Access Keys** → salin *Server Key* ke `MIDTRANS_SERVER_KEY`
   di `.env.production`.

   Yang menentukan aplikasi menembak sandbox atau produksi adalah
   `MIDTRANS_IS_PRODUCTION`, bukan bentuk kuncinya — jadi pastikan keduanya
   cocok: kunci sandbox dengan `MIDTRANS_IS_PRODUCTION=false`.
3. **Settings → Configuration → Payment Notification URL**:
   `https://kasir.domain-anda.com/api/payments/midtrans/webhook`
4. Terapkan: `docker compose up -d`

Menguji tanpa uang asli: buat transaksi QRIS di layar kasir, lalu buka
**Simulator QRIS** Midtrans (<https://simulator.sandbox.midtrans.com/qris/index>),
tempel isi QR-nya, dan tekan bayar. Layar kasir akan berubah jadi struk dalam
beberapa detik.

Endpoint webhook sengaja terbuka tanpa sesi — pemanggilnya server Midtrans,
bukan browser. Keasliannya diperiksa lewat tanda tangan SHA-512, dan notifikasi
dengan nominal yang tidak cocok akan ditolak.

## 5. Perbarui versi

```bash
git pull
docker compose up -d --build
```

Migrasi database berjalan otomatis saat container pertama kali melayani request.
Data di volume tidak tersentuh oleh rebuild.

## Backup

Cara termudah lewat aplikasi: **Pengaturan → Backup & Pemulihan → Unduh**.

Untuk backup terjadwal dari sisi server:

```bash
# Salin file database keluar dari volume
docker compose cp kasir-app:/data/kasir.db ./backup-$(date +%F).db
```

Perlu diingat, menyalin file saat aplikasi sedang menulis bisa menghasilkan
salinan yang tertinggal — tombol Unduh di aplikasi memakai `VACUUM INTO`
sehingga hasilnya dijamin utuh. Untuk backup otomatis harian, jadwalkan
`docker compose exec` yang menjalankan perintah serupa saat toko tutup.

## Catatan operasional

- Aplikasi dirancang untuk **satu instance**. Jangan dijalankan dengan beberapa
  replika: SQLite menulis lewat satu koneksi, dan rate limit login disimpan di
  memori proses.
- Jaga sisa disk untuk file `kasir.db.before-restore-*` yang dibuat otomatis
  setiap kali memulihkan backup.
- Log dibatasi 3 berkas × 10 MB lewat konfigurasi di `docker-compose.yml`.
