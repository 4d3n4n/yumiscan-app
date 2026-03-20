# Security Reference

Ce document decrit l'etat actuel des protections de securite du projet. Il remplace les anciennes notes de hardening ponctuelles et sert de reference de reprise.

## Objectif

Conserver une posture secure-by-default sans casser les parcours metier:

- signup / auth
- scan
- credits
- Stripe
- admin
- monitoring

## Principes de base

- le front ne doit jamais etre la source de verite pour les autorisations
- les Edge Functions revalident l'identite utilisateur cote serveur
- les credits et paiements se decident cote backend / SQL
- les donnees de debug et les donnees sensibles ne doivent pas etre exposees au front
- le cache client ne doit jamais persister auth, admin ou URLs privees

## Auth et comptes

Etat actuel:

- signup public via `supabase.auth.signUp()` depuis le front
- ancien endpoint `auth-signup` conserve uniquement comme endpoint deprecie renvoyant `410`
- session persistante cote client
- callbacks auth traites via `/auth/confirm`
- cleanup one-shot des anciens service workers pour eviter les erreurs de callback

Fichiers clefs:

- [pages/signup.vue](/Users/adenankhachnane/Downloads/projet-full-stack/main/pages/signup.vue)
- [pages/auth/confirm.vue](/Users/adenankhachnane/Downloads/projet-full-stack/main/pages/auth/confirm.vue)
- [plugins/00-legacy-sw-cleanup.client.ts](/Users/adenankhachnane/Downloads/projet-full-stack/main/plugins/00-legacy-sw-cleanup.client.ts)
- [supabase/functions/auth-signup/index.ts](/Users/adenankhachnane/Downloads/projet-full-stack/main/supabase/functions/auth-signup/index.ts)

## Edge Functions et verification d'identite

Le `verify_jwt = false` est configure au niveau gateway dans `supabase/config.toml`, principalement pour:

- le dev local Supabase
- les webhooks externes

La protection repose ensuite sur la revalidation applicative dans:

- [supabase/functions/_shared/auth.ts](/Users/adenankhachnane/Downloads/projet-full-stack/main/supabase/functions/_shared/auth.ts)
- [supabase/functions/_shared/admin.ts](/Users/adenankhachnane/Downloads/projet-full-stack/main/supabase/functions/_shared/admin.ts)

Regles:

- une fonction user doit toujours revalider le bearer avant d'agir
- une fonction admin doit exiger un user `is_admin`
- les vraies exceptions publiques sont les webhooks ou endpoints techniques explicitement justifies

## Scan et donnees sensibles

Protections importantes:

- `food-scan-analyze` bloque les images hors sujet
- garde anti prompt injection en phase 0
- `result_json` est front-safe
- `debug_json` n'est persiste que si `scan_debug_enabled=true`
- le front ne depend plus du debug pour afficher un scan
- le credit est consomme seulement a la finalisation via RPC atomique

Fichiers clefs:

- [supabase/functions/food-scan-analyze/index.ts](/Users/adenankhachnane/Downloads/projet-full-stack/main/supabase/functions/food-scan-analyze/index.ts)
- [supabase/migrations/20260309160000_progressive_scan_payload.sql](/Users/adenankhachnane/Downloads/projet-full-stack/main/supabase/migrations/20260309160000_progressive_scan_payload.sql)

## Credits et paiements

Etat actuel:

- la source de verite des credits payants est `user_purchases`
- le serveur derive le solde a partir du ledger
- le front ne peut pas accorder de credits a lui seul
- Stripe reste idempotent via `stripe_session_id`
- `stripe-finalize-checkout` sert de rattrapage serveur, pas de deuxieme logique metier

Fichiers clefs:

- [supabase/functions/_shared/purchased-credits.ts](/Users/adenankhachnane/Downloads/projet-full-stack/main/supabase/functions/_shared/purchased-credits.ts)
- [supabase/functions/_shared/stripe-checkout.ts](/Users/adenankhachnane/Downloads/projet-full-stack/main/supabase/functions/_shared/stripe-checkout.ts)
- [supabase/functions/stripe-webhook/index.ts](/Users/adenankhachnane/Downloads/projet-full-stack/main/supabase/functions/stripe-webhook/index.ts)
- [supabase/functions/stripe-finalize-checkout/index.ts](/Users/adenankhachnane/Downloads/projet-full-stack/main/supabase/functions/stripe-finalize-checkout/index.ts)

## Admin

Protections:

- routes admin derriere middleware
- verification `is_admin` cote fonction
- actions sensibles via Edge Functions et jamais directement depuis le client
- promotion admin uniquement via base / `service_role`

Reference:

- [docs/admin/README.md](/Users/adenankhachnane/Downloads/projet-full-stack/main/docs/admin/README.md)

## Cache, PWA et persistance client

Depuis la 1.4:

- runtime cache borne aux assets et navigations publiques
- persistance Vue Query selective
- scoping des snapshots utilisateur par `userId`
- purge du cache utilisateur au logout ou changement de session
- aucune persistance durable de:
  - auth
  - admin
  - URLs signees
  - scans `processing`
- client Supabase recrée par requete cote SSR, singleton uniquement cote navigateur

Fichiers clefs:

- [plugins/vue-query.ts](/Users/adenankhachnane/Downloads/projet-full-stack/main/plugins/vue-query.ts)
- [utils/query-cache.ts](/Users/adenankhachnane/Downloads/projet-full-stack/main/utils/query-cache.ts)
- [plugins/zz-query-auth-boundary.client.ts](/Users/adenankhachnane/Downloads/projet-full-stack/main/plugins/zz-query-auth-boundary.client.ts)

## Web hardening

Les headers de securite sont versionnes dans le repo.

Points clefs:

- CSP
- Referrer-Policy
- Permissions-Policy
- anti-framing
- protections de type contenu

Fichier clef:

- [utils/security-headers.ts](/Users/adenankhachnane/Downloads/projet-full-stack/main/utils/security-headers.ts)

## Observabilite

Le monitoring repose sur:

- Sentry pour la capture
- `sentry-webhook` pour l'entree webhook
- `discord-interactions` pour les actions Discord

Le pipeline reste prod-only par defaut, sauf override manuel.

Reference:

- [docs/sentry-discord/README.md](/Users/adenankhachnane/Downloads/projet-full-stack/main/docs/sentry-discord/README.md)

## Ce qu'il faut verifier avant deploy

1. `npm run typecheck`
2. `npm test`
3. `npm run lint`
4. `npm run lint:deadcode`
5. si schema ou fonctions touches:
   `npm run gen:types`
6. si auth / Stripe / cache touches:
   smoke tests manuels ciblés

## Ce qu'un repreneur doit retenir

- le front n'autorise jamais un scan ou un credit a lui seul
- le serveur et SQL restent la source de verite
- les payloads utilisateur sont assainis avant exposition au front
- le cache client est borne et nettoye
- les endpoints publics toleres sont explicites et limites
