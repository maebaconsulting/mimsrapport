// Rendu RÉEL du gabarit Relevé de compte-titres (pas de mock) · seul un rendu réel
// attrape les erreurs runtime de react-pdf (police italique interdite, colonnes
// inexistantes, police mal enregistrée). En environnement Node de test, on
// enregistre les polices par chemin disque via registerTestFonts.

import { describe, expect, it } from "vitest";
import { renderToBuffer } from "@react-pdf/renderer";
import { registerTestFonts } from "./test-fonts";
import {
  ReleveCompteTitresPdf,
  type ReleveCompteTitresPdfProps,
} from "./templates/ReleveCompteTitresPdf";

registerTestFonts();

function sampleProps(hash: string): ReleveCompteTitresPdfProps {
  return {
    sdb: { nom: "CCA Bourse", code: "CCAB" },
    client: {
      code: "CT-MNR-A1B2C3",
      nom_complet: "DUPONT Jean",
      type: "PP",
      cni_passeport: "GA-PP-0098231",
      nationalite: "Gabonaise",
      adresse: "Quartier Glass, BP 1234, Libreville, Gabon",
    },
    periode: { debut: "2026-01-01", fin: "2026-06-05" },
    iban_mock: "GA21 30001 00000 1234567890 11",
    positions: [
      {
        isin: "GA0000010101",
        libelle: "Obligation État du Gabon 6% 2029",
        classe: "OBLIGATION",
        quantite: 1500,
        prix_moyen_pondere: 10_000,
        valorisation_xaf: 15_000_000,
        devise: "XAF",
      },
      {
        isin: "GA0000020202",
        libelle: "Action CCA Bank",
        classe: "ACTION",
        quantite: 320,
        prix_moyen_pondere: 15_000,
        valorisation_xaf: 4_800_000,
        devise: "XAF",
      },
    ],
    mouvements: [
      {
        date: "2026-02-12",
        libelle: "Achat Obligation État du Gabon",
        isin: "GA0000010101",
        sens: "ACHAT",
        quantite: 500,
        prix: 10_000,
        montant_xaf: 5_000_000,
      },
      {
        date: "2026-04-03",
        libelle: "Vente Action CCA Bank",
        isin: "GA0000020202",
        sens: "VENTE",
        quantite: 80,
        prix: 15_000,
        montant_xaf: 1_200_000,
      },
    ],
    synthese: {
      valorisation_debut: 16_500_000,
      valorisation_fin: 19_800_000,
      gain_perte: 3_300_000,
      frais_collectes: 45_000,
    },
    hash_sha256: hash,
    timestamp_rfc3161_mock: "2026-06-05T10:30:00.000Z",
    ville: "Libreville",
  };
}

describe("rendu réel · ReleveCompteTitresPdf", () => {
  it("produit un PDF non vide commençant par %PDF", async () => {
    const buffer = await renderToBuffer(
      <ReleveCompteTitresPdf {...sampleProps("0".repeat(64))} />,
    );
    expect(buffer.length).toBeGreaterThan(1000);
    expect(buffer.subarray(0, 5).toString("latin1")).toBe("%PDF-");
  });

  it("rend aussi un relevé vide (aucune position ni mouvement)", async () => {
    const props: ReleveCompteTitresPdfProps = {
      ...sampleProps("abc"),
      positions: [],
      mouvements: [],
      synthese: {
        valorisation_debut: null,
        valorisation_fin: 0,
        gain_perte: -120_000,
        frais_collectes: 0,
      },
    };
    const buffer = await renderToBuffer(<ReleveCompteTitresPdf {...props} />);
    expect(buffer.length).toBeGreaterThan(1000);
    expect(buffer.subarray(0, 5).toString("latin1")).toBe("%PDF-");
  });
});
