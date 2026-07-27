import { requireAuth } from '@/lib/auth';
import { getLowStockProducts } from '@/lib/db';
import { json, route } from '@/lib/http';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const GET = route(async () => {
  await requireAuth();
  return json(getLowStockProducts());
});
