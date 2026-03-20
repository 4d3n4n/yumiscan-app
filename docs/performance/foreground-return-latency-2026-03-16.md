# Foreground Return Latency Review

Date: 2026-03-16

## Objet

Analyser pourquoi le retour sur l'app apres suspension ou apres avoir quitte Safari, Chrome ou la PWA provoque un temps de chargement perceptible sur:

- `/`
- `/app/dashboard`
- `/app/scan/[id]`
- `/app/account`

Cette note repond aussi a deux questions produit/techniques:

1. faut-il deplacer la session ou une partie du cache dans des cookies
2. le cache doit-il surtout vivre en mode "download once + invalider sur evenement"

## Resume

Le ralentissement percu ne vient pas principalement de la perte de session auth.

Le cout visible vient surtout de la combinaison suivante:

- revalidations au retour visible (`visibilitychange`, `pageshow`, remount)
- regeneration des signed URLs pour les images privees
- queries qui refetchent alors que l'UI masque tout avec un loader global
- invalidations necessaires pour les donnees qui peuvent changer hors du tab courant

En pratique, le navigateur peut reprendre la page dans trois etats tres differents:

1. page intacte en memoire
2. page suspendue puis reactivee
3. page discardee puis reconstruite presque comme un cold start

Notre code couvre correctement la coherence de donnees, mais il reste trop conservateur sur l'UX percue: certaines pages cachent l'ancien contenu pendant la revalidation au lieu de le conserver.

## Reponse courte

### Session en cookies

Oui, c'est possible pour certains usages auth, mais ce n'est pas la bonne reponse principale a ce bug de perf.

Pourquoi:

- le ralentissement observe n'est pas surtout provoque par `getSession()`
- le vrai cout vient des refetchs de data, de la regeneration des signed URLs et des loaders plein ecran
- pour les signed URLs privees, les cookies sont une mauvaise surface de cache

### Cache pilote par evenement

Oui, c'est la bonne direction de fond.

Mais dans ce projet on a besoin d'un mode hybride:

- cache instantane pour afficher quelque chose tout de suite
- invalidation par evenement quand on controle la cause
- revalidation legere au retour visible pour les changements externes ou asynchrones

Une architecture uniquement event-driven ne suffit pas, car certaines donnees changent sans evenement local fiable:

- scan termine cote backend
- achat Stripe finalise hors de l'ecran courant
- email ou profil mis a jour dans un autre navigateur
- pricing change par un admin dans une autre session
- page discardee par le navigateur

## Ce qui existe deja dans le repo

### 1. Cache de queries structurees

Le runtime TanStack persist les queries importantes via IndexedDB avec TTL et politique par type de donnee.

Voir:

- [plugins/vue-query.ts](/Users/adenankhachnane/Downloads/projet-full-stack/main/plugins/vue-query.ts)
- [utils/query-cache.ts](/Users/adenankhachnane/Downloads/projet-full-stack/main/utils/query-cache.ts)

Points utiles:

- `user-scans` est persiste avec `revalidateOnRestore: true`
- `scan-detail`, `user-profile`, `credits`, `entitlements` ont aussi des regles dediees
- les payloads prives sont sanitizes avant persistence

Donc le projet a deja un vrai cache de donnees metier.

### 2. Invalidation par evenement metier

Le projet invalide deja certaines donnees quand une action applicative est connue.

Voir:

- [composables/useAppDataInvalidation.ts](/Users/adenankhachnane/Downloads/projet-full-stack/main/composables/useAppDataInvalidation.ts)

Exemples:

- `scan_started`
- `scan_finished`
- `scan_failed`
- `scan_deleted`
- `credits_purchased`
- `profile_updated`
- `allergens_updated`

Donc oui: une partie du systeme suit deja la philosophie "refetch seulement quand un evenement l'exige".

### 3. Cache des images signees

Les URLs signees des images privees vivent dans un cache en memoire utilisateur avec expiration.

Voir:

- [composables/useScanImageSessionCache.ts](/Users/adenankhachnane/Downloads/projet-full-stack/main/composables/useScanImageSessionCache.ts)

Points utiles:

- scope par user
- expiration derivee de `expiresIn`
- purge au changement d'utilisateur
- aucune persistence durable volontaire

