import { createHash } from 'crypto';
import { AppError, badRequest } from './http';

/**
 * Klien Midtrans Core API seperlunya untuk QRIS.
 *
 * Sandbox tidak butuh verifikasi badan usaha: daftar di
 * https://dashboard.sandbox.midtrans.com, ambil Server Key di
 * Settings -> Access Keys, lalu isi MIDTRANS_SERVER_KEY di .env.
 */

const SANDBOX_BASE = 'https://api.sandbox.midtrans.com';
const PRODUCTION_BASE = 'https://api.midtrans.com';

/** Berapa lama QR berlaku. Midtrans membatasi maksimal 120 menit untuk QRIS. */
export const QRIS_EXPIRY_MINUTES = 15;

export function isMidtransConfigured(): boolean {
  return Boolean(process.env.MIDTRANS_SERVER_KEY);
}

function serverKey(): string {
  const key = process.env.MIDTRANS_SERVER_KEY;
  if (!key) {
    throw new AppError(
      'Pembayaran QRIS belum dikonfigurasi. Isi MIDTRANS_SERVER_KEY di file .env.',
      503,
      'PAYMENT_NOT_CONFIGURED',
    );
  }
  return key;
}

function baseUrl(): string {
  return process.env.MIDTRANS_IS_PRODUCTION === 'true' ? PRODUCTION_BASE : SANDBOX_BASE;
}

function authHeader(): string {
  // Core API memakai Basic auth: server key sebagai username, password kosong.
  return `Basic ${Buffer.from(`${serverKey()}:`).toString('base64')}`;
}

/** Status transaksi Midtrans yang relevan, dipetakan ke istilah aplikasi. */
export type MidtransOutcome = 'paid' | 'pending' | 'expired' | 'failed';

export function mapStatus(transactionStatus: string, fraudStatus?: string): MidtransOutcome {
  switch (transactionStatus) {
    case 'capture':
      // Kartu kredit bisa tertangkap tapi ditahan sistem antifraud.
      return fraudStatus === 'accept' ? 'paid' : 'pending';
    case 'settlement':
      return 'paid';
    case 'pending':
      return 'pending';
    case 'expire':
      return 'expired';
    case 'deny':
    case 'cancel':
    case 'failure':
      return 'failed';
    default:
      return 'pending';
  }
}

interface ChargeAction {
  name: string;
  method: string;
  url: string;
}

interface ChargeResponse {
  status_code: string;
  status_message: string;
  transaction_id?: string;
  order_id?: string;
  gross_amount?: string;
  transaction_status?: string;
  expiry_time?: string;
  actions?: ChargeAction[];
  /** Isi mentah QR. Sama dengan yang tergambar di kode QR, jadi bukan rahasia. */
  qr_string?: string;
}

export function isSandbox(): boolean {
  return process.env.MIDTRANS_IS_PRODUCTION !== 'true';
}

async function callApi<T>(path: string, init: RequestInit): Promise<T> {
  // Dihitung di luar try: kalau server key belum diisi, pesannya harus tetap
  // "belum dikonfigurasi", bukan tertelan jadi "tidak bisa menghubungi gateway".
  const authorization = authHeader();
  const url = `${baseUrl()}${path}`;

  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: authorization,
        ...(init.headers ?? {}),
      },
      // Jangan biarkan kasir menunggu tanpa batas kalau gateway lambat.
      signal: AbortSignal.timeout(15_000),
    });
  } catch (error) {
    if (error instanceof AppError) throw error;
    if (error instanceof DOMException && error.name === 'TimeoutError') {
      throw new AppError('Payment gateway tidak merespons. Coba lagi.', 504, 'PAYMENT_TIMEOUT');
    }
    throw new AppError('Tidak bisa menghubungi payment gateway.', 502, 'PAYMENT_UNREACHABLE');
  }

  const payload = (await response.json().catch(() => null)) as T & { status_message?: string } | null;
  if (!payload) throw new AppError('Respons payment gateway tidak bisa dibaca.', 502, 'PAYMENT_BAD_RESPONSE');
  return payload;
}

