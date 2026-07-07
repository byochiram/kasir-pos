import { NextRequest } from 'next/server';
import { getAllCustomers, createCustomer } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  return Response.json(getAllCustomers(sp.get('search') || undefined));
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    return Response.json(createCustomer(body), { status: 201 });
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 400 });
  }
}
