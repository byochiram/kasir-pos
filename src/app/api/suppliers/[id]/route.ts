import { requireAdmin } from '@/lib/auth';
import { deleteSupplier, getSupplierById, updateSupplier } from '@/lib/db';
import { json, notFound, readBody, route } from '@/lib/http';
import { supplierSchema } from '@/lib/validation';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const GET = route(async (_request, { params }) => {
  await requireAdmin();
  const { id } = await params;
  const supplier = getSupplierById(id);
  if (!supplier) throw notFound('Supplier tidak ditemukan');
  return json(supplier);
});

export const PUT = route(async (request, { params }) => {
  await requireAdmin();
  const { id } = await params;
  return json(updateSupplier(id, await readBody(request, supplierSchema)));
});

export const DELETE = route(async (_request, { params }) => {
  await requireAdmin();
  const { id } = await params;
  deleteSupplier(id);
  return json({ success: true });
});
