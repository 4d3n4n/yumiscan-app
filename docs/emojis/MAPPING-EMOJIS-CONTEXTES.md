# Emojis — reference d'usage

Reference des emojis custom du projet et de leurs conventions d'usage.

Source de verite code:

- [utils/emojis.ts](/Users/adenankhachnane/Downloads/projet-full-stack/main/utils/emojis.ts)
- assets reels: `public/images/emojis/*.webp`

## Inventaire

| Fichier | Cle |
|---|---|
| `angry.webp` | `angry` |
| `asking.webp` | `asking` |
| `broken.webp` | `broken` |
| `geek.webp` | `geek` |
| `happy.webp` | `happy` |
| `hi.webp` | `hi` |
| `laughing.webp` | `laughing` |
| `sad.webp` | `sad` |
| `sleeping.webp` | `sleeping` |
| `smile.webp` | `smile` |
| `surprised.webp` | `surprised` |
| `thinking.webp` | `thinking` |
| `thumbs-up.webp` | `thumbs-up` |

## Conventions applicatives

### `APP_EMOJI`

| Cle | Emoji | Usage |
|---|---|---|
| `emptyScan` | `sleeping` | etat vide |
| `noCredits` | `sad` | credits epuises |
| `scanError` | `broken` | erreur scan / erreur technique |
| `login` | `smile` | auth / connexion requise |
| `loginError` | `angry` | erreur auth |
| `notFound` | `asking` | 404 / introuvable |
| `serverError` | `broken` | erreur serveur |
| `success` | `happy` | succes generique |
| `checkoutError` | `angry` | erreur checkout / paiement |
| `destructiveWarning` | `surprised` | action irreversible |
| `allergenDetected` | `surprised` | alerte allergene |

### `STATUS_EMOJIS`

| Statut | Emoji |
|---|---|
| `ok` | `happy` |
| `contains_allergen` | `surprised` |
| `ambiguous` | `thinking` |

## Regles d'usage

- utiliser `APP_EMOJI` pour les contextes fonctionnels recurrents
- utiliser `STATUS_EMOJIS` pour les statuts scan
- ne pas dupliquer des cles semantiques directement dans les composants si une constante existe deja

## Composant recommande

Pour afficher un emoji:

- preferer [components/ui/AppEmoji.vue](/Users/adenankhachnane/Downloads/projet-full-stack/main/components/ui/AppEmoji.vue)
- ou utiliser `EMOJI_MAP` si un `img` direct est vraiment necessaire

## Maintenance

Si un nouvel emoji ou un nouveau contexte recurrent est ajoute:

1. mettre a jour `utils/emojis.ts`
2. mettre a jour ce document
3. reutiliser une cle semantique plutot qu'une chaine brute dans les composants

Ce fichier est une reference design/implementation. Il ne decrit plus de backlog ni de propositions non realisees.
