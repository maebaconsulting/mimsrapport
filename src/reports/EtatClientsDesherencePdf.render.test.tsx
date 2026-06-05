import { describe, expect, it } from "vitest";
import { renderToBuffer } from "@react-pdf/renderer";
import { registerTestFonts } from "./test-fonts";
import {
  EtatClientsDesherencePdf,
  type EtatClientsDesherencePdfProps,
} from "./templates/EtatClientsDesherencePdf";

// Rendu RÉEL du gabarit (pas de mock) · seul un rendu réel attrape les erreurs
// runtime de react-pdf (police italique interdite, colonnes inexistantes, etc.).
registerTestFonts();

function sampleProps(hash: string): EtatClientsDesherencePdfProps {
  return {
    sdb: { nom: "CCA Bourse", code: "CCAB", contact: "conformite@ccabourse.cm" },
    date_arrete: "2026-06-05",
    seuils: { inactif_mois: 12, desherence_ans: 10 },
    lignes: [
      {
        nom_client: "DUPONT Jean",
        compte_titres: "CT-MNR-A1B2C3",
        nature_instrument: "Obligation État du Gabon 6% 2029",
        date_souscription: "2014-03-12",
        date_maturite: "2029-03-12",
        montant_investi_xaf: 15_000_000,
        coupon_xaf: 900_000,
        montant_a_reverser_xaf: 15_900_000,
        motif: "INSTRUMENT_ECHU_NON_RECLAME",
        date_desherence: "2024-03-12",
      },
      {
        nom_client: "MBALLA Sophie",
        compte_titres: "CT-MNR-D4E5F6",
        nature_instrument: "Action CCA Bank",
        date_souscription: "2012-09-01",
        date_maturite: null,
        montant_investi_xaf: 4_800_000,
        coupon_xaf: 0,
        montant_a_reverser_xaf: 4_800_000,
        motif: "TITULAIRE_INJOIGNABLE",
        date_desherence: "2023-11-30",
      },
      {
        nom_client: "ETABLISSEMENTS NKOLO SARL",
        compte_titres: "CT-MNR-G7H8I9",
        nature_instrument: "Bon du Trésor BEAC 90 jours",
        date_souscription: "2015-06-15",
        date_maturite: "2015-09-15",
        montant_investi_xaf: 2_500_000,
        coupon_xaf: 31_250,
        montant_a_reverser_xaf: 2_531_250,
        motif: "COUPON_NON_ENCAISSE",
        date_desherence: "2025-01-20",
      },
    ],
    hash_sha256: hash,
    timestamp_rfc3161_mock: "2026-06-05T10:30:00.000Z",
    generation_date: "2026-06-05T10:30:00.000Z",
  };
}

describe("rendu réel · EtatClientsDesherencePdf", () => {
  it("produit un PDF non vide commençant par %PDF", async () => {
    const buffer = await renderToBuffer(
      <EtatClientsDesherencePdf {...sampleProps("a".repeat(64))} />,
    );
    expect(buffer.length).toBeGreaterThan(1000);
    expect(buffer.subarray(0, 5).toString("latin1")).toBe("%PDF-");
  });

  it("rend aussi un état vide (aucun client en déshérence)", async () => {
    const props = { ...sampleProps("b".repeat(64)), lignes: [] };
    const buffer = await renderToBuffer(<EtatClientsDesherencePdf {...props} />);
    expect(buffer.length).toBeGreaterThan(1000);
    expect(buffer.subarray(0, 5).toString("latin1")).toBe("%PDF-");
  });
});
