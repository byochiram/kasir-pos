import { NextRequest } from 'next/server';
import { getAllSuppliers, createSupplier } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  return Response.json(getAllSuppliers(sp.get('search') || undefined));
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    return Response.json(createSupplier(body), { status: 201 });
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 400 });
  }
}
