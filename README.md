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

## Démarrer le développement

Tout est dans `specs/`. Ce dossier contient **toutes les directives** pour qu'une
instance de développement (humaine ou Claude Code) démarre sans contexte préalable.
Commencer par `specs/README.md`.

La plateforme MIMS (`/Users/dan/Documents/SOFTWARE/myProjects/mims`) est sur la même
machine et sert de **source de port** (gabarits PDF, parser Manar, tokens du design
system). Voir `specs/PORT-SOURCES.md`.

## Statut

Phase de spécification. Aucun code applicatif n'est encore écrit : le dépôt ne
contient pour l'instant que les directives.
