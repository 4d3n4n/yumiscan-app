# Architecture Technique YumiScan

## Vue d'ensemble

YumiScan est une web app mobile-first dediee aux voyageurs au Japon. Le produit prend une photo d'etiquette alimentaire japonaise, l'analyse via OCR + IA, puis rend un verdict exploitable sur la compatibilite du produit selon les allergenes choisis par l'utilisateur.

L'architecture separe clairement:

- un front Nuxt 3
- une base et une auth Supabase
- des Edge Functions pour la logique metier sensible
- des services externes pour OCR, IA, paiement et monitoring

## Couches principales

### Frontend

Le frontend est construit avec:

- Nuxt 3
- Vue 3
- Tailwind
- `@nuxtjs/i18n`
- `@tanstack/vue-query`
- `@vite-pwa/nuxt`

Responsabilites:

- parcours public et acquisition
- auth et onboarding
- scan mobile-first
- detail scan progressif
- compte utilisateur et credits
- back-office admin

### Backend Supabase

Supabase fournit:

- Auth
- Postgres
- Storage
- Edge Functions

Responsabilites:

- comptes et sessions
- tables metier
- RPC SQL pour scans / credits / admin
- stockage des images de scan
- execution de la logique metier serveur

### Services externes

- Google Cloud Vision: OCR
- Gemini: phases IA du scan
- Stripe: checkout et paiements
- Sentry: capture d'erreurs
- Discord: alerting operationnel

## Cartographie du code

### Front

- `pages/`: routes
- `components/`: composants UI et metier
- `composables/`: acces donnees, auth, credits, invalidation metier
- `plugins/`: bootstrapping client, Vue Query, transitions, auth recovery
- `utils/`: helpers purs

### Backend

- `supabase/functions/`: fonctions Deno
- `supabase/functions/_shared/`: auth, admin, sentry, cors, stripe, credits
- `supabase/migrations/`: schema de reference et migrations incrementales
- `types/supabase.ts`: types regeneres depuis la base

### Qualite

- `tests/`: suites Vitest par domaine

## Segments fonctionnels du front

### Front public

Routes typiques:

- `/home`
- `/blog`
- pages legales
- `/login`
- `/signup`

Responsabilites:

- presentation produit
- conversion
- onboarding

### App connectee

Routes typiques:

- `/app/dashboard`
- `/app/scan/:id`
- `/app/account`

Responsabilites:

- lancer un scan
- suivre un scan progressif
- consulter l'historique
- gerer le profil et les credits

### Admin

Routes typiques:

- `/app/admin`
- `/app/admin/users`
- `/app/admin/settings`

Responsabilites:

- KPI
- gestion offres et config
- consultation utilisateur / scans

## Flux de donnees cote front

Le front s'appuie principalement sur:

- Supabase client
- Edge Functions
- Vue Query

Depuis la 1.4:

- le shell public est servi avec un runtime cache borne
- certaines queries sont persistees via IndexedDB
- les snapshots persistés excluent les donnees sensibles ou instables
- les snapshots utilisateur sont lies au `userId` courant avant rehydratation
- les invalidations sont metier, pas globales

Fichiers importants:

- [plugins/vue-query.ts](/Users/adenankhachnane/Downloads/projet-full-stack/main/plugins/vue-query.ts)
- [utils/query-cache.ts](/Users/adenankhachnane/Downloads/projet-full-stack/main/utils/query-cache.ts)
- [composables/useAppDataInvalidation.ts](/Users/adenankhachnane/Downloads/projet-full-stack/main/composables/useAppDataInvalidation.ts)
- [nuxt.config.ts](/Users/adenankhachnane/Downloads/projet-full-stack/main/nuxt.config.ts)

## Tables metier a connaitre

### `user_profiles`

Contient notamment:

- infos profil
- `is_admin`
- `free_scans_used`
- `paid_scans_used`
- `daily_credit_used_at`

### `scans`

Table coeur du produit:

- proprietaire
- `processing_status`
- `processing_error`
- `result_json`
- `debug_json`
- `credit_consumed_type`
- `image_storage_path`

### `user_purchases`

Ledger d'achats:

- `stripe_session_id`
- `credits_added`
- `amount_cents`

Le solde payant derive de cette table, pas d'une colonne balance dans `user_profiles`.

### `pricing_offers`

Source de verite commerciale:

- code offre
- nombre de credits
- prix
- `stripe_price_id_full`
- `stripe_price_id_discount`
- `active`

### `allergens`

Catalogue localise:

- `name`, `name_en`
- `ingredients`, `ingredients_en`

### `app_config`

