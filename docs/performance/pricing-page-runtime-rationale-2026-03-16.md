# Pricing Page Runtime Rationale

Date: 2026-03-16

## Objet

Formaliser la decision produit/architecture de sortir le pricing de la home et de creer une vraie page `/pricing`.

Cette note est rattachee a la passe performance `1.5.3`, car la page pricing dediee ameliore a la fois:

- la clarte UX
- la stabilite SSR/hydration
- la lisibilite SEO
- la strategie de cache
- la source de verite des offres et du checkout

## Decision

Decision recommandee:

- garder un bloc pricing court sur la home, oriente conversion
- creer une page canonique `/pricing`
- faire de `/pricing` la source de verite UI pour les offres, les moyens de paiement, les details produit et la FAQ achat
- utiliser la home comme resume et point d'entree, pas comme page complete de tarification

## Pourquoi c'est meilleur pour la performance

### 1. Moins de fragilite que le hash `#pricing`

Aujourd'hui, une partie de la navigation pricing depend:

- d'une ancre `#pricing`
- du scroll post-navigation
- du hash client
- d'un contenu home qui peut encore bouger pendant le rendu

Cela ajoute de la complexite sur:

- l'hydration SSR/client
- les corrections de scroll
- les revalidations au retour visible

Avec une vraie page `/pricing`:

- plus besoin de navigation hash fragile comme source principale
- moins de mismatch potentiel entre SSR et client
- moins de code special pour corriger le scroll

### 2. Cache plus propre

Une page dediee permet un modele plus simple:

- cache pricing concentre sur une seule route canonique
- revalidation legere quand `/pricing` revient visible
- pas besoin de coupler la logique pricing au reste de la home si l'utilisateur vient juste voir les tarifs

Cela clarifie aussi la logique actuelle:

- home: resume pricing
- `/pricing`: details pricing + FAQ + paiements + CTA checkout

### 3. Checkout plus lisible

Le checkout embedded ou les CTA d'achat vivent mieux sur une page dediee que dans une section profonde de home:

- moins de risque de contexte UI stale
- moins de conflit avec le scroll et les anchors
- meilleure lisibilite des etats de chargement

## Pourquoi c'est meilleur pour le produit

### 1. Scope plus clair

La home doit vendre vite.

La page `/pricing` peut expliquer sans bruit:

- le fonctionnement du scan IA
- ce que fait l'Assistant IA
- ce qu'achetent exactement les credits
- les moyens de paiement acceptes
- les questions frequentes avant achat

### 2. Meilleure promesse utilisateur

Une page pricing dediee permet d'eviter deux ecueils:

- surcharger la home
- laisser un pricing trop court pour rassurer avant achat

### 3. SEO plus propre

Une route `/pricing` donne:

- une cible claire pour les liens internes
- une page plus facile a indexer sur l'intention achat
- une separation plus nette entre acquisition home et conversion pricing

## Contenu recommande pour `/pricing`

### Sections

1. Hero pricing
- titre clair
- promesse simple
- CTA principal

2. Plans / credits
- offres
- prix normal
- prix remises si presentes
- nombre de credits

3. Fonctionnalites incluses
- Scan IA
- Assistant IA
- historique des scans
- usage mobile / PWA

4. Paiement et confiance
- cartes bancaires
- Apple Pay
- Google Pay
- Klarna
- Revolut Pay
- ligne de reassurance: `Paiement securise via Stripe`

5. FAQ achat
- credits: comment ca marche
- expiration des credits si applicable
- difference entre scan IA et Assistant IA
- quels moyens de paiement sont acceptes

## FAQ paiement a inclure

Question recommandee:

- `Quels moyens de paiement sont acceptes ?`

Reponse recommandee:

- `Vous pouvez payer avec les moyens disponibles via notre checkout securise Stripe, comme les cartes bancaires, Apple Pay, Google Pay, Klarna ou Revolut Pay selon votre appareil, votre pays et leur disponibilite au moment du paiement.`

Micro-ligne conseillee:

- `Le paiement est securise et traite par Stripe.`

## Impact sur l'architecture front

Direction recommandee:

- le menu `Tarifs` doit pointer vers `/pricing`
- la home peut garder un bloc pricing simplifie avec CTA vers `/pricing`
- les donnees pricing doivent venir de la meme source de cache/query pour home et `/pricing`
- la page `/pricing` devient l'endroit principal pour les refreshs pricing foreground

## Checklist de mise en oeuvre

- [x] Creer la route `/pricing`
- [x] Conserver un bloc pricing simplifie sur la home
- [x] Faire pointer la navigation `Tarifs` vers `/pricing`
- [x] Deplacer la FAQ achat dans `/pricing`
- [x] Ajouter la question FAQ sur les moyens de paiement acceptes
- [x] Ajouter une section moyens de paiement textuelle, en attente des logos verifies
- [x] Expliquer `Scan IA` et `Assistant IA` sur la page
- [x] Garder une source de verite unique pour les offres et le checkout
- [x] Recentrer la navigation pricing sur `/pricing`, tout en gardant la compatibilite `#pricing`

## Conclusion

La page `/pricing` dediee n'est pas seulement un choix marketing.

C'est aussi une simplification runtime utile:

- moins de logique de hash fragile
- moins de couplage entre home et checkout
- meilleur decoupage cache/navigation
- meilleure base pour une UX d'achat stable et lisible

## Note d'implementation

Lors de l'implementation, un reliquat de configuration Nuxt redirigeait encore `/pricing` vers `/#pricing`.

Le fix propre a ete:

- suppression de la `routeRule` legacy dans [nuxt.config.ts](/Users/adenankhachnane/Downloads/projet-full-stack/main/nuxt.config.ts)
- chargement explicite de `fr/pricing.json` et `en/pricing.json` dans la config i18n runtime

Ce point est important: un composant front peut etre correct, mais une redirection globale dans `nuxt.config.ts` peut neutraliser totalement la route canonique attendue.