Ce choix est securitairement plus sain que `localStorage`, mais il rend la reprise plus couteuse si la page a ete discardee ou si les URLs ont expire.

## Pourquoi les cookies ne sont pas la bonne cible

### Pour l'auth

Supabase peut fonctionner avec une strategie de cookie selon le mode d'integration.

Mais dans ce repo, la logique qui coute du temps au retour visible est surtout:

- `resolveAuthenticatedSession()`
- `getUser()`
- parfois `refreshSession()`

Voir:

- [composables/useAuth.ts](/Users/adenankhachnane/Downloads/projet-full-stack/main/composables/useAuth.ts)
- [utils/supabase-auth.ts](/Users/adenankhachnane/Downloads/projet-full-stack/main/utils/supabase-auth.ts)

Mettre la session auth dans un cookie ne supprimera pas:

- les revalidations au foreground
- les queries Vue Query
- la regeneration des miniatures signees
- les loaders plein ecran qui remplacent le contenu

Donc: possible, mais faible ROI pour ce bug precis.

### Pour le cache media prive

Stocker les signed URLs en cookies serait une mauvaise idee.

Pourquoi:

- taille limitee
- cookies envoyes sur chaque requete HTTP
- JS doit pouvoir les lire, donc pas `HttpOnly`
- peu adaptes a des dizaines d'URLs expirees rapidement
- surface plus bruyante pour des URLs privees temporaires

Pour les images privees, un cache memoire ou IndexedDB d'entrees metier est plus adapte qu'un cookie.

## Causes confirmees par page

### `/app/dashboard`

Causes principales:

