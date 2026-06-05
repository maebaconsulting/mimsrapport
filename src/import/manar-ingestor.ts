// Orchestrateur pur du pipeline Manar : parse → map → dérivation des 6 entités
// → agrégats de réconciliation. Aucune I/O (l'écriture PocketBase est faite par
// import-service.ts). Porté de MIMS lib/services/manar/manar-ingestor.ts.

import { parseManarXls } from "./manar-parser";
import type { ManarParseResult } from "./manar-parser";
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
 * @param data · contenu binaire du fichier Manar (Uint8Array)
 */
export function ingestManarBytes(data: Uint8Array): IngestResult {
  const parseResult = parseManarXls(data);
  const mappingResult = mapManarRows(parseResult.rows);
  const derived = deriveEntities(mappingResult.rows);
  const reconciliationAggs = computeReconciliationAggs(mappingResult.rows);

  return { parseResult, mappingResult, derived, reconciliationAggs };
}
