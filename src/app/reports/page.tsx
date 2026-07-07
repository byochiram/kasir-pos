'use client';

import { useState, useEffect, useCallback } from 'react';

function formatRupiah(amount: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);
}

function toDateString(d: Date) {
  return d.toISOString().split('T')[0];
}

interface DailySale {
  date: string;
  transactions: number;
  sales: number;
}

interface TopProduct {
  name: string;
  quantity: number;
  revenue: number;
}

interface PaymentBreakdown {
  payment_method: string;
  count: number;
  total: number;
}

interface ReportData {
  summary: {
    totalSales: number;
    totalProfit: number;
    totalExpenses: number;
    netProfit: number;
    totalTransactions: number;
  };
  dailySales: DailySale[];
  topProducts: TopProduct[];
  byPayment: PaymentBreakdown[];
}

const summaryCards = [
  { key: 'totalSales', label: 'Total Penjualan', icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z', bg: 'bg-emerald-50', text: 'text-emerald-600', iconBg: 'bg-emerald-100' },
  { key: 'totalProfit', label: 'Total Laba', icon: 'M13 7h8m0 0v8m0-8l-8 8-4-4-6 6', bg: 'bg-emerald-50', text: 'text-emerald-600', iconBg: 'bg-emerald-100' },
  { key: 'totalExpenses', label: 'Total Pengeluaran', icon: 'M13 17h8m0 0V9m0 8l-8-8-4 4-6-6', bg: 'bg-orange-50', text: 'text-orange-600', iconBg: 'bg-orange-100' },
  { key: 'netProfit', label: 'Laba Bersih', icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z', bg: 'bg-teal-50', text: 'text-teal-600', iconBg: 'bg-teal-100' },
  { key: 'totalTransactions', label: 'Transaksi', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2', bg: 'bg-purple-50', text: 'text-purple-600', iconBg: 'bg-purple-100' },
];

export default function ReportsPage() {
  const today = new Date();
  const [startDate, setStartDate] = useState(toDateString(today));
  const [endDate, setEndDate] = useState(toDateString(today));
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [quickActive, setQuickActive] = useState<number>(1);

  const setQuickRange = (days: number) => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - days + 1);
    setStartDate(toDateString(start));
    setEndDate(toDateString(end));
    setQuickActive(days);
  };

  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/reports?startDate=${startDate}&endDate=${endDate}`);
      const json = await res.json();
      setData(json);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const summary = data?.summary;
  const dailySales = data?.dailySales || [];
  const topProducts = data?.topProducts || [];
  const byPayment = data?.byPayment || [];

  return (
    <div className="p-6 lg:p-8 max-w-full">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Laporan Penjualan</h1>
        <p className="text-slate-500 mt-1">Analisis penjualan dan performa bisnis</p>
      </div>

      <div className="flex flex-wrap items-end gap-3 mb-8">
        <div>
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Dari</label>
          <input type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); setQuickActive(0); }} className="border border-slate-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Sampai</label>
          <input type="date" value={endDate} onChange={(e) => { setEndDate(e.target.value); setQuickActive(0); }} className="border border-slate-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all" />
        </div>
        <div className="flex gap-2">
          {[
            { days: 1, label: 'Hari Ini' },
            { days: 7, label: '7 Hari' },
            { days: 30, label: '30 Hari' },
          ].map((q) => (
            <button
              key={q.days}
              onClick={() => setQuickRange(q.days)}
              className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                quickActive === q.days
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              {q.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-12">
          <div className="flex flex-col items-center justify-center text-slate-400">
            <div className="w-8 h-8 border-2 border-slate-200 border-t-emerald-600 rounded-full animate-spin mb-3" />
            Memuat laporan...
          </div>
        </div>
      ) : !data ? (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-12">
          <div className="flex flex-col items-center justify-center text-slate-400">
            <svg className="w-10 h-10 text-slate-300 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            <span>Gagal memuat laporan</span>
          </div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
            {summaryCards.map((card) => {
              const value = card.key === 'totalTransactions'
                ? String(summary?.totalTransactions || 0)
                : formatRupiah((summary as any)?.[card.key] || 0);
              return (
                <div key={card.key} className={`${card.bg} rounded-2xl p-5 border border-slate-200/40`}>
                  <div className="flex items-center gap-3 mb-3">
                    <div className={`${card.iconBg} w-9 h-9 rounded-xl flex items-center justify-center`}>
                      <svg className={`w-5 h-5 ${card.text}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={card.icon} /></svg>
                    </div>
                  </div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{card.label}</p>
                  <p className={`text-xl font-bold ${card.text} mt-1`}>{value}</p>
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
                <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                <h3 className="font-semibold text-slate-900">Penjualan Harian</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Tanggal</th>
                      <th className="px-6 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider">Transaksi</th>
                      <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Penjualan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {dailySales.length === 0 ? (
                      <tr><td colSpan={3} className="px-6 py-8 text-center text-slate-400">Tidak ada data</td></tr>
                    ) : (
                      dailySales.map((day, i) => (
                        <tr key={i} className="hover:bg-slate-50 transition-colors">
                          <td className="px-6 py-3 text-slate-600">{day.date}</td>
                          <td className="px-6 py-3 text-center text-slate-600">{day.transactions}</td>
                          <td className="px-6 py-3 text-right font-medium text-slate-900">{formatRupiah(day.sales)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
                <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" /></svg>
                <h3 className="font-semibold text-slate-900">Produk Terlaris</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">#</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Nama</th>
                      <th className="px-6 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider">Qty</th>
                      <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Revenue</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {topProducts.length === 0 ? (
                      <tr><td colSpan={4} className="px-6 py-8 text-center text-slate-400">Tidak ada data</td></tr>
                    ) : (
                      topProducts.map((p, i) => (
                        <tr key={i} className="hover:bg-slate-50 transition-colors">
                          <td className="px-6 py-3">
                            <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                              i === 0 ? 'bg-amber-100 text-amber-700' : i === 1 ? 'bg-slate-200 text-slate-600' : i === 2 ? 'bg-orange-100 text-orange-700' : 'bg-slate-50 text-slate-500'
                            }`}>{i + 1}</span>
                          </td>
                          <td className="px-6 py-3 font-medium text-slate-900">{p.name}</td>
                          <td className="px-6 py-3 text-center text-slate-600">{p.quantity}</td>
                          <td className="px-6 py-3 text-right font-medium text-slate-900">{formatRupiah(p.revenue)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
              <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>
              <h3 className="font-semibold text-slate-900">Metode Pembayaran</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Metode</th>
                    <th className="px-6 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider">Jumlah</th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {byPayment.length === 0 ? (
                    <tr><td colSpan={3} className="px-6 py-8 text-center text-slate-400">Tidak ada data</td></tr>
                  ) : (
                    byPayment.map((pm, i) => (
                      <tr key={i} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-3">
                          <span className="inline-flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full ${pm.payment_method === 'cash' ? 'bg-emerald-500' : pm.payment_method === 'card' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                            <span className="font-medium text-slate-900 capitalize">{pm.payment_method}</span>
                          </span>
                        </td>
                        <td className="px-6 py-3 text-center text-slate-600">{pm.count}</td>
                        <td className="px-6 py-3 text-right font-medium text-slate-900">{formatRupiah(pm.total)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
