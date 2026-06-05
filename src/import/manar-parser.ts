// Parsing du fichier Manar (54 colonnes) · porté de MIMS
// lib/services/manar/manar-parser.ts.
//
// Adaptation webview : le fichier arrive en Uint8Array (lu par Tauri fs), pas en
// Buffer Node. SheetJS lit alors en mode { type: 'array' }.
//
// Service pur, testable Vitest. La structure réelle du fichier comporte 2 lignes
// d'en-tête (titre + noms de colonnes) puis les lignes de données (≈166).
//
// Mapping des 54 colonnes (index → champ cible) : voir les commentaires inline.

import * as XLSX from "xlsx";

/** Ligne Manar mappée depuis les 54 colonnes réelles du fichier. */
export interface ManarRawRow {
  no_ordre: string | null; // col 2 · systématiquement vide
  manar_op_id: string; // col 0 · N° OPÉRATION · obligatoire
  date_operation: string | null; // col 11 · dd/mm/yyyy
  statut: "F" | "V" | "P" | "S"; // col 9
  isin: string | null; // col 50 · CODE ISIN
  libelle_instrument: string | null; // col 4 · DESC TITRE
  poste_code: string | null; // col 5 · POSTE
  emetteur_code: string | null; // col 51 · EMETTEUR
  nature_operation: string | null; // absent de ce fichier (null)
  valeur_nominale_xaf: string | null; // col 26 · MONTANTDEV
  prix_xaf: string | null; // col 25 · COURS
  montant_brut_xaf: string | null; // col 31 · MONTANT BRUT
  taux_interet: string | null; // col 41 · TAUX NEGOCIATION
  courus_xaf: string | null; // col 33 · INTERET COURU
  donneur_ordre: string | null; // col 8 · DESC PORTEFEUILLE
  operateur_saisie: string | null; // col 46 · OPE FRONT
  operateur_validation: string | null; // col 47 · OPE BACK
  date_saisie: string | null; // col 10 · DATE SAISI
  date_validation: string | null; // col 14 · DATE VALIDATION
  date_valeur: string | null; // col 12 · DATE VALEUR
  date_annulation: string | null; // col 15 · systématiquement vide
  compte_especes: string | null; // col 19 · systématiquement vide
  compte_titres_ctr_partie: string | null; // col 23 · systématiquement vide
  contrat: string | null; // col 35 · systématiquement vide
  ope_annulation: string | null; // col 48 · systématiquement vide
  date_echeance: string | null; // col 49 · systématiquement vide côté op
  commentaire: string | null; // pas de colonne dédiée (null)
  extra_columns: Record<string, string | null>; // colonnes restantes
}

export interface ManarParseWarning {
  row: number;
  column: string;
  message: string;
  severity: "LOW" | "MEDIUM";
}

export interface ManarParseResult {
  rows: ManarRawRow[];
  totalRows: number;
  warnings: ManarParseWarning[];
  emptyColumnsDetected: string[];
}

/** Magic bytes BIFF8 (Excel 97-2003 .xls) : D0 CF 11 E0 */
const BIFF8_MAGIC = [0xd0, 0xcf, 0x11, 0xe0];
/** Magic bytes ZIP (Open XML .xlsx contient un ZIP) : 50 4B 03 04 */
const ZIP_MAGIC = [0x50, 0x4b, 0x03, 0x04];

/** Colonnes extra (non mappées nommément) · stockées dans extra_columns. */
const EXTRA_COL_NAMES: Record<number, string> = {
  1: "no_evenement",
  3: "titre_code",
  6: "entite_code",
  7: "portefeuille_code",
  13: "date_livraison",
  16: "intermediaire",
  17: "depositaire",
  18: "compte_titres",
  20: "contrepartie",
  21: "desc_contrepartie",
  22: "depositaire_ctr_partie",
  24: "quantite",
  27: "devise_ref",
  28: "taux_ref",
  29: "devise_reg",
  30: "frais_tot",
  32: "montant_net",
  34: "pmv_back",
  36: "titre_jouissance",
  37: "titre_echeance",
  38: "nego_prix",
  39: "nego_ppc",
  40: "nego_spread",
  42: "taux_placement",
  43: "nbre_jours_placement",
  44: "interets",
  45: "decalage_valeur",
  52: "classe",
  53: "categorie",
};

/** Valeurs sémantiques nulles Manar. */
const NULL_VALUES = new Set(["NEANT", "NULL", "N/A", "NA", "-"]);

/**
 * Normalise une valeur brute Manar.
 * 'NEANT' | 'NULL' | 'N/A' | 'NA' | '-' | '' | '  ' → null. Insensible à la casse.
 */
export function normalizeManarValue(
  raw: string | null | undefined,
): string | null {
  if (raw === null || raw === undefined) return null;
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  if (NULL_VALUES.has(trimmed.toUpperCase())) return null;
  return trimmed;
}

/**
 * Parse une date française "dd/mm/yyyy" en ISO "yyyy-mm-dd".
 * Regex stricte + validation des plages (jour 1-31, mois 1-12, année 1900-2100)
 * pour éviter des chaînes ISO invalides.
 */
export function parseManarDate(raw: string | null): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!/^\d{2}\/\d{2}\/\d{4}$/.test(trimmed)) return null;
  const [dd, mm, yyyy] = trimmed.split("/");
  const d = parseInt(dd, 10);
  const m = parseInt(mm, 10);
  const y = parseInt(yyyy, 10);
  if (d < 1 || d > 31 || m < 1 || m > 12 || y < 1900 || y > 2100) return null;
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Parse un montant en number. Supporte le format numérique brut et le format
 * français (espace insécable U+00A0 en milliers, virgule décimale).
 */
