# Back-office Admin

Date de mise a jour: 2026-03-17
Statut: reference active

## But

Ce document decrit l'etat actuel du back-office admin tel qu'il existe dans le repo. Ce n'est plus une todo-list.

## Perimetre actuel

Le back-office admin est volontairement:

- reserve aux utilisateurs `user_profiles.is_admin = true`
- non multilingue
- centre sur l'exploitation interne

## Routes front

Routes principales:

- `/app/admin`
- `/app/admin/users`
- `/app/admin/users/:userId`
- `/app/admin/settings`

Pages correspondantes:

- [index.vue](/Users/adenankhachnane/Downloads/projet-full-stack/main/pages/app/admin/index.vue)
- [users/index.vue](/Users/adenankhachnane/Downloads/projet-full-stack/main/pages/app/admin/users/index.vue)
- [users/[userId].vue](/Users/adenankhachnane/Downloads/projet-full-stack/main/pages/app/admin/users/%5BuserId%5D.vue)
- [settings.vue](/Users/adenankhachnane/Downloads/projet-full-stack/main/pages/app/admin/settings.vue)

Navigation et garde:

- [AdminSubNav.vue](/Users/adenankhachnane/Downloads/projet-full-stack/main/components/app/AdminSubNav.vue)
- middleware `admin`

## Edge Functions admin

Le back-office s'appuie sur:

- `admin-kpi`
- `admin-users-list`
- `admin-send-password-reset`
- `admin-delete-user`
- `admin-user-scans`
- `admin-app-config`
- `admin-pricing-offers`

Sources:

- [supabase/functions](/Users/adenankhachnane/Downloads/projet-full-stack/main/supabase/functions)

## Capacites actuelles

- consulter des KPI d'usage
- piloter le pricing et les couts theoriques
- lister et rechercher les utilisateurs
- copier l'email / ouvrir un `mailto:`
- generer un lien de reinitialisation de mot de passe
- supprimer un utilisateur
- consulter les scans d'un utilisateur
- editer les informations entreprise
- activer le mode maintenance
- piloter `scan_debug_enabled`
- piloter le modele IA du scan et celui de l'assistant
- piloter la taille des batchs du scan
- piloter les couts theoriques OCR / IA scan / IA assistant
- suivre les temps de scan min / moyen / max sur la periode

## Contraintes de securite

- les routes admin sont protegees par le middleware `admin`
- les actions sensibles passent par des Edge Functions
- `is_admin` ne peut pas etre eleve depuis le front
- la promotion admin se fait en base via SQL Editor ou `service_role`

Reference utile:

- [docs/sentry-discord/README.md](/Users/adenankhachnane/Downloads/projet-full-stack/main/docs/sentry-discord/README.md)

## Deploy et verification

Pour eviter les regressions prod sur `/app/admin/users`:

- pousser la base avant le redeploiement admin: `supabase db push`
- redeployer les fonctions admin touchees
- faire un smoke test manuel de `/app/admin` et `/app/admin/users`

Point important:

- `admin-users-list` depend des RPC SQL `admin_list_users` et `admin_count_users`
- si la base prod n'est pas a jour, le front admin peut tomber sur une erreur de schema cache meme si les fonctions sont bien deployeees

## Hors scope actuel

- i18n admin
- analytics marketing avancees
- edition complete d'un scan tiers
- workflows de support complexes

## Extensions logiques suivantes

1. filtres plus riches sur la liste users
2. detail scan admin plus pousse
3. export CSV
4. journal d'audit admin
