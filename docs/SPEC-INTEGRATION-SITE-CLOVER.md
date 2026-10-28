# SPEC D'INTÉGRATION — Site maison ↔ Clover ↔ Fidélité Reward

**Modèle décidé par Matt (2026-10-26) : « menu maison rapide + checkout Clover final + client unique Fidélité ».**

- Les sites de marque tiennent **leur propre copie du menu** (données du catalogue maître), servie par notre infrastructure : chargement rapide, aucune dépendance aux pages de commande en ligne de Clover, jugées lentes et parfois non fonctionnelles.
- Clover n'intervient **qu'à la fin du parcours** : création de la commande avec les **vrais IDs d'items Clover**, paiement final par le checkout Clover, confirmations par webhooks.
- Client **unique** : une seule inscription (clé = numéro de téléphone) reconnue sur le site **et** dans Clover. Fidélité, historique de commandes et QR vivent sur ce socle.

**Base factuelle** : audit de la plateforme développeur Clover du 2026-10-26 (`~/workspace/research_notes/clover-dev-plateforme-audit-pos-20261026-0203/report.md`). Chaque affirmation technique ci-dessous renvoie à un fait vérifié de cet audit (section citée entre crochets). Ce qui n'est pas vérifié est marqué **À PROUVER EN SANDBOX**.

**Application liée** : Fidélité Reward (package `~/workspace/clover-apps/loyalty/PACKAGE.md`) — ses permissions déjà demandées couvrent cette spec : Customers lecture+écriture, Orders lecture+écriture, Payments lecture, Merchant lecture. **Le rôle de l'app Clover ne change pas** : surface en magasin (solde, échange, rattachement du membre) + point d'installation OAuth du marchand. Toute la logique site vit dans le backend maison (le « hub »).

**Fondations plateforme (audit §9)** — non négociables :
- OAuth **v2 + PKCE obligatoire** au Canada (depuis le 2025-03-31), jetons à expiration avec **rotation des refresh tokens** implémentée dès le jour 1, coffre de jetons central dans le backend.
- L'app sandbox doit être **recréée en production** (les permissions ne se transportent pas) ; les permissions se re-règlent en production.
- Les **webhooks ne livrent que des identifiants** (type d'événement + ID d'objet + marchand), jamais l'objet complet : toujours aller chercher l'objet via l'API REST après l'événement. Les webhooks d'inventaire font l'objet d'un changement annoncé (2026) : le consommateur de webhooks passe par une **couche d'adaptation** isolée du reste du code.

---

## 1. Menu miroir

### 1.1 Source de vérité : Clover pour les prix, le site pour le contenu

Selon la loi de prix de Matt, **Clover est le maître des prix** (prix de base identique partout ; ramassage = base +15 % ; livraison = base +20 % — le modèle universel, appliqué par règle au calcul, jamais stocké comme deuxième prix). Le site tient une copie du menu pour l'**affichage rapide**, jamais comme autorité de prix au moment de payer.

Chaque item du menu site stocke obligatoirement :
- `clover_item_id` — l'ID Clover réel de l'item (la commande finale est construite avec ces IDs, jamais avec des items ad hoc) ;
- le **mapping des groupes de modificateurs** : pour chaque groupe site, le `modifier_group_id` Clover et, par option, le `modifier_id` Clover (les groupes Clover portent `minRequired` / `maxAllowed` — audit §2 ; les règles site doivent rester alignées sur ces bornes) ;
- les taux de taxes Clover rattachés à l'item (voir §6) ;
- le contenu riche **propre au site** : noms FR/EN, descriptions, allergènes — Clover ne porte pas ce contenu dans notre modèle.

### 1.2 Photos : CDN du site, jamais Clover

**Fait contraignant (audit §2)** : l'API Inventory de Clover **n'expose aucun champ d'image d'item**. Les photos sont donc hébergées sur le **CDN du site**, indexées par `clover_item_id`. Le menu site n'appelle jamais Clover pour afficher une image ; Clover ne reçoit jamais d'image de notre part. (C'est aussi le pattern que les constructeurs de bornes Clover utilisent : images dans leur propre portail, clé = ID d'item.)

