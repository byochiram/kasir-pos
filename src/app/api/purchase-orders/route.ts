import { z } from 'zod';
import { requireAdmin } from '@/lib/auth';
import { createPurchaseOrder, listPurchaseOrders } from '@/lib/db';
import { json, readBody, readQuery, route } from '@/lib/http';
import { paginationSchema, purchaseOrderSchema } from '@/lib/validation';
import { PO_STATUSES } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const querySchema = paginationSchema.extend({
  status: z.enum(PO_STATUSES).optional(),
  supplierId: z.string().max(100).optional(),
  search: z.string().max(100).optional(),
});

export const GET = route(async (request) => {
  await requireAdmin();
  return json(listPurchaseOrders(readQuery(request, querySchema)));
});

export const POST = route(async (request) => {
  const session = await requireAdmin();
  const body = await readBody(request, purchaseOrderSchema);
  return json(createPurchaseOrder({ ...body, expected_date: body.expected_date || null }, session.id), 201);
});
