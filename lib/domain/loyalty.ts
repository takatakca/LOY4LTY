// LOY4LTY — loyalty by phone number. Clover has no points API: the points ledger lives here, key = the customer's
// phone (E.164) for each merchant.
//  - Earn: when Clover confirms a payment (webhook P), the order's Clover customer (with a phone) earns
//    floor(pre-tax amount in $ × points per $) — tips and taxes never earn. Once per payment. Customers without a phone
//    on the order earn nothing (the staff enters the phone at the counter or the kiosk to attach it).
//  - Redeem: points become a discount on the Clover order before payment (POST orders/{id}/discounts). Once per order.
//  - The other suite apps hear "loy4lty.points_awarded" / "loy4lty.points_redeemed" with a one-way customer reference.
import crypto from 'node:crypto';
import { cloverGet, cloverPost, mpath } from '../clover/api';
import { customerRef, normalizePhone } from '../core/phone';
import { getStore } from '../core/store';
import { emitSuite } from '../suite';

export interface LoyaltySettings { pointsPerDollar: number; pointValueCents: number; minRedeemPoints: number }
export const DEFAULT_SETTINGS: LoyaltySettings = { pointsPerDollar: 1, pointValueCents: 5, minRedeemPoints: 100 };
export interface Member { phone: string; name: string | null; points: number; lifetimePoints: number; cloverCustomerId: string | null; joinedAt: string; lastActivityAt: string }
export interface LedgerEntry { phone: string; delta: number; reason: 'earn' | 'redeem' | 'adjust'; paymentId?: string | null; orderId?: string | null; balanceAfter: number; by: string }

export const MEMBERS = 'members';
export const LEDGER = 'points';
const memberId = (mid: string, phone: string) => `${mid}:${phone}`;
const settingsKey = (mid: string) => `m:${mid}:loyalty:settings`;

export async function getSettings(mid: string): Promise<LoyaltySettings> {
  return { ...DEFAULT_SETTINGS, ...((await getStore().getKv<Partial<LoyaltySettings>>(settingsKey(mid))) ?? {}) };
}

export async function saveSettings(mid: string, s: Partial<LoyaltySettings>): Promise<{ ok: true; settings: LoyaltySettings } | { ok: false; error: string }> {
  const next = { ...(await getSettings(mid)), ...s };
  if (!(next.pointsPerDollar > 0 && next.pointsPerDollar <= 100)) return { ok: false, error: 'Points per dollar: 0.01 to 100.' };
  if (!Number.isInteger(next.pointValueCents) || next.pointValueCents < 1 || next.pointValueCents > 1000) return { ok: false, error: 'Point value: 1 to 1000 cents.' };
  if (!Number.isInteger(next.minRedeemPoints) || next.minRedeemPoints < 1 || next.minRedeemPoints > 100_000) return { ok: false, error: 'Minimum to redeem: 1 to 100 000 points.' };
  await getStore().setKv(settingsKey(mid), next);
  return { ok: true, settings: next };
}

export async function getMember(mid: string, phone: string): Promise<Member | null> {
  return (await getStore().get<Member>(MEMBERS, memberId(mid, phone)))?.data ?? null;
}

export async function enroll(mid: string, rawPhone: unknown, name?: string | null, cloverCustomerId?: string | null): Promise<{ ok: true; member: Member; created: boolean } | { ok: false; error: string }> {
  const phone = normalizePhone(rawPhone);
  if (!phone) return { ok: false, error: 'Phone number is not valid (10 digits).' };
  const cur = await getMember(mid, phone);
  if (cur) {
    const patch = { ...cur, name: cur.name ?? (name?.trim().slice(0, 60) || null), cloverCustomerId: cur.cloverCustomerId ?? cloverCustomerId ?? null };
    if (patch.name !== cur.name || patch.cloverCustomerId !== cur.cloverCustomerId) await getStore().put(MEMBERS, memberId(mid, phone), mid, patch, cur.joinedAt);
    return { ok: true, member: patch, created: false };
  }
  const now = new Date().toISOString();
  const member: Member = { phone, name: name?.trim().slice(0, 60) || null, points: 0, lifetimePoints: 0, cloverCustomerId: cloverCustomerId ?? null, joinedAt: now, lastActivityAt: now };
  await getStore().put(MEMBERS, memberId(mid, phone), mid, member, now);
  return { ok: true, member, created: true };
}

const locks = new Map<string, Promise<unknown>>();
/** One change at a time per member (two payments of the same customer arriving together). */
async function withMember<T>(mid: string, phone: string, fn: () => Promise<T>): Promise<T> {
  const key = memberId(mid, phone);
  const prev = locks.get(key) ?? Promise.resolve();
  const run = prev.catch(() => undefined).then(fn);
  locks.set(key, run.finally(() => { if (locks.get(key) === run) locks.delete(key); }));
  return run;
}

async function applyDelta(mid: string, phone: string, delta: number, entry: Omit<LedgerEntry, "balanceAfter" | "phone" | "delta">, id: string = crypto.randomUUID()): Promise<Member> {
  const m = (await getMember(mid, phone))!;
  const next: Member = { ...m, points: m.points + delta, lifetimePoints: m.lifetimePoints + Math.max(0, delta), lastActivityAt: new Date().toISOString() };
  await getStore().put(MEMBERS, memberId(mid, phone), mid, next, m.joinedAt);
  await getStore().put<LedgerEntry>(LEDGER, id, mid, { phone, delta, balanceAfter: next.points, ...entry });
  return next;
}

