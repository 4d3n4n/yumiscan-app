# Domaine, DNS et Emails Transactionnels

Procedure de reference pour:
- acheter et connecter le domaine principal sur Vercel
- ajouter les sous-domaines utiles
- configurer Resend pour les emails transactionnels
- brancher Resend comme SMTP custom dans Supabase Auth

Ce document part du setup retenu pour YumiScan:
- domaine public principal: `yumiscan.com`
- domaine technique Vercel conserve: `p-j-f-s-m1.vercel.app`
- sous-domaine emails transactionnels: `auth.yumiscan.com`
- adresse d'envoi auth: `noreply@auth.yumiscan.com`

## Architecture retenue

Separation recommandee:
- `yumiscan.com`
  Domaine public principal de l'application
- `www.yumiscan.com`
  Redirection permanente vers `yumiscan.com`
- `p-j-f-s-m1.vercel.app`
  Domaine technique Vercel, conserve mais redirige vers `yumiscan.com`
- `auth.yumiscan.com`
  Sous-domaine reserve a l'envoi des emails transactionnels via Resend

Ce qu'il ne faut pas faire:
- ne pas utiliser `auth.yumiscan.com` comme domaine web public
- ne pas exposer `contact@yumiscan.com` tant qu'une vraie boite mail n'existe pas
- ne pas melanger emails auth et support humain

## 1. Achat et connexion du domaine dans Vercel

### Acheter le domaine

Dans Vercel:
1. ouvrir le dashboard
2. aller dans `Domains`
3. acheter `yumiscan.com`
4. l'attacher au projet YumiScan

Une fois achete chez Vercel:
- le SSL est gere automatiquement
- le DNS est gere dans `Manage DNS`

### Garder le domaine Vercel par defaut

Conserver `p-j-f-s-m1.vercel.app`.

Il reste utile pour:
- les previews
- le fallback technique
- certaines verifications ou diagnostics

Mais il ne doit pas rester le domaine public affiche.

### Rediriger le domaine Vercel

Dans le projet Vercel:
1. `Settings`
2. `Domains`
3. editer `p-j-f-s-m1.vercel.app`
4. choisir `Redirect to Another Domain`
5. choisir `308 Permanent Redirect`
6. cible: `yumiscan.com`

### Ajouter `www`

Ajouter aussi `www.yumiscan.com` dans Vercel, puis configurer:
- `308 Permanent Redirect`
- vers `yumiscan.com`

Objectif:
- garder un seul domaine canonique public
- eviter le duplicate SEO

## 2. Variables a aligner apres le changement de domaine

Une fois `yumiscan.com` actif:

### Vercel

Definir les variables prod:
- `NUXT_PUBLIC_SITE_URL=https://yumiscan.com` si utilisee
- `NUXT_PUBLIC_SENTRY_ENVIRONMENT=production`
- `NUXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...`

### Supabase cloud

Secrets importants:
- `SITE_URL=https://yumiscan.com`
- `SENTRY_ENVIRONMENT=production`
- `STRIPE_SECRET=sk_live_...`
- `STRIPE_WEBHOOK_SECRET=whsec_...`

Note pricing Stripe:
- les `price_id` ne sont plus stockes en secrets
- ils sont geres en base via la table `pricing_offers`
- l'edition se fait depuis le back-office admin
- si le montant d'un pack change, creer un nouveau `price` dans Stripe puis mettre a jour l'offre dans le BO
- le webhook Stripe lit l'offre en base pour savoir combien de credits ajouter

### Supabase Authentication > URL Configuration

Une fois le domaine change, penser aussi a mettre a jour dans le dashboard Supabase:
1. `Authentication`
2. `URL Configuration`
3. `Site URL = https://yumiscan.com`
4. verifier que les `Redirect URLs` utiles sont bien presentes

Ce point est obligatoire pour que les liens auth pointent vers le bon domaine:
- confirmation d'inscription
- reset password
- changement d'email
- magic link

Si ce parametre reste sur l'ancien domaine `vercel.app`, les emails auth peuvent ouvrir le mauvais host avant redirection et casser l'experience utilisateur.

Redirect URLs minimales a autoriser, au moins pour les environnements actifs:
- `http://localhost:3000/login`
- `http://localhost:3000/auth/confirm`
- `http://127.0.0.1:3000/login`
- `http://127.0.0.1:3000/auth/confirm`
- `https://yumiscan.com/login`
- `https://yumiscan.com/auth/confirm`
- `https://www.yumiscan.com/login`
- `https://www.yumiscan.com/auth/confirm`
- `https://p-j-f-s-m1.vercel.app/login`
- `https://p-j-f-s-m1.vercel.app/auth/confirm`

