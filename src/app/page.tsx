'use client';

import Link from 'next/link';
import { useFetch } from '@/hooks/useFetch';
import { formatChartDay, formatDateTime, formatNumber, formatRupiah, formatRupiahShort } from '@/lib/format';
import { useApp } from '@/components/AppProvider';
import PageHeader from '@/components/PageHeader';
import Button from '@/components/ui/Button';
import BarChart from '@/components/charts/BarChart';
import { EmptyState, ErrorState, PageLoader } from '@/components/ui/States';
import type { DashboardStats, Product } from '@/lib/types';

const SERIES_SALES = 'var(--chart-1)';
const SERIES_PROFIT = 'var(--chart-2)';

export default function DashboardPage() {
  const { user, isAdmin, tzOffset } = useApp();
  const { data: stats, error, loading, reload } = useFetch<DashboardStats>('/api/dashboard');
  // Daftar produk menipis hanya diambil kalau memang ada yang perlu direstock.
  const { data: lowStockData } = useFetch<Product[]>(
    isAdmin && stats && stats.lowStockCount > 0 ? '/api/products/low-stock' : null,
  );
  const lowStock = lowStockData ?? [];

  function reloadAll() {
    reload();
  }

  if (loading) return <PageLoader label="Memuat dashboard..." />;
  if (error || !stats) return <ErrorState message={error ?? 'Data dashboard tidak tersedia'} onRetry={reloadAll} />;

  const chartLabels = stats.salesChart.map((day) => formatChartDay(day.date));
  const chartSeries = [
    { key: 'sales', label: 'Omzet', color: SERIES_SALES, values: stats.salesChart.map((d) => d.sales) },
    ...(stats.canSeeProfit
      ? [{ key: 'profit', label: 'Laba Kotor', color: SERIES_PROFIT, values: stats.salesChart.map((d) => d.profit) }]
      : []),
  ];

  const maxCategory = Math.max(1, ...stats.categoryChart.map((c) => c.total));

  return (
    <>
      <PageHeader
        title={`Halo, ${user?.name ?? 'Kasir'}`}
        description={
          stats.scopedToSelf
            ? 'Ringkasan penjualan Anda hari ini'
            : 'Ringkasan penjualan seluruh toko hari ini'
        }
        actions={
          <>
            <Button variant="secondary" onClick={reloadAll}>
              ↻ Segarkan
            </Button>
            <Link href="/cashier">
              <Button>Buka Kasir</Button>
            </Link>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Omzet Hari Ini" value={formatRupiah(stats.todaySales)} icon="💰" tone="emerald" />
        <StatCard label="Transaksi" value={`${formatNumber(stats.todayTransactions)}`} icon="🧾" tone="sky" />
        {stats.canSeeProfit ? (
          <StatCard label="Laba Kotor" value={formatRupiah(stats.todayProfit)} icon="📈" tone="violet" />
        ) : (
          <StatCard label="Pelanggan" value={formatNumber(stats.todayCustomers)} icon="👥" tone="violet" />
        )}
        <StatCard
          label="Stok Menipis"
          value={formatNumber(stats.lowStockCount)}
          icon="⚠️"
          tone={stats.lowStockCount > 0 ? 'amber' : 'slate'}
          href="/products?lowStock=true"
        />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <section className="rounded-2xl border border-line bg-surface p-4 shadow-sm lg:col-span-2">
          <h2 className="mb-3 font-bold text-ink">Penjualan 7 Hari Terakhir</h2>
          <BarChart
            labels={chartLabels}
            series={chartSeries}
            formatValue={formatRupiah}
            emptyLabel="Belum ada penjualan minggu ini"
          />
        </section>

        <section className="rounded-2xl border border-line bg-surface p-4 shadow-sm">
          <h2 className="mb-3 font-bold text-ink">Omzet per Kategori</h2>
          {stats.categoryChart.length === 0 ? (
            <p className="py-8 text-center text-sm text-ink-subtle">Belum ada penjualan hari ini</p>
          ) : (
            <ul className="space-y-3">
              {stats.categoryChart.map((category) => (
                <li key={category.category}>
                  <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
                    <span className="truncate text-ink">{category.category}</span>
                    <span className="shrink-0 font-semibold tabular-nums text-ink">
                      {formatRupiahShort(category.total)}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-surface-3">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${Math.max(2, (category.total / maxCategory) * 100)}%`,
                        backgroundColor: SERIES_SALES,
                      }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <section className="overflow-hidden rounded-2xl border border-line bg-surface shadow-sm lg:col-span-2">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <h2 className="font-bold text-ink">Transaksi Terakhir</h2>
            <Link href="/transactions" className="text-xs font-semibold text-emerald-600 dark:text-emerald-300 hover:underline">
              Lihat semua →
            </Link>
          </div>
          {stats.recentTransactions.length === 0 ? (
            <EmptyState icon="🧾" title="Belum ada transaksi" description="Transaksi akan muncul di sini." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-sm">
                <thead className="bg-surface-2 text-left text-xs uppercase tracking-wide text-ink-muted">
                  <tr>
                    <th className="px-4 py-2.5 font-semibold">Invoice</th>
                    <th className="px-4 py-2.5 font-semibold">Waktu</th>
                    <th className="px-4 py-2.5 font-semibold">Pelanggan</th>
                    <th className="px-4 py-2.5 text-right font-semibold">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line-soft">
                  {stats.recentTransactions.map((transaction) => (
                    <tr key={transaction.id} className="hover:bg-surface-2">
                      <td className="px-4 py-2.5 font-mono text-xs text-ink-muted">{transaction.invoice_no}</td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-ink-muted">
                        {formatDateTime(transaction.created_at, tzOffset)}
                      </td>
                      <td className="px-4 py-2.5 text-ink-muted">{transaction.customer_name ?? 'Umum'}</td>
                      <td className="px-4 py-2.5 text-right font-semibold text-ink">
                        {formatRupiah(transaction.total)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="overflow-hidden rounded-2xl border border-line bg-surface shadow-sm">
          <div className="border-b border-line px-4 py-3">
            <h2 className="font-bold text-ink">
              {stats.lowStockCount > 0 ? 'Perlu Restock' : 'Terlaris Hari Ini'}
            </h2>
          </div>
          {stats.lowStockCount > 0 && isAdmin ? (
            <ul className="divide-y divide-line-soft">
              {lowStock.slice(0, 6).map((product) => (
                <li key={product.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <span className="min-w-0 truncate text-sm text-ink">{product.name}</span>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${
                      product.stock <= 0 ? 'bg-red-50 dark:bg-red-500/15 text-red-600 dark:text-red-300' : 'bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300'
                    }`}
                  >
                    {product.stock} {product.unit}
                  </span>
                </li>
              ))}
              <li className="px-4 py-2.5">
                <Link href="/products" className="text-xs font-semibold text-emerald-600 dark:text-emerald-300 hover:underline">
                  Kelola stok →
                </Link>
              </li>
            </ul>
          ) : stats.topProducts.length === 0 ? (
            <EmptyState icon="🏆" title="Belum ada penjualan" />
          ) : (
            <ul className="divide-y divide-line-soft">
              {stats.topProducts.map((product, index) => (
                <li key={product.product_id} className="flex items-center gap-3 px-4 py-2.5">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface-3 text-xs font-bold text-ink-muted">
                    {index + 1}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm text-ink">{product.name}</span>
                  <span className="shrink-0 text-xs font-semibold text-ink-muted">
                    {formatNumber(product.quantity)} terjual
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}

const TONES = {
  emerald: 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  sky: 'bg-sky-50 dark:bg-sky-500/15 text-sky-700 dark:text-sky-300',
  violet: 'bg-violet-50 dark:bg-violet-500/15 text-violet-700 dark:text-violet-300',
  amber: 'bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300',
  slate: 'bg-surface-3 text-ink-muted',
} as const;

function StatCard({
  label,
  value,
  icon,
  tone,
  href,
}: {
  label: string;
  value: string;
  icon: string;
  tone: keyof typeof TONES;
  href?: string;
}) {
  const content = (
    <div className="flex h-full items-start gap-3 rounded-2xl border border-line bg-surface p-3.5 shadow-sm transition-shadow hover:shadow-md sm:p-4">
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-base ${TONES[tone]}`} aria-hidden>
        {icon}
      </span>
      <div className="min-w-0">
        <p className="truncate text-xs text-ink-muted">{label}</p>
        {/* break-words mencegah angka rupiah panjang terpotong di layar kecil. */}
        <p className="mt-0.5 break-words text-base font-bold text-ink sm:text-lg">{value}</p>
      </div>
    </div>
  );

  return href ? (
    <Link href={href} className="block">
      {content}
    </Link>
  ) : (
    content
  );
}
