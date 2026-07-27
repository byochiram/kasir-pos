'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api, errorMessage, qs } from '@/lib/api-client';
import { useFetch } from '@/hooks/useFetch';
import { formatRupiah } from '@/lib/format';
import { useApp } from '@/components/AppProvider';
import { useToast } from '@/components/ui/Toast';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import Receipt from '@/components/Receipt';
import { TextField } from '@/components/ui/Field';
import { EmptyState, PageLoader } from '@/components/ui/States';
import type { Customer, DiscountType, Paginated, Product, TransactionWithRelations } from '@/lib/types';

interface CartLine {
  productId: string;
  quantity: number;
  discount: number;
  discountType: DiscountType;
}

const PAYMENT_OPTIONS = [
  { key: 'cash', label: 'Tunai', icon: '💵' },
  { key: 'qris', label: 'QRIS', icon: '📱' },
  { key: 'transfer', label: 'Transfer', icon: '🏦' },
  { key: 'debit', label: 'Debit', icon: '💳' },
] as const;

type PaymentKey = (typeof PAYMENT_OPTIONS)[number]['key'];

const QUICK_CASH = [20_000, 50_000, 100_000, 200_000];

/**
 * Perhitungan di bawah ini harus identik dengan createTransaction di src/lib/db.ts
 * (termasuk pembulatannya), supaya total yang dilihat kasir sama persis dengan
 * yang dihitung server.
 */
function lineTotal(price: number, quantity: number, discount: number, type: DiscountType): number {
  const gross = price * quantity;
  const cut = type === 'percent' ? Math.round((gross * discount) / 100) : discount * quantity;
  return Math.max(0, gross - cut);
}

