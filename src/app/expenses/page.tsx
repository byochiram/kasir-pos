'use client';

import { useMemo, useState } from 'react';
import { api, errorFields, errorMessage, qs } from '@/lib/api-client';
import { downloadCsv } from '@/lib/csv';
import { useFetch } from '@/hooks/useFetch';
import { addDays, formatNumber, formatPlainDate, formatRupiah, todayInStore } from '@/lib/format';
import { useApp } from '@/components/AppProvider';
import { useToast } from '@/components/ui/Toast';
import PageHeader from '@/components/PageHeader';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import Pagination from '@/components/ui/Pagination';
import { SelectField, TextAreaField, TextField } from '@/components/ui/Field';
import { EmptyState, ErrorState, TableSkeleton } from '@/components/ui/States';
import { EXPENSE_CATEGORIES, type ExpenseWithRelations, type Paginated } from '@/lib/types';

const PAGE_SIZE = 20;

interface ExpenseListResponse extends Paginated<ExpenseWithRelations> {
  sum: number;
}

export default function ExpensesPage() {
  const { tzOffset } = useApp();
  const toast = useToast();
  const today = todayInStore(tzOffset);

  const [search, setSearchValue] = useState('');
  const [category, setCategoryValue] = useState('');
  const [startDate, setStartDateValue] = useState(() => addDays(today, -29));
  const [endDate, setEndDateValue] = useState(today);
  const [offset, setOffset] = useState(0);

  // Setiap perubahan filter mengembalikan tampilan ke halaman pertama.
  function setSearch(value: string) {
    setSearchValue(value);
    setOffset(0);
  }
  function setCategory(value: string) {
    setCategoryValue(value);
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

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ExpenseWithRelations | null>(null);
  const [form, setForm] = useState({ description: '', amount: '', category: 'Operasional', date: today, notes: '' });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const [deleting, setDeleting] = useState<ExpenseWithRelations | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const dateInvalid = startDate > endDate;

  const url = useMemo(
    () =>
      `/api/expenses${qs({
        search,
        category,
        startDate: dateInvalid ? undefined : startDate,
        endDate: dateInvalid ? undefined : endDate,
        limit: PAGE_SIZE,
        offset,
      })}`,
    [search, category, startDate, endDate, dateInvalid, offset],
  );

  const { data, loading, error, reload } = useFetch<ExpenseListResponse>(url, { debounceMs: 300 });

  function openCreate() {
    setEditing(null);
    setForm({ description: '', amount: '', category: 'Operasional', date: today, notes: '' });
    setFieldErrors({});
    setFormOpen(true);
  }

  function openEdit(expense: ExpenseWithRelations) {
    setEditing(expense);
    setForm({
      description: expense.description,
      amount: String(expense.amount),
      category: expense.category,
      date: expense.date.slice(0, 10),
      notes: expense.notes ?? '',
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
        await api.put(`/api/expenses/${editing.id}`, form);
        toast.success('Pengeluaran diperbarui');
      } else {
        await api.post('/api/expenses', form);
        toast.success('Pengeluaran dicatat');
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
      await api.delete(`/api/expenses/${deleting.id}`);
      toast.success('Pengeluaran dihapus');
      setDeleting(null);
      reload();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setDeleteLoading(false);
    }
  }

  function exportCsv() {
    if (!data) return;
    const header = ['Tanggal', 'Deskripsi', 'Kategori', 'Jumlah', 'Catatan', 'Dicatat oleh'];
    const rows = data.data.map((e) => [e.date, e.description, e.category, e.amount, e.notes ?? '', e.user_name]);
    downloadCsv(`pengeluaran-${startDate}-sd-${endDate}.csv`, [header, ...rows]);
    toast.success('CSV halaman ini diunduh');
  }

  const items = data?.data ?? [];

  return (
    <>
      <PageHeader
        title="Pengeluaran"
        description="Catat biaya operasional untuk menghitung laba bersih"
        actions={
          <>
            {items.length > 0 && (
              <Button variant="secondary" onClick={exportCsv}>
                ⬇ Ekspor CSV
              </Button>
            )}
            <Button onClick={openCreate}>
              <span aria-hidden>+</span> Tambah Pengeluaran
            </Button>
          </>
        }
      />

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-line bg-surface p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-ink-muted">Total Periode Terpilih</p>
          {/* Dihitung server atas seluruh hasil filter, bukan hanya baris di halaman ini. */}
          <p className="mt-1 break-words text-2xl font-bold text-red-600 dark:text-red-300">{formatRupiah(data?.sum ?? 0)}</p>
        </div>
        <div className="rounded-2xl border border-line bg-surface p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-ink-muted">Jumlah Catatan</p>
          <p className="mt-1 text-2xl font-bold text-ink">{formatNumber(data?.total ?? 0)}</p>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-sm">
        <div className="space-y-2 border-b border-line p-3">
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Cari deskripsi..."
              aria-label="Cari pengeluaran"
              className="min-w-0 flex-1 rounded-xl border border-line px-3.5 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
            />
            <select
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              aria-label="Filter kategori"
              className="rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm outline-none focus:border-emerald-500"
            >
              <option value="">Semua Kategori</option>
              {EXPENSE_CATEGORIES.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="date"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
              aria-label="Tanggal mulai"
              className="min-w-0 flex-1 rounded-xl border border-line px-3 py-2 text-sm outline-none focus:border-emerald-500 sm:flex-none"
            />
            <span className="text-sm text-ink-subtle">s/d</span>
            <input
              type="date"
              value={endDate}
              onChange={(event) => setEndDate(event.target.value)}
              aria-label="Tanggal akhir"
              className="min-w-0 flex-1 rounded-xl border border-line px-3 py-2 text-sm outline-none focus:border-emerald-500 sm:flex-none"
            />
          </div>
          {dateInvalid && (
            <p className="text-xs font-medium text-red-600 dark:text-red-300">Tanggal mulai tidak boleh setelah tanggal akhir.</p>
          )}
        </div>

        {loading ? (
          <TableSkeleton columns={5} />
        ) : error ? (
          <div className="p-4">
            <ErrorState message={error} onRetry={reload} />
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            icon="💸"
            title="Belum ada pengeluaran"
            description="Catat biaya sewa, gaji, listrik, dan lainnya agar laba bersih akurat."
            action={<Button onClick={openCreate}>Tambah Pengeluaran</Button>}
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead className="bg-surface-2 text-left text-xs uppercase tracking-wide text-ink-muted">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Tanggal</th>
                    <th className="px-4 py-3 font-semibold">Deskripsi</th>
                    <th className="px-4 py-3 font-semibold">Kategori</th>
                    <th className="px-4 py-3 font-semibold">Dicatat oleh</th>
                    <th className="px-4 py-3 text-right font-semibold">Jumlah</th>
                    <th className="px-4 py-3 text-right font-semibold">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line-soft">
                  {items.map((expense) => (
                    <tr key={expense.id} className="transition-colors hover:bg-surface-2">
                      <td className="whitespace-nowrap px-4 py-3 text-ink-muted">{formatPlainDate(expense.date)}</td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-ink">{expense.description}</p>
                        {expense.notes && <p className="mt-0.5 text-xs text-ink-subtle">{expense.notes}</p>}
                      </td>
                      <td className="px-4 py-3">
                        <span className="rounded-full bg-surface-3 px-2.5 py-1 text-xs font-medium text-ink-muted">
                          {expense.category}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-ink-muted">{expense.user_name}</td>
                      <td className="px-4 py-3 text-right font-semibold text-red-600 dark:text-red-300">
                        {formatRupiah(expense.amount)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => openEdit(expense)}
                            title="Edit"
                            aria-label={`Edit ${expense.description}`}
                            className="rounded-lg p-1.5 text-ink-muted transition-colors hover:bg-surface-3 hover:text-ink"
                          >
                            ✎
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleting(expense)}
                            title="Hapus"
                            aria-label={`Hapus ${expense.description}`}
                            className="rounded-lg p-1.5 text-ink-subtle transition-colors hover:bg-red-50 dark:hover:bg-red-500/15 hover:text-red-600 dark:hover:text-red-300"
                          >
                            🗑
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination
              total={data?.total ?? 0}
              limit={PAGE_SIZE}
              offset={offset}
              onChange={setOffset}
              unit="pengeluaran"
            />
          </>
        )}
      </div>

      <Modal
        open={formOpen}
        title={editing ? 'Edit Pengeluaran' : 'Tambah Pengeluaran'}
        size="md"
        disableBackdropClose
        onClose={() => setFormOpen(false)}
      >
        <form onSubmit={submitForm} className="space-y-4">
          <TextField
            label="Deskripsi"
            required
            maxLength={200}
            placeholder="Contoh: Bayar listrik bulan Juli"
            value={form.description}
            error={fieldErrors.description}
            onChange={(event) => setForm({ ...form, description: event.target.value })}
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <TextField
              label="Jumlah (Rp)"
              type="number"
              min={1}
              required
              value={form.amount}
              error={fieldErrors.amount}
              onChange={(event) => setForm({ ...form, amount: event.target.value })}
            />
            <TextField
              label="Tanggal"
              type="date"
              required
              value={form.date}
              error={fieldErrors.date}
              onChange={(event) => setForm({ ...form, date: event.target.value })}
            />
          </div>
          <SelectField
            label="Kategori"
            required
            value={form.category}
            error={fieldErrors.category}
            onChange={(event) => setForm({ ...form, category: event.target.value })}
          >
            {EXPENSE_CATEGORIES.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </SelectField>
          <TextAreaField
            label="Catatan"
            rows={2}
            value={form.notes}
            error={fieldErrors.notes}
            onChange={(event) => setForm({ ...form, notes: event.target.value })}
          />
          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
            <Button variant="secondary" onClick={() => setFormOpen(false)} disabled={saving}>
              Batal
            </Button>
            <Button type="submit" loading={saving}>
              {editing ? 'Simpan Perubahan' : 'Simpan'}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={deleting !== null}
        title="Hapus pengeluaran?"
        destructive
        loading={deleteLoading}
        confirmLabel="Ya, hapus"
        message={
          <>
            Catatan <strong>{deleting?.description}</strong> senilai{' '}
            <strong>{formatRupiah(deleting?.amount ?? 0)}</strong> akan dihapus permanen dan laporan laba bersih akan
            berubah.
          </>
        }
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      />
    </>
  );
}

