'use client';

import { useEffect, useState } from 'react';
import { api, errorMessage } from '@/lib/api-client';
import { formatRupiah, parseUtc } from '@/lib/format';
import { useToast } from '@/components/ui/Toast';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import { Spinner } from '@/components/ui/States';
import { VA_BANK_LABELS, type TransactionWithRelations, type VaBank } from '@/lib/types';

interface VaResponse {
  bank: string;
  va_number: string;
  expires_at: string;
  reused: boolean;
}

interface StatusResponse {
  status: string;
  payment_status: string;
  transaction: TransactionWithRelations;
}

interface Props {
  transaction: TransactionWithRelations | null;
  bank: VaBank;
  /** Harus di-memo dengan useCallback: dipakai sebagai dependensi interval. */
  onPaid: (transaction: TransactionWithRelations) => void;
  onClose: () => void;
}

const POLL_INTERVAL_MS = 3000;

export default function VaPaymentDialog({ transaction, bank, onPaid, onClose }: Props) {
  return (
    <Modal
      open={transaction !== null}
      title="Transfer Virtual Account"
      description={transaction?.invoice_no}
      size="sm"
      disableBackdropClose
      onClose={onClose}
    >
      {transaction && (
        <VaFlow key={transaction.id} transaction={transaction} bank={bank} onPaid={onPaid} onClose={onClose} />
      )}
    </Modal>
  );
}

function VaFlow({
  transaction,
  bank,
  onPaid,
  onClose,
}: {
  transaction: TransactionWithRelations;
  bank: VaBank;
  onPaid: (transaction: TransactionWithRelations) => void;
  onClose: () => void;
}) {
  const toast = useToast();
  const [va, setVa] = useState<VaResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [settled, setSettled] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const transactionId = transaction.id;

  useEffect(() => {
    let cancelled = false;
    api
      .post<VaResponse>('/api/payments/va', { transaction_id: transactionId, bank })
      .then((result) => {
        if (!cancelled) setVa(result);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(errorMessage(err));
      });
    return () => {
      cancelled = true;
    };
  }, [transactionId, bank]);

  useEffect(() => {
    if (!va || settled) return;
    let cancelled = false;

    const timer = setInterval(() => {
      api
        .get<StatusResponse>(`/api/payments/status/${transactionId}`)
        .then((result) => {
          if (cancelled) return;
          if (result.payment_status === 'paid') {
            setSettled(true);
            onPaid(result.transaction);
          } else if (result.status === 'expired') {
            setSettled(true);
            setError('Batas waktu transfer habis. Stok sudah dikembalikan, silakan ulangi transaksi.');
          }
        })
        .catch(() => {
          // Jaringan terputus sesaat bukan alasan menghentikan pemantauan.
        });
    }, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [transactionId, va, settled, onPaid]);

  useEffect(() => {
    if (!va || settled) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [va, settled]);

  const deadline = va?.expires_at ? parseUtc(va.expires_at)?.getTime() : undefined;
  const secondsLeft = deadline ? Math.max(0, Math.round((deadline - now) / 1000)) : null;
  const nearlyExpired = secondsLeft !== null && secondsLeft < 120;

  function handleClose() {
    if (!settled && !error) {
      toast.info('Transaksi masih menunggu transfer dan bisa dilanjutkan dari halaman Transaksi.');
    }
    onClose();
  }

  return (
    <div className="space-y-4 text-center">
      <div>
        <p className="text-sm text-ink-muted">Total tagihan</p>
        <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-300">{formatRupiah(transaction.total)}</p>
      </div>

      {error ? (
        <div
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-6 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300"
          role="alert"
        >
          {error}
        </div>
      ) : !va ? (
        <div className="flex flex-col items-center gap-3 py-10">
          <Spinner className="h-8 w-8 border-4" />
          <p className="text-sm text-ink-muted">Menerbitkan nomor Virtual Account...</p>
        </div>
      ) : (
        <>
          <div className="rounded-2xl border border-line bg-surface-2 p-4">
            <p className="text-xs uppercase tracking-wide text-ink-muted">
              Virtual Account {VA_BANK_LABELS[va.bank as VaBank] ?? va.bank.toUpperCase()}
            </p>
            {/* tabular-nums supaya digitnya sejajar dan mudah dibacakan ke pelanggan. */}
            <p className="mt-1 break-all font-mono text-xl font-bold tabular-nums text-ink">{va.va_number}</p>
            <Button
              variant="secondary"
              size="sm"
              className="mt-3"
              onClick={() => {
                void navigator.clipboard.writeText(va.va_number);
                toast.success('Nomor VA disalin');
              }}
            >
              Salin nomor VA
            </Button>
          </div>

          <div className="flex items-center justify-center gap-2 text-sm">
            <Spinner className="h-4 w-4" />
            <span className="text-ink-muted">Menunggu transfer masuk...</span>
          </div>

          {secondsLeft !== null && (
            <p className={`text-sm font-semibold ${nearlyExpired ? 'text-red-600 dark:text-red-300' : 'text-ink-muted'}`}>
              Berlaku {Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, '0')} lagi
            </p>
          )}

          <p className="text-xs text-ink-subtle">
            Minta pelanggan transfer ke nomor VA di atas lewat m-banking atau ATM. Struk muncul otomatis begitu dana
            masuk.
          </p>

          <details className="rounded-xl border border-dashed border-line p-3 text-left">
            <summary className="cursor-pointer text-xs font-medium text-ink-muted">
              Mode sandbox — bayar lewat simulator
            </summary>
            <ol className="mt-2 list-decimal space-y-1 pl-4 text-xs text-ink-muted">
              <li>Salin nomor VA di atas</li>
              <li>
                Buka{' '}
                <a
                  href="https://simulator.sandbox.midtrans.com/"
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium text-emerald-600 underline dark:text-emerald-300"
                >
                  simulator Midtrans
                </a>{' '}
                → Virtual Account → {VA_BANK_LABELS[va.bank as VaBank] ?? va.bank.toUpperCase()}
              </li>
              <li>Tempel nomor VA, lalu tekan bayar</li>
            </ol>
          </details>
        </>
      )}

      <div className="flex justify-end pt-2">
        <Button variant="secondary" onClick={handleClose}>
          {error ? 'Tutup' : 'Batalkan'}
        </Button>
      </div>
    </div>
  );
}
