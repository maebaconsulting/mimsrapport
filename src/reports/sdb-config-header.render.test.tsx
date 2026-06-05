import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { Font, renderToBuffer } from "@react-pdf/renderer";
import { AttestationPortefeuillePdf } from "./templates/AttestationPortefeuillePdf";
import {
  DEFAULT_SDB_CONFIG,
  buildMentionsLines,
  toHeaderInfo,
} from "../lib/parametres-sdb";

// Rendu RÉEL de l'en-tête/pied alimentés par la configuration SDB (agrément en
// en-tête, mentions légales interpolées en pied). Garde la branche conditionnelle
// d'agrément ajoutée aux gabarits.

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

describe("rendu réel · en-tête/pied alimentés par parametres_sdb", () => {
  it("rend l'attestation avec agrément en en-tête et mentions interpolées", async () => {
    const config = {
      ...DEFAULT_SDB_CONFIG,
      rccm: "CM-DLA-2020-B-1234",
      niu: "P012345678901X",
      agrement_cosumaf: "SDB-2021-007",
      bp: "BP 4567",
      telephone_principal: "+237 233 00 00 00",
      email_contact: "contact@cca-bourse.cm",
    };
    const header = toHeaderInfo(config);
    const mentionsLines = buildMentionsLines(config, "releve");

    // L'agrément doit être présent dans l'identité d'en-tête, et les mentions
    // doivent contenir RCCM + agrément (segments non vides conservés).
    expect(header.agrement_cosumaf).toBe("SDB-2021-007");
    expect(mentionsLines.join("\n")).toContain("CM-DLA-2020-B-1234");

    const buffer = await renderToBuffer(
      <AttestationPortefeuillePdf
        sdb={{
          nom: header.nom,
          code: header.code,
          agrement_cosumaf: header.agrement_cosumaf,
          rccm: header.rccm,
          niu: header.niu,
        }}
        client={{ code: "CT-MNR-A1B2C3", nom_complet: "DUPONT Jean", type: "PP" }}
        numero_compte="PORT-CT-MNR-A1B2C3"
        date_arrete="2026-06-05"
        lignes={[
          { libelle: "Obligation État du Gabon 6% 2029", quantite: 1500, valorisation_xaf: 15_000_000 },
        ]}
        hash_sha256={"0".repeat(64)}
        timestamp_rfc3161_mock="2026-06-05T10:30:00.000Z"
        ville={config.ville}
        mentionsLines={mentionsLines}
        logoUrl={null}
      />,
    );
    expect(buffer.length).toBeGreaterThan(1000);
    expect(buffer.subarray(0, 5).toString("latin1")).toBe("%PDF-");
  });
});
