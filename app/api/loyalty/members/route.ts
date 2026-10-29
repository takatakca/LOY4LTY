import { isCtx, requireMerchantOrDevice } from '@/lib/core/guard';
import { fail, ok, readJson } from '@/lib/core/http';
import { normalizePhone } from '@/lib/core/phone';
import { enroll, getMember } from '@/lib/domain/loyalty';

export const dynamic = 'force-dynamic';

// GET ?phone= → balance (signed-in merchant, or a register / kiosk device key).
export async function GET(req: Request) {
  const c = await requireMerchantOrDevice(req, 'base', { action: 'loyalty.enroll' });
  if (!isCtx(c)) return c;
  const phone = normalizePhone(new URL(req.url).searchParams.get('phone'));
  if (!phone) return fail('Phone number is not valid.');
  const m = await getMember(c.merchantId, phone);
  return m ? ok({ member: m }) : fail('Not a member yet.', 404);
}

// { phone, name? } → enrolled (or already a member).
export async function POST(req: Request) {
  const c = await requireMerchantOrDevice(req, 'base', { action: 'loyalty.enroll' });
  if (!isCtx(c)) return c;
  const b = await readJson(req);
  if (!b) return fail('JSON body required');
  const r = await enroll(c.merchantId, b.phone, typeof b.name === 'string' ? b.name : null);
  return r.ok ? ok({ member: r.member, created: r.created }) : fail(r.error);
}
