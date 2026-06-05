// -*- coding: utf-8 -*-
// Rendu RÉEL du gabarit Compte rendu des transactions réalisées · pas de mock.
// Seul un rendu réel attrape les erreurs runtime de react-pdf (police italique
// interdite, colonnes inexistantes, police mal enregistrée).

import { describe, expect, it } from "vitest";
import { renderToBuffer } from "@react-pdf/renderer";
import { registerTestFonts } from "./test-fonts";
import {
  CompteRenduTransactionsPdf,
  type CompteRenduTransactionsPdfProps,
} from "./templates/CompteRenduTransactionsPdf";

registerTestFonts();

function sampleProps(hash: string): CompteRenduTransactionsPdfProps {
  return {
    sdb: {
      nom: "CCA Bourse",
      code: "CCAB",
      rccm: "RC/DLA/2014/B/1234",
      agrement: "COSUMAF-SDB-007",
    },
    ordre: {
      code_ordre: "ORD-2026-000142",
      statut: "EXECUTE",
      sens: "ACHAT",
      type: "LIMITE",
      quantite: 1_500,
      prix_limite: 10_250,
      brut: 15_375_000,
      courus: 125_000,
      frais: 76_875,
      net: 15_576_875,
      created_at: "2026-06-05T09:15:00.000Z",
    },
    client: {
      code: "CT-MNR-A1B2C3",
      nom: "DUPONT Jean",
      classification_risque: "Non professionnel",
      date_validite_kyc: "2027-01-31",
    },
    instrument: {
      libelle: "Obligation État du Gabon 6% 2029",
      isin: "GA0000123456",
    },
    workflow: [
      {
        etape: "SAISIE",
        acteur_nom: "MBALLA Sophie",
        created_at: "2026-06-05T09:15:00.000Z",
        commentaire: null,
      },
      {
        etape: "CONTROLE_AUTO",
        acteur_nom: "Système",
        created_at: "2026-06-05T09:15:30.000Z",
        commentaire: null,
      },
      {
        etape: "VALIDATION_MIDDLE",
        acteur_nom: "NGUEMA Paul",
        created_at: "2026-06-05T09:40:00.000Z",
        commentaire: "Contrôle quatre yeux validé",
      },
      {
        etape: "EXECUTION",
        acteur_nom: "BVMAC",
        created_at: "2026-06-05T10:05:00.000Z",
        commentaire: null,
      },
    ],
    signatures: {
      front: {
        nom: "MBALLA Sophie",
        date: "2026-06-05T09:15:00.000Z",
        audit_id: "a1b2c3d4e5f6",
      },
      middle: {
        nom: "NGUEMA Paul",
        date: "2026-06-05T09:40:00.000Z",
        audit_id: "f6e5d4c3b2a1",
      },
    },
    hash_sha256: hash,
    timestamp_rfc3161_mock: "2026-06-05T10:30:00.000Z",
  };
}

describe("rendu réel · CompteRenduTransactionsPdf", () => {
  it("produit un PDF non vide commençant par %PDF", async () => {
    const buffer = await renderToBuffer(
      <CompteRenduTransactionsPdf {...sampleProps("0".repeat(64))} />,
    );
    expect(buffer.length).toBeGreaterThan(1000);
    expect(buffer.subarray(0, 5).toString("latin1")).toBe("%PDF-");
  });

  it("rend un ordre VENTE au marché, Middle absent et workflow vide", async () => {
    const base = sampleProps("abc123");
    const props: CompteRenduTransactionsPdfProps = {
      ...base,
      ordre: {
        ...base.ordre,
        code_ordre: "ORD-2026-000200",
        statut: "SAISI",
        sens: "VENTE",
        type: "AU_MARCHE",
        prix_limite: null,
      },
      instrument: { libelle: "Action CCA Bank", isin: "GA0000654321" },
      workflow: [],
      signatures: { ...base.signatures, middle: null },
    };
    const buffer = await renderToBuffer(<CompteRenduTransactionsPdf {...props} />);
    expect(buffer.length).toBeGreaterThan(1000);
    expect(buffer.subarray(0, 5).toString("latin1")).toBe("%PDF-");
  });
});
