import Database from 'better-sqlite3';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';

const DB_PATH = path.join(process.cwd(), 'kasir.db');
let db: Database.Database;

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    initDb();
  }
  return db;
}

function initDb() {
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

    CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);
    CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
    CREATE INDEX IF NOT EXISTS idx_transactions_created ON transactions(created_at);
    CREATE INDEX IF NOT EXISTS idx_transactions_customer ON transactions(customer_id);
    CREATE INDEX IF NOT EXISTS idx_transactions_user ON transactions(user_id);
    CREATE INDEX IF NOT EXISTS idx_transaction_items_tid ON transaction_items(transaction_id);
    CREATE INDEX IF NOT EXISTS idx_stock_history_pid ON stock_history(product_id);
    CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date);
    CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
  `);

  const userCount = (db.prepare('SELECT COUNT(*) as count FROM users').get() as any).count;
  if (userCount === 0) {
    seedData();
  }
}

function seedData() {
  const adminPass = bcrypt.hashSync('admin123', 10);
  const kasirPass = bcrypt.hashSync('kasir123', 10);

  const adminId = uuidv4();
  const kasirId = uuidv4();

  db.prepare('INSERT INTO users (id, name, email, password, role) VALUES (?, ?, ?, ?, ?)').run(adminId, 'Admin', 'admin@kasir.com', adminPass, 'ADMIN');
  db.prepare('INSERT INTO users (id, name, email, password, role) VALUES (?, ?, ?, ?, ?)').run(kasirId, 'Kasir 1', 'kasir@kasir.com', kasirPass, 'KASIR');

  db.prepare('INSERT INTO settings (id) VALUES (?)').run('default');

  const products = [
    { name: 'Nasi Goreng Spesial', price: 18000, cost: 10000, stock: 50, cat: 'Makanan' },
    { name: 'Mie Ayam Bakso', price: 15000, cost: 8000, stock: 40, cat: 'Makanan' },
    { name: 'Ayam Geprek', price: 20000, cost: 12000, stock: 30, cat: 'Makanan' },
    { name: 'Soto Ayam', price: 14000, cost: 7000, stock: 35, cat: 'Makanan' },
    { name: 'Nasi Uduk', price: 12000, cost: 6000, stock: 45, cat: 'Makanan' },
    { name: 'Es Teh Manis', price: 5000, cost: 1500, stock: 100, cat: 'Minuman' },
    { name: 'Es Jeruk', price: 7000, cost: 3000, stock: 80, cat: 'Minuman' },
    { name: 'Kopi Hitam', price: 8000, cost: 3000, stock: 60, cat: 'Minuman' },
    { name: 'Kopi Susu', price: 12000, cost: 5000, stock: 50, cat: 'Minuman' },
    { name: 'Air Mineral', price: 3000, cost: 1500, stock: 200, cat: 'Minuman' },
    { name: 'Kerupuk', price: 2000, cost: 800, stock: 150, cat: 'Snack' },
    { name: 'Risoles', price: 5000, cost: 2500, stock: 45, cat: 'Snack' },
    { name: 'Martabak Mini', price: 8000, cost: 4000, stock: 25, cat: 'Snack' },
    { name: 'Roti Bakar', price: 10000, cost: 5000, stock: 30, cat: 'Snack' },
    { name: 'Pisang Goreng', price: 3000, cost: 1000, stock: 3, cat: 'Snack' },
  ];

  const prodStmt = db.prepare('INSERT INTO products (id, name, price, cost_price, stock, category) VALUES (?, ?, ?, ?, ?, ?)');
  for (const p of products) {
    prodStmt.run(uuidv4(), p.name, p.price, p.cost, p.stock, p.cat);
  }

  const customers = [
    { name: 'Budi Santoso', phone: '081234567890', email: 'budi@mail.com' },
    { name: 'Siti Rahayu', phone: '085678901234', email: 'siti@mail.com' },
    { name: 'Ahmad Hidayat', phone: '087890123456', email: '' },
  ];

  const custStmt = db.prepare('INSERT INTO customers (id, name, phone, email) VALUES (?, ?, ?, ?)');
  for (const c of customers) {
    custStmt.run(uuidv4(), c.name, c.phone, c.email);
  }

  const suppliers = [
    { name: 'PT Sumber Rejeki', phone: '021-1234567', contact: 'Pak Joko' },
    { name: 'CV Maju Bersama', phone: '021-7654321', contact: 'Bu Ani' },
  ];

  const suppStmt = db.prepare('INSERT INTO suppliers (id, name, phone, contact_person) VALUES (?, ?, ?, ?)');
  for (const s of suppliers) {
    suppStmt.run(uuidv4(), s.name, s.phone, s.contact);
  }
}

// ===== PRODUCTS =====
export function getAllProducts(search?: string, category?: string) {
  const d = getDb();
  let query = 'SELECT * FROM products WHERE 1=1';
  const params: string[] = [];
  if (search) { query += ' AND (name LIKE ? OR barcode LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }
  if (category && category !== 'Semua') { query += ' AND category = ?'; params.push(category); }
  query += ' ORDER BY name ASC';
  return d.prepare(query).all(...params) as any[];
}

export function getProductById(id: string) {
  return getDb().prepare('SELECT * FROM products WHERE id = ?').get(id) as any;
}

export function createProduct(data: any) {
  const d = getDb();
  const id = uuidv4();
  d.prepare('INSERT INTO products (id, name, price, cost_price, stock, min_stock, category, barcode) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(id, data.name, data.price, data.cost_price || 0, data.stock || 0, data.min_stock || 5, data.category || 'Umum', data.barcode || '');
  return getProductById(id);
}

export function updateProduct(id: string, data: any) {
  const d = getDb();
  d.prepare("UPDATE products SET name=?, price=?, cost_price=?, stock=?, min_stock=?, category=?, barcode=?, updated_at=datetime('now') WHERE id=?").run(data.name, data.price, data.cost_price || 0, data.stock, data.min_stock || 5, data.category, data.barcode || '', id);
  return getProductById(id);
}

export function deleteProduct(id: string) {
  getDb().prepare('DELETE FROM products WHERE id = ?').run(id);
}

export function stockIn(productId: string, quantity: number, notes: string, userId: string) {
  const d = getDb();
  d.prepare('UPDATE products SET stock = stock + ?, updated_at = datetime(\'now\') WHERE id = ?').run(quantity, productId);
  d.prepare('INSERT INTO stock_history (id, product_id, type, quantity, notes, created_by) VALUES (?, ?, ?, ?, ?, ?)').run(uuidv4(), productId, 'in', quantity, notes, userId);
  return getProductById(productId);
}

// ===== CUSTOMERS =====
export function getAllCustomers(search?: string) {
  const d = getDb();
  let query = 'SELECT * FROM customers WHERE 1=1';
  const params: string[] = [];
  if (search) { query += ' AND (name LIKE ? OR phone LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }
  query += ' ORDER BY name ASC';
  return d.prepare(query).all(...params) as any[];
}

export function getCustomerById(id: string) {
  return getDb().prepare('SELECT * FROM customers WHERE id = ?').get(id) as any;
}

export function createCustomer(data: any) {
  const d = getDb();
  const id = uuidv4();
  d.prepare('INSERT INTO customers (id, name, phone, email, address) VALUES (?, ?, ?, ?, ?)').run(id, data.name, data.phone || '', data.email || '', data.address || '');
  return getCustomerById(id);
}

export function updateCustomer(id: string, data: any) {
  const d = getDb();
  d.prepare('UPDATE customers SET name=?, phone=?, email=?, address=? WHERE id=?').run(data.name, data.phone, data.email, data.address, id);
  return getCustomerById(id);
}

export function deleteCustomer(id: string) {
  getDb().prepare('DELETE FROM customers WHERE id = ?').run(id);
}

// ===== SUPPLIERS =====
export function getAllSuppliers(search?: string) {
  const d = getDb();
  let query = 'SELECT * FROM suppliers WHERE 1=1';
  const params: string[] = [];
  if (search) { query += ' AND (name LIKE ? OR contact_person LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }
  query += ' ORDER BY name ASC';
  return d.prepare(query).all(...params) as any[];
}

export function getSupplierById(id: string) {
  return getDb().prepare('SELECT * FROM suppliers WHERE id = ?').get(id) as any;
}

export function createSupplier(data: any) {
  const d = getDb();
  const id = uuidv4();
  d.prepare('INSERT INTO suppliers (id, name, phone, email, address, contact_person) VALUES (?, ?, ?, ?, ?, ?)').run(id, data.name, data.phone || '', data.email || '', data.address || '', data.contact_person || '');
  return getSupplierById(id);
}

export function updateSupplier(id: string, data: any) {
  const d = getDb();
  d.prepare('UPDATE suppliers SET name=?, phone=?, email=?, address=?, contact_person=? WHERE id=?').run(data.name, data.phone, data.email, data.address, data.contact_person, id);
  return getSupplierById(id);
}

export function deleteSupplier(id: string) {
  getDb().prepare('DELETE FROM suppliers WHERE id = ?').run(id);
}

// ===== TRANSACTIONS =====
export function getTransactions(limit = 50, offset = 0, status?: string) {
  const d = getDb();
  let query = `SELECT t.*, c.name as customer_name, u.name as user_name FROM transactions t
    LEFT JOIN customers c ON t.customer_id = c.id
    JOIN users u ON t.user_id = u.id WHERE 1=1`;
  const params: any[] = [];
  if (status) { query += ' AND t.status = ?'; params.push(status); }
  query += ' ORDER BY t.created_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);
  const transactions = d.prepare(query).all(...params) as any[];
  return transactions.map(t => ({
    ...t,
    items: d.prepare('SELECT * FROM transaction_items WHERE transaction_id = ?').all(t.id) as any[],
  }));
}

export function getTransactionById(id: string) {
  const d = getDb();
  const t = d.prepare(`SELECT t.*, c.name as customer_name, u.name as user_name FROM transactions t
    LEFT JOIN customers c ON t.customer_id = c.id
    JOIN users u ON t.user_id = u.id WHERE t.id = ?`).get(id) as any;
  if (!t) return null;
  t.items = d.prepare('SELECT * FROM transaction_items WHERE transaction_id = ?').all(id) as any[];
  return t;
}

export function createTransaction(data: {
  items: { product_id: string; quantity: number; discount?: number; discount_type?: string }[];
  customer_id?: string;
  user_id: string;
  discount?: number;
  discount_type?: string;
  tax_rate?: number;
  payment_method: string;
  amount_paid: number;
  notes?: string;
}) {
  const d = getDb();
  const id = uuidv4();
  const settings = getSettings();
  let subtotal = 0;

  const itemsWithDetails = data.items.map(item => {
    const product = getProductById(item.product_id);
    if (!product) throw new Error(`Produk dengan ID ${item.product_id} tidak ditemukan`);
    if (product.stock < item.quantity) throw new Error(`Stok ${product.name} tidak cukup (tersedia: ${product.stock}, diminta: ${item.quantity})`);
    if (item.quantity <= 0) throw new Error(`Quantity tidak valid untuk ${product.name}`);
    let itemSubtotal = product.price * item.quantity;
    if (item.discount) {
      if (item.discount_type === 'percent') {
        itemSubtotal -= Math.round(itemSubtotal * item.discount / 100);
      } else {
        itemSubtotal -= item.discount * item.quantity;
      }
    }
    subtotal += itemSubtotal;
    return {
      product_id: item.product_id,
      product_name: product.name,
      price: product.price,
      cost_price: product.cost_price || 0,
      quantity: item.quantity,
      discount: item.discount || 0,
      discount_type: item.discount_type || 'amount',
      subtotal: itemSubtotal,
    };
  });

  let afterDiscount = subtotal;
  const txDiscount = data.discount || 0;
  if (txDiscount > 0) {
    if (data.discount_type === 'percent') {
      afterDiscount -= Math.round(subtotal * txDiscount / 100);
    } else {
      afterDiscount -= txDiscount;
    }
  }

  const taxRate = data.tax_rate ?? settings.tax_rate;
  const taxAmount = Math.round(afterDiscount * taxRate / 100);
  const total = afterDiscount + taxAmount;
  const change = data.amount_paid - total;

  const createTx = d.transaction(() => {
    // Cek stok di dalam transaction (cegah race condition)
    for (const item of itemsWithDetails) {
      const currentStock = d.prepare('SELECT stock FROM products WHERE id = ?').get(item.product_id) as any;
      if (!currentStock || currentStock.stock < item.quantity) {
        throw new Error(`Stok ${item.product_name} tidak cukup (tersedia: ${currentStock?.stock || 0}, diminta: ${item.quantity})`);
      }
    }

    d.prepare(`INSERT INTO transactions (id, customer_id, user_id, subtotal, discount, discount_type, tax_rate, tax_amount, total, payment_method, amount_paid, change, notes, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'completed')`).run(
      id, data.customer_id || null, data.user_id, subtotal, txDiscount, data.discount_type || 'amount', taxRate, taxAmount, total, data.payment_method, data.amount_paid, change, data.notes || ''
    );

    const itemStmt = d.prepare('INSERT INTO transaction_items (id, transaction_id, product_id, product_name, price, cost_price, quantity, discount, discount_type, subtotal) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
    for (const item of itemsWithDetails) {
      itemStmt.run(uuidv4(), id, item.product_id, item.product_name, item.price, item.cost_price, item.quantity, item.discount, item.discount_type, item.subtotal);
      d.prepare('UPDATE products SET stock = stock - ?, updated_at = datetime(\'now\') WHERE id = ?').run(item.quantity, item.product_id);
      d.prepare('INSERT INTO stock_history (id, product_id, type, quantity, notes, created_by) VALUES (?, ?, ?, ?, ?, ?)').run(uuidv4(), item.product_id, 'sale', -item.quantity, `Transaksi #${id.slice(0, 8)}`, data.user_id);
    }

    if (data.customer_id) {
      const points = Math.floor(total / 10000);
      d.prepare('UPDATE customers SET points = points + ?, total_spent = total_spent + ?, visit_count = visit_count + 1 WHERE id = ?').run(points, total, data.customer_id);
    }
  });

  createTx();
  return getTransactionById(id);
}

