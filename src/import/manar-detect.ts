// -*- coding: utf-8 -*-
// Auto-détection de la correspondance de colonnes à partir des en-têtes réels
// et d'un échantillon de valeurs. Pur (testable). Si la structure correspond au
// format historique, renvoie le mapping par défaut tel quel (zéro régression).

import {
  DEFAULT_MAPPING,
  REQUIRED_FIELDS,
  MAPPABLE_FIELDS,
  type ColumnMapping,
} from "./manar-fields";

export interface DetectionResult {
  mapping: ColumnMapping;
  confidence: "auto" | "ambiguous";
  /** Champs obligatoires non résolus avec confiance. */
  missingRequired: string[];
}

/** Normalise un libellé d'en-tête (minuscule, sans accents ni ponctuation). */
function norm(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// Alias d'en-têtes connus (format historique) par champ logique. Évite les
// libellés trop génériques qui happeraient une colonne voisine (« portefeuille »
// vs « desc portefeuille », « taux » vs « taux negociation »).
const HEADER_ALIASES: Record<string, string[]> = {
  manar_op_id: ["n operation", "no operation", "numero operation"],
  donneur_ordre: ["desc portefeuille", "donneur d ordre", "donneur ordre"],
  isin: ["code isin", "isin"],
  emetteur_code: ["emetteur", "code emetteur"],
  poste_code: ["poste"],
  libelle_instrument: ["desc titre", "libelle titre"],
  statut: ["statut"],
  quantite: ["quantite", "qte", "nombre de titres"],
  prix_xaf: ["cours"],
  valeur_nominale_xaf: ["montantdev", "valeur nominale", "nominal"],
  montant_brut_xaf: ["montant brut"],
  courus_xaf: ["interet couru", "coupon couru"],
  taux_interet: ["taux negociation", "taux interet"],
  date_operation: ["date operation", "date negociation"],
  date_valeur: ["date valeur"],
  date_saisie: ["date saisi", "date saisie"],
  date_validation: ["date validation"],
  operateur_saisie: ["ope front", "operateur saisie"],
  operateur_validation: ["ope back", "operateur validation"],
};

/**
 * Détecte une correspondance de colonnes depuis les en-têtes + l'échantillon.
 * Stratégie : appariement par alias d'en-têtes, validation sur échantillon des
 * champs obligatoires. Si l'identifiant d'opération tombe en col 0 et le client
 * en col 8 (signature historique), on renvoie le mapping par défaut intégral.
 */
export function detectMapping(
  headers: string[],
  sampleRows: string[][],
): DetectionResult {
  const normHeaders = headers.map(norm);
  const mapping: ColumnMapping = {};
  const used = new Set<number>();

  const claim = (key: string, match: (h: string, a: string) => boolean) => {
    if (mapping[key] !== null && mapping[key] !== undefined) return;
    const aliases = HEADER_ALIASES[key] ?? [];
    for (const a of aliases) {
      for (let i = 0; i < normHeaders.length; i++) {
        if (used.has(i)) continue;
        const h = normHeaders[i];
        if (h && match(h, a)) {
          mapping[key] = i;
          used.add(i);
          return;
        }
      }
    }
  };

  // Passe 1 : correspondance exacte (la plus fiable). Passe 2 : inclusion, pour
  // les en-têtes légèrement différents, sans réutiliser une colonne déjà prise.
  for (const f of MAPPABLE_FIELDS) {
    mapping[f.key] = null;
  }
  for (const f of MAPPABLE_FIELDS) claim(f.key, (h, a) => h === a);
  for (const f of MAPPABLE_FIELDS) {
    claim(f.key, (h, a) => h.includes(a) || a.includes(h));
  }

  // Validation sur échantillon : la colonne de l'identifiant d'opération doit
  // être non vide, et celle du client doit contenir du texte non numérique.
  const sampleNonEmpty = (idx: number | null): boolean => {
    if (idx === null) return false;
    return sampleRows.some((r) => (r[idx] ?? "").trim() !== "");
  };
  const sampleLooksTextual = (idx: number | null): boolean => {
    if (idx === null) return false;
    return sampleRows.some((r) => {
      const v = (r[idx] ?? "").trim();
      return v !== "" && !/^[\d\s.,-]+$/.test(v);
    });
  };

  const opOk = sampleNonEmpty(mapping.manar_op_id ?? null);
  const clientOk = sampleLooksTextual(mapping.donneur_ordre ?? null);

  const missingRequired = REQUIRED_FIELDS.filter((k) => {
    if (mapping[k] === null || mapping[k] === undefined) return true;
    if (k === "manar_op_id") return !opOk;
    if (k === "donneur_ordre") return !clientOk;
    return false;
  });

  // Signature historique : op en col 0 + client en col 8 → mapping par défaut.
  if (
    missingRequired.length === 0 &&
    mapping.manar_op_id === 0 &&
    mapping.donneur_ordre === 8
  ) {
    return { mapping: { ...DEFAULT_MAPPING }, confidence: "auto", missingRequired: [] };
  }

  return {
    mapping,
    confidence: missingRequired.length === 0 ? "auto" : "ambiguous",
    missingRequired,
  };
}
