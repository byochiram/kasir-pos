'use client';

import { useMemo, useState } from 'react';
import { api, errorFields, errorMessage, qs } from '@/lib/api-client';
import { formatDate, formatDateTime, formatNumber, formatPlainDate, formatRupiah, todayInStore } from '@/lib/format';
import { useFetch } from '@/hooks/useFetch';
import { usePagedResource } from '@/hooks/usePagedResource';
import { useApp } from '@/components/AppProvider';
import { useToast } from '@/components/ui/Toast';
import PageHeader from '@/components/PageHeader';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import Pagination from '@/components/ui/Pagination';
import { SelectField, TextAreaField, TextField } from '@/components/ui/Field';
import { EmptyState, ErrorState, TableSkeleton } from '@/components/ui/States';
import {
  PO_STATUSES,
  PO_STATUS_LABELS,
  type Paginated,
  type Product,
  type PurchaseOrderStatus,
  type PurchaseOrderWithRelations,
  type Supplier,
} from '@/lib/types';

const PAGE_SIZE = 20;

const STATUS_BADGE: Record<PurchaseOrderStatus, string> = {
  draft: 'bg-surface-3 text-ink-muted',
  ordered: 'bg-sky-50 dark:bg-sky-500/15 text-sky-700 dark:text-sky-300',
  received: 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  cancelled: 'bg-red-50 dark:bg-red-500/15 text-red-600 dark:text-red-300',
};

interface DraftLine {
  product_id: string;
  quantity: string;
  cost_price: string;
}

const emptyLine = (): DraftLine => ({ product_id: '', quantity: '1', cost_price: '' });

