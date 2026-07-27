'use client';

import { useMemo, useState } from 'react';
import { api, errorFields, errorMessage, qs } from '@/lib/api-client';
import { formatDateTime, formatNumber, formatRupiah } from '@/lib/format';
import { usePagedResource } from '@/hooks/usePagedResource';
import { useApp } from '@/components/AppProvider';
import { useToast } from '@/components/ui/Toast';
import PageHeader from '@/components/PageHeader';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import Pagination from '@/components/ui/Pagination';
import { TextAreaField, TextField } from '@/components/ui/Field';
import { EmptyState, ErrorState, TableSkeleton } from '@/components/ui/States';
import type { Customer, Paginated, TransactionWithRelations } from '@/lib/types';

const PAGE_SIZE = 20;
const EMPTY_FORM = { name: '', phone: '', email: '', address: '' };

export default function CustomersPage() {
  const { isAdmin, tzOffset } = useApp();
  const toast = useToast();

  const [search, setSearchValue] = useState('');
  const [offset, setOffset] = useState(0);

  // Pencarian baru selalu mulai dari halaman pertama.
  function setSearch(value: string) {
    setSearchValue(value);
    setOffset(0);
  }

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const [deleting, setDeleting] = useState<Customer | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const [detailOf, setDetailOf] = useState<Customer | null>(null);
  const [detailTransactions, setDetailTransactions] = useState<TransactionWithRelations[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  const url = useMemo(
    () => `/api/customers${qs({ search, limit: PAGE_SIZE, offset })}`,
    [search, offset],
  );
  const { items: customers, total, loading, error, reload } = usePagedResource<Customer>(url, { debounceMs: 300 });

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFieldErrors({});
    setFormOpen(true);
  }

  function openEdit(customer: Customer) {
    setEditing(customer);
    setForm({
      name: customer.name,
      // Kolom ini bisa null di data lama; jangan sampai jadi string "null" di input.
      phone: customer.phone ?? '',
      email: customer.email ?? '',
      address: customer.address ?? '',
    });
    setFieldErrors({});
    setFormOpen(true);
  }

  async function submitForm(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setFieldErrors({});
    try {
      if (editing) {
        await api.put(`/api/customers/${editing.id}`, form);
        toast.success(`Data ${form.name} diperbarui`);
      } else {
        await api.post('/api/customers', form);
        toast.success(`Pelanggan ${form.name} ditambahkan`);
      }
      setFormOpen(false);
      setEditing(null);
      reload();
    } catch (err) {
      setFieldErrors(errorFields(err));
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    setDeleteLoading(true);
    try {
      await api.delete(`/api/customers/${deleting.id}`);
      toast.success(`Pelanggan ${deleting.name} dihapus`);
      setDeleting(null);
      reload();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setDeleteLoading(false);
    }
  }

  async function openDetail(customer: Customer) {
    setDetailOf(customer);
    setDetailLoading(true);
    try {
      const result = await api.get<Paginated<TransactionWithRelations>>(
        `/api/customers/${customer.id}/transactions${qs({ limit: 20 })}`,
      );
      setDetailTransactions(result.data);
    } catch (err) {
      toast.error(errorMessage(err));
      setDetailTransactions([]);
    } finally {
      setDetailLoading(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Pelanggan"
        description={`${formatNumber(total)} pelanggan terdaftar`}
        actions={
          <Button onClick={openCreate}>
            <span aria-hidden>+</span> Tambah Pelanggan
          </Button>
        }
      />

      <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-sm">
        <div className="border-b border-line p-3">
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Cari nama, telepon, atau email..."
            aria-label="Cari pelanggan"
            className="w-full rounded-xl border border-line px-3.5 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
          />
        </div>

        {loading ? (
          <TableSkeleton columns={5} />
        ) : error ? (
          <div className="p-4">
            <ErrorState message={error} onRetry={reload} />
          </div>
        ) : customers.length === 0 ? (
          <EmptyState
            icon="👥"
            title="Belum ada pelanggan"
            description={search ? 'Tidak ada pelanggan yang cocok dengan pencarian.' : 'Tambahkan pelanggan untuk mulai mencatat poin dan riwayat belanja.'}
            action={!search ? <Button onClick={openCreate}>Tambah Pelanggan</Button> : undefined}
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead className="bg-surface-2 text-left text-xs uppercase tracking-wide text-ink-muted">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Nama</th>
                    <th className="px-4 py-3 font-semibold">Kontak</th>
                    <th className="px-4 py-3 text-right font-semibold">Kunjungan</th>
                    <th className="px-4 py-3 text-right font-semibold">Total Belanja</th>
                    <th className="px-4 py-3 text-right font-semibold">Poin</th>
                    <th className="px-4 py-3 text-right font-semibold">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line-soft">
                  {customers.map((customer) => (
                    <tr key={customer.id} className="transition-colors hover:bg-surface-2">
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => openDetail(customer)}
                          className="font-medium text-ink hover:text-emerald-600 dark:hover:text-emerald-300 hover:underline"
                        >
                          {customer.name}
                        </button>
                        {customer.address && (
                          <p className="mt-0.5 max-w-xs truncate text-xs text-ink-subtle" title={customer.address}>
                            {customer.address}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-ink-muted">
                        <p>{customer.phone || '-'}</p>
                        {customer.email && <p className="text-xs text-ink-subtle">{customer.email}</p>}
                      </td>
                      <td className="px-4 py-3 text-right text-ink-muted">{formatNumber(customer.visit_count)}×</td>
                      <td className="px-4 py-3 text-right font-semibold text-ink">
                        {formatRupiah(customer.total_spent)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="rounded-full bg-amber-50 dark:bg-amber-500/15 px-2.5 py-1 text-xs font-semibold text-amber-700 dark:text-amber-300">
                          {formatNumber(customer.points)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => openEdit(customer)}
                            title="Edit"
                            aria-label={`Edit ${customer.name}`}
                            className="rounded-lg p-1.5 text-ink-muted transition-colors hover:bg-surface-3 hover:text-ink"
                          >
                            ✎
                          </button>
                          {isAdmin && (
                            <button
                              type="button"
                              onClick={() => setDeleting(customer)}
                              title="Hapus"
                              aria-label={`Hapus ${customer.name}`}
                              className="rounded-lg p-1.5 text-ink-subtle transition-colors hover:bg-red-50 dark:hover:bg-red-500/15 hover:text-red-600 dark:hover:text-red-300"
                            >
                              🗑
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination total={total} limit={PAGE_SIZE} offset={offset} onChange={setOffset} unit="pelanggan" />
          </>
        )}
      </div>

      <Modal
        open={formOpen}
        title={editing ? 'Edit Pelanggan' : 'Tambah Pelanggan'}
        size="md"
        disableBackdropClose
        onClose={() => setFormOpen(false)}
      >
        <form onSubmit={submitForm} className="space-y-4">
          <TextField
            label="Nama"
            required
            maxLength={200}
            value={form.name}
            error={fieldErrors.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <TextField
              label="No. Telepon"
              inputMode="tel"
              maxLength={30}
              placeholder="08xxxxxxxxxx"
              value={form.phone}
              error={fieldErrors.phone}
              onChange={(event) => setForm({ ...form, phone: event.target.value })}
            />
            <TextField
              label="Email"
              type="email"
              maxLength={200}
              value={form.email}
              error={fieldErrors.email}
              onChange={(event) => setForm({ ...form, email: event.target.value })}
            />
          </div>
          <TextAreaField
            label="Alamat"
            rows={3}
            value={form.address}
            error={fieldErrors.address}
            onChange={(event) => setForm({ ...form, address: event.target.value })}
          />
          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
            <Button variant="secondary" onClick={() => setFormOpen(false)} disabled={saving}>
              Batal
            </Button>
            <Button type="submit" loading={saving}>
              {editing ? 'Simpan Perubahan' : 'Tambah'}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={detailOf !== null}
        title={detailOf?.name ?? ''}
        description="Riwayat 20 transaksi terakhir"
        size="lg"
        onClose={() => setDetailOf(null)}
      >
        {detailOf && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <Stat label="Kunjungan" value={`${formatNumber(detailOf.visit_count)}×`} />
              <Stat label="Total Belanja" value={formatRupiah(detailOf.total_spent)} />
              <Stat label="Poin" value={formatNumber(detailOf.points)} />
            </div>

            {detailLoading ? (
              <TableSkeleton rows={3} columns={3} />
            ) : detailTransactions.length === 0 ? (
              <EmptyState icon="🧾" title="Belum ada transaksi" />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[480px] text-sm">
                  <thead className="bg-surface-2 text-left text-xs uppercase tracking-wide text-ink-muted">
                    <tr>
                      <th className="px-3 py-2 font-semibold">Invoice</th>
                      <th className="px-3 py-2 font-semibold">Waktu</th>
                      <th className="px-3 py-2 text-right font-semibold">Total</th>
                      <th className="px-3 py-2 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line-soft">
                    {detailTransactions.map((transaction) => (
                      <tr key={transaction.id}>
                        <td className="px-3 py-2 font-mono text-xs text-ink-muted">{transaction.invoice_no}</td>
                        <td className="whitespace-nowrap px-3 py-2 text-ink-muted">
                          {formatDateTime(transaction.created_at, tzOffset)}
                        </td>
                        <td className="px-3 py-2 text-right font-semibold text-ink">
                          {formatRupiah(transaction.total)}
                        </td>
                        <td className="px-3 py-2">
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                              transaction.status === 'voided'
                                ? 'bg-red-50 dark:bg-red-500/15 text-red-600 dark:text-red-300'
                                : 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                            }`}
                          >
                            {transaction.status === 'voided' ? 'Dibatalkan' : 'Selesai'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={deleting !== null}
        title="Hapus pelanggan?"
        destructive
        loading={deleteLoading}
        confirmLabel="Ya, hapus"
        message={
          <>
            Pelanggan <strong>{deleting?.name}</strong> akan disembunyikan dari daftar. Riwayat transaksinya tetap
            tersimpan.
          </>
        }
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      />
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface-2 p-3">
      <p className="text-xs uppercase tracking-wide text-ink-muted">{label}</p>
      <p className="mt-1 truncate text-base font-bold text-ink">{value}</p>
    </div>
  );
}
