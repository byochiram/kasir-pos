import { NextRequest } from 'next/server';
import bcrypt from 'bcryptjs';
import { getUserByEmail } from '@/lib/db';
import {
  buildSessionCookie,
  checkLoginRateLimit,
  clearLoginAttempts,
  recordFailedLogin,
  signToken,
} from '@/lib/auth';
import { AppError, json, readBody, route, tooManyRequests } from '@/lib/http';
import { loginSchema } from '@/lib/validation';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function clientKey(request: NextRequest, email: string): string {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'local';
  return `${ip}:${email.toLowerCase()}`;
}

export const POST = route(async (request) => {
  const { email, password } = await readBody(request, loginSchema);
  const key = clientKey(request, email);

  const limit = checkLoginRateLimit(key);
  if (!limit.allowed) {
    throw tooManyRequests(`Terlalu banyak percobaan login. Coba lagi dalam ${limit.retryAfterMinutes} menit.`);
  }

  const user = getUserByEmail(email);
  // Pesan yang sama untuk email tidak dikenal maupun password salah, supaya
  // tidak bisa dipakai menebak email mana yang terdaftar.
  const invalid = new AppError('Email atau password salah', 401, 'INVALID_CREDENTIALS');

  if (!user) {
    recordFailedLogin(key);
    throw invalid;
  }
  if (!(await bcrypt.compare(password, user.password))) {
    recordFailedLogin(key);
    throw invalid;
  }
  if (user.is_active !== 1) {
    throw new AppError('Akun Anda dinonaktifkan. Hubungi admin.', 403, 'ACCOUNT_DISABLED');
  }

  clearLoginAttempts(key);
  const token = await signToken({ id: user.id, name: user.name, email: user.email, role: user.role });

  const response = json({ user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  response.headers.set('Set-Cookie', buildSessionCookie(token));
  return response;
});
