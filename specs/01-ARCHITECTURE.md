# 01 · Architecture

## Vue d'ensemble

Trois composants dans un seul exécutable desktop.

```
┌─────────────────────────────────────────────────────────┐
│  Tauri (fenêtre desktop, noyau Rust)                     │
│                                                          │
│  ┌─────────────────────┐      ┌───────────────────────┐ │
│  │  Webview (frontend)  │ HTTP │  PocketBase (sidecar) │ │
│  │  React + react-pdf   │─────▶│  Go + SQLite embarqué │ │
│  │  Recharts dashboards │ REST │  REST + réaltime+auth │ │
│  └─────────────────────┘ :PORT └───────────────────────┘ │
│            │  invoke (IPC)                                │
│            ▼                                              │
│  ┌─────────────────────────────────────────────────────┐ │
│  │  Rust · dialogues fichiers, cycle de vie du sidecar │ │
│  └─────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

## Responsabilités par composant

### Coque Tauri (Rust · `src-tauri/`)

- Fenêtre native, menu, icône, mises à jour.
- **Démarrage et arrêt du sidecar PocketBase** : au lancement de l'app, spawn du
  binaire PocketBase (via `tauri-plugin-shell` / `externalBin`), attente que le port
  réponde, puis chargement de la webview. À la fermeture, arrêt propre du process.
- **Dialogues fichiers natifs** : ouverture du `.xls` Manar (lecture du contenu
  passé au frontend) et enregistrement des PDF produits (écriture du Blob sur disque)
  via `tauri-plugin-dialog` + `tauri-plugin-fs`.
- Validation de la **licence** au démarrage (voir `07-PACKAGING-CICD.md`).

Le Rust ne contient **pas** de logique métier (pas de parsing, pas d'agrégation,
pas de rendu PDF). Il orchestre le sidecar et la webview.

### PocketBase (sidecar · `pocketbase/`)

- Backend Go, **un seul binaire**, SQLite embarqué dans le dossier de données
  utilisateur de l'app (chemin résolu par Tauri, ex. `~/Library/Application Support/…`
  sur Mac, `%APPDATA%/…` sur Windows).
- Expose une API REST + réaltime + l'admin UI sur `127.0.0.1:<PORT>`.
- **Schéma défini par migrations versionnées** livrées avec l'app, jouées au premier
  lancement (voir `02-DATA-MODEL.md`).
- Auth intégrée (collection `users`), présente dès la v1.

### Frontend React (webview · `src/`)

- Toute l'UI : assistant d'import, exploration des données, génération des rapports,
  dashboards.
- Parle à PocketBase via le **SDK JS PocketBase** sur `localhost`.
- **Rend les PDF côté client** avec le build navigateur de `@react-pdf/renderer`
  (voir `04-REPORTS.md`).
- Dashboards avec Recharts (voir `05-DASHBOARDS.md`).

## Cycle de vie au démarrage

1. Tauri démarre, lit la config (URL/port PocketBase, licence).
2. Tauri spawn le sidecar PocketBase ; attend la disponibilité du port (poll HTTP).
3. PocketBase joue les migrations si nécessaire (création/màj des collections).
4. La webview charge ; le frontend s'authentifie (auto-login mono-poste) et affiche
   l'écran d'accueil.
5. À la fermeture de la fenêtre, Tauri arrête le sidecar.

## Configuration · clé de l'évolutivité

Deux règles non négociables pour permettre le passage mono → multi-poste **sans
réécriture** :

1. **L'URL de base PocketBase est lue d'une configuration**, jamais codée en dur.
   - Mono-poste : `http://127.0.0.1:<PORT>` (sidecar local).
   - Multi-poste : `https://<serveur-sdb>` (même PocketBase déplacé sur un serveur).
2. **L'auth PocketBase existe dès la v1.** En mono-poste, un utilisateur local est
   créé au premier lancement et l'app fait un auto-login transparent. En multi-poste,
   on active la vraie gestion d'utilisateurs (déjà fournie par PocketBase) et le
   réaltime diffuse les mises à jour entre postes.

Le passage en multi-poste devient alors : déployer le binaire PocketBase sur un
serveur du réseau, pointer la config des postes vers son URL, activer l'auth. Aucune
modification du frontend ni du schéma.

## Port et sécurité locale

- Le sidecar écoute sur `127.0.0.1` uniquement en mono-poste (pas d'exposition réseau).
- Port fixe par défaut (ex. `8090`), avec repli sur un port libre si occupé ; la
  valeur retenue est passée au frontend par Tauri (variable d'environnement de la
  webview ou commande `invoke`).

## Choix de PocketBase · contraintes

PocketBase est **pré-1.0** : pas de garantie de compatibilité ascendante. Conséquences :

- **Figer la version** du binaire (épingler un numéro précis, ne pas suivre `latest`).
- Gérer le schéma par **migrations versionnées** (collections-as-code), pas seulement
  via l'admin UI, pour reproductibilité et mise à jour contrôlée.
- Suivre le changelog avant toute montée de version.
