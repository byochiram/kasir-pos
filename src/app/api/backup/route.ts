import { requireAdmin } from '@/lib/auth';
import { createBackup, restoreBackup } from '@/lib/backup';
import { badRequest, json, route } from '@/lib/http';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** Unduh snapshot database saat ini. */
export const GET = route(async () => {
  await requireAdmin();
  const { buffer, filename } = createBackup();
  return new Response(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': String(buffer.length),
      'Cache-Control': 'no-store',
    },
  });
});

/** Pulihkan database dari file backup yang diunggah. Menimpa seluruh data. */
export const POST = route(async (request) => {
  await requireAdmin();

  const contentType = request.headers.get('content-type') ?? '';
  if (!contentType.includes('multipart/form-data')) {
    throw badRequest('Kirim file backup sebagai multipart/form-data');
  }

  const form = await request.formData();
  const file = form.get('file');
  if (!(file instanceof File)) throw badRequest('Field "file" berisi file backup wajib diisi');

  const buffer = Buffer.from(await file.arrayBuffer());
  const result = restoreBackup(buffer);
  return json(result);
});
