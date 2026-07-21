import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';

function getSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET tidak ditemukan di environment. Tambahkan di file .env');
  return new TextEncoder().encode(secret);
}

export async function signToken(payload: any): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('24h')
    .sign(getSecret());
}

export async function verifyToken(token: string): Promise<any> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return payload;
  } catch {
    return null;
  }
}

export async function getSession(): Promise<any> {
  const cookieStore = await cookies();
  const token = cookieStore.get('token')?.value;
  if (!token) return null;
  return verifyToken(token);
}

export async function requireAuth(): Promise<any> {
  const session = await getSession();
  if (!session) throw new Error('Unauthorized');
  return session;
}

export async function requireRole(roles: string[]): Promise<any> {
  const session = await requireAuth();
  if (!roles.includes(session.role)) throw new Error('Forbidden');
  return session;
}
