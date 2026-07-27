import { z } from 'zod';
import { requireAdmin } from '@/lib/auth';
import { createSupplier, listSuppliers } from '@/lib/db';
import { json, readBody, readQuery, route } from '@/lib/http';
import { paginationSchema, supplierSchema } from '@/lib/validation';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const querySchema = paginationSchema.extend({ search: z.string().max(100).optional() });

export const GET = route(async (request) => {
  await requireAdmin();
  return json(listSuppliers(readQuery(request, querySchema)));
});

export const POST = route(async (request) => {
  await requireAdmin();
  return json(createSupplier(await readBody(request, supplierSchema)), 201);
});
