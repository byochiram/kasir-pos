import { z } from 'zod';
import { requireAdmin } from '@/lib/auth';
import { listStockHistory } from '@/lib/db';
import { json, readQuery, route } from '@/lib/http';
import { paginationSchema } from '@/lib/validation';
import { STOCK_MOVEMENT_TYPES } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const querySchema = paginationSchema.extend({
  productId: z.string().max(100).optional(),
  type: z.enum(STOCK_MOVEMENT_TYPES).optional(),
});

export const GET = route(async (request) => {
  await requireAdmin();
  return json(listStockHistory(readQuery(request, querySchema)));
});