Configuration globale:

- flags
- couts theoriques
- entreprise
- `scan_debug_enabled`

## Edge Functions critiques

### `food-scan-analyze`

Pipeline scan principal:

- auth et verification credits
- validation image
- OCR / IA
- creation immediate d'un scan `processing`
- traitement background
- finalisation transactionnelle

### `stripe-checkout`

- cree une session Stripe a partir de `pricing_offers`

### `stripe-webhook`

- chemin nominal de confirmation paiement
- resolut l'offre payee
- ecrit dans `user_purchases`
- reste idempotent par `stripe_session_id`

### `stripe-finalize-checkout`

- rattrapage serveur au retour Stripe
- utile si le webhook n'est pas encore passe ou a du retard

### `entitlements`

- resume des droits d'acces et credits

### `admin-*`

- KPI
- users
- scans
- config
- pricing

## Pipeline scan

La pipeline scan detaillee est documentee dans:

- [pipeline-scan-yumiscan.md](/Users/adenankhachnane/Downloads/projet-full-stack/main/pipeline-scan-yumiscan.md)

Vue courte:

1. gatekeeper + draft OCR
2. correction OCR
3. reparation structurelle si necessaire
4. nettoyage avant parsing
5. parsing en arbre
6. flatten
7. batchs progressifs
8. traduction
9. mapping deterministe allergenes
10. classification IA
11. reconstruction finale
12. finalisation atomique du credit

## Credits et monétisation

Logique actuelle:

- l'utilisateur peut consommer un scan `free`, `daily` ou `paid`
- les credits payants ne sont jamais derives du front
- le serveur calcule le droit de scanner a partir du ledger `user_purchases`
- la consommation du credit intervient a la fin via RPC atomique

Points clefs:

- pas de consommation prematuree
- pas de dependance a une balance front mutable
- cohérence entre `pricing_offers` et `user_purchases.credits_added`

## Auth et comptes

Flux retenus:

- signup public via `supabase.auth.signUp()`
- recovery et email change via routes auth dediees
- session persistante cote client
- cleanup one-shot des vieux service workers pour eviter de casser `/auth/confirm`

Le endpoint `auth-signup` existe encore uniquement comme endpoint deprecie qui renvoie `410`, pour eviter qu'un ancien client ne continue a l'utiliser silencieusement.

## Observabilite

Monitoring actuel:

- Sentry pour les erreurs front et back
- webhook Sentry vers Edge Function
- creation / mise a jour de threads Discord
- gating prod-only par defaut

Docs:

- [sentry-discord/README.md](/Users/adenankhachnane/Downloads/projet-full-stack/main/docs/sentry-discord/README.md)

## Securite

Principes importants:

- auth revalidee cote fonction
- admin reserve a `is_admin`
- tables internes Sentry/Discord avec RLS deny-all pour les clients
- `result_json` scan front-safe
- `debug_json` seulement si active cote BO
- cache persiste nettoye des donnees sensibles
- headers web de securite versionnes

Reference:

- [security/README.md](/Users/adenankhachnane/Downloads/projet-full-stack/main/docs/security/README.md)

## Tests

Les tests couvrent notamment:

- i18n
- scan progressif
- credits et ledger
- Stripe
- admin
- securite
- cache PWA / Vue Query

Reference:

- [testing/TESTS-UNITAIRES.md](/Users/adenankhachnane/Downloads/projet-full-stack/main/docs/testing/TESTS-UNITAIRES.md)

## Fichiers a lire en priorite pour comprendre le code

1. [README.md](/Users/adenankhachnane/Downloads/projet-full-stack/main/README.md)
2. [docs/ARCHITECTURE-TECHNIQUE.md](/Users/adenankhachnane/Downloads/projet-full-stack/main/docs/ARCHITECTURE-TECHNIQUE.md)
3. [supabase/functions/food-scan-analyze/index.ts](/Users/adenankhachnane/Downloads/projet-full-stack/main/supabase/functions/food-scan-analyze/index.ts)
4. [composables/useCredits.ts](/Users/adenankhachnane/Downloads/projet-full-stack/main/composables/useCredits.ts)
5. [pages/app/scan/[id].vue](/Users/adenankhachnane/Downloads/projet-full-stack/main/pages/app/scan/%5Bid%5D.vue)
6. [plugins/vue-query.ts](/Users/adenankhachnane/Downloads/projet-full-stack/main/plugins/vue-query.ts)
7. [supabase/migrations/20250226000000_schema.sql](/Users/adenankhachnane/Downloads/projet-full-stack/main/supabase/migrations/20250226000000_schema.sql)
