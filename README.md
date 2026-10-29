# LOY4LTY by TAKATAK

**App ID Clover (production) :** `WX0Y6313JX1TY`
**Développeur :** TAKATAK (compte développeur Clover 9KJ25ATT15TTW)
**État au portail :** brouillon (draft) — rien de soumis.
**Dépôt :** takatakca/LOY4LTY

## Ce que fait l'app

Fidélité par numéro de téléphone : inscription automatique, points crédités après paiement confirmé (défaut : 1 point par dollar), échange en rabais sur la commande. Aucune API de points chez Clover : le registre de points vit chez TAKATAK, clé = téléphone. Jumeau sandbox : Fidélité X41V082SRCG4G.

## Paliers (doctrine de prix de Matt, 2026-10-28)

Chaque app a SES propres paliers. Base = le nécessaire essentiel · Premium = plus d'avantages · VIP = le full kit, tout ce que Clover offre pour la catégorie.

- **Base 50 $/mois** — inscription par téléphone ; accumulation automatique sur paiement confirmé (webhooks) ; solde consultable par téléphone ; échange en rabais appliqué à la commande avant paiement.
- **Premium 100 $/mois** — + saisie du téléphone pendant le paiement à l'appareil et à la borne T4CTILE ; règles avancées (seuil, valeur du point, expiration optionnelle) ; rapports membres/points ; solde partagé entre succursales.
- **VIP 150 $/mois** — full kit : campagnes de points avec M4RKETING ; reconnaissance du même client sur tous les canaux (comptoir, borne, téléphone IA, en ligne) ; paliers de membres ; arrimage REW4RDS.

Prix facturés via les plans d'abonnement du Clover App Market (à créer au portail — voir DEPLOY.md).

## Permissions Clover visées

Customers R/W · Orders R/W · Payments R · Merchant R

## Structure

- `docs/listing/` — fiche marketplace (description FR/EN) et textes légaux, depuis le package de soumission local (`~/workspace/clover-apps/`)
- `app/api/clover/` — points d'entrée webhook + OAuth (scaffold, même patron que Food Hub)
- `lib/clover/config.ts` — configuration par variables d'environnement (aucun secret dans le code)
- `config/app.config.json` — identité de l'app et paliers
- `DEPLOY.md` — ce qui reste à faire, étape par étape, pour la vague portail

## Le système unique TAKATAK

Cette application fait partie de la suite TAKATAK sur Clover : toutes les apps partagent le même dos d'événements (webhooks Clover), le même **client unique reconnu par son numéro de téléphone** (+ courriel), et les mêmes commandes et paiements Clover. Aucune app ne vit en silo : les données qu'elle produit alimentent les autres apps de la suite (voir « Clover API — Main Stuff — Robot Notepad », section 3, déposé au Drive Opérations et dans `~/workspace/clover-apps/`).


## État du code (2026-10-28)

Application Next.js 16 qui fonctionne (tests verts, build OK). Mise en ligne : `DEPLOY.md` § 5.

**Ce qui marche :**
- **Commun (kit Suite TAKATAK, identique dans les 9 apps)** : connexion Clover OAuth v2 (jetons scellés, rafraîchis
  seuls, supprimés à la désinstallation) · webhook Clover (vérification, X-Clover-Auth, chaque événement une fois) ·
  base PostgreSQL (ou mémoire en dev) · session marchand · paliers Base / Premium / VIP lus depuis la facturation
  Clover (`OWN_MERCHANTS` = VIP) · marchand `RNVTBYMCKXEJ1` en lecture seule · lien Suite TAKATAK avec Food Hub ·
  page d'accueil FR/EN, tableau de bord `/app`, pages légales `/legal/*`, `/api/health`, `/api/cron`, clés d'appareils.
- Registre de points par téléphone (E.164) ; inscription automatique depuis le client Clover de la commande
- Points crédités une seule fois par paiement Clover confirmé (webhook P), sur le montant avant taxes, pourboire exclu
- Échange : rabais posé sur la commande Clover avant paiement, une fois par commande
- Règles (points par $, valeur du point, minimum) en Premium ; événements Suite `loy4lty.points_awarded` / `points_redeemed`

**Ce qui reste :**
- Retrait des points sur remboursement ; saisie du téléphone pendant le paiement à l'appareil / la borne (Android).

**Développer :** `npm install` · `npm run dev` · `npm run typecheck` · `npm test` · `npm run build`. Règles pour
les agents : `AGENTS.md` ; journal : `WORKLOG.md`.
