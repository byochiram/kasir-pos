'use client';

import { formatDateTime, formatRupiah } from '@/lib/format';
import type { Settings, TransactionWithRelations } from '@/lib/types';

const PAYMENT_LABELS: Record<string, string> = {
  cash: 'Tunai',
  qris: 'QRIS',
  transfer: 'Transfer',
  debit: 'Kartu Debit',
};

interface ReceiptProps {
  transaction: TransactionWithRelations;
  settings: Settings | null;
  tzOffset: number;
}

/**
 * Struk 80mm. Elemen ini yang di-print — `#receipt-print` dipakai oleh aturan
 * @media print di globals.css untuk menyembunyikan sisa halaman.
 */
export default function Receipt({ transaction, settings, tzOffset }: ReceiptProps) {
  const storeName = settings?.store_name ?? 'KasirApp';

  return (
    <div id="receipt-print" className="font-mono text-[13px] leading-relaxed text-ink">
      <div className="text-center">
        <h3 className="text-base font-bold uppercase">{storeName}</h3>
        {settings?.store_address && <p className="text-[11px] text-ink-muted">{settings.store_address}</p>}
        {settings?.store_phone && <p className="text-[11px] text-ink-muted">Telp {settings.store_phone}</p>}
      </div>

      <div className="my-2.5 border-t border-dashed border-line" />

      <div className="space-y-0.5 text-[11px] text-ink-muted">
        <div className="flex justify-between">
          <span>No. Invoice</span>
          <span className="font-semibold text-ink">{transaction.invoice_no}</span>
        </div>
        <div className="flex justify-between">
          <span>Waktu</span>
          <span>{formatDateTime(transaction.created_at, tzOffset)}</span>
        </div>
        <div className="flex justify-between">
          <span>Kasir</span>
          <span>{transaction.user_name}</span>
        </div>
        {transaction.customer_name && (
          <div className="flex justify-between">
            <span>Pelanggan</span>
            <span>{transaction.customer_name}</span>
          </div>
        )}
      </div>

      <div className="my-2.5 border-t border-dashed border-line" />

      <div className="space-y-1.5">
        {transaction.items.map((item) => (
          <div key={item.id}>
            <p className="font-medium">{item.product_name}</p>
            <div className="flex justify-between text-[12px] text-ink-muted">
              <span>
                {item.quantity} × {formatRupiah(item.price)}
                {item.discount > 0 && (
                  <span className="text-red-600 dark:text-red-300">
                    {' '}
                    (disk {item.discount_type === 'percent' ? `${item.discount}%` : formatRupiah(item.discount)})
                  </span>
                )}
              </span>
              <span className="font-medium text-ink">{formatRupiah(item.subtotal)}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="my-2.5 border-t border-dashed border-line" />

      <div className="space-y-1 text-[12px]">
        <div className="flex justify-between">
          <span className="text-ink-muted">Subtotal</span>
          <span>{formatRupiah(transaction.subtotal)}</span>
        </div>
        {transaction.discount_amount > 0 && (
          <div className="flex justify-between text-red-600 dark:text-red-300">
            <span>Diskon{transaction.discount_type === 'percent' ? ` (${transaction.discount}%)` : ''}</span>
            <span>-{formatRupiah(transaction.discount_amount)}</span>
          </div>
        )}
        {transaction.tax_amount > 0 && (
          <div className="flex justify-between">
            <span className="text-ink-muted">Pajak ({transaction.tax_rate}%)</span>
            <span>{formatRupiah(transaction.tax_amount)}</span>
          </div>
        )}
        <div className="flex justify-between border-t border-line pt-1.5 text-sm font-bold">
          <span>TOTAL</span>
          <span>{formatRupiah(transaction.total)}</span>
        </div>
      </div>

      <div className="my-2.5 border-t border-dashed border-line" />

      <div className="space-y-1 text-[12px]">
        <div className="flex justify-between">
          <span className="text-ink-muted">Metode</span>
          <span>{PAYMENT_LABELS[transaction.payment_method] ?? transaction.payment_method}</span>
        </div>
        {transaction.payment_va_number && (
          <div className="flex justify-between">
            <span className="text-ink-muted">No. VA</span>
            <span className="font-mono">{transaction.payment_va_number}</span>
          </div>
        )}
        {/* Nomor bukti ikut dicetak agar struk pelanggan dan mutasi bank
            bisa dicocokkan tanpa membuka aplikasi. */}
        {transaction.payment_reference && (
          <div className="flex justify-between">
            <span className="text-ink-muted">No. Bukti</span>
            <span className="font-mono">{transaction.payment_reference}</span>
          </div>
        )}
        <div className="flex justify-between">
          <span className="text-ink-muted">Dibayar</span>
          <span>{formatRupiah(transaction.amount_paid)}</span>
        </div>
        <div className="flex justify-between font-semibold">
          <span className="text-ink-muted">Kembalian</span>
          <span>{formatRupiah(transaction.change)}</span>
        </div>
      </div>

      {transaction.status === 'voided' && (
        <p className="mt-3 border border-red-300 py-1 text-center text-xs font-bold uppercase text-red-600 dark:text-red-300">
          Transaksi Dibatalkan
        </p>
      )}

      <p className="mt-4 text-center text-[11px] text-ink-muted">
        {settings?.receipt_footer || 'Terima kasih atas kunjungan Anda!'}
      </p>
    </div>
  );
}
