import Database from 'better-sqlite3';
import path from 'path';
import { randomUUID } from 'crypto';
import bcrypt from 'bcryptjs';
import { badRequest, conflict, notFound } from './http';
import type {
  CategorySales,
  Customer,
  DailySales,
  DashboardStats,
  Expense,
  ExpenseWithRelations,
  Paginated,
  PaymentBreakdown,
  Product,
  PublicUser,
  PurchaseOrderItem,
  PurchaseOrderStatus,
  PurchaseOrderWithRelations,
  Role,
  SalesReport,
  Settings,
  StockHistoryWithRelations,
  StockMovementType,
  Supplier,
  TopProduct,
  Transaction,
  TransactionItem,
  TransactionWithRelations,
  UserRow,
} from './types';
import { GATEWAY_METHODS, PO_STATUS_LABELS } from './types';

const DB_PATH = process.env.DATABASE_PATH ?? path.join(process.cwd(), 'kasir.db');
const BCRYPT_ROUNDS = 10;

// Next.js dev me-reload modul saat hot reload; simpan koneksi di globalThis supaya
// tidak membuka handle SQLite baru setiap perubahan file.
const globalForDb = globalThis as unknown as { __kasirDb?: Database.Database };

export function getDb(): Database.Database {
  if (!globalForDb.__kasirDb) {
    const db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    db.pragma('busy_timeout = 5000');
    migrate(db);
    globalForDb.__kasirDb = db;
  }
  return globalForDb.__kasirDb;
}

export function getDbPath(): string {
  return DB_PATH;
}

/** Dipanggil setelah pemulihan backup agar pengaturan tidak terbaca dari cache lama. */
export function clearSettingsCache(): void {
  settingsCache = null;
}

// ============================================================================
// MIGRASI
// ============================================================================

function hasColumn(db: Database.Database, table: string, column: string): boolean {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  return cols.some((c) => c.name === column);
}

