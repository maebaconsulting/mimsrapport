import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { Font, renderToBuffer } from "@react-pdf/renderer";
import {
  AttestationPortefeuillePdf,
  type AttestationPortefeuillePdfProps,
} from "./templates/AttestationPortefeuillePdf";

// Rendu RÉEL du gabarit (pas de mock) · leçon MIMS : seul un rendu réel attrape
// les erreurs runtime de react-pdf (police italique interdite sur Inter, colonnes
// inexistantes, police mal enregistrée). En environnement Node de test, on
// enregistre les polices par chemin disque ; l'app, elle, les charge par URL.

const fontPath = (name: string) =>
  fileURLToPath(new URL(`../../public/fonts/${name}`, import.meta.url));

Font.register({
  family: "Inter",
  fonts: [
    { src: fontPath("Inter-Regular.ttf"), fontWeight: 400 },
    { src: fontPath("Inter-SemiBold.ttf"), fontWeight: 600 },
  ],
});
Font.register({
  family: "JetBrainsMono",
  fonts: [
    { src: fontPath("JetBrainsMono-Regular.ttf"), fontWeight: 400 },
    { src: fontPath("JetBrainsMono-SemiBold.ttf"), fontWeight: 600 },
  ],
});

function sampleProps(hash: string): AttestationPortefeuillePdfProps {
  return {
    sdb: { nom: "CCA Bourse", code: "CCAB" },
    client: { code: "CT-MNR-A1B2C3", nom_complet: "DUPONT Jean", type: "PP" },
    numero_compte: "PORT-CT-MNR-A1B2C3",
    date_arrete: "2026-06-05",
    lignes: [
      { libelle: "Obligation État du Gabon 6% 2029", quantite: 1500, valorisation_xaf: 15_000_000 },
      { libelle: "Action CCA Bank", quantite: 320, valorisation_xaf: 4_800_000 },
    ],
    hash_sha256: hash,
    timestamp_rfc3161_mock: "2026-06-05T10:30:00.000Z",
    ville: "Douala",
  };
}

describe("rendu réel · AttestationPortefeuillePdf", () => {
  it("produit un PDF non vide commençant par %PDF", async () => {
    const buffer = await renderToBuffer(
      <AttestationPortefeuillePdf {...sampleProps("0".repeat(64))} />,
    );
    expect(buffer.length).toBeGreaterThan(1000);
    expect(buffer.subarray(0, 5).toString("latin1")).toBe("%PDF-");
  });

  it("rend aussi un portefeuille vide (aucune position)", async () => {
    const props = { ...sampleProps("abc"), lignes: [] };
    const buffer = await renderToBuffer(<AttestationPortefeuillePdf {...props} />);
    expect(buffer.subarray(0, 5).toString("latin1")).toBe("%PDF-");
  });
});
