'use client';

import { useMemo, useState } from 'react';
import { qs } from '@/lib/api-client';
import { downloadCsv } from '@/lib/csv';
import { useFetch } from '@/hooks/useFetch';
import { addDays, formatNumber, formatPlainDate, formatRupiah, todayInStore } from '@/lib/format';
import { useApp } from '@/components/AppProvider';
import { useToast } from '@/components/ui/Toast';
import PageHeader from '@/components/PageHeader';
import Button from '@/components/ui/Button';
import BarChart from '@/components/charts/BarChart';
import { ErrorState, PageLoader } from '@/components/ui/States';
import type { SalesReport } from '@/lib/types';

const SERIES_SALES = 'var(--chart-1)';
const SERIES_PROFIT = 'var(--chart-2)';

const PAYMENT_LABELS: Record<string, string> = {
  cash: 'Tunai',
  qris: 'QRIS',
  transfer: 'Transfer',
  debit: 'Debit',
};

const QUICK_RANGES = [
  { label: 'Hari ini', days: 1 },
  { label: '7 hari', days: 7 },
  { label: '30 hari', days: 30 },
  { label: '90 hari', days: 90 },
];

export default function ReportsPage() {
  const { tzOffset } = useApp();
  const toast = useToast();

  // Lazy initializer: tanggal dihitung sekali saat mount, bukan tiap render.
  const [startDate, setStartDate] = useState(() => addDays(todayInStore(tzOffset), -6));
  const [endDate, setEndDate] = useState(() => todayInStore(tzOffset));
  const [activeRange, setActiveRange] = useState<number | null>(7);

  const dateInvalid = startDate > endDate;

  // Debounce supaya mengetik tanggal manual tidak memicu satu request per ketukan.
  const url = useMemo(
    () => (dateInvalid ? null : `/api/reports${qs({ startDate, endDate })}`),
    [startDate, endDate, dateInvalid],
  );
  const { data: report, loading, error, reload } = useFetch<SalesReport>(url, { debounceMs: 400 });

  function setQuickRange(days: number) {
    const today = todayInStore(tzOffset);
    setStartDate(addDays(today, -(days - 1)));
    setEndDate(today);
    setActiveRange(days);
  }

  function exportCsv() {
    if (!report) return;
    const rows: (string | number)[][] = [
      ['Laporan Penjualan', `${startDate} s/d ${endDate}`],
      [],
      ['Ringkasan'],
      ['Total Transaksi', report.summary.totalTransactions],
      ['Total Omzet', report.summary.totalSales],
      ['Laba Kotor', report.summary.totalProfit],
      ['Total Pengeluaran', report.summary.totalExpenses],
      ['Laba Bersih', report.summary.netProfit],
      ['Rata-rata per Transaksi', report.summary.averageTransaction],
      ['Item Terjual', report.summary.totalItemsSold],
      ['Transaksi Dibatalkan', report.summary.voidedCount],
      [],
      ['Penjualan Harian'],
      ['Tanggal', 'Transaksi', 'Omzet', 'Laba Kotor'],
      ...report.dailySales.map((d) => [d.date, d.transactions, d.sales, d.profit]),
      [],
      ['Produk Terlaris'],
      ['Produk', 'Qty Terjual', 'Omzet', 'Laba'],
      ...report.topProducts.map((p) => [p.name, p.quantity, p.revenue, p.profit]),
      [],
      ['Metode Pembayaran'],
      ['Metode', 'Jumlah Transaksi', 'Total'],
      ...report.byPayment.map((p) => [PAYMENT_LABELS[p.payment_method] ?? p.payment_method, p.count, p.total]),
      [],
      ['Pengeluaran per Kategori'],
      ['Kategori', 'Total'],
      ...report.expensesByCategory.map((e) => [e.category, e.total]),
    ];
    downloadCsv(`laporan-${startDate}-sd-${endDate}.csv`, rows);
    toast.success('Laporan diunduh sebagai CSV');
  }

  return (
    <>
      <PageHeader
        title="Laporan"
        description={`Periode ${formatPlainDate(startDate)} – ${formatPlainDate(endDate)}`}
        actions={
          <>
            {report && (
              <Button variant="secondary" onClick={exportCsv}>
                ⬇ Ekspor CSV
              </Button>
            )}
            <Button variant="secondary" onClick={() => window.print()}>
              🖨️ Cetak
            </Button>
          </>
        }
      />

      <div className="mb-4 rounded-2xl border border-line bg-surface p-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="date"
            value={startDate}
            onChange={(event) => {
              setStartDate(event.target.value);
              setActiveRange(null);
            }}
            aria-label="Tanggal mulai"
            className="min-w-0 flex-1 rounded-xl border border-line px-3 py-2 text-sm outline-none focus:border-emerald-500 sm:flex-none"
          />
          <span className="text-sm text-ink-subtle">s/d</span>
          <input
            type="date"
            value={endDate}
            onChange={(event) => {
              setEndDate(event.target.value);
              setActiveRange(null);
            }}
            aria-label="Tanggal akhir"
            className="min-w-0 flex-1 rounded-xl border border-line px-3 py-2 text-sm outline-none focus:border-emerald-500 sm:flex-none"
          />
          <div className="flex flex-wrap gap-1.5">
            {QUICK_RANGES.map((range) => (
              <button
                key={range.days}
                type="button"
                onClick={() => setQuickRange(range.days)}
                aria-pressed={activeRange === range.days}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                  activeRange === range.days
                    ? 'bg-emerald-600 text-white'
                    : 'bg-surface-3 text-ink-muted hover:bg-line'
                }`}
              >
                {range.label}
              </button>
            ))}
          </div>
        </div>
        {dateInvalid && (
          <p className="mt-2 text-xs font-medium text-red-600 dark:text-red-300">Tanggal mulai tidak boleh setelah tanggal akhir.</p>
        )}
      </div>

      {loading ? (
        <PageLoader label="Menyusun laporan..." />
      ) : error || !report ? (
        <ErrorState message={error ?? 'Laporan tidak tersedia'} onRetry={reload} />
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <SummaryCard label="Total Omzet" value={formatRupiah(report.summary.totalSales)} />
            <SummaryCard label="Laba Kotor" value={formatRupiah(report.summary.totalProfit)} />
            <SummaryCard label="Total Pengeluaran" value={formatRupiah(report.summary.totalExpenses)} tone="negative" />
            <SummaryCard
              label="Laba Bersih"
              value={formatRupiah(report.summary.netProfit)}
              // Rugi harus terlihat merah, bukan hijau seperti untung.
              tone={report.summary.netProfit < 0 ? 'negative' : 'positive'}
              emphasis
            />
          </div>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <SummaryCard label="Transaksi" value={formatNumber(report.summary.totalTransactions)} small />
            <SummaryCard label="Item Terjual" value={formatNumber(report.summary.totalItemsSold)} small />
            <SummaryCard
              label="Rata-rata / Transaksi"
              value={formatRupiah(report.summary.averageTransaction)}
              small
            />
            <SummaryCard
              label="Dibatalkan"
              value={formatNumber(report.summary.voidedCount)}
              tone={report.summary.voidedCount > 0 ? 'negative' : undefined}
              small
            />
          </div>

          <section className="rounded-2xl border border-line bg-surface p-4 shadow-sm">
            <h2 className="mb-3 font-bold text-ink">Tren Penjualan Harian</h2>
            <BarChart
              labels={report.dailySales.map((d) => formatPlainDate(d.date))}
              series={[
                { key: 'sales', label: 'Omzet', color: SERIES_SALES, values: report.dailySales.map((d) => d.sales) },
                { key: 'profit', label: 'Laba Kotor', color: SERIES_PROFIT, values: report.dailySales.map((d) => d.profit) },
              ]}
              formatValue={formatRupiah}
              height={220}
              emptyLabel="Tidak ada penjualan pada periode ini"
            />
          </section>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Panel
              title="Produk Terlaris"
              // Laba per produk dihitung dari harga baris dikurangi modal, tanpa
              // membagi diskon tingkat transaksi. Totalnya bisa sedikit berbeda
              // dari Laba Kotor di ringkasan.
              note="Laba per produk belum memperhitungkan diskon tingkat transaksi"
            >
              {report.topProducts.length === 0 ? (
                <Empty />
              ) : (
                <SimpleTable
                  head={['Produk', 'Qty', 'Omzet', 'Laba']}
                  align={['left', 'right', 'right', 'right']}
                  rows={report.topProducts.map((p) => [
                    p.name,
                    formatNumber(p.quantity),
                    formatRupiah(p.revenue),
                    formatRupiah(p.profit),
                  ])}
                  keyOf={(_, index) => report.topProducts[index].product_id}
                />
              )}
            </Panel>

            <Panel title="Metode Pembayaran">
              {report.byPayment.length === 0 ? (
                <Empty />
              ) : (
                <SimpleTable
                  head={['Metode', 'Transaksi', 'Total']}
                  align={['left', 'right', 'right']}
                  rows={report.byPayment.map((p) => [
                    PAYMENT_LABELS[p.payment_method] ?? p.payment_method,
                    formatNumber(p.count),
                    formatRupiah(p.total),
                  ])}
                  keyOf={(_, index) => report.byPayment[index].payment_method}
                />
              )}
            </Panel>

            <Panel title="Omzet per Kategori">
              {report.byCategory.length === 0 ? (
                <Empty />
              ) : (
                <SimpleTable
                  head={['Kategori', 'Total']}
                  align={['left', 'right']}
                  rows={report.byCategory.map((c) => [c.category, formatRupiah(c.total)])}
                  keyOf={(_, index) => report.byCategory[index].category}
                />
              )}
            </Panel>

            <Panel title="Pengeluaran per Kategori">
              {report.expensesByCategory.length === 0 ? (
                <Empty label="Tidak ada pengeluaran pada periode ini" />
              ) : (
                <SimpleTable
                  head={['Kategori', 'Total']}
                  align={['left', 'right']}
                  rows={report.expensesByCategory.map((c) => [c.category, formatRupiah(c.total)])}
                  keyOf={(_, index) => report.expensesByCategory[index].category}
                />
              )}
            </Panel>
          </div>
        </div>
      )}
    </>
  );
}

function SummaryCard({
  label,
  value,
  tone,
  emphasis = false,
  small = false,
}: {
  label: string;
  value: string;
  tone?: 'positive' | 'negative';
  emphasis?: boolean;
  small?: boolean;
}) {
  const color = tone === 'negative' ? 'text-red-600 dark:text-red-300' : tone === 'positive' ? 'text-emerald-600 dark:text-emerald-300' : 'text-ink';
  return (
    <div
      className={`rounded-2xl border bg-surface p-3.5 shadow-sm sm:p-4 ${
        emphasis ? 'border-emerald-200 dark:border-emerald-500/30 ring-1 ring-emerald-100' : 'border-line'
      }`}
    >
      <p className="truncate text-xs uppercase tracking-wide text-ink-muted">{label}</p>
      <p className={`mt-1 break-words font-bold ${color} ${small ? 'text-base' : 'text-lg sm:text-xl'}`}>{value}</p>
    </div>
  );
}

function Panel({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-line bg-surface shadow-sm">
      <div className="border-b border-line px-4 py-3">
        <h2 className="font-bold text-ink">{title}</h2>
        {note && <p className="mt-0.5 text-xs text-ink-muted">{note}</p>}
      </div>
      {children}
    </section>
  );
}

function Empty({ label = 'Tidak ada data pada periode ini' }: { label?: string }) {
  return <p className="px-4 py-10 text-center text-sm text-ink-subtle">{label}</p>;
}

function SimpleTable({
  head,
  rows,
  align,
  keyOf,
}: {
  head: string[];
  rows: string[][];
  align: ('left' | 'right')[];
  keyOf: (row: string[], index: number) => string;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-surface-2 text-xs uppercase tracking-wide text-ink-muted">
          <tr>
            {head.map((cell, index) => (
              <th
                key={cell}
                className={`px-4 py-2.5 font-semibold ${align[index] === 'right' ? 'text-right' : 'text-left'}`}
              >
                {cell}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line-soft">
          {rows.map((row, rowIndex) => (
            <tr key={keyOf(row, rowIndex)} className="hover:bg-surface-2">
              {row.map((cell, cellIndex) => (
                <td
                  key={cellIndex}
                  className={`px-4 py-2.5 ${
                    align[cellIndex] === 'right' ? 'text-right tabular-nums font-medium text-ink' : 'text-ink-muted'
                  }`}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
