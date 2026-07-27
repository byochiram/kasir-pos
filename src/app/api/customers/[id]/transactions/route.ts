import { requireAuth } from '@/lib/auth';
import { getCustomerById, getCustomerTransactions } from '@/lib/db';
import { json, notFound, readQuery, route } from '@/lib/http';
import { paginationSchema } from '@/lib/validation';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const GET = route(async (request, { params }) => {
  await requireAuth();
  const { id } = await params;
  if (!getCustomerById(id)) throw notFound('Pelanggan tidak ditemukan');
  const { limit, offset } = readQuery(request, paginationSchema);
  return json(getCustomerTransactions(id, limit, offset));
});
