# Pipeline du Scan — Explication Complete pour l'Oral

## But de la pipeline
Le but de la pipeline est de transformer une photo d'etiquette japonaise en un resultat clair pour un voyageur qui ne sait pas lire le japonais :
- ingredients compris
- allergenes potentiels identifies
- verdict final simple : compatible, ambigu ou a risque

## Idee generale
La logique n'est pas "photo -> OCR -> reponse".
La vraie logique est :
1. verifier que la photo est exploitable
2. extraire un texte brut
3. corriger ce texte
4. reconstruire la vraie structure des ingredients
5. analyser les ingredients un par un
6. afficher des resultats progressivement
7. finaliser le scan de maniere transactionnelle

## Avant les phases IA
Avant d'entrer dans la pipeline, le backend :
- authentifie l'utilisateur
- verifie qu'il a le droit de scanner
- decode et valide l'image
- compresse l'image selon les besoins des phases
- charge le contexte allergenes selectionne par l'utilisateur

## Phase 0 — Gatekeeper + draft OCR
C'est la premiere vraie phase metier.

### Role
Verifier qu'on est bien face a une image d'ingredients exploitable avant de depenser plus de temps et de cout IA.

### Ce que fait la phase 0
- lance un OCR Cloud Vision sur l'image originale
- reconstruit le texte caractere par caractere pour mieux conserver les signes japonais
- envoie ce texte brut a Gemini
- demande a Gemini de verifier que l'image correspond bien a une liste d'ingredients
- demande un premier `raw_text_draft`
- controle qu'il n'y a pas de signal de prompt injection
- verifie que le texte extrait n'est ni vide ni trop court

### Idee orale
"La phase 0 sert de filtre intelligent : elle verifie qu'on a bien une vraie etiquette d'ingredients, extrait un premier texte et bloque tres tot les cas inutiles ou suspects."

## Phase 0.5 — Auditor / Corrector
Cette phase prend le brouillon produit par la phase 0 et le fiabilise.

### Role
Obtenir un texte plus propre, plus stable et plus proche de la vraie etiquette.

### Ce que fait la phase 0.5
- prend l'image originale compressee
- prend aussi l'image traitee par le front si elle existe
- reutilise le `raw_text_draft`
- reutilise aussi l'OCR brut de Vision comme reference
- demande a Gemini de corriger et consolider le texte
- produit un `certified_raw_text`

### Idee orale
"La phase 0.5 sert d'auditeur : elle corrige le brouillon OCR pour produire une version certifiee plus fiable avant le parsing."

## Phase 0.9 — Structural Repair conditionnelle
Cette phase n'est pas toujours lancee.

### Role
Reparer certains textes mal structures avant le parsing.

### Condition de declenchement
Elle est appelee seulement si le texte certifie a des parentheses desequilibrees.

### Ce que fait la phase 0.9
- prend le texte casse
- reutilise l'image originale
- reutilise aussi l'image traitee si disponible
- demande a Gemini de reparer la structure
- renvoie un `repaired_text`

### Idee orale
"La phase 0.9 est un filet de securite. Elle n'est lancee que si la structure semble cassée, par exemple avec des parentheses incoherentes."

## Nettoyage avant parsing
Avant le vrai parsing, le backend fait encore un travail deterministe.

### Ce qu'il fait
- retire les blocs nutritionnels
- supprime les retours ligne parasites
- normalise la ponctuation japonaise
- prepare une version propre pour la tokenisation

### Pourquoi
Le parsing doit travailler sur un texte ingredients-only, sans bruit.

## Extraction de la ligne "contains"
Le pipeline isole aussi les mentions du type `一部に...を含む`.

### Role
Recuperer les indices allergenes explicites presents sur l'etiquette.

### Important
La mention est detectee et ses tokens sont extraits, mais elle reste aussi visible dans le texte pour ne pas casser la structure de la liste.

## Phase 1 — Parsing arborescent
Ici, on ne fait plus seulement de la lecture, on reconstruit la logique de composition.

### Role
Transformer le texte en arbre d'ingredients et sous-ingredients.

### Ce que fait la phase 1
- tokenize le texte avec des separateurs japonais
- respecte les parenthèses pour gerer les sous-compositions
- cree une arborescence avec ids stables
- separe les ingredients principaux et les ingredients enfants

### Pourquoi c'est critique
Une etiquette japonaise contient souvent des ingredients composes. Il faut comprendre la structure pour ne pas rater un allergene cache dans un sous-ingredient.

## Flatten de l'arbre
Une fois l'arbre cree, il est aplati temporairement.

### Role
Permettre une analyse ingredient par ingredient, tout en gardant la possibilite de reconstruire l'arbre plus tard.

### Ce que fait cette etape
- transforme les noeuds de l'arbre en liste plate
- conserve l'ordre
- conserve les ids pour rattacher ensuite les resultats a l'arbre d'origine

## Creation immediate du scan en base
Une fois les phases de base terminees, le backend cree tout de suite un scan en base.

