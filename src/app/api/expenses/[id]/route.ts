import { requireAdmin } from '@/lib/auth';
import { deleteExpense, getExpenseById, updateExpense } from '@/lib/db';
import { json, notFound, readBody, route } from '@/lib/http';
import { expenseSchema } from '@/lib/validation';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const GET = route(async (_request, { params }) => {
  await requireAdmin();
  const { id } = await params;
  const expense = getExpenseById(id);
  if (!expense) throw notFound('Pengeluaran tidak ditemukan');
  return json(expense);
});

export const PUT = route(async (request, { params }) => {
  await requireAdmin();
  const { id } = await params;
  return json(updateExpense(id, await readBody(request, expenseSchema)));
});

export const DELETE = route(async (_request, { params }) => {
  await requireAdmin();
  const { id } = await params;
  deleteExpense(id);
  return json({ success: true });
});
