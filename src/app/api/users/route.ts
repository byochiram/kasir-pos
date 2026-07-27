import { z } from 'zod';
import { requireAdmin } from '@/lib/auth';
import { createUser, listUsers } from '@/lib/db';
import { json, readBody, readQuery, route } from '@/lib/http';
import { createUserSchema, paginationSchema } from '@/lib/validation';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const querySchema = paginationSchema.extend({ search: z.string().max(100).optional() });

export const GET = route(async (request) => {
  await requireAdmin();
  return json(listUsers(readQuery(request, querySchema)));
});

export const POST = route(async (request) => {
  await requireAdmin();
  return json(createUser(await readBody(request, createUserSchema)), 201);
});
