'use client';

import { useMemo, useState } from 'react';
import { api, errorMessage, qs } from '@/lib/api-client';
import { downloadCsv } from '@/lib/csv';
import { formatDateTime, formatNumber, formatRupiah, todayInStore } from '@/lib/format';
import { usePagedResource } from '@/hooks/usePagedResource';
import { useApp } from '@/components/AppProvider';
import { useToast } from '@/components/ui/Toast';
import PageHeader from '@/components/PageHeader';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import Pagination from '@/components/ui/Pagination';
import Receipt from '@/components/Receipt';
import { EmptyState, ErrorState, TableSkeleton } from '@/components/ui/States';
import type { TransactionStatus, TransactionWithRelations } from '@/lib/types';

const PAGE_SIZE = 20;

const PAYMENT_LABELS: Record<string, string> = {
  cash: 'Tunai',
  qris: 'QRIS',
  transfer: 'Transfer',
  debit: 'Debit',
};

export default function TransactionsPage() {
  const { isAdmin, settings, tzOffset } = useApp();
  const toast = useToast();

  const [search, setSearchValue] = useState('');
  const [status, setStatusValue] = useState<TransactionStatus | ''>('');
  const [startDate, setStartDateValue] = useState('');
  const [endDate, setEndDateValue] = useState('');
  const [offset, setOffset] = useState(0);

  // Setiap perubahan filter mengembalikan tampilan ke halaman pertama.
  function setSearch(value: string) {
    setSearchValue(value);
    setOffset(0);
  }
  function setStatus(value: TransactionStatus | '') {
    setStatusValue(value);
    setOffset(0);
  }
  function setStartDate(value: string) {
    setStartDateValue(value);
    setOffset(0);
  }
  function setEndDate(value: string) {
    setEndDateValue(value);
    setOffset(0);
  }

  const [detailId, setDetailId] = useState<string | null>(null);
  const [detail, setDetail] = useState<TransactionWithRelations | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);

  const [voiding, setVoiding] = useState<TransactionWithRelations | null>(null);
  const [voidLoading, setVoidLoading] = useState(false);

  const dateInvalid = Boolean(startDate && endDate && startDate > endDate);

  const url = useMemo(
    () =>
      `/api/transactions${qs({
        search,
        status: status || undefined,
        startDate: dateInvalid ? undefined : startDate,
        endDate: dateInvalid ? undefined : endDate,
        limit: PAGE_SIZE,
        offset,
      })}`,
    [search, status, startDate, endDate, dateInvalid, offset],
  );
  const { items, total, loading, error, reload } = usePagedResource<TransactionWithRelations>(url, {
    debounceMs: 300,
  });

  /** Detail selalu diambil ulang dari server supaya tidak menampilkan snapshot basi. */
  async function openDetail(id: string) {
    setDetailId(id);
    setDetailLoading(true);
    try {
      setDetail(await api.get<TransactionWithRelations>(`/api/transactions/${id}`));
    } catch (err) {
      toast.error(errorMessage(err));
      setDetailId(null);
    } finally {
      setDetailLoading(false);
    }
  }

  async function confirmVoid(reason: string) {
    if (!voiding) return;
    setVoidLoading(true);
    try {
      const updated = await api.patch<TransactionWithRelations>(`/api/transactions/${voiding.id}`, { reason });
      toast.success(`Transaksi ${updated.invoice_no} dibatalkan, stok dikembalikan`);
      setVoiding(null);
      if (detailId === updated.id) setDetail(updated);
      reload();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setVoidLoading(false);
    }
  }

  function setQuickRange(days: number) {
    const today = todayInStore(tzOffset);
    const from = new Date(`${today}T00:00:00Z`);
    from.setUTCDate(from.getUTCDate() - (days - 1));
    setStartDate(from.toISOString().slice(0, 10));
    setEndDate(today);
  }

  function exportCsv() {
    const header = ['Invoice', 'Waktu', 'Kasir', 'Pelanggan', 'Metode', 'Subtotal', 'Diskon', 'Pajak', 'Total', 'Status'];
    const rows = items.map((t) => [
      t.invoice_no,
      formatDateTime(t.created_at, tzOffset),
      t.user_name,
      t.customer_name ?? 'Umum',
      PAYMENT_LABELS[t.payment_method] ?? t.payment_method,
      t.subtotal,
      t.discount_amount,
      t.tax_amount,
      t.total,
      t.status === 'voided' ? 'Dibatalkan' : 'Selesai',
    ]);
    downloadCsv(`transaksi-${todayInStore(tzOffset)}.csv`, [header, ...rows]);
    toast.success('CSV halaman ini diunduh');
  }

  return (
    <>
      <PageHeader
        title="Transaksi"
        description={`${formatNumber(total)} transaksi ditemukan`}
        actions={
          items.length > 0 && (
            <Button variant="secondary" onClick={exportCsv}>
              ⬇ Ekspor CSV
            </Button>
          )
        }
      />

      <div className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-sm">
        <div className="space-y-2 border-b border-slate-200/70 p-3">
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Cari no. invoice, pelanggan, atau kasir..."
              aria-label="Cari transaksi"
              className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
            />
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value as TransactionStatus | '')}
              aria-label="Filter status"
              className="rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-emerald-500"
            >
              <option value="">Semua Status</option>
              <option value="completed">Selesai</option>
              <option value="voided">Dibatalkan</option>
            </select>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <input
              type="date"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
              aria-label="Tanggal mulai"
              className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-500 sm:flex-none"
            />
            <span className="text-sm text-slate-400">s/d</span>
            <input
              type="date"
              value={endDate}
              onChange={(event) => setEndDate(event.target.value)}
              aria-label="Tanggal akhir"
              className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-500 sm:flex-none"
            />
            <div className="flex gap-1.5">
              {[
                { label: 'Hari ini', days: 1 },
                { label: '7 hari', days: 7 },
                { label: '30 hari', days: 30 },
              ].map((range) => (
                <button
                  key={range.days}
                  type="button"
                  onClick={() => setQuickRange(range.days)}
                  className="rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-200"
                >
                  {range.label}
                </button>
              ))}
              {(startDate || endDate) && (
                <button
                  type="button"
                  onClick={() => {
                    setStartDate('');
                    setEndDate('');
                  }}
                  className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-100"
                >
                  Reset
                </button>
              )}
            </div>
          </div>
          {dateInvalid && (
            <p className="text-xs font-medium text-red-600">Tanggal mulai tidak boleh setelah tanggal akhir.</p>
          )}
        </div>

        {loading ? (
          <TableSkeleton columns={6} />
        ) : error ? (
          <div className="p-4">
            <ErrorState message={error} onRetry={reload} />
          </div>
        ) : items.length === 0 ? (
          <EmptyState icon="🧾" title="Tidak ada transaksi" description="Coba ubah filter atau rentang tanggal." />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] text-sm">
                <thead className="bg-slate-50/70 text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Invoice</th>
                    <th className="px-4 py-3 font-semibold">Waktu</th>
                    <th className="px-4 py-3 font-semibold">Pelanggan</th>
                    <th className="px-4 py-3 font-semibold">Kasir</th>
                    <th className="px-4 py-3 text-center font-semibold">Item</th>
                    <th className="px-4 py-3 font-semibold">Bayar</th>
                    <th className="px-4 py-3 text-right font-semibold">Total</th>
                    <th className="px-4 py-3 text-right font-semibold">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map((transaction) => (
                    <tr
                      key={transaction.id}
                      className={`transition-colors hover:bg-slate-50/60 ${
                        transaction.status === 'voided' ? 'bg-red-50/30' : ''
                      }`}
                    >
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => openDetail(transaction.id)}
                          className="font-mono text-xs font-semibold text-slate-700 hover:text-emerald-600 hover:underline"
                        >
                          {transaction.invoice_no}
                        </button>
                        {transaction.status === 'voided' && (
                          <span className="ml-2 rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-red-700">
                            Batal
                          </span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-500">
                        {formatDateTime(transaction.created_at, tzOffset)}
                      </td>
                      <td className="px-4 py-3 text-slate-600">{transaction.customer_name ?? 'Umum'}</td>
                      <td className="px-4 py-3 text-slate-600">{transaction.user_name}</td>
                      <td className="px-4 py-3 text-center text-slate-600">
                        {/* items bisa saja kosong bila data lama tidak lengkap. */}
                        {transaction.items?.length ?? 0}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {PAYMENT_LABELS[transaction.payment_method] ?? transaction.payment_method}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-slate-800">
                        {formatRupiah(transaction.total)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => openDetail(transaction.id)}
                            title="Lihat detail"
                            aria-label={`Detail ${transaction.invoice_no}`}
                            className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
                          >
                            👁
                          </button>
                          {isAdmin && transaction.status === 'completed' && (
                            <button
                              type="button"
                              onClick={() => setVoiding(transaction)}
                              title="Batalkan transaksi"
                              aria-label={`Batalkan ${transaction.invoice_no}`}
                              className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
                            >
                              ⊘
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination total={total} limit={PAGE_SIZE} offset={offset} onChange={setOffset} unit="transaksi" />
          </>
        )}
      </div>

      <Modal
        open={detailId !== null}
        title="Detail Transaksi"
        description={detail?.invoice_no}
        size="lg"
        onClose={() => {
          setDetailId(null);
          setDetail(null);
        }}
        footer={
          detail && (
            <>
              {isAdmin && detail.status === 'completed' && (
                <Button variant="danger" onClick={() => setVoiding(detail)}>
                  Batalkan Transaksi
                </Button>
              )}
              <Button variant="secondary" onClick={() => setShowReceipt(true)}>
                🖨️ Cetak Ulang Struk
              </Button>
            </>
          )
        }
      >
        {detailLoading || !detail ? (
          <TableSkeleton rows={4} columns={3} />
        ) : (
          <div className="space-y-4">
            {detail.status === 'voided' && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm" role="alert">
                <p className="font-semibold text-red-800">Transaksi dibatalkan</p>
                <p className="mt-0.5 text-red-700">
                  {detail.void_reason} — oleh {detail.voided_by_name ?? 'admin'} pada{' '}
                  {formatDateTime(detail.voided_at, tzOffset)}
                </p>
              </div>
            )}

            <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
              <Info label="Waktu" value={formatDateTime(detail.created_at, tzOffset)} />
              <Info label="Kasir" value={detail.user_name} />
              <Info label="Pelanggan" value={detail.customer_name ?? 'Umum'} />
              <Info label="Metode Bayar" value={PAYMENT_LABELS[detail.payment_method] ?? detail.payment_method} />
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full min-w-[420px] text-sm">
                <thead className="bg-slate-50/70 text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-3 py-2 font-semibold">Produk</th>
                    <th className="px-3 py-2 text-center font-semibold">Qty</th>
                    <th className="px-3 py-2 text-right font-semibold">Harga</th>
                    <th className="px-3 py-2 text-right font-semibold">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {detail.items.map((item) => (
                    <tr key={item.id}>
                      <td className="px-3 py-2 text-slate-700">{item.product_name}</td>
                      <td className="px-3 py-2 text-center text-slate-600">{item.quantity}</td>
                      <td className="px-3 py-2 text-right text-slate-600">{formatRupiah(item.price)}</td>
                      <td className="px-3 py-2 text-right font-medium text-slate-800">{formatRupiah(item.subtotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="space-y-1.5 rounded-xl bg-slate-50 p-3.5 text-sm">
              <Row label="Subtotal" value={formatRupiah(detail.subtotal)} />
              {detail.discount_amount > 0 && (
                <Row label="Diskon" value={`-${formatRupiah(detail.discount_amount)}`} tone="text-red-600" />
              )}
              {detail.tax_amount > 0 && (
                <Row label={`Pajak (${detail.tax_rate}%)`} value={formatRupiah(detail.tax_amount)} />
              )}
              <div className="flex justify-between border-t border-slate-200 pt-1.5 text-base font-bold">
                <span className="text-slate-800">Total</span>
                <span className="text-emerald-600">{formatRupiah(detail.total)}</span>
              </div>
              <Row label="Dibayar" value={formatRupiah(detail.amount_paid)} />
              <Row label="Kembalian" value={formatRupiah(detail.change)} />
            </div>

            {detail.notes && (
              <div className="rounded-xl border border-slate-200 p-3 text-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Catatan</p>
                <p className="mt-1 text-slate-700">{detail.notes}</p>
              </div>
            )}
          </div>
        )}
      </Modal>

      <Modal
        open={showReceipt && detail !== null}
        title="Struk"
        description={detail?.invoice_no}
        size="sm"
        onClose={() => setShowReceipt(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowReceipt(false)}>
              Tutup
            </Button>
            <Button onClick={() => window.print()}>🖨️ Cetak</Button>
          </>
        }
      >
        {detail && <Receipt transaction={detail} settings={settings} tzOffset={tzOffset} />}
      </Modal>

      <ConfirmDialog
        open={voiding !== null}
        title="Batalkan transaksi?"
        destructive
        loading={voidLoading}
        confirmLabel="Ya, batalkan"
        reasonLabel="Alasan pembatalan"
        message={
          <>
            Transaksi <strong>{voiding?.invoice_no}</strong> senilai{' '}
            <strong>{formatRupiah(voiding?.total ?? 0)}</strong> akan dibatalkan. Stok produk dikembalikan dan poin
            pelanggan ditarik kembali. Tindakan ini tidak bisa dibatalkan.
          </>
        }
        onConfirm={confirmVoid}
        onCancel={() => setVoiding(null)}
      />
    </>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200/70 p-3">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-0.5 font-medium text-slate-800">{value}</p>
    </div>
  );
}

function Row({ label, value, tone = 'text-slate-700' }: { label: string; value: string; tone?: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-slate-500">{label}</span>
      <span className={`font-medium ${tone}`}>{value}</span>
    </div>
  );
}
