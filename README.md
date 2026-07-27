# KasirApp — Aplikasi Point of Sale

Aplikasi kasir untuk toko/warung: transaksi, manajemen stok dengan jejak audit, pelanggan
berpoin, pengeluaran, dan laporan laba. Dibangun dengan Next.js 16 (App Router), React 19,
TypeScript, Tailwind CSS 4, dan SQLite lewat better-sqlite3.

## Menjalankan

```bash
npm install
cp .env.example .env     # lalu isi JWT_SECRET
npm run dev
```

Buka http://localhost:3000.

Database dibuat otomatis di `kasir.db` saat pertama kali dijalankan, lengkap dengan data
contoh (2 akun, 15 produk, 3 pelanggan, 2 supplier).

**Akun bawaan** — ganti passwordnya sebelum dipakai sungguhan (Pengaturan → Ganti Password):

| Role  | Email             | Password   |
|-------|-------------------|------------|
| ADMIN | admin@kasir.com   | `admin123` |
| KASIR | kasir@kasir.com   | `kasir123` |

### Perintah lain

| Perintah            | Kegunaan                                  |
|---------------------|-------------------------------------------|
| `npm run build`     | Build produksi                            |
| `npm start`         | Menjalankan hasil build                   |
| `npm run check`     | Typecheck + lint sekaligus                |

## Konfigurasi

Semua lewat `.env` (lihat `.env.example`):

| Variabel               | Wajib | Keterangan                                              |
|------------------------|-------|---------------------------------------------------------|
| `JWT_SECRET`           | ya    | Kunci tanda tangan sesi, **minimal 32 karakter**         |
| `DATABASE_PATH`        | tidak | Lokasi file SQLite (default `./kasir.db`)                |
| `SEED_ADMIN_PASSWORD`  | tidak | Password admin saat seeding pertama                      |
| `SEED_KASIR_PASSWORD`  | tidak | Password kasir saat seeding pertama                      |

Aplikasi menolak jalan bila `JWT_SECRET` kosong atau terlalu pendek. Buat yang acak:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

## Hak akses

Ada dua role. Pembatasannya dipaksakan di server pada setiap route API — menu yang
disembunyikan di sidebar hanya pelengkap, bukan pengaman.

| Kemampuan                                   | ADMIN | KASIR |
|---------------------------------------------|:-----:|:-----:|
| Transaksi kasir, cetak struk                 |  ✓    |  ✓    |
| Lihat & tambah pelanggan                     |  ✓    |  ✓    |
| Lihat transaksi                              | semua | miliknya sendiri |
| Dashboard                                    | seluruh toko | shift sendiri, tanpa angka laba |
| Kelola produk, harga, stok                   |  ✓    |  —    |
| Batalkan (void) transaksi                    |  ✓    |  —    |
| Supplier, pengeluaran, laporan               |  ✓    |  —    |
| Kelola user & pengaturan toko                |  ✓    |  —    |

Tidak ada pendaftaran mandiri: akun baru hanya bisa dibuat admin lewat halaman **Kelola User**.

## Cara kerja bagian penting

**Perhitungan transaksi.** Server adalah satu-satunya sumber kebenaran. Client mengirim
nilai diskon apa adanya beserta tipenya (`amount`/`percent`) — bukan nominal yang sudah
dihitung — dan tarif pajak **tidak pernah** diambil dari request, selalu dari pengaturan
toko. Urutannya: subtotal baris → diskon transaksi → pajak → total. Semua uang disimpan
sebagai bilangan bulat rupiah, dan pembulatan di client dibuat identik dengan server
(`src/lib/db.ts` dan `src/app/cashier/page.tsx`) supaya angka di layar sama persis dengan
yang tersimpan.

**Zona waktu.** Timestamp disimpan dalam UTC, tetapi batas "hari" untuk dashboard dan
laporan mengikuti zona waktu toko (`Pengaturan → Zona Waktu`, default WIB). Tanpa ini,
penjualan pukul 01:00 WIB akan masuk ke laporan hari sebelumnya.

**Stok.** Setiap perubahan stok tercatat di `stock_history` beserta stok sebelum/sesudah
dan siapa yang melakukannya — termasuk penjualan, pembatalan, stok masuk/keluar, dan stok
opname. Mengubah angka stok lewat form produk pun otomatis tercatat sebagai penyesuaian,
jadi tidak ada jalur mengubah stok tanpa jejak.

**Pembatalan transaksi.** Khusus admin dan wajib menyertakan alasan. Stok dikembalikan,
poin serta total belanja pelanggan ditarik kembali (tidak pernah sampai negatif), dan
transaksi ditandai `voided` — barisnya tidak pernah dihapus.

**Penghapusan data.** Produk, pelanggan, supplier, dan user memakai *soft delete*. Riwayat
transaksi yang menunjuk ke data tersebut tetap utuh dan laporan lama tidak berubah.

## Struktur

```
src/
├── app/
│   ├── api/           Route handler (auth, products, stock, transactions, dst.)
│   ├── cashier/       Layar kasir
│   ├── products/      Produk + stok masuk/keluar/opname + riwayat
│   ├── transactions/  Daftar transaksi, detail, void, cetak ulang struk
│   ├── customers/     Pelanggan, poin, riwayat belanja
│   ├── suppliers/     Supplier
│   ├── expenses/      Pengeluaran operasional
│   ├── reports/       Laporan penjualan & laba
│   ├── settings/      Pengaturan toko & ganti password
│   ├── users/         Kelola user
│   └── page.tsx       Dashboard
├── components/
│   ├── ui/            Toast, Modal, ConfirmDialog, Pagination, Field, Button, States
│   ├── charts/        Bar chart SVG tanpa dependensi eksternal
│   ├── AppProvider    Konteks sesi + pengaturan
│   ├── Sidebar        Navigasi, difilter per role
│   └── Receipt        Struk 80mm siap cetak
├── hooks/             useFetch, usePagedResource
├── lib/
│   ├── db.ts          Skema, migrasi, dan seluruh query
│   ├── validation.ts  Skema zod untuk semua input
│   ├── http.ts        Pembungkus route + pemetaan error ke status HTTP
│   ├── auth.ts        JWT, cookie sesi, rate limit login
│   ├── format.ts      Format rupiah & tanggal (sadar zona waktu)
│   └── csv.ts         Ekspor CSV
└── middleware.ts      Penjaga sesi & halaman khusus admin
```

## Database

SQLite dengan mode WAL dan foreign key aktif. Skema dikelola lewat migrasi bernomor di
`src/lib/db.ts` yang dijalankan otomatis saat koneksi pertama, memakai `PRAGMA user_version`
sebagai penanda versi. Database lama akan diperbarui di tempat tanpa kehilangan data.

Untuk membuat ulang dari nol: hentikan server, hapus `kasir.db*`, lalu jalankan lagi.

## Pintasan keyboard di layar kasir

| Tombol | Fungsi                                            |
|--------|---------------------------------------------------|
| `F2`   | Fokus ke kolom cari / scan barcode                |
| `F4`   | Bayar (atau lompat ke kolom uang diterima)        |
| `Enter`| Tambahkan hasil scan barcode ke keranjang         |

## Catatan penggunaan

- Aplikasi ini dirancang untuk **satu instance** (satu toko, satu proses). Rate limit login
  disimpan di memori proses, dan SQLite ditulis lewat satu koneksi.
- Backup cukup dengan menyalin `kasir.db` saat aplikasi berhenti.
- Struk dicetak lewat dialog print browser dengan ukuran kertas 80mm.
