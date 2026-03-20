# CI/CD — YumiScan

Documentation de reference pour le pipeline GitHub Actions, Vercel et Supabase.

## Source de verite

- Workflow principal: [\.github/workflows/ci.yml](/Users/adenankhachnane/Downloads/projet-full-stack/main/.github/workflows/ci.yml)
- Sync `main` -> `recette`: [\.github/workflows/sync-recette-after-merge.yml](/Users/adenankhachnane/Downloads/projet-full-stack/main/.github/workflows/sync-recette-after-merge.yml)
- Procedure detaillee: [PROCEDURE-CI-YML.md](/Users/adenankhachnane/Downloads/projet-full-stack/main/docs/ci-cd/PROCEDURE-CI-YML.md)

## Ce que fait la CI

Sur `push` et `pull_request` vers `main` et `recette`, la CI lance:

1. `npm ci`
2. `npm run lint`
3. `npm run lint:deadcode`
4. `npm run typecheck`
5. `npm run test`
6. `npm run build`

## Deploiement

- Front: deploye par Vercel
- Edge Functions: deployees automatiquement seulement sur `push` vers `recette`
- Production Edge Functions: deploiement manuel si besoin

## Secrets a connaitre

### GitHub Actions

- `NUXT_PUBLIC_SUPABASE_URL`
- `NUXT_PUBLIC_SUPABASE_KEY`
- `NUXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- `SUPABASE_ACCESS_TOKEN`
- `SUPABASE_PROJECT_REF_RECETTE`

### Vercel

- variables Nuxt publiques de prod
- `NUXT_PUBLIC_SENTRY_ENVIRONMENT=production`

### Supabase cloud

- secrets Edge Functions
- `SENTRY_ENVIRONMENT=production`
- `SENTRY_FORCE_ENABLE=false`

## Regle pratique

- `recette` = branche de validation continue
- `main` = branche de production
- la CI doit rester verte avant merge
