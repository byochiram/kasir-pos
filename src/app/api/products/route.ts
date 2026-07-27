import { z } from 'zod';
import { requireAdmin, requireAuth } from '@/lib/auth';
import { createProduct, listProducts } from '@/lib/db';
import { json, readBody, readQuery, route } from '@/lib/http';
import { paginationSchema, productSchema } from '@/lib/validation';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const querySchema = paginationSchema.extend({
  search: z.string().max(100).optional(),
  category: z.string().max(50).optional(),
  lowStock: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
});

export const GET = route(async (request) => {
  await requireAuth();
  const query = readQuery(request, querySchema);
  return json(listProducts(query));
});

export const POST = route(async (request) => {
  await requireAdmin();
  const data = await readBody(request, productSchema);
  return json(createProduct(data), 201);
});
