# Specs · application desktop « Reporting Manar »

Ce dossier contient **toutes les directives** pour développer l'application, de zéro,
sans avoir suivi les discussions de conception. Chaque document est autosuffisant et
cite les chemins exacts des fichiers MIMS à porter.

## Ordre de lecture

1. `00-OVERVIEW.md` · vision produit, périmètre, positionnement réglementaire
2. `01-ARCHITECTURE.md` · Tauri + PocketBase sidecar + webview React
3. `02-DATA-MODEL.md` · collections PocketBase et migrations
4. `03-IMPORT-MANAR.md` · parsing du `.xls` et mapping 54 colonnes → entités
5. `04-REPORTS.md` · pipeline de production des PDF (rendu côté webview)
6. `05-DASHBOARDS.md` · tableaux de bord de pilotage
7. `06-DESIGN-SYSTEM.md` · tokens graphiques DS v2.2 (même look que MIMS)
8. `07-PACKAGING-CICD.md` · build Mac, release Windows via GitHub Actions, licence
9. `08-TESTING.md` · stratégie de tests
10. `09-ROADMAP-MVP.md` · ordre de construction recommandé
11. `PORT-SOURCES.md` · liste exacte des fichiers MIMS à copier / porter

## Principe directeur

MIMS est la **source de vérité visuelle et métier**. On porte ses gabarits PDF, son
parser Manar et ses tokens de design. Le dépôt étant autonome, toute évolution d'un
gabarit réglementaire dans MIMS devra être reportée ici manuellement (voir la limite
assumée en fin de `00-OVERVIEW.md`).

## Conventions de rédaction (projet)

- Français accentué partout dans les textes destinés à l'utilisateur (é, è, ê, à, ç, œ…).
- Pas de tiret cadratin ; utiliser le point médian `·` ou la flèche `→`.
- Encodage UTF-8 strict pour tous les fichiers.
- Montants formatés avec espace insécable comme séparateur de milliers.
- Noms de variables et fonctions en anglais ; libellés utilisateur en français.

## Chemin de la source MIMS

`/Users/dan/Documents/SOFTWARE/myProjects/mims` (même machine). Les chemins cités
dans les specs sont relatifs à cette racine sauf indication contraire.
