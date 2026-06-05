import { describe, expect, it } from "vitest";
import { renderToBuffer } from "@react-pdf/renderer";
import { registerTestFonts } from "./test-fonts";
import {
  LettreRelanceDesherencePdf,
  type LettreRelanceDesherencePdfProps,
} from "./templates/LettreRelanceDesherencePdf";

// Rendu RÉEL du gabarit (pas de mock) · seul un rendu réel attrape les erreurs
// runtime de react-pdf (police italique interdite, etc.).
registerTestFonts();

function sampleProps(hash: string): LettreRelanceDesherencePdfProps {
  return {
    sdb: { nom: "CCA Bourse", code: "CCAB" },
    client: {
      nom_complet: "DUPONT Jean",
      adresse: "BP 1234, Douala, Cameroun",
      type: "PP",
    },
    numero_compte: "CT-MNR-A1B2C3",
    derniere_manifestation: "2014-03-12",
    seuil_desherence_ans: 10,
    destinataire_transfert: "CDEC",
    date_emission: "2026-06-05",
    hash_sha256: hash,
    timestamp_rfc3161_mock: "2026-06-05T10:30:00.000Z",
    ville: "Douala",
  };
}

describe("rendu réel · LettreRelanceDesherencePdf", () => {
  it("produit un PDF non vide commençant par %PDF", async () => {
    const buffer = await renderToBuffer(
      <LettreRelanceDesherencePdf {...sampleProps("c".repeat(64))} />,
    );
    expect(buffer.length).toBeGreaterThan(1000);
    expect(buffer.subarray(0, 5).toString("latin1")).toBe("%PDF-");
  });

  it("rend aussi sans dernière manifestation connue (transfert BEAC)", async () => {
    const props: LettreRelanceDesherencePdfProps = {
      ...sampleProps("d".repeat(64)),
      derniere_manifestation: null,
      destinataire_transfert: "BEAC",
      client: { nom_complet: "MBALLA Sophie", adresse: "", type: "PP" },
    };
    const buffer = await renderToBuffer(<LettreRelanceDesherencePdf {...props} />);
    expect(buffer.length).toBeGreaterThan(1000);
    expect(buffer.subarray(0, 5).toString("latin1")).toBe("%PDF-");
  });
});
