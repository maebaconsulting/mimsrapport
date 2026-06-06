// Orchestrateur pur du pipeline Manar : parse → map → dérivation des 6 entités
// → agrégats de réconciliation. Aucune I/O (l'écriture PocketBase est faite par
// import-service.ts). Porté de MIMS lib/services/manar/manar-ingestor.ts.

import { parseManarXls } from "./manar-parser";
import type { ManarParseResult } from "./manar-parser";
import type { ColumnMapping } from "./manar-fields";
import { mapManarRows } from "./manar-mapping";
import type { MappingResult } from "./manar-mapping";
import { deriveEntities } from "./manar-migration";
import type { DerivedEntities } from "./manar-migration";
import { computeReconciliationAggs } from "./manar-reconciler";
import type { ReconciliationAgg } from "./manar-reconciler";

export interface IngestResult {
  parseResult: ManarParseResult;
  mappingResult: MappingResult;
  derived: DerivedEntities;
  reconciliationAggs: ReconciliationAgg[];
}

/**
 * Exécute le pipeline complet en mémoire à partir du contenu binaire du fichier.
 *
 * @param data · contenu binaire du fichier (Uint8Array)
 * @param mapping · correspondance de colonnes (défaut : format historique)
 */
export function ingestManarBytes(
  data: Uint8Array,
  mapping?: ColumnMapping,
): IngestResult {
  const parseResult = parseManarXls(data, mapping);
  const mappingResult = mapManarRows(parseResult.rows);
  const derived = deriveEntities(mappingResult.rows);
  const reconciliationAggs = computeReconciliationAggs(mappingResult.rows);

  return { parseResult, mappingResult, derived, reconciliationAggs };
}
