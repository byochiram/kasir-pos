import { requireAdmin, requireAuth } from '@/lib/auth';
import { deleteCustomer, getCustomerById, updateCustomer } from '@/lib/db';
import { json, notFound, readBody, route } from '@/lib/http';
import { customerSchema } from '@/lib/validation';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const GET = route(async (_request, { params }) => {
  await requireAuth();
  const { id } = await params;
  const customer = getCustomerById(id);
  if (!customer) throw notFound('Pelanggan tidak ditemukan');
  return json(customer);
});

export const PUT = route(async (request, { params }) => {
  await requireAuth();
  const { id } = await params;
  return json(updateCustomer(id, await readBody(request, customerSchema)));
});

export const DELETE = route(async (_request, { params }) => {
  await requireAdmin();
  const { id } = await params;
  deleteCustomer(id);
  return json({ success: true });
});
