import { NextRequest } from 'next/server';
import { getAllProducts, createProduct, getCategories } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  if (sp.has('categories')) return Response.json(getCategories());
  const products = getAllProducts(sp.get('search') || undefined, sp.get('category') || undefined);
  return Response.json(products);
}

export async function POST(request: NextRequest) {
  try {
    await requireAuth();
    const body = await request.json();
    const product = createProduct(body);
    return Response.json(product, { status: 201 });
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: error.message === 'Unauthorized' ? 401 : 400 });
  }
}
