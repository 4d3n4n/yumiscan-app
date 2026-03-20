# Documentation YumiScan

Ce dossier sert de point d'entree documentaire pour comprendre rapidement le projet, l'architecture, le scan, l'admin, la CI et la securite.

## Ordre de lecture recommande

1. [README.md](/Users/adenankhachnane/Downloads/projet-full-stack/main/README.md)
2. [ARCHITECTURE-TECHNIQUE.md](/Users/adenankhachnane/Downloads/projet-full-stack/main/docs/ARCHITECTURE-TECHNIQUE.md)
3. [pipeline-scan-yumiscan.md](/Users/adenankhachnane/Downloads/projet-full-stack/main/pipeline-scan-yumiscan.md)
4. [admin/README.md](/Users/adenankhachnane/Downloads/projet-full-stack/main/docs/admin/README.md)
5. [testing/TESTS-UNITAIRES.md](/Users/adenankhachnane/Downloads/projet-full-stack/main/docs/testing/TESTS-UNITAIRES.md)

## Par besoin

### Comprendre le produit et le code

- [README.md](/Users/adenankhachnane/Downloads/projet-full-stack/main/README.md)
- [ARCHITECTURE-TECHNIQUE.md](/Users/adenankhachnane/Downloads/projet-full-stack/main/docs/ARCHITECTURE-TECHNIQUE.md)
- [pipeline-scan-yumiscan.md](/Users/adenankhachnane/Downloads/projet-full-stack/main/pipeline-scan-yumiscan.md)
- [releases/1.5.6.md](/Users/adenankhachnane/Downloads/projet-full-stack/main/docs/releases/1.5.6.md)
- [releases/1.5.3.md](/Users/adenankhachnane/Downloads/projet-full-stack/main/docs/releases/1.5.3.md)
- [releases/1.5.4.md](/Users/adenankhachnane/Downloads/projet-full-stack/main/docs/releases/1.5.4.md)
- [releases/1.5.5.md](/Users/adenankhachnane/Downloads/projet-full-stack/main/docs/releases/1.5.5.md)
- [releases/1.5.1.md](/Users/adenankhachnane/Downloads/projet-full-stack/main/docs/releases/1.5.1.md)
- [releases/1.5.2.md](/Users/adenankhachnane/Downloads/projet-full-stack/main/docs/releases/1.5.2.md)

### Comprendre le scan

- [pipeline-scan-yumiscan.md](/Users/adenankhachnane/Downloads/projet-full-stack/main/pipeline-scan-yumiscan.md)
- [supabase/functions/README-ALLERGENES.md](/Users/adenankhachnane/Downloads/projet-full-stack/main/supabase/functions/README-ALLERGENES.md)

### Comprendre l'admin

- [admin/README.md](/Users/adenankhachnane/Downloads/projet-full-stack/main/docs/admin/README.md)

### Comprendre la qualite et la CI

- [testing/TESTS-UNITAIRES.md](/Users/adenankhachnane/Downloads/projet-full-stack/main/docs/testing/TESTS-UNITAIRES.md)
- [ci-cd/README.md](/Users/adenankhachnane/Downloads/projet-full-stack/main/docs/ci-cd/README.md)
- [ci-cd/PROCEDURE-CI-YML.md](/Users/adenankhachnane/Downloads/projet-full-stack/main/docs/ci-cd/PROCEDURE-CI-YML.md)

### Comprendre la performance runtime

- [performance/README.md](/Users/adenankhachnane/Downloads/projet-full-stack/main/docs/performance/README.md)
- [performance/foreground-return-latency-2026-03-16.md](/Users/adenankhachnane/Downloads/projet-full-stack/main/docs/performance/foreground-return-latency-2026-03-16.md)
- [performance/pricing-page-runtime-rationale-2026-03-16.md](/Users/adenankhachnane/Downloads/projet-full-stack/main/docs/performance/pricing-page-runtime-rationale-2026-03-16.md)

### Comprendre la securite et l'observabilite

- [security/README.md](/Users/adenankhachnane/Downloads/projet-full-stack/main/docs/security/README.md)
- [security/security-review-2026-03-15.md](/Users/adenankhachnane/Downloads/projet-full-stack/main/docs/security/security-review-2026-03-15.md)
- [security/SECURITY-HARDENING-PLAN.md](/Users/adenankhachnane/Downloads/projet-full-stack/main/docs/security/SECURITY-HARDENING-PLAN.md)
- [sentry-discord/README.md](/Users/adenankhachnane/Downloads/projet-full-stack/main/docs/sentry-discord/README.md)

### Comprendre l'infra produit

- [domain-email/README.md](/Users/adenankhachnane/Downloads/projet-full-stack/main/docs/domain-email/README.md)

## Regles Documentaires

Regles obligatoires pour les humains et les agents IA:

- une doc officielle doit vivre dans son dossier de domaine: `docs/admin`, `docs/security`, `docs/releases`, `docs/testing`, etc.
- une release doit etre documentee dans `docs/releases/x.y.z.md`
- une revue securite doit etre documentee dans `docs/security/security-review-YYYY-MM-DD.md`
- les docs de travail fragmentees (`tracker`, `followup`, `draft`, `best-practices-report`, `threat-model`, exports `knip-report`) ne doivent pas rester dans le repo une fois consolidees
- si une doc officielle change de chemin, `docs/README.md` et tous les liens internes pointant vers elle doivent etre mis a jour dans la meme passe
- les rapports generes localement ne sont pas des sources de verite et ne doivent pas etre commits

## Notes

- La release officielle courante est [releases/1.5.6.md](/Users/adenankhachnane/Downloads/projet-full-stack/main/docs/releases/1.5.6.md).
- La release precedente immediate est [releases/1.5.5.md](/Users/adenankhachnane/Downloads/projet-full-stack/main/docs/releases/1.5.5.md).
- Les releases precedentes restent archivees dans [docs/releases](/Users/adenankhachnane/Downloads/projet-full-stack/main/docs/releases).
- La reference admin officielle est [admin/README.md](/Users/adenankhachnane/Downloads/projet-full-stack/main/docs/admin/README.md).
- La revue securite officielle courante est [security/security-review-2026-03-15.md](/Users/adenankhachnane/Downloads/projet-full-stack/main/docs/security/security-review-2026-03-15.md).
- Les fichiers de [docs/milestones/](/Users/adenankhachnane/Downloads/projet-full-stack/main/docs/milestones) restent des specifications/historiques de milestones precedentes.
- Les anciennes slides ponctuelles de business plan et d'architecture ont ete retirees pour eviter la confusion avec la doc technique de reference.
