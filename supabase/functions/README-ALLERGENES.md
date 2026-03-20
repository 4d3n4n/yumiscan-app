# Allergenes — schema, seed et usage

Ce document decrit l'etat reel du catalogue d'allergenes utilise par le front et par `food-scan-analyze`.

## Source de verite

- schema: [supabase/migrations/20250226000000_schema.sql](/Users/adenankhachnane/Downloads/projet-full-stack/main/supabase/migrations/20250226000000_schema.sql)
- seed: [supabase/migrations/seed-complet-allergenes.sql](/Users/adenankhachnane/Downloads/projet-full-stack/main/supabase/migrations/seed-complet-allergenes.sql)
- types: [types/supabase.ts](/Users/adenankhachnane/Downloads/projet-full-stack/main/types/supabase.ts)

## Table `allergens`

Colonnes importantes:

- `id`
- `name`
- `name_en`
- `slug`
- `ingredients`
- `ingredients_en`

Le trigger SQL dedoublonne et nettoie les tableaux `ingredients` et `ingredients_en`.

## Utilisation front

Le front charge le catalogue pour:

- l'inscription
- la page compte
- l'overlay de scan
- le detail de scan

Helpers:

- [utils/allergens.ts](/Users/adenankhachnane/Downloads/projet-full-stack/main/utils/allergens.ts)

## Utilisation backend

L'Edge Function [food-scan-analyze/index.ts](/Users/adenankhachnane/Downloads/projet-full-stack/main/supabase/functions/food-scan-analyze/index.ts) lit:

- `name` / `name_en` pour renvoyer le nom dans la langue du scan
- `ingredients` / `ingredients_en` pour le mapping deterministe des allergenes

La langue est passee par le front dans le payload du scan (`fr` ou `en`).

## Mise a jour du catalogue

1. modifier le seed ou le schema si necessaire
2. appliquer les migrations
3. regenerer les types:

```bash
npm run gen:types
```

## Secrets

Le catalogue allergenes ne demande pas de secret specifique.
Le scan complet depend par contre de:

- `GEMINI_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

## Important

L'ancien document sur une fonction `allergenes-scan` n'est plus d'actualite.
La logique active vit dans `food-scan-analyze` et dans la table `allergens`.
