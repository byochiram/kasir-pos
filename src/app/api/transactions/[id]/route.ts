import { requireAdmin, requireAuth } from '@/lib/auth';
import { getTransactionById, voidTransaction } from '@/lib/db';
import { forbidden, json, notFound, readBody, route } from '@/lib/http';
import { voidTransactionSchema } from '@/lib/validation';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const GET = route(async (_request, { params }) => {
  const session = await requireAuth();
  const { id } = await params;
  const transaction = getTransactionById(id);
  if (!transaction) throw notFound('Transaksi tidak ditemukan');
  if (session.role !== 'ADMIN' && transaction.user_id !== session.id) {
    throw forbidden('Anda hanya bisa melihat transaksi Anda sendiri');
  }
  return json(transaction);
});

// Pembatalan transaksi memutar balik stok dan poin pelanggan, jadi khusus admin
// dan wajib menyertakan alasan untuk jejak audit.
export const PATCH = route(async (request, { params }) => {
  const session = await requireAdmin();
  const { id } = await params;
  const { reason } = await readBody(request, voidTransactionSchema);
  return json(voidTransaction(id, session.id, reason));
});
