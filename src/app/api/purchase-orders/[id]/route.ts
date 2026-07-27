import { requireAdmin } from '@/lib/auth';
import { deletePurchaseOrder, getPurchaseOrderById, updatePurchaseOrder } from '@/lib/db';
import { json, notFound, readBody, route } from '@/lib/http';
import { purchaseOrderSchema } from '@/lib/validation';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const GET = route(async (_request, { params }) => {
  await requireAdmin();
  const { id } = await params;
  const po = getPurchaseOrderById(id);
  if (!po) throw notFound('Purchase order tidak ditemukan');
  return json(po);
});

export const PUT = route(async (request, { params }) => {
  await requireAdmin();
  const { id } = await params;
  const body = await readBody(request, purchaseOrderSchema);
  return json(updatePurchaseOrder(id, { ...body, expected_date: body.expected_date || null }));
});

export const DELETE = route(async (_request, { params }) => {
  await requireAdmin();
  const { id } = await params;
  deletePurchaseOrder(id);
  return json({ success: true });
});
