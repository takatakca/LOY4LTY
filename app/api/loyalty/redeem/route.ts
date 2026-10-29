import { isCtx, requireMerchantOrDevice } from '@/lib/core/guard';
import { fail, ok, readJson } from '@/lib/core/http';
import { redeem } from '@/lib/domain/loyalty';

export const dynamic = 'force-dynamic';

// { phone, points, orderId } → discount on the Clover order, points taken off (once per order).
export async function POST(req: Request) {
  const c = await requireMerchantOrDevice(req, 'base', { action: 'loyalty.redeem' });
  if (!isCtx(c)) return c;
  const b = await readJson(req);
  if (!b) return fail('JSON body required');
  // Who: the signed-in person, or the device plus the cashier's name it sends.
  const by = c.device && typeof b.by === 'string' && b.by.trim() ? `${b.by.trim().slice(0, 40)} (${c.actor})` : c.actor;
  const r = await redeem(c.merchantId, b.phone, Number(b.points), String(b.orderId ?? ''), by);
  return r.ok ? ok(r) : fail(r.error, 422);
}
