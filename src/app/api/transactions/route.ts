import { NextRequest } from 'next/server';
import { getTransactions, createTransaction } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const limit = parseInt(sp.get('limit') || '50');
  const offset = parseInt(sp.get('offset') || '0');
  const status = sp.get('status') || undefined;
  return Response.json(getTransactions(limit, offset, status));
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();
    const body = await request.json();
    const transaction = createTransaction({ ...body, user_id: session.id });
    return Response.json(transaction, { status: 201 });
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 400 });
  }
}
