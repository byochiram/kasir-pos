'use client';

import { useMemo, useState } from 'react';
import { api, errorFields, errorMessage, qs } from '@/lib/api-client';
import { formatNumber } from '@/lib/format';
import { usePagedResource } from '@/hooks/usePagedResource';
import { useToast } from '@/components/ui/Toast';
import PageHeader from '@/components/PageHeader';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import Pagination from '@/components/ui/Pagination';
import { TextAreaField, TextField } from '@/components/ui/Field';
import { EmptyState, ErrorState, TableSkeleton } from '@/components/ui/States';
import type { Supplier } from '@/lib/types';

const PAGE_SIZE = 20;
const EMPTY_FORM = { name: '', contact_person: '', phone: '', email: '', address: '' };

export default function SuppliersPage() {
  const toast = useToast();

  const [search, setSearchValue] = useState('');
  const [offset, setOffset] = useState(0);

  // Pencarian baru selalu mulai dari halaman pertama.
  function setSearch(value: string) {
    setSearchValue(value);
    setOffset(0);
  }

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const [deleting, setDeleting] = useState<Supplier | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const url = useMemo(() => `/api/suppliers${qs({ search, limit: PAGE_SIZE, offset })}`, [search, offset]);
  const { items: suppliers, total, loading, error, reload } = usePagedResource<Supplier>(url, { debounceMs: 300 });

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFieldErrors({});
    setFormOpen(true);
  }

  function openEdit(supplier: Supplier) {
    setEditing(supplier);
    setForm({
      name: supplier.name,
      contact_person: supplier.contact_person ?? '',
      phone: supplier.phone ?? '',
      email: supplier.email ?? '',
      address: supplier.address ?? '',
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
        await api.put(`/api/suppliers/${editing.id}`, form);
        toast.success(`Supplier ${form.name} diperbarui`);
      } else {
        await api.post('/api/suppliers', form);
        toast.success(`Supplier ${form.name} ditambahkan`);
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
      await api.delete(`/api/suppliers/${deleting.id}`);
      toast.success(`Supplier ${deleting.name} dihapus`);
      setDeleting(null);
      reload();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setDeleteLoading(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Supplier"
        description={`${formatNumber(total)} supplier terdaftar`}
        actions={
          <Button onClick={openCreate}>
            <span aria-hidden>+</span> Tambah Supplier
          </Button>
        }
      />

      <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-sm">
        <div className="border-b border-line p-3">
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Cari nama, kontak person, atau telepon..."
            aria-label="Cari supplier"
            className="w-full rounded-xl border border-line px-3.5 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
          />
        </div>

        {loading ? (
          <TableSkeleton columns={4} />
        ) : error ? (
          <div className="p-4">
            <ErrorState message={error} onRetry={reload} />
          </div>
        ) : suppliers.length === 0 ? (
          <EmptyState
            icon="🚚"
            title="Belum ada supplier"
            description={search ? 'Tidak ada supplier yang cocok dengan pencarian.' : 'Catat supplier agar stok masuk bisa ditelusuri asalnya.'}
            action={!search ? <Button onClick={openCreate}>Tambah Supplier</Button> : undefined}
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead className="bg-surface-2 text-left text-xs uppercase tracking-wide text-ink-muted">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Nama</th>
                    <th className="px-4 py-3 font-semibold">Kontak Person</th>
                    <th className="px-4 py-3 font-semibold">Telepon</th>
                    <th className="px-4 py-3 font-semibold">Alamat</th>
                    <th className="px-4 py-3 text-right font-semibold">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line-soft">
                  {suppliers.map((supplier) => (
                    <tr key={supplier.id} className="transition-colors hover:bg-surface-2">
                      <td className="px-4 py-3">
                        <p className="font-medium text-ink">{supplier.name}</p>
                        {supplier.email && <p className="mt-0.5 text-xs text-ink-subtle">{supplier.email}</p>}
                      </td>
                      <td className="px-4 py-3 text-ink-muted">{supplier.contact_person || '-'}</td>
                      <td className="px-4 py-3 text-ink-muted">{supplier.phone || '-'}</td>
                      <td className="px-4 py-3 text-ink-muted">
                        <span className="block max-w-[220px] truncate" title={supplier.address || undefined}>
                          {supplier.address || '-'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => openEdit(supplier)}
                            title="Edit"
                            aria-label={`Edit ${supplier.name}`}
                            className="rounded-lg p-1.5 text-ink-muted transition-colors hover:bg-surface-3 hover:text-ink"
                          >
                            ✎
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleting(supplier)}
                            title="Hapus"
                            aria-label={`Hapus ${supplier.name}`}
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
            <Pagination total={total} limit={PAGE_SIZE} offset={offset} onChange={setOffset} unit="supplier" />
          </>
        )}
      </div>

      <Modal
        open={formOpen}
        title={editing ? 'Edit Supplier' : 'Tambah Supplier'}
        size="md"
        disableBackdropClose
        onClose={() => setFormOpen(false)}
      >
        <form onSubmit={submitForm} className="space-y-4">
          <TextField
            label="Nama Supplier"
            required
            maxLength={200}
            value={form.name}
            error={fieldErrors.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
          />
          <TextField
            label="Kontak Person"
            maxLength={200}
            value={form.contact_person}
            error={fieldErrors.contact_person}
            onChange={(event) => setForm({ ...form, contact_person: event.target.value })}
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <TextField
              label="No. Telepon"
              inputMode="tel"
              maxLength={30}
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

      <ConfirmDialog
        open={deleting !== null}
        title="Hapus supplier?"
        destructive
        loading={deleteLoading}
        confirmLabel="Ya, hapus"
        message={
          <>
            Supplier <strong>{deleting?.name}</strong> akan disembunyikan dari daftar. Riwayat stok masuk yang
            mereferensikannya tetap tersimpan.
          </>
        }
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      />
    </>
  );
}
