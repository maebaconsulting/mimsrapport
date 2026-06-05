# 05 · Tableaux de bord de pilotage

Neuf tableaux de bord, tous dérivables des positions, mouvements, instruments et
émetteurs importés. Rendu Recharts dans la webview. Logique d'agrégation portée des
helpers MIMS purs (`lib/services/portfolio-aggregator.ts`, `lib/services/risk-dashboard.ts`).

## Catalogue

| Tableau de bord | Métriques | Source |
|-----------------|-----------|--------|
| Encours global titres | valorisation totale, nb positions, nb comptes | positions |
| Répartition par classe d'actifs | parts actions / obligations / OPC (donut) | positions + instruments.type |
| Concentration par émetteur | exposition par émetteur, top N, alerte > 30 % | positions + emetteurs |
| Concentration par client | encours par client, top détenteurs | positions + clients |
| Échéancier obligataire | tombées par année (barres) | instruments.date_echeance + positions |
| Flux d'activité | volumes ACHAT / VENTE par période | mouvements_titres |
| Répartition par type de client | parts PP / PM | clients.type |
| Souverain vs corporate | parts par type d'émetteur | emetteurs.type |
| Taux moyen pondéré obligataire | taux moyen pondéré du portefeuille | instruments.taux_interet + positions |

## Helpers d'agrégation à porter

### `portfolio-aggregator.ts`
Consolidation par client : `consolidatePortfoliosByClient()` produit nb_positions,
valorisation_xaf, cout_acquisition_xaf, pnl_latent_xaf, performance_latente_pct, top 3
lignes, allocation par classe d'actifs, et des KPI globaux (valorisation totale, P&L,
performance globale, moyenne par portefeuille). Fonctions pures, sans I/O : se portent
directement en TS dans le frontend.

### `risk-dashboard.ts`
Scoring de concentration : `computeConcentrationScore()` (exposition émetteur vs limite
30 %). Les autres dimensions du score de risque MIMS (contrepartie, marché, liquidité,
change) dépendent de données absentes de Manar (alertes, change) ; en v1, ne porter que
la **concentration**, qui est entièrement dérivable des positions.

## Primitives graphiques (à porter / réimplémenter)

MIMS utilise un wrapper Recharts SSR-safe `components/ui/chart.tsx` (ChartContainer,
ChartTooltip, ChartTooltipContent) où **toutes les couleurs passent par des variables
CSS** (`var(--color-accent)`…), conforme au design system. À porter, en s'appuyant sur
les tokens de `06-DESIGN-SYSTEM.md`.

Références de composants MIMS réutilisables comme modèles :
- `components/portail/PortailAllocationStack.tsx` · donut allocation (donut 120×120, R int. 42, R ext. 58)
- `components/portail/PortailSparkline.tsx` · mini-courbe d'évolution
- `components/risk/RatiosSparkline.tsx` · mini-courbe de ratio
- `components/dashboard/DashboardEvolutionChart.tsx` · barres d'évolution
- `components/risk/RiskScoreGauge.tsx` · jauge segmentée (0-30 critique, 30-60 attention, 60-80 bon, 80-100 excellent)

## Composants KPI (à porter)

- `components/dashboard/KpiCard.tsx` · carte KPI unique (label small-caps, valeur mono
  28px tabular-nums, delta, barre de progression, bord danger optionnel). Dimensions :
  min-width 220px, hauteur 96px, bord gray-200, radius-lg.
- `components/patterns/KpiRow.tsx` · grille de KPI généralisée avec variantes
  (default/danger/success/warn/indigo), responsive 1 → 5 colonnes.

## Limite à afficher dans l'UI

Manar est un chargement de masse rétrospectif. Les vues d'**évolution temporelle**
(sparklines, courbes d'encours) restent partielles sur un import unique : elles
s'appuient sur la chronologie des mouvements importés. À signaler à l'utilisateur
(libellé ou info-bulle) pour ne pas laisser croire à un suivi continu.
