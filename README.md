# Guide d'évaluation

- Documentation technique : (Ce fichier) yumiscan-app\README.md
- Application Architecture Diagram
  /Modèle de données
  /Infrastructure Architecture Diagram : yumiscan-app\docs\schema-bdd.svg
- CI/CD : yumiscan-app\docs\ci-cd
- Ensemble de la documentation : yumiscan-app\docs
- Lien de la diaporama : https://www.canva.com/design/DAHChX3faxw/NkUhS3tgjQNbjM5nZmHbqQ/edit?utm_content=DAHChX3faxw&utm_campaign=designshare&utm_medium=link2&utm_source=sharebutton

# YumiScan

Application Nuxt 3 + Supabase pour aider des voyageurs au Japon a comprendre une etiquette alimentaire japonaise a partir d'une photo, avec scan progressif, credits, paiement Stripe, monitoring Sentry/Discord et front public FR/EN.

## Ce que fait le produit

- l'utilisateur prend une photo d'une etiquette japonaise
- le backend OCR + IA reconstruit et interprete les ingredients
- l'application signale ce qui semble compatible, ambigu ou allergene
- le scan est progressif: le front recoit vite un `scan_id`, puis la page `/app/scan/:id` affiche l'avancement
- le modele economique combine credits gratuits, credit journalier et credits payants

## Stack

- Front: Nuxt 3, Vue 3, Tailwind, `@nuxtjs/i18n`, `@tanstack/vue-query`
- Backend: Supabase Auth, Postgres, Storage, Edge Functions
- OCR / IA: Google Cloud Vision + Gemini
- Paiement: Stripe
- Monitoring: Sentry + Discord
- Tests: Vitest

## Etat actuel

- version projet: `1.5.6`
- scan progressif v1.3 actif
- `result_json` front-safe et `debug_json` reserve au back/admin
- credits payants derives du ledger `user_purchases`, plus de `paid_credits_balance`
- rattrapage Stripe via `stripe-finalize-checkout` en plus du webhook nominal
- cache PWA selectif + persistance Vue Query ciblee + invalidation metier fine
- transitions mobile-first sobres pour limiter l'effet "l'app recharge"
- Assistant IA pour scans ambigus avec cartes magasin en langue user, japonais et romaji

## Lecture recommandee

Pour reprendre le projet rapidement:

1. lire ce `README`
2. lire [docs/README.md](/Users/adenankhachnane/Downloads/projet-full-stack/main/docs/README.md)
3. lire [docs/ARCHITECTURE-TECHNIQUE.md](/Users/adenankhachnane/Downloads/projet-full-stack/main/docs/ARCHITECTURE-TECHNIQUE.md)
4. lire [pipeline-scan-yumiscan.md](/Users/adenankhachnane/Downloads/projet-full-stack/main/pipeline-scan-yumiscan.md)
5. lancer le projet en local et verifier `npm test` + `npm run typecheck`

## Structure du repo

Principaux dossiers:

- `pages/`: routes publiques, auth, app connectee et admin
- `components/`: UI publique, scan, account, admin, composants de base
- `composables/`: auth, credits, invalidation metier, scan flow, admin
- `plugins/`: Vue Query, transitions, auth recovery, maintenance/refresh/reset service worker, tracking
- `app/router.options.ts`: scroll hash robuste pour les ancres type `#pricing`
- `utils/`: helpers i18n, scan, cache, headers, pricing, auth
- `supabase/functions/`: Edge Functions metier
- `supabase/migrations/`: schema SQL et migrations de reference
- `tests/`: tests front, utilitaires, securite, Stripe, i18n, admin

## Fonctions Edge importantes

- `food-scan-analyze`: pipeline scan principal
- `scan-delete`: suppression d'un scan
- `stripe-checkout`: creation du checkout
- `stripe-webhook`: confirmation nominale Stripe
- `stripe-finalize-checkout`: rattrapage serveur idempotent au retour Stripe
- `stripe-order-history`: historique d'achats
- `entitlements`: droit d'acces / resume credits
- `admin-*`: KPI, users, scans, config, pricing
- `sentry-webhook` et `discord-interactions`: monitoring et alerting

## Tables metier a connaitre

