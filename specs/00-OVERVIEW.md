# 00 · Vue d'ensemble

## Le produit

Application desktop autonome, légère, installée chez une société de bourse (SDB) du
marché CEMAC / BVMAC. Elle fait trois choses, et seulement trois :

1. **Importer** le fichier Manar (`ETAT DES INSTRUMENTS SAISIS SUR MANAR.xls`).
2. **Produire les rapports** réglementaires et non réglementaires dérivables de ces
   données, à l'identique visuel de la plateforme MIMS.
3. **Afficher des tableaux de bord** de pilotage (encours, concentration, allocation,
   échéancier, flux).

## Pourquoi ce produit existe

La plateforme MIMS complète (front office, ordres, KYC, comptabilité, CRM, OST,
COSUMAF…) est soumise à un processus d'homologation long. Cette application est un
**produit d'entrée** (wedge) qui permet de pénétrer le marché immédiatement, parce
qu'elle n'exerce **aucune fonction soumise à agrément** : elle ne négocie pas, ne
règle pas, ne tient pas de comptabilité. C'est un outil d'aide au reporting qui
travaille sur des données déjà existantes.

> Hypothèse à valider juridiquement : qu'un outil de reporting pur échappe à
> l'homologation lourde COSUMAF. C'est le pivot commercial du produit. À confirmer
> avec le régulateur avant mise sur le marché.

## Périmètre fonctionnel (« Manar seul »)

Le fichier Manar se matérialise en **6 entités** : clients (PP/PM), portefeuilles,
positions, mouvements de titres, instruments, émetteurs. Tout ce que l'application
produit dérive de ces 6 entités. Le catalogue détaillé de référence se trouve dans
MIMS : `docs/licence-import-reporting/CATALOGUE-RAPPORTS-TABLEAUX-BORD.md`.

### Rapports réglementaires (productibles avec Manar seul)

- Transactions boursières (COSUMAF obligation 12)
- Situation des avoirs clientèle (COSUMAF obligation 15)
- État des clients en déshérence (Règlement CEMAC N°02/25, RG-267)
- Lettre de relance déshérence + bordereau de transfert CDEC/BEAC
- Compte rendu des transactions réalisées (historique importé)

### Rapports non réglementaires

- Relevé de compte-titres
- Attestation de portefeuille de titres
- Confirmation d'ouverture de compte
- État du portefeuille valorisé
- Inventaires par instrument / par émetteur
- État des mouvements par client
- Échéancier obligataire
- État des intérêts courus
- Répartition par classe d'actifs

### Tableaux de bord

Encours global, répartition par classe d'actifs, concentration par émetteur
(alerte 30 %), concentration par client, échéancier obligataire, flux d'activité,
répartition PP/PM, souverain vs corporate, taux moyen pondéré obligataire.

## Hors-scope (par conception)

Pas d'ordres de bourse, pas de règlement-livraison, pas de comptabilité SYSCOHADA,
pas de CRM, pas de marché primaire, pas de synchronisation cloud. C'est précisément
cette absence qui réduit la surface d'homologation. Le multi-poste est **conçu pour**
mais pas construit en v1 (voir `01-ARCHITECTURE.md`).

Rapports explicitement **non productibles** depuis Manar (donc absents) : compte
rendu des ordres reçus, états financiers SYSCOHADA, déclarations sociales et fiscales.

## Décisions de conception actées

| Sujet | Décision |
|-------|----------|
| Pile | Tauri (Rust) + PocketBase sidecar + webview React |
| Fidélité PDF | Stricte vs MIMS → port des gabarits react-pdf |
| Design graphique | Identique à MIMS (tokens DS v2.2 portés) |
| Dépôt | Neuf, autonome (divergence assumée, voir ci-dessous) |
| Déploiement | Mono-poste hors ligne, évolutif vers multi-poste |
| Dev / release | Dev sur Mac, release Windows via GitHub Actions |

## Limite assumée · divergence

Le dépôt est autonome : les gabarits réglementaires et le parser Manar sont **copiés**
depuis MIMS, pas partagés. Ils peuvent donc **diverger** dans le temps, ce qui est un
risque pour des états réglementaires. Mitigation : `PORT-SOURCES.md` recense les
fichiers d'origine et sert de point de resynchronisation manuelle. Toute évolution
d'un gabarit réglementaire côté MIMS doit être reportée ici, et inversement.
