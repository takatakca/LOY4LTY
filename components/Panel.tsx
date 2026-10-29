import { money, pick } from '@/lib/core/i18n';
import { maskPhone } from '@/lib/core/phone';
import type { PageCtx } from '@/lib/core/page';
import { getSettings, recentLedger, stats } from '@/lib/domain/loyalty';
import { ApiForm } from './ApiForm';
import { DeviceKeys } from './DeviceKeys';
import { Badge, Card, Empty, Stat } from './ui';

// LOY4LTY screens (lib/domain `sections`): overview, member (enroll / balance), redeem, rules (Premium), devices.
export async function Panel({ ctx, section }: { ctx: PageCtx; section: string; query?: Record<string, string> }) {
  const { lang, merchantId } = ctx;
  switch (section) {
    case '': return <Overview ctx={ctx} />;
    case 'members': return (
      <Card title={pick(lang, 'Inscrire ou consulter', 'Enroll or look up')} icon="user" sub={pick(lang, 'Les points se créditent seuls quand Clover confirme le paiement d’une commande dont le client a un téléphone.', 'Points are credited by themselves when Clover confirms the payment of an order whose customer has a phone.')}>
        <ApiForm action="/api/loyalty/members" lang={lang} fields={[{ name: 'phone', label: pick(lang, 'Téléphone', 'Phone'), type: 'tel', required: true }, { name: 'name', label: pick(lang, 'Prénom', 'First name') }]}
          submit={pick(lang, 'Inscrire / voir le solde', 'Enroll / see balance')} result={pick(lang, '{created?Inscrit.|Déjà membre.} Solde : {member.points} points', '{created?Enrolled.|Already a member.} Balance: {member.points} points')} />
      </Card>
    );
    case 'redeem': {
      const s = await getSettings(merchantId!);
      return (
        <Card title={pick(lang, 'Échanger des points', 'Redeem points')} icon="gift" sub={pick(lang, `1 point = ${money(s.pointValueCents, lang)} · minimum ${s.minRedeemPoints} points · une fois par commande.`, `1 point = ${money(s.pointValueCents, lang)} · minimum ${s.minRedeemPoints} points · once per order.`)}>
          <ApiForm action="/api/loyalty/redeem" lang={lang} fields={[
            { name: 'phone', label: pick(lang, 'Téléphone', 'Phone'), type: 'tel', required: true },
            { name: 'points', label: 'Points', type: 'number', required: true },
            { name: 'orderId', label: pick(lang, 'ID de commande Clover', 'Clover order ID'), required: true },
          ]} submit={pick(lang, 'Appliquer le rabais', 'Apply the discount')} confirm={pick(lang, 'Appliquer ce rabais à la commande Clover ?', 'Apply this discount to the Clover order?')}
            result={pick(lang, 'Rabais {discountCents|money} · solde {balance} points', 'Discount {discountCents|money} · balance {balance} points')} />
        </Card>
      );
    }
    case 'rules': return <Rules ctx={ctx} />;
    case 'devices': return <DeviceKeys merchantId={merchantId!} lang={lang} kind="loyalty" title={pick(lang, 'Appareils (caisse, borne)', 'Devices (register, kiosk)')}
      hint={pick(lang, 'Une clé par appareil qui consulte ou échange des points (C4ISSE, T4CTILE).', 'One key per device that looks up or redeems points (C4ISSE, T4CTILE).')} canManage={ctx.can('account.devices')} />;
    default: return null;
  }
}

async function Overview({ ctx }: { ctx: PageCtx }) {
  const { lang, merchantId } = ctx;
  const [s, st, ledger] = await Promise.all([getSettings(merchantId!), stats(merchantId!), recentLedger(merchantId!, 30)]);
  const REASON: Record<string, [string, string, 'ok' | 'brand' | 'plain']> = { earn: ['Gagné', 'Earned', 'ok'], redeem: ['Échangé', 'Redeemed', 'brand'], adjust: ['Ajusté', 'Adjusted', 'plain'] };
  return (
    <>
      <div className="grid">
        <Stat label={pick(lang, 'Membres', 'Members')} value={st.members} />
        <Stat label={pick(lang, 'Points en circulation', 'Points outstanding')} value={st.points.toLocaleString(lang === 'en' ? 'en-CA' : 'fr-CA')} note={`${pick(lang, 'valeur', 'worth')} ${money(st.liabilityCents, lang)}`} />
        <Stat label={pick(lang, 'Règle', 'Rule')} value={`${s.pointsPerDollar} pt / $`} note={`1 pt = ${money(s.pointValueCents, lang)} · min ${s.minRedeemPoints}`} />
      </div>
      <Card title={pick(lang, 'Activité récente', 'Recent activity')} icon="log">
        {ledger.length === 0 ? <Empty icon="star">{pick(lang, 'Aucun point gagné ou échangé pour l’instant.', 'No point earned or redeemed yet.')}</Empty> : (
          <div className="table-wrap"><table><thead><tr><th>{pick(lang, 'Client', 'Customer')}</th><th>{pick(lang, 'Quoi', 'What')}</th><th className="right">Points</th><th className="right">{pick(lang, 'Solde', 'Balance')}</th><th>{pick(lang, 'Par', 'By')}</th></tr></thead>
            <tbody>{ledger.map((l, i) => { const [fr, en, tone] = REASON[l.reason] ?? REASON.adjust; return <tr key={i}><td>{maskPhone(l.phone)}</td><td><Badge tone={tone}>{pick(lang, fr, en)}</Badge></td><td className="right">{l.delta > 0 ? `+${l.delta}` : l.delta}</td><td className="right">{l.balanceAfter}</td><td className="muted small">{l.by}</td></tr>; })}</tbody></table></div>
        )}
      </Card>
    </>
  );
}

async function Rules({ ctx }: { ctx: PageCtx }) {
  const { lang, merchantId } = ctx;
  const s = await getSettings(merchantId!);
  if (!ctx.can('loyalty.settings')) return <Card title={pick(lang, 'Règles', 'Rules')} icon="tag"><p className="muted">{`${s.pointsPerDollar} pt / $ · 1 pt = ${money(s.pointValueCents, lang)} · min ${s.minRedeemPoints}`}</p></Card>;
  return (
    <Card title={pick(lang, 'Règles de points', 'Points rules')} icon="tag" sub={pick(lang, 'S’applique aux prochains paiements ; les soldes déjà gagnés ne changent pas.', 'Applies to the next payments; points already earned do not change.')}>
      <ApiForm action="/api/loyalty/settings" method="PUT" fields={[
        { name: 'pointsPerDollar', label: pick(lang, 'Points par dollar', 'Points per dollar'), type: 'number', defaultValue: String(s.pointsPerDollar) },
        { name: 'pointValueCents', label: pick(lang, 'Valeur d’un point (¢)', 'Point value (¢)'), type: 'number', defaultValue: String(s.pointValueCents) },
        { name: 'minRedeemPoints', label: pick(lang, 'Minimum pour échanger', 'Minimum to redeem'), type: 'number', defaultValue: String(s.minRedeemPoints) },
      ]} submit={pick(lang, 'Enregistrer', 'Save')} done={pick(lang, 'Règles enregistrées.', 'Rules saved.')} />
    </Card>
  );
}
