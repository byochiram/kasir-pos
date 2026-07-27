import { z } from 'zod';
import { requireAdmin } from '@/lib/auth';
import { createExpense, listExpenses } from '@/lib/db';
import { json, readBody, readQuery, route } from '@/lib/http';
import { expenseSchema, paginationSchema } from '@/lib/validation';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const querySchema = paginationSchema.extend({
  category: z.string().max(50).optional(),
  search: z.string().max(100).optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

// Pengeluaran adalah data keuangan internal — hanya admin.
export const GET = route(async (request) => {
  await requireAdmin();
  return json(listExpenses(readQuery(request, querySchema)));
});

export const POST = route(async (request) => {
  const session = await requireAdmin();
  return json(createExpense(await readBody(request, expenseSchema), session.id), 201);
});