### 1.3 Synchronisation du miroir

Trois mécanismes, dans cet ordre de confiance :

1. **Webhooks Inventory** (création / modification d'item, de groupe, de modificateur) → le hub va chercher l'objet modifié via l'API et met à jour le miroir (prix, nom Clover, structure des groupes, disponibilité).
2. **Re-synchronisation complète nocturne** : lecture intégrale de l'Inventory du marchand, comparaison champ par champ avec le miroir, correction silencieuse des écarts de structure.
3. **Rapport de dérive (drift report)** quotidien, visible par le marchand : items Clover sans équivalent site, items site orphelins (ID Clover disparu), écarts de prix détectés, groupes de modificateurs désalignés. Aucune dérive de prix ne se corrige « en silence » sans trace.

**Modificateurs comptés — limite connue (audit §2)** : Clover ne supporte pas les stocks comptés sur les modificateurs (seul un booléen `available`). Si un suivi de compte est requis, le hub décrémente dans **sa** base sur les événements de commande et bascule `available` à zéro via l'API. Consistance éventuelle assumée, jamais transactionnelle.

### 1.4 Écart de prix au checkout — règle dure

Le prix affiché dans le panier site est un prix **d'affichage**. Avant tout paiement :
- le backend **recalcule le total côté serveur à partir des données Clover fraîches** (prix d'items et de modificateurs relus via l'API, taux de taxes Clover, règle de canal +15 % / +20 % appliquée sur la base Clover) ;
- si le total recalculé diffère du total affiché au panier, le client voit le **total corrigé avant de payer** — on ne débite **jamais** un montant différent de celui confirmé à l'écran, et on ne débite **jamais** un prix site périmé ;
- l'écart est journalisé et alimente le rapport de dérive (§1.3).

---

## 2. Parcours d'achat

Le parcours est conçu pour qu'**aucun appel Clover n'ait lieu avant le checkout** : navigation, recherche, panier, inscription et fidélité (consultation) sont 100 % site/hub. Un seul aller-retour serveur vers Clover au moment de commander.

| Étape | Ce qui se passe |
|---|---|
| 1. Navigation + panier | 100 % site. Aucun appel Clover. Le panier référence les `clover_item_id` et `modifier_id` du miroir. |
| 2. Identification (optionnelle mais encouragée) | Le client se connecte à son compte site (téléphone + code SMS, voir §3). Le panier est rattaché à son `customer_id` Clover. |
| 3. Création de la commande Clover | Le backend crée la commande via l'**API Orders** avec les vrais IDs d'items et de modificateurs, le **type de commande** du marchand (ramassage / livraison / sur place — les types sont propres au marchand, audit §3), le client attaché (voir §3.2), et tout rabais d'échange de points déjà appliqué (§3.4). La création **atomique** (un seul appel : lignes, modificateurs, rabais, frais de service) est le mode par défaut — les totaux et taxes sont calculés en temps réel par Clover (audit §3). **Commandes en LIVRAISON en ligne seulement** : le hub ajoute la ligne **« Frais de service en ligne » de 3,50 $ CAD** (décision permanente de Matt ; jamais sur le ramassage — voir l'encadré sous ce tableau). |
| 4. Recalcul + garde-fou prix | Voir §1.4 : le total retourné par Clover est comparé au total serveur recalculé ; incohérence = arrêt avant paiement, jamais de débit sur un montant non confirmé. |
| 5. Paiement | Session de paiement **Clover Ecommerce / Hosted Checkout** (iframe hébergée Clover, `locale: 'fr-CA'` supportée — audit §10). Le paiement « pour une commande » débite le total de la commande, pourboire inclus si le client en ajoute (audit §4). **Aucune donnée de carte ne touche nos serveurs** (PCI : la page de paiement Ecommerce est soumise aux exigences PCI DSS v4.0 — audit §11). **3-D Secure 2 OBLIGATOIRE** (exigence de Matt, §6) : le titulaire authentifie auprès de sa propre banque (application bancaire / biométrie) pendant le paiement — aucune transaction en ligne ne doit être traitée sans tenter l'authentification 3DS quand l'émetteur la propose. **Provenance du 3DS (décision de Matt, 2026-10-26)** : on ne construit **pas** notre propre flux 3DS — le marchand active l'**option 3D Secure offerte dans les paramètres de son compte Clover** (fournisseur tiers qui effectue la vérification) et notre checkout utilise cette option. |
| 6. Confirmation | Les webhooks **paiement** et **commande** arrivent (IDs seulement). Le backend va chercher la commande et le paiement via l'API ; seulement à ce moment la commande site passe à **« payée »**. Aucune confirmation n'est affichée au client avant cette vérification (voir §5). |
| 7. Cuisine | La commande existe dans Clover comme toute commande de caisse : elle suit le routage normal du marchand (groupes d'impression / KDS alimenté indirectement par des commandes bien formées — il n'existe **pas d'API KDS**, audit §3). Le hub peut déclencher l'impression via `print_event` selon la configuration du marchand. |
| 8. Statuts côté client | Le compte site du client affiche les statuts : **reçue → en préparation → prête / en livraison → livrée**. Transitions de préparation : état machine du hub (Clover n'offre ni API de « firing » ni de throttling — audit §3) ; statuts de livraison alignés sur le module **livraison maison de Food Hub** (assignation chauffeur, en route, livrée) pour les commandes des canaux propres. |
| 9. Points | Le webhook de commande payée alimente le registre de points (§3.3). |

**Encadré — Frais de service en ligne de 3,50 $ (décision permanente de Matt, 2026-10-26)**
- Une ligne **« Frais de service en ligne » de 3,50 $ CAD** s'ajoute au total des commandes en **livraison passées en ligne**, et **seulement** celles-là. **Jamais sur le ramassage** (sauf si Matt le décide un jour explicitement).
- Le frais est **visible dans le détail du total avant le paiement** — jamais caché, jamais ajouté après coup. Le total confirmé à l'écran (§1.4) inclut le frais.
- **Mécanique Clover (audit §3)** : les applications peuvent appliquer les frais de service **configurés par le marchand**, mais ne peuvent pas les créer ; le système de frais multiples (MSC) ne supporte pas les frais à montant fixe ni les frais taxables. Donc : si le marchand a configuré ce frais dans Clover, le hub l'applique via l'API ; sinon, le hub le porte comme **ligne ad hoc** de la commande atomique (les commandes atomiques acceptent des lignes hors inventaire — audit §3). Le reçu client montre la même ligne, au même libellé.
- **Traitement fiscal — DÉCIDÉ par Matt (2026-10-26, 02:20)** : ce frais **est taxable**. Matt : « Il faut charger la TPS la TVQ parce qu'on la déclare — l'argent c'est tout déclaré. » Les **TPS 5 % + TVQ 9,975 %** se chargent donc **sur le frais** : le 3,50 $ est le montant **pré-taxe**, les taxes se calculent dessus, en **deux taux distincts sur la base pré-taxe** (la TVQ ne compose pas sur la TPS — même obligation de preuve en sandbox que le reste des taxes, §6). Aucune question ouverte sur ce point : l'entreprise déclare tout, le frais suit le même régime que les autres montants facturés au client. Conséquence mécanique : si le frais configuré par le marchand ne peut pas porter les taxes (limite MSC ci-dessus), la voie **ligne ad hoc avec ses taux de taxes rattachés** devient la voie par défaut pour ce frais.

---

## 3. Client unique + fidélité

### 3.1 Inscription : une seule, clé = téléphone

- Inscription sur le site : numéro de téléphone + code de vérification SMS. Pas de mot de passe obligatoire côté fidélité (conforme au modèle du package Fidélité Reward : « aucun mot de passe, aucune carte, aucune application »).
- À l'inscription (ou à la première commande identifiée), le hub **crée ou met à jour le client dans Clover** via l'**API Customers** (lecture+écriture, déjà dans les permissions de l'app). Le numéro de téléphone est la clé de correspondance dans les deux systèmes ; l'`customer_id` Clover est stocké dans le compte site.
- Consentement et droits : Loi 25 (consentement, accès, rectification, suppression) — repris du package Fidélité Reward.

### 3.2 Rattachement à la commande

Chaque commande site créée via l'API Orders porte le client Clover attaché dès la création. En magasin, le même client est rattaché par le numéro de téléphone (caisse / borne) ou par le QR membre (§4.1). **Un seul historique, un seul solde, tous canaux.**

### 3.3 Registre de points : maison, alimenté par webhooks

**Fait contraignant (audit §8)** : Clover n'a **aucune API de points** — les soldes natifs Promos/Rewards ne sont pas lisibles par API. Le registre de points est donc **maison** (base du hub), clé = téléphone, exactement comme le définit le package Fidélité Reward.

Alimentation : **webhook de commande → fetch de la commande complète via l'API Orders → vérification du paiement (API Payments, lecture) → crédit des points**. Tous les canaux alimentent le même registre, parce que tous aboutissent à une commande Clover :
- **site** (cette spec),
- **caisse / POS** (commandes créées en magasin),
- **borne libre-service**,
- **Phone AI / Food Hub** (les commandes téléphoniques et agrégées sont écrites comme commandes Clover via le hub — audit §6/§7).

Règle par défaut : **1 point par dollar** (paramétrable par marchand — package Fidélité Reward). Aucun point n'est crédité sur une commande non payée (vérification du paiement avant crédit, toujours).

### 3.4 Échange de points = rabais sur la commande

L'échange se fait **avant le paiement**, comme un rabais appliqué à la commande via l'**API Orders (écriture)** — c'est littéralement le cas d'usage que la documentation des permissions Clover donne pour Orders en écriture (audit §8). Sur le site : le client choisit d'échanger dans son panier, le hub applique le rabais à la commande Clover créée à l'étape 3 (§2), le solde est débité au moment de la confirmation de paiement (§2, étape 6) — jamais avant.

### 3.5 Historique de commandes

Le site **miroite les commandes par `customer_id`** : commandes site (connues du hub dès la création) **+** commandes en magasin récupérées de Clover par client (API Orders filtrée par client, rafraîchies par les webhooks de commande). Le client voit donc sur le site l'ensemble de son historique, en ligne et en succursale. Le miroir conserve : ID de commande Clover, canal, date, lignes, totaux, statut — les montants affichés sont ceux de Clover, pas un recalcul site.

---

## 4. Flux QR

### 4.1 QR membre (rattachement avant paiement)

- Chaque compte site affiche un **QR membre** dans son compte, ajoutable à un **wallet pass** (Apple/Google Wallet).
- Contenu du QR : **un jeton membre opaque** — identifiant aléatoire non devinable (≥ 128 bits d'entropie), résolu côté serveur vers le compte. **Aucune donnée personnelle dans le QR** : ni nom, ni téléphone, ni solde. Le jeton est révocable et régénérable depuis le compte (perte de téléphone = révocation, zéro impact sur le solde).
- À la caisse ou à la borne, l'employé (ou la borne) scanne le QR → l'app Fidélité Reward résout le jeton via le hub → le client Clover est attaché à la commande en cours **avant le paiement** → points automatiques, solde visible, échange possible sans dicter son numéro.

### 4.2 QR sur le reçu (réclamation après un paiement anonyme)

- Le reçu d'une commande payée comptant **sans identification** porte un QR de réclamation imprimé par le marchand (configuration de reçu Clover / surface du hub selon le canal).
- Contenu du QR : **un jeton de réclamation à usage unique**, lié à l'ID de la commande, à durée de vie limitée. Aucune donnée personnelle.
- Le client scanne → page site : s'il a un compte, les points de cette commande sont crédités à son registre ; sinon, **inscription en un geste** (téléphone + code SMS, §3.1) puis crédit immédiat. Jeton consommé = non réutilisable (anti-fraude : une commande = une réclamation).
- C'est le mécanisme de conversion des clients comptant anonymes en membres — même principe que les codes d'inscription sur reçus du natif Clover Rewards (audit §8), mais branché sur **notre** registre.

---

## 5. Performance et honnêteté des pannes

### 5.1 Pourquoi ce modèle règle le problème de chargement

La plainte de Matt vise les pages de commande en ligne de Clover (lentes, parfois non chargées). Dans ce modèle :
- **menu, recherche, panier, compte, solde de points : zéro appel Clover** — tout est servi par notre infrastructure (site + CDN photos + hub) ;
- **un seul aller-retour serveur vers Clover** au checkout (création de commande + session de paiement), côté serveur, invisible pour le client sauf l'écran de paiement hébergé ;
- le temps de chargement perçu est donc **le nôtre**, maîtrisable (cache, CDN, pages légères), pas celui de la vitrine Clover.

### 5.2 Si Clover est en panne au moment de payer

**Fait contraignant (audit §4/§10)** : au Canada, Clover **ne supporte aucun paiement hors ligne** — il n'existe pas de mode dégradé « payer plus tard » côté cartes. Le modèle assume donc :

| Surface | État si Clover ne répond pas au checkout |
|---|---|
| Navigation, menu, panier, compte, solde | **Inchangés** — tout continue de fonctionner (aucune dépendance Clover). |
| Création de commande / paiement | La commande site reste à l'état **« en attente de paiement »** — jamais « payée », jamais envoyée en cuisine. Message clair au client (« le paiement est temporairement indisponible, votre panier est conservé »), **bouton Réessayer**, panier et intention de commande conservés côté hub pour reprise sans tout recommencer. |
| Confirmations | **Aucune fausse confirmation** : un statut « payé » exige la chaîne complète webhook + fetch de la commande + paiement vérifié (§2, étape 6). Un timeout n'est jamais interprété comme un succès ni comme un échec définitif — l'état reste « en attente » jusqu'à preuve. |
| Réconciliation | File de reprise automatique (nouvelles tentatives avec backoff) + balayage périodique des commandes « en attente » contre l'API Clover ; toute commande payée chez Clover mais non confirmée chez nous est rattrapée, jamais perdue, jamais doublée (idempotence sur l'ID de commande Clover). |
| En magasin pendant la panne | Le comptoir bascule sur sa procédure espèces (tender natif Clover) ; les points des commandes espèces identifiées se créditent au retour des webhooks, et les non-identifiées restent réclamables par le QR reçu (§4.2). |

---

## 6. Canada / Québec

- **3-D Secure 2 (3DS2) OBLIGATOIRE sur le checkout en ligne** (exigence de Matt, 2026-10-26 : « le plus sécuritaire possible pour le client »). Le titulaire de la carte s'authentifie auprès de **sa propre banque** au moment du paiement (application bancaire, biométrie ou code de la banque) ; pour les transactions authentifiées, la **responsabilité en cas de fraude se déplace vers l'émetteur de la carte** plutôt que vers le marchand. **Source du 3DS — décision de Matt (2026-10-26, 02:20)** : l'intégration **ne construit pas son propre flux 3D Secure**. Matt indique que, dans les paramètres de son compte Clover, on peut s'abonner à une compagnie qui effectue la vérification 3D Secure et activer l'option — ce qu'il estime moins coûteux qu'un développement maison. Le marchand **active donc l'option 3D Secure offerte dans son compte Clover** (fournisseur tiers) et le checkout l'utilise telle quelle. (Présence de l'option dans les paramètres du compte : rapportée par Matt ; sa vérification au portail se fera au moment de l'activation — un geste de compte ultérieur, hors du développement de cette intégration.) Ancrage audit (§11) : 3D Secure est **intégré aux paiements sans présence de carte** chez Clover (2025). **À VALIDER EN SANDBOX** : vérifier que l'option activée au compte **déclenche effectivement le défi et l'authentification 3DS** dans le flux Hosted Checkout / Ecommerce du compte marchand canadien, et documenter le comportement de repli si la banque du client ne supporte pas 3DS2 — on ne lance pas le checkout sans cette preuve.
- **Paiement en ligne = cartes via le checkout hébergé Clover** (Ecommerce). **Interac en ligne n'est pas promis** : Interac est un moyen **en personne, au terminal** (audit §4/§10). Restrictions Interac vérifiées à concevoir autour : pas d'auth / pré-autorisation, pas d'ajustement de pourboire après autorisation (pourboire avant autorisation), pas de conservation de carte (vault), remboursements avec carte insérée, CAD seulement, aucun paiement hors ligne au Canada.
- **Taxes : TPS 5 % + TVQ 9,975 %, deux taux distincts appliqués sur la base pré-taxe** (total combiné 14,975 %, la TVQ ne se calcule **pas** sur la TPS). Configuration : deux taux Clover rattachés aux items taxables ; l'API Ecommerce accepte taux par UUID / pourcentage / montant (audit §10). **À PROUVER EN SANDBOX avant tout lancement** : commandes tests au cent près démontrant (a) la non-composition TVQ-sur-TPS dans le calcul Clover sur une commande créée par l'API Orders **et** payée par le checkout hébergé, et (b) le reçu ventile TPS et TVQ séparément avec les numéros d'enregistrement TPS/TVQ du marchand. Si un seul de ces tests échoue : le hub calcule les taxes et transmet les montants explicites, et le reçu conforme sort de notre côté — **on ne lance pas au Québec sur un chemin de taxe non vérifié**.
- **fr-CA partout où c'est nous** : sites, hub, courriels/SMS, et l'iframe de paiement hébergée réglée à `locale: 'fr-CA'` (supportée — audit §10). Les noms d'items FR vivent dans le miroir (§1.1) — c'est aussi notre couche de traduction. Le fr-CA des interfaces natives Clover (Register/KDS) n'est **pas certifié** par la documentation (audit §10) : à tester sur le matériel canadien du marchand, hors périmètre de cette spec mais à ne pas promettre au client final.

---

## 7. Répartition de construction

| Composant | Qui le construit | Contenu |
|---|---|---|
| Sites de marque + panier | Claude Code, dans le système **foodhubca** | Front des sites, menu miroir consommé depuis le hub, panier 100 % local, compte client, QR membre + wallet pass, pages de statuts. Aucun appel direct à Clover depuis le navigateur (sauf l'iframe de paiement hébergée). |
| **Hub** (backend maison) | Claude Code, service du projet **Fidélité Reward** | Service commandes / clients / points : sync Inventory + miroir + rapport de dérive, création de commandes, sessions de paiement, consommation des webhooks (via adaptateur), registre de points, historique par client, jetons QR (membre + réclamation), file de reprise et réconciliation. Base : Node.js/TypeScript + PostgreSQL (patron du Projet 1 du pack Claude Code). |
| App **Fidélité Reward** (Clover) | Claude Code, projet existant — **rôle inchangé** | Surface en magasin : consultation du solde par téléphone, rattachement du client (téléphone ou scan du QR membre), application d'un échange sur la commande avant paiement, OAuth du marchand. Aucune logique de menu ni de checkout site dans l'app. |
| Food Hub | Projet existant | Les commandes des canaux agrégés et du téléphone entrent par le hub : elles deviennent des commandes Clover, donc alimentent points et historique comme les autres (§3.3, §3.5). Statuts de livraison maison réutilisés au §2, étape 8. |

### Appels API par étape (direction : → vers Clover, ← depuis Clover)

| Étape | API Clover | Direction | Détail |
|---|---|---|---|
| Installation marchand | OAuth v2 + PKCE | → | Autorisation, jetons à expiration, rotation des refresh tokens (hub). |
| Sync menu (webhook) | Webhooks Inventory → Inventory API (GET item / groupe / modificateur) | ← puis → | L'événement ne donne que l'ID ; le hub va chercher l'objet. |
| Sync menu (nuit) | Inventory API (liste complète) | → | Re-sync intégrale + rapport de dérive. |
| Photos | — (CDN du site) | — | Aucune API d'image chez Clover ; clé = `clover_item_id`. |
| Inscription client | Customers API (recherche par téléphone, création / mise à jour) | → | Clé = téléphone ; `customer_id` Clover stocké au compte site. |
| Création de commande | Orders API (création atomique : lignes, modificateurs, rabais, type de commande, client attaché) | → | Vrais IDs d'items ; rabais d'échange déjà appliqué ; **livraison en ligne : ligne « Frais de service en ligne » 3,50 $** (frais marchand configuré appliqué via l'API, sinon ligne ad hoc — **taxable : TPS 5 % + TVQ 9,975 % chargées sur le frais, décision de Matt 2026-10-26**). |
| Paiement | Ecommerce API / Hosted Checkout (session + paiement pour la commande) | → | Iframe hébergée, `locale: 'fr-CA'` ; **3-D Secure 2 obligatoire — via l'option 3D Secure activée au compte Clover par le marchand (fournisseur tiers, décision de Matt 2026-10-26), jamais un flux 3DS maison** ; vérification en sandbox que l'option déclenche bien l'authentification dans le flux ; aucune donnée de carte chez nous. |
| Recalcul prix | Inventory API (prix frais) + total retourné par la création | → | Comparaison avant paiement (§1.4). |
| Échange de points | Orders API (rabais sur la commande) | → | Avant paiement ; débit du solde à la confirmation seulement. |
| Confirmation | Webhooks commande + paiement → Orders API (GET commande) + Payments API (GET paiement) | ← puis → | Statut « payée » seulement après vérification complète. |
| Cuisine | Orders (print_event) / routage natif du marchand | → | KDS alimenté par la commande bien formée ; pas d'API KDS. |
| Points (tous canaux) | Webhooks commande → Orders API (GET) + Payments API (vérification) | ← puis → | Crédit au registre maison, clé = téléphone. |
| Historique client | Orders API (commandes par client) | → | Miroir site : en ligne + en magasin. |
| QR membre | Customers API (résolution du client après résolution du jeton par le hub) | → | Jeton opaque, aucune donnée personnelle dans le QR. |
| QR reçu / réclamation | Orders API (GET commande du jeton) + Payments API (vérification) | → | Jeton à usage unique lié à la commande. |

---

## 8. Décisions de design à remarquer (résumé pour le lecteur pressé)

1. **Le site ne paie jamais sur ses propres prix** : l'affichage est maison, mais le montant débité est toujours recalculé côté serveur à partir de Clover (§1.4) — vitesse du site, vérité de Clover.
2. **Les points ne vivent pas dans Clover** (aucune API de points — audit §8) : registre maison clé = téléphone, nourri par les webhooks de **toutes** les commandes Clover, échange = rabais Orders avant paiement.
3. **Aucune confirmation sans preuve** : « payé » exige webhook + fetch + paiement vérifié ; si Clover tombe au checkout, le client garde son panier et un bouton Réessayer — jamais un faux succès (§5.2), parce qu'au Canada il n'existe pas de paiement Clover hors ligne pour rattraper le coup.
4. **Sécurité et frais assumés au grand jour** (ajouts de Matt, 2026-10-26) : checkout en ligne sous **3-D Secure 2 obligatoire** (authentification par la banque du client, responsabilité de fraude vers l'émetteur) — fourni par **l'option 3D Secure activée au compte Clover** (fournisseur tiers, décision de Matt 2026-10-26), pas par un développement maison ; **« Frais de service en ligne » de 3,50 $** sur la livraison en ligne seulement, toujours visible avant paiement — et **taxable : TPS 5 % + TVQ 9,975 % chargées sur le frais** (décision de Matt, 2026-10-26 : tout est déclaré).

*Spec rédigée le 2026-10-26, amendée le 2026-10-26 (décisions de Matt, 02:20). Faits Clover : audit plateforme du 2026-10-26 (voir en-tête). Points À PROUVER EN SANDBOX : non-composition TPS/TVQ sur le chemin Orders + checkout hébergé — **incluant les taxes chargées sur le « Frais de service en ligne » de 3,50 $ (taxable, décision de Matt 2026-10-26)** —, ventilation TPS/TVQ + numéros d'enregistrement sur le reçu (§6), et vérification que l'option 3D Secure activée au compte Clover déclenche bien l'authentification dans le flux Hosted Checkout du compte canadien (§6). Aucun point fiscal en attente du comptable : le traitement du frais de service est décidé (§2).*
