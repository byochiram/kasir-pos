'use client';

import { useState, useEffect, useCallback } from 'react';

function formatRupiah(amount: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleString('id-ID', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

interface TransactionItem {
  id: string;
  product_name: string;
  price: number;
  quantity: number;
  subtotal: number;
}

interface Transaction {
  id: string;
  customer_name: string | null;
  user_name: string;
  subtotal: number;
  discount: number;
  discount_type: string;
  tax_rate: number;
  tax_amount: number;
  total: number;
  payment_method: string;
  amount_paid: number;
  change: number;
  status: 'completed' | 'voided';
  created_at: string;
  items: TransactionItem[];
}

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [statusFilter, setStatusFilter] = useState('Semua');
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [showConfirmVoid, setShowConfirmVoid] = useState(false);
  const [voidTarget, setVoidTarget] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/transactions');
      const data = await res.json();
      setTransactions(data);
    } catch {
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  const handleVoid = async (id: string) => {
    try {
      await fetch(`/api/transactions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'voided' }),
      });
      setShowConfirmVoid(false);
      setVoidTarget(null);
      fetchTransactions();
    } catch {
      alert('Gagal membatalkan transaksi');
    }
  };

  const openDetail = (tx: Transaction) => {
    setSelectedTx(tx);
    setShowDetail(true);
  };

  const filtered = statusFilter === 'Semua' ? transactions : transactions.filter((t) => t.status === statusFilter);

  return (
    <div className="p-6 lg:p-8 max-w-full">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Riwayat Transaksi</h1>
        <p className="text-slate-500 mt-1">Lihat riwayat semua transaksi penjualan</p>
      </div>

      <div className="mb-6 flex items-center gap-3">
        {['Semua', 'completed', 'voided'].map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              statusFilter === s
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            {s === 'Semua' ? 'Semua' : s === 'completed' ? 'Completed' : 'Voided'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-12">
          <div className="flex flex-col items-center justify-center text-slate-400">
            <div className="w-8 h-8 border-2 border-slate-200 border-t-emerald-600 rounded-full animate-spin mb-3" />
            Memuat data...
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">ID</th>
                  <th className="px-6 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Tanggal</th>
                  <th className="px-6 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Pelanggan</th>
                  <th className="px-6 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Kasir</th>
                  <th className="px-6 py-3.5 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider">Item</th>
                  <th className="px-6 py-3.5 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Subtotal</th>
                  <th className="px-6 py-3.5 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Diskon</th>
                  <th className="px-6 py-3.5 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Pajak</th>
                  <th className="px-6 py-3.5 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Total</th>
                  <th className="px-6 py-3.5 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3.5 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="px-6 py-12 text-center text-slate-400">
                      <div className="flex flex-col items-center gap-2">
                        <svg className="w-10 h-10 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                        <span>Tidak ada transaksi</span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filtered.map((tx) => (
                    <tr key={tx.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 font-mono text-xs text-slate-500">{tx.id.slice(0, 8)}</td>
                      <td className="px-6 py-4 text-slate-600 text-sm whitespace-nowrap">{formatDate(tx.created_at)}</td>
                      <td className="px-6 py-4 text-slate-600">{tx.customer_name || '-'}</td>
                      <td className="px-6 py-4 text-slate-600">{tx.user_name}</td>
                      <td className="px-6 py-4 text-center text-slate-600">{tx.items.length}</td>
                      <td className="px-6 py-4 text-right text-slate-600">{formatRupiah(tx.subtotal)}</td>
                      <td className="px-6 py-4 text-right text-slate-600">{formatRupiah(tx.discount)}</td>
                      <td className="px-6 py-4 text-right text-slate-600">{formatRupiah(tx.tax_amount)}</td>
                      <td className="px-6 py-4 text-right font-semibold text-slate-900">{formatRupiah(tx.total)}</td>
                      <td className="px-6 py-4 text-center">
                        <span className={`inline-flex px-2.5 py-1 rounded-lg text-xs font-semibold ${
                          tx.status === 'completed' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60' : 'bg-red-50 text-red-700 border border-red-200/60'
                        }`}>
                          {tx.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <button onClick={() => openDetail(tx)} className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all" title="Detail">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showDetail && selectedTx && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setShowDetail(false)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto animate-scale-in" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b border-slate-100 px-6 py-4 rounded-t-2xl flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">Detail Transaksi</h2>
              <button onClick={() => setShowDetail(false)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-all">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="p-6 space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-50 rounded-xl p-3">
                  <span className="text-xs text-slate-500 block mb-1">ID Transaksi</span>
                  <span className="font-mono text-sm text-slate-900">{selectedTx.id.slice(0, 8)}</span>
                </div>
                <div className="bg-slate-50 rounded-xl p-3">
                  <span className="text-xs text-slate-500 block mb-1">Tanggal</span>
                  <span className="text-sm text-slate-900">{formatDate(selectedTx.created_at)}</span>
                </div>
                <div className="bg-slate-50 rounded-xl p-3">
                  <span className="text-xs text-slate-500 block mb-1">Pelanggan</span>
                  <span className="text-sm text-slate-900">{selectedTx.customer_name || 'Umum'}</span>
                </div>
                <div className="bg-slate-50 rounded-xl p-3">
                  <span className="text-xs text-slate-500 block mb-1">Kasir</span>
                  <span className="text-sm text-slate-900">{selectedTx.user_name}</span>
                </div>
                <div className="bg-slate-50 rounded-xl p-3">
                  <span className="text-xs text-slate-500 block mb-1">Metode Bayar</span>
                  <span className="text-sm text-slate-900 capitalize">{selectedTx.payment_method}</span>
                </div>
                <div className="bg-slate-50 rounded-xl p-3">
                  <span className="text-xs text-slate-500 block mb-1">Status</span>
                  <span className={`inline-flex px-2 py-0.5 rounded-md text-xs font-semibold ${
                    selectedTx.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                  }`}>{selectedTx.status}</span>
                </div>
              </div>

              <div>
                <h3 className="font-semibold text-slate-900 mb-3">Item Pembelian</h3>
                <div className="border border-slate-200/60 rounded-xl overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500">Produk</th>
                        <th className="px-4 py-2.5 text-center text-xs font-semibold text-slate-500">Qty</th>
                        <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-500">Harga</th>
                        <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-500">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {selectedTx.items.map((item) => (
                        <tr key={item.id}>
                          <td className="px-4 py-2.5 text-slate-900">{item.product_name}</td>
                          <td className="px-4 py-2.5 text-center text-slate-600">{item.quantity}</td>
                          <td className="px-4 py-2.5 text-right text-slate-600">{formatRupiah(item.price)}</td>
                          <td className="px-4 py-2.5 text-right font-medium text-slate-900">{formatRupiah(item.subtotal)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="border-t border-slate-100 pt-4 space-y-2">
                <div className="flex justify-between text-sm"><span className="text-slate-500">Subtotal</span><span className="text-slate-900">{formatRupiah(selectedTx.subtotal)}</span></div>
                <div className="flex justify-between text-sm"><span className="text-slate-500">Diskon</span><span className="text-red-600">-{formatRupiah(selectedTx.discount)}</span></div>
                <div className="flex justify-between text-sm"><span className="text-slate-500">Pajak ({selectedTx.tax_rate}%)</span><span className="text-slate-900">{formatRupiah(selectedTx.tax_amount)}</span></div>
                <div className="flex justify-between font-bold text-base border-t border-slate-100 pt-3"><span className="text-slate-900">Total</span><span className="text-emerald-600">{formatRupiah(selectedTx.total)}</span></div>
                <div className="flex justify-between text-sm"><span className="text-slate-500">Dibayar</span><span className="text-slate-900">{formatRupiah(selectedTx.amount_paid)}</span></div>
                <div className="flex justify-between text-sm"><span className="text-slate-500">Kembalian</span><span className="text-slate-900">{formatRupiah(selectedTx.change)}</span></div>
              </div>

              {selectedTx.status === 'completed' && (
                <button
                  onClick={() => { setVoidTarget(selectedTx.id); setShowConfirmVoid(true); setShowDetail(false); }}
                  className="w-full px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-medium transition-all"
                >
                  Void Transaksi
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {showConfirmVoid && voidTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setShowConfirmVoid(false)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 animate-scale-in" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-center w-12 h-12 bg-red-100 rounded-full mx-auto mb-4">
              <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
            </div>
            <h2 className="text-lg font-bold text-slate-900 text-center mb-2">Konfirmasi Void</h2>
            <p className="text-slate-500 text-center mb-6 text-sm">Apakah Anda yakin ingin membatalkan transaksi ini? Tindakan ini tidak dapat dibatalkan.</p>
            <div className="flex gap-3">
              <button onClick={() => setShowConfirmVoid(false)} className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 font-medium transition-all">
                Batal
              </button>
              <button onClick={() => handleVoid(voidTarget)} className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-medium transition-all">
                Void Transaksi
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
