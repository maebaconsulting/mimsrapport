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
import {
  DEFAULT_MAPPING,
  DEFAULT_HEADER_ROWS,
  EXTRA_COL_NAMES,
  type ColumnMapping,
} from "./manar-fields";

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

/** Aperçu de structure d'un classeur, pour l'auto-détection et l'UI de mapping. */
export interface WorkbookPreview {
  /** Ligne des noms de colonnes (dernière ligne d'en-tête). */
  headers: string[];
  /** Quelques lignes de données, en chaînes, pour aperçu. */
  sampleRows: string[][];
  /** Toutes les lignes brutes (en-têtes inclus). */
  allRows: (unknown[] | null)[];
  sheetName: string;
}

/** Vérifie les magic bytes XLS/XLSX et lève si le format est invalide. */
function assertWorkbookBytes(data: Uint8Array): void {
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
}

/**
 * Lit le classeur et renvoie ses lignes brutes + un aperçu (en-têtes + échantillon).
 * Une seule lecture SheetJS, réutilisée par l'auto-détection, l'UI de mapping et le parsing.
 *
 * @param data · contenu binaire du fichier (Uint8Array, fourni par Tauri fs)
 * @throws Error si les magic bytes XLS/XLSX sont absents ou si le fichier est vide
 */
export function readManarWorkbook(
  data: Uint8Array,
  headerRows: number = DEFAULT_HEADER_ROWS,
): WorkbookPreview {
  assertWorkbookBytes(data);

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
  const sheetName = wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  if (!ws) {
    throw new Error("Feuille de calcul introuvable dans le fichier XLS");
  }

  const allRows = XLSX.utils.sheet_to_json(ws, {
    header: 1,
    defval: null,
    raw: false,
  }) as (unknown[] | null)[];

  if (!allRows || allRows.length === 0) {
    throw new Error("Fichier XLS vide ou sans données");
  }

  const toStr = (v: unknown): string =>
    v === null || v === undefined ? "" : String(v).trim();
  const headerRow = allRows[Math.max(0, headerRows - 1)] ?? [];
  const headers = (headerRow as unknown[]).map(toStr);
  const sampleRows = allRows
    .slice(headerRows, headerRows + 5)
    .map((r) => (r ?? []).map(toStr));

  return { headers, sampleRows, allRows, sheetName };
}

/**
 * Transforme les lignes brutes en ManarRawRow[] selon une `ColumnMapping`.
 * Chaque champ logique est résolu vers son index de colonne ; un champ non mappé
 * (index null) vaut null. `manar_op_id` est obligatoire (ligne ignorée si absent).
 */
export function parseManarRows(
  allRows: (unknown[] | null)[],
  mapping: ColumnMapping = DEFAULT_MAPPING,
  headerRows: number = DEFAULT_HEADER_ROWS,
): ManarParseResult {
  const dataRows = allRows.slice(headerRows);
  const rows: ManarRawRow[] = [];
  const warnings: ManarParseWarning[] = [];

  for (let rowIdx = 0; rowIdx < dataRows.length; rowIdx++) {
    const rawRow = dataRows[rowIdx];
    if (!rawRow || rawRow.length === 0) continue;

    if (rawRow.length > 54) {
      warnings.push({
        row: rowIdx + headerRows + 1,
        column: `col_${rawRow.length - 1}`,
        message: `Colonnes supplémentaires détectées (${rawRow.length} colonnes au lieu de 54)`,
        severity: "MEDIUM",
      });
    }

    // Résout un champ logique vers sa valeur normalisée via le mapping.
    const field = (key: string): string | null => {
      const idx = mapping[key];
      if (idx === null || idx === undefined) return null;
      const v = rawRow[idx];
      if (v === null || v === undefined) return null;
      return normalizeManarValue(String(v).trim());
    };

    const manar_op_id = field("manar_op_id");
    if (!manar_op_id) continue;

    const rawStatut = field("statut");
    const VALID_STATUTS = ["F", "V", "P", "S"];
    const statut =
      rawStatut && VALID_STATUTS.includes(rawStatut)
        ? (rawStatut as "F" | "V" | "P" | "S")
        : "F";

    // extra_columns : remplissage positionnel (format historique), puis la
    // quantité éventuellement remappée prime (utile aux fichiers réordonnés).
    const extra_columns: Record<string, string | null> = {};
    for (const [idxStr, name] of Object.entries(EXTRA_COL_NAMES)) {
      const idx = parseInt(idxStr, 10);
      if (idx < rawRow.length) {
        const v = rawRow[idx];
        extra_columns[name] =
          v === null || v === undefined
            ? null
            : normalizeManarValue(String(v).trim());
      }
    }
    if (mapping.quantite !== null && mapping.quantite !== undefined) {
      extra_columns.quantite = field("quantite");
    }

    rows.push({
      no_ordre: field("no_ordre"),
      manar_op_id,
      date_operation: field("date_operation"),
      statut,
      isin: field("isin"),
      libelle_instrument: field("libelle_instrument"),
      poste_code: field("poste_code"),
      emetteur_code: field("emetteur_code"),
      nature_operation: null,
      valeur_nominale_xaf: field("valeur_nominale_xaf"),
      prix_xaf: field("prix_xaf"),
      montant_brut_xaf: field("montant_brut_xaf"),
      taux_interet: field("taux_interet"),
      courus_xaf: field("courus_xaf"),
      donneur_ordre: field("donneur_ordre"),
      operateur_saisie: field("operateur_saisie"),
      operateur_validation: field("operateur_validation"),
      date_saisie: field("date_saisie"),
      date_validation: field("date_validation"),
      date_valeur: field("date_valeur"),
      date_annulation: field("date_annulation"),
      compte_especes: field("compte_especes"),
      compte_titres_ctr_partie: field("compte_titres_ctr_partie"),
      contrat: field("contrat"),
      ope_annulation: field("ope_annulation"),
      date_echeance: field("date_echeance"),
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

/**
 * Parse un fichier d'export en ManarRawRow[]. Façade rétrocompatible :
 * `parseManarXls(data)` applique le mapping par défaut (format historique).
 *
 * @param data · contenu binaire du fichier (Uint8Array)
 * @param mapping · correspondance champ logique → index (défaut : format historique)
 */
export function parseManarXls(
  data: Uint8Array,
  mapping: ColumnMapping = DEFAULT_MAPPING,
  headerRows: number = DEFAULT_HEADER_ROWS,
): ManarParseResult {
  const wb = readManarWorkbook(data, headerRows);
  return parseManarRows(wb.allRows, mapping, headerRows);
}