export function voidTransaction(id: string, userId: string) {
  const d = getDb();
  const tx = getTransactionById(id);
  if (!tx || tx.status === 'voided') return null;

  d.transaction(() => {
    d.prepare("UPDATE transactions SET status = 'voided' WHERE id = ?").run(id);
    for (const item of tx.items) {
      d.prepare('UPDATE products SET stock = stock + ?, updated_at = datetime(\'now\') WHERE id = ?').run(item.quantity, item.product_id);
      d.prepare('INSERT INTO stock_history (id, product_id, type, quantity, notes, created_by) VALUES (?, ?, ?, ?, ?, ?)').run(uuidv4(), item.product_id, 'adjustment', item.quantity, `Void transaksi #${id.slice(0, 8)}`, userId);
    }
    if (tx.customer_id) {
      const points = Math.floor(tx.total / 10000);
      d.prepare('UPDATE customers SET points = points - ?, total_spent = total_spent - ?, visit_count = visit_count - 1 WHERE id = ?').run(points, tx.total, tx.customer_id);
    }
  })();

  return getTransactionById(id);
}

// ===== EXPENSES =====
export function getExpenses(limit = 50, offset = 0, category?: string, startDate?: string, endDate?: string) {
  const d = getDb();
  let query = `SELECT e.*, u.name as user_name FROM expenses e JOIN users u ON e.created_by = u.id WHERE 1=1`;
  const params: any[] = [];
  if (category) { query += ' AND e.category = ?'; params.push(category); }
  if (startDate) { query += ' AND e.date >= ?'; params.push(startDate); }
  if (endDate) { query += ' AND e.date <= ?'; params.push(endDate); }
  query += ' ORDER BY e.date DESC, e.created_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);
  return d.prepare(query).all(...params) as any[];
}

