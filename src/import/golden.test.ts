import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { ingestManarBytes } from "./manar-ingestor";

// Golden-file · import complet de l'échantillon anonymisé (166 opérations).
// Vérifie de bout en bout le pipeline parsing → mapping → dérivation des 6
// entités avec des comptages et montants déterministes. Toute régression du
// parser ou des heuristiques de dérivation casse ce test.

const SAMPLE = fileURLToPath(
  new URL(
    "../../samples/manar/ETAT DES INSRUMENTS SAISIS SUR MANAR-ANONYME.xlsx",
    import.meta.url,
  ),
);

function loadSample(): Uint8Array {
  return new Uint8Array(readFileSync(SAMPLE));
}

describe("golden-file Manar", () => {
  const { parseResult, mappingResult, derived, reconciliationAggs } =
    ingestManarBytes(loadSample());

  it("parse les 166 opérations", () => {
    expect(parseResult.totalRows).toBe(166);
    expect(mappingResult.rows.length).toBe(166);
  });

  it("ne produit aucune pré-référence (tous codes POSTE/ÉMETTEUR connus)", () => {
    expect(mappingResult.preReferences).toHaveLength(0);
  });

  it("dérive le bon nombre d'entités", () => {
    expect(derived.emetteurs).toHaveLength(10);
    expect(derived.instruments).toHaveLength(59);
    expect(derived.clients).toHaveLength(80);
    expect(derived.portefeuilles).toHaveLength(80);
    expect(derived.mouvements).toHaveLength(166);
    expect(derived.positions).toHaveLength(129);
  });

  it("répartit clients PP/PM de façon déterministe", () => {
    const pp = derived.clients.filter((c) => c.type === "PP").length;
    const pm = derived.clients.filter((c) => c.type === "PM").length;
    expect(pp).toBe(61);
    expect(pm).toBe(19);
    expect(pp + pm).toBe(derived.clients.length);
  });

  it("dérive un portefeuille par client", () => {
    expect(derived.portefeuilles).toHaveLength(derived.clients.length);
    for (const p of derived.portefeuilles) {
      expect(p.code).toBe(`PORT-${p.client_code}`);
    }
  });

  it("n'inclut dans les positions que les mouvements VALIDE", () => {
    const valides = derived.mouvements.filter(
      (m) => m.statut === "VALIDE",
    ).length;
    expect(valides).toBe(163); // 166 - 3 (EN_ATTENTE/SUSPENDU)
    // Toutes les positions ont une quantité strictement positive.
    for (const pos of derived.positions) {
      expect(pos.quantite_totale).toBeGreaterThan(0);
    }
    const totalQte = derived.positions.reduce(
      (s, p) => s + p.quantite_totale,
      0,
    );
    expect(totalQte).toBe(12_885_952);
  });

  it("calcule le montant brut total de réconciliation", () => {
    const montant = reconciliationAggs.reduce(
      (s, a) => s + a.manar_montant_brut_xaf,
      0,
    );
    expect(Math.round(montant)).toBe(177_065_150_663);
  });

  it("génère des codes synthétiques au format attendu", () => {
    for (const c of derived.clients) {
      expect(c.code).toMatch(/^CT-MNR-[0-9A-F]{6}$/);
      if (c.type === "PM") {
        expect(c.rccm).toMatch(/^CM-MIGR-9999-X-\d{6}$/);
      }
    }
    for (const inst of derived.instruments) {
      expect(inst.code_mims).toBe(`MNR-${inst.isin}`);
    }
  });
});
