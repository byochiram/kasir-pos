import { z } from 'zod';
import { DISCOUNT_TYPES, MANUAL_NONCASH_METHODS, PAYMENT_METHODS, PO_STATUSES, ROLES } from './types';

/** Rupiah selalu bilangan bulat non-negatif — tidak ada sen di aplikasi ini. */
const money = z.number().int('Harus bilangan bulat').min(0, 'Tidak boleh negatif').max(999_999_999_999);
const positiveInt = z.number().int('Harus bilangan bulat').positive('Harus lebih dari 0');
const nonNegativeInt = z.number().int('Harus bilangan bulat').min(0, 'Tidak boleh negatif');

/**
 * Angka dari form HTML sering datang sebagai string. Terima keduanya, tapi tolak
 * string kosong dan NaN alih-alih diam-diam mengubahnya jadi 0.
 */
const numeric = z.preprocess((v) => {
  if (typeof v === 'string') {
    const trimmed = v.trim();
    if (trimmed === '') return undefined;
    const parsed = Number(trimmed);
    return Number.isNaN(parsed) ? v : parsed;
  }
  return v;
}, z.number({ error: 'Harus berupa angka' }));

const shortText = z.string().trim().min(1, 'Wajib diisi').max(200, 'Maksimal 200 karakter');
const longText = z.string().trim().max(1000, 'Maksimal 1000 karakter').default('');
const optionalText = z.string().trim().max(200, 'Maksimal 200 karakter').default('');

/** Email opsional: string kosong dianggap "tidak diisi", bukan email tidak valid. */
const optionalEmail = z.preprocess(
  (v) => (typeof v === 'string' && v.trim() === '' ? '' : v),
  z.union([z.literal(''), z.email('Format email tidak valid').max(200)]),
).default('');

const phone = z
  .string()
  .trim()
  .max(30, 'Maksimal 30 karakter')
  .regex(/^[0-9+\-() ]*$/, 'Nomor telepon hanya boleh angka, spasi, dan + - ( )')
  .default('');

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal harus YYYY-MM-DD')
  .refine((v) => !Number.isNaN(Date.parse(v)), 'Tanggal tidak valid');

const password = z.string().min(6, 'Password minimal 6 karakter').max(200, 'Password terlalu panjang');

// ===== AUTH =====
export const loginSchema = z.object({
  email: z.email('Format email tidak valid'),
  password: z.string().min(1, 'Password wajib diisi'),
});

export const changePasswordSchema = z
  .object({
    current_password: z.string().min(1, 'Password saat ini wajib diisi'),
    new_password: password,
    confirm_password: z.string(),
  })
  .refine((d) => d.new_password === d.confirm_password, {
    message: 'Konfirmasi password tidak cocok',
    path: ['confirm_password'],
  })
  .refine((d) => d.new_password !== d.current_password, {
    message: 'Password baru harus berbeda dari password lama',
    path: ['new_password'],
  });

// ===== USERS =====
export const createUserSchema = z.object({
  name: shortText,
  email: z.email('Format email tidak valid').max(200),
  password,
  role: z.enum(ROLES, { message: 'Role tidak valid' }),
});

export const updateUserSchema = z.object({
  name: shortText,
  email: z.email('Format email tidak valid').max(200),
  /** Kosong berarti "jangan ubah password". */
  password: z.union([z.literal(''), password]).optional(),
  role: z.enum(ROLES, { message: 'Role tidak valid' }),
  is_active: z.boolean().optional(),
});

// ===== PRODUCTS =====
export const productSchema = z
  .object({
    name: shortText,
    price: numeric.pipe(money),
    cost_price: numeric.pipe(money).default(0),
    stock: numeric.pipe(nonNegativeInt).default(0),
    min_stock: numeric.pipe(nonNegativeInt).default(5),
    category: z.string().trim().min(1, 'Kategori wajib diisi').max(50).default('Umum'),
    barcode: z.string().trim().max(50).default(''),
    unit: z.string().trim().max(20).default('pcs'),
  })
  .refine((d) => d.cost_price <= d.price || d.price === 0, {
    message: 'Harga modal tidak boleh lebih besar dari harga jual',
    path: ['cost_price'],
  });

export const stockInSchema = z.object({
  product_id: z.string().min(1, 'Produk wajib dipilih'),
  quantity: numeric.pipe(positiveInt),
  supplier_id: z.string().min(1).nullish(),
  notes: longText,
});

export const stockOutSchema = z.object({
  product_id: z.string().min(1, 'Produk wajib dipilih'),
  quantity: numeric.pipe(positiveInt),
  notes: shortText.max(1000),
});

export const stockAdjustSchema = z.object({
  product_id: z.string().min(1, 'Produk wajib dipilih'),
  /** Hasil hitung fisik (stok opname), bukan selisihnya. */
  new_stock: numeric.pipe(nonNegativeInt),
  notes: shortText.max(1000),
});

