// LOY4LTY hooks: a confirmed Clover payment (P CREATE) credits the order customer's points.
import type { AppHooks } from '../hooks';
import { earnFromPayment } from './loyalty';

export const hooks: AppHooks = {
  async onCloverEvent(e) {
    if (e.prefix === 'P' && e.type === 'CREATE') await earnFromPayment(e.merchantId, e.objectId);
  },
};
