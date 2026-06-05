// Dictionnaires statiques POSTE + ÉMETTEUR et enrichissement des lignes Manar.
// Porté de MIMS lib/services/manar/manar-mapping.ts. Service pur, testable Vitest.
//
// Les codes inconnus n'empêchent pas l'import : ils marquent l'instrument en
// pré-référence (équivalent RG-258 de MIMS).

import type { ManarRawRow } from "./manar-parser";

/** Dictionnaire POSTE (8 codes). */
export const POSTE_MAP: Record<
  string,
  { libelle: string; type: "ACTIF" | "PASSIF" }
> = {
  AOBLNC: { libelle: "Actif · Obligation non cotée", type: "ACTIF" },
  AOBLB: { libelle: "Actif · Obligation en bourse", type: "ACTIF" },
  AACTB: { libelle: "Actif · Action en bourse", type: "ACTIF" },
  AACTNC: { libelle: "Actif · Action non cotée", type: "ACTIF" },
  SOBLP: { libelle: "Passif · Obligation propre", type: "PASSIF" },
  SXOBL: { libelle: "Passif · Obligation extérieure", type: "PASSIF" },
  EXACT: { libelle: "Externe · Action cotée tiers", type: "ACTIF" },
  EXOBL: { libelle: "Externe · Obligation tiers", type: "ACTIF" },
};

/** Dictionnaire ÉMETTEUR (10 codes). */
export const EMETTEUR_MAP: Record<string, { libelle: string; pays: string }> = {
  "E-GABON": { libelle: "État du Gabon", pays: "GA" },
  "E-CCA": { libelle: "CCA Bank", pays: "CM" },
  "E-TCHAD": { libelle: "État du Tchad", pays: "TD" },
  "E-CONGO": { libelle: "État du Congo", pays: "CG" },
  "E-BIACMR": { libelle: "BIA Cameroun", pays: "CM" },
  "E-BDEAC": { libelle: "BDEAC", pays: "GA" },
  "E-CAMEROUN": { libelle: "État du Cameroun", pays: "CM" },
  "E-SCG-RE": { libelle: "SCG Réassurance", pays: "CG" },
  "E-LAREGIONALE": { libelle: "La Régionale", pays: "CM" },
  CCAB: { libelle: "CCA Bourse (SDB pilote)", pays: "CM" },
};

export interface ManarMappedRow extends ManarRawRow {
  poste_libelle: string | null;
  poste_type: "ACTIF" | "PASSIF" | null;
  emetteur_libelle: string | null;
  emetteur_pays: string | null;
  is_pre_reference: boolean; // true si poste_code ou emetteur_code inconnu
  pre_reference_raison: string | null;
}

export interface PreReferenceItem {
  type: "POSTE" | "EMETTEUR";
  code: string;
  count: number;
}

export interface MappingResult {
  rows: ManarMappedRow[];
  preReferences: PreReferenceItem[];
  unknownPostes: Set<string>;
  unknownEmetteurs: Set<string>;
}

/**
 * Enrichit les lignes Manar avec les libellés POSTE et ÉMETTEUR. Les codes
 * inconnus créent des entrées preReferences[] mais ne bloquent pas l'import.
 */
export function mapManarRows(rows: ManarRawRow[]): MappingResult {
  const unknownPostes = new Set<string>();
  const unknownEmetteurs = new Set<string>();
  const posteCount = new Map<string, number>();
  const emetteurCount = new Map<string, number>();

  const mappedRows: ManarMappedRow[] = rows.map((row) => {
    let isPreReference = false;
    const raisonsPreRef: string[] = [];

    let poste_libelle: string | null = null;
    let poste_type: "ACTIF" | "PASSIF" | null = null;
    if (row.poste_code) {
      const posteEntry = POSTE_MAP[row.poste_code];
      if (posteEntry) {
        poste_libelle = posteEntry.libelle;
        poste_type = posteEntry.type;
      } else {
        isPreReference = true;
        raisonsPreRef.push(`Code POSTE inconnu : ${row.poste_code}`);
        unknownPostes.add(row.poste_code);
        posteCount.set(row.poste_code, (posteCount.get(row.poste_code) ?? 0) + 1);
      }
    }

    let emetteur_libelle: string | null = null;
    let emetteur_pays: string | null = null;
    if (row.emetteur_code) {
      const emetteurEntry = EMETTEUR_MAP[row.emetteur_code];
      if (emetteurEntry) {
        emetteur_libelle = emetteurEntry.libelle;
        emetteur_pays = emetteurEntry.pays;
      } else {
        isPreReference = true;
        raisonsPreRef.push(`Code ÉMETTEUR inconnu : ${row.emetteur_code}`);
        unknownEmetteurs.add(row.emetteur_code);
        emetteurCount.set(
          row.emetteur_code,
          (emetteurCount.get(row.emetteur_code) ?? 0) + 1,
        );
      }
    }

    return {
      ...row,
      poste_libelle,
      poste_type,
      emetteur_libelle,
      emetteur_pays,
      is_pre_reference: isPreReference,
      pre_reference_raison:
        raisonsPreRef.length > 0 ? raisonsPreRef.join(" · ") : null,
    };
  });

  const preReferences: PreReferenceItem[] = [];
  unknownPostes.forEach((code) => {
    preReferences.push({ type: "POSTE", code, count: posteCount.get(code) ?? 0 });
  });
  unknownEmetteurs.forEach((code) => {
    preReferences.push({
      type: "EMETTEUR",
      code,
      count: emetteurCount.get(code) ?? 0,
    });
  });

  return { rows: mappedRows, preReferences, unknownPostes, unknownEmetteurs };
}
