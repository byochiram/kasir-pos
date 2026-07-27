import { NextRequest, NextResponse } from 'next/server';
// Diimpor dari session.ts, bukan auth.ts: auth.ts membawa http.ts beserta zod,
// dan middleware berjalan di setiap request.
import { verifyToken, TOKEN_COOKIE } from '@/lib/session';

/**
 * Hanya login yang boleh diakses tanpa token. Pendaftaran mandiri sengaja tidak
 * ada: akun baru hanya bisa dibuat admin lewat /users.
 *
 * Webhook pembayaran juga publik — pemanggilnya server Midtrans, bukan browser
 * yang login. Keasliannya diperiksa lewat signature SHA-512 di dalam handler,
 * bukan lewat cookie sesi.
 */
const PUBLIC_PATHS = ['/login', '/api/auth/login', '/api/payments/midtrans/webhook'];

/** Halaman yang hanya boleh dibuka ADMIN. API punya pengecekan sendiri di tiap route. */
const ADMIN_PATHS = ['/users', '/settings', '/reports', '/suppliers', '/expenses', '/purchase-orders'];

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

function matchesPrefix(pathname: string, prefixes: string[]): boolean {
  return prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isApi = pathname.startsWith('/api');

  const token = request.cookies.get(TOKEN_COOKIE)?.value;

  if (isPublic(pathname)) {
    // Yang sudah login tidak perlu melihat halaman login lagi.
    if (token && pathname === '/login' && (await verifyToken(token))) {
      return NextResponse.redirect(new URL('/', request.url));
    }
    return NextResponse.next();
  }

  const session = token ? await verifyToken(token) : null;

  if (!session) {
    // Request API harus dapat JSON 401, bukan redirect ke HTML halaman login —
    // kalau di-redirect, fetch() di client menerima status 200 dan mengira sukses.
    if (isApi) {
      return NextResponse.json({ error: 'Sesi Anda sudah berakhir, silakan login kembali', code: 'UNAUTHORIZED' }, { status: 401 });
    }
    const loginUrl = new URL('/login', request.url);
    if (pathname !== '/') loginUrl.searchParams.set('next', pathname);
    const response = NextResponse.redirect(loginUrl);
    response.cookies.delete(TOKEN_COOKIE);
    return response;
  }

  if (!isApi && session.role !== 'ADMIN' && matchesPrefix(pathname, ADMIN_PATHS)) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  return NextResponse.next();
}

export const config = {
  // Aset statis Next dan file publik dilewati lewat matcher ini, bukan lewat
  // pengecekan "mengandung titik" yang dulu membuat /api/x/a.b lolos tanpa token.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml|webmanifest)$).*)'],
};
