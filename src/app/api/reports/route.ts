import { requireAdmin } from '@/lib/auth';
import { getSalesReport } from '@/lib/db';
import { json, readQuery, route } from '@/lib/http';
import { dateRangeSchema } from '@/lib/validation';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Laporan memuat harga modal dan margin — khusus admin.
export const GET = route(async (request) => {
  await requireAdmin();
  const { startDate, endDate } = readQuery(request, dateRangeSchema);
  return json(getSalesReport(startDate, endDate));
});