export default function CashierPage() {
  const { settings, tzOffset } = useApp();
  const toast = useToast();

  const [newCustomers, setNewCustomers] = useState<Customer[]>([]);

  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [cart, setCart] = useState<CartLine[]>([]);
  const [customerId, setCustomerId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentKey>('cash');
  const [amountPaid, setAmountPaid] = useState('');
  const [discountType, setDiscountType] = useState<DiscountType>('amount');
  const [discountInput, setDiscountInput] = useState('');
  const [notes, setNotes] = useState('');

  const [processing, setProcessing] = useState(false);
  const [receipt, setReceipt] = useState<TransactionWithRelations | null>(null);
  const [cartOpenMobile, setCartOpenMobile] = useState(false);
  const [newCustomerOpen, setNewCustomerOpen] = useState(false);

  const searchRef = useRef<HTMLInputElement>(null);
  const paidRef = useRef<HTMLInputElement>(null);

  const taxRate = settings?.tax_rate ?? 0;

  const { data: productData, loading: productsLoading, reload: reloadProducts } = useFetch<Paginated<Product>>(
    `/api/products${qs({ limit: 200 })}`,
  );
  const { data: categoryData } = useFetch<string[]>('/api/products/categories');
  const { data: customerData } = useFetch<Paginated<Customer>>(`/api/customers${qs({ limit: 200 })}`);

  const products = useMemo(() => productData?.data ?? [], [productData]);
  const categories = categoryData ?? [];
  // Pelanggan yang baru dibuat dari layar kasir digabung tanpa menunggu refetch.
  const customers = useMemo(
    () =>
      [...(customerData?.data ?? []), ...newCustomers].sort((a, b) => a.name.localeCompare(b.name)),
    [customerData, newCustomers],
  );

  const productById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLowerCase();
    return products.filter((product) => {
      const matchesSearch =
        !query ||
        product.name.toLowerCase().includes(query) ||
        (product.barcode ?? '').toLowerCase().includes(query);
      const matchesCategory = !category || product.category === category;
      return matchesSearch && matchesCategory;
    });
  }, [products, search, category]);

  /** Baris keranjang digabung dengan data produk terkini, bukan snapshot lama. */
  const cartLines = useMemo(
    () =>
      cart
        .map((line) => {
          const product = productById.get(line.productId);
          if (!product) return null;
          return { ...line, product, total: lineTotal(product.price, line.quantity, line.discount, line.discountType) };
        })
        .filter((line): line is NonNullable<typeof line> => line !== null),
    [cart, productById],
  );

  const subtotal = cartLines.reduce((sum, line) => sum + line.total, 0);
  const discountValue = Number.parseInt(discountInput, 10) || 0;
  const discountAmount =
    discountType === 'percent' ? Math.round((subtotal * discountValue) / 100) : Math.min(discountValue, subtotal);
  const afterDiscount = Math.max(0, subtotal - discountAmount);
  const taxAmount = Math.round((afterDiscount * taxRate) / 100);
  const total = afterDiscount + taxAmount;
  const paid = Number.parseInt(amountPaid, 10) || 0;
  const change = paid - total;
  const itemCount = cartLines.reduce((sum, line) => sum + line.quantity, 0);

  const discountTooBig = discountType === 'percent' ? discountValue > 100 : discountValue > subtotal;
  const canPay =
    cartLines.length > 0 && !discountTooBig && !processing && (paymentMethod !== 'cash' || paid >= total);

  const addToCart = useCallback((product: Product) => {
    if (product.stock <= 0) return;
    setCart((prev) => {
      const existing = prev.find((line) => line.productId === product.id);
      if (!existing) return [...prev, { productId: product.id, quantity: 1, discount: 0, discountType: 'amount' }];
      if (existing.quantity >= product.stock) return prev;
      return prev.map((line) =>
        line.productId === product.id ? { ...line, quantity: line.quantity + 1 } : line,
      );
    });
  }, []);

  function setQuantity(productId: string, quantity: number) {
    const product = productById.get(productId);
    if (!product) return;
    if (quantity <= 0) {
      setCart((prev) => prev.filter((line) => line.productId !== productId));
      return;
    }
    const capped = Math.min(quantity, product.stock);
    if (capped < quantity) toast.info(`Stok ${product.name} hanya tersisa ${product.stock}`);
    setCart((prev) => prev.map((line) => (line.productId === productId ? { ...line, quantity: capped } : line)));
  }

  function setLineDiscount(productId: string, discount: number, type: DiscountType) {
    setCart((prev) =>
      prev.map((line) =>
        line.productId === productId ? { ...line, discount: Math.max(0, discount), discountType: type } : line,
      ),
    );
  }

  function resetCart() {
    setCart([]);
    setAmountPaid('');
    setDiscountInput('');
    setCustomerId('');
    setNotes('');
    setPaymentMethod('cash');
  }

  /** Scan barcode: pemindai mengetik cepat lalu menekan Enter. */
  function handleSearchKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    const query = search.trim();
    if (!query) return;

    const exactBarcode = products.find((p) => p.barcode && p.barcode.toLowerCase() === query.toLowerCase());
    const target = exactBarcode ?? (filteredProducts.length === 1 ? filteredProducts[0] : null);

    if (!target) {
      toast.error(`Produk "${query}" tidak ditemukan`);
      return;
    }
    if (target.stock <= 0) {
      toast.error(`${target.name} sedang habis`);
      return;
    }
    addToCart(target);
    setSearch('');
  }

  const handlePay = useCallback(async () => {
    if (!canPay) return;
    setProcessing(true);
    try {
      const transaction = await api.post<TransactionWithRelations>('/api/transactions', {
        items: cart.map((line) => ({
          product_id: line.productId,
          quantity: line.quantity,
          // Nilai diskon dikirim apa adanya bersama tipenya; server yang menghitung
          // nominalnya. Mengirim nominal + tipe "percent" dulu membuat server
          // menghitung ulang nominal itu sebagai persen.
          discount: line.discount,
          discount_type: line.discountType,
        })),
        customer_id: customerId || null,
        discount: discountValue,
        discount_type: discountType,
        payment_method: paymentMethod,
        amount_paid: paymentMethod === 'cash' ? paid : total,
        notes,
      });
      setReceipt(transaction);
      resetCart();
      setCartOpenMobile(false);
      reloadProducts();
      toast.success(`Transaksi ${transaction.invoice_no} berhasil`);
    } catch (error) {
      toast.error(errorMessage(error));
      // Stok bisa saja berubah karena kasir lain; segarkan supaya angkanya benar.
      reloadProducts();
    } finally {
      setProcessing(false);
    }
  }, [
    canPay,
    cart,
    customerId,
    discountValue,
    discountType,
    paymentMethod,
    paid,
    total,
    notes,
    reloadProducts,
    toast,
  ]);

  // Pintasan keyboard: kasir jarang lepas tangan dari keyboard/scanner.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'F2') {
        event.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
      } else if (event.key === 'F4') {
        event.preventDefault();
        if (paymentMethod === 'cash' && paid < total) paidRef.current?.focus();
        else void handlePay();
      } else if (event.key === 'Escape' && !receipt) {
        searchRef.current?.blur();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handlePay, paid, total, paymentMethod, receipt]);

  async function createCustomer(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      const customer = await api.post<Customer>('/api/customers', {
        name: String(form.get('name') ?? ''),
        phone: String(form.get('phone') ?? ''),
        email: '',
        address: '',
      });
      setNewCustomers((prev) => [...prev, customer]);
      setCustomerId(customer.id);
      setNewCustomerOpen(false);
      toast.success(`Pelanggan ${customer.name} ditambahkan`);
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  if (productsLoading) return <PageLoader label="Menyiapkan kasir..." />;

  const cartPanel = (
    <div className="flex h-full flex-col bg-white">
      <div className="flex shrink-0 items-center justify-between border-b border-slate-200/70 px-4 py-3">
        <h2 className="font-bold text-slate-800">Keranjang</h2>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-emerald-600 px-2.5 py-1 text-xs font-bold text-white">
            {itemCount} item
          </span>
          {cartLines.length > 0 && (
            <button
              type="button"
              onClick={resetCart}
              className="rounded-lg px-2 py-1 text-xs font-medium text-slate-500 transition-colors hover:bg-red-50 hover:text-red-600"
            >
              Kosongkan
            </button>
          )}
          <button
            type="button"
            onClick={() => setCartOpenMobile(false)}
            aria-label="Tutup keranjang"
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 lg:hidden"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {cartLines.length === 0 ? (
          <EmptyState icon="🛒" title="Keranjang kosong" description="Pilih produk atau scan barcode untuk memulai." />
        ) : (
          <ul className="divide-y divide-slate-100">
            {cartLines.map((line) => (
              <li key={line.productId} className="p-3.5">
                <div className="mb-2 flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-800">{line.product.name}</p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {formatRupiah(line.product.price)} / {line.product.unit}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setQuantity(line.productId, 0)}
                    aria-label={`Hapus ${line.product.name} dari keranjang`}
                    className="rounded-lg p-1 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setQuantity(line.productId, line.quantity - 1)}
                    aria-label="Kurangi jumlah"
                    className="h-8 w-8 rounded-lg border border-slate-200 text-sm font-bold text-slate-600 transition-colors hover:bg-slate-100"
                  >
                    −
                  </button>
                  <input
                    type="number"
                    min={1}
                    max={line.product.stock}
                    value={line.quantity}
                    onChange={(event) => setQuantity(line.productId, Number.parseInt(event.target.value, 10) || 0)}
                    aria-label={`Jumlah ${line.product.name}`}
                    className="h-8 w-14 rounded-lg border border-slate-200 text-center text-sm font-semibold outline-none focus:border-emerald-500"
                  />
                  <button
                    type="button"
                    onClick={() => setQuantity(line.productId, line.quantity + 1)}
                    disabled={line.quantity >= line.product.stock}
                    aria-label="Tambah jumlah"
                    className="h-8 w-8 rounded-lg border border-slate-200 text-sm font-bold text-slate-600 transition-colors hover:bg-slate-100 disabled:opacity-40"
                  >
                    +
                  </button>
                  <span className="ml-auto text-sm font-semibold text-slate-800">{formatRupiah(line.total)}</span>
                </div>

                <div className="mt-2 flex items-center gap-1.5">
                  <span className="text-[11px] text-slate-500">Diskon</span>
                  <button
                    type="button"
                    onClick={() => setLineDiscount(line.productId, line.discount, 'amount')}
                    className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${
                      line.discountType === 'amount' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    Rp
                  </button>
                  <button
                    type="button"
                    onClick={() => setLineDiscount(line.productId, line.discount, 'percent')}
                    className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${
                      line.discountType === 'percent' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    %
                  </button>
                  <input
                    type="number"
                    min={0}
                    max={line.discountType === 'percent' ? 100 : line.product.price}
                    value={line.discount || ''}
                    placeholder="0"
                    onChange={(event) =>
                      setLineDiscount(line.productId, Number.parseInt(event.target.value, 10) || 0, line.discountType)
                    }
                    aria-label={`Diskon untuk ${line.product.name}`}
                    className="h-7 w-20 rounded-lg border border-slate-200 px-2 text-right text-[11px] outline-none focus:border-emerald-500"
                  />
                  <span className="ml-auto text-[11px] text-slate-400">
                    {line.discountType === 'amount' ? 'per item' : 'per baris'}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {cartLines.length > 0 && (
        <div className="shrink-0 border-t border-slate-200/70">
          <div className="space-y-2 bg-slate-50/70 px-4 py-3 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Subtotal</span>
              <span className="font-medium text-slate-700">{formatRupiah(subtotal)}</span>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-slate-500">Diskon</span>
              <div className="ml-auto flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setDiscountType('amount')}
                  className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors ${
                    discountType === 'amount' ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  Rp
                </button>
                <button
                  type="button"
                  onClick={() => setDiscountType('percent')}
                  className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors ${
                    discountType === 'percent' ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  %
                </button>
                <input
                  type="number"
                  min={0}
                  max={discountType === 'percent' ? 100 : subtotal}
                  value={discountInput}
                  onChange={(event) => setDiscountInput(event.target.value)}
                  placeholder="0"
                  aria-label="Diskon transaksi"
                  aria-invalid={discountTooBig || undefined}
                  className={`h-8 w-24 rounded-lg border px-2 text-right text-xs outline-none ${
                    discountTooBig ? 'border-red-400 bg-red-50' : 'border-slate-200 focus:border-emerald-500'
                  }`}
                />
              </div>
            </div>
            {discountTooBig && (
              <p className="text-right text-xs font-medium text-red-600">
                {discountType === 'percent' ? 'Maksimal 100%' : 'Diskon melebihi subtotal'}
              </p>
            )}
            {discountAmount > 0 && !discountTooBig && (
              <div className="flex justify-between text-red-600">
                <span>Potongan</span>
                <span>-{formatRupiah(discountAmount)}</span>
              </div>
            )}

            {taxRate > 0 && (
              <div className="flex justify-between">
                <span className="text-slate-500">Pajak ({taxRate}%)</span>
                <span className="font-medium text-slate-700">{formatRupiah(taxAmount)}</span>
              </div>
            )}

            <div className="flex justify-between border-t border-slate-200 pt-2 text-lg font-bold">
              <span className="text-slate-800">Total</span>
              <span className="text-emerald-600">{formatRupiah(total)}</span>
            </div>
          </div>

          <div className="space-y-3 px-4 py-3">
            <div className="flex gap-2">
              <select
                value={customerId}
                onChange={(event) => setCustomerId(event.target.value)}
                aria-label="Pilih pelanggan"
                className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-emerald-500"
              >
                <option value="">Pelanggan Umum</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name}
                    {customer.phone ? ` (${customer.phone})` : ''}
                  </option>
                ))}
              </select>
              <Button variant="secondary" size="sm" onClick={() => setNewCustomerOpen(true)} title="Tambah pelanggan">
                +
              </Button>
            </div>

            <div className="grid grid-cols-4 gap-1.5">
              {PAYMENT_OPTIONS.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => setPaymentMethod(option.key)}
                  aria-pressed={paymentMethod === option.key}
                  className={`rounded-xl border-2 py-2 text-xs font-semibold transition-all ${
                    paymentMethod === option.key
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                      : 'border-slate-200 text-slate-600 hover:border-slate-300'
                  }`}
                >
                  <span aria-hidden>{option.icon}</span>
                  <span className="mt-0.5 block">{option.label}</span>
                </button>
              ))}
            </div>

            {paymentMethod === 'cash' && (
              <div className="space-y-2">
                <input
                  ref={paidRef}
                  type="number"
                  min={0}
                  value={amountPaid}
                  onChange={(event) => setAmountPaid(event.target.value)}
                  placeholder="Jumlah uang diterima"
                  aria-label="Jumlah uang diterima"
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                />
                <div className="grid grid-cols-5 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setAmountPaid(String(total))}
                    className="rounded-lg bg-emerald-100 py-1.5 text-[11px] font-bold text-emerald-700 transition-colors hover:bg-emerald-200"
                  >
                    Pas
                  </button>
                  {QUICK_CASH.map((amount) => (
                    <button
                      key={amount}
                      type="button"
                      onClick={() => setAmountPaid(String(amount))}
                      className="rounded-lg bg-slate-100 py-1.5 text-[11px] font-semibold text-slate-700 transition-colors hover:bg-slate-200"
                    >
                      {amount / 1000}rb
                    </button>
                  ))}
                </div>
                {paid > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Kembalian</span>
                    <span className={`font-bold ${change >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                      {change >= 0 ? formatRupiah(change) : `Kurang ${formatRupiah(-change)}`}
                    </span>
                  </div>
                )}
              </div>
            )}

            <Button onClick={handlePay} disabled={!canPay} loading={processing} className="w-full py-3.5 text-base">
              {processing ? 'Memproses...' : `Bayar ${formatRupiah(total)}`}
            </Button>
            <p className="text-center text-[11px] text-slate-400">
              F2 cari produk · F4 bayar
            </p>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="flex h-full gap-0 overflow-hidden lg:gap-4 lg:p-4">
      <section className="flex min-w-0 flex-1 flex-col overflow-hidden bg-slate-50 lg:rounded-2xl lg:border lg:border-slate-200/70 lg:bg-white">
        <div className="flex shrink-0 flex-col gap-2 border-b border-slate-200/70 bg-white p-3 pl-14 sm:flex-row lg:pl-3">
          <div className="relative min-w-0 flex-1">
            <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden>
              🔍
            </span>
            <input
              ref={searchRef}
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onKeyDown={handleSearchKeyDown}
              placeholder="Cari produk atau scan barcode, lalu Enter..."
              aria-label="Cari produk atau scan barcode"
              autoFocus
              className="w-full rounded-xl border border-slate-200 py-2.5 pl-10 pr-4 text-sm outline-none transition-all focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
            />
          </div>
          <select
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            aria-label="Filter kategori"
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-emerald-500"
          >
            <option value="">Semua Kategori</option>
            {categories.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          {filteredProducts.length === 0 ? (
            <EmptyState icon="🔍" title="Produk tidak ditemukan" description="Coba kata kunci atau kategori lain." />
          ) : (
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
              {filteredProducts.map((product) => {
                const inCart = cart.find((line) => line.productId === product.id);
                const out = product.stock <= 0;
                return (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => addToCart(product)}
                    disabled={out}
                    className={`relative rounded-2xl border bg-white p-3 text-left shadow-sm transition-all ${
                      out
                        ? 'cursor-not-allowed border-slate-200 opacity-50'
                        : inCart
                          ? 'border-emerald-300 bg-emerald-50/60 ring-1 ring-emerald-200'
                          : 'border-slate-200/70 hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-md'
                    }`}
                  >
                    <span
                      className={`absolute right-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        out
                          ? 'bg-red-50 text-red-600'
                          : product.stock <= product.min_stock
                            ? 'bg-amber-50 text-amber-700'
                            : 'bg-emerald-50 text-emerald-700'
                      }`}
                    >
                      {out ? 'Habis' : `Stok ${product.stock}`}
                    </span>
                    <p className="mb-1.5 mt-5 line-clamp-2 min-h-[2.5rem] text-sm font-medium text-slate-800">
                      {product.name}
                    </p>
                    <p className="text-sm font-bold text-emerald-600">{formatRupiah(product.price)}</p>
                    {inCart && (
                      <span className="absolute -left-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-emerald-600 text-[11px] font-bold text-white shadow-sm">
                        {inCart.quantity}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* Desktop: panel keranjang menempel di kanan. */}
      <aside className="hidden w-[380px] shrink-0 overflow-hidden rounded-2xl border border-slate-200/70 shadow-sm lg:block">
        {cartPanel}
      </aside>

      {/* Mobile: keranjang jadi bottom sheet supaya grid produk tetap lega. */}
      {cartLines.length > 0 && !cartOpenMobile && (
        <button
          type="button"
          onClick={() => setCartOpenMobile(true)}
          className="fixed bottom-4 left-4 right-4 z-30 flex items-center justify-between rounded-2xl bg-emerald-600 px-5 py-3.5 text-white shadow-lg lg:hidden"
        >
          <span className="font-semibold">{itemCount} item di keranjang</span>
          <span className="font-bold">{formatRupiah(total)}</span>
        </button>
      )}

      {cartOpenMobile && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="animate-fade-in absolute inset-0 bg-slate-900/50"
            onClick={() => setCartOpenMobile(false)}
            aria-hidden
          />
          <div className="animate-slide-up absolute inset-x-0 bottom-0 top-12 overflow-hidden rounded-t-2xl shadow-2xl">
            {cartPanel}
          </div>
        </div>
      )}

      <Modal
        open={receipt !== null}
        title="Pembayaran berhasil"
        description={receipt?.invoice_no}
        size="sm"
        onClose={() => setReceipt(null)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setReceipt(null)}>
              Tutup
            </Button>
            <Button onClick={() => window.print()}>🖨️ Cetak Struk</Button>
          </>
        }
      >
        {receipt && <Receipt transaction={receipt} settings={settings} tzOffset={tzOffset} />}
      </Modal>

      <Modal
        open={newCustomerOpen}
        title="Pelanggan Baru"
        size="sm"
        onClose={() => setNewCustomerOpen(false)}
        disableBackdropClose
      >
        <form id="quick-customer" onSubmit={createCustomer} className="space-y-4">
          <TextField label="Nama" name="name" required maxLength={200} placeholder="Nama pelanggan" />
          <TextField label="No. Telepon" name="phone" inputMode="tel" placeholder="08xxxxxxxxxx" />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setNewCustomerOpen(false)}>
              Batal
            </Button>
            <Button type="submit">Simpan</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
