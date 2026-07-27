import { requireAdmin, requireAuth } from '@/lib/auth';
import { getSettings, updateSettings } from '@/lib/db';
import { json, readBody, route } from '@/lib/http';
import { settingsSchema } from '@/lib/validation';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Kasir perlu membacanya untuk tarif pajak dan header/footer struk.
export const GET = route(async () => {
  await requireAuth();
  return json(getSettings());
});

export const PUT = route(async (request) => {
  await requireAdmin();
  return json(updateSettings(await readBody(request, settingsSchema)));
});
