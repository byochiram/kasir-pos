import { requireAuth } from '@/lib/auth';
import { getUserById } from '@/lib/db';
import { json, route, unauthorized } from '@/lib/http';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const GET = route(async () => {
  const session = await requireAuth();
  // Token bisa saja masih berlaku setelah user dinonaktifkan atau dihapus.
  const user = getUserById(session.id);
  if (!user || user.is_active !== 1) throw unauthorized('Akun Anda sudah tidak aktif');
  return json({ id: user.id, name: user.name, email: user.email, role: user.role });
});
