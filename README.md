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

En cours de développement, jalon par jalon (voir `specs/09-ROADMAP-MVP.md`).
Jalon 0 (scaffold Tauri + React) : terminé.
