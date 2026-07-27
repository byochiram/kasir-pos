import { requireAdmin } from '@/lib/auth';
import { setPurchaseOrderStatus } from '@/lib/db';
import { json, readBody, route } from '@/lib/http';
import { purchaseOrderStatusSchema } from '@/lib/validation';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Mengubah status PO. Transisi ke "received" sekaligus menambah stok dan
 * memperbarui harga modal produk, jadi hanya boleh sekali.
 */
export const POST = route(async (request, { params }) => {
  const session = await requireAdmin();
  const { id } = await params;
  const { status } = await readBody(request, purchaseOrderStatusSchema);
  return json(setPurchaseOrderStatus(id, status, session.id));
});
