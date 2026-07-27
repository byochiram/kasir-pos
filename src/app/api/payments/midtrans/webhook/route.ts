import { NextRequest } from 'next/server';
import {
  failTransaction,
  getTransactionByPaymentRef,
  markTransactionPaid,
  recordPaymentEvent,
} from '@/lib/db';
import { json } from '@/lib/http';
import { mapStatus, verifySignature, type WebhookPayload } from '@/lib/midtrans';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Penerima notifikasi pembayaran dari Midtrans.
 *
 * Endpoint ini sengaja tidak memakai wrapper `route()` maupun pengecekan sesi:
 * pemanggilnya adalah server Midtrans, bukan browser yang login. Keasliannya
 * dijamin oleh signature SHA-512, bukan oleh cookie.
 *
 * Midtrans menganggap notifikasi gagal dan mengirim ulang bila responsnya bukan
 * 2xx. Karena itu kesalahan yang tidak bisa diperbaiki dengan mengulang (mis.
 * signature palsu) tetap dibalas 200 dengan catatan, supaya tidak dikirim ulang
 * tanpa henti. Hanya kegagalan sementara yang dibalas 500 agar diulang.
 */
export async function POST(request: NextRequest): Promise<Response> {
  let payload: WebhookPayload;
  try {
    payload = (await request.json()) as WebhookPayload;
  } catch {
    return json({ received: true, note: 'payload bukan JSON' });
  }

  if (!payload?.order_id || !payload?.signature_key) {
    return json({ received: true, note: 'payload tidak lengkap' });
  }

  if (!verifySignature(payload)) {
    console.warn('[midtrans] signature tidak valid untuk order', payload.order_id);
    return json({ received: true, note: 'signature tidak valid' });
  }

  try {
    const tx = getTransactionByPaymentRef(payload.order_id);
    if (!tx) {
      // Bisa terjadi kalau notifikasi datang untuk order dari database lain
      // (mis. setelah restore backup). Tidak ada gunanya diulang.
      console.warn('[midtrans] transaksi tidak ditemukan untuk order', payload.order_id);
      return json({ received: true, note: 'transaksi tidak dikenal' });
    }

    // Nominal wajib cocok: notifikasi yang sah pun tidak boleh melunasi tagihan
    // dengan jumlah yang berbeda dari yang tercatat.
    const notifiedAmount = Math.round(Number.parseFloat(payload.gross_amount ?? '0'));
    if (notifiedAmount !== tx.total) {
      console.warn('[midtrans] nominal tidak cocok', payload.order_id, notifiedAmount, tx.total);
      return json({ received: true, note: 'nominal tidak cocok' });
    }

    const outcome = mapStatus(payload.transaction_status, payload.fraud_status);

    recordPaymentEvent({
      transactionId: tx.id,
      provider: 'midtrans',
      orderId: payload.order_id,
      providerRef: payload.transaction_id ?? null,
      status: outcome,
      amount: tx.total,
      raw: payload,
    });

    // markTransactionPaid dan failTransaction keduanya idempoten, jadi notifikasi
    // yang dikirim ulang tidak menggandakan poin maupun stok.
    if (outcome === 'paid') {
      markTransactionPaid(tx.id, payload.transaction_id ?? null);
    } else if (outcome === 'expired' || outcome === 'failed') {
      failTransaction(
        tx.id,
        outcome,
        outcome === 'expired' ? 'Kode QR kedaluwarsa' : `Pembayaran ${payload.transaction_status}`,
      );
    }

    return json({ received: true, outcome });
  } catch (error) {
    // Kegagalan tak terduga (mis. database terkunci) — minta Midtrans mengulang.
    console.error('[midtrans] gagal memproses notifikasi', payload.order_id, error);
    return json({ received: false }, 500);
  }
}
