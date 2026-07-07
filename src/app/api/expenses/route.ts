import { NextRequest } from 'next/server';
import { getExpenses, createExpense } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  return Response.json(getExpenses(
    parseInt(sp.get('limit') || '50'),
    parseInt(sp.get('offset') || '0'),
    sp.get('category') || undefined,
    sp.get('startDate') || undefined,
    sp.get('endDate') || undefined,
  ));
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();
    const body = await request.json();
    return Response.json(createExpense({ ...body, created_by: session.id }), { status: 201 });
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 400 });
  }
}