- `user_profiles`: profil, compteurs, admin flag, usage des scans gratuits / payants
- `scans`: historique des scans, `processing_status`, `result_json`, `debug_json`
- `user_purchases`: ledger des achats de credits
- `pricing_offers`: offres commerciales et `price_id` Stripe
- `allergens`: catalogue allergenes localise
- `app_config`: flags et configuration globale

## Prerequis

- Node.js 20+
- npm
- Docker
- Supabase CLI
- Stripe CLI pour les webhooks locaux

## Installation

```bash
npm ci
cp .env.example .env.recette
```

Puis renseigner `.env.recette`.

## Strategie d'environnement

- branche `recette` -> `npm run dev` copie `.env.recette` vers `.env`
- branche `main` -> runtime de production gere par Vercel + Supabase cloud

Script concerne:

- [scripts/env-by-branch.cjs](/Users/adenankhachnane/Downloads/projet-full-stack/main/scripts/env-by-branch.cjs)

## Variables importantes

### Front / Nuxt

- `NUXT_PUBLIC_SUPABASE_URL`
- `NUXT_PUBLIC_SUPABASE_KEY`
- `SITE_URL`
- `NUXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- `NUXT_PUBLIC_SENTRY_DSN`
- `NUXT_PUBLIC_SENTRY_ENVIRONMENT`
- `SENTRY_FORCE_ENABLE`
- `SENTRY_ORG` et `SENTRY_PROJECT` uniquement si upload des sourcemaps au build

### Edge Functions / serveur

- `SUPABASE_SERVICE_ROLE_KEY`
- `STRIPE_SECRET`
- `STRIPE_WEBHOOK_SECRET`
- `GEMINI_KEY`
- `SENTRY_DSN` ou fallback `NUXT_PUBLIC_SENTRY_DSN`
- `SENTRY_ENVIRONMENT`
- `SENTRY_WEBHOOK_SECRET`
- `DISCORD_WEBHOOK_URL`
- `DISCORD_BOT_TOKEN`
- `DISCORD_PUBLIC_KEY`
- `SENTRY_AUTH_TOKEN`
- `SENTRY_ORG`
- `SENTRY_PROJECT`

## Demarrage local

### 1. Demarrer Supabase local

```bash
npm run supabase:start
```

### 2. Servir les Edge Functions

```bash
npm run functions:serve
```

En local, ce script utilise `--no-verify-jwt` au niveau gateway. L'auth utilisateur reste revalidee applicativement dans:

- [supabase/functions/\_shared/auth.ts](/Users/adenankhachnane/Downloads/projet-full-stack/main/supabase/functions/_shared/auth.ts)
- [supabase/functions/\_shared/admin.ts](/Users/adenankhachnane/Downloads/projet-full-stack/main/supabase/functions/_shared/admin.ts)

### 3. Lancer le front

```bash
npm run dev
```

## Scan et pipeline IA

Fonction principale:

- [supabase/functions/food-scan-analyze/index.ts](/Users/adenankhachnane/Downloads/projet-full-stack/main/supabase/functions/food-scan-analyze/index.ts)

Pipeline reel:

1. validation image, gatekeeping et draft OCR
2. correction OCR
3. reparation structurelle si necessaire
4. nettoyage avant parsing
5. parsing en arbre
6. flatten
7. creation d'un scan `processing` en base
8. traitement par batchs de taille configurable via le BO (defaut 8), concurrence max 2
9. traduction `phase15`
10. mapping deterministe allergenes `phase1.7`
11. classification IA `phase2`
12. persistance progressive cote base
13. reconstruction finale `phase7`
14. finalisation transactionnelle du credit

Reference detaillee:

- [pipeline-scan-yumiscan.md](/Users/adenankhachnane/Downloads/projet-full-stack/main/pipeline-scan-yumiscan.md)

## Credits et Stripe

Principes actuels:

- credits payants restants = `SUM(user_purchases.credits_added) - paid_scans_used`
- source de verite achat = `user_purchases`
- source de verite commerciale = `pricing_offers`
- webhook Stripe = chemin nominal
- `stripe-finalize-checkout` = filet de securite au retour checkout

En local, lancer aussi:

```bash
stripe listen --forward-to http://127.0.0.1:54321/functions/v1/stripe-webhook
```

Puis renseigner:

```env
STRIPE_WEBHOOK_SECRET=whsec_...
```

## Cache, perf et UX mobile

La 1.4 introduit:

- runtime cache PWA borne aux assets et navigations publiques
- persistance Vue Query via IndexedDB
- sanitation des snapshots pour exclure admin, auth, URLs signees et scans `processing`
- invalidation metier fine apres scan, achat, profil, allergenes
- transitions de pages mobile-first

Fichiers clefs:

- [nuxt.config.ts](/Users/adenankhachnane/Downloads/projet-full-stack/main/nuxt.config.ts)
- [plugins/vue-query.ts](/Users/adenankhachnane/Downloads/projet-full-stack/main/plugins/vue-query.ts)
- [utils/query-cache.ts](/Users/adenankhachnane/Downloads/projet-full-stack/main/utils/query-cache.ts)
- [composables/useAppDataInvalidation.ts](/Users/adenankhachnane/Downloads/projet-full-stack/main/composables/useAppDataInvalidation.ts)

## Monitoring et securite

- monitoring Sentry + alerting Discord actifs en production, sauf override manuel
- signup public standard via `supabase.auth.signUp()`
- endpoint `auth-signup` conserve seulement comme endpoint deprecate qui renvoie `410`
- headers web de securite versionnes dans le repo
- `debug_json` scan seulement si `scan_debug_enabled=true`

References:

- [docs/sentry-discord/README.md](/Users/adenankhachnane/Downloads/projet-full-stack/main/docs/sentry-discord/README.md)
- [docs/security/README.md](/Users/adenankhachnane/Downloads/projet-full-stack/main/docs/security/README.md)
- [docs/security/security-review-2026-03-15.md](/Users/adenankhachnane/Downloads/projet-full-stack/main/docs/security/security-review-2026-03-15.md)

## Tests et validation

Commandes utiles:

```bash
npm test
npm run typecheck
npm run lint
npm run lint:deadcode
npm run build
```

La suite couvre notamment:

- i18n
- scan progressif et contrat front-safe
- credits et ledger `user_purchases`
- Stripe checkout/webhook/finalize
- admin
- securite front/base
- cache PWA et persistance Vue Query

Reference:

- [docs/testing/TESTS-UNITAIRES.md](/Users/adenankhachnane/Downloads/projet-full-stack/main/docs/testing/TESTS-UNITAIRES.md)

## Documentation projet

Index documentaire:

- [docs/README.md](/Users/adenankhachnane/Downloads/projet-full-stack/main/docs/README.md)

Docs principales:

- [docs/ARCHITECTURE-TECHNIQUE.md](/Users/adenankhachnane/Downloads/projet-full-stack/main/docs/ARCHITECTURE-TECHNIQUE.md)
- [pipeline-scan-yumiscan.md](/Users/adenankhachnane/Downloads/projet-full-stack/main/pipeline-scan-yumiscan.md)
- [docs/admin/README.md](/Users/adenankhachnane/Downloads/projet-full-stack/main/docs/admin/README.md)
- [docs/testing/TESTS-UNITAIRES.md](/Users/adenankhachnane/Downloads/projet-full-stack/main/docs/testing/TESTS-UNITAIRES.md)
- [docs/ci-cd/README.md](/Users/adenankhachnane/Downloads/projet-full-stack/main/docs/ci-cd/README.md)
- [docs/sentry-discord/README.md](/Users/adenankhachnane/Downloads/projet-full-stack/main/docs/sentry-discord/README.md)
- [docs/domain-email/README.md](/Users/adenankhachnane/Downloads/projet-full-stack/main/docs/domain-email/README.md)
- [supabase/functions/README-ALLERGENES.md](/Users/adenankhachnane/Downloads/projet-full-stack/main/supabase/functions/README-ALLERGENES.md)

Specs historiques conservees a titre de reference:

- [1.3-scan-progressif.md](/Users/adenankhachnane/Downloads/projet-full-stack/main/docs/milestones/1.3-scan-progressif.md)
- [1.4-performance-mobile.md](/Users/adenankhachnane/Downloads/projet-full-stack/main/docs/milestones/1.4-performance-mobile.md)

# yumiscan-app
