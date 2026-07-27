import { requireAdmin } from '@/lib/auth';
import { deleteUser, getUserById, updateUser } from '@/lib/db';
import { json, notFound, readBody, route } from '@/lib/http';
import { updateUserSchema } from '@/lib/validation';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const GET = route(async (_request, { params }) => {
  await requireAdmin();
  const { id } = await params;
  const user = getUserById(id);
  if (!user) throw notFound('User tidak ditemukan');
  return json(user);
});

export const PUT = route(async (request, { params }) => {
  const session = await requireAdmin();
  const { id } = await params;
  const body = await readBody(request, updateUserSchema);
  return json(updateUser(id, { ...body, password: body.password || undefined }, session.id));
});

export const DELETE = route(async (_request, { params }) => {
  const session = await requireAdmin();
  const { id } = await params;
  deleteUser(id, session.id);
  return json({ success: true });
});
