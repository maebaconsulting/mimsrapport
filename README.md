# MIMS Rapport · application desktop « Reporting Manar »

Application desktop autonome et légère qui importe le fichier Manar d'une société
de bourse (marché CEMAC / BVMAC) et produit, à l'identique visuel de MIMS, ses
rapports réglementaires, ses rapports non réglementaires et ses tableaux de bord de
pilotage.

C'est le **produit d'entrée** (wedge) de la gamme MIMS : il permet de pénétrer le
marché sans attendre l'homologation de la plateforme MIMS complète, car il ne fait
que de l'import et du reporting, sans fonction soumise à agrément (ni ordres, ni
règlement-livraison, ni comptabilité).

## Pile technique

- **Tauri** (coque desktop, noyau Rust)
- **PocketBase** en sidecar (backend Go, SQLite embarqué, REST + réaltime + auth)
- **Frontend React** dans la webview (UI, rendu PDF côté client, dashboards)

Mono-poste hors ligne en v1, conçu pour évoluer vers le multi-poste sans réécriture.

## Spécifications

Tout est dans `specs/`. Ce dossier contient **toutes les directives** pour qu'une
instance de développement (humaine ou Claude Code) démarre sans contexte préalable.
Commencer par `specs/README.md`.

La plateforme MIMS (`/Users/dan/Documents/SOFTWARE/myProjects/mims`) est sur la même
machine et sert de **source de port** (gabarits PDF, parser Manar, tokens du design
system). Voir `specs/PORT-SOURCES.md`.

## Démarrer le développement

Prérequis : Node 20+, pnpm, Rust stable, dépendances Tauri (voir la documentation
Tauri pour la plateforme).

```bash
pnpm install        # dépendances frontend
pnpm dev            # serveur Vite seul (webview dans un navigateur)
pnpm tauri dev      # application desktop complète (webview + noyau Rust)
pnpm build          # compile le frontend (tsc + vite)
pnpm test           # tests Vitest
```

## Structure

```
src/                frontend React (webview)
  design/           tokens du design system portés de MIMS
  import/           assistant d'import + parsing Manar
  reports/          gabarits react-pdf + services de rapport
  dashboards/       vues Recharts + KPI
  lib/              client PocketBase, configuration
src-tauri/          coque Rust (sidecar, dialogues, licence)
pocketbase/         binaire sidecar + migrations de schéma
samples/manar/      échantillon anonymisé (golden-file)
scripts/            utilitaires de build
specs/              spécifications (source de vérité)
```

## Statut

MVP complet : les 8 jalons de `specs/09-ROADMAP-MVP.md` sont réalisés.

- Jalon 0 · scaffold Tauri 2 + React 19 + Vite
- Jalon 1 · sidecar PocketBase (v0.39.1 figée) + schéma par migrations versionnées
- Jalon 2 · import Manar (parser, dérivation des 6 entités, idempotence)
- Jalon 3 · pipeline PDF bout-en-bout (rendu navigateur ; validation WKWebView/Mac de l'aperçu et de l'impression encore à confirmer en GUI)
- Jalon 4 · port de tous les gabarits réglementaires et non réglementaires
- Jalon 5 · 9 tableaux de bord de pilotage (Recharts + KPI)
- Jalon 6 · packaging et workflow de release Windows (GitHub Actions)
- Jalon 7 · licence signée Ed25519, validée hors ligne

### Rapports surfacés dans l'écran « Rapports »

Tous les gabarits sont portés et testés en rendu ; l'UI en surface sept derrière
le flux « aperçu PDF » :

- Documents par client : attestation de portefeuille, relevé de compte-titres,
  confirmation d'ouverture de compte, lettre de relance déshérence.
- États réglementaires (échelle société) : COSUMAF transactions boursières
  (obl. 12), COSUMAF situation des avoirs (obl. 15), état des clients en
  déshérence.

Les états réglementaires fonctionnent en **mode honnête** : l'app desktop ne
dispose que des données de l'import Manar (positions et mouvements de titres). Les
dimensions absentes (espèces, exécutions d'ordres détaillées, OST, catégories
dirigeant/personnel) sont signalées par une **bannière de provenance** dans le PDF
et marquées « non disponible » ; aucune valeur n'est saisie ni inventée. Ces
documents ne sont donc pas destinés à une transmission réglementaire en l'état tant
que le modèle de données n'est pas étendu. Bordereau CDEC/BEAC, compte rendu des
transactions et rapport de réconciliation restent portés mais non surfacés.

Avant de lancer : `pnpm install` puis `./scripts/fetch-pocketbase.sh` (récupère le
binaire PocketBase, non versionné), puis `pnpm tauri dev`.

### Émission d'une licence (dev)

```bash
node scripts/sign-license.mjs --sdb "CCA Bourse" --code CCAB \
  --expires 2027-12-31 --out cca-bourse.license
```

La clé privée (`scripts/license-private-key.pem`) n'est jamais versionnée.
