import { isCtx, requireMerchantOrDevice } from '@/lib/core/guard';
import { fail, ok, readJson } from '@/lib/core/http';
import { redeem } from '@/lib/domain/loyalty';

export const dynamic = 'force-dynamic';

// { phone, points, orderId } → discount on the Clover order, points taken off (once per order).
export async function POST(req: Request) {
  const c = await requireMerchantOrDevice(req);
  if (!isCtx(c)) return c;
  const b = await readJson(req);
  if (!b) return fail('JSON body required');
  const r = await redeem(c.merchantId, b.phone, Number(b.points), String(b.orderId ?? ''), String(b.by ?? 'Tableau de bord'));
  return r.ok ? ok(r) : fail(r.error, 422);
}
