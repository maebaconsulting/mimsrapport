import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { readManarWorkbook, parseManarXls } from "./manar-parser";
import { detectMapping } from "./manar-detect";
import { DEFAULT_MAPPING } from "./manar-fields";

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
