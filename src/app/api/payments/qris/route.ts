import { z } from 'zod';
import { requireAuth } from '@/lib/auth';
import { attachPaymentDetails, getTransactionById, recordPaymentEvent } from '@/lib/db';
import { badRequest, conflict, forbidden, json, notFound, readBody, route } from '@/lib/http';
import { chargeQris, isSandbox } from '@/lib/midtrans';
import { singleFlight } from '@/lib/single-flight';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const schema = z.object({ transaction_id: z.string().min(1) });

interface QrisResult {
  qr_url: string;
  expires_at: string;
  sandbox: boolean;
  reused: boolean;
}

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

  const stillValid = (transaction: typeof tx) =>
    transaction.payment_qr_url &&
    transaction.payment_expires_at &&
    new Date(`${transaction.payment_expires_at}Z`) > new Date();

  // QR yang masih berlaku dipakai ulang, jangan buat tagihan ganda di gateway.
  if (stillValid(tx)) {
    return json({
      qr_url: tx.payment_qr_url!,
      expires_at: tx.payment_expires_at!,
      sandbox: isSandbox(),
      reused: true,
    });
  }

  const result = await singleFlight<QrisResult>(`qris:${tx.id}`, async () => {
    // Dibaca ulang di dalam kunci: permintaan sebelumnya mungkin baru saja
    // menyimpan QR-nya beberapa milidetik lalu.
    const fresh = getTransactionById(tx.id);
    if (fresh && stillValid(fresh)) {
      return {
        qr_url: fresh.payment_qr_url!,
        expires_at: fresh.payment_expires_at!,
        sandbox: isSandbox(),
        reused: true,
      };
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

    return { qr_url: charge.qrUrl, expires_at: charge.expiresAt, sandbox: isSandbox(), reused: false };
  });

  return json(result, result.reused ? 200 : 201);
});
