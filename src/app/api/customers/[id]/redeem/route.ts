import { requireAuth } from '@/lib/auth';
import { redeemPoints } from '@/lib/db';
import { json, readBody, route } from '@/lib/http';
import { redeemPointsSchema } from '@/lib/validation';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const POST = route(async (request, { params }) => {
  await requireAuth();
  const { id } = await params;
  const body = await readBody(request, redeemPointsSchema);
  return json(redeemPoints(id, body.points, body.notes));
});