export function parseManarAmount(raw: string | null): number | null {
  if (!raw) return null;
  const normalized = raw.replace(/[\s ]/g, "").replace(",", ".");
  if (!normalized) return null;
  const parsed = parseFloat(normalized);
  return isNaN(parsed) ? null : parsed;
}

/**
 * Parse un fichier Manar (54 colonnes) en ManarRawRow[].
 *
 * @param data · contenu binaire du fichier (Uint8Array, fourni par Tauri fs)
 * @throws Error si les magic bytes XLS/XLSX sont absents ou si le fichier est vide
 */
export function parseManarXls(data: Uint8Array): ManarParseResult {
  // Sécurité : vérification des magic bytes XLS (BIFF8) ou XLSX (ZIP).
  if (data.length < 4) {
    throw new Error(
      "Fichier invalide · trop court pour être un fichier XLS/XLSX (magic bytes absents)",
    );
  }
  const isBiff8 = BIFF8_MAGIC.every((b, i) => data[i] === b);
  const isZip = ZIP_MAGIC.every((b, i) => data[i] === b);
  if (!isBiff8 && !isZip) {
    const hex = (i: number) => data[i].toString(16).padStart(2, "0");
    throw new Error(
      `Fichier invalide · magic bytes XLS (D0 CF 11 E0) ou XLSX (50 4B 03 04) attendus, trouvé : ` +
        `${hex(0)} ${hex(1)} ${hex(2)} ${hex(3)}`,
    );
  }

  // Lecture du workbook · cellDates: false obligatoire (dates françaises gérées
  // manuellement). type: 'array' pour un Uint8Array (build navigateur).
  let wb: XLSX.WorkBook;
  try {
    wb = XLSX.read(data, { type: "array", cellDates: false });
  } catch (e) {
    try {
      wb = XLSX.read(data, { type: "array", cellDates: false, codepage: 1252 });
    } catch {
      throw new Error(`Impossible de lire le fichier XLS : ${String(e)}`);
    }
  }

  if (!wb.SheetNames.length) {
    throw new Error("Fichier XLS sans feuille de calcul");
  }
  const ws = wb.Sheets[wb.SheetNames[0]];
  if (!ws) {
    throw new Error("Feuille de calcul introuvable dans le fichier XLS");
  }

  // header:1 (index numérique), raw:false (tout en string) pour éviter les
  // objets Date natifs.
  const allRows = XLSX.utils.sheet_to_json(ws, {
    header: 1,
    defval: null,
    raw: false,
  }) as (unknown[] | null)[];

  if (!allRows || allRows.length === 0) {
    throw new Error("Fichier XLS vide ou sans données");
  }

  // Ignorer les 2 lignes d'en-tête (titre du rapport + noms de colonnes).
  const dataRows = allRows.slice(2);

  const rows: ManarRawRow[] = [];
  const warnings: ManarParseWarning[] = [];

  for (let rowIdx = 0; rowIdx < dataRows.length; rowIdx++) {
    const rawRow = dataRows[rowIdx];
    if (!rawRow || rawRow.length === 0) continue;

    if (rawRow.length > 54) {
      warnings.push({
        row: rowIdx + 3, // 2 lignes d'en-tête + index 1-based
        column: `col_${rawRow.length - 1}`,
        message: `Colonnes supplémentaires détectées (${rawRow.length} colonnes au lieu de 54)`,
        severity: "MEDIUM",
      });
    }

    const cell = (idx: number): string | null => {
      const v = rawRow[idx];
      if (v === null || v === undefined) return null;
      return normalizeManarValue(String(v).trim());
    };

    // manar_op_id (col 0) obligatoire.
    const manar_op_id = cell(0);
    if (!manar_op_id) continue;

    const rawStatut = cell(9);
    const VALID_STATUTS = ["F", "V", "P", "S"];
    const statut =
      rawStatut && VALID_STATUTS.includes(rawStatut)
        ? (rawStatut as "F" | "V" | "P" | "S")
        : "F";

    const extra_columns: Record<string, string | null> = {};
    for (const [idxStr, name] of Object.entries(EXTRA_COL_NAMES)) {
      const idx = parseInt(idxStr, 10);
      if (idx < rawRow.length) {
        extra_columns[name] = cell(idx);
      }
    }

    rows.push({
      no_ordre: cell(2),
      manar_op_id,
      date_operation: cell(11),
      statut,
      isin: cell(50),
      libelle_instrument: cell(4),
      poste_code: cell(5),
      emetteur_code: cell(51),
      nature_operation: null,
      valeur_nominale_xaf: cell(26),
      prix_xaf: cell(25),
      montant_brut_xaf: cell(31),
      taux_interet: cell(41),
      courus_xaf: cell(33),
      donneur_ordre: cell(8),
      operateur_saisie: cell(46),
      operateur_validation: cell(47),
      date_saisie: cell(10),
      date_validation: cell(14),
      date_valeur: cell(12),
      date_annulation: cell(15),
      compte_especes: cell(19),
      compte_titres_ctr_partie: cell(23),
      contrat: cell(35),
      ope_annulation: cell(48),
      date_echeance: cell(49),
      commentaire: null,
      extra_columns,
    });
  }

  return {
    rows,
    totalRows: rows.length,
    warnings,
    emptyColumnsDetected: [
      "no_ordre",
      "date_annulation",
      "compte_especes",
      "compte_titres_ctr_partie",
      "contrat",
      "ope_annulation",
      "date_echeance",
    ],
  };
}
