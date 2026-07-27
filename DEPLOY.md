# Deploy ke VPS

Panduan ini mengasumsikan VPS Linux yang sudah menjalankan proyek lain, dengan
Docker dan nginx terpasang. Semua nilai contoh (port, domain) boleh diganti.

## Kenapa VPS, bukan Vercel

Aplikasi ini menyimpan data di SQLite — sebuah file di disk. Platform serverless
seperti Vercel memberi filesystem yang hanya bisa dibaca dan hilang setiap
invocation, jadi setiap transaksi akan lenyap beberapa detik setelah tersimpan.
Server yang selalu hidup dengan volume persisten menyelesaikan itu, sekaligus
menyediakan alamat tetap untuk webhook pembayaran.

## 0. Pastikan RAM cukup untuk proses build

Aplikasi yang sudah jalan hanya memakai sekitar **90 MB**, jadi ringan. Yang berat
adalah proses **build**-nya: `next build` plus kompilasi `better-sqlite3` bisa
menyentuh 1 GB lebih. Di VPS 2 GB yang sudah menjalankan proyek lain, build bisa
mati terbunuh OOM di tengah jalan.

Periksa dulu sisa memori dan swap:

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

Swap hanya dipakai saat build; setelah container jalan, pemakaian kembali ringan.

Alternatif kalau tidak mau menambah swap: build image di komputer lokal, lalu
kirim ke VPS.

```bash
# di komputer lokal
docker build -t kasir-app .
docker save kasir-app | gzip | ssh user@43.157.203.219 'gunzip | docker load'
```

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

## 3. Arahkan subdomain

Tambahkan satu **A record** di pengelola DNS domain Anda:

| Jenis | Nama    | Konten            | TTL   |
|-------|---------|-------------------|-------|
| A     | `kasir` | IP publik VPS     | 14400 |

Kalau domainnya sudah punya A record lain yang menunjuk IP yang sama (misalnya
untuk proyek lain di VPS itu), cukup tambahkan satu baris baru — jangan diubah
yang lama. Pemisahan antar proyek terjadi di nginx lewat `server_name`, bukan di DNS.

Tunggu propagasi lalu pastikan sudah mengarah:

```bash
dig +short kasir.domain-anda.com
```

## 4. Reverse proxy nginx

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

## 5. Aktifkan pembayaran QRIS

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

Menguji tanpa uang asli: buat transaksi QRIS di layar kasir, buka panel
**"Mode sandbox — bayar lewat simulator"** di bawah QR, salin URL-nya, lalu
tempel ke kolom **QR Code Image Url** di
<https://simulator.sandbox.midtrans.com/qris/index>. Layar kasir berubah jadi
struk dalam beberapa detik.

> **Kalau simulator menjawab "Transaction is unsuccessful"** padahal tagihan
> berhasil dibuat dan QR tampil normal, kemungkinan besar akun sandbox Anda
> tidak diaktifkan untuk acquirer yang dipakai. Ganti `MIDTRANS_QRIS_ACQUIRER`
> ke `airpay shopee` (atau sebaliknya ke `gopay`) lalu jalankan ulang.
>
> Cara memastikannya tanpa melibatkan aplikasi: buat dua tagihan uji langsung
> ke `/v2/charge` dengan masing-masing acquirer, lalu coba bayar keduanya di
> simulator. Yang berhasil itulah yang didukung akun Anda.

Endpoint webhook sengaja terbuka tanpa sesi — pemanggilnya server Midtrans,
bukan browser. Keasliannya diperiksa lewat tanda tangan SHA-512, dan notifikasi
dengan nominal yang tidak cocok akan ditolak.

## 6. Perbarui versi

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
