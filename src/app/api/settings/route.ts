import { NextRequest } from 'next/server';
import { getSettings, updateSettings } from '@/lib/db';
import { requireRole } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  return Response.json(getSettings());
}

export async function PUT(request: NextRequest) {
  try {
    await requireRole(['ADMIN']);
    const body = await request.json();
    return Response.json(updateSettings(body));
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: error.message === 'Forbidden' ? 403 : 400 });
  }
}
