import { NextRequest } from 'next/server';
import { createUser } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const user = createUser(body);
    return Response.json(user, { status: 201 });
  } catch (error: any) {
    if (error.message.includes('UNIQUE')) {
      return Response.json({ error: 'Email sudah digunakan' }, { status: 400 });
    }
    return Response.json({ error: error.message }, { status: 400 });
  }
}
