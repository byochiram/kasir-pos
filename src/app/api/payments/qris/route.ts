import { z } from 'zod';
import { requireAuth } from '@/lib/auth';
import { attachPaymentDetails, getLastQrString, getTransactionById, recordPaymentEvent } from '@/lib/db';
import { badRequest, conflict, forbidden, json, notFound, readBody, route } from '@/lib/http';
import { chargeQris, isSandbox } from '@/lib/midtrans';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const schema = z.object({ transaction_id: z.string().min(1) });

/** Membuatkan kode QR untuk transaksi yang sudah dibuat dan berstatus pending. */
export const POST = route(async (request) => {
  const session = await requireAuth();
  const { transaction_id } = await readBody(request, schema);

  const tx = getTransactionById(transaction_id);
  if (!tx) throw notFound('Transaksi tidak ditemukan');
  if (session.role !== 'ADMIN' && tx.user_id !== session.id) {
    throw forbidden('Anda hanya bisa memproses transaksi Anda sendiri');
  }
  if (tx.payment_method !== 'qris_online') throw badRequest('Transaksi ini bukan pembayaran QRIS');
  if (tx.payment_status === 'paid') throw conflict('Transaksi ini sudah lunas');
  if (tx.status !== 'pending') throw conflict('Transaksi ini sudah tidak menunggu pembayaran');

  // QR yang masih berlaku dipakai ulang, jangan buat tagihan ganda di gateway.
  if (tx.payment_qr_url && tx.payment_expires_at && new Date(`${tx.payment_expires_at}Z`) > new Date()) {
    return json({
      qr_url: tx.payment_qr_url,
      qr_string: isSandbox() ? getLastQrString(tx.id) : null,
      expires_at: tx.payment_expires_at,
      sandbox: isSandbox(),
      reused: true,
    });
  }

  const charge = await chargeQris(tx.invoice_no, tx.total);
  attachPaymentDetails(tx.id, { orderId: charge.orderId, qrUrl: charge.qrUrl, expiresAt: charge.expiresAt });
  recordPaymentEvent({
    transactionId: tx.id,
    provider: 'midtrans',
    orderId: charge.orderId,
    providerRef: charge.providerRef,
    status: 'pending',
    amount: tx.total,
    raw: charge.raw,
  });

  return json(
    {
      qr_url: charge.qrUrl,
      // Hanya di sandbox: dipakai menempel ke simulator Midtrans untuk menguji
      // pembayaran. Di produksi tidak ada gunanya, jadi tidak dikirim.
      qr_string: isSandbox() ? charge.qrString : null,
      expires_at: charge.expiresAt,
      sandbox: isSandbox(),
      reused: false,
    },
    201,
  );
});
