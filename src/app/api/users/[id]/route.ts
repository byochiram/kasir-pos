import { NextRequest } from 'next/server';
import { updateUser, deleteUser } from '@/lib/db';
import { requireRole } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireRole(['ADMIN']);
    const { id } = await params;
    const body = await request.json();
    return Response.json(updateUser(id, body));
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 400 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireRole(['ADMIN']);
    const { id } = await params;
    deleteUser(id);
    return Response.json({ success: true });
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 400 });
  }
}