Important:
- `supabase/config.toml` couvre le local uniquement
- pour la prod, ces URLs doivent aussi etre recopiees dans `Supabase Cloud > Authentication > URL Configuration`
- dans le flow actuel, il n'est pas necessaire d'utiliser une URL localisee (`/fr/login`, `/en/login`) tant que l'application redirige correctement apres hydration
- le reset mot de passe admin utilise `/login`
- les callbacks auth generiques sensibles (`email_change`, `magiclink`, `invite`) peuvent utiliser `/auth/confirm`

Pour le flow de changement d'email, l'application utilise une route dediee:
- `https://yumiscan.com/auth/confirm`

Cette page traite explicitement les callbacks Supabase de confirmation d'email avant d'afficher un succes ou, si necessaire, une demande de reconnexion propre.

Si l'option Supabase de changement d'email securise est activee, une confirmation supplementaire peut aussi etre demandee depuis l'adresse email actuelle. Le callback `/auth/confirm` gere le retour applicatif, mais la configuration Auth Supabase reste la source de verite sur ce comportement.

Point important pour le template `email_change`:
- ne pas utiliser `{{ .ConfirmationURL }}` si le bouton doit revenir dans l'app sur `/auth/confirm`
- utiliser un lien direct de la forme `{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=email_change`
- sinon Supabase consomme le token sur `/auth/v1/verify` puis redirige vers `/auth/confirm` sans `code` ni `token_hash`, ce qui produit l'erreur `Missing auth callback token`
- et ne pas verifier automatiquement le `token_hash` au chargement de `/auth/confirm` pour `email_change` : afficher d'abord un bouton de confirmation explicite, afin d'eviter qu'un apercu ou prefetch d'app mail consomme le lien a la place de l'utilisateur

## Session utilisateur

Objectif retenu cote produit:
- garder l'utilisateur connecte jusqu'a `10 jours` avant reconnexion demandee

Ce reglage se fait dans le dashboard Supabase:
1. `Authentication`
2. `Settings`
3. regler la duree JWT / session sur la valeur cible

Le front est prevu pour:
- persister la session
- tenter le refresh automatique
- ne pas deconnecter automatiquement sur simple timeout auth transitoire

### Sentry

Dans `Allowed Domains`, mettre:
- `yumiscan.com`
- optionnellement `p-j-f-s-m1.vercel.app` pendant la transition

Ne pas mettre:
- `https://yumiscan.com/*`
- `https://`
- de slash final

## 3. Creation du domaine Resend

### Pourquoi un sous-domaine dedie

Le sous-domaine recommande est `auth.yumiscan.com`.

Pourquoi:
- il separe clairement les emails transactionnels du domaine public principal
- il garde la racine `yumiscan.com` propre
- il simplifie SPF/DKIM et l'infra d'envoi

### Creation dans Resend

Dans Resend:
1. aller dans `Domains`
2. cliquer `Add Domain`
3. saisir:
   `auth.yumiscan.com`
4. valider

Resend affiche ensuite les enregistrements DNS a ajouter.

Typiquement, il y aura:
- un `TXT` DKIM
- un `TXT` SPF sur `send.auth`
- un `MX` sur `send.auth`
- un `TXT _dmarc` optionnel

## 4. Ajouter les DNS Resend dans Vercel

Dans Vercel:
1. `Domains`
2. cliquer sur `yumiscan.com`
3. `Manage DNS`
4. ajouter exactement les records fournis par Resend

Exemple de structure attendue:
- `TXT resend._domainkey.auth` -> cle DKIM fournie par Resend
- `TXT send.auth` -> SPF Resend
- `MX send.auth` -> `feedback-smtp....amazonses.com`, priorite `10`
- `TXT _dmarc` -> optionnel, par exemple `v=DMARC1; p=none;`

Important:
- le `MX send.auth` est necessaire
- le `TXT send.auth` et le `MX send.auth` doivent coexister
- ne pas remplacer l'un par l'autre

### A propos du popup "Wildcard Domain Override"

Vercel peut afficher un avertissement du type:
- creation d'un record specifique pour `send.auth`
- override du wildcard sous `auth.yumiscan.com`

Dans ce contexte, il faut confirmer.

Ce comportement est normal:
- on veut justement un enregistrement specifique pour `send.auth.yumiscan.com`

## 5. Verification du domaine dans Resend

