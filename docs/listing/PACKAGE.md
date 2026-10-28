# PACKAGE DE SOUMISSION — TAKATAK Fidélité

> **Mise à jour 2026-10-26** : tarification alignée sur les décisions de Matt — prix unique **50 $ CAD/mois** (facturation Clover) et règle de points par défaut **1 point par dollar**; les anciens paliers proposés « à approuver » (19,95 $ / 39,95 $ / 29,95 $) sont retirés.

**Application :** TAKATAK Fidélité
**Développeur :** TAKATAK (TAKATAK Marketing, Montréal, Québec, Canada)
**Contact soutien :** takatak.ca@gmail.com · +1 450-999-4999
**État du package :** Brouillon local préparé le 2026-10-24 — rien n'est publié ni soumis.
**Documents liés :** `legal/politique-confidentialite.md`, `legal/privacy-policy.md`, `legal/conditions-utilisation.md`, `legal/terms.md`, `video-script.md`

---

## Nom de l'application (fiche marketplace)

**TAKATAK Fidélité**

## Accroche (tagline)

FR : « Vos clients gagnent des points avec leur numéro de téléphone — aucun carte, aucune application à télécharger. »
EN : "Your customers earn points with their phone number — no card, no app to download."

## Description complète

### FR

TAKATAK Fidélité transforme le numéro de téléphone de vos clients en programme de fidélité complet, directement branché sur votre Clover.

**Comment ça fonctionne**
- Le client entre son numéro de téléphone au comptoir ou à la borne libre-service. Son compte fidélité est créé automatiquement à la première utilisation — aucun mot de passe, aucune carte, aucune application mobile à installer.
- À chaque achat, le client accumule des points automatiquement dès que le paiement est confirmé dans Clover.
- Les points s'échangent contre un rabais appliqué directement sur la commande, au comptoir ou à la borne.

**Pour le marchand**
- Règles de points configurables : taux d'accumulation (points par dollar), seuil d'échange et valeur des points.
- Le solde du client est visible en un coup d'œil par le numéro de téléphone.
- Fonctionne avec les clients Clover : le compte fidélité se rattache au profil client du marchand quand il existe.
- Conçu pour les restaurants à service rapide et les comptoirs : parcours complet en quelques secondes, sans ralentir la file.

**Transparence**
- Les données des clients restent celles du marchand : TAKATAK Fidélité ne vend aucune donnée et ne les utilise pas à des fins publicitaires.
- Programme conforme à la Loi 25 du Québec : consentement, accès, rectification et suppression sur demande.

### EN

TAKATAK Fidélité turns your customers' phone numbers into a complete loyalty program, plugged directly into your Clover.

**How it works**
- The customer enters their phone number at the counter or at the self-service kiosk. Their loyalty account is created automatically on first use — no password, no card, no mobile app to install.
- On every purchase, points are credited automatically as soon as the payment is confirmed in Clover.
- Points are redeemed as a discount applied directly to the order, at the counter or at the kiosk.

**For the merchant**
- Configurable points rules: earn rate (points per dollar), redemption threshold and point value.
- Customer balance visible at a glance, by phone number.
- Works with Clover Customers: the loyalty account links to the merchant's customer profile when one exists.
- Built for quick-service restaurants and counters: the full flow takes seconds and never slows the line.

**Transparency**
- Customer data belongs to the merchant: TAKATAK Fidélité never sells data and never uses it for advertising.
- Compliant with Québec's Law 25: consent, access, rectification and deletion on request.

## Catégorie suggérée

**Loyalty / Rewards (Fidélité et récompenses)** — catégorie exacte à confirmer dans la liste du portail (voir « À CONFIRMER AU PORTAIL »).

## Fonctionnalités

- Inscription instantanée par numéro de téléphone (création automatique du compte à la première utilisation)
- Accumulation automatique des points après paiement confirmé
- Échange de points contre un rabais appliqué à la commande (borne ou comptoir)
- Consultation du solde par numéro de téléphone
- Règles configurables par le marchand : taux d'accumulation, seuil d'échange, valeur du point, expiration optionnelle
- Liaison au profil Clover Customers du marchand quand il existe
- Rapports au marchand : membres actifs, points émis, points échangés
- Interface bilingue français / anglais

## Permissions Clover demandées

| Permission | Justification |
|---|---|
| Clients (Customers) — lecture + écriture | Retrouver ou créer le client par son numéro de téléphone, clé du compte fidélité. |
| Commandes (Orders) — lecture | Lire le montant des commandes payées pour calculer les points à créditer. |
| Commandes (Orders) — écriture | Appliquer le rabais d'échange de points directement sur la commande avant le paiement. |
| Paiements (Payments) — lecture | Confirmer que le paiement est complété avant de créditer les points (aucun point sur une commande non payée). |
| Marchand (Merchant) — lecture | Identifier le marchand et ses emplacements pour rattacher les comptes et points au bon commerce. |