export default function PurchaseOrdersPage() {
  const { tzOffset } = useApp();
  const toast = useToast();
  const today = todayInStore(tzOffset);

  const [search, setSearchValue] = useState('');
  const [status, setStatusValue] = useState<PurchaseOrderStatus | ''>('');
  const [offset, setOffset] = useState(0);

  function setSearch(value: string) {
    setSearchValue(value);
    setOffset(0);
  }
  function setStatus(value: PurchaseOrderStatus | '') {
    setStatusValue(value);
    setOffset(0);
  }

  const url = useMemo(
    () => `/api/purchase-orders${qs({ search, status: status || undefined, limit: PAGE_SIZE, offset })}`,
    [search, status, offset],
  );
  const { items, total, loading, error, reload } = usePagedResource<PurchaseOrderWithRelations>(url, {
    debounceMs: 300,
  });

  const { data: supplierData } = useFetch<Paginated<Supplier>>(`/api/suppliers${qs({ limit: 200 })}`);
  const { data: productData } = useFetch<Paginated<Product>>(`/api/products${qs({ limit: 200 })}`);
  const suppliers = supplierData?.data ?? [];
  const products = useMemo(() => productData?.data ?? [], [productData]);
  const productById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<PurchaseOrderWithRelations | null>(null);
  const [supplierId, setSupplierId] = useState('');
  const [orderDate, setOrderDate] = useState(today);
  const [expectedDate, setExpectedDate] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<DraftLine[]>([emptyLine()]);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const [detail, setDetail] = useState<PurchaseOrderWithRelations | null>(null);
  const [pendingAction, setPendingAction] = useState<{
    po: PurchaseOrderWithRelations;
    action: PurchaseOrderStatus | 'delete';
  } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const draftTotal = lines.reduce(
    (sum, line) => sum + (Number.parseInt(line.quantity, 10) || 0) * (Number.parseInt(line.cost_price, 10) || 0),
    0,
  );

  function openCreate() {
    setEditing(null);
    setSupplierId(suppliers[0]?.id ?? '');
    setOrderDate(today);
    setExpectedDate('');
    setNotes('');
    setLines([emptyLine()]);
    setFieldErrors({});
    setFormOpen(true);
  }

  function openEdit(po: PurchaseOrderWithRelations) {
    setEditing(po);
    setSupplierId(po.supplier_id);
    setOrderDate(po.order_date);
    setExpectedDate(po.expected_date ?? '');
    setNotes(po.notes ?? '');
    setLines(
      po.items.map((item) => ({
        product_id: item.product_id,
        quantity: String(item.quantity),
        cost_price: String(item.cost_price),
      })),
    );
    setFieldErrors({});
    setFormOpen(true);
  }

  /** Mengisi harga modal terakhir produk supaya tidak perlu diketik ulang. */
  function setLineProduct(index: number, productId: string) {
    setLines((prev) =>
      prev.map((line, i) => {
        if (i !== index) return line;
        const product = productById.get(productId);
        const suggested = product && !line.cost_price ? String(product.cost_price) : line.cost_price;
        return { ...line, product_id: productId, cost_price: suggested };
      }),
    );
  }

  async function submitForm(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setFieldErrors({});
    try {
      const payload = {
        supplier_id: supplierId,
        order_date: orderDate,
        expected_date: expectedDate || null,
        notes,
        items: lines
          .filter((line) => line.product_id)
          .map((line) => ({
            product_id: line.product_id,
            quantity: line.quantity,
            cost_price: line.cost_price || 0,
          })),
      };
      if (editing) {
        await api.put(`/api/purchase-orders/${editing.id}`, payload);
        toast.success(`${editing.po_no} diperbarui`);
      } else {
        const created = await api.post<PurchaseOrderWithRelations>('/api/purchase-orders', payload);
        toast.success(`${created.po_no} dibuat sebagai draft`);
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

  async function runAction() {
    if (!pendingAction) return;
    const { po, action } = pendingAction;
    setActionLoading(true);
    try {
      if (action === 'delete') {
        await api.delete(`/api/purchase-orders/${po.id}`);
        toast.success(`${po.po_no} dihapus`);
      } else {
        const updated = await api.post<PurchaseOrderWithRelations>(`/api/purchase-orders/${po.id}/status`, {
          status: action,
        });
        toast.success(
          action === 'received'
            ? `${po.po_no} diterima — stok ${updated.items.length} produk bertambah`
            : `${po.po_no} ditandai ${PO_STATUS_LABELS[action].toLowerCase()}`,
        );
        if (detail?.id === po.id) setDetail(updated);
      }
      setPendingAction(null);
      reload();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setActionLoading(false);
    }
  }

  const actionCopy: Record<string, { title: string; confirm: string; message: React.ReactNode; danger: boolean }> = {
    ordered: {
      title: 'Tandai sebagai dipesan?',
      confirm: 'Ya, tandai dipesan',
      message: 'Setelah dipesan, isi PO tidak bisa diubah lagi. Stok belum bertambah sampai barangnya diterima.',
      danger: false,
    },
    received: {
      title: 'Terima barang?',
      confirm: 'Ya, barang diterima',
      message: (
        <>
          Stok setiap produk dalam PO ini akan <strong>bertambah</strong>, dan harga modalnya diperbarui mengikuti
          harga beli di PO. Tindakan ini tidak bisa dibatalkan.
        </>
      ),
      danger: false,
    },
    cancelled: {
      title: 'Batalkan PO?',
      confirm: 'Ya, batalkan',
      message: 'PO ditandai dibatalkan dan tidak bisa diproses lagi. Stok tidak berubah.',
      danger: true,
    },
    delete: {
      title: 'Hapus draft PO?',
      confirm: 'Ya, hapus',
      message: 'Draft ini akan dihapus permanen.',
      danger: true,
    },
  };

  return (
    <>
      <PageHeader
        title="Purchase Order"
        description={`${formatNumber(total)} PO — pemesanan barang ke supplier`}
        actions={
          <Button onClick={openCreate} disabled={suppliers.length === 0}>
            <span aria-hidden>+</span> Buat PO
          </Button>
        }
      />

      {suppliers.length === 0 && (
        <div className="mb-4 rounded-xl border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/15 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
          Belum ada supplier terdaftar. Tambahkan supplier dulu di halaman Supplier sebelum membuat PO.
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-sm">
        <div className="flex flex-col gap-2 border-b border-line p-3 sm:flex-row">
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Cari nomor PO atau supplier..."
            aria-label="Cari purchase order"
            className="min-w-0 flex-1 rounded-xl border border-line px-3.5 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
          />
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value as PurchaseOrderStatus | '')}
            aria-label="Filter status"
            className="rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm outline-none focus:border-emerald-500"
          >
            <option value="">Semua Status</option>
            {PO_STATUSES.map((item) => (
              <option key={item} value={item}>
                {PO_STATUS_LABELS[item]}
              </option>
            ))}
          </select>
        </div>

        {loading ? (
          <TableSkeleton columns={6} />
        ) : error ? (
          <div className="p-4">
            <ErrorState message={error} onRetry={reload} />
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            icon="📋"
            title="Belum ada purchase order"
            description="Buat PO untuk mencatat pemesanan barang, lalu terima barangnya agar stok bertambah otomatis."
            action={suppliers.length > 0 ? <Button onClick={openCreate}>Buat PO</Button> : undefined}
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-sm">
                <thead className="bg-surface-2 text-left text-xs uppercase tracking-wide text-ink-muted">
                  <tr>
                    <th className="px-4 py-3 font-semibold">No. PO</th>
                    <th className="px-4 py-3 font-semibold">Supplier</th>
                    <th className="px-4 py-3 font-semibold">Tgl Pesan</th>
                    <th className="px-4 py-3 font-semibold">Perkiraan Tiba</th>
                    <th className="px-4 py-3 text-center font-semibold">Item</th>
                    <th className="px-4 py-3 text-right font-semibold">Total</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 text-right font-semibold">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line-soft">
                  {items.map((po) => (
                    <tr key={po.id} className="transition-colors hover:bg-surface-2">
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => setDetail(po)}
                          className="font-mono text-xs font-semibold text-ink hover:text-emerald-600 dark:hover:text-emerald-300 hover:underline"
                        >
                          {po.po_no}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-ink">{po.supplier_name}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-ink-muted">{formatPlainDate(po.order_date)}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-ink-muted">
                        {po.expected_date ? formatPlainDate(po.expected_date) : '-'}
                      </td>
                      <td className="px-4 py-3 text-center text-ink-muted">{po.items.length}</td>
                      <td className="px-4 py-3 text-right font-semibold text-ink">{formatRupiah(po.total)}</td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_BADGE[po.status]}`}>
                          {PO_STATUS_LABELS[po.status]}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          <IconButton label="Lihat detail" onClick={() => setDetail(po)}>
                            👁
                          </IconButton>
                          {po.status === 'draft' && (
                            <>
                              <IconButton label="Edit PO" onClick={() => openEdit(po)}>
                                ✎
                              </IconButton>
                              <IconButton
                                label="Tandai dipesan"
                                onClick={() => setPendingAction({ po, action: 'ordered' })}
                              >
                                📤
                              </IconButton>
                              <IconButton label="Hapus draft" danger onClick={() => setPendingAction({ po, action: 'delete' })}>
                                🗑
                              </IconButton>
                            </>
                          )}
                          {po.status === 'ordered' && (
                            <>
                              <IconButton
                                label="Terima barang"
                                onClick={() => setPendingAction({ po, action: 'received' })}
                              >
                                📦
                              </IconButton>
                              <IconButton
                                label="Batalkan PO"
                                danger
                                onClick={() => setPendingAction({ po, action: 'cancelled' })}
                              >
                                ⊘
                              </IconButton>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination total={total} limit={PAGE_SIZE} offset={offset} onChange={setOffset} unit="PO" />
          </>
        )}
      </div>

      <Modal
        open={formOpen}
        title={editing ? `Edit ${editing.po_no}` : 'Buat Purchase Order'}
        description="PO dibuat sebagai draft. Stok baru bertambah saat barang ditandai diterima."
        size="xl"
        disableBackdropClose
        onClose={() => setFormOpen(false)}
      >
        <form onSubmit={submitForm} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <SelectField
              label="Supplier"
              required
              value={supplierId}
              error={fieldErrors.supplier_id}
              onChange={(event) => setSupplierId(event.target.value)}
            >
              <option value="">Pilih supplier</option>
              {suppliers.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.name}
                </option>
              ))}
            </SelectField>
            <TextField
              label="Tanggal Pesan"
              type="date"
              required
              value={orderDate}
              error={fieldErrors.order_date}
              onChange={(event) => setOrderDate(event.target.value)}
            />
            <TextField
              label="Perkiraan Tiba"
              type="date"
              value={expectedDate}
              error={fieldErrors.expected_date}
              hint="Opsional"
              onChange={(event) => setExpectedDate(event.target.value)}
            />
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-medium text-ink">
                Item Pesanan
                <span className="ml-0.5 text-red-500" aria-hidden>
                  *
                </span>
              </span>
              <Button variant="secondary" size="sm" onClick={() => setLines((prev) => [...prev, emptyLine()])}>
                + Tambah baris
              </Button>
            </div>
            {fieldErrors.items && <p className="mb-2 text-xs font-medium text-red-600 dark:text-red-300">{fieldErrors.items}</p>}

            <div className="space-y-2">
              {lines.map((line, index) => {
                const lineTotal =
                  (Number.parseInt(line.quantity, 10) || 0) * (Number.parseInt(line.cost_price, 10) || 0);
                return (
                  <div key={index} className="grid grid-cols-12 items-center gap-2">
                    <select
                      value={line.product_id}
                      onChange={(event) => setLineProduct(index, event.target.value)}
                      aria-label={`Produk baris ${index + 1}`}
                      className="col-span-12 rounded-xl border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-emerald-500 sm:col-span-5"
                    >
                      <option value="">Pilih produk</option>
                      {products.map((product) => (
                        <option key={product.id} value={product.id}>
                          {product.name}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      min={1}
                      value={line.quantity}
                      onChange={(event) =>
                        setLines((prev) =>
                          prev.map((l, i) => (i === index ? { ...l, quantity: event.target.value } : l)),
                        )
                      }
                      placeholder="Qty"
                      aria-label={`Jumlah baris ${index + 1}`}
                      className="col-span-3 rounded-xl border border-line px-3 py-2 text-sm outline-none focus:border-emerald-500 sm:col-span-2"
                    />
                    <input
                      type="number"
                      min={0}
                      value={line.cost_price}
                      onChange={(event) =>
                        setLines((prev) =>
                          prev.map((l, i) => (i === index ? { ...l, cost_price: event.target.value } : l)),
                        )
                      }
                      placeholder="Harga beli"
                      aria-label={`Harga beli baris ${index + 1}`}
                      className="col-span-5 rounded-xl border border-line px-3 py-2 text-sm outline-none focus:border-emerald-500 sm:col-span-3"
                    />
                    <span className="col-span-3 truncate text-right text-xs font-semibold text-ink sm:col-span-1">
                      {formatRupiah(lineTotal)}
                    </span>
                    <button
                      type="button"
                      onClick={() => setLines((prev) => (prev.length === 1 ? [emptyLine()] : prev.filter((_, i) => i !== index)))}
                      aria-label={`Hapus baris ${index + 1}`}
                      className="col-span-1 rounded-lg p-1.5 text-ink-subtle transition-colors hover:bg-red-50 dark:hover:bg-red-500/15 hover:text-red-600 dark:hover:text-red-300"
                    >
                      ✕
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="mt-3 flex justify-between border-t border-line pt-3 text-base font-bold">
              <span className="text-ink">Total Pesanan</span>
              <span className="text-emerald-600 dark:text-emerald-300">{formatRupiah(draftTotal)}</span>
            </div>
          </div>

          <TextAreaField
            label="Catatan"
            rows={2}
            value={notes}
            error={fieldErrors.notes}
            onChange={(event) => setNotes(event.target.value)}
          />

          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
            <Button variant="secondary" onClick={() => setFormOpen(false)} disabled={saving}>
              Batal
            </Button>
            <Button type="submit" loading={saving}>
              {editing ? 'Simpan Perubahan' : 'Buat PO'}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={detail !== null}
        title={detail?.po_no ?? ''}
        description={detail ? `${detail.supplier_name} — ${PO_STATUS_LABELS[detail.status]}` : undefined}
        size="lg"
        onClose={() => setDetail(null)}
      >
        {detail && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
              <Info label="Tanggal Pesan" value={formatPlainDate(detail.order_date)} />
              <Info label="Perkiraan Tiba" value={detail.expected_date ? formatPlainDate(detail.expected_date) : '-'} />
              <Info label="Dibuat oleh" value={`${detail.created_by_name} · ${formatDate(detail.created_at, tzOffset)}`} />
              <Info
                label="Diterima"
                value={
                  detail.received_at
                    ? `${detail.received_by_name ?? '-'} · ${formatDateTime(detail.received_at, tzOffset)}`
                    : 'Belum diterima'
                }
              />
            </div>

            <div className="overflow-x-auto rounded-xl border border-line">
              <table className="w-full min-w-[420px] text-sm">
                <thead className="bg-surface-2 text-left text-xs uppercase tracking-wide text-ink-muted">
                  <tr>
                    <th className="px-3 py-2 font-semibold">Produk</th>
                    <th className="px-3 py-2 text-center font-semibold">Qty</th>
                    <th className="px-3 py-2 text-right font-semibold">Harga Beli</th>
                    <th className="px-3 py-2 text-right font-semibold">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line-soft">
                  {detail.items.map((item) => (
                    <tr key={item.id}>
                      <td className="px-3 py-2 text-ink">{item.product_name}</td>
                      <td className="px-3 py-2 text-center text-ink-muted">{formatNumber(item.quantity)}</td>
                      <td className="px-3 py-2 text-right text-ink-muted">{formatRupiah(item.cost_price)}</td>
                      <td className="px-3 py-2 text-right font-medium text-ink">{formatRupiah(item.subtotal)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-line bg-surface-2">
                    <td colSpan={3} className="px-3 py-2 text-right font-semibold text-ink">
                      Total
                    </td>
                    <td className="px-3 py-2 text-right font-bold text-emerald-600 dark:text-emerald-300">{formatRupiah(detail.total)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {detail.notes && (
              <div className="rounded-xl border border-line p-3 text-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Catatan</p>
                <p className="mt-1 text-ink">{detail.notes}</p>
              </div>
            )}
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={pendingAction !== null}
        title={pendingAction ? actionCopy[pendingAction.action].title : ''}
        confirmLabel={pendingAction ? actionCopy[pendingAction.action].confirm : ''}
        destructive={pendingAction ? actionCopy[pendingAction.action].danger : false}
        loading={actionLoading}
        message={
          pendingAction && (
            <>
              <strong>{pendingAction.po.po_no}</strong> — {pendingAction.po.supplier_name},{' '}
              {formatRupiah(pendingAction.po.total)}
              <br />
              <br />
              {actionCopy[pendingAction.action].message}
            </>
          )
        }
        onConfirm={runAction}
        onCancel={() => setPendingAction(null)}
      />
    </>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-line p-3">
      <p className="text-xs uppercase tracking-wide text-ink-muted">{label}</p>
      <p className="mt-0.5 font-medium text-ink">{value}</p>
    </div>
  );
}

function IconButton({
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
        danger
          ? 'text-ink-subtle hover:bg-red-50 dark:hover:bg-red-500/15 hover:text-red-600 dark:hover:text-red-300'
          : 'text-ink-muted hover:bg-surface-3 hover:text-ink'
      }`}
    >
      {children}
    </button>
  );
}
