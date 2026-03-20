# Tests unitaires et verifications

Cette doc sert de reference unique pour comprendre ce qui est teste et quoi lancer avant une PR ou un deploy.

## Commandes

```bash
npm test
npm run test:watch
npm run typecheck
npm run lint
npm run lint:deadcode
npm run build
```

## Ce qu'il faut lancer avant une PR importante

1. `npm run typecheck`
2. `npm test`
3. `npm run lint`
4. `npm run lint:deadcode`
5. `npm run build` si la PR touche Nuxt, la config ou le runtime cache

## Domaines couverts

- i18n: routes localisees, parite des messages, cles utilisees, blog
- composants critiques: navigation, auth modal, credits compte, sous-nav admin
- scan: prompts i18n, helpers, contrat front-safe, etats `processing` / `completed` / `failed`
- credits: ledger `user_purchases`, refresh daily credit, resilience du snapshot credits
- Stripe: checkout, webhook, finalize checkout, historique achat
- admin: composables, helpers, pricing, KPI
- securite: XSS, auth edges, signup, cache auth boundary, scan UI-safe, headers
- perf/cache 1.4: politiques Vue Query, sanitation du cache, runtime cache borne, invalidation fine
- SQL / RPC: finalisation atomique du scan, schema progressif, ledger credits

## Suites representatives

- `tests/i18n/translations.spec.ts`
- `tests/i18n/routes.spec.ts`
- `tests/supabase/food-scan-i18n.spec.ts`
- `tests/components/account/AccountCreditsSection.spec.ts`
- `tests/components/app/AppNavigation.spec.ts`
- `tests/composables/useAdmin.spec.ts`
- `tests/stripe/stripe-checkout-contract.spec.ts`
- `tests/stripe/stripe-webhook-pricing.spec.ts`
- `tests/stripe/stripe-finalize-checkout.spec.ts`
- `tests/security/paid-credits-ledger.spec.ts`
- `tests/security/daily-credit-refresh.spec.ts`
- `tests/security/query-cache-auth-boundary.spec.ts`
- `tests/utils/query-cache.spec.ts`
- `utils/scan.spec.ts`

## Principes de maintenance

- ajouter un test a chaque regression corrigee
- privilegier les tests de logique pure quand c'est possible
- garder des tests de contrat sur les payloads de scan et Stripe
- si un comportement de securite ou de cache est ajoute, le couvrir explicitement
- eviter les chiffres figes dans cette doc: verifier l'etat exact via `npm test`

## Risques de regression frequents

- changement de schema sans regeneration de `types/supabase.ts`
- modification d'un contrat Edge Function sans adaptation des tests
- refetch global involontaire apres une mutation metier
- reintroduction d'une dependance front a des donnees sensibles ou instables
