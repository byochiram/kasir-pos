import { requireAuth } from '@/lib/auth';
import { changePassword } from '@/lib/db';
import { json, readBody, route } from '@/lib/http';
import { changePasswordSchema } from '@/lib/validation';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const POST = route(async (request) => {
  const session = await requireAuth();
  const body = await readBody(request, changePasswordSchema);
  changePassword(session.id, body.current_password, body.new_password);
  return json({ success: true });
});
