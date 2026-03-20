# Procedure — Pipeline CI/CD

Ce document decrit le comportement reel de [ci.yml](/Users/adenankhachnane/Downloads/projet-full-stack/main/.github/workflows/ci.yml).

## Branches

- `main`: production
- `recette`: integration / validation

## Declencheurs

- `push` sur `main` et `recette`
- `pull_request` vers `main` et `recette`

## Job `build`

Ordre exact:

1. checkout
2. setup Node 20
3. `npm ci`
4. `npm run lint`
5. `npm run lint:deadcode`
6. `npm run typecheck`
7. `npm run test`
8. `npm run build`

Variables passees au `build`:

- `NUXT_PUBLIC_SUPABASE_URL`
- `NUXT_PUBLIC_SUPABASE_KEY`
- `NUXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`

## Job `deploy-edge-functions-recette`

Condition:

- uniquement sur `push` vers `recette`
- seulement apres succes du job `build`

Secrets requis:

- `SUPABASE_ACCESS_TOKEN`
- `SUPABASE_PROJECT_REF_RECETTE`

Actions:

1. `supabase functions deploy --project-ref "$SUPABASE_PROJECT_REF"`
2. `supabase functions deploy stripe-webhook --no-verify-jwt --project-ref "$SUPABASE_PROJECT_REF"`
3. verification que `types/supabase.ts` est a jour par rapport au schema distant

## Vercel

Il n'y a pas de job GitHub Actions pour deployer le front.
Vercel deploie automatiquement le front a chaque push sur `main`.

## Sync `main` -> `recette`

Le workflow `sync-recette-after-merge.yml` resynchronise `recette` apres merge vers `main`, pour eviter qu'elle reste en retard.

## Checklist de setup

### GitHub

- configurer les secrets Actions
- activer la branch protection sur `main`

### Vercel

- configurer les variables d'environnement Nuxt de production
- verifier `NUXT_PUBLIC_SENTRY_ENVIRONMENT=production`

### Supabase recette

- configurer `SUPABASE_PROJECT_REF_RECETTE`
- verifier les secrets Edge Functions recette

### Supabase production

- deploiement manuel des Edge Functions selon besoin
- verifier `SENTRY_ENVIRONMENT=production`
- verifier `SENTRY_FORCE_ENABLE=false`

## Commandes utiles

```bash
npm run lint
npm run typecheck
npm test
npm run build
```
