// -*- coding: utf-8 -*-
// Rendu RÉEL du gabarit Rapport de réconciliation Manar Bridge · pas de mock.
// Seul un rendu réel attrape les erreurs runtime de react-pdf (police italique
// interdite, colonnes inexistantes, police mal enregistrée).

import { describe, expect, it } from "vitest";
import { renderToBuffer } from "@react-pdf/renderer";
import { registerTestFonts } from "./test-fonts";
import {
  ManarReconciliationReport,
  type ManarReconciliationReportProps,
} from "./templates/ManarReconciliationReport";

registerTestFonts();

function sampleProps(): ManarReconciliationReportProps {
  return {
    importId: "9f8e7d6c5b4a3210",
    fileName: "manar_export_2026-06-05.csv",
    fileHash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    importedAt: "2026-06-05T08:00:00.000Z",
    operateur: "MBALLA Sophie",
    durationMs: 4_250,
    nbOperations: 1_284,
    montantTotalXaf: 4_512_750_000,
    sdbName: "CCA BOURSE",
    statutBreakdown: [
      { statut: "F", nb: 820, montant: 3_100_000_000 },
      { statut: "V", nb: 310, montant: 980_000_000 },
      { statut: "P", nb: 110, montant: 380_750_000 },
      { statut: "S", nb: 44, montant: 52_000_000 },
    ],
    emetteurBreakdown: [
      { code: "GA0000123456", nb: 540, pct: 42.1, montant: 2_100_000_000 },
      { code: "GA0000654321", nb: 410, pct: 31.9, montant: 1_450_750_000 },
      { code: "CM0000111222", nb: 334, pct: 26.0, montant: 962_000_000 },
    ],
    operateurBreakdown: [
      {
        nom: "MBALLA Sophie",
        nbSaisies: 720,
        pctSaisies: 56.1,
        nbValidations: 410,
        pctValidations: 48.5,
      },
      {
        nom: "NGUEMA Paul",
        nbSaisies: 564,
        pctSaisies: 43.9,
        nbValidations: 435,
        pctValidations: 51.5,
      },
    ],
    preReferencesCount: 2,
    preReferences: [
      { type: "EMETTEUR", code: "GA0000999888", count: 12 },
      { type: "POSTE", code: "PST-0042", count: 1 },
    ],
    exportedAt: "2026-06-05T10:30:00.000Z",
    hash_sha256: "a".repeat(64),
  };
}

describe("rendu réel · ManarReconciliationReport", () => {
  it("produit un PDF non vide commençant par %PDF", async () => {
    const buffer = await renderToBuffer(
      <ManarReconciliationReport {...sampleProps()} />,
    );
    expect(buffer.length).toBeGreaterThan(1000);
    expect(buffer.subarray(0, 5).toString("latin1")).toBe("%PDF-");
  });

  it("rend un rapport sans opérateurs, sans pré-références et hash absent", async () => {
    const base = sampleProps();
    const props: ManarReconciliationReportProps = {
      ...base,
      statutBreakdown: [{ statut: "F", nb: 1, montant: 0 }],
      emetteurBreakdown: [],
      operateurBreakdown: [],
      preReferencesCount: 0,
      preReferences: [],
      hash_sha256: undefined,
    };
    const buffer = await renderToBuffer(<ManarReconciliationReport {...props} />);
    expect(buffer.length).toBeGreaterThan(1000);
    expect(buffer.subarray(0, 5).toString("latin1")).toBe("%PDF-");
  });
});
