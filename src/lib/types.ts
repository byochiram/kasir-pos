// ===== ENUM / UNION =====
export const ROLES = ['ADMIN', 'KASIR'] as const;
export type Role = (typeof ROLES)[number];

/** `qris_online` diproses lewat payment gateway; `qris` adalah stiker statis
 *  yang dicatat manual oleh kasir. */
export const PAYMENT_METHODS = ['cash', 'qris', 'qris_online', 'transfer', 'debit'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: 'Tunai',
  qris: 'QRIS (manual)',
  qris_online: 'QRIS',
  transfer: 'Transfer',
  debit: 'Debit',
};

/** Metode yang uangnya dikonfirmasi gateway, bukan dipercaya begitu saja. */
export const GATEWAY_METHODS: readonly PaymentMethod[] = ['qris_online'];

export const PAYMENT_STATUSES = ['unpaid', 'pending', 'paid', 'expired', 'failed'] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const DISCOUNT_TYPES = ['amount', 'percent'] as const;
export type DiscountType = (typeof DISCOUNT_TYPES)[number];

/** `pending` = menunggu dana masuk lewat gateway. Stok sudah dipesan, tapi
 *  transaksi belum dihitung sebagai omzet sampai statusnya `completed`. */
export const TRANSACTION_STATUSES = ['pending', 'completed', 'voided', 'expired'] as const;
export type TransactionStatus = (typeof TRANSACTION_STATUSES)[number];

export const TRANSACTION_STATUS_LABELS: Record<TransactionStatus, string> = {
  pending: 'Menunggu Bayar',
  completed: 'Selesai',
  voided: 'Dibatalkan',
  expired: 'Kedaluwarsa',
};

export const STOCK_MOVEMENT_TYPES = ['in', 'out', 'adjustment', 'sale', 'void'] as const;
export type StockMovementType = (typeof STOCK_MOVEMENT_TYPES)[number];

export const PO_STATUSES = ['draft', 'ordered', 'received', 'cancelled'] as const;
export type PurchaseOrderStatus = (typeof PO_STATUSES)[number];

export const PO_STATUS_LABELS: Record<PurchaseOrderStatus, string> = {
  draft: 'Draft',
  ordered: 'Dipesan',
  received: 'Diterima',
  cancelled: 'Dibatalkan',
};

export const EXPENSE_CATEGORIES = [
  'Operasional',
  'Gaji',
  'Sewa',
  'Listrik & Air',
  'Bahan Baku',
  'Peralatan',
  'Transportasi',
  'Lainnya',
] as const;

// ===== ROW TYPES (bentuk baris di SQLite) =====
export interface UserRow {
  id: string;
  name: string;
  email: string;
  password: string;
  role: Role;
  is_active: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

/** User tanpa hash password — bentuk yang aman dikirim ke client. */
export type PublicUser = Omit<UserRow, 'password' | 'deleted_at'>;

export interface Product {
  id: string;
  name: string;
  price: number;
  cost_price: number;
  stock: number;
  min_stock: number;
  category: string;
  barcode: string;
  unit: string;
  is_active: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  points: number;
  total_spent: number;
  visit_count: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface Supplier {
  id: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  contact_person: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface TransactionItem {
  id: string;
  transaction_id: string;
  product_id: string;
  product_name: string;
  price: number;
  cost_price: number;
  quantity: number;
  discount: number;
  discount_type: DiscountType;
  subtotal: number;
}

export interface Transaction {
  id: string;
  invoice_no: string;
  customer_id: string | null;
  user_id: string;
  subtotal: number;
  discount: number;
  discount_type: DiscountType;
  discount_amount: number;
  tax_rate: number;
  tax_amount: number;
  total: number;
  total_cost: number;
  payment_method: PaymentMethod;
  amount_paid: number;
  change: number;
  notes: string;
  status: TransactionStatus;
  payment_status: PaymentStatus;
  /** order_id yang dikirim ke gateway; sama dengan invoice_no. */
  payment_ref: string | null;
  payment_qr_url: string | null;
  payment_expires_at: string | null;
  paid_at: string | null;
  voided_at: string | null;
  voided_by: string | null;
  void_reason: string | null;
  created_at: string;
}

export interface TransactionWithRelations extends Transaction {
  customer_name: string | null;
  user_name: string;
  voided_by_name?: string | null;
  items: TransactionItem[];
}

export interface StockHistory {
  id: string;
  product_id: string;
  supplier_id: string | null;
  type: StockMovementType;
  quantity: number;
  stock_before: number;
  stock_after: number;
  notes: string;
  created_by: string;
  created_at: string;
}

export interface StockHistoryWithRelations extends StockHistory {
  product_name: string;
  supplier_name: string | null;
  user_name: string;
}

export interface Expense {
  id: string;
  description: string;
  amount: number;
  category: string;
  date: string;
  notes: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface ExpenseWithRelations extends Expense {
  user_name: string;
}

export interface PurchaseOrderItem {
  id: string;
  po_id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  cost_price: number;
  subtotal: number;
}

export interface PurchaseOrder {
  id: string;
  po_no: string;
  supplier_id: string;
  status: PurchaseOrderStatus;
  order_date: string;
  expected_date: string | null;
  received_at: string | null;
  received_by: string | null;
  total: number;
  notes: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface PurchaseOrderWithRelations extends PurchaseOrder {
  supplier_name: string;
  created_by_name: string;
  received_by_name: string | null;
  items: PurchaseOrderItem[];
}

export interface Settings {
  id: string;
  store_name: string;
  store_address: string;
  store_phone: string;
  store_logo: string;
  tax_rate: number;
  receipt_footer: string;
  low_stock_threshold: number;
  points_per_amount: number;
  tz_offset_minutes: number;
  currency: string;
}

// ===== BENTUK RESPONSE API =====
export interface Paginated<T> {
  data: T[];
  total: number;
  limit: number;
  offset: number;
}

export interface SessionPayload {
  id: string;
  name: string;
  email: string;
  role: Role;
}

export interface DailySales {
  date: string;
  transactions: number;
  sales: number;
  profit: number;
}

export interface TopProduct {
  product_id: string;
  name: string;
  quantity: number;
  revenue: number;
  profit: number;
}

export interface CategorySales {
  category: string;
  total: number;
}

export interface PaymentBreakdown {
  payment_method: string;
  count: number;
  total: number;
}

export interface DashboardStats {
  /** false untuk KASIR — angka profit/modal disembunyikan. */
  canSeeProfit: boolean;
  /** true bila statistik hanya mencakup transaksi milik user yang login. */
  scopedToSelf: boolean;
  todaySales: number;
  todayProfit: number;
  todayTransactions: number;
  todayCustomers: number;
  totalProducts: number;
  lowStockCount: number;
  recentTransactions: TransactionWithRelations[];
  topProducts: TopProduct[];
  salesChart: DailySales[];
  categoryChart: CategorySales[];
}

export interface SalesReport {
  summary: {
    totalTransactions: number;
    totalSales: number;
    totalProfit: number;
    totalExpenses: number;
    netProfit: number;
    averageTransaction: number;
    totalItemsSold: number;
    voidedCount: number;
  };
  dailySales: DailySales[];
  topProducts: TopProduct[];
  byPayment: PaymentBreakdown[];
  byCategory: CategorySales[];
  expensesByCategory: { category: string; total: number }[];
}