function addColumn(db: Database.Database, table: string, column: string, definition: string): void {
  if (!hasColumn(db, table, column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

const migrations: { version: number; up: (db: Database.Database) => void }[] = [
  {
    // Skema dasar. IF NOT EXISTS supaya database lama (yang dibuat sebelum ada
    // sistem migrasi ini) lolos tanpa perubahan lalu diperbarui oleh v2.
    version: 1,
    up: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          email TEXT NOT NULL UNIQUE,
          password TEXT NOT NULL,
          role TEXT NOT NULL DEFAULT 'KASIR',
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS settings (
          id TEXT PRIMARY KEY DEFAULT 'default',
          store_name TEXT NOT NULL DEFAULT 'KasirApp Store',
          store_address TEXT DEFAULT '',
          store_phone TEXT DEFAULT '',
          store_logo TEXT DEFAULT '',
          tax_rate REAL NOT NULL DEFAULT 11,
          receipt_footer TEXT DEFAULT 'Terima kasih atas kunjungan Anda!',
          low_stock_threshold INTEGER NOT NULL DEFAULT 5
        );

        CREATE TABLE IF NOT EXISTS products (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          price INTEGER NOT NULL DEFAULT 0,
          cost_price INTEGER NOT NULL DEFAULT 0,
          stock INTEGER NOT NULL DEFAULT 0,
          min_stock INTEGER NOT NULL DEFAULT 5,
          category TEXT NOT NULL DEFAULT 'Umum',
          barcode TEXT DEFAULT '',
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS customers (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          phone TEXT DEFAULT '',
          email TEXT DEFAULT '',
          address TEXT DEFAULT '',
          points INTEGER NOT NULL DEFAULT 0,
          total_spent INTEGER NOT NULL DEFAULT 0,
          visit_count INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS suppliers (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          phone TEXT DEFAULT '',
          email TEXT DEFAULT '',
          address TEXT DEFAULT '',
          contact_person TEXT DEFAULT '',
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS transactions (
          id TEXT PRIMARY KEY,
          customer_id TEXT,
          user_id TEXT NOT NULL,
          subtotal INTEGER NOT NULL DEFAULT 0,
          discount INTEGER NOT NULL DEFAULT 0,
          discount_type TEXT NOT NULL DEFAULT 'amount',
          tax_rate REAL NOT NULL DEFAULT 0,
          tax_amount INTEGER NOT NULL DEFAULT 0,
          total INTEGER NOT NULL DEFAULT 0,
          payment_method TEXT NOT NULL DEFAULT 'cash',
          amount_paid INTEGER NOT NULL DEFAULT 0,
          change INTEGER NOT NULL DEFAULT 0,
          notes TEXT DEFAULT '',
          status TEXT NOT NULL DEFAULT 'completed',
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          FOREIGN KEY (customer_id) REFERENCES customers(id),
          FOREIGN KEY (user_id) REFERENCES users(id)
        );

        CREATE TABLE IF NOT EXISTS transaction_items (
          id TEXT PRIMARY KEY,
          transaction_id TEXT NOT NULL,
          product_id TEXT NOT NULL,
          product_name TEXT NOT NULL,
          price INTEGER NOT NULL,
          cost_price INTEGER NOT NULL DEFAULT 0,
          quantity INTEGER NOT NULL,
          discount INTEGER NOT NULL DEFAULT 0,
          discount_type TEXT NOT NULL DEFAULT 'amount',
          subtotal INTEGER NOT NULL,
          FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS stock_history (
          id TEXT PRIMARY KEY,
          product_id TEXT NOT NULL,
          type TEXT NOT NULL,
          quantity INTEGER NOT NULL,
          notes TEXT DEFAULT '',
          created_by TEXT NOT NULL,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          FOREIGN KEY (product_id) REFERENCES products(id),
          FOREIGN KEY (created_by) REFERENCES users(id)
        );

        CREATE TABLE IF NOT EXISTS expenses (
          id TEXT PRIMARY KEY,
          description TEXT NOT NULL,
          amount INTEGER NOT NULL,
          category TEXT NOT NULL DEFAULT 'Lainnya',
          date TEXT NOT NULL,
          notes TEXT DEFAULT '',
          created_by TEXT NOT NULL,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          FOREIGN KEY (created_by) REFERENCES users(id)
        );
      `);
    },
  },
  {
    // Kolom-kolom yang dibutuhkan versi aplikasi ini: soft delete, jejak audit
    // void, nomor invoice, dan snapshot stok pada setiap pergerakan.
    version: 2,
    up: (db) => {
      addColumn(db, 'users', 'is_active', 'INTEGER NOT NULL DEFAULT 1');
      addColumn(db, 'users', 'updated_at', "TEXT NOT NULL DEFAULT ''");
      addColumn(db, 'users', 'deleted_at', 'TEXT');
      db.exec("UPDATE users SET updated_at = created_at WHERE updated_at = ''");

      addColumn(db, 'products', 'unit', "TEXT NOT NULL DEFAULT 'pcs'");
      addColumn(db, 'products', 'is_active', 'INTEGER NOT NULL DEFAULT 1');
      addColumn(db, 'products', 'deleted_at', 'TEXT');

      addColumn(db, 'customers', 'updated_at', "TEXT NOT NULL DEFAULT ''");
      addColumn(db, 'customers', 'deleted_at', 'TEXT');
      db.exec("UPDATE customers SET updated_at = created_at WHERE updated_at = ''");

      addColumn(db, 'suppliers', 'updated_at', "TEXT NOT NULL DEFAULT ''");
      addColumn(db, 'suppliers', 'deleted_at', 'TEXT');
      db.exec("UPDATE suppliers SET updated_at = created_at WHERE updated_at = ''");

      addColumn(db, 'transactions', 'invoice_no', 'TEXT');
      addColumn(db, 'transactions', 'discount_amount', 'INTEGER NOT NULL DEFAULT 0');
      addColumn(db, 'transactions', 'total_cost', 'INTEGER NOT NULL DEFAULT 0');
      addColumn(db, 'transactions', 'voided_at', 'TEXT');
      addColumn(db, 'transactions', 'voided_by', 'TEXT');
      addColumn(db, 'transactions', 'void_reason', 'TEXT');

      addColumn(db, 'stock_history', 'supplier_id', 'TEXT');
      addColumn(db, 'stock_history', 'stock_before', 'INTEGER NOT NULL DEFAULT 0');
      addColumn(db, 'stock_history', 'stock_after', 'INTEGER NOT NULL DEFAULT 0');

      addColumn(db, 'expenses', 'updated_at', "TEXT NOT NULL DEFAULT ''");
      db.exec("UPDATE expenses SET updated_at = created_at WHERE updated_at = ''");

      addColumn(db, 'settings', 'points_per_amount', 'INTEGER NOT NULL DEFAULT 10000');
      addColumn(db, 'settings', 'tz_offset_minutes', 'INTEGER NOT NULL DEFAULT 420');
      addColumn(db, 'settings', 'currency', "TEXT NOT NULL DEFAULT 'IDR'");

      // Isi nilai turunan untuk data yang sudah ada sebelum migrasi ini.
      db.exec(`
        UPDATE transactions SET total_cost = COALESCE(
          (SELECT SUM(ti.cost_price * ti.quantity) FROM transaction_items ti WHERE ti.transaction_id = transactions.id), 0
        ) WHERE total_cost = 0;

        UPDATE transactions SET discount_amount = CASE
          WHEN discount_type = 'percent' THEN CAST(ROUND(subtotal * discount / 100.0) AS INTEGER)
          ELSE discount
        END WHERE discount_amount = 0;
      `);

      // Nomor invoice untuk transaksi lama, urut berdasarkan waktu dibuat.
      const legacy = db
        .prepare('SELECT id, created_at FROM transactions WHERE invoice_no IS NULL ORDER BY created_at ASC')
        .all() as { id: string; created_at: string }[];
      const setInvoice = db.prepare('UPDATE transactions SET invoice_no = ? WHERE id = ?');
      const perDay = new Map<string, number>();
      for (const tx of legacy) {
        const day = (tx.created_at ?? '').slice(0, 10).replace(/-/g, '') || '00000000';
        const next = (perDay.get(day) ?? 0) + 1;
        perDay.set(day, next);
        setInvoice.run(`INV-${day}-${String(next).padStart(4, '0')}`, tx.id);
      }

      db.exec(`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_invoice ON transactions(invoice_no);
        CREATE UNIQUE INDEX IF NOT EXISTS idx_products_barcode
          ON products(barcode) WHERE barcode <> '' AND deleted_at IS NULL;
        CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);
        CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
        CREATE INDEX IF NOT EXISTS idx_products_deleted ON products(deleted_at);
        CREATE INDEX IF NOT EXISTS idx_transactions_created ON transactions(created_at);
        CREATE INDEX IF NOT EXISTS idx_transactions_customer ON transactions(customer_id);
        CREATE INDEX IF NOT EXISTS idx_transactions_user ON transactions(user_id);
        CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
        CREATE INDEX IF NOT EXISTS idx_transaction_items_tid ON transaction_items(transaction_id);
        CREATE INDEX IF NOT EXISTS idx_transaction_items_pid ON transaction_items(product_id);
        CREATE INDEX IF NOT EXISTS idx_stock_history_pid ON stock_history(product_id);
        CREATE INDEX IF NOT EXISTS idx_stock_history_created ON stock_history(created_at);
        CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date);
        CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
        CREATE INDEX IF NOT EXISTS idx_customers_deleted ON customers(deleted_at);
      `);
    },
  },
  {
    // Purchase order: menghubungkan supplier ke stok masuk, yang sebelumnya
    // terputus — tabel suppliers hanya berfungsi sebagai buku alamat.
    version: 3,
    up: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS purchase_orders (
          id TEXT PRIMARY KEY,
          po_no TEXT NOT NULL UNIQUE,
          supplier_id TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'draft',
          order_date TEXT NOT NULL,
          expected_date TEXT,
          received_at TEXT,
          received_by TEXT,
          total INTEGER NOT NULL DEFAULT 0,
          notes TEXT NOT NULL DEFAULT '',
          created_by TEXT NOT NULL,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now')),
          FOREIGN KEY (supplier_id) REFERENCES suppliers(id),
          FOREIGN KEY (created_by) REFERENCES users(id),
          FOREIGN KEY (received_by) REFERENCES users(id)
        );

        CREATE TABLE IF NOT EXISTS purchase_order_items (
          id TEXT PRIMARY KEY,
          po_id TEXT NOT NULL,
          product_id TEXT NOT NULL,
          product_name TEXT NOT NULL,
          quantity INTEGER NOT NULL,
          cost_price INTEGER NOT NULL,
          subtotal INTEGER NOT NULL,
          FOREIGN KEY (po_id) REFERENCES purchase_orders(id) ON DELETE CASCADE,
          FOREIGN KEY (product_id) REFERENCES products(id)
        );

        CREATE INDEX IF NOT EXISTS idx_po_supplier ON purchase_orders(supplier_id);
        CREATE INDEX IF NOT EXISTS idx_po_status ON purchase_orders(status);
        CREATE INDEX IF NOT EXISTS idx_po_date ON purchase_orders(order_date);
        CREATE INDEX IF NOT EXISTS idx_po_items_po ON purchase_order_items(po_id);
      `);

      // Menautkan stok masuk ke PO asalnya, untuk penelusuran.
      addColumn(db, 'stock_history', 'po_id', 'TEXT');
    },
  },
  {
    // Pembayaran lewat gateway: transaksi tidak lagi selalu langsung lunas.
    version: 4,
    up: (db) => {
      addColumn(db, 'transactions', 'payment_status', "TEXT NOT NULL DEFAULT 'paid'");
      addColumn(db, 'transactions', 'payment_ref', 'TEXT');
      addColumn(db, 'transactions', 'payment_qr_url', 'TEXT');
      addColumn(db, 'transactions', 'payment_expires_at', 'TEXT');
      addColumn(db, 'transactions', 'paid_at', 'TEXT');

      // Transaksi lama semuanya tunai/manual dan sudah dianggap lunas.
      db.exec("UPDATE transactions SET paid_at = created_at WHERE paid_at IS NULL AND status = 'completed'");

      db.exec(`
        CREATE TABLE IF NOT EXISTS payments (
          id TEXT PRIMARY KEY,
          transaction_id TEXT NOT NULL,
          provider TEXT NOT NULL,
          /* order_id yang dipakai di sisi gateway */
          order_id TEXT NOT NULL,
          /* id transaksi milik gateway, baru ada setelah ada respons */
          provider_ref TEXT,
          status TEXT NOT NULL,
          amount INTEGER NOT NULL,
          /* Payload mentah disimpan apa adanya: kalau ada sengketa, inilah buktinya. */
          raw TEXT NOT NULL DEFAULT '',
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_payments_tx ON payments(transaction_id);
        CREATE INDEX IF NOT EXISTS idx_payments_order ON payments(order_id);
        CREATE INDEX IF NOT EXISTS idx_transactions_payment_ref ON transactions(payment_ref);
      `);
    },
  },
];

/**
 * Menerapkan migrasi yang belum dijalankan. Diekspor supaya file backup lama
 * bisa dinaikkan ke skema terkini sebelum datanya disalin masuk.
 */
export function runMigrations(db: Database.Database): void {
  const current = (db.pragma('user_version', { simple: true }) as number) ?? 0;
  for (const migration of migrations) {
    if (migration.version <= current) continue;
    db.transaction(() => {
      migration.up(db);
      db.pragma(`user_version = ${migration.version}`);
    })();
  }
}

function migrate(db: Database.Database): void {
  runMigrations(db);
  seedIfEmpty(db);
}

function seedIfEmpty(db: Database.Database): void {
  const { count } = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
  if (count > 0) return;

  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? 'admin123';
  const cashierPassword = process.env.SEED_KASIR_PASSWORD ?? 'kasir123';

  db.transaction(() => {
    const insertUser = db.prepare(
      "INSERT INTO users (id, name, email, password, role, updated_at) VALUES (?, ?, ?, ?, ?, datetime('now'))",
    );
    insertUser.run(randomUUID(), 'Admin', 'admin@kasir.com', bcrypt.hashSync(adminPassword, BCRYPT_ROUNDS), 'ADMIN');
    insertUser.run(randomUUID(), 'Kasir 1', 'kasir@kasir.com', bcrypt.hashSync(cashierPassword, BCRYPT_ROUNDS), 'KASIR');

    db.prepare('INSERT OR IGNORE INTO settings (id) VALUES (?)').run('default');

    const products: [string, number, number, number, string][] = [
      ['Nasi Goreng Spesial', 18000, 10000, 50, 'Makanan'],
      ['Mie Ayam Bakso', 15000, 8000, 40, 'Makanan'],
      ['Ayam Geprek', 20000, 12000, 30, 'Makanan'],
      ['Soto Ayam', 14000, 7000, 35, 'Makanan'],
      ['Nasi Uduk', 12000, 6000, 45, 'Makanan'],
      ['Es Teh Manis', 5000, 1500, 100, 'Minuman'],
      ['Es Jeruk', 7000, 3000, 80, 'Minuman'],
      ['Kopi Hitam', 8000, 3000, 60, 'Minuman'],
      ['Kopi Susu', 12000, 5000, 50, 'Minuman'],
      ['Air Mineral', 3000, 1500, 200, 'Minuman'],
      ['Kerupuk', 2000, 800, 150, 'Snack'],
      ['Risoles', 5000, 2500, 45, 'Snack'],
      ['Martabak Mini', 8000, 4000, 25, 'Snack'],
      ['Roti Bakar', 10000, 5000, 30, 'Snack'],
      ['Pisang Goreng', 3000, 1000, 3, 'Snack'],
    ];
    const insertProduct = db.prepare(
      'INSERT INTO products (id, name, price, cost_price, stock, category) VALUES (?, ?, ?, ?, ?, ?)',
    );
    for (const [name, price, cost, stock, category] of products) {
      insertProduct.run(randomUUID(), name, price, cost, stock, category);
    }

    const insertCustomer = db.prepare(
      "INSERT INTO customers (id, name, phone, email, updated_at) VALUES (?, ?, ?, ?, datetime('now'))",
    );
    insertCustomer.run(randomUUID(), 'Budi Santoso', '081234567890', 'budi@mail.com');
    insertCustomer.run(randomUUID(), 'Siti Rahayu', '085678901234', 'siti@mail.com');
    insertCustomer.run(randomUUID(), 'Ahmad Hidayat', '087890123456', '');

    const insertSupplier = db.prepare(
      "INSERT INTO suppliers (id, name, phone, contact_person, updated_at) VALUES (?, ?, ?, ?, datetime('now'))",
    );
    insertSupplier.run(randomUUID(), 'PT Sumber Rejeki', '021-1234567', 'Pak Joko');
    insertSupplier.run(randomUUID(), 'CV Maju Bersama', '021-7654321', 'Bu Ani');
  })();
}

// ============================================================================
// UTILITAS
// ============================================================================

/** `%` dan `_` bermakna khusus di LIKE; escape supaya pencarian literal. */
function escapeLike(input: string): string {
  return input.replace(/[\\%_]/g, (c) => `\\${c}`);
}

function likeParam(search: string): string {
  return `%${escapeLike(search.trim())}%`;
}

let settingsCache: Settings | null = null;

export function getSettings(): Settings {
  if (settingsCache) return settingsCache;
  const db = getDb();
  let row = db.prepare('SELECT * FROM settings WHERE id = ?').get('default') as Settings | undefined;
  if (!row) {
    db.prepare('INSERT INTO settings (id) VALUES (?)').run('default');
    row = db.prepare('SELECT * FROM settings WHERE id = ?').get('default') as Settings;
  }
  settingsCache = row;
  return row;
}

/**
 * Timestamp disimpan dalam UTC (`datetime('now')`), tapi "hari ini" bagi toko
 * mengikuti waktu lokal. Semua pengelompokan tanggal digeser sebesar offset ini,
 * jadi penjualan jam 01:00 WIB masuk ke hari yang benar.
 */
function tzModifier(): string {
  const raw = getSettings().tz_offset_minutes;
  const minutes = Number.isInteger(raw) ? raw : 420;
  return `${minutes >= 0 ? '+' : ''}${minutes} minutes`;
}

/** Ekspresi SQL untuk mengambil tanggal lokal dari kolom timestamp UTC. */
function localDate(column: string): string {
  return `date(${column}, '${tzModifier()}')`;
}

/** Tanggal hari ini (YYYY-MM-DD) menurut zona waktu toko. */
export function todayLocal(): string {
  const offset = getSettings().tz_offset_minutes;
  return new Date(Date.now() + offset * 60_000).toISOString().slice(0, 10);
}

// ============================================================================
// SETTINGS
// ============================================================================

export interface SettingsInput {
  store_name: string;
  store_address: string;
  store_phone: string;
  store_logo: string;
  tax_rate: number;
  receipt_footer: string;
  low_stock_threshold: number;
  points_per_amount: number;
  tz_offset_minutes: number;
}

export function updateSettings(data: SettingsInput): Settings {
  getDb()
    .prepare(
      `UPDATE settings SET store_name=?, store_address=?, store_phone=?, store_logo=?,
       tax_rate=?, receipt_footer=?, low_stock_threshold=?, points_per_amount=?, tz_offset_minutes=?
       WHERE id='default'`,
    )
    .run(
      data.store_name,
      data.store_address,
      data.store_phone,
      data.store_logo,
      data.tax_rate,
      data.receipt_footer,
      data.low_stock_threshold,
      data.points_per_amount,
      data.tz_offset_minutes,
    );
  settingsCache = null;
  return getSettings();
}

// ============================================================================
// PRODUCTS
// ============================================================================

export interface ProductInput {
  name: string;
  price: number;
  cost_price: number;
  stock: number;
  min_stock: number;
  category: string;
  barcode: string;
  unit: string;
}

export interface ProductQuery {
  search?: string;
  category?: string;
  lowStock?: boolean;
  limit: number;
  offset: number;
}

export function listProducts(query: ProductQuery): Paginated<Product> {
  const db = getDb();
  const where: string[] = ['deleted_at IS NULL'];
  const params: unknown[] = [];

  if (query.search) {
    where.push("(name LIKE ? ESCAPE '\\' OR barcode LIKE ? ESCAPE '\\')");
    params.push(likeParam(query.search), likeParam(query.search));
  }
  if (query.category && query.category !== 'Semua') {
    where.push('category = ?');
    params.push(query.category);
  }
  if (query.lowStock) {
    where.push('stock <= min_stock');
  }

  const clause = `WHERE ${where.join(' AND ')}`;
  const { total } = db.prepare(`SELECT COUNT(*) as total FROM products ${clause}`).get(...params) as {
    total: number;
  };
  const data = db
    .prepare(`SELECT * FROM products ${clause} ORDER BY name ASC LIMIT ? OFFSET ?`)
    .all(...params, query.limit, query.offset) as Product[];

  return { data, total, limit: query.limit, offset: query.offset };
}

export function getProductById(id: string): Product | null {
  return (getDb().prepare('SELECT * FROM products WHERE id = ? AND deleted_at IS NULL').get(id) as Product) ?? null;
}

export function getProductByBarcode(barcode: string): Product | null {
  if (!barcode.trim()) return null;
  return (
    (getDb()
      .prepare("SELECT * FROM products WHERE barcode = ? AND barcode <> '' AND deleted_at IS NULL")
      .get(barcode.trim()) as Product) ?? null
  );
}

export function createProduct(data: ProductInput): Product {
  const id = randomUUID();
  getDb()
    .prepare(
      `INSERT INTO products (id, name, price, cost_price, stock, min_stock, category, barcode, unit)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(id, data.name, data.price, data.cost_price, data.stock, data.min_stock, data.category, data.barcode, data.unit);
  return getProductById(id)!;
}

/**
 * Mengubah stok lewat form produk tetap dicatat sebagai penyesuaian, supaya
 * tidak ada jalur diam-diam untuk mengubah stok tanpa jejak audit.
 */
export function updateProduct(id: string, data: ProductInput, userId: string): Product {
  const db = getDb();
  const existing = getProductById(id);
  if (!existing) throw notFound('Produk tidak ditemukan');

  db.transaction(() => {
    db.prepare(
      `UPDATE products SET name=?, price=?, cost_price=?, stock=?, min_stock=?, category=?, barcode=?, unit=?,
       updated_at=datetime('now') WHERE id=?`,
    ).run(
      data.name,
      data.price,
      data.cost_price,
      data.stock,
      data.min_stock,
      data.category,
      data.barcode,
      data.unit,
      id,
    );

    if (data.stock !== existing.stock) {
      recordStockMovement(db, {
        productId: id,
        type: 'adjustment',
        quantity: data.stock - existing.stock,
        stockBefore: existing.stock,
        stockAfter: data.stock,
        notes: 'Penyesuaian lewat form edit produk',
        userId,
      });
    }
  })();

  return getProductById(id)!;
}

/**
 * Soft delete. Produk yang pernah terjual masih direferensikan oleh riwayat
 * transaksi dan stok, jadi menghapus barisnya akan merusak laporan.
 */
export function deleteProduct(id: string): void {
  const product = getProductById(id);
  if (!product) throw notFound('Produk tidak ditemukan');
  getDb()
    .prepare("UPDATE products SET deleted_at = datetime('now'), is_active = 0 WHERE id = ?")
    .run(id);
}

export function getCategories(): string[] {
  const rows = getDb()
    .prepare('SELECT DISTINCT category FROM products WHERE deleted_at IS NULL ORDER BY category')
    .all() as { category: string }[];
  return rows.map((r) => r.category);
}

export function getLowStockProducts(limit = 50): Product[] {
  return getDb()
    .prepare('SELECT * FROM products WHERE deleted_at IS NULL AND stock <= min_stock ORDER BY stock ASC LIMIT ?')
    .all(limit) as Product[];
}

// ============================================================================
// PERGERAKAN STOK
// ============================================================================

interface StockMovement {
  productId: string;
  type: StockMovementType;
  /** Positif untuk penambahan, negatif untuk pengurangan. */
  quantity: number;
  stockBefore: number;
  stockAfter: number;
  notes: string;
  userId: string;
  supplierId?: string | null;
  poId?: string | null;
}

function recordStockMovement(db: Database.Database, m: StockMovement): void {
  db.prepare(
    `INSERT INTO stock_history (id, product_id, supplier_id, po_id, type, quantity, stock_before, stock_after, notes, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    randomUUID(),
    m.productId,
    m.supplierId ?? null,
    m.poId ?? null,
    m.type,
    m.quantity,
    m.stockBefore,
    m.stockAfter,
    m.notes,
    m.userId,
  );
}

/** Menambah stok satu produk. Dipakai langsung maupun oleh penerimaan purchase order. */
function addStock(
  db: Database.Database,
  params: { productId: string; quantity: number; notes: string; userId: string; supplierId?: string | null; poId?: string | null },
): Product {
  const product = getProductById(params.productId);
  if (!product) throw notFound('Produk tidak ditemukan');
  const after = product.stock + params.quantity;
  db.prepare("UPDATE products SET stock = ?, updated_at = datetime('now') WHERE id = ?").run(after, params.productId);
  recordStockMovement(db, {
    productId: params.productId,
    type: 'in',
    quantity: params.quantity,
    stockBefore: product.stock,
    stockAfter: after,
    notes: params.notes,
    userId: params.userId,
    supplierId: params.supplierId,
    poId: params.poId,
  });
  return getProductById(params.productId)!;
}

export function stockIn(
  productId: string,
  quantity: number,
  notes: string,
  userId: string,
  supplierId?: string | null,
): Product {
  const db = getDb();
  return db.transaction(() => addStock(db, { productId, quantity, notes, userId, supplierId }))();
}

/** Barang keluar non-penjualan: rusak, kedaluwarsa, hilang, atau retur ke supplier. */
export function stockOut(productId: string, quantity: number, notes: string, userId: string): Product {
  const db = getDb();
  return db.transaction(() => {
    const product = getProductById(productId);
    if (!product) throw notFound('Produk tidak ditemukan');
    if (product.stock < quantity) {
      throw conflict(`Stok ${product.name} tidak cukup (tersedia ${product.stock}, diminta ${quantity})`);
    }
    const after = product.stock - quantity;
    db.prepare("UPDATE products SET stock = ?, updated_at = datetime('now') WHERE id = ?").run(after, productId);
    recordStockMovement(db, {
      productId,
      type: 'out',
      quantity: -quantity,
      stockBefore: product.stock,
      stockAfter: after,
      notes,
      userId,
    });
    return getProductById(productId)!;
  })();
}

/** Stok opname: `newStock` adalah hasil hitung fisik, bukan selisih. */
export function stockAdjust(productId: string, newStock: number, notes: string, userId: string): Product {
  const db = getDb();
  return db.transaction(() => {
    const product = getProductById(productId);
    if (!product) throw notFound('Produk tidak ditemukan');
    if (product.stock === newStock) return product;
    db.prepare("UPDATE products SET stock = ?, updated_at = datetime('now') WHERE id = ?").run(newStock, productId);
    recordStockMovement(db, {
      productId,
      type: 'adjustment',
      quantity: newStock - product.stock,
      stockBefore: product.stock,
      stockAfter: newStock,
      notes,
      userId,
    });
    return getProductById(productId)!;
  })();
}

export function listStockHistory(params: {
  productId?: string;
  type?: string;
  limit: number;
  offset: number;
}): Paginated<StockHistoryWithRelations> {
  const db = getDb();
  const where: string[] = ['1=1'];
  const values: unknown[] = [];
  if (params.productId) {
    where.push('sh.product_id = ?');
    values.push(params.productId);
  }
  if (params.type) {
    where.push('sh.type = ?');
    values.push(params.type);
  }
  const clause = `WHERE ${where.join(' AND ')}`;

  const { total } = db.prepare(`SELECT COUNT(*) as total FROM stock_history sh ${clause}`).get(...values) as {
    total: number;
  };
  const data = db
    .prepare(
      `SELECT sh.*, p.name as product_name, s.name as supplier_name, u.name as user_name
       FROM stock_history sh
       JOIN products p ON sh.product_id = p.id
       LEFT JOIN suppliers s ON sh.supplier_id = s.id
       JOIN users u ON sh.created_by = u.id
       ${clause} ORDER BY sh.created_at DESC, sh.rowid DESC LIMIT ? OFFSET ?`,
    )
    .all(...values, params.limit, params.offset) as StockHistoryWithRelations[];

  return { data, total, limit: params.limit, offset: params.offset };
}

// ============================================================================
// CUSTOMERS
// ============================================================================

export interface CustomerInput {
  name: string;
  phone: string;
  email: string;
  address: string;
}

export function listCustomers(params: { search?: string; limit: number; offset: number }): Paginated<Customer> {
  const db = getDb();
  const where: string[] = ['deleted_at IS NULL'];
  const values: unknown[] = [];
  if (params.search) {
    where.push("(name LIKE ? ESCAPE '\\' OR phone LIKE ? ESCAPE '\\' OR email LIKE ? ESCAPE '\\')");
    const like = likeParam(params.search);
    values.push(like, like, like);
  }
  const clause = `WHERE ${where.join(' AND ')}`;

  const { total } = db.prepare(`SELECT COUNT(*) as total FROM customers ${clause}`).get(...values) as {
    total: number;
  };
  const data = db
    .prepare(`SELECT * FROM customers ${clause} ORDER BY name ASC LIMIT ? OFFSET ?`)
    .all(...values, params.limit, params.offset) as Customer[];
  return { data, total, limit: params.limit, offset: params.offset };
}

export function getCustomerById(id: string): Customer | null {
  return (getDb().prepare('SELECT * FROM customers WHERE id = ? AND deleted_at IS NULL').get(id) as Customer) ?? null;
}

export function createCustomer(data: CustomerInput): Customer {
  const id = randomUUID();
  getDb()
    .prepare(
      "INSERT INTO customers (id, name, phone, email, address, updated_at) VALUES (?, ?, ?, ?, ?, datetime('now'))",
    )
    .run(id, data.name, data.phone, data.email, data.address);
  return getCustomerById(id)!;
}

export function updateCustomer(id: string, data: CustomerInput): Customer {
  if (!getCustomerById(id)) throw notFound('Pelanggan tidak ditemukan');
  getDb()
    .prepare("UPDATE customers SET name=?, phone=?, email=?, address=?, updated_at=datetime('now') WHERE id=?")
    .run(data.name, data.phone, data.email, data.address, id);
  return getCustomerById(id)!;
}

export function deleteCustomer(id: string): void {
  if (!getCustomerById(id)) throw notFound('Pelanggan tidak ditemukan');
  getDb().prepare("UPDATE customers SET deleted_at = datetime('now') WHERE id = ?").run(id);
}

export function redeemPoints(id: string, points: number, notes: string): Customer {
  const db = getDb();
  return db.transaction(() => {
    const customer = getCustomerById(id);
    if (!customer) throw notFound('Pelanggan tidak ditemukan');
    if (customer.points < points) {
      throw conflict(`Poin tidak cukup (tersedia ${customer.points}, diminta ${points})`);
    }
    db.prepare("UPDATE customers SET points = points - ?, updated_at = datetime('now') WHERE id = ?").run(points, id);
    void notes;
    return getCustomerById(id)!;
  })();
}

// ============================================================================
// SUPPLIERS
// ============================================================================

export interface SupplierInput {
  name: string;
  phone: string;
  email: string;
  address: string;
  contact_person: string;
}

export function listSuppliers(params: { search?: string; limit: number; offset: number }): Paginated<Supplier> {
  const db = getDb();
  const where: string[] = ['deleted_at IS NULL'];
  const values: unknown[] = [];
  if (params.search) {
    where.push("(name LIKE ? ESCAPE '\\' OR contact_person LIKE ? ESCAPE '\\' OR phone LIKE ? ESCAPE '\\')");
    const like = likeParam(params.search);
    values.push(like, like, like);
  }
  const clause = `WHERE ${where.join(' AND ')}`;

  const { total } = db.prepare(`SELECT COUNT(*) as total FROM suppliers ${clause}`).get(...values) as {
    total: number;
  };
  const data = db
    .prepare(`SELECT * FROM suppliers ${clause} ORDER BY name ASC LIMIT ? OFFSET ?`)
    .all(...values, params.limit, params.offset) as Supplier[];
  return { data, total, limit: params.limit, offset: params.offset };
}

export function getSupplierById(id: string): Supplier | null {
  return (getDb().prepare('SELECT * FROM suppliers WHERE id = ? AND deleted_at IS NULL').get(id) as Supplier) ?? null;
}

export function createSupplier(data: SupplierInput): Supplier {
  const id = randomUUID();
  getDb()
    .prepare(
      `INSERT INTO suppliers (id, name, phone, email, address, contact_person, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
    )
    .run(id, data.name, data.phone, data.email, data.address, data.contact_person);
  return getSupplierById(id)!;
}

export function updateSupplier(id: string, data: SupplierInput): Supplier {
  if (!getSupplierById(id)) throw notFound('Supplier tidak ditemukan');
  getDb()
    .prepare(
      "UPDATE suppliers SET name=?, phone=?, email=?, address=?, contact_person=?, updated_at=datetime('now') WHERE id=?",
    )
    .run(data.name, data.phone, data.email, data.address, data.contact_person, id);
  return getSupplierById(id)!;
}

export function deleteSupplier(id: string): void {
  if (!getSupplierById(id)) throw notFound('Supplier tidak ditemukan');
  getDb().prepare("UPDATE suppliers SET deleted_at = datetime('now') WHERE id = ?").run(id);
}

// ============================================================================
// TRANSAKSI
// ============================================================================

export interface CartItemInput {
  product_id: string;
  quantity: number;
  discount: number;
  discount_type: 'amount' | 'percent';
}

export interface CreateTransactionInput {
  items: CartItemInput[];
  customer_id?: string | null;
  user_id: string;
  discount: number;
  discount_type: 'amount' | 'percent';
  payment_method: string;
  amount_paid: number;
  notes: string;
}

/** Diskon nominal pada item bersifat per-unit; diskon persen berlaku atas nilai baris. */
function lineTotal(price: number, quantity: number, discount: number, type: 'amount' | 'percent'): number {
  const gross = price * quantity;
  const cut = type === 'percent' ? Math.round((gross * discount) / 100) : discount * quantity;
  return Math.max(0, gross - cut);
}

function nextInvoiceNo(db: Database.Database): string {
  const day = todayLocal().replace(/-/g, '');
  const prefix = `INV-${day}-`;
  const row = db
    .prepare('SELECT MAX(invoice_no) as last FROM transactions WHERE invoice_no LIKE ?')
    .get(`${prefix}%`) as { last: string | null };
  const lastSeq = row.last ? Number.parseInt(row.last.slice(prefix.length), 10) : 0;
  const next = (Number.isFinite(lastSeq) ? lastSeq : 0) + 1;
  return `${prefix}${String(next).padStart(4, '0')}`;
}

export function createTransaction(input: CreateTransactionInput): TransactionWithRelations {
  const db = getDb();
  const settings = getSettings();
  // Tarif pajak selalu dari pengaturan server — client tidak boleh menentukannya.
  const taxRate = settings.tax_rate;

  return db.transaction(() => {
    if (input.customer_id && !getCustomerById(input.customer_id)) {
      throw badRequest('Pelanggan yang dipilih tidak ditemukan');
    }

    // Gabungkan baris dengan produk yang sama supaya pengecekan stok memakai
    // total sesungguhnya, bukan per baris.
    const merged = new Map<string, CartItemInput>();
    for (const item of input.items) {
      const existing = merged.get(item.product_id);
      if (existing && existing.discount === item.discount && existing.discount_type === item.discount_type) {
        existing.quantity += item.quantity;
      } else if (existing) {
        throw badRequest('Produk yang sama tidak boleh punya dua diskon berbeda dalam satu transaksi');
      } else {
        merged.set(item.product_id, { ...item });
      }
    }

    let subtotal = 0;
    let totalCost = 0;
    const prepared: (Omit<TransactionItem, 'id' | 'transaction_id'> & { stock_before: number })[] = [];

    for (const item of merged.values()) {
      // Dibaca di dalam transaksi supaya stok tidak berubah antara cek dan tulis.
      const product = getProductById(item.product_id);
      if (!product) throw badRequest(`Produk dengan ID ${item.product_id} tidak ditemukan`);
      if (product.stock < item.quantity) {
        throw conflict(`Stok ${product.name} tidak cukup (tersedia ${product.stock}, diminta ${item.quantity})`);
      }
      if (item.discount_type === 'amount' && item.discount > product.price) {
        throw badRequest(`Diskon untuk ${product.name} melebihi harga satuannya`);
      }
      if (item.discount_type === 'percent' && item.discount > 100) {
        throw badRequest(`Diskon persen untuk ${product.name} tidak boleh lebih dari 100%`);
      }

      const lineSubtotal = lineTotal(product.price, item.quantity, item.discount, item.discount_type);
      subtotal += lineSubtotal;
      totalCost += product.cost_price * item.quantity;
      prepared.push({
        product_id: product.id,
        product_name: product.name,
        price: product.price,
        cost_price: product.cost_price,
        quantity: item.quantity,
        discount: item.discount,
        discount_type: item.discount_type,
        subtotal: lineSubtotal,
        stock_before: product.stock,
      });
    }

    const discountAmount =
      input.discount_type === 'percent' ? Math.round((subtotal * input.discount) / 100) : input.discount;
    if (discountAmount > subtotal) {
      throw badRequest('Diskon transaksi melebihi subtotal');
    }

    const afterDiscount = subtotal - discountAmount;
    const taxAmount = Math.round((afterDiscount * taxRate) / 100);
    const total = afterDiscount + taxAmount;

    // Non-tunai selalu dibayar pas; hanya tunai yang punya kembalian.
    const amountPaid = input.payment_method === 'cash' ? input.amount_paid : total;
    if (amountPaid < total) {
      throw badRequest(`Jumlah bayar kurang ${formatShortfall(total - amountPaid)} dari total tagihan`);
    }
    const change = amountPaid - total;

    // Pembayaran lewat gateway belum tentu masuk. Transaksi ditahan di status
    // pending sampai ada konfirmasi, jadi belum dihitung sebagai omzet — tapi
    // stoknya tetap dipotong supaya barang yang sama tidak terjual dua kali.
    const viaGateway = (GATEWAY_METHODS as readonly string[]).includes(input.payment_method);
    if (viaGateway && total <= 0) {
      throw badRequest('Transaksi bernilai nol tidak bisa dibayar lewat QRIS');
    }
    const status = viaGateway ? 'pending' : 'completed';
    const paymentStatus = viaGateway ? 'unpaid' : 'paid';

    const id = randomUUID();
    const invoiceNo = nextInvoiceNo(db);

    db.prepare(
      `INSERT INTO transactions (id, invoice_no, customer_id, user_id, subtotal, discount, discount_type,
        discount_amount, tax_rate, tax_amount, total, total_cost, payment_method, amount_paid, change, notes,
        status, payment_status, paid_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      id,
      invoiceNo,
      input.customer_id ?? null,
      input.user_id,
      subtotal,
      input.discount,
      input.discount_type,
      discountAmount,
      taxRate,
      taxAmount,
      total,
      totalCost,
      input.payment_method,
      amountPaid,
      change,
      input.notes,
      status,
      paymentStatus,
      viaGateway ? null : new Date().toISOString().slice(0, 19).replace('T', ' '),
    );

    const insertItem = db.prepare(
      `INSERT INTO transaction_items (id, transaction_id, product_id, product_name, price, cost_price,
        quantity, discount, discount_type, subtotal) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    const updateStock = db.prepare("UPDATE products SET stock = ?, updated_at = datetime('now') WHERE id = ?");

    for (const item of prepared) {
      insertItem.run(
        randomUUID(),
        id,
        item.product_id,
        item.product_name,
        item.price,
        item.cost_price,
        item.quantity,
        item.discount,
        item.discount_type,
        item.subtotal,
      );
      const after = item.stock_before - item.quantity;
      updateStock.run(after, item.product_id);
      recordStockMovement(db, {
        productId: item.product_id,
        type: 'sale',
        quantity: -item.quantity,
        stockBefore: item.stock_before,
        stockAfter: after,
        notes: `Penjualan ${invoiceNo}`,
        userId: input.user_id,
      });
    }

    // Poin baru diberikan setelah dana benar-benar masuk.
    if (!viaGateway && input.customer_id) {
      grantLoyalty(db, input.customer_id, total);
    }

    return getTransactionById(id)!;
  })();
}

/** Menambah poin, total belanja, dan kunjungan pelanggan. */
function grantLoyalty(db: Database.Database, customerId: string, total: number): void {
  const settings = getSettings();
  const perAmount = settings.points_per_amount > 0 ? settings.points_per_amount : 10_000;
  db.prepare(
    `UPDATE customers SET points = points + ?, total_spent = total_spent + ?, visit_count = visit_count + 1,
     updated_at = datetime('now') WHERE id = ?`,
  ).run(Math.floor(total / perAmount), total, customerId);
}

/** Mengembalikan stok seluruh item transaksi. Dipakai saat void maupun kedaluwarsa. */
function returnStock(
  db: Database.Database,
  tx: TransactionWithRelations,
  userId: string,
  movementType: StockMovementType,
  notes: string,
): void {
  for (const item of tx.items) {
    const product = db.prepare('SELECT stock FROM products WHERE id = ?').get(item.product_id) as
      | { stock: number }
      | undefined;
    // Produk yang sudah dihapus permanen tidak bisa dikembalikan stoknya,
    // tapi pembatalan transaksinya tetap harus jalan.
    if (!product) continue;
    const after = product.stock + item.quantity;
    db.prepare("UPDATE products SET stock = ?, updated_at = datetime('now') WHERE id = ?").run(after, item.product_id);
    recordStockMovement(db, {
      productId: item.product_id,
      type: movementType,
      quantity: item.quantity,
      stockBefore: product.stock,
      stockAfter: after,
      notes,
      userId,
    });
  }
}

// ===== SIKLUS PEMBAYARAN GATEWAY =====

/** Menyimpan detail QR setelah gateway membuatkan tagihan. */
export function attachPaymentDetails(
  transactionId: string,
  details: { orderId: string; qrUrl: string; expiresAt: string },
): void {
  getDb()
    .prepare(
      `UPDATE transactions SET payment_ref = ?, payment_qr_url = ?, payment_expires_at = ?,
       payment_status = 'pending' WHERE id = ?`,
    )
    .run(details.orderId, details.qrUrl, details.expiresAt, transactionId);
}

/**
 * Mencari transaksi berdasarkan order_id dari gateway.
 *
 * Cadangan ke invoice_no penting: order_id yang dikirim ke gateway memang nomor
 * invoice, dan notifikasi bisa saja tiba sebelum payment_ref sempat tersimpan —
 * atau setelah proses sempat mati di antara pembuatan QR dan penyimpanannya.
 */
/**
 * Mengambil isi QR dari event pembayaran terakhir. Dipakai saat QR yang masih
 * berlaku ditampilkan ulang, supaya tidak perlu kolom tambahan di transactions.
 */
export function getLastQrString(transactionId: string): string | null {
  const row = getDb()
    .prepare('SELECT raw FROM payments WHERE transaction_id = ? ORDER BY created_at DESC, rowid DESC LIMIT 1')
    .get(transactionId) as { raw: string } | undefined;
  if (!row?.raw) return null;
  try {
    const parsed = JSON.parse(row.raw) as { qr_string?: string };
    return parsed.qr_string ?? null;
  } catch {
    return null;
  }
}

export function getTransactionByPaymentRef(orderId: string): TransactionWithRelations | null {
  const row = getDb()
    .prepare('SELECT id FROM transactions WHERE payment_ref = ? OR invoice_no = ? LIMIT 1')
    .get(orderId, orderId) as { id: string } | undefined;
  return row ? getTransactionById(row.id) : null;
}

/** Mencatat setiap event dari gateway apa adanya, sebagai jejak audit. */
export function recordPaymentEvent(event: {
  transactionId: string;
  provider: string;
  orderId: string;
  providerRef: string | null;
  status: string;
  amount: number;
  raw: unknown;
}): void {
  getDb()
    .prepare(
      `INSERT INTO payments (id, transaction_id, provider, order_id, provider_ref, status, amount, raw)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      randomUUID(),
      event.transactionId,
      event.provider,
      event.orderId,
      event.providerRef,
      event.status,
      event.amount,
      JSON.stringify(event.raw),
    );
}

/**
 * Menandai transaksi lunas.
 *
 * Aman dipanggil berkali-kali: webhook gateway bisa dikirim ulang, dan layar
 * kasir juga memeriksa status secara berkala. Pemanggilan kedua tidak menambah
 * poin pelanggan untuk kedua kalinya.
 */
export function markTransactionPaid(transactionId: string, providerRef: string | null): TransactionWithRelations {
  const db = getDb();
  return db.transaction(() => {
    const tx = getTransactionById(transactionId);
    if (!tx) throw notFound('Transaksi tidak ditemukan');
    if (tx.payment_status === 'paid') return tx;
    if (tx.status === 'voided') throw conflict('Transaksi sudah dibatalkan sebelumnya');

    db.prepare(
      `UPDATE transactions SET status = 'completed', payment_status = 'paid',
       paid_at = datetime('now'), payment_ref = COALESCE(payment_ref, ?) WHERE id = ?`,
    ).run(providerRef, transactionId);

    if (tx.customer_id) grantLoyalty(db, tx.customer_id, tx.total);
    return getTransactionById(transactionId)!;
  })();
}

/** Pembayaran gagal atau kedaluwarsa: stok dikembalikan karena barang tidak jadi terjual. */
export function failTransaction(
  transactionId: string,
  paymentStatus: 'expired' | 'failed',
  reason: string,
): TransactionWithRelations {
  const db = getDb();
  return db.transaction(() => {
    const tx = getTransactionById(transactionId);
    if (!tx) throw notFound('Transaksi tidak ditemukan');
    if (tx.payment_status === 'paid') throw conflict('Transaksi sudah lunas, tidak bisa ditandai gagal');
    if (tx.status !== 'pending') return tx;

    db.prepare(
      "UPDATE transactions SET status = 'expired', payment_status = ?, void_reason = ? WHERE id = ?",
    ).run(paymentStatus, reason, transactionId);

    returnStock(db, tx, tx.user_id, 'void', `Pembayaran batal ${tx.invoice_no}`);
    return getTransactionById(transactionId)!;
  })();
}

/**
 * Menutup transaksi pending yang sudah lewat batas waktu.
 * Dipanggil sebelum daftar transaksi dibaca, jadi tidak perlu penjadwal terpisah.
 */
export function expireStalePayments(): number {
  const db = getDb();
  const stale = db
    .prepare(
      `SELECT id FROM transactions
       WHERE status = 'pending' AND payment_expires_at IS NOT NULL AND payment_expires_at < datetime('now')`,
    )
    .all() as { id: string }[];

  for (const row of stale) {
    try {
      failTransaction(row.id, 'expired', 'Melewati batas waktu pembayaran');
    } catch (error) {
      console.error('[payments] gagal menutup transaksi kedaluwarsa', row.id, error);
    }
  }
  return stale.length;
}

function formatShortfall(amount: number): string {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(
    amount,
  );
}

export function listTransactions(params: {
  status?: string;
  userId?: string;
  customerId?: string;
  search?: string;
  startDate?: string;
  endDate?: string;
  limit: number;
  offset: number;
}): Paginated<TransactionWithRelations> {
  const db = getDb();
  // Tutup dulu transaksi yang QR-nya sudah lewat batas waktu, supaya daftar
  // tidak menampilkan "menunggu bayar" yang sebenarnya sudah mati. Ini menghindari
  // kebutuhan penjadwal terpisah pada aplikasi satu proses seperti ini.
  expireStalePayments();

  const where: string[] = ['1=1'];
  const values: unknown[] = [];

  if (params.status) {
    where.push('t.status = ?');
    values.push(params.status);
  }
  if (params.userId) {
    where.push('t.user_id = ?');
    values.push(params.userId);
  }
  if (params.customerId) {
    where.push('t.customer_id = ?');
    values.push(params.customerId);
  }
  if (params.search) {
    where.push("(t.invoice_no LIKE ? ESCAPE '\\' OR c.name LIKE ? ESCAPE '\\' OR u.name LIKE ? ESCAPE '\\')");
    const like = likeParam(params.search);
    values.push(like, like, like);
  }
  if (params.startDate) {
    where.push(`${localDate('t.created_at')} >= ?`);
    values.push(params.startDate);
  }
  if (params.endDate) {
    where.push(`${localDate('t.created_at')} <= ?`);
    values.push(params.endDate);
  }

  const from = `FROM transactions t
    LEFT JOIN customers c ON t.customer_id = c.id
    JOIN users u ON t.user_id = u.id
    WHERE ${where.join(' AND ')}`;

  const { total } = db.prepare(`SELECT COUNT(*) as total ${from}`).get(...values) as { total: number };
  const rows = db
    .prepare(
      `SELECT t.*, c.name as customer_name, u.name as user_name ${from}
       ORDER BY t.created_at DESC, t.rowid DESC LIMIT ? OFFSET ?`,
    )
    .all(...values, params.limit, params.offset) as TransactionWithRelations[];

  return { data: attachItems(db, rows), total, limit: params.limit, offset: params.offset };
}

/** Ambil semua item dalam satu query, bukan satu query per transaksi. */
function attachItems(db: Database.Database, rows: TransactionWithRelations[]): TransactionWithRelations[] {
  if (rows.length === 0) return rows;
  const placeholders = rows.map(() => '?').join(',');
  const items = db
    .prepare(`SELECT * FROM transaction_items WHERE transaction_id IN (${placeholders}) ORDER BY rowid`)
    .all(...rows.map((r) => r.id)) as TransactionItem[];

  const byTransaction = new Map<string, TransactionItem[]>();
  for (const item of items) {
    const list = byTransaction.get(item.transaction_id);
    if (list) list.push(item);
    else byTransaction.set(item.transaction_id, [item]);
  }
  for (const row of rows) {
    row.items = byTransaction.get(row.id) ?? [];
  }
  return rows;
}

export function getTransactionById(id: string): TransactionWithRelations | null {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT t.*, c.name as customer_name, u.name as user_name, v.name as voided_by_name
       FROM transactions t
       LEFT JOIN customers c ON t.customer_id = c.id
       JOIN users u ON t.user_id = u.id
       LEFT JOIN users v ON t.voided_by = v.id
       WHERE t.id = ?`,
    )
    .get(id) as TransactionWithRelations | undefined;
  if (!row) return null;
  return attachItems(db, [row])[0];
}

export function voidTransaction(id: string, userId: string, reason: string): TransactionWithRelations {
  const db = getDb();
  return db.transaction(() => {
    const tx = getTransactionById(id);
    if (!tx) throw notFound('Transaksi tidak ditemukan');
    if (tx.status === 'voided') throw conflict('Transaksi ini sudah dibatalkan sebelumnya');
    if (tx.status === 'expired') throw conflict('Transaksi ini sudah kedaluwarsa dan stoknya sudah dikembalikan');

    db.prepare(
      "UPDATE transactions SET status = 'voided', voided_at = datetime('now'), voided_by = ?, void_reason = ? WHERE id = ?",
    ).run(userId, reason, id);

    returnStock(db, tx, userId, 'void', `Pembatalan ${tx.invoice_no}`);

    // Poin hanya pernah diberikan kalau transaksinya sudah lunas.
    if (tx.customer_id && tx.payment_status === 'paid') {
      const settings = getSettings();
      const perAmount = settings.points_per_amount > 0 ? settings.points_per_amount : 10_000;
      const points = Math.floor(tx.total / perAmount);
      // MAX(0, ...) mencegah nilai negatif kalau poin sudah ditukar duluan.
      db.prepare(
        `UPDATE customers SET
           points = MAX(0, points - ?),
           total_spent = MAX(0, total_spent - ?),
           visit_count = MAX(0, visit_count - 1),
           updated_at = datetime('now')
         WHERE id = ?`,
      ).run(points, tx.total, tx.customer_id);
    }

    return getTransactionById(id)!;
  })();
}

export function getCustomerTransactions(
  customerId: string,
  limit: number,
  offset: number,
): Paginated<TransactionWithRelations> {
  return listTransactions({ customerId, limit, offset });
}

// ============================================================================
// EXPENSES
// ============================================================================

export interface ExpenseInput {
  description: string;
  amount: number;
  category: string;
  date: string;
  notes: string;
}

export function listExpenses(params: {
  category?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
  limit: number;
  offset: number;
}): Paginated<ExpenseWithRelations> & { sum: number } {
  const db = getDb();
  const where: string[] = ['1=1'];
  const values: unknown[] = [];
  if (params.category) {
    where.push('e.category = ?');
    values.push(params.category);
  }
  if (params.startDate) {
    where.push('e.date >= ?');
    values.push(params.startDate);
  }
  if (params.endDate) {
    where.push('e.date <= ?');
    values.push(params.endDate);
  }
  if (params.search) {
    where.push("e.description LIKE ? ESCAPE '\\'");
    values.push(likeParam(params.search));
  }
  const clause = `WHERE ${where.join(' AND ')}`;

  // Total dihitung di server atas seluruh hasil filter, bukan hanya halaman ini.
  const agg = db
    .prepare(`SELECT COUNT(*) as total, COALESCE(SUM(e.amount), 0) as sum FROM expenses e ${clause}`)
    .get(...values) as { total: number; sum: number };

  const data = db
    .prepare(
      `SELECT e.*, u.name as user_name FROM expenses e JOIN users u ON e.created_by = u.id
       ${clause} ORDER BY e.date DESC, e.created_at DESC LIMIT ? OFFSET ?`,
    )
    .all(...values, params.limit, params.offset) as ExpenseWithRelations[];

  return { data, total: agg.total, sum: agg.sum, limit: params.limit, offset: params.offset };
}

export function getExpenseById(id: string): ExpenseWithRelations | null {
  return (
    (getDb()
      .prepare('SELECT e.*, u.name as user_name FROM expenses e JOIN users u ON e.created_by = u.id WHERE e.id = ?')
      .get(id) as ExpenseWithRelations) ?? null
  );
}

export function createExpense(data: ExpenseInput, userId: string): ExpenseWithRelations {
  const id = randomUUID();
  getDb()
    .prepare(
      `INSERT INTO expenses (id, description, amount, category, date, notes, created_by, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
    )
    .run(id, data.description, data.amount, data.category, data.date, data.notes, userId);
  return getExpenseById(id)!;
}

export function updateExpense(id: string, data: ExpenseInput): ExpenseWithRelations {
  if (!getExpenseById(id)) throw notFound('Pengeluaran tidak ditemukan');
  getDb()
    .prepare(
      "UPDATE expenses SET description=?, amount=?, category=?, date=?, notes=?, updated_at=datetime('now') WHERE id=?",
    )
    .run(data.description, data.amount, data.category, data.date, data.notes, id);
  return getExpenseById(id)!;
}

export function deleteExpense(id: string): void {
  if (!getExpenseById(id)) throw notFound('Pengeluaran tidak ditemukan');
  getDb().prepare('DELETE FROM expenses WHERE id = ?').run(id);
}

export function getExpenseCategories(): string[] {
  const rows = getDb().prepare('SELECT DISTINCT category FROM expenses ORDER BY category').all() as {
    category: string;
  }[];
  return rows.map((r) => r.category);
}

// ============================================================================
// USERS
// ============================================================================

const PUBLIC_USER_COLUMNS = 'id, name, email, role, is_active, created_at, updated_at';

export interface CreateUserInput {
  name: string;
  email: string;
  password: string;
  role: Role;
}

export interface UpdateUserInput {
  name: string;
  email: string;
  password?: string;
  role: Role;
  is_active?: boolean;
}

export function listUsers(params: { search?: string; limit: number; offset: number }): Paginated<PublicUser> {
  const db = getDb();
  const where: string[] = ['deleted_at IS NULL'];
  const values: unknown[] = [];
  if (params.search) {
    where.push("(name LIKE ? ESCAPE '\\' OR email LIKE ? ESCAPE '\\')");
    const like = likeParam(params.search);
    values.push(like, like);
  }
  const clause = `WHERE ${where.join(' AND ')}`;

  const { total } = db.prepare(`SELECT COUNT(*) as total FROM users ${clause}`).get(...values) as { total: number };
  const data = db
    .prepare(`SELECT ${PUBLIC_USER_COLUMNS} FROM users ${clause} ORDER BY name ASC LIMIT ? OFFSET ?`)
    .all(...values, params.limit, params.offset) as PublicUser[];
  return { data, total, limit: params.limit, offset: params.offset };
}

export function getUserById(id: string): PublicUser | null {
  return (
    (getDb()
      .prepare(`SELECT ${PUBLIC_USER_COLUMNS} FROM users WHERE id = ? AND deleted_at IS NULL`)
      .get(id) as PublicUser) ?? null
  );
}

export function getUserByEmail(email: string): UserRow | null {
  return (
    (getDb()
      .prepare('SELECT * FROM users WHERE lower(email) = lower(?) AND deleted_at IS NULL')
      .get(email.trim()) as UserRow) ?? null
  );
}

function countActiveAdmins(excludeId?: string): number {
  const db = getDb();
  const sql = excludeId
    ? "SELECT COUNT(*) as count FROM users WHERE role = 'ADMIN' AND is_active = 1 AND deleted_at IS NULL AND id <> ?"
    : "SELECT COUNT(*) as count FROM users WHERE role = 'ADMIN' AND is_active = 1 AND deleted_at IS NULL";
  const row = (excludeId ? db.prepare(sql).get(excludeId) : db.prepare(sql).get()) as { count: number };
  return row.count;
}

export function createUser(data: CreateUserInput): PublicUser {
  const id = randomUUID();
  getDb()
    .prepare(
      "INSERT INTO users (id, name, email, password, role, updated_at) VALUES (?, ?, ?, ?, ?, datetime('now'))",
    )
    .run(id, data.name, data.email.trim(), bcrypt.hashSync(data.password, BCRYPT_ROUNDS), data.role);
  return getUserById(id)!;
}

export function updateUser(id: string, data: UpdateUserInput, actorId: string): PublicUser {
  const db = getDb();
  const existing = getUserById(id);
  if (!existing) throw notFound('User tidak ditemukan');

  const willBeActive = data.is_active ?? existing.is_active === 1;
  const losesAdmin = existing.role === 'ADMIN' && (data.role !== 'ADMIN' || !willBeActive);
  if (losesAdmin && countActiveAdmins(id) === 0) {
    throw conflict('Tidak bisa mengubah admin terakhir — sistem harus punya minimal satu admin aktif');
  }
  if (id === actorId && data.role !== 'ADMIN') {
    throw conflict('Anda tidak bisa menurunkan role akun Anda sendiri');
  }
  if (id === actorId && !willBeActive) {
    throw conflict('Anda tidak bisa menonaktifkan akun Anda sendiri');
  }

  if (data.password) {
    db.prepare(
      "UPDATE users SET name=?, email=?, password=?, role=?, is_active=?, updated_at=datetime('now') WHERE id=?",
    ).run(data.name, data.email.trim(), bcrypt.hashSync(data.password, BCRYPT_ROUNDS), data.role, willBeActive ? 1 : 0, id);
  } else {
    db.prepare("UPDATE users SET name=?, email=?, role=?, is_active=?, updated_at=datetime('now') WHERE id=?").run(
      data.name,
      data.email.trim(),
      data.role,
      willBeActive ? 1 : 0,
      id,
    );
  }
  return getUserById(id)!;
}

export function deleteUser(id: string, actorId: string): void {
  const existing = getUserById(id);
  if (!existing) throw notFound('User tidak ditemukan');
  if (id === actorId) throw conflict('Anda tidak bisa menghapus akun Anda sendiri');
  if (existing.role === 'ADMIN' && countActiveAdmins(id) === 0) {
    throw conflict('Tidak bisa menghapus admin terakhir — sistem harus punya minimal satu admin aktif');
  }
  // Soft delete: transaksi dan riwayat stok masih menunjuk ke user ini.
  getDb().prepare("UPDATE users SET deleted_at = datetime('now'), is_active = 0 WHERE id = ?").run(id);
}

export function changePassword(id: string, currentPassword: string, newPassword: string): void {
  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE id = ? AND deleted_at IS NULL').get(id) as UserRow | undefined;
  if (!user) throw notFound('User tidak ditemukan');
  if (!bcrypt.compareSync(currentPassword, user.password)) {
    throw badRequest('Password saat ini salah', { current_password: 'Password saat ini salah' });
  }
  db.prepare("UPDATE users SET password = ?, updated_at = datetime('now') WHERE id = ?").run(
    bcrypt.hashSync(newPassword, BCRYPT_ROUNDS),
    id,
  );
}

// ============================================================================
// PURCHASE ORDER
// ============================================================================

export interface PurchaseOrderItemInput {
  product_id: string;
  quantity: number;
  cost_price: number;
}

export interface PurchaseOrderInput {
  supplier_id: string;
  order_date: string;
  expected_date?: string | null;
  notes: string;
  items: PurchaseOrderItemInput[];
}

function nextPoNo(db: Database.Database): string {
  const day = todayLocal().replace(/-/g, '');
  const prefix = `PO-${day}-`;
  const row = db.prepare('SELECT MAX(po_no) as last FROM purchase_orders WHERE po_no LIKE ?').get(`${prefix}%`) as {
    last: string | null;
  };
  const lastSeq = row.last ? Number.parseInt(row.last.slice(prefix.length), 10) : 0;
  return `${prefix}${String((Number.isFinite(lastSeq) ? lastSeq : 0) + 1).padStart(4, '0')}`;
}

/** Menyiapkan baris item sekaligus menghitung totalnya, dipakai saat buat & ubah. */
function preparePoItems(items: PurchaseOrderItemInput[]) {
  const seen = new Set<string>();
  let total = 0;
  const rows = items.map((item) => {
    if (seen.has(item.product_id)) {
      throw badRequest('Ada produk yang sama tercantum lebih dari sekali');
    }
    seen.add(item.product_id);

    const product = getProductById(item.product_id);
    if (!product) throw badRequest(`Produk dengan ID ${item.product_id} tidak ditemukan`);
    const subtotal = item.cost_price * item.quantity;
    total += subtotal;
    return {
      product_id: product.id,
      product_name: product.name,
      quantity: item.quantity,
      cost_price: item.cost_price,
      subtotal,
    };
  });
  return { rows, total };
}

function insertPoItems(
  db: Database.Database,
  poId: string,
  rows: ReturnType<typeof preparePoItems>['rows'],
): void {
  const stmt = db.prepare(
    `INSERT INTO purchase_order_items (id, po_id, product_id, product_name, quantity, cost_price, subtotal)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  );
  for (const row of rows) {
    stmt.run(randomUUID(), poId, row.product_id, row.product_name, row.quantity, row.cost_price, row.subtotal);
  }
}

export function listPurchaseOrders(params: {
  status?: string;
  supplierId?: string;
  search?: string;
  limit: number;
  offset: number;
}): Paginated<PurchaseOrderWithRelations> {
  const db = getDb();
  const where: string[] = ['1=1'];
  const values: unknown[] = [];
  if (params.status) {
    where.push('po.status = ?');
    values.push(params.status);
  }
  if (params.supplierId) {
    where.push('po.supplier_id = ?');
    values.push(params.supplierId);
  }
  if (params.search) {
    where.push("(po.po_no LIKE ? ESCAPE '\\' OR s.name LIKE ? ESCAPE '\\')");
    const like = likeParam(params.search);
    values.push(like, like);
  }

  const from = `FROM purchase_orders po
    JOIN suppliers s ON po.supplier_id = s.id
    JOIN users u ON po.created_by = u.id
    LEFT JOIN users r ON po.received_by = r.id
    WHERE ${where.join(' AND ')}`;

  const { total } = db.prepare(`SELECT COUNT(*) as total ${from}`).get(...values) as { total: number };
  const rows = db
    .prepare(
      `SELECT po.*, s.name as supplier_name, u.name as created_by_name, r.name as received_by_name ${from}
       ORDER BY po.order_date DESC, po.created_at DESC LIMIT ? OFFSET ?`,
    )
    .all(...values, params.limit, params.offset) as PurchaseOrderWithRelations[];

  return { data: attachPoItems(db, rows), total, limit: params.limit, offset: params.offset };
}

function attachPoItems(
  db: Database.Database,
  rows: PurchaseOrderWithRelations[],
): PurchaseOrderWithRelations[] {
  if (rows.length === 0) return rows;
  const placeholders = rows.map(() => '?').join(',');
  const items = db
    .prepare(`SELECT * FROM purchase_order_items WHERE po_id IN (${placeholders}) ORDER BY rowid`)
    .all(...rows.map((row) => row.id)) as PurchaseOrderItem[];

  const byPo = new Map<string, PurchaseOrderItem[]>();
  for (const item of items) {
    const list = byPo.get(item.po_id);
    if (list) list.push(item);
    else byPo.set(item.po_id, [item]);
  }
  for (const row of rows) row.items = byPo.get(row.id) ?? [];
  return rows;
}

export function getPurchaseOrderById(id: string): PurchaseOrderWithRelations | null {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT po.*, s.name as supplier_name, u.name as created_by_name, r.name as received_by_name
       FROM purchase_orders po
       JOIN suppliers s ON po.supplier_id = s.id
       JOIN users u ON po.created_by = u.id
       LEFT JOIN users r ON po.received_by = r.id
       WHERE po.id = ?`,
    )
    .get(id) as PurchaseOrderWithRelations | undefined;
  if (!row) return null;
  return attachPoItems(db, [row])[0];
}

export function createPurchaseOrder(input: PurchaseOrderInput, userId: string): PurchaseOrderWithRelations {
  const db = getDb();
  return db.transaction(() => {
    if (!getSupplierById(input.supplier_id)) throw badRequest('Supplier tidak ditemukan');
    const { rows, total } = preparePoItems(input.items);

    const id = randomUUID();
    db.prepare(
      `INSERT INTO purchase_orders (id, po_no, supplier_id, status, order_date, expected_date, total, notes, created_by)
       VALUES (?, ?, ?, 'draft', ?, ?, ?, ?, ?)`,
    ).run(id, nextPoNo(db), input.supplier_id, input.order_date, input.expected_date ?? null, total, input.notes, userId);

    insertPoItems(db, id, rows);
    return getPurchaseOrderById(id)!;
  })();
}

export function updatePurchaseOrder(id: string, input: PurchaseOrderInput): PurchaseOrderWithRelations {
  const db = getDb();
  return db.transaction(() => {
    const existing = getPurchaseOrderById(id);
    if (!existing) throw notFound('Purchase order tidak ditemukan');
    // Setelah dipesan atau diterima, isinya tidak boleh berubah — angka stok dan
    // riwayat pembelian sudah terlanjur mengacu ke sini.
    if (existing.status !== 'draft') {
      throw conflict('Hanya PO berstatus draft yang bisa diubah');
    }
    if (!getSupplierById(input.supplier_id)) throw badRequest('Supplier tidak ditemukan');

    const { rows, total } = preparePoItems(input.items);
    db.prepare(
      `UPDATE purchase_orders SET supplier_id=?, order_date=?, expected_date=?, total=?, notes=?,
       updated_at=datetime('now') WHERE id=?`,
    ).run(input.supplier_id, input.order_date, input.expected_date ?? null, total, input.notes, id);

    db.prepare('DELETE FROM purchase_order_items WHERE po_id = ?').run(id);
    insertPoItems(db, id, rows);
    return getPurchaseOrderById(id)!;
  })();
}

export function deletePurchaseOrder(id: string): void {
  const existing = getPurchaseOrderById(id);
  if (!existing) throw notFound('Purchase order tidak ditemukan');
  if (existing.status !== 'draft') {
    throw conflict('Hanya PO berstatus draft yang bisa dihapus. PO lain sebaiknya dibatalkan agar jejaknya tersimpan.');
  }
  getDb().prepare('DELETE FROM purchase_orders WHERE id = ?').run(id);
}

/** Transisi status yang diizinkan. Penerimaan ditangani terpisah karena mengubah stok. */
const ALLOWED_TRANSITIONS: Record<PurchaseOrderStatus, PurchaseOrderStatus[]> = {
  draft: ['ordered', 'cancelled'],
  ordered: ['received', 'cancelled'],
  received: [],
  cancelled: [],
};

export function setPurchaseOrderStatus(
  id: string,
  status: PurchaseOrderStatus,
  userId: string,
): PurchaseOrderWithRelations {
  const db = getDb();
  return db.transaction(() => {
    const po = getPurchaseOrderById(id);
    if (!po) throw notFound('Purchase order tidak ditemukan');
    if (!ALLOWED_TRANSITIONS[po.status].includes(status)) {
      throw conflict(
        `PO berstatus "${PO_STATUS_LABELS[po.status]}" tidak bisa diubah menjadi "${PO_STATUS_LABELS[status]}"`,
      );
    }

    if (status !== 'received') {
      db.prepare("UPDATE purchase_orders SET status = ?, updated_at = datetime('now') WHERE id = ?").run(status, id);
      return getPurchaseOrderById(id)!;
    }

    if (po.items.length === 0) throw conflict('PO tanpa item tidak bisa diterima');

    // Penerimaan barang: stok bertambah dan harga modal produk mengikuti harga
    // beli terakhir, supaya perhitungan laba memakai angka yang aktual.
    for (const item of po.items) {
      addStock(db, {
        productId: item.product_id,
        quantity: item.quantity,
        notes: `Penerimaan ${po.po_no} dari ${po.supplier_name}`,
        userId,
        supplierId: po.supplier_id,
        poId: po.id,
      });
      db.prepare("UPDATE products SET cost_price = ?, updated_at = datetime('now') WHERE id = ?").run(
        item.cost_price,
        item.product_id,
      );
    }

    db.prepare(
      `UPDATE purchase_orders SET status = 'received', received_at = datetime('now'), received_by = ?,
       updated_at = datetime('now') WHERE id = ?`,
    ).run(userId, id);

    return getPurchaseOrderById(id)!;
  })();
}

// ============================================================================
// DASHBOARD
// ============================================================================

export function getDashboardStats(userId: string, role: Role): DashboardStats {
  const db = getDb();
  const canSeeProfit = role === 'ADMIN';
  // Kasir hanya melihat performa shift-nya sendiri, bukan omzet seluruh toko.
  const scopedToSelf = role !== 'ADMIN';
  const today = todayLocal();
  const day = localDate('t.created_at');

  const scope = scopedToSelf ? 'AND t.user_id = ?' : '';
  const scopeParams = scopedToSelf ? [userId] : [];

  const todayStats = db
    .prepare(
      `SELECT COALESCE(SUM(t.total), 0) as sales, COUNT(*) as count,
              COALESCE(SUM(t.total - t.tax_amount - t.total_cost), 0) as profit,
              COUNT(DISTINCT t.customer_id) as customers
       FROM transactions t WHERE ${day} = ? AND t.status = 'completed' ${scope}`,
    )
    .get(today, ...scopeParams) as { sales: number; count: number; profit: number; customers: number };

  const { count: totalProducts } = db
    .prepare('SELECT COUNT(*) as count FROM products WHERE deleted_at IS NULL')
    .get() as { count: number };
  const { count: lowStockCount } = db
    .prepare('SELECT COUNT(*) as count FROM products WHERE deleted_at IS NULL AND stock <= min_stock')
    .get() as { count: number };

  const recent = db
    .prepare(
      `SELECT t.*, c.name as customer_name, u.name as user_name
       FROM transactions t
       LEFT JOIN customers c ON t.customer_id = c.id
       JOIN users u ON t.user_id = u.id
       WHERE t.status = 'completed' ${scope}
       ORDER BY t.created_at DESC, t.rowid DESC LIMIT 5`,
    )
    .all(...scopeParams) as TransactionWithRelations[];

  const topProducts = db
    .prepare(
      `SELECT ti.product_id, ti.product_name as name, SUM(ti.quantity) as quantity,
              SUM(ti.subtotal) as revenue, SUM(ti.subtotal - ti.cost_price * ti.quantity) as profit
       FROM transaction_items ti JOIN transactions t ON ti.transaction_id = t.id
       WHERE ${day} = ? AND t.status = 'completed' ${scope}
       GROUP BY ti.product_id ORDER BY quantity DESC LIMIT 5`,
    )
    .all(today, ...scopeParams) as TopProduct[];

  // Satu query untuk 7 hari sekaligus, lalu isi hari kosong di sisi JS.
  const rawChart = db
    .prepare(
      `SELECT ${day} as date, COUNT(*) as transactions, COALESCE(SUM(t.total), 0) as sales,
              COALESCE(SUM(t.total - t.tax_amount - t.total_cost), 0) as profit
       FROM transactions t
       WHERE t.status = 'completed' AND ${day} >= date(?, '-6 days') AND ${day} <= ? ${scope}
       GROUP BY ${day}`,
    )
    .all(today, today, ...scopeParams) as DailySales[];

  const chartByDate = new Map(rawChart.map((r) => [r.date, r]));
  const salesChart: DailySales[] = [];
  for (let i = 6; i >= 0; i--) {
    const date = new Date(`${today}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() - i);
    const key = date.toISOString().slice(0, 10);
    salesChart.push(chartByDate.get(key) ?? { date: key, transactions: 0, sales: 0, profit: 0 });
  }

  const categoryChart = db
    .prepare(
      `SELECT p.category, SUM(ti.subtotal) as total
       FROM transaction_items ti
       JOIN transactions t ON ti.transaction_id = t.id
       JOIN products p ON ti.product_id = p.id
       WHERE ${day} = ? AND t.status = 'completed' ${scope}
       GROUP BY p.category ORDER BY total DESC`,
    )
    .all(today, ...scopeParams) as CategorySales[];

  return {
    canSeeProfit,
    scopedToSelf,
    todaySales: todayStats.sales,
    todayProfit: canSeeProfit ? todayStats.profit : 0,
    todayTransactions: todayStats.count,
    todayCustomers: todayStats.customers,
    totalProducts,
    lowStockCount,
    recentTransactions: attachItems(db, recent),
    topProducts: canSeeProfit ? topProducts : topProducts.map((p) => ({ ...p, profit: 0 })),
    salesChart: canSeeProfit ? salesChart : salesChart.map((d) => ({ ...d, profit: 0 })),
    categoryChart,
  };
}

// ============================================================================
// LAPORAN
// ============================================================================

export function getSalesReport(startDate: string, endDate: string): SalesReport {
  const db = getDb();
  const day = localDate('t.created_at');
  const range = [startDate, endDate];

  const summary = db
    .prepare(
      `SELECT COUNT(*) as totalTransactions,
              COALESCE(SUM(t.total), 0) as totalSales,
              COALESCE(SUM(t.total - t.tax_amount - t.total_cost), 0) as totalProfit
       FROM transactions t WHERE ${day} BETWEEN ? AND ? AND t.status = 'completed'`,
    )
    .get(...range) as { totalTransactions: number; totalSales: number; totalProfit: number };

  const { voidedCount } = db
    .prepare(
      `SELECT COUNT(*) as voidedCount FROM transactions t WHERE ${day} BETWEEN ? AND ? AND t.status = 'voided'`,
    )
    .get(...range) as { voidedCount: number };

  const { totalItemsSold } = db
    .prepare(
      `SELECT COALESCE(SUM(ti.quantity), 0) as totalItemsSold FROM transaction_items ti
       JOIN transactions t ON ti.transaction_id = t.id
       WHERE ${day} BETWEEN ? AND ? AND t.status = 'completed'`,
    )
    .get(...range) as { totalItemsSold: number };

  const { totalExpenses } = db
    .prepare('SELECT COALESCE(SUM(amount), 0) as totalExpenses FROM expenses WHERE date BETWEEN ? AND ?')
    .get(...range) as { totalExpenses: number };

  const dailySales = db
    .prepare(
      `SELECT ${day} as date, COUNT(*) as transactions, COALESCE(SUM(t.total), 0) as sales,
              COALESCE(SUM(t.total - t.tax_amount - t.total_cost), 0) as profit
       FROM transactions t WHERE ${day} BETWEEN ? AND ? AND t.status = 'completed'
       GROUP BY ${day} ORDER BY date`,
    )
    .all(...range) as DailySales[];

  const topProducts = db
    .prepare(
      `SELECT ti.product_id, ti.product_name as name, SUM(ti.quantity) as quantity,
              SUM(ti.subtotal) as revenue, SUM(ti.subtotal - ti.cost_price * ti.quantity) as profit
       FROM transaction_items ti JOIN transactions t ON ti.transaction_id = t.id
       WHERE ${day} BETWEEN ? AND ? AND t.status = 'completed'
       GROUP BY ti.product_id ORDER BY revenue DESC LIMIT 10`,
    )
    .all(...range) as TopProduct[];

  const byPayment = db
    .prepare(
      `SELECT t.payment_method, COUNT(*) as count, COALESCE(SUM(t.total), 0) as total
       FROM transactions t WHERE ${day} BETWEEN ? AND ? AND t.status = 'completed'
       GROUP BY t.payment_method ORDER BY total DESC`,
    )
    .all(...range) as PaymentBreakdown[];

  const byCategory = db
    .prepare(
      `SELECT p.category, COALESCE(SUM(ti.subtotal), 0) as total
       FROM transaction_items ti
       JOIN transactions t ON ti.transaction_id = t.id
       JOIN products p ON ti.product_id = p.id
       WHERE ${day} BETWEEN ? AND ? AND t.status = 'completed'
       GROUP BY p.category ORDER BY total DESC`,
    )
    .all(...range) as CategorySales[];

  const expensesByCategory = db
    .prepare(
      `SELECT category, COALESCE(SUM(amount), 0) as total FROM expenses
       WHERE date BETWEEN ? AND ? GROUP BY category ORDER BY total DESC`,
    )
    .all(...range) as { category: string; total: number }[];

  return {
    summary: {
      ...summary,
      totalExpenses,
      netProfit: summary.totalProfit - totalExpenses,
      averageTransaction:
        summary.totalTransactions > 0 ? Math.round(summary.totalSales / summary.totalTransactions) : 0,
      totalItemsSold,
      voidedCount,
    },
    dailySales,
    topProducts,
    byPayment,
    byCategory,
    expensesByCategory,
  };
}

export type { Product, Customer, Supplier, Expense, Transaction, Settings };
