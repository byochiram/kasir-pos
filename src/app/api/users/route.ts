import { NextRequest } from 'next/server';
import { getAllUsers, createUser, updateUser, deleteUser } from '@/lib/db';
import { requireRole } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await requireRole(['ADMIN']);
    return Response.json(getAllUsers());
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 403 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireRole(['ADMIN']);
    const body = await request.json();
    return Response.json(createUser(body), { status: 201 });
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 400 });
  }
}