// ===== CUSTOMERS / SUPPLIERS =====
export const customerSchema = z.object({
  name: shortText,
  phone,
  email: optionalEmail,
  address: longText,
});

export const supplierSchema = z.object({
  name: shortText,
  phone,
  email: optionalEmail,
  address: longText,
  contact_person: optionalText,
});

export const redeemPointsSchema = z.object({
  points: numeric.pipe(positiveInt),
  notes: longText,
});

// ===== TRANSACTIONS =====
const cartItemSchema = z.object({
  product_id: z.string().min(1),
  quantity: numeric.pipe(positiveInt).refine((v) => v <= 10_000, 'Kuantitas maksimal 10.000'),
  discount: numeric.pipe(nonNegativeInt).default(0),
  discount_type: z.enum(DISCOUNT_TYPES).default('amount'),
});

export const createTransactionSchema = z
  .object({
    items: z.array(cartItemSchema).min(1, 'Keranjang tidak boleh kosong').max(200, 'Maksimal 200 baris item'),
    customer_id: z.string().min(1).nullish(),
    discount: numeric.pipe(nonNegativeInt).default(0),
    discount_type: z.enum(DISCOUNT_TYPES).default('amount'),
    payment_method: z.enum(PAYMENT_METHODS, { message: 'Metode pembayaran tidak valid' }),
    amount_paid: numeric.pipe(money),
    payment_reference: z.string().trim().max(100, 'Maksimal 100 karakter').default(''),
    notes: longText,
  })
  // tax_rate sengaja TIDAK diterima dari client — selalu diambil dari settings server.
  .refine((d) => d.discount_type !== 'percent' || d.discount <= 100, {
    message: 'Diskon persen tidak boleh lebih dari 100%',
    path: ['discount'],
  })
  // Non-tunai manual tidak diverifikasi siapa pun, jadi bukti pembayarannya
  // wajib dicatat agar bisa dicocokkan dengan mutasi bank di akhir hari.
  .refine(
    (d) => !MANUAL_NONCASH_METHODS.includes(d.payment_method) || d.payment_reference.length > 0,
    {
      message: 'Nomor bukti pembayaran wajib diisi untuk metode non-tunai manual',
      path: ['payment_reference'],
    },
  );

export const voidTransactionSchema = z.object({
  reason: z.string({ error: 'Alasan pembatalan wajib diisi' }).trim().min(1, 'Alasan pembatalan wajib diisi').max(500),
});

// ===== PURCHASE ORDER =====
const poItemSchema = z.object({
  product_id: z.string().min(1, 'Produk wajib dipilih'),
  quantity: numeric.pipe(positiveInt).refine((v) => v <= 100_000, 'Kuantitas maksimal 100.000'),
  cost_price: numeric.pipe(money),
});

export const purchaseOrderSchema = z.object({
  supplier_id: z.string().min(1, 'Supplier wajib dipilih'),
  order_date: isoDate,
  expected_date: z.union([z.literal(''), isoDate]).nullish(),
  notes: longText,
  items: z.array(poItemSchema).min(1, 'Minimal satu produk harus dipesan').max(200, 'Maksimal 200 baris item'),
});

export const purchaseOrderStatusSchema = z.object({
  status: z.enum(PO_STATUSES, { message: 'Status tidak valid' }),
});

// ===== EXPENSES =====
export const expenseSchema = z.object({
  description: shortText,
  amount: numeric.pipe(money).refine((v) => v > 0, 'Jumlah harus lebih dari 0'),
  category: z.string().trim().min(1, 'Kategori wajib diisi').max(50).default('Lainnya'),
  date: isoDate,
  notes: longText,
});

// ===== SETTINGS =====
export const settingsSchema = z.object({
  store_name: shortText,
  store_address: longText,
  store_phone: phone,
  store_logo: z.string().trim().max(500).default(''),
  tax_rate: numeric.pipe(z.number().min(0, 'Pajak tidak boleh negatif').max(100, 'Pajak maksimal 100%')),
  receipt_footer: longText,
  low_stock_threshold: numeric.pipe(nonNegativeInt),
  points_per_amount: numeric.pipe(z.number().int().min(0).max(100_000_000)),
  tz_offset_minutes: numeric.pipe(z.number().int().min(-720).max(840)),
});

// ===== QUERY PARAMS =====
export const paginationSchema = z.object({
  limit: numeric.pipe(z.number().int().min(1).max(200)).default(25),
  offset: numeric.pipe(z.number().int().min(0)).default(0),
});

export const dateRangeSchema = z.object({
  startDate: isoDate,
  endDate: isoDate,
}).refine((d) => d.startDate <= d.endDate, {
  message: 'Tanggal awal tidak boleh setelah tanggal akhir',
  path: ['startDate'],
});

/** Ubah ZodError jadi map field -> pesan pertama, untuk ditampilkan di form. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.') || '_';
    if (!(key in out)) out[key] = issue.message;
  }
  return out;
}