/** The phone of the Clover customer attached to an order, if any. */
async function orderCustomer(mid: string, orderId: string): Promise<{ phone: string; name: string | null; customerId: string } | null> {
  const o = await cloverGet<any>(mid, mpath(mid, `/orders/${encodeURIComponent(orderId)}`), { expand: 'customers' });
  const c = o.json?.customers?.elements?.[0];
  if (!c?.id) return null;
  const cust = await cloverGet<any>(mid, mpath(mid, `/customers/${encodeURIComponent(c.id)}`), { expand: 'phoneNumbers' });
  const phone = ((cust.json?.phoneNumbers?.elements ?? []) as any[]).map((p) => normalizePhone(p.phoneNumber)).find(Boolean);
  if (!phone) return null;
  const name = [cust.json?.firstName, cust.json?.lastName].filter(Boolean).join(' ').trim() || null;
  return { phone, name, customerId: String(c.id) };
}

/** Webhook P CREATE: credit the points of a confirmed payment, once. */
export async function earnFromPayment(mid: string, paymentId: string): Promise<{ earned: number; reason?: string }> {
  const p = await cloverGet<any>(mid, mpath(mid, `/payments/${encodeURIComponent(paymentId)}`), { expand: 'order' });
  if (!p.ok || !p.json) return { earned: 0, reason: p.error ?? 'payment not readable' };
  if (p.json.result && p.json.result !== 'SUCCESS') return { earned: 0, reason: 'payment not successful' };
  const orderId = p.json.order?.id;
  if (!orderId) return { earned: 0, reason: 'no order' };
  const who = await orderCustomer(mid, String(orderId));
  if (!who) return { earned: 0, reason: 'no customer phone on the order' };
  const s = await getSettings(mid);
  const preTax = Math.max(0, (Number(p.json.amount) || 0) - (Number(p.json.taxAmount) || 0));
  const points = Math.floor((preTax / 100) * s.pointsPerDollar);
  if (points <= 0) return { earned: 0, reason: 'amount too small' };
  if (!(await getStore().claim(`m:${mid}:earn:${paymentId}`, Date.now()))) return { earned: 0, reason: 'already credited' };
  await enroll(mid, who.phone, who.name, who.customerId);
  const member = await withMember(mid, who.phone, () => applyDelta(mid, who.phone, points, { reason: 'earn', paymentId, orderId: String(orderId), by: 'Clover' }, `${mid}:pay:${paymentId}`));
  await emitSuite('points_awarded', { merchantId: mid, customerRef: customerRef(mid, who.phone), points, balance: member.points }, `${mid}-earn-${paymentId}`);
  return { earned: points };
}

/** Points → discount on a Clover order (before payment). Once per order. */
export async function redeem(mid: string, rawPhone: unknown, points: number, orderId: string, by = 'Comptoir'): Promise<{ ok: true; discountCents: number; balance: number } | { ok: false; error: string }> {
  const phone = normalizePhone(rawPhone);
  if (!phone) return { ok: false, error: 'Phone number is not valid.' };
  if (!/^[A-Z0-9]{8,20}$/i.test(orderId)) return { ok: false, error: 'Clover order ID is not valid.' };
  const s = await getSettings(mid);
  if (!Number.isInteger(points) || points < s.minRedeemPoints) return { ok: false, error: `Minimum ${s.minRedeemPoints} points.` };
  return withMember(mid, phone, async () => {
    const m = await getMember(mid, phone);
    if (!m) return { ok: false as const, error: 'Not a member.' };
    if (m.points < points) return { ok: false as const, error: `Only ${m.points} points available.` };
    if (!(await getStore().claim(`m:${mid}:redeem:${orderId}`, Date.now()))) return { ok: false as const, error: 'Points were already used on this order.' };
    const discountCents = points * s.pointValueCents;
    const r = await cloverPost(mid, mpath(mid, `/orders/${encodeURIComponent(orderId)}/discounts`), { name: `LOY4LTY (${points} pts)`, amount: -discountCents });
    if (!r.ok) { await getStore().deleteKv(`m:${mid}:redeem:${orderId}`); return { ok: false as const, error: r.error ?? 'Clover refused the discount.' }; }
    const next = await applyDelta(mid, phone, -points, { reason: 'redeem', orderId, by: by.slice(0, 60) });
    await emitSuite('points_redeemed', { merchantId: mid, customerRef: customerRef(mid, phone), points, discountCents, balance: next.points }, `${mid}-redeem-${orderId}`);
    return { ok: true as const, discountCents, balance: next.points };
  });
}

export async function stats(mid: string): Promise<{ members: number; points: number; liabilityCents: number }> {
  const s = await getSettings(mid);
  const all = (await getStore().list<Member>(MEMBERS, { merchantId: mid, limit: 100_000 })).map((d) => d.data);
  const points = all.reduce((t, m) => t + m.points, 0);
  return { members: all.length, points, liabilityCents: points * s.pointValueCents };
}

export async function recentLedger(mid: string, limit = 20): Promise<LedgerEntry[]> {
  return (await getStore().list<LedgerEntry>(LEDGER, { merchantId: mid, limit })).map((d) => d.data);
}
