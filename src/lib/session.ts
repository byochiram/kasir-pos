import { SignJWT, jwtVerify } from 'jose';
import { ROLES, type Role, type SessionPayload } from './types';

/**
 * Penanganan token sesi, sengaja dipisah dari auth.ts.
 *
 * Middleware hanya butuh memverifikasi token, tapi auth.ts mengimpor http.ts
 * yang membawa zod beserta seluruh skema validasi. Karena middleware berjalan
 * di setiap request, semua itu ikut terbundel dan diparse tanpa pernah dipakai.
 * Modul ini hanya bergantung pada jose.
 */

export const TOKEN_COOKIE = 'token';
const TOKEN_MAX_AGE_SECONDS = 60 * 60 * 12; // 12 jam — satu shift kerja

let cachedSecret: Uint8Array | null = null;

function getSecret(): Uint8Array {
  if (cachedSecret) return cachedSecret;
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      'JWT_SECRET belum diatur atau terlalu pendek (minimal 32 karakter). Tambahkan di file .env — lihat .env.example.',
    );
  }
  cachedSecret = new TextEncoder().encode(secret);
  return cachedSecret;
}

function isRole(value: unknown): value is Role {
  return typeof value === 'string' && (ROLES as readonly string[]).includes(value);
}

export async function signToken(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${TOKEN_MAX_AGE_SECONDS}s`)
    .sign(getSecret());
}

/** Mengembalikan null untuk token tidak valid/kedaluwarsa — bukan melempar. */
export async function verifyToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    if (
      typeof payload.id !== 'string' ||
      typeof payload.name !== 'string' ||
      typeof payload.email !== 'string' ||
      !isRole(payload.role)
    ) {
      return null;
    }
    return { id: payload.id, name: payload.name, email: payload.email, role: payload.role };
  } catch {
    return null;
  }
}

export function buildSessionCookie(token: string): string {
  const parts = [
    `${TOKEN_COOKIE}=${token}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${TOKEN_MAX_AGE_SECONDS}`,
  ];
  if (process.env.NODE_ENV === 'production') parts.push('Secure');
  return parts.join('; ');
}

export function buildLogoutCookie(): string {
  const parts = [`${TOKEN_COOKIE}=`, 'Path=/', 'HttpOnly', 'SameSite=Lax', 'Max-Age=0'];
  if (process.env.NODE_ENV === 'production') parts.push('Secure');
  return parts.join('; ');
}
