import { NextRequest } from 'next/server';
import { stockIn } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();
    const { product_id, quantity, notes } = await request.json();
    const product = stockIn(product_id, quantity, notes || '', session.id);
    return Response.json(product);
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 400 });
  }
}
