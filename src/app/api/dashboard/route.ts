import { getDashboardStats } from '@/lib/db';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getSession();
  const stats = getDashboardStats(session?.id, session?.role);
  return Response.json(stats);
}
