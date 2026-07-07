'use client';

import { useEffect, useState, useRef } from 'react';

interface Product {
  id: string;
  name: string;
  barcode: string;
  price: number;
  stock: number;
  category: string;
}

interface Customer {
  id: string;
  name: string;
  phone: string;
}

interface CartItem {
  product: Product;
  quantity: number;
  discount: number;
}

interface Settings {
  store_name: string;
  tax_rate: number;
  receipt_footer: string;
}

function formatRupiah(amount: number): string {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);
}

export default function CashierPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [settings, setSettings] = useState<Settings>({ store_name: 'KasirApp', tax_rate: 11, receipt_footer: 'Terima kasih!' });

  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'qris' | 'transfer'>('cash');
  const [amountPaid, setAmountPaid] = useState('');
  const [discountType, setDiscountType] = useState<'amount' | 'percent'>('amount');
  const [trxDiscount, setTrxDiscount] = useState('');
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [receipt, setReceipt] = useState<any>(null);

  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => { fetchData(); }, []);

  async function fetchData() {
    try {
      const [prodRes, catRes, custRes, settRes] = await Promise.all([
        fetch('/api/products'),
        fetch('/api/products?categories=true'),
        fetch('/api/customers'),
        fetch('/api/settings'),
      ]);
      if (prodRes.ok) setProducts(await prodRes.json());
      if (catRes.ok) {
        const cats = await catRes.json();
        setCategories(cats.map((c: any) => c.category));
      }
      if (custRes.ok) setCustomers(await custRes.json());
      if (settRes.ok) setSettings(await settRes.json());
    } catch {} finally { setLoading(false); }
  }

  const filteredProducts = products.filter((p) => {
    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase()) || (p.barcode && p.barcode.toLowerCase().includes(search.toLowerCase()));
    const matchCat = !selectedCategory || p.category === selectedCategory;
    return matchSearch && matchCat;
  });

  function addToCart(product: Product) {
    if (product.stock <= 0) return;
    setCart((prev) => {
      const existing = prev.find((i) => i.product.id === product.id);
      if (existing) {
        if (existing.quantity >= product.stock) return prev;
        return prev.map((i) => i.product.id === product.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, { product, quantity: 1, discount: 0 }];
    });
    setSearch('');
    searchRef.current?.focus();
  }

  function updateQty(id: string, delta: number) {
    setCart((prev) => prev.map((i) => {
      if (i.product.id !== id) return i;
      const nq = i.quantity + delta;
      if (nq <= 0) return null as any;
      if (nq > i.product.stock) return i;
      return { ...i, quantity: nq };
    }).filter(Boolean));
  }

  function removeItem(id: string) { setCart((prev) => prev.filter((i) => i.product.id !== id)); }

  const subtotal = cart.reduce((s, i) => s + i.product.price * i.quantity - i.discount, 0);
  const trxDiscountVal = parseInt(trxDiscount) || 0;
  const discountAmt = discountType === 'percent' ? Math.floor(subtotal * trxDiscountVal / 100) : trxDiscountVal;
  const afterDiscount = Math.max(0, subtotal - discountAmt);
  const taxAmt = Math.floor(afterDiscount * settings.tax_rate / 100);
  const total = afterDiscount + taxAmt;
  const paidNum = parseInt(amountPaid) || 0;
  const change = Math.max(0, paidNum - total);
  const canPay = cart.length > 0 && (paymentMethod !== 'cash' || paidNum >= total) && !processing;

  async function handlePay() {
    if (!canPay) return;
    setProcessing(true);
    try {
      const res = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_id: selectedCustomerId || undefined,
          payment_method: paymentMethod,
          amount_paid: paymentMethod === 'cash' ? paidNum : total,
          discount: discountAmt,
          discount_type: discountType,
          items: cart.map((i) => ({ product_id: i.product.id, quantity: i.quantity, discount: i.discount, discount_type: 'amount' })),
        }),
      });
      if (res.ok) {
        setReceipt(await res.json());
        setCart([]); setAmountPaid(''); setTrxDiscount(''); setSelectedCustomerId('');
        fetchData();
      } else { alert((await res.json()).error || 'Gagal memproses transaksi'); }
    } catch { alert('Gagal memproses transaksi'); } finally { setProcessing(false); }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-screen">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-slate-500 text-sm">Memuat data...</p>
      </div>
    </div>
  );

  return (
    <>
      <style>{`@media print { body * { visibility: hidden; } #receipt-print, #receipt-print * { visibility: visible; } #receipt-print { position: absolute; left: 0; top: 0; width: 80mm; padding: 10px; } }`}</style>
      <div className="flex h-[calc(100vh-2rem)] bg-slate-50 overflow-hidden rounded-2xl border border-slate-200/60 shadow-sm">
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="p-4 bg-white border-b border-slate-200/60 flex gap-3">
            <div className="flex-1 relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
              <input
                ref={searchRef}
                type="text"
                placeholder="Cari produk atau scan barcode..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none text-sm transition-all"
                autoFocus
              />
            </div>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-4 py-2.5 border border-slate-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
            >
              <option value="">Semua Kategori</option>
              {categories.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
              {filteredProducts.map((p) => {
                const inCart = cart.find((c) => c.product.id === p.id);
                return (
                  <button
                    key={p.id}
                    onClick={() => addToCart(p)}
                    disabled={p.stock <= 0}
                    className={`relative bg-white rounded-2xl shadow-sm border p-3.5 text-left transition-all duration-200 ${
                      p.stock <= 0
                        ? 'border-slate-200/60 opacity-50 cursor-not-allowed'
                        : inCart
                          ? 'border-emerald-300 bg-emerald-50/50 shadow-md ring-1 ring-emerald-200'
                          : 'border-slate-200/60 hover:shadow-md hover:border-emerald-200 hover:-translate-y-0.5'
                    }`}
                  >
                    <span className={`absolute top-2 right-2 text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                      p.stock <= 0 ? 'bg-red-50 text-red-600' :
                      p.stock <= 5 ? 'bg-amber-50 text-amber-700' :
                      'bg-emerald-50 text-emerald-700'
                    }`}>
                      {p.stock <= 0 ? 'Habis' : `Stok: ${p.stock}`}
                    </span>
                    <div className="text-sm font-medium text-slate-800 truncate mb-1.5">{p.name}</div>
                    <div className="text-sm font-bold text-emerald-600">{formatRupiah(p.price)}</div>
                    {inCart && (
                      <div className="absolute -top-1.5 -left-1.5 w-6 h-6 bg-emerald-600 text-white rounded-full text-[11px] flex items-center justify-center font-bold shadow-sm">
                        {inCart.quantity}
                      </div>
                    )}
                  </button>
                );
              })}
              {filteredProducts.length === 0 && (
                <div className="col-span-full flex flex-col items-center justify-center py-16 text-slate-400">
                  <div className="text-4xl mb-2">🔍</div>
                  <p className="text-sm">Produk tidak ditemukan</p>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="w-[400px] bg-white border-l border-slate-200/60 flex flex-col h-full">
          <div className="p-4 border-b border-slate-200/60 flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-800">Keranjang</h2>
            <span className="bg-emerald-600 text-white text-xs font-bold px-2.5 py-1 rounded-full">
              {cart.reduce((s, i) => s + i.quantity, 0)} item
            </span>
          </div>

          <div className="flex-1 overflow-y-auto">
            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-400">
                <div className="text-5xl mb-3 opacity-50">🛒</div>
                <p className="font-medium">Keranjang kosong</p>
                <p className="text-xs mt-1">Pilih produk untuk memulai</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {cart.map((item) => (
                  <div key={item.product.id} className="p-3.5 hover:bg-slate-50/50 transition-colors">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-slate-800 truncate">{item.product.name}</div>
                        <div className="text-xs text-slate-500 mt-0.5">{formatRupiah(item.product.price)} × {item.quantity}</div>
                      </div>
                      <button onClick={() => removeItem(item.product.id)} className="text-slate-400 hover:text-red-500 p-1 transition-colors rounded-lg hover:bg-red-50">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => updateQty(item.product.id, -1)} className="w-7 h-7 rounded-lg border border-slate-200 flex items-center justify-center hover:bg-slate-100 text-sm font-bold text-slate-600 transition-colors">−</button>
                      <span className="w-8 text-center text-sm font-semibold text-slate-800">{item.quantity}</span>
                      <button onClick={() => updateQty(item.product.id, 1)} className="w-7 h-7 rounded-lg border border-slate-200 flex items-center justify-center hover:bg-slate-100 text-sm font-bold text-slate-600 transition-colors">+</button>
                      <div className="flex-1" />
                      <div className="text-sm font-semibold text-slate-800">{formatRupiah(item.product.price * item.quantity - item.discount)}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {cart.length > 0 && (
            <div className="border-t border-slate-200/60">
              <div className="p-4 space-y-2.5 bg-slate-50/50">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Subtotal</span>
                  <span className="font-medium text-slate-700">{formatRupiah(subtotal)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-slate-500">Diskon</span>
                  <div className="flex items-center gap-1.5 ml-auto">
                    <button onClick={() => setDiscountType('amount')} className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-all ${discountType === 'amount' ? 'bg-emerald-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>Rp</button>
                    <button onClick={() => setDiscountType('percent')} className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-all ${discountType === 'percent' ? 'bg-emerald-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>%</button>
                    <input type="number" value={trxDiscount} onChange={(e) => setTrxDiscount(e.target.value)} placeholder="0" className="w-24 px-2.5 py-1 text-xs border border-slate-200 rounded-lg text-right focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none" />
                    <span className="text-sm font-medium min-w-[80px] text-right text-red-500">{discountAmt > 0 ? `- ${formatRupiah(discountAmt)}` : '-'}</span>
                  </div>
                </div>
                {settings.tax_rate > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Pajak ({settings.tax_rate}%)</span>
                    <span className="font-medium text-slate-700">{formatRupiah(taxAmt)}</span>
                  </div>
                )}
                <div className="flex justify-between text-lg font-bold border-t border-slate-200 pt-2.5">
                  <span className="text-slate-800">Total</span>
                  <span className="text-emerald-600">{formatRupiah(total)}</span>
                </div>
              </div>

              <div className="px-4 pb-3">
                <select
                  value={selectedCustomerId}
                  onChange={(e) => setSelectedCustomerId(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                >
                  <option value="">Pelanggan Umum</option>
                  {customers.map((c) => <option key={c.id} value={c.id}>{c.name} {c.phone ? `(${c.phone})` : ''}</option>)}
                </select>
              </div>

              <div className="px-4 pb-3">
                <div className="flex gap-2">
                  {([
                    { key: 'cash' as const, label: 'Cash', icon: '💵', activeColor: 'border-emerald-500 bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200' },
                    { key: 'qris' as const, label: 'QRIS', icon: '📱', activeColor: 'border-emerald-500 bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200' },
                    { key: 'transfer' as const, label: 'Transfer', icon: '🏦', activeColor: 'border-violet-500 bg-violet-50 text-violet-700 ring-1 ring-violet-200' },
                  ]).map((m) => (
                    <button
                      key={m.key}
                      onClick={() => setPaymentMethod(m.key)}
                      className={`flex-1 py-2.5 text-sm font-medium rounded-xl border-2 transition-all ${
                        paymentMethod === m.key ? m.activeColor : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      {m.icon} {m.label}
                    </button>
                  ))}
                </div>
              </div>

              {paymentMethod === 'cash' && (
                <div className="px-4 pb-3 space-y-2.5">
                  <input
                    type="number"
                    value={amountPaid}
                    onChange={(e) => setAmountPaid(e.target.value)}
                    placeholder="Jumlah bayar (Rp)"
                    className="w-full px-4 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
                  />
                  <div className="flex gap-2">
                    {[50000, 100000, 200000, 500000].map((a) => (
                      <button
                        key={a}
                        onClick={() => setAmountPaid(String(a))}
                        className="flex-1 py-1.5 text-xs font-semibold bg-slate-100 hover:bg-slate-200 rounded-xl text-slate-700 transition-colors"
                      >
                        {a >= 1000000 ? `${a / 1000000}jt` : `${a / 1000}rb`}
                      </button>
                    ))}
                  </div>
                  {paidNum > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Kembalian</span>
                      <span className={`font-bold ${change >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                        {change >= 0 ? formatRupiah(change) : 'Kurang'}
                      </span>
                    </div>
                  )}
                </div>
              )}

              <div className="p-4 border-t border-slate-200/60">
                <button
                  onClick={handlePay}
                  disabled={!canPay}
                  className={`w-full py-3.5 rounded-xl text-white font-bold text-lg transition-all duration-200 ${
                    canPay
                      ? 'bg-emerald-600 hover:bg-emerald-700 shadow-sm hover:shadow-md active:scale-[0.98]'
                      : 'bg-slate-300 cursor-not-allowed'
                  }`}
                >
                  {processing ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Memproses...
                    </span>
                  ) : 'Bayar'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {receipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm bg-black/40 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-[400px] max-h-[90vh] overflow-y-auto animate-scale-in">
            <div id="receipt-print" className="p-6 font-mono text-sm">
              <div className="text-center mb-4">
                <h2 className="text-lg font-bold text-slate-800">{settings.store_name}</h2>
                <p className="text-xs text-slate-500 mt-1">#{receipt.id?.slice(0, 8)}</p>
                <p className="text-xs text-slate-500">{new Date(receipt.created_at).toLocaleString('id-ID')}</p>
                {receipt.customer_name && <p className="text-xs text-slate-500">Pelanggan: {receipt.customer_name}</p>}
              </div>
              <div className="border-t border-dashed border-slate-300 my-3" />
              <div className="space-y-1.5">
                {receipt.items?.map((item: any, idx: number) => (
                  <div key={idx}>
                    <div className="flex justify-between"><span className="text-slate-700">{item.product_name}</span></div>
                    <div className="flex justify-between text-xs text-slate-500"><span>{item.quantity} × {formatRupiah(item.price)}</span><span>{formatRupiah(item.subtotal)}</span></div>
                  </div>
                ))}
              </div>
              <div className="border-t border-dashed border-slate-300 my-3" />
              <div className="space-y-1.5">
                <div className="flex justify-between"><span className="text-slate-600">Subtotal</span><span>{formatRupiah(receipt.subtotal)}</span></div>
                {receipt.discount > 0 && <div className="flex justify-between text-red-600"><span>Diskon</span><span>-{formatRupiah(receipt.discount)}</span></div>}
                {receipt.tax_amount > 0 && <div className="flex justify-between"><span className="text-slate-600">Pajak ({receipt.tax_rate}%)</span><span>{formatRupiah(receipt.tax_amount)}</span></div>}
                <div className="flex justify-between font-bold text-base border-t border-slate-300 pt-1.5"><span>TOTAL</span><span className="text-emerald-600">{formatRupiah(receipt.total)}</span></div>
              </div>
              <div className="border-t border-dashed border-slate-300 my-3" />
              <div className="space-y-1.5">
                <div className="flex justify-between"><span className="text-slate-600">Bayar</span><span>{receipt.payment_method?.toUpperCase()}</span></div>
                <div className="flex justify-between"><span className="text-slate-600">Dibayar</span><span>{formatRupiah(receipt.amount_paid)}</span></div>
                <div className="flex justify-between"><span className="text-slate-600">Kembalian</span><span>{formatRupiah(receipt.change)}</span></div>
              </div>
              <div className="text-center text-xs text-slate-500 mt-4">{settings.receipt_footer}</div>
            </div>
            <div className="flex gap-3 p-4 border-t border-slate-200/60">
              <button onClick={() => setReceipt(null)} className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 rounded-xl text-slate-700 font-medium transition-colors">Tutup</button>
              <button onClick={() => window.print()} className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-medium transition-colors shadow-sm">🖨️ Cetak Struk</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
