# Security Review — 2026-03-15

Statut: officiel
Portee: repo complet
Branche de reference: `recette`

## Executive summary

La posture securite est globalement bonne. Aucun bypass critique ni faille high confirmee n'a ete trouve dans le repo sur cette passe. Le socle reste coherent: verification backend centralisee, RLS, webhook signatures, sanitation des payloads front, et couverture de tests securite utile.

Les derniers travaux `1.5.2` ont ferme plusieurs points faibles importants:

- suppression de compte rendue fail-closed
- signed URLs privees non persistees durablement dans le navigateur
- tables internes Sentry sorties de `public`
- ownership minimal formalise via `CODEOWNERS`

Les points encore ouverts sont surtout de la defense en profondeur:

- `verify_jwt = false` encore large au niveau gateway
- CSP toujours en `unsafe-inline`
- bus factor encore concentre

## Scope

Audit consolide sur:

- Nuxt/Vue front
- Supabase Edge Functions
- schema SQL / migrations
- auth, credits, Stripe, admin
- cache client, URLs privees, monitoring

## Etat actuel confirme

### Auth et autorisations

- les controles backend passent par [auth.ts](/Users/adenankhachnane/Downloads/projet-full-stack/main/supabase/functions/_shared/auth.ts)
- les controles admin passent par [admin.ts](/Users/adenankhachnane/Downloads/projet-full-stack/main/supabase/functions/_shared/admin.ts)
- les routes admin restent sous middleware

### Donnees privees et suppression

- la suppression de compte passe maintenant par [account-delete.ts](/Users/adenankhachnane/Downloads/projet-full-stack/main/supabase/functions/_shared/account-delete.ts)
- chaque etape critique est verifiee avant succes
- les images de scan privees ne sont plus persistees en `localStorage`

### Monitoring et observabilite

- Sentry front/back reste actif selon environnement
- le webhook Sentry passe desormais par des RPC dediees pour acceder aux tables internes
- les tables backend-only Sentry sont migrees hors de `public`

## Findings ouverts

### SEC-OPEN-001 — `verify_jwt = false` reste large

Severite: Low

Constat:

- beaucoup d'Edge Functions gardent `verify_jwt = false` dans [config.toml](/Users/adenankhachnane/Downloads/projet-full-stack/main/supabase/config.toml)
- la protection repose aujourd'hui sur la revalidation applicative dans les helpers backend

Impact:

- la posture actuelle est correcte tant que chaque fonction privee appelle bien le helper adapte
- la defense en profondeur du gateway reste toutefois reduite

Action recommandee:

- reevaluer une reactivation partielle de `verify_jwt = true` pour les fonctions privees des que le blocage local ES256 n'est plus un sujet

### SEC-OPEN-002 — CSP encore permissive

Severite: Low

Constat:

- [security-headers.ts](/Users/adenankhachnane/Downloads/projet-full-stack/main/utils/security-headers.ts) garde `script-src 'unsafe-inline'`
- retirer ce flag brutalement casse encore le bootstrap Nuxt client

Impact:

- la defense CSP est moins forte que souhaitee face a une future XSS

Action recommandee:

- traiter ce point dans une passe dediee nonce/hash
- ne pas reessayer une suppression brute sans refonte du bootstrap/runtime

### SEC-OPEN-003 — Ownership encore concentre

Severite: Low

Constat:

- `CODEOWNERS` existe maintenant
- mais l'ownership reel reste concentre sur un mainteneur principal

Impact:

- risque operationnel de review et de continuites

Action recommandee:

- ajouter un second reviewer habituel sur auth, paiements, admin et migrations

## Hardening applique dans le repo

- [20260315113000_move_sentry_internal_tables_private.sql](/Users/adenankhachnane/Downloads/projet-full-stack/main/supabase/migrations/20260315113000_move_sentry_internal_tables_private.sql)
- [account-delete.ts](/Users/adenankhachnane/Downloads/projet-full-stack/main/supabase/functions/_shared/account-delete.ts)
- [useScanImageSessionCache.ts](/Users/adenankhachnane/Downloads/projet-full-stack/main/composables/useScanImageSessionCache.ts)
- [CODEOWNERS](/Users/adenankhachnane/Downloads/projet-full-stack/main/CODEOWNERS)

## Validation

- `npm test` vert lors de la passe
- `npm run lint:deadcode` vert lors de la passe
- `vue-tsc` vert lors de la passe
- `deno check` vert sur les fonctions touchees

## References

- plan securite evergreen: [SECURITY-HARDENING-PLAN.md](/Users/adenankhachnane/Downloads/projet-full-stack/main/docs/security/SECURITY-HARDENING-PLAN.md)
- documentation monitoring: [docs/sentry-discord/README.md](/Users/adenankhachnane/Downloads/projet-full-stack/main/docs/sentry-discord/README.md)
- reference admin: [docs/admin/README.md](/Users/adenankhachnane/Downloads/projet-full-stack/main/docs/admin/README.md)
