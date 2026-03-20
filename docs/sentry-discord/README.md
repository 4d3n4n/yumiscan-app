# Sentry + Discord — Logs et notifications

Un flux unique : **Sentry** (capture d’erreurs) → **webhook** → Edge Function **sentry-webhook** → **Discord** (1 issue = 1 thread). Les boutons **Résoudre** / **Ignorer** dans Discord mettent à jour le statut dans Sentry via l’Edge Function **discord-interactions**.

---

## 1. Variables d’environnement

### Nuxt (build + runtime)

| Variable | Usage |
|----------|--------|
| `NUXT_PUBLIC_SENTRY_DSN` | DSN Sentry (client + server) |
| `NUXT_PUBLIC_SENTRY_ENVIRONMENT` | Environnement Sentry. Le pipeline n’est actif que si la valeur vaut exactement `production`, sauf override manuel. |
| `SENTRY_FORCE_ENABLE` | Optionnel. `true` active temporairement le pipeline hors production pour un test manuel. |
| `SENTRY_AUTH_TOKEN` | Optionnel au build Nuxt. Active l’upload des sourcemaps seulement si `SENTRY_ORG` et `SENTRY_PROJECT` sont aussi définis. |
| `SENTRY_ORG` | Slug d’organisation Sentry pour l’upload des sourcemaps Nuxt. |
| `SENTRY_PROJECT` | Slug de projet Sentry pour l’upload des sourcemaps Nuxt. |

### Edge Functions (Supabase)

À définir dans **Supabase** → **Settings** → **Edge Functions** → **Secrets**.

| Secret | Usage |
|--------|--------|
| `SENTRY_WEBHOOK_SECRET` | Client secret de l’Internal Integration Sentry (vérification HMAC des webhooks). |
| `DISCORD_WEBHOOK_URL` | URL complète du webhook Discord, créé sur un **canal Forum**. |
| `DISCORD_BOT_TOKEN` | *(Optionnel)* Token du bot pour les boutons Résoudre / Ignorer. |
| `DISCORD_PUBLIC_KEY` | *(Optionnel)* Clé publique de l’application Discord (hex), pour vérifier les interactions. |
| `SENTRY_AUTH_TOKEN` | *(Optionnel)* Token Sentry (scope issue read/write). Pour afficher les tags et le **contexte code** (lignes autour de l’erreur) dans Discord, et pour les boutons Résoudre/Ignorer. |
| `SENTRY_ORG` | *(Optionnel, build Nuxt uniquement)* Slug d’organisation Sentry pour l’upload des sourcemaps. |
| `SENTRY_PROJECT` | *(Optionnel, build Nuxt uniquement)* Slug de projet Sentry pour l’upload des sourcemaps. |
| `SENTRY_DSN` | *(Par fonction, recommandé)* Même DSN que Nuxt ; utilisé en priorité pour les Edge Functions. |
| `NUXT_PUBLIC_SENTRY_DSN` | *(Fallback accepté côté Edge Functions)* Utilisé si `SENTRY_DSN` n’est pas défini. |
| `SENTRY_ENVIRONMENT` / `NUXT_PUBLIC_SENTRY_ENVIRONMENT` | Environnement Sentry. Le pipeline n’est actif que si la valeur vaut exactement `production`, sauf override manuel. |
| `SENTRY_FORCE_ENABLE` | Optionnel. `true` active temporairement le pipeline hors production pour un test manuel. |

`SUPABASE_URL` et `SUPABASE_SERVICE_ROLE_KEY` sont fournis par Supabase.

---

## 2. Configuration Sentry

- **Webhooks** : Internal Integration → Webhooks → URL =  
  `https://<project-ref>.supabase.co/functions/v1/sentry-webhook`  
  Utiliser le **Client Secret** comme `SENTRY_WEBHOOK_SECRET`.
- **Règles** : new issue, regression, resolved/unresolved, user feedback → action = envoyer vers ce webhook (pas d’email).
- **Notifications** : désactiver les emails dans Settings → Notifications pour rester en « Discord only ».

---

## 3. Configuration Discord

### Webhook (obligatoire)

- Créer un **salon de type Forum** dans le serveur Discord.
- Dans ce forum : **Paramètres du salon** → **Intégrations** → **Webhooks** → **Nouveau webhook**. Copier l’URL → secret Supabase `DISCORD_WEBHOOK_URL`.

Sans Forum, Discord ne crée pas de threads (pas de « 1 issue = 1 thread »).

### Boutons Résoudre / Ignorer (optionnel)