Une fois les DNS en place:
1. retourner dans Resend
2. cliquer `Verify`
3. attendre la propagation DNS si necessaire

Le domaine doit ensuite passer en `Verified`.

Sans ce statut:
- l'envoi SMTP ne sera pas pret

## 6. Adresse d'envoi retenue

Adresse recommandee pour les emails auth:
- `noreply@auth.yumiscan.com`

Important:
- cette adresse n'a pas besoin d'etre une vraie boite mail de reception
- il s'agit d'une identite d'expedition

Ce qu'elle sert a faire:
- confirmation d'inscription
- reset password
- magic link
- changement d'email
- invitations

Ne pas l'utiliser pour:
- le support client humain
- les reponses de contact

## 7. Connexion de Resend dans Supabase Auth

Supabase cloud n'utilise pas `supabase/config.toml` pour le SMTP prod.
La configuration se fait dans le dashboard Supabase.

### Etapes

Dans Supabase:
1. ouvrir le projet cloud
2. aller dans `Authentication`
3. ouvrir `SMTP Settings`
4. activer `Custom SMTP`

Renseigner:
- `Sender name`: `YumiScan`
- `Sender email`: `noreply@auth.yumiscan.com`
- `Host`: `smtp.resend.com`
- `Port`: `587`
- `Username`: `resend`
- `Password`: cle API Resend

Le port `465` peut aussi fonctionner, mais `587` est le choix le plus standard.

### Templates email

Une fois le SMTP configure:
1. ouvrir `Authentication`
2. `Email Templates`
3. coller les templates du repo:
   - `supabase/templates/confirmation.html`
   - `supabase/templates/recovery.html`
   - `supabase/templates/email-change.html`
   - `supabase/templates/magic-link.html`
   - `supabase/templates/invite.html`

## 8. Difference entre email d'envoi et vraie boite mail

`noreply@auth.yumiscan.com`:
- sert a envoyer
- ne suppose pas une boite mail de lecture

`contact@yumiscan.com`:
- necessite une vraie boite mail chez un provider de messagerie
- n'est pas couverte par Resend seul

Tant qu'aucun provider mailbox n'est en place:
- ne pas afficher publiquement `contact@yumiscan.com`
- utiliser la page [contact.vue](/Users/adenankhachnane/Downloads/projet-full-stack/main/pages/contact.vue) comme point d'entree

## 9. Tally et future boite mail contact

Quand une vraie boite existera:
- utiliser `contact@yumiscan.com` pour recevoir les formulaires
- garder `noreply@auth.yumiscan.com` pour les emails transactionnels

Pour Tally:
- destination: `contact@yumiscan.com`
- `Reply-To`: email du prospect

## 10. Checklist finale

### Domaine Vercel
- [ ] `yumiscan.com` connecte au projet
- [ ] SSL actif
- [ ] `p-j-f-s-m1.vercel.app` redirige en `308` vers `yumiscan.com`
- [ ] `www.yumiscan.com` redirige en `308` vers `yumiscan.com`

### DNS Resend
- [ ] domaine `auth.yumiscan.com` cree dans Resend
- [ ] DKIM ajoute dans Vercel
- [ ] SPF ajoute dans Vercel
- [ ] MX `send.auth` ajoute dans Vercel
- [ ] Resend affiche `Verified`

### Supabase SMTP
- [ ] SMTP custom active
- [ ] sender `noreply@auth.yumiscan.com`
- [ ] host `smtp.resend.com`
- [ ] username `resend`
- [ ] password = cle API Resend
- [ ] templates HTML colles dans le dashboard

### URLs prod
- [ ] `SITE_URL=https://yumiscan.com`
- [ ] callbacks Stripe en `https://yumiscan.com`
- [ ] canonical/SEO alignes sur `yumiscan.com`

## 11. Troubleshooting

### Le domaine Resend ne passe pas en verified

Verifier en priorite:
- que le `MX send.auth` est bien present
- que les noms de records sont exacts
- qu'il n'y a pas d'erreur de copie de valeur
- que la propagation DNS a eu le temps de se faire

### Supabase continue d'envoyer avec l'ancien provider

Verifier:
- que le SMTP custom est bien active dans le dashboard
- que `Sender email` est bien `noreply@auth.yumiscan.com`
- que les templates ont bien ete remplaces

### Les utilisateurs repondent a `noreply`

C'est normal si l'adresse est `noreply@...`.
Pour du support humain, il faudra plus tard une vraie boite `contact@yumiscan.com`.