export function createExpense(data: any) {
  const d = getDb();
  const id = uuidv4();
  d.prepare('INSERT INTO expenses (id, description, amount, category, date, notes, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)').run(id, data.description, data.amount, data.category || 'Lainnya', data.date, data.notes || '', data.created_by);
  return d.prepare('SELECT e.*, u.name as user_name FROM expenses e JOIN users u ON e.created_by = u.id WHERE e.id = ?').get(id) as any;
}

export function deleteExpense(id: string) {
  getDb().prepare('DELETE FROM expenses WHERE id = ?').run(id);
}

// ===== USERS =====
export function getAllUsers() {
  return getDb().prepare('SELECT id, name, email, role, created_at FROM users ORDER BY name').all() as any[];
}

export function getUserById(id: string) {
  return getDb().prepare('SELECT id, name, email, role, created_at FROM users WHERE id = ?').get(id) as any;
}

export function getUserByEmail(email: string) {
  return getDb().prepare('SELECT * FROM users WHERE email = ?').get(email) as any;
}

export function createUser(data: any) {
  const d = getDb();
  const id = uuidv4();
  const hashed = bcrypt.hashSync(data.password, 10);
  d.prepare('INSERT INTO users (id, name, email, password, role) VALUES (?, ?, ?, ?, ?)').run(id, data.name, data.email, hashed, data.role || 'KASIR');
  return getUserById(id);
}

