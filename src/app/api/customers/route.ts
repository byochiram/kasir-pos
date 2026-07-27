import { z } from 'zod';
import { requireAuth } from '@/lib/auth';
import { createCustomer, listCustomers } from '@/lib/db';
import { json, readBody, readQuery, route } from '@/lib/http';
import { customerSchema, paginationSchema } from '@/lib/validation';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const querySchema = paginationSchema.extend({ search: z.string().max(100).optional() });

export const GET = route(async (request) => {
  await requireAuth();
  return json(listCustomers(readQuery(request, querySchema)));
});

// Kasir perlu bisa mendaftarkan pelanggan baru saat transaksi berlangsung.
export const POST = route(async (request) => {
  await requireAuth();
  return json(createCustomer(await readBody(request, customerSchema)), 201);
});
