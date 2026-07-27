import { NextRequest } from 'next/server';
import { z } from 'zod';
import { fieldErrors } from './validation';

export interface ApiErrorBody {
  error: string;
  code: string;
  /** Diisi hanya untuk error validasi, dipetakan ke nama field di form. */
  fields?: Record<string, string>;
}

/**
 * Error yang aman ditampilkan ke user. Apa pun yang bukan AppError dianggap bug
 * dan dilaporkan sebagai 500 generik supaya detail internal tidak bocor.
 */
export class AppError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
    readonly fields?: Record<string, string>,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const badRequest = (message: string, fields?: Record<string, string>) =>
  new AppError(message, 400, 'BAD_REQUEST', fields);
export const unauthorized = (message = 'Anda harus login terlebih dahulu') =>
  new AppError(message, 401, 'UNAUTHORIZED');
export const forbidden = (message = 'Anda tidak punya akses untuk tindakan ini') =>
  new AppError(message, 403, 'FORBIDDEN');
export const notFound = (message = 'Data tidak ditemukan') => new AppError(message, 404, 'NOT_FOUND');
export const conflict = (message: string) => new AppError(message, 409, 'CONFLICT');
export const tooManyRequests = (message: string) => new AppError(message, 429, 'TOO_MANY_REQUESTS');

export function json(data: unknown, status = 200): Response {
  return Response.json(data, { status });
}

/** Pesan ramah untuk pelanggaran constraint SQLite yang paling sering muncul. */
function translateSqliteError(message: string): AppError | null {
  if (message.includes('UNIQUE constraint failed')) {
    if (message.includes('users.email')) return conflict('Email sudah digunakan oleh user lain');
    if (message.includes('products.barcode')) return conflict('Barcode sudah dipakai produk lain');
    if (message.includes('invoice_no')) return conflict('Nomor invoice bentrok, coba ulangi transaksi');
    return conflict('Data dengan nilai tersebut sudah ada');
  }
  if (message.includes('FOREIGN KEY constraint failed')) {
    return conflict('Data ini masih dipakai oleh data lain sehingga tidak bisa dihapus');
  }
  if (message.includes('NOT NULL constraint failed')) {
    return badRequest('Ada field wajib yang belum diisi');
  }
  return null;
}

export function toErrorResponse(error: unknown): Response {
  if (error instanceof AppError) {
    const body: ApiErrorBody = { error: error.message, code: error.code };
    if (error.fields) body.fields = error.fields;
    return json(body, error.status);
  }

  if (error instanceof z.ZodError) {
    const fields = fieldErrors(error);
    return json(
      { error: Object.values(fields)[0] ?? 'Data yang dikirim tidak valid', code: 'VALIDATION_ERROR', fields },
      400,
    );
  }

  if (error instanceof Error) {
    const translated = translateSqliteError(error.message);
    if (translated) return toErrorResponse(translated);
    console.error('[api] unhandled error:', error);
    return json({ error: 'Terjadi kesalahan pada server', code: 'INTERNAL_ERROR' } satisfies ApiErrorBody, 500);
  }

  console.error('[api] unknown throw:', error);
  return json({ error: 'Terjadi kesalahan pada server', code: 'INTERNAL_ERROR' } satisfies ApiErrorBody, 500);
}

type Ctx = { params: Promise<Record<string, string>> };
type Handler = (request: NextRequest, ctx: Ctx) => Promise<Response>;

/**
 * Bungkus handler route supaya semua error keluar dengan status dan bentuk JSON
 * yang konsisten, bukan 400 untuk segalanya.
 */
export function route(handler: Handler): Handler {
  return async (request, ctx) => {
    try {
      return await handler(request, ctx);
    } catch (error) {
      return toErrorResponse(error);
    }
  };
}

/** Baca dan validasi body JSON. Body kosong atau rusak jadi 400, bukan 500. */
export async function readBody<S extends z.ZodType>(request: NextRequest, schema: S): Promise<z.infer<S>> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    throw badRequest('Body request harus berupa JSON yang valid');
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const fields = fieldErrors(parsed.error);
    throw badRequest(Object.values(fields)[0] ?? 'Data yang dikirim tidak valid', fields);
  }
  return parsed.data;
}

/** Validasi query string. Parameter yang tidak dikirim dibiarkan memakai default skema. */
export function readQuery<S extends z.ZodType>(request: NextRequest, schema: S): z.infer<S> {
  const raw: Record<string, string> = {};
  request.nextUrl.searchParams.forEach((value, key) => {
    if (value !== '') raw[key] = value;
  });
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const fields = fieldErrors(parsed.error);
    throw badRequest(Object.values(fields)[0] ?? 'Parameter query tidak valid', fields);
  }
  return parsed.data;
}
