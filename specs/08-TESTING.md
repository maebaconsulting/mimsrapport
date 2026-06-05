# 08 · Stratégie de tests

## Principe directeur (leçon MIMS)

Les tests qui **mockent** le rendu PDF ratent les erreurs runtime de react-pdf
(polices, styles interdits, colonnes inexistantes). MIMS a appris cela en production :
d'où l'exigence d'un test qui **rend réellement** chaque gabarit.

## Niveaux de tests

### 1. Unitaires · logique d'agrégation et de parsing
- Helpers portés (`portfolio-aggregator`, concentration) : porter aussi les tests MIMS.
- Parser Manar : dates `dd/mm/yyyy`, montants format FR (espace insécable, virgule),
  nulls sémantiques (`NEANT`…), hash FNV-1a des codes clients.
- Framework : Vitest (cohérent avec MIMS).

### 2. Golden-file · import complet
- Entrée : `samples/manar/...-ANONYME.xlsx` (166 opérations).
- Sortie attendue : comptages déterministes (nb emetteurs, instruments, clients PP/PM,
  portefeuilles, positions, mouvements) + quelques montants/PMP de contrôle.
- Vérifie le pipeline parsing → mapping → dérivation des 6 entités.

### 3. Rendu réel des gabarits (CRITIQUE)
- Pour **chaque** gabarit porté : construire des props réalistes et appeler
  `pdf(<Gabarit/>).toBlob()` ; asserter que le Blob est non vide et commence par
  `%PDF`.
- C'est ce test qui attrape : `fontStyle: 'italic'` interdit, colonnes instruments
  réelles (`isin`/`libelle_fr`), polices mal enregistrées, etc.
- À exécuter dans un environnement qui simule la webview (jsdom + polices accessibles),
  ou en E2E réel (voir ci-dessous) si le build navigateur ne tourne pas en jsdom.

### 4. E2E · application réelle
- Scénario : lancer l'app → importer l'échantillon → générer chaque rapport → vérifier
  qu'un PDF non vide est produit → ouvrir un dashboard et vérifier les KPI.
- Outils : tests E2E Tauri (WebDriver / `tauri-driver`) ou Playwright sur la webview.
- Valider en particulier le rendu react-pdf dans **WebView2 (Windows)** et **WKWebView
  (Mac)**, point de risque identifié dans `04-REPORTS.md`.

### 5. Rust · cycle de vie du sidecar
- Démarrage du sidecar PocketBase : le port répond avant le chargement de la webview.
- Arrêt propre à la fermeture (pas de process orphelin).
- Repli de port si le port par défaut est occupé.

## Intégration continue

- Tests unitaires + golden-file + rendu réel : sur chaque push (runner rapide).
- E2E + build : sur tag de release (runner Windows, voir `07-PACKAGING-CICD.md`).

## Données de test

Ne jamais committer le fichier Manar **réel** (PII). Utiliser uniquement la version
**anonymisée** (`*-ANONYME.xlsx`), déjà dépourvue de données personnelles.