export function updateUser(id: string, data: any) {
  const d = getDb();
  if (data.password) {
    const hashed = bcrypt.hashSync(data.password, 10);
    d.prepare('UPDATE users SET name=?, email=?, password=?, role=? WHERE id=?').run(data.name, data.email, hashed, data.role, id);
  } else {
    d.prepare('UPDATE users SET name=?, email=?, role=? WHERE id=?').run(data.name, data.email, data.role, id);
  }
  return getUserById(id);
}

export function deleteUser(id: string) {
  getDb().prepare('DELETE FROM users WHERE id = ?').run(id);
}

// ===== SETTINGS =====
export function getSettings() {
  const d = getDb();
  let settings = d.prepare('SELECT * FROM settings WHERE id = ?').get('default') as any;
  if (!settings) {
    d.prepare('INSERT INTO settings (id) VALUES (?)').run('default');
    settings = d.prepare('SELECT * FROM settings WHERE id = ?').get('default') as any;
  }
  return settings;
}

export function updateSettings(data: any) {
  const d = getDb();
  d.prepare('UPDATE settings SET store_name=?, store_address=?, store_phone=?, tax_rate=?, receipt_footer=?, low_stock_threshold=? WHERE id=?').run(data.store_name, data.store_address || '', data.store_phone || '', data.tax_rate, data.receipt_footer || '', data.low_stock_threshold || 5, 'default');
  return getSettings();
}

