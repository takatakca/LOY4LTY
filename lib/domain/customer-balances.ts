// App-specific, server-to-server read-only customer projection. Never accepts a phone or a card code.
// The existing merchant-scoped customerRef is derived by Food Hub from a live verified customer.
import crypto from 'node:crypto';
import { APP } from '../app';
import { getMerchant } from '../clover/oauth';
import { customerRef, normalizePhone } from '../core/phone';
import { getStore } from '../core/store';
import { suiteConfig, verifySuite } from '../suite';
import { MEMBERS, type Member } from './loyalty';

export const BALANCE_BODY_MAX = 2048;
export const BALANCE_SCAN_MAX = 10_000;
const TENANT = /^[a-z0-9][a-z0-9-]{1,39}$/;
const MERCHANT = /^[A-Z0-9]{8,20}$/;
const REF = /^[0-9a-f]{32}$/;
const REQUEST_ID = /^[a-zA-Z0-9-]{16,80}$/;
const FIELDS = ['version', 'app', 'purpose', 'requestId', 'tenant', 'merchantId', 'customerRef'];

export interface CustomerBalanceRequest { version: 1; app: string; purpose: 'customer.balance.read'; requestId: string; tenant: string; merchantId: string; customerRef: string }

/** Explicit website -> ONE merchant program. Invalid configuration never authorizes a partial map. */
export function customerMerchantMap(raw = process.env.FOODHUB_CUSTOMER_SUITE_MERCHANTS): Map<string, string> | null {
  if (!raw || raw.length > 4096) return null;
  try {
    const data: unknown = JSON.parse(raw);
    if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
    const pairs = Object.entries(data);
    if (!pairs.length || pairs.length > 32 || pairs.some(([tenant, mid]) => !TENANT.test(tenant) || typeof mid !== 'string' || !MERCHANT.test(mid))) return null;
    return new Map(pairs as Array<[string, string]>);
  } catch { return null; }
}

const reply = (body: Record<string, unknown>, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
const refused = (code: string, status: number) => reply({ ok: false, code }, status);

async function readBoundedBody(req: Request): Promise<string | null> {
  if (!req.body) return '';
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      bytes += next.value.byteLength;
      if (bytes > BALANCE_BODY_MAX) { await reader.cancel(); return null; }
      chunks.push(next.value);
    }
    return Buffer.concat(chunks).toString('utf8');
  } finally { reader.releaseLock(); }
}

/** Only business data is read. The request nonce is claimed to reject replay, with no customer identifier stored. */
export async function customerBalance(req: Request): Promise<Response> {
  const config = suiteConfig();
  const map = customerMerchantMap();
  if (!config || !map) return refused('not_configured', 503);
  if (req.headers.get('x-takatak-app') !== 'foodhub') return refused('unauthorized', 401);
  if (!/application\/json/i.test(req.headers.get('content-type') ?? '')) return refused('invalid_request', 415);
  if (Number(req.headers.get('content-length') ?? 0) > BALANCE_BODY_MAX) return refused('body_too_large', 413);
  let raw: string | null;
  try { raw = await readBoundedBody(req); } catch { return refused('invalid_request', 400); }
  if (raw === null) return refused('body_too_large', 413);
  if (!verifySuite(config.secret, req.headers.get('x-takatak-signature'), raw)) return refused('unauthorized', 401);
  let body: CustomerBalanceRequest;
  try { body = JSON.parse(raw) as CustomerBalanceRequest; } catch { return refused('invalid_request', 400); }
  if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).length !== FIELDS.length || Object.keys(body).some((k) => !FIELDS.includes(k))
    || body.version !== 1 || body.app !== APP.key || body.purpose !== 'customer.balance.read'
    || typeof body.requestId !== 'string' || !REQUEST_ID.test(body.requestId)
    || typeof body.tenant !== 'string' || !TENANT.test(body.tenant)
    || typeof body.merchantId !== 'string' || !MERCHANT.test(body.merchantId)
    || typeof body.customerRef !== 'string' || !REF.test(body.customerRef)) return refused('invalid_request', 400);
  if (map.get(body.tenant) !== body.merchantId) return refused('scope_refused', 403);
  try {
    const store = getStore();
    // A production balance must survive restart; memory remains available for isolated unit tests/development.
    if (process.env.NODE_ENV === 'production' && store.mode !== 'postgres') return refused('storage_unavailable', 503);
    const merchant = await getMerchant(body.merchantId);
    if (!merchant || merchant.status !== 'active') return refused('merchant_unavailable', 403);
    const nonce = crypto.createHash('sha256').update(body.requestId).digest('hex');
    if (!await store.claim(`customer-balance:${APP.key}:${nonce}`, Date.now())) return refused('replayed_request', 409);
    const projection = await balanceProjection(body.merchantId, body.customerRef);
    if (!projection) return refused('balance_unavailable', 503);
    const name = typeof merchant.name === 'string' ? merchant.name.trim().slice(0, 120) : '';
    return reply({ ok: true, version: 1, app: APP.key, requestId: body.requestId, tenant: body.tenant, merchantId: body.merchantId, customerRef: body.customerRef,
      program: { scope: 'merchant', ...(name ? { name } : {}) }, ...projection });
  } catch {
    return refused('balance_unavailable', 503);
  }
}

/** Existing enrollment is the ownership mapping; this endpoint never enrolls or credits anyone. */
async function balanceProjection(mid: string, ref: string): Promise<{ membership: 'linked'; points: number } | { membership: 'not_linked' } | null> {
  const docs = await getStore().list<Member>(MEMBERS, { merchantId: mid, limit: BALANCE_SCAN_MAX });
  // Store's Postgres implementation caps queries at 10,000. Never turn a truncated scan into a fake zero/not-found.
  if (docs.length >= BALANCE_SCAN_MAX) return null;
  const members = docs.filter((d) => d.merchantId === mid && normalizePhone(d.data.phone) === d.data.phone && customerRef(mid, d.data.phone) === ref);
  if (!members.length) return { membership: 'not_linked' };
  if (members.length !== 1 || !Number.isSafeInteger(members[0].data.points) || members[0].data.points < 0) return null;
  return { membership: 'linked', points: members[0].data.points };
}
