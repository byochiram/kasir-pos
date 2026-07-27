'use client';

import { useMemo, useState } from 'react';
import { api, errorFields, errorMessage, qs } from '@/lib/api-client';
import { formatDateTime, formatNumber, formatRupiah } from '@/lib/format';
import { useFetch } from '@/hooks/useFetch';
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
import type { Paginated, Product, StockHistoryWithRelations } from '@/lib/types';

const PAGE_SIZE = 20;

const EMPTY_FORM = {
  name: '',
  price: '',
  cost_price: '',
  stock: '',
  min_stock: '5',
  category: '',
  barcode: '',
  unit: 'pcs',
};

type FormState = typeof EMPTY_FORM;
type StockMode = 'in' | 'out' | 'adjust';

const STOCK_MODES: Record<StockMode, { title: string; label: string; endpoint: string; verb: string }> = {
  in: { title: 'Stok Masuk', label: 'Jumlah masuk', endpoint: '/api/stock/in', verb: 'ditambahkan' },
  out: { title: 'Stok Keluar', label: 'Jumlah keluar', endpoint: '/api/stock/out', verb: 'dikurangi' },
  adjust: { title: 'Stok Opname', label: 'Stok hasil hitung fisik', endpoint: '/api/stock/adjust', verb: 'disesuaikan' },
};

