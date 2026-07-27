'use client';

import { useMemo, useState } from 'react';
import { api, errorFields, errorMessage, qs } from '@/lib/api-client';
import { formatDate, formatNumber, initials } from '@/lib/format';
import { usePagedResource } from '@/hooks/usePagedResource';
import { useApp } from '@/components/AppProvider';
import { useToast } from '@/components/ui/Toast';
import PageHeader from '@/components/PageHeader';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import Pagination from '@/components/ui/Pagination';
import { SelectField, TextField } from '@/components/ui/Field';
import { EmptyState, ErrorState, TableSkeleton } from '@/components/ui/States';
import { ROLES, type PublicUser, type Role } from '@/lib/types';

const PAGE_SIZE = 20;
const EMPTY_FORM = { name: '', email: '', password: '', role: 'KASIR' as Role, is_active: true };

const ROLE_BADGE: Record<Role, string> = {
  ADMIN: 'bg-violet-50 text-violet-700 border-violet-200',
  KASIR: 'bg-sky-50 text-sky-700 border-sky-200',
};

const ROLE_HINT: Record<Role, string> = {
  ADMIN: 'Akses penuh: produk, stok, laporan, pengeluaran, dan kelola user.',
  KASIR: 'Hanya kasir, transaksi sendiri, dan data pelanggan.',
};

