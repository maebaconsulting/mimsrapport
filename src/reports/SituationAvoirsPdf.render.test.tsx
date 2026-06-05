// -*- coding: utf-8 -*-
// Rendu RÉEL du gabarit Situation des avoirs (pas de mock) · seul un rendu réel
// attrape les erreurs runtime de react-pdf (police italique interdite sur Inter,
// colonnes inexistantes, police mal enregistrée).

import { describe, expect, it } from "vitest";
import { renderToBuffer } from "@react-pdf/renderer";
import { registerTestFonts } from "./test-fonts";
import {
  SituationAvoirsPdf,
  type SituationAvoirsPdfProps,
} from "./templates/cosumaf/SituationAvoirsPdf";

registerTestFonts();

const shell: SituationAvoirsPdfProps["shell"] = {
  sdb_code: "CCA_BOURSE",
  sdb_nom: "CCA Bank · Société de bourse",
  periode_libelle: "Avril 2026",
  version: 1,
  hash_sha256: "b".repeat(64),
  timestamp_rfc3161_mock: "2026-05-02T09:15:00.000Z",
  autorite_emettrice: "COSUMAF · Commission de surveillance du marché financier de l'Afrique centrale",
  mentionsLines: [
    "Document réglementaire confidentiel · diffusion restreinte à la COSUMAF.",
    "Établi conformément au règlement général RG-273.",
  ],
};

function sampleProps(): SituationAvoirsPdfProps {
  return {
    shell,
    donnees: {
      periode: "2026-04",
      sdb_code: "CCA_BOURSE",
      meta: {
        computed_at: "2026-05-02T09:00:00.000Z",
        sources: ["positions_snapshots"],
        version: 1,
      },
      sections: {
        situation_avoirs: {
          libelle: "Situation des avoirs à l'arrêté · 30 avril 2026",
          unite: "XAF",
          total: 9_870_000_000,
          lignes: [
            {
              libelle: "Dirigeants",
              valeur: 1_250_000_000,
              unite: "XAF",
              meta: { categorie: "DIRIGEANT", nb_comptes: 5 },
            },
            {
              libelle: "Personnel",
              valeur: 620_000_000,
              unite: "XAF",
              meta: { categorie: "PERSONNEL", nb_comptes: 42 },
            },
            {
              libelle: "Clientèle",
              valeur: 8_000_000_000,
              unite: "XAF",
              meta: { categorie: "CLIENTELE", nb_comptes: 1287 },
            },
          ],
        },
      },
    },
  };
}

describe("rendu réel · SituationAvoirsPdf", () => {
  it("produit un PDF non vide commençant par %PDF", async () => {
    const buffer = await renderToBuffer(<SituationAvoirsPdf {...sampleProps()} />);
    expect(buffer.length).toBeGreaterThan(1000);
    expect(buffer.subarray(0, 5).toString("latin1")).toBe("%PDF-");
  });

  it("rend aussi sans catégorie (liste vide) et section absente", async () => {
    const props = sampleProps();
    props.donnees.sections.situation_avoirs.lignes = [];
    props.donnees.sections.situation_avoirs.total = 0;
    const bufVide = await renderToBuffer(<SituationAvoirsPdf {...props} />);
    expect(bufVide.subarray(0, 5).toString("latin1")).toBe("%PDF-");

    const propsSansSection = sampleProps();
    propsSansSection.donnees.sections = {};
    const bufAbsente = await renderToBuffer(<SituationAvoirsPdf {...propsSansSection} />);
    expect(bufAbsente.length).toBeGreaterThan(1000);
    expect(bufAbsente.subarray(0, 5).toString("latin1")).toBe("%PDF-");
  });
});
