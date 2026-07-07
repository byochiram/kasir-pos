import { NextRequest } from 'next/server';
import { getSupplierById, updateSupplier, deleteSupplier } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = getSupplierById(id);
  if (!s) return Response.json({ error: 'Not found' }, { status: 404 });
  return Response.json(s);
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  return Response.json(updateSupplier(id, body));
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  deleteSupplier(id);
  return Response.json({ success: true });
}
