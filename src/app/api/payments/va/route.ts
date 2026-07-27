import { z } from 'zod';
import { requireAuth } from '@/lib/auth';
import { attachVaDetails, getTransactionById, recordPaymentEvent } from '@/lib/db';
import { badRequest, conflict, forbidden, json, notFound, readBody, route } from '@/lib/http';
import { chargeVirtualAccount } from '@/lib/midtrans';
import { singleFlight } from '@/lib/single-flight';
import { VA_BANKS } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const schema = z.object({
  transaction_id: z.string().min(1),
  bank: z.enum(VA_BANKS, { message: 'Bank tidak didukung' }),
});

interface VaResult {
  bank: string;
  va_number: string;
  expires_at: string;
  reused: boolean;
}

/** Menerbitkan nomor Virtual Account untuk transaksi yang menunggu pembayaran. */
export const POST = route(async (request) => {
  const session = await requireAuth();
  const { transaction_id, bank } = await readBody(request, schema);

  const tx = getTransactionById(transaction_id);
  if (!tx) throw notFound('Transaksi tidak ditemukan');
  if (session.role !== 'ADMIN' && tx.user_id !== session.id) {
    throw forbidden('Anda hanya bisa memproses transaksi Anda sendiri');
  }
  if (tx.payment_method !== 'va') throw badRequest('Transaksi ini bukan pembayaran Virtual Account');
  if (tx.payment_status === 'paid') throw conflict('Transaksi ini sudah lunas');
  if (tx.status !== 'pending') throw conflict('Transaksi ini sudah tidak menunggu pembayaran');

  const stillValid = (t: typeof tx) =>
    t.payment_va_number && t.payment_expires_at && new Date(`${t.payment_expires_at}Z`) > new Date();

  // Nomor VA yang sudah terbit dipakai ulang; bank tidak bisa diganti di tengah
  // jalan karena tagihannya sudah tercatat di gateway.
  if (stillValid(tx)) {
    return json({
      bank: tx.payment_va_bank!,
      va_number: tx.payment_va_number!,
      expires_at: tx.payment_expires_at!,
      reused: true,
    });
  }

  const result = await singleFlight<VaResult>(`va:${tx.id}`, async () => {
    const fresh = getTransactionById(tx.id);
    if (fresh && stillValid(fresh)) {
      return {
        bank: fresh.payment_va_bank!,
        va_number: fresh.payment_va_number!,
        expires_at: fresh.payment_expires_at!,
        reused: true,
      };
    }

    const charge = await chargeVirtualAccount(tx.invoice_no, tx.total, bank);
    attachVaDetails(tx.id, {
      orderId: charge.orderId,
      bank: charge.bank,
      vaNumber: charge.vaNumber,
      expiresAt: charge.expiresAt,
    });
    recordPaymentEvent({
      transactionId: tx.id,
      provider: 'midtrans',
      orderId: charge.orderId,
      providerRef: charge.providerRef,
      status: 'pending',
      amount: tx.total,
      raw: charge.raw,
    });

    return { bank: charge.bank, va_number: charge.vaNumber, expires_at: charge.expiresAt, reused: false };
  });

  return json(result, result.reused ? 200 : 201);
});
