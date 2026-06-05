// Rendu RÉEL du gabarit Confirmation d'ouverture de compte (pas de mock) · seul un
// rendu réel attrape les erreurs runtime de react-pdf (police italique interdite,
// police mal enregistrée). En environnement Node de test, on enregistre les
// polices par chemin disque via registerTestFonts.

import { describe, expect, it } from "vitest";
import { renderToBuffer } from "@react-pdf/renderer";
import { registerTestFonts } from "./test-fonts";
import {
  ConfirmationOuverturePdf,
  type ConfirmationOuverturePdfProps,
} from "./templates/ConfirmationOuverturePdf";

registerTestFonts();

function samplePropsPP(hash: string): ConfirmationOuverturePdfProps {
  return {
    sdb: { nom: "CCA Bourse", code: "CCAB" },
    client: {
      nom_complet: "DUPONT Jean",
      adresse: "Quartier Glass, BP 1234, Libreville, Gabon",
      type: "PP",
    },
    numero_compte: "PORT-CT-MNR-A1B2C3",
    date_ouverture: "2026-05-20",
    date_emission: "2026-06-05",
    hash_sha256: hash,
    timestamp_rfc3161_mock: "2026-06-05T10:30:00.000Z",
    ville: "Libreville",
  };
}

function samplePropsPM(hash: string): ConfirmationOuverturePdfProps {
  return {
    sdb: { nom: "CCA Bourse", code: "CCAB" },
    client: {
      nom_complet: "CCA BANK SA",
      adresse: "Avenue du Commerce, BP 5678, Douala, Cameroun",
      type: "PM",
    },
    numero_compte: "PORT-CT-PM-99887766",
    date_ouverture: "2026-04-15",
    date_emission: "2026-06-05",
    hash_sha256: hash,
    timestamp_rfc3161_mock: "2026-06-05T10:30:00.000Z",
  };
}

describe("rendu réel · ConfirmationOuverturePdf", () => {
  it("produit un PDF non vide commençant par %PDF (client PP)", async () => {
    const buffer = await renderToBuffer(
      <ConfirmationOuverturePdf {...samplePropsPP("0".repeat(64))} />,
    );
    expect(buffer.length).toBeGreaterThan(1000);
    expect(buffer.subarray(0, 5).toString("latin1")).toBe("%PDF-");
  });

  it("rend aussi un client PM et un cas limite sans adresse", async () => {
    const props: ConfirmationOuverturePdfProps = {
      ...samplePropsPM("abc"),
      client: { ...samplePropsPM("abc").client, adresse: "" },
    };
    const buffer = await renderToBuffer(<ConfirmationOuverturePdf {...props} />);
    expect(buffer.length).toBeGreaterThan(1000);
    expect(buffer.subarray(0, 5).toString("latin1")).toBe("%PDF-");
  });
});
