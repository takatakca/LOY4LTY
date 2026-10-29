import { tierAtLeast } from '@/lib/app';
import { money, pick } from '@/lib/core/i18n';
import { maskPhone } from '@/lib/core/phone';
import type { PageCtx } from '@/lib/core/page';
import { getSettings, recentLedger, stats } from '@/lib/domain/loyalty';
import { ApiForm } from './ApiForm';
import { DeviceKeys } from './DeviceKeys';
import { Card, Stat } from './ui';

// LOY4LTY dashboard: members and points, rules (Premium), look up / enroll, redeem on a Clover order, recent activity.
export async function Panel({ ctx }: { ctx: PageCtx }) {
  const { lang, merchantId, tier } = ctx;
  if (!merchantId) return null;
  const [s, st, ledger] = await Promise.all([getSettings(merchantId), stats(merchantId), recentLedger(merchantId)]);
  return (
    <>
      <div className="grid">
        <Stat label={pick(lang, 'Membres', 'Members')} value={st.members} />
        <Stat label={pick(lang, 'Points en circulation', 'Points outstanding')} value={st.points.toLocaleString()} note={`${pick(lang, 'valeur', 'worth')} ${money(st.liabilityCents, lang)}`} />
        <Stat label={pick(lang, 'Règle', 'Rule')} value={`${s.pointsPerDollar} pt / $`} note={`1 pt = ${money(s.pointValueCents, lang)} · min ${s.minRedeemPoints}`} />
      </div>
      <Card title={pick(lang, 'Membre', 'Member')}>
        <p className="muted">{pick(lang, 'Les points se créditent seuls quand Clover confirme le paiement d’une commande dont le client a un téléphone.', 'Points are credited by themselves when Clover confirms the payment of an order whose customer has a phone.')}</p>
        <ApiForm action="/api/loyalty/members" fields={[{ name: 'phone', label: pick(lang, 'Téléphone', 'Phone'), type: 'tel', required: true }, { name: 'name', label: pick(lang, 'Prénom', 'First name') }]}
          submit={pick(lang, 'Inscrire / voir le solde', 'Enroll / see balance')} onResult={(j) => `${j.created ? pick(lang, 'Inscrit.', 'Enrolled.') : pick(lang, 'Déjà membre.', 'Already a member.')} ${j.member?.points ?? 0} pts`} />
      </Card>
      <Card title={pick(lang, 'Échanger des points', 'Redeem points')}>
        <ApiForm action="/api/loyalty/redeem" fields={[
          { name: 'phone', label: pick(lang, 'Téléphone', 'Phone'), type: 'tel', required: true },
          { name: 'points', label: 'Points', type: 'number', required: true },
          { name: 'orderId', label: pick(lang, 'ID de commande Clover', 'Clover order ID'), required: true },
        ]} submit={pick(lang, 'Appliquer le rabais', 'Apply the discount')} onResult={(j) => `${pick(lang, 'Rabais', 'Discount')} ${money(j.discountCents, lang)} · ${pick(lang, 'solde', 'balance')} ${j.balance} pts`} />
      </Card>
      {tierAtLeast(tier, 'premium') ? (
        <Card title={pick(lang, 'Règles', 'Rules')}>
          <ApiForm action="/api/loyalty/settings" method="PUT" fields={[
            { name: 'pointsPerDollar', label: pick(lang, 'Points par dollar', 'Points per dollar'), type: 'number', defaultValue: String(s.pointsPerDollar) },
            { name: 'pointValueCents', label: pick(lang, 'Valeur d’un point (¢)', 'Point value (¢)'), type: 'number', defaultValue: String(s.pointValueCents) },
            { name: 'minRedeemPoints', label: pick(lang, 'Minimum pour échanger', 'Minimum to redeem'), type: 'number', defaultValue: String(s.minRedeemPoints) },
          ]} submit={pick(lang, 'Enregistrer', 'Save')} />
        </Card>
      ) : <p className="muted">{pick(lang, 'Règles avancées (valeur du point, seuil) : forfait Premium.', 'Advanced rules (point value, threshold): Premium plan.')}</p>}
      <Card title={pick(lang, 'Activité récente', 'Recent activity')}>
        {ledger.length === 0 ? <p className="muted">—</p> : (
          <table><thead><tr><th>{pick(lang, 'Client', 'Customer')}</th><th>Points</th><th>{pick(lang, 'Solde', 'Balance')}</th><th>{pick(lang, 'Quoi', 'What')}</th></tr></thead>
            <tbody>{ledger.map((l, i) => <tr key={i}><td>{maskPhone(l.phone)}</td><td>{l.delta > 0 ? `+${l.delta}` : l.delta}</td><td>{l.balanceAfter}</td><td>{l.reason === 'earn' ? pick(lang, 'Gagné', 'Earned') : l.reason === 'redeem' ? pick(lang, 'Échangé', 'Redeemed') : pick(lang, 'Ajusté', 'Adjusted')}</td></tr>)}</tbody></table>
        )}
      </Card>
      <DeviceKeys merchantId={merchantId} lang={lang} kind="loyalty" title={pick(lang, 'Appareils (caisse, borne)', 'Devices (register, kiosk)')}
        hint={pick(lang, 'Une clé par appareil qui consulte ou échange des points (C4ISSE, T4CTILE).', 'One key per device that looks up or redeems points (C4ISSE, T4CTILE).')} />
    </>
  );
}
