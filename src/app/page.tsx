'use client';

import { useEffect, useState } from 'react';

interface DashboardData {
  todaySales: number;
  todayProfit: number;
  todayTransactions: number;
  todayCustomers: number;
  totalProducts: number;
  lowStockCount: number;
  salesChart: { date: string; sales: number }[];
  categoryChart: { category: string; total: number }[];
  recentTransactions: { id: string; customer_name: string | null; user_name: string; total: number; payment_method: string; created_at: string; items: any[] }[];
  topProducts: { name: string; quantity: number; revenue: number }[];
}

function formatRupiah(amount: number): string {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);
}

const catColors = ['#059669', '#10b981', '#34d399', '#6ee7b7', '#a7f3d0', '#f59e0b', '#ef4444'];

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/dashboard')
      .then((res) => res.json())
      .then((json) => { setData(json); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center h-[60vh]">
      <div className="w-8 h-8 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (!data) return <div className="flex items-center justify-center h-[60vh] text-red-500 text-sm">Gagal memuat data</div>;

  const salesChart = data.salesChart || [];
  const categoryChart = data.categoryChart || [];
  const recentTransactions = data.recentTransactions || [];
  const topProducts = data.topProducts || [];
  const maxSale = Math.max(...salesChart.map((d) => d.sales), 1);
  const maxCategory = Math.max(...categoryChart.map((c) => c.total), 1);

  const statCards = [
    { label: 'Penjualan', value: formatRupiah(data.todaySales), icon: '💰', gradient: 'from-emerald-500 to-emerald-600' },
    { label: 'Laba', value: formatRupiah(data.todayProfit), icon: '📈', gradient: 'from-teal-500 to-teal-600' },
    { label: 'Transaksi', value: String(data.todayTransactions), icon: '🧾', gradient: 'from-green-500 to-green-600' },
    { label: 'Pelanggan', value: String(data.todayCustomers), icon: '👥', gradient: 'from-cyan-500 to-cyan-600' },
    { label: 'Produk', value: String(data.totalProducts), icon: '📦', gradient: 'from-lime-500 to-lime-600' },
    { label: 'Stok Rendah', value: String(data.lowStockCount), icon: '⚠️', gradient: 'from-rose-500 to-rose-600', pulse: data.lowStockCount > 0 },
  ];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-lg font-bold text-slate-900">Dashboard</h1>
        <p className="text-xs text-slate-500 mt-0.5">Ringkasan penjualan hari ini</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        {statCards.map((card, idx) => (
          <div key={card.label} className={`relative overflow-hidden bg-gradient-to-br ${card.gradient} rounded-xl p-4 text-white shadow-sm animate-slide-up ${card.pulse ? 'ring-2 ring-rose-300 ring-offset-1' : ''}`} style={{ animationDelay: `${idx * 50}ms` }}>
            <div className="absolute -top-2 -right-2 text-5xl opacity-10 select-none">{card.icon}</div>
            <div className="relative z-10">
              <div className="text-lg mb-1.5">{card.icon}</div>
              <div className="text-[10px] font-medium opacity-80">{card.label}</div>
              <div className="text-sm font-bold mt-0.5 tracking-tight">{card.value}</div>
            </div>
            {card.pulse && <span className="absolute top-2 right-2 flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" /><span className="relative inline-flex rounded-full h-2 w-2 bg-white" /></span>}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200/60 p-5 animate-slide-up" style={{ animationDelay: '300ms' }}>
          <h2 className="text-sm font-semibold text-slate-800 mb-4">Penjualan 7 Hari Terakhir</h2>
          {salesChart.length === 0 ? <p className="text-slate-400 text-xs text-center py-12">Belum ada data</p> : (
            <div className="flex items-end gap-2 h-44">
              {salesChart.map((day) => {
                const h = maxSale > 0 ? (day.sales / maxSale) * 100 : 0;
                return (
                  <div key={day.date} className="flex-1 flex flex-col items-center gap-1 group">
                    <div className="w-full bg-emerald-400 rounded-t-md transition-all duration-500 hover:bg-emerald-500 cursor-pointer" style={{ height: `${Math.max(h, 3)}%` }} />
                    <div className="text-[9px] text-slate-400 font-medium">{new Date(day.date).toLocaleDateString('id-ID', { weekday: 'short' })}</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200/60 p-5 animate-slide-up" style={{ animationDelay: '350ms' }}>
          <h2 className="text-sm font-semibold text-slate-800 mb-4">Penjualan per Kategori</h2>
          {categoryChart.length === 0 ? <p className="text-slate-400 text-xs text-center py-12">Belum ada data</p> : (
            <div className="space-y-3">
              {categoryChart.map((cat, idx) => {
                const w = maxCategory > 0 ? (cat.total / maxCategory) * 100 : 0;
                return (
                  <div key={cat.category} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-600">{cat.category}</span>
                      <span className="font-medium text-slate-800">{formatRupiah(cat.total)}</span>
                    </div>
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-700" style={{ width: `${w}%`, backgroundColor: catColors[idx % catColors.length] }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-slate-200/60 p-5 animate-slide-up" style={{ animationDelay: '400ms' }}>
          <h2 className="text-sm font-semibold text-slate-800 mb-4">Transaksi Terakhir</h2>
          <div className="overflow-x-auto rounded-lg border border-slate-200/60">
            <table className="w-full text-xs">
              <thead><tr className="bg-slate-50">
                <th className="text-left py-2 px-3 text-slate-500 font-medium">ID</th>
                <th className="text-left py-2 px-3 text-slate-500 font-medium">Pelanggan</th>
                <th className="text-right py-2 px-3 text-slate-500 font-medium">Total</th>
                <th className="text-left py-2 px-3 text-slate-500 font-medium">Bayar</th>
                <th className="text-left py-2 px-3 text-slate-500 font-medium">Waktu</th>
              </tr></thead>
              <tbody className="divide-y divide-slate-100">
                {recentTransactions.map((trx) => (
                  <tr key={trx.id} className="hover:bg-slate-50">
                    <td className="py-2 px-3 font-mono text-slate-500">{trx.id.slice(0, 8)}</td>
                    <td className="py-2 px-3 text-slate-700">{trx.customer_name || 'Umum'}</td>
                    <td className="py-2 px-3 text-right font-semibold text-slate-800">{formatRupiah(trx.total)}</td>
                    <td className="py-2 px-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${trx.payment_method === 'cash' ? 'bg-emerald-50 text-emerald-700' : trx.payment_method === 'qris' ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-600'}`}>{trx.payment_method?.toUpperCase()}</span>
                    </td>
                    <td className="py-2 px-3 text-slate-500">{new Date(trx.created_at).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</td>
                  </tr>
                ))}
                {recentTransactions.length === 0 && <tr><td colSpan={5} className="py-8 text-center text-slate-400">Belum ada transaksi</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200/60 p-5 animate-slide-up" style={{ animationDelay: '450ms' }}>
          <h2 className="text-sm font-semibold text-slate-800 mb-4">Produk Terlaris</h2>
          <div className="space-y-2">
            {topProducts.map((prod, idx) => (
              <div key={idx} className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-slate-50">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white ${idx === 0 ? 'bg-amber-500' : idx === 1 ? 'bg-slate-400' : idx === 2 ? 'bg-amber-700' : 'bg-slate-300'}`}>{idx + 1}</div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-slate-800 truncate">{prod.name}</div>
                  <div className="text-[10px] text-slate-500">{prod.quantity} terjual</div>
                </div>
                <div className="text-xs font-semibold text-slate-700">{formatRupiah(prod.revenue)}</div>
              </div>
            ))}
            {topProducts.length === 0 && <p className="text-slate-400 text-xs text-center py-6">Belum ada data</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
