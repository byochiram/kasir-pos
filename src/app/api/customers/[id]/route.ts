import { NextRequest } from 'next/server';
import { getCustomerById, updateCustomer, deleteCustomer } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = getCustomerById(id);
  if (!c) return Response.json({ error: 'Not found' }, { status: 404 });
  return Response.json(c);
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  return Response.json(updateCustomer(id, body));
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  deleteCustomer(id);
  return Response.json({ success: true });
}
