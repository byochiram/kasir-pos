export interface User {
  id: string;
  name: string;
  email: string;
  role: 'ADMIN' | 'KASIR' | 'VIEWER';
  created_at: string;
}

export interface Product {
  id: string;
  name: string;
  price: number;
  cost_price: number;
  stock: number;
  min_stock: number;
  category: string;
  barcode: string;
  created_at: string;
  updated_at: string;
}

export interface CartItem {
  product: Product;
  quantity: number;
  discount: number;
  discount_type: 'amount' | 'percent';
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
}

export interface Supplier {
  id: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  contact_person: string;
  created_at: string;
}

export interface Expense {
  id: string;
  description: string;
  amount: number;
  category: string;
  date: string;
  notes: string;
  created_by: string;
  user_name?: string;
  created_at: string;
}

export interface Transaction {
  id: string;
  customer_id: string | null;
  customer_name: string | null;
  user_id: string;
  user_name: string;
  subtotal: number;
  discount: number;
  discount_type: 'amount' | 'percent';
  tax_rate: number;
  tax_amount: number;
  total: number;
  payment_method: string;
  amount_paid: number;
  change: number;
  notes: string;
  status: 'completed' | 'voided';
  created_at: string;
  items: TransactionItem[];
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
  discount_type: 'amount' | 'percent';
  subtotal: number;
}

export interface StockHistory {
  id: string;
  product_id: string;
  product_name: string;
  type: 'in' | 'out' | 'adjustment' | 'sale';
  quantity: number;
  notes: string;
  created_by: string;
  user_name?: string;
  created_at: string;
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
}

export interface DashboardStats {
  todaySales: number;
  todayProfit: number;
  todayTransactions: number;
  todayCustomers: number;
  totalProducts: number;
  lowStockCount: number;
  recentTransactions: Transaction[];
  topProducts: { name: string; quantity: number; revenue: number }[];
  salesChart: { date: string; sales: number; profit: number }[];
  categoryChart: { category: string; total: number }[];
}
