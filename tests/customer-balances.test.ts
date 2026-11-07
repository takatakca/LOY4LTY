import crypto from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from '@/app/api/loyalty/customer-balance/route';
import { BALANCE_SCAN_MAX, customerMerchantMap } from '@/lib/domain/customer-balances';
import { customerRef } from '@/lib/core/phone';
import { getStore } from '@/lib/core/store';
import { getMerchant, MERCHANTS } from '@/lib/clover/oauth';
import { signSuite } from '@/lib/suite';
import { connect, fakeClover, MID } from './helpers';
import { enroll, getMember, MEMBERS } from '@/lib/domain/loyalty';

const KEY = 'synthetic-balance-signing-key-0123456789';
const PHONE = '+15145550101';
const OTHER = 'MERCHANT0002';
const APP = 'loy4lty';
const PATH = '/api/loyalty/customer-balance';
const config = () => Object.assign(process.env, { FOODHUB_URL: 'https://hub.example.test', FOODHUB_SUITE_SECRET: KEY,
  FOODHUB_CUSTOMER_SUITE_MERCHANTS: JSON.stringify({ on2go: MID, pppmtl: OTHER }) });
const payload = (extra: Record<string, unknown> = {}) => ({ version: 1, app: APP, purpose: 'customer.balance.read', requestId: crypto.randomUUID(), tenant: 'on2go', merchantId: MID, customerRef: customerRef(MID, PHONE), ...extra });
function request(body = payload(), now = Date.now(), signature?: string) {
  const raw = JSON.stringify(body);
  return new Request('https://app.example.test'+PATH, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Takatak-App': 'foodhub', 'X-Takatak-Signature': signature ?? signSuite(KEY, raw, now) }, body: raw });
}
let calls: ReturnType<typeof fakeClover>;
beforeEach(async () => { calls = fakeClover(); await connect(); await connect(OTHER); config(); });
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); delete process.env.FOODHUB_CUSTOMER_SUITE_MERCHANTS; });

describe('signed customer balance ownership', () => {
  it('fails closed for absent/malformed or multi-merchant program mapping', async () => {
    delete process.env.FOODHUB_CUSTOMER_SUITE_MERCHANTS;
    expect((await POST(request())).status).toBe(503);
    expect(customerMerchantMap('{bad')).toBeNull();
    expect(customerMerchantMap(JSON.stringify({ on2go: [MID, OTHER] }))).toBeNull();
    expect(customerMerchantMap(JSON.stringify({ on2go: MID, bad: 'invalid' }))).toBeNull();
  });
  it('rejects unsigned, tampered, expired, wrong-app and raw-phone requests', async () => {
    const noSignature = request();noSignature.headers.delete('x-takatak-signature');
    expect((await POST(noSignature)).status).toBe(401);
    const signed = request();
    const changed = new Request(signed.url, { method:'POST', headers:signed.headers, body:JSON.stringify(payload({ tenant:'pppmtl' })) });
    expect((await POST(changed)).status).toBe(401);
    expect((await POST(request(payload(), Date.now()-301_000))).status).toBe(401);
    expect((await POST(request(payload({ app:'other' })))).status).toBe(400);
    expect((await POST(request(payload({ phone:PHONE })))).status).toBe(400);
    const wrongCaller=request();wrongCaller.headers.set('x-takatak-app','browser');
    expect((await POST(wrongCaller)).status).toBe(401);
  });
  it('bounds an unknown-length body before signature verification', async () => {
    const huge=new Request('https://app.example.test'+PATH,{method:'POST',headers:{'Content-Type':'application/json','X-Takatak-App':'foodhub'},body:'x'.repeat(2049)});
    expect((await POST(huge)).status).toBe(413);
  });
  it('requires the explicitly authorized tenant/merchant pair and active merchant', async () => {
    expect((await POST(request(payload({ merchantId:OTHER })))).status).toBe(403);
    const m=(await getMerchant(MID))!;await getStore().put(MERCHANTS,MID,MID,{...m,status:'uninstalled'});
    expect((await POST(request())).status).toBe(403);
  });
  it('rejects replay without changing funds or customer records', async () => {
    const body=payload();const raw=JSON.stringify(body);const signature=signSuite(KEY,raw);
    const count=calls.length;
    expect((await POST(request(body,Date.now(),signature))).status).toBe(200);
    expect((await POST(request(body,Date.now(),signature))).status).toBe(409);
    expect(calls.length).toBe(count);
  });
  it('refuses truncated scans and non-persistent production state', async () => {
    const spy=vi.spyOn(getStore(),'list').mockResolvedValue(Array(BALANCE_SCAN_MAX).fill({}));
    expect((await POST(request())).status).toBe(503);spy.mockRestore();
    vi.stubEnv('NODE_ENV','production');expect((await POST(request())).status).toBe(503);
  });
  it('returns a real member balance including zero, never auto-enrolls or leaks another merchant', async () => {
    await enroll(MID,PHONE,'Demo member');
    await enroll(OTHER,PHONE,'Other member');
    const mine=await getMember(MID,PHONE);await getStore().put(MEMBERS,`${MID}:${PHONE}`,MID,{...mine!,points:37});
    const theirs=await getMember(OTHER,PHONE);await getStore().put(MEMBERS,`${OTHER}:${PHONE}`,OTHER,{...theirs!,points:999});
    const before=await getStore().list(MEMBERS);const count=calls.length;
    const r=await POST(request());const data=await r.json();
    expect(r.status).toBe(200);expect(r.headers.get('cache-control')).toBe('no-store');
    expect(data).toMatchObject({membership:'linked',points:37,program:{scope:'merchant',name:'Test Resto'}});
    expect(JSON.stringify(data)).not.toContain(PHONE);expect(JSON.stringify(data)).not.toContain('Demo member');
    expect(await getStore().list(MEMBERS)).toEqual(before);expect(calls.length).toBe(count);
    const missing=await (await POST(request(payload({customerRef:customerRef(MID,'+15145550102')})))).json();
    expect(missing).toMatchObject({membership:'not_linked'});expect(missing).not.toHaveProperty('points');
    expect(await getStore().list(MEMBERS)).toEqual(before);
    await getStore().put(MEMBERS,`${MID}:${PHONE}`,MID,{...mine!,points:0});
    expect(await (await POST(request())).json()).toMatchObject({membership:'linked',points:0});
  });
});