- refetch force au mount: [pages/app/dashboard.vue](/Users/adenankhachnane/Downloads/projet-full-stack/main/pages/app/dashboard.vue#L130)
- refetch a chaque `visibilitychange`: [pages/app/dashboard.vue](/Users/adenankhachnane/Downloads/projet-full-stack/main/pages/app/dashboard.vue#L275)
- refetch du query `user-scans` avec `refetchOnMount: 'always'`: [pages/app/dashboard.vue](/Users/adenankhachnane/Downloads/projet-full-stack/main/pages/app/dashboard.vue#L164)
- regeneration des signed URLs pour toutes les miniatures non presentes: [pages/app/dashboard.vue](/Users/adenankhachnane/Downloads/projet-full-stack/main/pages/app/dashboard.vue#L332)
- loader skeleton si la query repart en loading: [pages/app/dashboard.vue](/Users/adenankhachnane/Downloads/projet-full-stack/main/pages/app/dashboard.vue#L541)

Effet percu:

- on revalide la liste
- puis on resigne potentiellement plusieurs miniatures
- le dashboard re-rentre dans un etat visuel "chargement"

### `/app/account`

Causes principales:

- refresh auth au mount: [pages/app/account.vue](/Users/adenankhachnane/Downloads/projet-full-stack/main/pages/app/account.vue#L175)
- refresh auth au `pageshow` et `visibilitychange`: [pages/app/account.vue](/Users/adenankhachnane/Downloads/projet-full-stack/main/pages/app/account.vue#L32)
- queries profile, allergens, entitlements, app-config relancees selon l'etat auth: [pages/app/account.vue](/Users/adenankhachnane/Downloads/projet-full-stack/main/pages/app/account.vue#L184)
- la page masque tout avec un spinner si `profileLoading` est vrai: [pages/app/account.vue](/Users/adenankhachnane/Downloads/projet-full-stack/main/pages/app/account.vue#L283)

Effet percu:

- meme si on a deja des donnees locales valides, l'ecran entier peut disparaitre pendant la verification
- c'est la source la plus "UX-hostile" du lot

### `/app/scan/[id]`

Causes principales:

- query scan detail au chargement: [pages/app/scan/[id].vue](/Users/adenankhachnane/Downloads/projet-full-stack/main/pages/app/scan/%5Bid%5D.vue#L93)
- fetch secondaire des noms d'allergenes: [pages/app/scan/[id].vue](/Users/adenankhachnane/Downloads/projet-full-stack/main/pages/app/scan/%5Bid%5D.vue#L113)
- regeneration de la signed URL image detail si besoin: [pages/app/scan/[id].vue](/Users/adenankhachnane/Downloads/projet-full-stack/main/pages/app/scan/%5Bid%5D.vue#L174)
- skeleton plein ecran si `isLoading` repart a `true`: [pages/app/scan/[id].vue](/Users/adenankhachnane/Downloads/projet-full-stack/main/pages/app/scan/%5Bid%5D.vue#L449)

Effet percu:

- si la page a ete discardee, le detail repart presque comme un chargement neuf
- l'image produit renforce la perception de lenteur

### `/`

Cause principale:

- revalidation du pricing au retour visible: [components/home/HomePricing.vue](/Users/adenankhachnane/Downloads/projet-full-stack/main/components/home/HomePricing.vue#L185)

Impact:

- faible a modere
- ce n'est pas la source principale des 2 secondes, sauf si le navigateur a vraiment jete la page

## Ce que le cache devrait faire ici

Le but du cache n'est pas juste "telecharger une fois puis refetch a chaque retour".

Le bon objectif est:

1. afficher instantanement le dernier etat fiable
2. invalider sur evenement metier quand on connait la cause
3. revalider discretement en arriere-plan seulement quand necessaire
4. eviter de cacher toute l'UI si on a deja un etat precedent exploitable

Autrement dit:

- `new scan`, `suppression`, `update profil`, `achat`: oui, evenement -> invalidation directe
- retour d'onglet ou reprise PWA: seulement une revalidation legere, pas une remise a zero visuelle
- signed URLs: garder le visuel precedent si possible, puis resigner en fond

## Pourquoi l'invalidation par evenement seule ne suffit pas

Elle ne couvre pas:

- changement effectue depuis un autre navigateur
- changement admin cote back-office
- scan termine en asynchrone cote backend
- reprise apres discard navigateur
- expiration naturelle d'une signed URL

Donc le systeme doit rester hybride:

- invalidation evenementielle quand on sait
- revalidation de securite au retour visible, mais parcimonieuse

## Recommandation d'architecture

### 1. Garder la session auth telle quelle

Decision recommandee:

- ne pas migrer ce sujet vers des cookies comme solution principale du bug

Raison:

- faible gain percu sur cette latence
- complexite et risques supplementaires
- le bottleneck principal est ailleurs

### 2. Conserver le modele event-driven pour les donnees metier

Decision recommandee:

- continuer a invalider sur `scan_started`, `scan_finished`, `scan_deleted`, `credits_purchased`, etc.

Raison:

- c'est deja la bonne base
- elle reduit les refetchs inutiles

### 3. Revalidation au foreground uniquement en mode soft

Decision recommandee:

- pas de full-screen loader si on a deja des donnees
- utiliser le stale data + background refresh
- appliquer un cooldown pour eviter `pageshow` + `visibilitychange` successifs

### 4. Pour les images privees

Decision recommandee:

- ne pas passer par cookies
- garder un cache memoire ou metadonnees persistantes si necessaire
- conserver l'image precedente visible pendant la resignation

## Plan de correction cible

### Priorite 1

- `/app/account`: ne plus bloquer tout l'ecran sur `profileLoading` si un profil precedent existe
- `/app/dashboard`: garder la liste precedente visible pendant `refetchScans()`
- `/app/scan/[id]`: garder le detail precedent visible pendant revalidation si l'ID n'a pas change

### Priorite 2

- dedoublonner les triggers `pageshow` / `visibilitychange`
- ajouter un cooldown centralise de revalidation foreground
- limiter la resignation simultanee des miniatures dashboard

### Priorite 3

- event bus local pour eviter certains refetchs de securite redondants entre composables
- event explicite "pricing-updated" pour cross-layout plus propre

## Verdict

Oui, ton intuition sur le cache est bonne:

- on doit privilegier le cache + invalidation par evenement
- on ne doit pas refetch lourdement "juste parce qu'on revient sur l'app"

Mais:

- les cookies ne sont pas la bonne reponse principale ici
- le vrai chantier est de rendre la reprise "stale-while-revalidate" au lieu de "hide-then-refetch"

Le bug de perf actuel est surtout un probleme de strategie de reprise UI, pas un probleme de persistance de session.
