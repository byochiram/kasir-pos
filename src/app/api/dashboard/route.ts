import { requireAuth } from '@/lib/auth';
import { getDashboardStats } from '@/lib/db';
import { json, route } from '@/lib/http';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const GET = route(async () => {
  const session = await requireAuth();
  // Statistik dibatasi sesuai role di dalam getDashboardStats: kasir hanya
  // melihat transaksinya sendiri dan tidak melihat angka laba/modal.
  return json(getDashboardStats(session.id, session.role));
});
