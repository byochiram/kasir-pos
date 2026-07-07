import { NextRequest } from 'next/server';
import { getSalesReport } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const startDate = sp.get('startDate') || new Date().toISOString().split('T')[0];
  const endDate = sp.get('endDate') || new Date().toISOString().split('T')[0];
  return Response.json(getSalesReport(startDate, endDate));
}
