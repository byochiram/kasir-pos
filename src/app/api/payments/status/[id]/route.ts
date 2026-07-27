import { requireAuth } from '@/lib/auth';
import { failTransaction, getTransactionById, markTransactionPaid, recordPaymentEvent } from '@/lib/db';
import { forbidden, json, notFound, route } from '@/lib/http';
import { checkStatus, isMidtransConfigured } from '@/lib/midtrans';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Dipanggil berkala oleh layar kasir selama menunggu pembayaran.
 *
 * Webhook tetap jalur utama, tapi bisa telat atau gagal terkirim — misalnya saat
 * server sempat mati. Pemeriksaan langsung ke gateway ini membuat layar kasir
 * tetap benar tanpa bergantung pada webhook.
 */
export const GET = route(async (_request, { params }) => {
  const session = await requireAuth();
  const { id } = await params;

  let tx = getTransactionById(id);
  if (!tx) throw notFound('Transaksi tidak ditemukan');
  if (session.role !== 'ADMIN' && tx.user_id !== session.id) {
    throw forbidden('Anda hanya bisa melihat transaksi Anda sendiri');
  }

  // Sudah selesai — tidak perlu menanyakan gateway lagi.
  if (tx.status !== 'pending' || !tx.payment_ref || !isMidtransConfigured()) {
    return json({ status: tx.status, payment_status: tx.payment_status, transaction: tx });
  }

  const remote = await checkStatus(tx.payment_ref);

  if (remote.outcome === 'paid') {
    recordPaymentEvent({
      transactionId: tx.id,
      provider: 'midtrans',
      orderId: tx.payment_ref,
      providerRef: remote.providerRef,
      status: 'paid',
      amount: tx.total,
      raw: remote.raw,
    });
    tx = markTransactionPaid(tx.id, remote.providerRef);
  } else if (remote.outcome === 'expired' || remote.outcome === 'failed') {
    recordPaymentEvent({
      transactionId: tx.id,
      provider: 'midtrans',
      orderId: tx.payment_ref,
      providerRef: remote.providerRef,
      status: remote.outcome,
      amount: tx.total,
      raw: remote.raw,
    });
    tx = failTransaction(
      tx.id,
      remote.outcome,
      remote.outcome === 'expired' ? 'Kode QR kedaluwarsa' : 'Pembayaran ditolak gateway',
    );
  }

  return json({ status: tx.status, payment_status: tx.payment_status, transaction: tx });
});