### Ce qu'il enregistre
- `processing_status = processing`
- un `result_json` initial front-safe
- la progression de batch a `0`
- les phases deja completes

### Pourquoi c'est important
Le front recoit vite un `scan_id` et peut afficher une page de scan vivante pendant que le reste du traitement continue en arriere-plan.

## Traitement progressif par batchs
La suite du pipeline travaille sur la liste plate d'ingredients.

### Organisation
- batchs de taille configurable (defaut 8 ingredients)
- jusqu'a 2 batchs en parallele

### Pourquoi
- mieux controler le cout
- accelerer le temps percu
- faire remonter des resultats partiels progressivement

## Phase 1.5 — Traduction / normalisation
Chaque batch passe d'abord par une phase de traduction.

### Role
Transformer chaque ingredient brut en forme lisible et normalisee.

### Ce que fait la phase 1.5
- prend les textes ingredients du batch
- appelle Gemini
- renvoie des items traduits / normalises

### Interet
Cette phase prepare la suite. Elle ne classe pas encore, elle rend les ingredients interpretables.

## Phase 1.7 — Mapping deterministe des allergenes
Apres traduction, le pipeline tente d'abord une detection sans IA generative supplementaire.

### Role
Comparer chaque ingredient a une base metier d'allergenes deja connue.

### Ce que fait la phase 1.7
- separe les mots-cles japonais et latins
- cherche des correspondances dans le texte brut et dans la traduction
- confirme certains cas avec logique deterministe
- sort deux groupes :
  - ingredients deja identifies comme allergenes
  - ingredients encore non resolus

### Idee orale
"Avant de demander a l'IA de raisonner, on elimine d'abord tous les cas evidents avec des regles metier."

## Phase 2 — Classification IA
Seuls les ingredients qui restent non resolus passent dans cette phase.

### Role
Interpreter les cas ambigus ou plus difficiles.

### Ce que fait la phase 2
- envoie les ingredients non maps a Gemini
- renvoie trois categories metier :
  - `ok`
  - `ambiguous`
  - `contains_allergen`

### Important
Le systeme limite ainsi l'usage de l'IA aux cas qui en ont vraiment besoin.

## Persistance progressive des resultats
Apres chaque batch termine, le backend met a jour le scan en base.

### Ce qui est persiste
- ingredients deja classes
- progression batch par batch
- phases completes cote front

### Effet cote utilisateur
L'utilisateur voit les ingredients apparaitre petit a petit au lieu d'attendre un ecran bloque.

## Phase 7 — Reconstruction finale
Quand tous les batchs sont finis, le backend reconstruit l'arbre final.

### Role
Remettre les ingredients classes dans leur structure d'origine.

### Ce que fait la phase 7
- rattache chaque ingredient classe a son noeud d'origine
- remonte les statuts dans les sous-ingredients
- calcule le statut global du produit
- construit le payload final front-safe

## Finalisation transactionnelle du scan
Une fois le resultat final calcule, le backend ne se contente pas de sauvegarder le resultat.

### Ce qu'il fait
- appelle la RPC `consume_scan_credit_and_finalize_scan`
- finalise le scan
- consomme le bon type de credit
- ecrit le resultat final
- ecrit aussi le debug en base si le mode debug est active

### Pourquoi c'est important
Le credit n'est pas "perdu" en plein milieu. La finalisation est atomique.

## Stockage de l'image
Apres la finalisation, le backend tente aussi de stocker l'image du scan dans Supabase Storage.

### Role
Conserver la preuve image pour l'historique et le detail scan.

### Important
Si l'upload image echoue, le scan final reste valide. L'echec de stockage n'annule pas le resultat.

## Ce que voit le front
Le front ne voit pas toute la complexite interne.

### Il voit surtout
- un `scan_id` rapide
- un statut `processing`
- une progression
- des ingredients qui remontent progressivement
- puis un resultat final simplifie

Le debug detaille reste cote backend / admin.

## Pourquoi cette pipeline est forte
Cette pipeline combine :
- OCR
- verification metier
- garde anti prompt injection
- correction
- reparation structurelle si besoin
- parsing arborescent
- traduction
- mapping deterministe
- classification IA
- persistance progressive
- finalisation transactionnelle

Donc, ce n'est pas une simple traduction d'etiquette.
C'est une vraie chaine d'interpretation produit.

## Version courte pour l'oral
"La pipeline de YumiScan commence par verifier que la photo est bien une vraie etiquette d'ingredients et qu'elle ne contient pas de contenu suspect. Ensuite elle extrait un texte brut, le corrige, repare sa structure si besoin, reconstruit l'arbre des ingredients, puis analyse les ingredients par petits lots. Les cas evidents sont traites par des regles deterministes, les cas plus ambigus par l'IA, puis le systeme reconstruit un resultat final simple et finalise le credit de facon transactionnelle."

## Idee-clé a faire passer
"La valeur de YumiScan vient du fait que le systeme comprend et interprete une etiquette japonaise complexe, au lieu de simplement la lire ou la traduire mot a mot."
