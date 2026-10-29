// LOY4LTY: points from confirmed Clover payments (once), redeem as a Clover discount (once per order), rules.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { earnFromPayment, enroll, getMember, redeem, saveSettings, stats } from '@/lib/domain/loyalty';
import { hooks } from '@/lib/domain';
import { connect, fakeClover, MID } from './helpers';

let payment: any;
let calls: ReturnType<typeof fakeClover>;
beforeEach(async () => {
  payment = { id: 'PAY000000001', result: 'SUCCESS', amount: 2875, taxAmount: 375, tipAmount: 500, order: { id: 'ORDER0000001' } };
  calls = fakeClover([(u, init) => {
    if (u.pathname.endsWith('/payments/PAY000000001')) return payment;
    if (u.pathname.endsWith('/orders/ORDER0000001')) return { id: 'ORDER0000001', customers: { elements: [{ id: 'CUST00000001' }] } };
    if (u.pathname.endsWith('/orders/ORDER0000002')) return { id: 'ORDER0000002' };
    if (u.pathname.endsWith('/customers/CUST00000001')) return { id: 'CUST00000001', firstName: 'Ana', phoneNumbers: { elements: [{ phoneNumber: '(514) 555-0101' }] } };
    if (u.pathname.endsWith('/discounts') && init?.method === 'POST') return { id: 'DISC00000001' };
    return undefined;
  }]);
  await connect();
});
afterEach(() => vi.unstubAllGlobals());

describe('earning', () => {
  it('credits floor(pre-tax $) once per payment, auto-enrolling the order customer', async () => {
    expect(await earnFromPayment(MID, 'PAY000000001')).toEqual({ earned: 25 });
    expect(await earnFromPayment(MID, 'PAY000000001')).toMatchObject({ earned: 0, reason: 'already credited' });
    const m = await getMember(MID, '+15145550101');
    expect(m).toMatchObject({ points: 25, lifetimePoints: 25, name: 'Ana', cloverCustomerId: 'CUST00000001' });
  });

  it('ignores failed payments and orders without a customer phone', async () => {
    payment.result = 'FAIL';
    expect(await earnFromPayment(MID, 'PAY000000001')).toMatchObject({ earned: 0 });
    payment = { ...payment, result: 'SUCCESS', order: { id: 'ORDER0000002' } };
    expect(await earnFromPayment(MID, 'PAY000000001')).toMatchObject({ earned: 0, reason: 'no customer phone on the order' });
  });

  it('runs from the Clover webhook hook', async () => {
    await hooks.onCloverEvent!({ merchantId: MID, prefix: 'P', objectId: 'PAY000000001', type: 'CREATE', ts: 1 });
    expect((await getMember(MID, '+15145550101'))?.points).toBe(25);
  });
});

describe('redeeming', () => {
  it('puts a discount on the Clover order and takes the points off, once per order', async () => {
    await enroll(MID, '514-555-0101', 'Ana');
    await saveSettings(MID, { minRedeemPoints: 10 });
    expect(await redeem(MID, '5145550101', 10, 'ORDER0000001')).toMatchObject({ ok: false, error: expect.stringMatching(/Only 0/) });
    await earnFromPayment(MID, 'PAY000000001');
    expect(await redeem(MID, '5145550101', 5, 'ORDER0000001')).toMatchObject({ ok: false, error: 'Minimum 10 points.' });
    expect(await redeem(MID, '5145550101', 20, 'ORDER0000001')).toEqual({ ok: true, discountCents: 100, balance: 5 });
    const d = calls.find((c) => c.path.endsWith('/orders/ORDER0000001/discounts'))!;
    expect(d.body).toEqual({ name: 'LOY4LTY (20 pts)', amount: -100 });
    expect(await redeem(MID, '5145550101', 5, 'ORDER0000001')).toMatchObject({ ok: false });
    expect(await stats(MID)).toEqual({ members: 1, points: 5, liabilityCents: 25 });
  });

  it('refuses bad rules and bad phones', async () => {
    expect(await saveSettings(MID, { pointValueCents: 0 })).toMatchObject({ ok: false });
    expect(await enroll(MID, '123')).toMatchObject({ ok: false });
  });
});
