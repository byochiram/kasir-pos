import { NextRequest } from 'next/server';
import { getTransactionById, voidTransaction } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tx = getTransactionById(id);
  if (!tx) return Response.json({ error: 'Not found' }, { status: 404 });
  return Response.json(tx);
}

export async function PATCH(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth();
    const { id } = await params;
    const tx = voidTransaction(id, session.id);
    if (!tx) return Response.json({ error: 'Cannot void' }, { status: 400 });
    return Response.json(tx);
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 400 });
  }
}
