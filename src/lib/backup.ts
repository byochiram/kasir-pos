import fs from 'fs';
import path from 'path';
import os from 'os';
import { randomUUID } from 'crypto';
import Database from 'better-sqlite3';
import { badRequest, conflict } from './http';
import { clearSettingsCache, getDb, getDbPath, runMigrations } from './db';

/** Tabel yang wajib ada agar sebuah file dianggap backup KasirApp yang sah. */
const REQUIRED_TABLES = [
  'users',
  'settings',
  'products',
  'customers',
  'suppliers',
  'transactions',
  'transaction_items',
  'stock_history',
  'expenses',
];

const SQLITE_MAGIC = Buffer.from('SQLite format 3\0', 'utf8');
const MAX_UPLOAD_BYTES = 200 * 1024 * 1024;

/**
 * Menghasilkan snapshot yang konsisten.
 *
 * Menyalin kasir.db mentah-mentah tidak aman: database berjalan dalam mode WAL,
 * sehingga transaksi terbaru masih berada di file -wal dan hasil salinan bisa
 * tertinggal atau rusak. VACUUM INTO menulis database utuh dalam satu operasi
 * atomik, sekaligus memadatkan halaman kosong.
 */
export function createBackup(): { buffer: Buffer; filename: string } {
  const tempPath = path.join(os.tmpdir(), `kasir-backup-${randomUUID()}.db`);
  try {
    getDb().prepare('VACUUM INTO ?').run(tempPath);
    const buffer = fs.readFileSync(tempPath);
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    return { buffer, filename: `kasir-backup-${stamp}.db` };
  } finally {
    fs.rmSync(tempPath, { force: true });
  }
}

export interface BackupInfo {
  products: number;
  customers: number;
  suppliers: number;
  transactions: number;
  expenses: number;
  users: number;
}

function countRows(db: Database.Database, table: string): number {
  return (db.prepare(`SELECT COUNT(*) as count FROM ${table}`).get() as { count: number }).count;
}

/** Memastikan file benar-benar database KasirApp sebelum dipakai menimpa data hidup. */
function validate(filePath: string): void {
  let probe: Database.Database;
  try {
    probe = new Database(filePath, { readonly: true, fileMustExist: true });
  } catch {
    throw badRequest('File tidak bisa dibaca sebagai database SQLite');
  }

  try {
    const tables = new Set(
      (probe.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as { name: string }[]).map(
        (row) => row.name,
      ),
    );
    const missing = REQUIRED_TABLES.filter((table) => !tables.has(table));
    if (missing.length > 0) {
      throw badRequest(`File ini bukan backup KasirApp — tabel berikut tidak ditemukan: ${missing.join(', ')}`);
    }

    // Memulihkan backup tanpa admin akan mengunci aplikasi selamanya.
    // Backup lama belum punya kolom is_active, jadi kolomnya dicek dulu.
    const userColumns = new Set(
      (probe.prepare('PRAGMA table_info(users)').all() as { name: string }[]).map((c) => c.name),
    );
    const activeClause = userColumns.has('is_active') ? 'AND is_active = 1' : '';
    const admins = (
      probe.prepare(`SELECT COUNT(*) as count FROM users WHERE role = 'ADMIN' ${activeClause}`).get() as {
        count: number;
      }
    ).count;
    if (admins === 0) {
      throw conflict('Backup ini tidak punya admin aktif, pemulihan dibatalkan agar aplikasi tidak terkunci');
    }
  } finally {
    probe.close();
  }
}

export interface RestoreResult {
  restored: BackupInfo;
  /** Nama file salinan data lama, untuk berjaga-jaga bila pemulihan ternyata keliru. */
  previousBackupFile: string;
}

/**
 * Mengganti seluruh isi database dengan data dari file backup.
 *
 * Datanya disalin lewat ATTACH + INSERT..SELECT di dalam satu transaksi, bukan
 * dengan menukar file. Menukar file tidak bisa diandalkan di Windows (file yang
 * masih terbuka tidak boleh dihapus atau diganti nama) dan berisiko meninggalkan
 * aplikasi tanpa database bila gagal di tengah jalan. Dengan cara ini koneksi
 * tetap hidup dan kegagalan apa pun otomatis di-rollback.
 */
export function restoreBackup(upload: Buffer): RestoreResult {
  if (upload.length === 0) throw badRequest('File backup kosong');
  if (upload.length > MAX_UPLOAD_BYTES) throw badRequest('Ukuran file melebihi 200 MB');
  if (!upload.subarray(0, SQLITE_MAGIC.length).equals(SQLITE_MAGIC)) {
    throw badRequest('File yang diunggah bukan database SQLite');
  }

  const stagingPath = path.join(os.tmpdir(), `kasir-restore-${randomUUID()}.db`);
  fs.writeFileSync(stagingPath, upload);

  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  const previousBackupFile = `kasir.db.before-restore-${stamp}`;
  const previousBackupPath = path.join(path.dirname(getDbPath()), previousBackupFile);

  try {
    validate(stagingPath);

    // Naikkan skema file backup ke versi terkini supaya susunan kolomnya sama
    // persis dengan database aktif dan `INSERT ... SELECT *` aman dipakai.
    const staging = new Database(stagingPath);
    let info: BackupInfo;
    try {
      staging.pragma('foreign_keys = OFF');
      runMigrations(staging);
      info = {
        products: countRows(staging, 'products'),
        customers: countRows(staging, 'customers'),
        suppliers: countRows(staging, 'suppliers'),
        transactions: countRows(staging, 'transactions'),
        expenses: countRows(staging, 'expenses'),
        users: countRows(staging, 'users'),
      };
      // Gabungkan WAL ke file utama; ATTACH membaca file, bukan WAL-nya.
      staging.pragma('wal_checkpoint(TRUNCATE)');
    } finally {
      staging.close();
    }

    // Jaring pengaman sebelum data lama dihapus.
    fs.writeFileSync(previousBackupPath, createBackup().buffer);

    const db = getDb();
    const tables = (
      db
        .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'")
        .all() as { name: string }[]
    ).map((row) => row.name);

    db.prepare('ATTACH DATABASE ? AS restore_src').run(stagingPath);
    // PRAGMA foreign_keys tidak berpengaruh di dalam transaksi, jadi harus
    // dimatikan lebih dulu. Tanpa ini, menghapus tabel induk akan ditolak —
    // dan ON DELETE CASCADE pada transaction_items ikut menghapus baris yang
    // baru saja disalin.
    db.pragma('foreign_keys = OFF');
    try {
      db.transaction(() => {
        // Kosongkan semua tabel dulu, baru isi semuanya. Kalau dihapus-isi per
        // tabel, cascade dari tabel yang dihapus belakangan akan membuang data
        // yang sudah masuk.
        for (const table of tables) db.prepare(`DELETE FROM main.${table}`).run();
        for (const table of tables) {
          db.prepare(`INSERT INTO main.${table} SELECT * FROM restore_src.${table}`).run();
        }

        // Pemeriksaan terakhir sebelum commit: kalau backup ternyata punya
        // referensi menggantung, lebih baik batal daripada menyimpan data rusak.
        const violations = db.pragma('foreign_key_check') as unknown[];
        if (violations.length > 0) {
          throw conflict(`Backup ditolak: ada ${violations.length} referensi data yang tidak valid`);
        }
      })();
    } finally {
      db.pragma('foreign_keys = ON');
      db.prepare('DETACH DATABASE restore_src').run();
    }

    clearSettingsCache();
    return { restored: info, previousBackupFile };
  } finally {
    fs.rmSync(stagingPath, { force: true });
  }
}
