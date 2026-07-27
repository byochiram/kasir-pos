import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { ROLES, type Role, type SessionPayload } from './types';
import { forbidden, unauthorized } from './http';

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

export async function getSession(): Promise<SessionPayload | null> {
  const token = (await cookies()).get(TOKEN_COOKIE)?.value;
  if (!token) return null;
  return verifyToken(token);
}

export async function requireAuth(): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) throw unauthorized();
  return session;
}

export async function requireRole(roles: readonly Role[]): Promise<SessionPayload> {
  const session = await requireAuth();
  if (!roles.includes(session.role)) throw forbidden();
  return session;
}

export const requireAdmin = () => requireRole(['ADMIN']);

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

// ===== RATE LIMIT LOGIN =====
// Penyimpanan in-memory: cukup untuk deployment satu proses (toko tunggal).
// Kalau nanti di-scale ke banyak instance, ganti dengan Redis atau tabel DB.
const MAX_ATTEMPTS = 8;
const WINDOW_MS = 15 * 60 * 1000;
const attempts = new Map<string, { count: number; firstAt: number }>();

export function checkLoginRateLimit(key: string): { allowed: boolean; retryAfterMinutes: number } {
  const now = Date.now();
  const entry = attempts.get(key);
  if (!entry || now - entry.firstAt > WINDOW_MS) {
    return { allowed: true, retryAfterMinutes: 0 };
  }
  if (entry.count >= MAX_ATTEMPTS) {
    return { allowed: false, retryAfterMinutes: Math.ceil((WINDOW_MS - (now - entry.firstAt)) / 60000) };
  }
  return { allowed: true, retryAfterMinutes: 0 };
}

export function recordFailedLogin(key: string): void {
  const now = Date.now();
  const entry = attempts.get(key);
  if (!entry || now - entry.firstAt > WINDOW_MS) {
    attempts.set(key, { count: 1, firstAt: now });
    return;
  }
  entry.count += 1;
  // Buang entri kedaluwarsa sesekali supaya map tidak tumbuh tanpa batas.
  if (attempts.size > 5000) {
    for (const [k, v] of attempts) {
      if (now - v.firstAt > WINDOW_MS) attempts.delete(k);
    }
  }
}

export function clearLoginAttempts(key: string): void {
  attempts.delete(key);
}
