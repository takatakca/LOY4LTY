// LOY4LTY's side of the shared shell: hooks, menu sections, authorized actions, device kinds, what each plan adds.
// A confirmed Clover payment (P CREATE) credits the order customer's points.
import type { AppHooks } from '../hooks';
import type { AppAction, AppSection, DeviceKind, TierFeatures } from '../nav';
import { earnFromPayment } from './loyalty';

export const hooks: AppHooks = {
  async onCloverEvent(e) {
    if (e.prefix === 'P' && e.type === 'CREATE') await earnFromPayment(e.merchantId, e.objectId);
  },
};

export const sections: AppSection[] = [
  { slug: '', fr: 'Vue d’ensemble', en: 'Overview', icon: 'star', hintFr: 'Membres, points en circulation et activité récente.', hintEn: 'Members, points outstanding and recent activity.' },
  { slug: 'counter', fr: 'Au comptoir', en: 'At the counter', icon: 'register', hub: true, hintFr: 'Inscrire un client, voir son solde, échanger des points.', hintEn: 'Enroll a customer, see a balance, redeem points.' },
  { slug: 'members', parent: 'counter', fr: 'Membre', en: 'Member', icon: 'user', view: 'loyalty.enroll', hintFr: 'Inscription ou solde, par numéro de téléphone.', hintEn: 'Enrollment or balance, by phone number.' },
  { slug: 'redeem', parent: 'counter', fr: 'Échanger des points', en: 'Redeem points', icon: 'gift', view: 'loyalty.redeem', hintFr: 'Les points deviennent un rabais sur la commande Clover.', hintEn: 'Points become a discount on the Clover order.' },
  { slug: 'rules', fr: 'Règles', en: 'Rules', icon: 'tag', tier: 'premium', hintFr: 'Points par dollar, valeur d’un point, seuil d’échange.', hintEn: 'Points per dollar, point value, redeem threshold.' },
  { slug: 'devices', fr: 'Appareils', en: 'Devices', icon: 'device', hintFr: 'Une clé par caisse ou borne qui consulte ou échange des points.', hintEn: 'One key per register or kiosk that looks up or redeems points.' },
];

export const actions: AppAction[] = [
  { key: 'loyalty.enroll', fr: 'Inscrire un client et voir son solde', en: 'Enroll a customer and see a balance', min: 'employee' },
  { key: 'loyalty.redeem', fr: 'Échanger des points en rabais', en: 'Redeem points as a discount', min: 'employee' },
  { key: 'loyalty.settings', fr: 'Changer les règles de points', en: 'Change the points rules', min: 'manager' },
];

export const deviceKinds: DeviceKind[] = [{ kind: 'loyalty', fr: 'Caisse ou borne (fidélité)', en: 'Register or kiosk (loyalty)' }];

export const tierFeatures: TierFeatures = {
  base: [
    ['Inscription par numéro de téléphone', 'Enrollment by phone number'],
    ['Points crédités quand Clover confirme le paiement', 'Points credited when Clover confirms the payment'],
    ['Échange en rabais sur la commande Clover, une fois par commande', 'Redeemed as a discount on the Clover order, once per order'],
    ['Solde à la caisse et à la borne (clés d’appareil)', 'Balance at the register and the kiosk (device keys)'],
  ],
  premium: [
    ['Règles : points par dollar, valeur du point, seuil d’échange', 'Rules: points per dollar, point value, redeem threshold'],
  ],
  vip: [
    ['Bientôt : paliers de membres, campagnes de points M4RKETING, arrimage REW4RDS', 'Coming: member tiers, M4RKETING points campaigns, REW4RDS link'],
  ],
};