const MOVEMENT_LABELS: Record<string, { label: string; className: string }> = {
  in: { label: 'Masuk', className: 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' },
  out: { label: 'Keluar', className: 'bg-orange-50 dark:bg-orange-500/15 text-orange-700 dark:text-orange-300' },
  sale: { label: 'Penjualan', className: 'bg-sky-50 dark:bg-sky-500/15 text-sky-700 dark:text-sky-300' },
  adjustment: { label: 'Penyesuaian', className: 'bg-violet-50 dark:bg-violet-500/15 text-violet-700 dark:text-violet-300' },
  void: { label: 'Pembatalan', className: 'bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300' },
};

export default function ProductsPage() {
  const { isAdmin, tzOffset } = useApp();
  const toast = useToast();

  const [search, setSearchValue] = useState('');
  const [category, setCategoryValue] = useState('');
  const [lowStockOnly, setLowStockOnlyValue] = useState(false);
  const [offset, setOffset] = useState(0);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const [stockTarget, setStockTarget] = useState<{ product: Product; mode: StockMode } | null>(null);
  const [stockQty, setStockQty] = useState('');
  const [stockNotes, setStockNotes] = useState('');
  const [stockSaving, setStockSaving] = useState(false);

  const [deleting, setDeleting] = useState<Product | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const [historyOf, setHistoryOf] = useState<Product | null>(null);
  const [history, setHistory] = useState<StockHistoryWithRelations[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const url = useMemo(
    () => `/api/products${qs({ search, category, lowStock: lowStockOnly || undefined, limit: PAGE_SIZE, offset })}`,
    [search, category, lowStockOnly, offset],
  );
  const { items: products, total, loading, error, reload } = usePagedResource<Product>(url, { debounceMs: 300 });
  const { data: categoryData, reload: reloadCategories } = useFetch<string[]>('/api/products/categories');
  const categories = useMemo(() => categoryData ?? [], [categoryData]);

  // Filter apa pun mengembalikan tampilan ke halaman pertama, supaya tidak
  // berhenti di halaman yang sudah tidak punya isi.
  function setSearch(value: string) {
    setSearchValue(value);
    setOffset(0);
  }
  function setCategory(value: string) {
    setCategoryValue(value);
    setOffset(0);
  }
  function setLowStockOnly(value: boolean) {
    setLowStockOnlyValue(value);
    setOffset(0);
  }

  function openCreate() {
    setEditing(null);
    setForm({ ...EMPTY_FORM, category: categories[0] ?? 'Umum' });
    setFieldErrors({});
    setFormOpen(true);
  }

  function openEdit(product: Product) {
    setEditing(product);
    setForm({
      name: product.name,
      price: String(product.price),
      cost_price: String(product.cost_price),
      stock: String(product.stock),
      min_stock: String(product.min_stock),
      category: product.category,
      barcode: product.barcode ?? '',
      unit: product.unit ?? 'pcs',
    });
    setFieldErrors({});
    setFormOpen(true);
  }

  async function submitForm(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setFieldErrors({});
    try {
      const payload = {
        name: form.name,
        price: form.price,
        cost_price: form.cost_price || 0,
        stock: form.stock || 0,
        min_stock: form.min_stock || 0,
        category: form.category.trim() || 'Umum',
        barcode: form.barcode,
        unit: form.unit.trim() || 'pcs',
      };
      if (editing) {
        await api.put(`/api/products/${editing.id}`, payload);
        toast.success(`Produk ${form.name} diperbarui`);
      } else {
        await api.post('/api/products', payload);
        toast.success(`Produk ${form.name} ditambahkan`);
      }
      setFormOpen(false);
      setEditing(null);
      reload();
      // Kategori baru harus langsung muncul di dropdown filter.
      reloadCategories();
    } catch (err) {
      setFieldErrors(errorFields(err));
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function submitStock(event: React.FormEvent) {
    event.preventDefault();
    if (!stockTarget) return;
    const { product, mode } = stockTarget;
    setStockSaving(true);
    try {
      const body =
        mode === 'adjust'
          ? { product_id: product.id, new_stock: stockQty, notes: stockNotes }
          : { product_id: product.id, quantity: stockQty, notes: stockNotes };
      await api.post(STOCK_MODES[mode].endpoint, body);
      toast.success(`Stok ${product.name} berhasil ${STOCK_MODES[mode].verb}`);
      setStockTarget(null);
      setStockQty('');
      setStockNotes('');
      reload();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setStockSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    setDeleteLoading(true);
    try {
      await api.delete(`/api/products/${deleting.id}`);
      toast.success(`Produk ${deleting.name} dihapus`);
      setDeleting(null);
      reload();
      reloadCategories();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setDeleteLoading(false);
    }
  }

  async function openHistory(product: Product) {
    setHistoryOf(product);
    setHistoryLoading(true);
    try {
      const result = await api.get<Paginated<StockHistoryWithRelations>>(
        `/api/stock/history${qs({ productId: product.id, limit: 50 })}`,
      );
      setHistory(result.data);
    } catch (err) {
      toast.error(errorMessage(err));
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Produk"
        description={`${formatNumber(total)} produk terdaftar`}
        actions={
          isAdmin && (
            <Button onClick={openCreate}>
              <span aria-hidden>+</span> Tambah Produk
            </Button>
          )
        }
      />

      <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-sm">
        <div className="flex flex-col gap-2 border-b border-line p-3 sm:flex-row sm:items-center">
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Cari nama atau barcode..."
            aria-label="Cari produk"
            className="min-w-0 flex-1 rounded-xl border border-line px-3.5 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
          />
          <select
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            aria-label="Filter kategori"
            className="rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm outline-none focus:border-emerald-500"
          >
            <option value="">Semua Kategori</option>
            {categories.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
          <label className="flex shrink-0 cursor-pointer items-center gap-2 rounded-xl border border-line px-3.5 py-2.5 text-sm text-ink-muted">
            <input
              type="checkbox"
              checked={lowStockOnly}
              onChange={(event) => setLowStockOnly(event.target.checked)}
              className="h-4 w-4 accent-emerald-600"
            />
            Stok menipis
          </label>
        </div>

        {loading ? (
          <TableSkeleton columns={6} />
        ) : error ? (
          <div className="p-4">
            <ErrorState message={error} onRetry={reload} />
          </div>
        ) : products.length === 0 ? (
          <EmptyState
            icon="📦"
            title="Belum ada produk"
            description={search || category || lowStockOnly ? 'Tidak ada produk yang cocok dengan filter.' : 'Tambahkan produk pertama Anda.'}
            action={isAdmin && !search && !category && !lowStockOnly ? <Button onClick={openCreate}>Tambah Produk</Button> : undefined}
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-sm">
                <thead className="bg-surface-2 text-left text-xs uppercase tracking-wide text-ink-muted">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Produk</th>
                    <th className="px-4 py-3 font-semibold">Kategori</th>
                    <th className="px-4 py-3 text-right font-semibold">Harga Jual</th>
                    {isAdmin && <th className="px-4 py-3 text-right font-semibold">Modal</th>}
                    <th className="px-4 py-3 text-right font-semibold">Stok</th>
                    <th className="px-4 py-3 text-right font-semibold">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line-soft">
                  {products.map((product) => {
                    const low = product.stock <= product.min_stock;
                    return (
                      <tr key={product.id} className="transition-colors hover:bg-surface-2">
                        <td className="px-4 py-3">
                          <p className="font-medium text-ink">{product.name}</p>
                          {product.barcode && (
                            <p className="mt-0.5 font-mono text-xs text-ink-subtle">{product.barcode}</p>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className="rounded-full bg-surface-3 px-2.5 py-1 text-xs font-medium text-ink-muted">
                            {product.category}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-ink">
                          {formatRupiah(product.price)}
                        </td>
                        {isAdmin && (
                          <td className="px-4 py-3 text-right text-ink-muted">{formatRupiah(product.cost_price)}</td>
                        )}
                        <td className="px-4 py-3 text-right">
                          <span
                            className={`inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${
                              product.stock <= 0
                                ? 'bg-red-50 dark:bg-red-500/15 text-red-600 dark:text-red-300'
                                : low
                                  ? 'bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300'
                                  : 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                            }`}
                            title={`Minimum ${product.min_stock} ${product.unit}`}
                          >
                            {formatNumber(product.stock)} {product.unit}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-1">
                            {isAdmin ? (
                              <>
                                <IconAction label="Stok masuk" onClick={() => { setStockTarget({ product, mode: 'in' }); setStockQty(''); setStockNotes(''); }}>
                                  ↓
                                </IconAction>
                                <IconAction label="Stok keluar" onClick={() => { setStockTarget({ product, mode: 'out' }); setStockQty(''); setStockNotes(''); }}>
                                  ↑
                                </IconAction>
                                <IconAction label="Stok opname" onClick={() => { setStockTarget({ product, mode: 'adjust' }); setStockQty(String(product.stock)); setStockNotes(''); }}>
                                  ⚖
                                </IconAction>
                                <IconAction label="Riwayat stok" onClick={() => openHistory(product)}>
                                  🕘
                                </IconAction>
                                <IconAction label="Edit produk" onClick={() => openEdit(product)}>
                                  ✎
                                </IconAction>
                                <IconAction label="Hapus produk" danger onClick={() => setDeleting(product)}>
                                  🗑
                                </IconAction>
                              </>
                            ) : (
                              <span className="text-xs text-ink-subtle">Hanya admin</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <Pagination total={total} limit={PAGE_SIZE} offset={offset} onChange={setOffset} unit="produk" />
          </>
        )}
      </div>

      <Modal
        open={formOpen}
        title={editing ? 'Edit Produk' : 'Tambah Produk'}
        description={editing ? 'Perubahan stok di sini otomatis tercatat sebagai penyesuaian.' : undefined}
        size="lg"
        disableBackdropClose
        onClose={() => setFormOpen(false)}
      >
        <form onSubmit={submitForm} className="space-y-4">
          <TextField
            label="Nama Produk"
            required
            maxLength={200}
            value={form.name}
            error={fieldErrors.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
          />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <TextField
              label="Harga Jual"
              type="number"
              min={0}
              required
              value={form.price}
              error={fieldErrors.price}
              onChange={(event) => setForm({ ...form, price: event.target.value })}
            />
            <TextField
              label="Harga Modal"
              type="number"
              min={0}
              value={form.cost_price}
              error={fieldErrors.cost_price}
              hint="Dipakai menghitung laba"
              onChange={(event) => setForm({ ...form, cost_price: event.target.value })}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <TextField
              label="Stok"
              type="number"
              min={0}
              value={form.stock}
              error={fieldErrors.stock}
              onChange={(event) => setForm({ ...form, stock: event.target.value })}
            />
            <TextField
              label="Stok Minimum"
              type="number"
              min={0}
              value={form.min_stock}
              error={fieldErrors.min_stock}
              hint="Batas peringatan"
              onChange={(event) => setForm({ ...form, min_stock: event.target.value })}
            />
            <TextField
              label="Satuan"
              maxLength={20}
              value={form.unit}
              error={fieldErrors.unit}
              placeholder="pcs"
              onChange={(event) => setForm({ ...form, unit: event.target.value })}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <TextField
                label="Kategori"
                required
                list="kategori-produk"
                maxLength={50}
                value={form.category}
                error={fieldErrors.category}
                hint="Pilih yang ada atau ketik kategori baru"
                onChange={(event) => setForm({ ...form, category: event.target.value })}
              />
              <datalist id="kategori-produk">
                {categories.map((item) => (
                  <option key={item} value={item} />
                ))}
              </datalist>
            </div>
            <TextField
              label="Barcode"
              maxLength={50}
              value={form.barcode}
              error={fieldErrors.barcode}
              hint="Opsional, harus unik"
              onChange={(event) => setForm({ ...form, barcode: event.target.value })}
            />
          </div>

          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
            <Button variant="secondary" onClick={() => setFormOpen(false)} disabled={saving}>
              Batal
            </Button>
            <Button type="submit" loading={saving}>
              {editing ? 'Simpan Perubahan' : 'Tambah Produk'}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={stockTarget !== null}
        title={stockTarget ? STOCK_MODES[stockTarget.mode].title : ''}
        description={stockTarget ? `${stockTarget.product.name} — stok saat ini ${stockTarget.product.stock} ${stockTarget.product.unit}` : undefined}
        size="sm"
        disableBackdropClose
        onClose={() => setStockTarget(null)}
      >
        {stockTarget && (
          <form onSubmit={submitStock} className="space-y-4">
            <TextField
              label={STOCK_MODES[stockTarget.mode].label}
              type="number"
              min={stockTarget.mode === 'adjust' ? 0 : 1}
              required
              value={stockQty}
              onChange={(event) => setStockQty(event.target.value)}
              hint={
                stockTarget.mode === 'adjust'
                  ? 'Masukkan hasil hitung fisik, bukan selisihnya'
                  : undefined
              }
            />
            <TextAreaField
              label="Catatan"
              rows={2}
              required={stockTarget.mode !== 'in'}
              value={stockNotes}
              onChange={(event) => setStockNotes(event.target.value)}
              placeholder={
                stockTarget.mode === 'in'
                  ? 'Contoh: kiriman dari PT Sumber Rejeki'
                  : stockTarget.mode === 'out'
                    ? 'Contoh: barang rusak / kedaluwarsa'
                    : 'Contoh: hasil stok opname bulanan'
              }
            />
            <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
              <Button variant="secondary" onClick={() => setStockTarget(null)} disabled={stockSaving}>
                Batal
              </Button>
              <Button type="submit" loading={stockSaving}>
                Simpan
              </Button>
            </div>
          </form>
        )}
      </Modal>

      <Modal
        open={historyOf !== null}
        title="Riwayat Stok"
        description={historyOf?.name}
        size="lg"
        onClose={() => setHistoryOf(null)}
      >
        {historyLoading ? (
          <TableSkeleton rows={4} columns={4} />
        ) : history.length === 0 ? (
          <EmptyState icon="🕘" title="Belum ada pergerakan stok" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead className="bg-surface-2 text-left text-xs uppercase tracking-wide text-ink-muted">
                <tr>
                  <th className="px-3 py-2 font-semibold">Waktu</th>
                  <th className="px-3 py-2 font-semibold">Jenis</th>
                  <th className="px-3 py-2 text-right font-semibold">Perubahan</th>
                  <th className="px-3 py-2 text-right font-semibold">Sisa</th>
                  <th className="px-3 py-2 font-semibold">Oleh</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line-soft">
                {history.map((row) => {
                  const movement = MOVEMENT_LABELS[row.type] ?? { label: row.type, className: 'bg-surface-3 text-ink-muted' };
                  return (
                    <tr key={row.id}>
                      <td className="whitespace-nowrap px-3 py-2 text-ink-muted">
                        {formatDateTime(row.created_at, tzOffset)}
                      </td>
                      <td className="px-3 py-2">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${movement.className}`}>
                          {movement.label}
                        </span>
                        {row.notes && <p className="mt-0.5 text-xs text-ink-subtle">{row.notes}</p>}
                      </td>
                      <td
                        className={`px-3 py-2 text-right font-semibold ${
                          row.quantity >= 0 ? 'text-emerald-600 dark:text-emerald-300' : 'text-red-600 dark:text-red-300'
                        }`}
                      >
                        {row.quantity >= 0 ? '+' : ''}
                        {formatNumber(row.quantity)}
                      </td>
                      <td className="px-3 py-2 text-right text-ink-muted">{formatNumber(row.stock_after)}</td>
                      <td className="px-3 py-2 text-ink-muted">{row.user_name}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={deleting !== null}
        title="Hapus produk?"
        destructive
        loading={deleteLoading}
        confirmLabel="Ya, hapus"
        message={
          <>
            Produk <strong>{deleting?.name}</strong> akan disembunyikan dari daftar dan kasir. Riwayat transaksi yang
            sudah ada tetap tersimpan dan tidak berubah.
          </>
        }
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      />
    </>
  );
}

function IconAction({
  label,
  onClick,
  danger = false,
  children,
}: {
  label: string;
  onClick: () => void;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className={`rounded-lg p-1.5 text-sm transition-colors ${
        danger ? 'text-ink-subtle hover:bg-red-50 dark:hover:bg-red-500/15 hover:text-red-600 dark:hover:text-red-300' : 'text-ink-muted hover:bg-surface-3 hover:text-ink'
      }`}
    >
      {children}
    </button>
  );
}

