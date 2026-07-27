import { buildLogoutCookie } from '@/lib/auth';
import { json, route } from '@/lib/http';

export const dynamic = 'force-dynamic';

export const POST = route(async () => {
  const response = json({ success: true });
  response.headers.set('Set-Cookie', buildLogoutCookie());
  return response;
});
