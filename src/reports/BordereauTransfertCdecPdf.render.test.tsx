import { describe, expect, it } from "vitest";
import { renderToBuffer } from "@react-pdf/renderer";
import { registerTestFonts } from "./test-fonts";
import {
  BordereauTransfertCdecPdf,
  type BordereauTransfertCdecPdfProps,
} from "./templates/BordereauTransfertCdecPdf";

// Rendu RÉEL du gabarit (pas de mock) · seul un rendu réel attrape les erreurs
// runtime de react-pdf (police italique interdite, etc.).
registerTestFonts();

function sampleProps(hash: string): BordereauTransfertCdecPdfProps {
  return {
    sdb: { nom: "CCA Bourse", code: "CCAB" },
    destinataire: "CDEC",
    date_arrete: "2026-06-05",
    lignes: [
      {
        nom_client: "DUPONT Jean",
        compte_titres: "CT-MNR-A1B2C3",
        instrument: "Obligation État du Gabon 6% 2029",
        date_desherence: "2024-03-12",
        montant_xaf: 15_900_000,
      },
      {
        nom_client: "MBALLA Sophie",
        compte_titres: "CT-MNR-D4E5F6",
        instrument: "Action CCA Bank",
        date_desherence: "2023-11-30",
        montant_xaf: 4_800_000,
      },
      {
        nom_client: "ETABLISSEMENTS NKOLO SARL",
        compte_titres: "CT-MNR-G7H8I9",
        instrument: "Bon du Trésor BEAC 90 jours",
        date_desherence: null,
        montant_xaf: 2_531_250,
      },
    ],
    hash_sha256: hash,
    timestamp_rfc3161_mock: "2026-06-05T10:30:00.000Z",
    generation_date: "2026-06-05T10:30:00.000Z",
  };
}

describe("rendu réel · BordereauTransfertCdecPdf", () => {
  it("produit un PDF non vide commençant par %PDF", async () => {
    const buffer = await renderToBuffer(
      <BordereauTransfertCdecPdf {...sampleProps("e".repeat(64))} />,
    );
    expect(buffer.length).toBeGreaterThan(1000);
    expect(buffer.subarray(0, 5).toString("latin1")).toBe("%PDF-");
  });

  it("rend aussi un bordereau vide (aucun avoir à transférer, BEAC)", async () => {
    const props: BordereauTransfertCdecPdfProps = {
      ...sampleProps("f".repeat(64)),
      destinataire: "BEAC",
      lignes: [],
    };
    const buffer = await renderToBuffer(<BordereauTransfertCdecPdf {...props} />);
    expect(buffer.length).toBeGreaterThan(1000);
    expect(buffer.subarray(0, 5).toString("latin1")).toBe("%PDF-");
  });
});