Aucune autre permission n'est demandée. L'application n'a pas accès aux numéros de carte : les paiements sont traités par Clover.

## Tarification

> **PRIX DÉCIDÉ PAR MATT (2026-10-25) — aligné le 2026-10-26.** Fidélité Reward fait partie de la suite TAKATAK au prix standard : **50 $ CAD/mois**, facturé via la facturation Clover App Market. (Remplace l'ancienne proposition de paliers 19,95 $ / 39,95 $ / 29,95 $ « à approuver », retirée le 2026-10-26.)

- **50 $ CAD/mois** — prix unique, tous les emplacements du marchand, solde de points partagé entre succursales.
- **Règle de points par défaut : 1 point par dollar** de sous-total (décidée dans la spec de l'application; paramétrable par marchand).

## Soutien

- Courriel : takatak.ca@gmail.com
- Téléphone : +1 450-999-4999
- URL de soutien (placeholder, hébergement à confirmer) : https://takatak.ca/apps/fidelite/soutien
- URL politique de confidentialité (placeholder) : https://takatak.ca/apps/fidelite/confidentialite
- URL conditions d'utilisation (placeholder) : https://takatak.ca/apps/fidelite/conditions

## Instructions de test pour l'équipe de révision Clover

1. Installer l'application sur le marchand sandbox fourni et ouvrir un terminal ou la borne en mode test.
2. Passer une commande test et la payer avec une carte de test Clover.
3. À l'écran fidélité, entrer le numéro de test **514-555-0100** : le compte est créé, les points de la commande sont crédités après le paiement.
4. Passer une deuxième commande avec le même numéro : le solde s'affiche avant le paiement.
5. Choisir « Échanger mes points » : le rabais est appliqué à la commande et le solde diminue du montant échangé.
6. Au tableau de bord du marchand (ou dans Clover Customers), rechercher le numéro 514-555-0100 : le client et son solde de points sont visibles.
7. Numéro de contrôle : 514-555-0199 ne doit avoir aucun compte tant qu'aucune commande payée ne lui est associée.

*(Numéros en 555 : fictifs, réservés aux tests.)*

## Liste de contrôle de soumission

| Élément | État |
|---|---|
| Nom + accroche + description FR/EN | ✅ Prêt (ce document) |
| Liste des permissions + justifications | ✅ Prêt (ce document) |
| Politique de confidentialité FR + EN | ✅ Brouillon prêt (`legal/`) — à approuver par Matt |
| Conditions d'utilisation FR + EN | ✅ Brouillon prêt (`legal/`) — à approuver par Matt |
| Script de vidéo de démonstration | ✅ Prêt (`video-script.md`) |
| Vidéo de démonstration (fichier) | ⏳ À tourner depuis le prototype, puis valider format/durée au portail |
| Icône de l'application | ⏳ À produire — dimensions et format à confirmer au portail |
| Captures d'écran marketplace | ⏳ À capturer du prototype (écrans : inscription, solde, échange) — nombre/format à confirmer au portail |
| URL publique de la politique de confidentialité | ⏳ Brouillon prêt, hébergement à mettre en ligne |
| URL publique des conditions | ⏳ Brouillon prêt, hébergement à mettre en ligne |
| Plan tarifaire | ⏳ PROPOSITION — en attente d'approbation de Matt |
| Marchand sandbox + accès réviseur | ⏳ En attente du compte développeur (voir ci-dessous) |
| Application créée dans le Developer Dashboard | ⏳ En attente de l'accès au portail développeur |

## À CONFIRMER AU PORTAIL

- Liste exacte des catégories disponibles pour une application de fidélité
- Dimensions, format et poids exigés pour l'icône et les captures d'écran
- Exigences de la vidéo de démonstration (obligatoire ou non, format, durée maximale, hébergement)
- Structure exacte des plans tarifaires acceptés (abonnement mensuel, par appareil ou par emplacement) et part de revenus éventuelle de Clover/Fiserv
- Exigences de l'équipe de révision : marchand sandbox dédié, identifiants de test, délais de revue
- Champs obligatoires exacts de la fiche (courriel de soutien, URL de soutien, pays desservis)
- Si l'approbation du programme de fidélité exige des documents supplémentaires (ex. politique de points affichée au client final)

## Points qui relèvent de Matt uniquement

- Approuver les prix du plan tarifaire propre à cette application
- Confirmer les règles de points par défaut (taux, seuil, valeur, expiration)
- Approuver les textes légaux avant publication (idéalement avec un avis juridique)
- Choisir l'hébergement des pages publiques (politique, conditions, soutien)
- Fournir l'accès au compte développeur Clover pour créer l'application et le marchand sandbox
