# 09 · Feuille de route MVP

Ordre de construction recommandé pour l'instance de développement. Chaque jalon est
livrable et vérifiable indépendamment.

## Jalon 0 · Scaffold
- `pnpm create tauri-app` (frontend React + TypeScript + Vite).
- Structure de dossiers cible (voir ci-dessous).
- Config Tauri de base, fenêtre, icône.
- Vérif : l'app vide démarre sur Mac.

## Jalon 1 · Sidecar PocketBase + schéma
- Intégrer PocketBase en sidecar (`externalBin`), géré par la coque Rust (spawn/arrêt).
- Migrations `pb_migrations/` créant les collections de `02-DATA-MODEL.md`.
- Config-driven URL + auto-login mono-poste.
- Vérif : au lancement, PocketBase démarre, les collections existent, le frontend lit
  l'API sur `localhost`.

## Jalon 2 · Import Manar
- Dialogue d'ouverture du `.xls` (Tauri) → parsing SheetJS → mapping → dérivation des
  6 entités → écriture PocketBase.
- Journal `manar_imports` + idempotence par `file_hash`.
- Assistant d'import avec validation et erreurs ligne à ligne.
- Vérif : golden-file (`08-TESTING.md`), les comptages attendus sont atteints.

## Jalon 3 · Un rapport bout-en-bout (valider le pipeline PDF)
- Porter **un** gabarit (recommandé : `AttestationPortefeuillePdf` ou
  `ReleveCompteTitresPdf`), polices par URL, double hash, sauvegarde Tauri, log export.
- **Valider le rendu react-pdf dans WebView2 et WKWebView** (risque identifié).
- Vérif : un PDF fidèle à MIMS est produit et enregistré sur disque.

## Jalon 4 · Tous les rapports
- Porter le reste des gabarits réglementaires et non réglementaires (`04-REPORTS.md`),
  y compris le `cosumaf/_shared/` pour les deux états COSUMAF.
- Créer les gabarits manquants (état du portefeuille, inventaires, échéancier, courus,
  répartition) ou les servir en tableau.
- Vérif : test de rendu réel vert pour chaque gabarit.

## Jalon 5 · Tableaux de bord
- Porter les tokens DS (`06-DESIGN-SYSTEM.md`), les wrappers Recharts, les composants
  KPI, les helpers d'agrégation.
- Construire les 9 tableaux de bord (`05-DASHBOARDS.md`).
- Vérif : KPI cohérents avec les données importées ; look identique à MIMS.

## Jalon 6 · Packaging et release Windows
- Script de récupération du binaire PocketBase (version figée) par plateforme.
- Workflow GitHub Actions `release-windows.yml` → `.msi`/`.exe`.
- Vérif : un tag `vX.Y.Z` produit des installeurs Windows téléchargeables.

## Jalon 7 · Licence
- Module de validation hors ligne (fichier signé) dans la coque Rust.
- Écran de blocage si licence absente/invalide.
- Vérif : app verrouillée sans licence, déverrouillée avec une licence valide.

## Structure de dossiers cible

```
mims_rapport/
  src/                      frontend React (webview)
    import/                 assistant + parsing SheetJS + mapping
    reports/
      templates/            gabarits react-pdf portés
      services/             agrégation + composition des données de rapport
    dashboards/             vues Recharts + KPI
    design/                 tokens DS portés (globals.css → css/vars)
    lib/pocketbase.ts       client SDK + config URL
    public/fonts/           Inter + JetBrainsMono (.ttf)
  src-tauri/                coque Rust (sidecar mgmt, dialogues, licence)
    binaries/               binaire PocketBase (gitignored, fourni au build)
  pocketbase/
    pb_migrations/          schéma versionné
  samples/manar/            échantillon anonymisé (golden-file)
  scripts/                  fetch-pocketbase, utilitaires de build
  specs/                    ce dossier
  .github/workflows/        release-windows.yml
```

## Rappel de séquencement

Le **jalon 3 est le point de risque** : valider tôt que le build navigateur de
react-pdf rend correctement dans les webviews cibles. Ne pas porter les 13 gabarits
avant d'avoir prouvé le pipeline sur un seul.
