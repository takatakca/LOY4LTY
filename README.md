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

