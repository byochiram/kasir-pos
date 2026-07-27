import { requireAdmin } from '@/lib/auth';
import { stockAdjust } from '@/lib/db';
import { json, readBody, route } from '@/lib/http';
import { stockAdjustSchema } from '@/lib/validation';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const POST = route(async (request) => {
  const session = await requireAdmin();
  const body = await readBody(request, stockAdjustSchema);
  return json(stockAdjust(body.product_id, body.new_stock, body.notes, session.id), 201);
});
