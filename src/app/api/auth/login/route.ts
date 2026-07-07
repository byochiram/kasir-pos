import { NextRequest } from 'next/server';
import { getUserByEmail } from '@/lib/db';
import { signToken } from '@/lib/auth';
import bcrypt from 'bcryptjs';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();
    const user = getUserByEmail(email);
    if (!user) return Response.json({ error: 'Email atau password salah' }, { status: 401 });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return Response.json({ error: 'Email atau password salah' }, { status: 401 });

    const token = await signToken({ id: user.id, name: user.name, email: user.email, role: user.role });
    const res = Response.json({ user: { id: user.id, name: user.name, email: user.email, role: user.role } });
    res.headers.set('Set-Cookie', `token=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400`);
    return res;
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 400 });
  }
}