1. [Discord Developer Portal](https://discord.com/developers/applications) → New Application.
2. **Bot** : onglet Bot → token = `DISCORD_BOT_TOKEN`. Activer « Message Content Intent » si besoin.
3. **General Information** → **Public Key** (hex) = `DISCORD_PUBLIC_KEY`. Ce n’est pas le Client Secret ni le Bot Token.
4. **Interactions Endpoint URL** = `https://<project-ref>.supabase.co/functions/v1/discord-interactions` (sans slash final). Save.
5. **OAuth2** → URL Generator → scope **bot**, permissions **Send Messages** (et **Send Messages in Threads**) → inviter le bot sur le serveur.
6. Token Sentry (Developer Settings → Personal Access Token ou Internal Integration, scope issue read/write) → `SENTRY_AUTH_TOKEN`.

**Sécurité** : `sentry-webhook` vérifie les requêtes avec HMAC (`SENTRY_WEBHOOK_SECRET`) ; `discord-interactions` vérifie la signature Discord avec `DISCORD_PUBLIC_KEY`. Les deux sont déployées avec `--no-verify-jwt`.

---

## 4. Erreurs back (Edge Functions)

Les erreurs Nuxt remontent via les configs Sentry du projet. Les erreurs des Edge Functions ne passent pas par Nuxt : pour les avoir dans Sentry (et Discord) il faut les instrumenter.

- **Secret** : pour chaque fonction concernée, définir idéalement **`SENTRY_DSN`**. À défaut, le helper accepte aussi **`NUXT_PUBLIC_SENTRY_DSN`** en fallback.
- **Code** : dans le `catch`, appeler le helper partagé :

```ts
import { captureError } from '../_shared/sentry.ts'

try {
  // ...
} catch (e) {
  await captureError(e, { function: 'ma-fonction' })
  return new Response(JSON.stringify({ error: '...' }), { status: 500 })
}
```

Le helper pose le tag **`area: back`** et n’envoie pas à Sentry les erreurs « attendues » (4xx, validation, image/scan invalide, etc.). Liste dans `supabase/functions/_shared/sentry.ts`.
Le pipeline entier est désactivé hors production, même si un DSN est défini. Pour un test manuel ponctuel en local, définir `SENTRY_FORCE_ENABLE=true`.

---

## 5. Tags et contexte code (front / back)

- **Front** : dans `sentry.client.config.ts` et `sentry.server.config.ts`, `beforeSend` pose **`area: front`** et **`route`** (path).
- **Back** : le helper `captureError` dans `_shared/sentry.ts` pose **`area: back`** et **`function`** si passé en extra.

Avec **SENTRY_AUTH_TOKEN**, la fonction **sentry-webhook** récupère le dernier événement de l’issue et envoie dans le thread Discord :
- les **tags** (area, route, function) ;
- le **contexte code** : les lignes de code autour du frame qui a crashé (`pre_context`, `context_line`, `post_context`), lorsqu’elles sont présentes dans le payload Sentry (selon le SDK et les source maps).

---

## 6. Tables BDD

- **sentry_webhook_dedup** : dédup des payloads webhook (idempotence).
- **sentry_discord_threads** : mapping issue Sentry ↔ thread Discord (mises à jour résolu / non résolu dans le même thread).

Ces deux tables sont des tables internes. Elles ont **RLS activé** avec des
policies explicites **deny-all** pour les clients (`anon` / `authenticated`).
Seul le backend exécuté avec la **service_role** les utilise.

---

## 7. Déploiement

```bash
supabase functions deploy sentry-webhook --no-verify-jwt
supabase functions deploy discord-interactions --no-verify-jwt
```

Après modification des secrets, les prochaines invocations utilisent les nouvelles valeurs (pas besoin de redéployer).

---

## 8. Dépannage

### ERR_SSL_PROTOCOL_ERROR en local

Le serveur de dev Nuxt sert du **HTTP**, pas du HTTPS. Ouvre **http://localhost:3000** (et non pas https://). Si tu as un marque-page ou une redirection vers `https://localhost`, corrige l’URL.

### Aucun thread Discord après un test

1. **Sentry** : l’erreur apparaît-elle dans Issues ? Sinon → vérifier `NUXT_PUBLIC_SENTRY_DSN` dans `.env` et la console navigateur.
   En local, vérifier aussi `NUXT_PUBLIC_SENTRY_ENVIRONMENT=development` et l’absence de `SENTRY_FORCE_ENABLE=true` si tu veux éviter tout envoi.
2. **Webhook Sentry** : Internal Integration → Webhooks → URL = `https://<project-ref>.supabase.co/functions/v1/sentry-webhook`, événements Issue activés ; une règle « new issue » doit envoyer vers cette URL.
3. **Logs Edge Function** : Supabase → Edge Functions → **sentry-webhook** → Logs. Déclencher à nouveau l’erreur.
   - Aucune requête → Sentry n’envoie pas (revoir étape 2).
   - « Invalid or missing signature » → `SENTRY_WEBHOOK_SECRET` différent du Signing Secret Sentry.
   - « Discord create thread failed » ou 4xx → webhook Discord (URL, canal Forum, permissions).
4. **Webhook Discord** : doit être créé sur un **Forum**. Vérifier `DISCORD_WEBHOOK_URL` dans les secrets.

### Bruits console a ignorer

Les logs suivants ne viennent pas de l'app et ne doivent pas etre traites comme des bugs YumiScan:

- `ContentMain.js`
- `lockdown-install.js`
- `SES Removing unpermitted intrinsics`
- `refresh.js:27 WebSocket connection to ws://localhost:8081`

Ils proviennent generalement d'extensions navigateur ou d'outils de securite injectes dans la page.

### Page de test (réservée aux admins)

**`/example-error`** : boutons **Erreur front** (Nuxt, tag `area: front`) et **Erreur back** (Edge Function, tag `area: back`). L’accès est réservé aux utilisateurs dont `user_profiles.is_admin = true`. Le bouton back appelle maintenant la fonction avec un **vrai JWT utilisateur**, et la fonction revalide aussi le rôle **admin** côté backend.

En local, la fonction de test reste servie via `supabase functions serve`. En runtime, elle n’accepte plus la clé publique seule: il faut une session utilisateur valide et un profil admin, plus les secrets `SENTRY_DSN` ou `NUXT_PUBLIC_SENTRY_DSN`.

### Politique recommandée

- **local / dev / recette / preview** : `NUXT_PUBLIC_SENTRY_ENVIRONMENT=development` et `SENTRY_FORCE_ENABLE` absent ou `false`
- **production** : `NUXT_PUBLIC_SENTRY_ENVIRONMENT=production`
- **test manuel ponctuel hors prod** : ajouter temporairement `SENTRY_FORCE_ENABLE=true`, puis le retirer

---

## 9. Créer ou promouvoir un admin

La page `/example-error` et d’éventuelles autres actions « debug » ne sont accessibles qu’aux utilisateurs **admin** (`user_profiles.is_admin = true`). Par défaut, tout compte créé à l’inscription a `is_admin = false`.

### Requêtes SQL (cloud et local)

La colonne `is_admin` et le trigger sont définis dans la migration `supabase/migrations/20250226000000_schema.sql` (appliquée au premier déploiement ou `db reset`).

**Promouvoir un compte en admin** : Supabase Dashboard → SQL Editor (ou Studio local), exécuter (en remplaçant l’email) :

```sql
UPDATE public.user_profiles
SET is_admin = true
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'ton-email@exemple.com' LIMIT 1);
```

### Sécurité : personne ne peut passer admin depuis le front

- **Trigger en BDD** : pour toute requête dont le JWT a le rôle `authenticated` (appel API depuis le navigateur avec un utilisateur connecté), le trigger force `is_admin = false` sur INSERT et bloque le passage à `true` sur UPDATE. Seules les requêtes sans ce rôle (ex. **SQL Editor** du Dashboard, ou clé **service_role** côté serveur) peuvent mettre `is_admin = true`.
- **Front** : aucun code ne peut contourner le trigger. Les seuls écritures sur `user_profiles` depuis le front sont :
  - **Inscription** (`signup.vue`) : payload typé `UserProfileInsert` (sans `is_admin`).
  - **Compte** (`account.vue`) : mises à jour explicites `first_name`/`last_name` ou `preferences`/`updated_at` uniquement (type `UserProfileUpdateByUser`, sans `is_admin`).
- **Edge Functions** (stripe-webhook, auth) : ne mettent à jour que crédits / préférences, jamais `is_admin`.

Donc seul un **UPDATE** exécuté par toi en BDD (SQL Editor ou outil connecté en tant que projet) peut promouvoir un admin.

### Créer un nouvel admin

1. Crée un compte normalement (inscription sur l’app ou **Authentication** → **Users** → **Add user** dans le Dashboard).
2. Une fois le profil créé dans `user_profiles`, exécute la requête `UPDATE ... SET is_admin = true WHERE ...` ci-dessus avec l’email de ce compte.
