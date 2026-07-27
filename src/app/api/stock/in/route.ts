import { requireAdmin } from '@/lib/auth';
import { stockIn } from '@/lib/db';
import { json, readBody, route } from '@/lib/http';
import { stockInSchema } from '@/lib/validation';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const POST = route(async (request) => {
  const session = await requireAdmin();
  const body = await readBody(request, stockInSchema);
  return json(stockIn(body.product_id, body.quantity, body.notes, session.id, body.supplier_id ?? null), 201);
});
