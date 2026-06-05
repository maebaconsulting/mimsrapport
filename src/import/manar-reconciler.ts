// Agrégats de réconciliation par (ISIN, émetteur). Porté de MIMS
// lib/services/manar/manar-reconciler.ts. Service pur, testable Vitest.
//
// Côté Manar uniquement (mims_* = null, statut = 'MANAR_SEULEMENT'). Sert au
// rapport de réconciliation d'import (jalon 4).

import type { ManarMappedRow } from "./manar-mapping";
import { parseManarAmount, parseManarDate } from "./manar-parser";

export interface ReconciliationAgg {
  isin: string;
  emetteur_code: string;
  periode_debut: string; // ISO "yyyy-mm-dd"
  periode_fin: string;
  manar_nb_operations: number;
  manar_montant_brut_xaf: number;
  manar_statuts: Record<string, number>; // { F, V, P, S }
  mims_nb_operations: number | null;
  mims_montant_brut_xaf: number | null;
  statut: "MANAR_SEULEMENT" | "EQUILIBRE" | "ECART_MINEUR" | "ECART_SIGNIFICATIF";
}

/**
 * Calcule les agrégats de réconciliation à partir des lignes Manar mappées.
 * Groupe par (isin, emetteur_code). mims_* toujours null → 'MANAR_SEULEMENT'.
 */
export function computeReconciliationAggs(
  rows: ManarMappedRow[],
): ReconciliationAgg[] {
  if (rows.length === 0) return [];

  const groups = new Map<
    string,
    {
      isin: string;
      emetteur_code: string;
      nb_operations: number;
      montant_brut_xaf: number;
      statuts: Record<string, number>;
      dates: string[];
    }
  >();

  for (const row of rows) {
    const isin = row.isin ?? "__NO_ISIN__";
    const emetteur = row.emetteur_code ?? "__NO_EMETTEUR__";
    const key = `${isin}||${emetteur}`;

    if (!groups.has(key)) {
      groups.set(key, {
        isin,
        emetteur_code: emetteur,
        nb_operations: 0,
        montant_brut_xaf: 0,
        statuts: {},
        dates: [],
      });
    }
    const g = groups.get(key)!;
    g.nb_operations += 1;

    const montant = parseManarAmount(row.montant_brut_xaf);
    if (montant !== null) g.montant_brut_xaf += montant;

    g.statuts[row.statut] = (g.statuts[row.statut] ?? 0) + 1;

    if (row.date_operation) {
      const isoDate = parseManarDate(row.date_operation);
      if (isoDate) g.dates.push(isoDate);
    }
  }

  const aggs: ReconciliationAgg[] = [];
  groups.forEach((g) => {
    const sortedDates = [...g.dates].sort();
    aggs.push({
      isin: g.isin === "__NO_ISIN__" ? "" : g.isin,
      emetteur_code: g.emetteur_code === "__NO_EMETTEUR__" ? "" : g.emetteur_code,
      periode_debut: sortedDates[0] ?? "",
      periode_fin: sortedDates[sortedDates.length - 1] ?? "",
      manar_nb_operations: g.nb_operations,
      manar_montant_brut_xaf: g.montant_brut_xaf,
      manar_statuts: g.statuts,
      mims_nb_operations: null,
      mims_montant_brut_xaf: null,
      statut: "MANAR_SEULEMENT",
    });
  });

  return aggs;
}
