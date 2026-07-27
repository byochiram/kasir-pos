import { cookies } from 'next/headers';
import type { Role, SessionPayload } from './types';
import { forbidden, unauthorized } from './http';
import { TOKEN_COOKIE, verifyToken } from './session';

// Penanganan token ada di session.ts agar middleware bisa memakainya tanpa ikut
// menarik zod lewat http.ts. Diekspor ulang di sini supaya pemanggil lama tetap
// bisa mengimpor dari satu tempat.
export {
  TOKEN_COOKIE,
  signToken,
  verifyToken,
  buildSessionCookie,
  buildLogoutCookie,
} from './session';

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
