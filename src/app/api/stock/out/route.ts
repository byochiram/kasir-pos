import { requireAdmin } from '@/lib/auth';
import { stockOut } from '@/lib/db';
import { json, readBody, route } from '@/lib/http';
import { stockOutSchema } from '@/lib/validation';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const POST = route(async (request) => {
  const session = await requireAdmin();
  const body = await readBody(request, stockOutSchema);
  return json(stockOut(body.product_id, body.quantity, body.notes, session.id), 201);
});
