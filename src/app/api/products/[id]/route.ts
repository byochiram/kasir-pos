import { requireAdmin, requireAuth } from '@/lib/auth';
import { deleteProduct, getProductById, updateProduct } from '@/lib/db';
import { json, notFound, readBody, route } from '@/lib/http';
import { productSchema } from '@/lib/validation';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const GET = route(async (_request, { params }) => {
  await requireAuth();
  const { id } = await params;
  const product = getProductById(id);
  if (!product) throw notFound('Produk tidak ditemukan');
  return json(product);
});

export const PUT = route(async (request, { params }) => {
  const session = await requireAdmin();
  const { id } = await params;
  const data = await readBody(request, productSchema);
  return json(updateProduct(id, data, session.id));
});

export const DELETE = route(async (_request, { params }) => {
  await requireAdmin();
  const { id } = await params;
  deleteProduct(id);
  return json({ success: true });
});
