import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { readManarWorkbook, parseManarXls, parseManarRows } from "./manar-parser";
import { detectMapping } from "./manar-detect";
import { DEFAULT_MAPPING, type ColumnMapping } from "./manar-fields";

// Garde anti-régression de l'auto-détection et du parsing piloté par mapping.

const SAMPLE = fileURLToPath(
  new URL(
    "../../samples/manar/ETAT DES INSRUMENTS SAISIS SUR MANAR-ANONYME.xlsx",
    import.meta.url,
  ),
);
const loadSample = (): Uint8Array => new Uint8Array(readFileSync(SAMPLE));

describe("auto-détection du format", () => {
  it("reconnaît le format historique (auto, mapping par défaut)", () => {
    const wb = readManarWorkbook(loadSample());
    const det = detectMapping(wb.headers, wb.sampleRows);
    expect(det.confidence).toBe("auto");
    expect(det.missingRequired).toHaveLength(0);
    expect(det.mapping.manar_op_id).toBe(0);
    expect(det.mapping.donneur_ordre).toBe(8);
    // Signature historique → mapping par défaut intégral.
    expect(det.mapping).toEqual(DEFAULT_MAPPING);
  });

  it("parsing identique avec mapping par défaut explicite", () => {
    const data = loadSample();
    const a = parseManarXls(data);
    const b = parseManarXls(data, DEFAULT_MAPPING);
    expect(a.totalRows).toBe(b.totalRows);
    expect(JSON.stringify(a.rows)).toBe(JSON.stringify(b.rows));
  });

  it("parse à l'identique un fichier aux colonnes permutées via un mapping", () => {
    const wb = readManarWorkbook(loadSample());
    const nbCols = Math.max(...wb.allRows.map((r) => (r ?? []).length));
    // Permutation inversée des colonnes (0↔dernière, etc.).
    const order = Array.from({ length: nbCols }, (_, i) => nbCols - 1 - i);
    const permutedRows = wb.allRows.map((r) =>
      r ? order.map((src) => r[src] ?? null) : r,
    );
    // mapping : index par défaut d'un champ → sa nouvelle position.
    const mapping: ColumnMapping = {};
    for (const [k, v] of Object.entries(DEFAULT_MAPPING)) {
      mapping[k] = v === null ? null : order.indexOf(v);
    }
    const remapped = parseManarRows(permutedRows, mapping);
    const ref = parseManarXls(loadSample());
    expect(remapped.totalRows).toBe(ref.totalRows);
    // On compare les champs nommés + la quantité (les extra_columns positionnels
    // diffèrent forcément après permutation, ce qui est attendu).
    const strip = (rows: typeof ref.rows) =>
      rows.map(({ extra_columns, ...rest }) => ({
        ...rest,
        quantite: extra_columns.quantite ?? null,
      }));
    expect(strip(remapped.rows)).toEqual(strip(ref.rows));
  });

  it("signale un format inconnu (ambiguous) quand les en-têtes ne matchent pas", () => {
    const det = detectMapping(
      ["colA", "colB", "colC"],
      [["x", "y", "z"]],
    );
    expect(det.confidence).toBe("ambiguous");
    expect(det.missingRequired).toContain("manar_op_id");
    expect(det.missingRequired).toContain("donneur_ordre");
  });
});