// ===== STOCK HISTORY =====
export function getStockHistory(productId?: string, limit = 50) {
  const d = getDb();
  let query = `SELECT sh.*, p.name as product_name, u.name as user_name FROM stock_history sh
    JOIN products p ON sh.product_id = p.id
    JOIN users u ON sh.created_by = u.id WHERE 1=1`;
  const params: any[] = [];
  if (productId) { query += ' AND sh.product_id = ?'; params.push(productId); }
  query += ' ORDER BY sh.created_at DESC LIMIT ?';
  params.push(limit);
  return d.prepare(query).all(...params) as any[];
}

// ===== DASHBOARD =====
export function getDashboardStats(userId?: string, userRole?: string) {
  const d = getDb();
  const today = new Date().toISOString().split('T')[0];

  const todayStats = d.prepare(`
    SELECT COALESCE(SUM(total), 0) as sales, COUNT(*) as count
    FROM transactions WHERE date(created_at) = date(?) AND status = 'completed'
  `).get(today) as any;

  const todayProfit = d.prepare(`
    SELECT COALESCE(SUM(ti.subtotal - (ti.cost_price * ti.quantity)), 0) as profit
    FROM transaction_items ti JOIN transactions t ON ti.transaction_id = t.id
    WHERE date(t.created_at) = date(?) AND t.status = 'completed'
  `).get(today) as any;

  const todayCustomers = d.prepare(`
    SELECT COUNT(DISTINCT customer_id) as count FROM transactions
    WHERE date(created_at) = date(?) AND status = 'completed' AND customer_id IS NOT NULL
  `).get(today) as any;

  const totalProducts = d.prepare('SELECT COUNT(*) as count FROM products').get() as any;
  const lowStock = d.prepare('SELECT COUNT(*) as count FROM products WHERE stock <= min_stock').get() as any;

  const recentTransactions = d.prepare(`
    SELECT t.*, c.name as customer_name, u.name as user_name FROM transactions t
    LEFT JOIN customers c ON t.customer_id = c.id JOIN users u ON t.user_id = u.id
    ORDER BY t.created_at DESC LIMIT 5
  `).all() as any[];
  for (const t of recentTransactions) {
    t.items = d.prepare('SELECT * FROM transaction_items WHERE transaction_id = ?').all(t.id) as any[];
  }

  const topProducts = d.prepare(`
    SELECT ti.product_name as name, SUM(ti.quantity) as quantity, SUM(ti.subtotal) as revenue
    FROM transaction_items ti JOIN transactions t ON ti.transaction_id = t.id
    WHERE date(t.created_at) = date(?) AND t.status = 'completed'
    GROUP BY ti.product_id ORDER BY quantity DESC LIMIT 5
  `).all(today) as any[];

  const salesChart: any[] = [];
  for (let i = 6; i >= 0; i--) {
    const d2 = new Date();
    d2.setDate(d2.getDate() - i);
    const dateStr = d2.toISOString().split('T')[0];
    const dayStats = d.prepare(`
      SELECT COALESCE(SUM(total), 0) as sales FROM transactions
      WHERE date(created_at) = date(?) AND status = 'completed'
    `).get(dateStr) as any;
    salesChart.push({ date: dateStr, sales: dayStats.sales });
  }

  const categoryChart = d.prepare(`
    SELECT p.category, SUM(ti.subtotal) as total FROM transaction_items ti
    JOIN transactions t ON ti.transaction_id = t.id
    JOIN products p ON ti.product_id = p.id
    WHERE date(t.created_at) = date(?) AND t.status = 'completed'
    GROUP BY p.category ORDER BY total DESC
  `).all(today) as any[];

  return {
    todaySales: todayStats.sales,
    todayProfit: todayProfit.profit,
    todayTransactions: todayStats.count,
    todayCustomers: todayCustomers.count,
    totalProducts: totalProducts.count,
    lowStockCount: lowStock.count,
    recentTransactions,
    topProducts,
    salesChart,
    categoryChart,
  };
}

