import { isCtx, requireMerchant } from '@/lib/core/guard';
import { fail, ok, readJson } from '@/lib/core/http';
import { getSettings, saveSettings } from '@/lib/domain/loyalty';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const c = await requireMerchant(req);
  if (!isCtx(c)) return c;
  return ok({ settings: await getSettings(c.merchantId) });
}

// { pointsPerDollar?, pointValueCents?, minRedeemPoints? } — advanced rules are Premium; Base keeps the defaults.
export async function PUT(req: Request) {
  const c = await requireMerchant(req, 'premium');
  if (!isCtx(c)) return c;
  const b = await readJson(req);
  if (!b) return fail('JSON body required');
  const patch: Record<string, number> = {};
  for (const k of ['pointsPerDollar', 'pointValueCents', 'minRedeemPoints']) if (b[k] !== undefined) patch[k] = Number(b[k]);
  const r = await saveSettings(c.merchantId, patch);
  return r.ok ? ok({ settings: r.settings }) : fail(r.error);
}