export default function UsersPage() {
  const { user: currentUser, tzOffset } = useApp();
  const toast = useToast();

  const [search, setSearchValue] = useState('');
  const [offset, setOffset] = useState(0);

  // Pencarian baru selalu mulai dari halaman pertama.
  function setSearch(value: string) {
    setSearchValue(value);
    setOffset(0);
  }

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<PublicUser | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const [deleting, setDeleting] = useState<PublicUser | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const url = useMemo(() => `/api/users${qs({ search, limit: PAGE_SIZE, offset })}`, [search, offset]);
  const { items: users, total, loading, error, reload } = usePagedResource<PublicUser>(url, { debounceMs: 300 });

  const activeAdmins = users.filter((u) => u.role === 'ADMIN' && u.is_active === 1).length;

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFieldErrors({});
    setFormOpen(true);
  }

  function openEdit(user: PublicUser) {
    setEditing(user);
    setForm({ name: user.name, email: user.email, password: '', role: user.role, is_active: user.is_active === 1 });
    setFieldErrors({});
    setFormOpen(true);
  }

  async function submitForm(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setFieldErrors({});
    try {
      if (editing) {
        await api.put(`/api/users/${editing.id}`, {
          name: form.name,
          email: form.email,
          // String kosong berarti "jangan ubah password".
          password: form.password,
          role: form.role,
          is_active: form.is_active,
        });
        toast.success(`User ${form.name} diperbarui`);
      } else {
        await api.post('/api/users', {
          name: form.name,
          email: form.email,
          password: form.password,
          role: form.role,
        });
        toast.success(`User ${form.name} ditambahkan`);
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
      await api.delete(`/api/users/${deleting.id}`);
      toast.success(`User ${deleting.name} dihapus`);
      setDeleting(null);
      reload();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setDeleteLoading(false);
    }
  }

  /** Admin terakhir yang masih aktif tidak boleh dihapus — sistem akan terkunci. */
  function canDelete(user: PublicUser): boolean {
    if (user.id === currentUser?.id) return false;
    if (user.role === 'ADMIN' && user.is_active === 1 && activeAdmins <= 1) return false;
    return true;
  }

  return (
    <>
      <PageHeader
        title="Kelola User"
        description={`${formatNumber(total)} akun terdaftar`}
        actions={
          <Button onClick={openCreate}>
            <span aria-hidden>+</span> Tambah User
          </Button>
        }
      />

      <div className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-sm">
        <div className="border-b border-slate-200/70 p-3">
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Cari nama atau email..."
            aria-label="Cari user"
            className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
          />
        </div>

        {loading ? (
          <TableSkeleton columns={4} />
        ) : error ? (
          <div className="p-4">
            <ErrorState message={error} onRetry={reload} />
          </div>
        ) : users.length === 0 ? (
          <EmptyState icon="👤" title="Tidak ada user" description="Coba kata kunci lain." />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] text-sm">
                <thead className="bg-slate-50/70 text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-semibold">User</th>
                    <th className="px-4 py-3 font-semibold">Role</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold">Dibuat</th>
                    <th className="px-4 py-3 text-right font-semibold">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {users.map((user) => (
                    <tr key={user.id} className="transition-colors hover:bg-slate-50/60">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-800 text-xs font-bold text-white">
                            {initials(user.name)}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate font-medium text-slate-800">
                              {user.name}
                              {user.id === currentUser?.id && (
                                <span className="ml-2 rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold uppercase text-emerald-700">
                                  Anda
                                </span>
                              )}
                            </p>
                            <p className="truncate text-xs text-slate-500">{user.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${ROLE_BADGE[user.role]}`}
                        >
                          {user.role}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                            user.is_active === 1 ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          {user.is_active === 1 ? 'Aktif' : 'Nonaktif'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-500">{formatDate(user.created_at, tzOffset)}</td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => openEdit(user)}
                            title="Edit"
                            aria-label={`Edit ${user.name}`}
                            className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
                          >
                            ✎
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleting(user)}
                            disabled={!canDelete(user)}
                            title={
                              user.id === currentUser?.id
                                ? 'Tidak bisa menghapus akun sendiri'
                                : !canDelete(user)
                                  ? 'Tidak bisa menghapus admin aktif terakhir'
                                  : 'Hapus'
                            }
                            aria-label={`Hapus ${user.name}`}
                            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-400"
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
            <Pagination total={total} limit={PAGE_SIZE} offset={offset} onChange={setOffset} unit="user" />
          </>
        )}
      </div>

      <Modal
        open={formOpen}
        title={editing ? 'Edit User' : 'Tambah User'}
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
          <TextField
            label="Email"
            type="email"
            required
            maxLength={200}
            autoComplete="off"
            value={form.email}
            error={fieldErrors.email}
            onChange={(event) => setForm({ ...form, email: event.target.value })}
          />
          <TextField
            label={editing ? 'Password Baru' : 'Password'}
            type="password"
            // Saat membuat user baru password wajib; saat edit boleh dikosongkan.
            required={!editing}
            minLength={6}
            autoComplete="new-password"
            value={form.password}
            error={fieldErrors.password}
            hint={editing ? 'Kosongkan jika tidak ingin mengubah password' : 'Minimal 6 karakter'}
            onChange={(event) => setForm({ ...form, password: event.target.value })}
          />
          <SelectField
            label="Role"
            required
            value={form.role}
            error={fieldErrors.role}
            hint={ROLE_HINT[form.role]}
            onChange={(event) => setForm({ ...form, role: event.target.value as Role })}
          >
            {ROLES.map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </SelectField>

          {editing && editing.id !== currentUser?.id && (
            <label className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-slate-200 p-3 text-sm">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(event) => setForm({ ...form, is_active: event.target.checked })}
                className="h-4 w-4 accent-emerald-600"
              />
              <span>
                <span className="font-medium text-slate-700">Akun aktif</span>
                <span className="block text-xs text-slate-500">
                  Akun nonaktif tidak bisa login, tapi riwayat transaksinya tetap tersimpan.
                </span>
              </span>
            </label>
          )}

          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
            <Button variant="secondary" onClick={() => setFormOpen(false)} disabled={saving}>
              Batal
            </Button>
            <Button type="submit" loading={saving}>
              {editing ? 'Simpan Perubahan' : 'Tambah User'}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={deleting !== null}
        title="Hapus user?"
        destructive
        loading={deleteLoading}
        confirmLabel="Ya, hapus"
        message={
          <>
            Akun <strong>{deleting?.name}</strong> tidak akan bisa login lagi. Transaksi yang pernah dibuatnya tetap
            tercatat atas namanya.
          </>
        }
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      />
    </>
  );
}
