import { z } from 'zod';
import { requireAuth } from '@/lib/auth';
import { createTransaction, listTransactions } from '@/lib/db';
import { json, readBody, readQuery, route } from '@/lib/http';
import { createTransactionSchema, paginationSchema } from '@/lib/validation';
import { TRANSACTION_STATUSES } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const querySchema = paginationSchema.extend({
  status: z.enum(TRANSACTION_STATUSES).optional(),
  search: z.string().max(100).optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  mine: z.enum(['true', 'false']).transform((v) => v === 'true').optional(),
});

export const GET = route(async (request) => {
  const session = await requireAuth();
  const query = readQuery(request, querySchema);
  // Kasir hanya boleh melihat transaksinya sendiri; admin melihat semuanya.
  const userId = session.role === 'ADMIN' ? (query.mine ? session.id : undefined) : session.id;
  return json(listTransactions({ ...query, userId }));
});

export const POST = route(async (request) => {
  const session = await requireAuth();
  const body = await readBody(request, createTransactionSchema);
  // user_id selalu dari sesi, tidak pernah dari body.
  return json(createTransaction({ ...body, user_id: session.id }), 201);
});
