# PORT-SOURCES · fichiers MIMS à copier / porter

Racine MIMS : `/Users/dan/Documents/SOFTWARE/myProjects/mims` (même machine).
Tous les chemins ci-dessous sont relatifs à cette racine. Vérifiés présents au
2026-06-05.

Ce fichier est aussi le **point de resynchronisation** : si un gabarit réglementaire
évolue côté MIMS, reporter le changement ici (et inversement). Voir la limite assumée
dans `00-OVERVIEW.md`.

## Polices (copier tel quel dans `src/public/fonts/`)

- `lib/integrations/pdf/fonts/Inter-Regular.ttf`
- `lib/integrations/pdf/fonts/Inter-SemiBold.ttf`
- `lib/integrations/pdf/fonts/JetBrainsMono-Regular.ttf`
- `lib/integrations/pdf/fonts/JetBrainsMono-SemiBold.ttf`

## Échantillon Manar (copier l'ANONYME uniquement)

- `samples/manar/ETAT DES INSRUMENTS SAISIS SUR MANAR-ANONYME.xlsx`  → `samples/manar/`
- NE PAS copier `ETAT DES INSRUMENTS SAISIS SUR MANAR.xls` (données réelles, PII).

## Pipeline PDF (porter, adapter au build navigateur)

- `lib/integrations/pdf/render.ts` · **à réécrire** : `renderToBuffer` (Node) →
  `pdf().toBlob()` (navigateur), polices par URL. Voir `04-REPORTS.md`.
- `app/_actions/attestation-pdf.ts` · patron de référence (requête, composition du nom
  PP/PM, double passe de hash, log d'audit, retour base64). À adapter en logique
  frontend + PocketBase + Tauri fs.

## Gabarits react-pdf (copier le TSX, adapter polices + appel de rendu)

Réglementaires :
- `lib/integrations/pdf/templates/cosumaf/TransactionsBoursieresPdf.tsx`
- `lib/integrations/pdf/templates/cosumaf/SituationAvoirsPdf.tsx`
- `lib/integrations/pdf/templates/EtatClientsDesherencePdf.tsx`
- `lib/integrations/pdf/templates/LettreRelanceDesherencePdf.tsx`
- `lib/integrations/pdf/templates/BordereauTransfertCdecPdf.tsx`
- `lib/integrations/pdf/templates/CompteRenduTransactionsPdf.tsx`

Partagé COSUMAF (requis par les deux gabarits ci-dessus) :
- `lib/integrations/pdf/templates/cosumaf/_shared/CosumafPdfShell.tsx`
- `lib/integrations/pdf/templates/cosumaf/_shared/RectificatifWatermark.tsx`
- `lib/integrations/pdf/templates/cosumaf/_shared/cosumaf-tokens.ts`

Non réglementaires :
- `lib/integrations/pdf/templates/ReleveCompteTitresPdf.tsx`
- `lib/integrations/pdf/templates/AttestationPortefeuillePdf.tsx`
- `lib/integrations/pdf/templates/ConfirmationOuverturePdf.tsx`
- `lib/integrations/pdf/templates/ManarReconciliationReport.tsx`

## Import Manar (porter la logique TS)

- `lib/services/manar/manar-parser.ts` · lecture SheetJS, normalisation, 54 colonnes
- `lib/services/manar/manar-mapping.ts` · `POSTE_MAP`, `EMETTEUR_MAP`, mapping codes
- `lib/services/manar/manar-migration.ts` · dérivation des 6 entités, PMP, statuts
- `lib/services/manar/manar-ingestor.ts` · orchestration d'ingestion (référence)
- `lib/services/manar/manar-reconciler.ts` · réconciliation (pour le rapport dédié)
- `supabase/migrations/20260514000003_phase3_manar_operations.sql` · schéma de la table
  brute (référence pour la collection `manar_operations`)

## Agrégation dashboards (porter les helpers purs)

- `lib/services/portfolio-aggregator.ts` · consolidation par client, allocation, KPI
- `lib/services/risk-dashboard.ts` · score de concentration (porter cette dimension only)

## Design system (porter les tokens)

- `app/globals.css` · tokens DS v2.2 LOCKED (couleurs, typo, spacing, radius, focus)
- `app/[locale]/layout.tsx` · chargement des polices (IBM Plex Sans/Mono, Inter)
- `components/ui/chart.tsx` · wrapper Recharts SSR-safe
- `components/dashboard/KpiCard.tsx` · carte KPI
- `components/patterns/KpiRow.tsx` · grille KPI
- Modèles de graphiques : `components/portail/PortailAllocationStack.tsx`,
  `components/portail/PortailSparkline.tsx`, `components/risk/RatiosSparkline.tsx`,
  `components/dashboard/DashboardEvolutionChart.tsx`, `components/risk/RiskScoreGauge.tsx`

## Catalogue métier de référence

- `docs/licence-import-reporting/CATALOGUE-RAPPORTS-TABLEAUX-BORD.md` · périmètre exact
  des rapports/dashboards productibles avec Manar seul.

## Note d'adaptation transverse

MIMS est multi-tenant (colonne `sdb_id` partout) avec RLS Postgres. L'app desktop est
mono-SDB : **retirer `sdb_id`** et toute logique RLS lors du port. Les requêtes
deviennent de simples lectures PocketBase locales.
