'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { api, errorMessage } from '@/lib/api-client';
import { formatRupiah, parseUtc } from '@/lib/format';
import { useToast } from '@/components/ui/Toast';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import { Spinner } from '@/components/ui/States';
import type { TransactionWithRelations } from '@/lib/types';

interface QrisResponse {
  qr_url: string;
  expires_at: string;
  sandbox: boolean;
  reused: boolean;
}

interface StatusResponse {
  status: string;
  payment_status: string;
  transaction: TransactionWithRelations;
}

interface Props {
  transaction: TransactionWithRelations | null;
  /** Harus di-memo dengan useCallback: dipakai sebagai dependensi interval. */
  onPaid: (transaction: TransactionWithRelations) => void;
  onClose: () => void;
}

/** Jeda antar pemeriksaan status. Webhook tetap jalur utama; ini hanya cadangan. */
const POLL_INTERVAL_MS = 3000;

export default function QrisPaymentDialog({ transaction, onPaid, onClose }: Props) {
  return (
    <Modal
      open={transaction !== null}
      title="Pembayaran QRIS"
      description={transaction?.invoice_no}
      size="sm"
      disableBackdropClose
      onClose={onClose}
    >
      {/* key memaksa state dibuat ulang untuk tiap transaksi, sehingga tidak
          perlu effect khusus untuk mereset sisa state transaksi sebelumnya. */}
      {transaction && <QrisFlow key={transaction.id} transaction={transaction} onPaid={onPaid} onClose={onClose} />}
    </Modal>
  );
}

function QrisFlow({
  transaction,
  onPaid,
  onClose,
}: {
  transaction: TransactionWithRelations;
  onPaid: (transaction: TransactionWithRelations) => void;
  onClose: () => void;
}) {
  const toast = useToast();
  const [qr, setQr] = useState<QrisResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [settled, setSettled] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const transactionId = transaction.id;

  // Minta kode QR sekali saat dialog dibuka.
  useEffect(() => {
    let cancelled = false;
    api
      .post<QrisResponse>('/api/payments/qris', { transaction_id: transactionId })
      .then((result) => {
        if (!cancelled) setQr(result);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(errorMessage(err));
      });
    return () => {
      cancelled = true;
    };
  }, [transactionId]);

  // Pantau status sampai lunas, gagal, atau kedaluwarsa.
  useEffect(() => {
    if (!qr || settled) return;
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
            setError('Waktu pembayaran habis. Stok sudah dikembalikan, silakan ulangi transaksi.');
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
  }, [transactionId, qr, settled, onPaid]);

  // Detik berjalan disimpan sebagai state; sisa waktu diturunkan saat render.
  useEffect(() => {
    if (!qr || settled) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [qr, settled]);

  const deadline = qr?.expires_at ? parseUtc(qr.expires_at)?.getTime() : undefined;
  const secondsLeft = deadline ? Math.max(0, Math.round((deadline - now) / 1000)) : null;
  const nearlyExpired = secondsLeft !== null && secondsLeft < 60;

  function handleClose() {
    if (!settled && !error) {
      toast.info('Transaksi masih menunggu pembayaran dan bisa dilanjutkan dari halaman Transaksi.');
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
      ) : !qr ? (
        <div className="flex flex-col items-center gap-3 py-10">
          <Spinner className="h-8 w-8 border-4" />
          <p className="text-sm text-ink-muted">Membuat kode QR...</p>
        </div>
      ) : (
        <>
          {/* QR selalu di atas putih — pemindai kesulitan membaca QR berlatar gelap. */}
          <div className="mx-auto w-fit rounded-2xl border border-line bg-white p-3">
            <Image
              src={qr.qr_url}
              alt={`Kode QRIS untuk ${transaction.invoice_no}`}
              width={240}
              height={240}
              unoptimized
              className="h-60 w-60"
            />
          </div>

          <div className="flex items-center justify-center gap-2 text-sm">
            <Spinner className="h-4 w-4" />
            <span className="text-ink-muted">Menunggu pembayaran...</span>
          </div>

          {secondsLeft !== null && (
            <p className={`text-sm font-semibold ${nearlyExpired ? 'text-red-600 dark:text-red-300' : 'text-ink-muted'}`}>
              Berlaku {Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, '0')} lagi
            </p>
          )}

          <p className="text-xs text-ink-subtle">
            Minta pelanggan memindai dengan aplikasi bank atau e-wallet apa pun. Struk muncul otomatis begitu
            pembayaran masuk.
          </p>

          {/* Hanya muncul di sandbox: QR uji tidak bisa dibayar aplikasi sungguhan,
              jadi pengujian dilakukan lewat simulator Midtrans. */}
          {qr.sandbox && (
            <details className="rounded-xl border border-dashed border-line p-3 text-left">
              <summary className="cursor-pointer text-xs font-medium text-ink-muted">
                Mode sandbox — bayar lewat simulator
              </summary>
              <ol className="mt-2 list-decimal space-y-1 pl-4 text-xs text-ink-muted">
                <li>Salin URL gambar QR di bawah</li>
                <li>
                  Buka{' '}
                  <a
                    href="https://simulator.sandbox.midtrans.com/qris/index"
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium text-emerald-600 underline dark:text-emerald-300"
                  >
                    simulator QRIS Midtrans
                  </a>
                </li>
                <li>
                  Tempel ke kolom <strong>QR Code Image Url</strong>, lalu tekan bayar
                </li>
              </ol>
              {/* Simulator meminta URL gambar QR, bukan isi teks QR-nya. */}
              <input
                readOnly
                value={qr.qr_url}
                onFocus={(event) => event.currentTarget.select()}
                aria-label="URL gambar QR untuk simulator"
                className="mt-2 w-full rounded-lg border border-line bg-surface-2 p-2 font-mono text-[10px] text-ink-muted"
              />
              <Button
                variant="secondary"
                size="sm"
                className="mt-2 w-full"
                onClick={() => {
                  void navigator.clipboard.writeText(qr.qr_url);
                  toast.success('URL gambar QR disalin');
                }}
              >
                Salin URL gambar QR
              </Button>
            </details>
          )}
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