export interface QrisCharge {
  orderId: string;
  providerRef: string | null;
  qrUrl: string;
  qrString: string | null;
  /** Waktu kedaluwarsa dalam UTC, format "YYYY-MM-DD HH:MM:SS". */
  expiresAt: string;
  raw: unknown;
}

/**
 * Membuat tagihan QRIS. `orderId` harus unik seumur akun Midtrans — kita pakai
 * nomor invoice, yang sudah unik per hari dan mudah dicocokkan saat rekonsiliasi.
 */
export async function chargeQris(orderId: string, amount: number): Promise<QrisCharge> {
  if (!Number.isInteger(amount) || amount <= 0) throw badRequest('Nominal pembayaran tidak valid');

  const body = {
    payment_type: 'qris',
    transaction_details: { order_id: orderId, gross_amount: amount },
    qris: { acquirer: 'gopay' },
    custom_expiry: { unit: 'minute', expiry_duration: QRIS_EXPIRY_MINUTES },
  };

  const result = await callApi<ChargeResponse>('/v2/charge', { method: 'POST', body: JSON.stringify(body) });

  // 201 = berhasil dibuat. Kode lain berarti gagal, dan pesannya layak diteruskan.
  if (result.status_code !== '201' && result.status_code !== '200') {
    throw new AppError(
      `Gateway menolak permintaan pembayaran: ${result.status_message ?? result.status_code}`,
      502,
      'PAYMENT_REJECTED',
    );
  }

  const qr = result.actions?.find((action) => action.name === 'generate-qr-code');
  if (!qr?.url) throw new AppError('Gateway tidak mengembalikan kode QR.', 502, 'PAYMENT_NO_QR');

  const expiresAt = result.expiry_time
    ? // Midtrans mengirim waktu WIB tanpa penanda zona; ubah ke UTC agar konsisten
      // dengan seluruh timestamp lain di database.
      new Date(`${result.expiry_time.replace(' ', 'T')}+07:00`).toISOString().slice(0, 19).replace('T', ' ')
    : new Date(Date.now() + QRIS_EXPIRY_MINUTES * 60_000).toISOString().slice(0, 19).replace('T', ' ');

  return {
    orderId,
    providerRef: result.transaction_id ?? null,
    qrUrl: qr.url,
    qrString: result.qr_string ?? null,
    expiresAt,
    raw: result,
  };
}

export interface MidtransStatus {
  outcome: MidtransOutcome;
  providerRef: string | null;
  raw: unknown;
}

/** Menanyakan status langsung ke gateway — dipakai layar kasir sebagai cadangan webhook. */
export async function checkStatus(orderId: string): Promise<MidtransStatus> {
  const result = await callApi<ChargeResponse & { fraud_status?: string }>(
    `/v2/${encodeURIComponent(orderId)}/status`,
    { method: 'GET' },
  );

  // 404 berarti tagihan belum pernah sampai ke Midtrans.
  if (result.status_code === '404') {
    return { outcome: 'pending', providerRef: null, raw: result };
  }

  return {
    outcome: mapStatus(result.transaction_status ?? '', result.fraud_status),
    providerRef: result.transaction_id ?? null,
    raw: result,
  };
}

export interface WebhookPayload {
  order_id: string;
  status_code: string;
  gross_amount: string;
  signature_key: string;
  transaction_status: string;
  fraud_status?: string;
  transaction_id?: string;
}

/**
 * Memverifikasi keaslian notifikasi.
 *
 * Endpoint webhook terbuka untuk publik, jadi siapa pun bisa mengirim JSON yang
 * mengaku "sudah lunas". Midtrans menandatangani setiap notifikasi dengan
 * SHA-512 dari order_id + status_code + gross_amount + server key; tanpa
 * pemeriksaan ini, transaksi bisa dilunasi orang lain secara cuma-cuma.
 */
export function verifySignature(payload: WebhookPayload): boolean {
  const expected = createHash('sha512')
    .update(`${payload.order_id}${payload.status_code}${payload.gross_amount}${serverKey()}`)
    .digest('hex');

  const received = (payload.signature_key ?? '').toLowerCase();
  if (received.length !== expected.length) return false;

  // Perbandingan waktu-tetap agar tidak bocor lewat timing.
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ received.charCodeAt(i);
  return diff === 0;
}