// ===== REPORTS =====
export function getSalesReport(startDate: string, endDate: string) {
  const d = getDb();
  const summary = d.prepare(`
    SELECT COUNT(*) as totalTransactions, COALESCE(SUM(total), 0) as totalSales,
    COALESCE(SUM(change), 0) as totalChange FROM transactions
    WHERE date(created_at) BETWEEN ? AND ? AND status = 'completed'
  `).get(startDate, endDate) as any;

  const profit = d.prepare(`
    SELECT COALESCE(SUM(ti.subtotal - (ti.cost_price * ti.quantity)), 0) as totalProfit
    FROM transaction_items ti JOIN transactions t ON ti.transaction_id = t.id
    WHERE date(t.created_at) BETWEEN ? AND ? AND t.status = 'completed'
  `).get(startDate, endDate) as any;

  const dailySales = d.prepare(`
    SELECT date(created_at) as date, COUNT(*) as transactions, SUM(total) as sales
    FROM transactions WHERE date(created_at) BETWEEN ? AND ? AND status = 'completed'
    GROUP BY date(created_at) ORDER BY date
  `).all(startDate, endDate) as any[];

  const topProducts = d.prepare(`
    SELECT ti.product_name as name, SUM(ti.quantity) as quantity, SUM(ti.subtotal) as revenue
    FROM transaction_items ti JOIN transactions t ON ti.transaction_id = t.id
    WHERE date(t.created_at) BETWEEN ? AND ? AND t.status = 'completed'
    GROUP BY ti.product_id ORDER BY revenue DESC LIMIT 10
  `).all(startDate, endDate) as any[];

  const byPayment = d.prepare(`
    SELECT payment_method, COUNT(*) as count, SUM(total) as total
    FROM transactions WHERE date(created_at) BETWEEN ? AND ? AND status = 'completed'
    GROUP BY payment_method
  `).all(startDate, endDate) as any[];

  const totalExpenses = d.prepare(`
    SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE date BETWEEN ? AND ?
  `).get(startDate, endDate) as any;

  return {
    summary: { ...summary, totalProfit: profit.totalProfit, totalExpenses: totalExpenses.total, netProfit: profit.totalProfit - totalExpenses.total },
    dailySales,
    topProducts,
    byPayment,
  };
}

export function getCategories() {
  return getDb().prepare('SELECT DISTINCT category FROM products ORDER BY category').all() as { category: string }[];
}
