// -*- coding: utf-8 -*-
// Rendu RÉEL du gabarit Transactions boursières (pas de mock) · seul un rendu
// réel attrape les erreurs runtime de react-pdf (police italique interdite sur
// Inter, colonnes inexistantes, police mal enregistrée).

import { describe, expect, it } from "vitest";
import { renderToBuffer } from "@react-pdf/renderer";
import { registerTestFonts } from "./test-fonts";
import {
  TransactionsBoursieresPdf,
  type TransactionsBoursieresPdfProps,
} from "./templates/cosumaf/TransactionsBoursieresPdf";

registerTestFonts();

const shell: TransactionsBoursieresPdfProps["shell"] = {
  sdb_code: "CCA_BOURSE",
  sdb_nom: "CCA Bank · Société de bourse",
  periode_libelle: "Avril 2026",
  version: 1,
  hash_sha256: "a".repeat(64),
  timestamp_rfc3161_mock: "2026-05-02T09:15:00.000Z",
  autorite_emettrice: "COSUMAF · Commission de surveillance du marché financier de l'Afrique centrale",
  mentionsLines: [
    "Document réglementaire confidentiel · diffusion restreinte à la COSUMAF.",
    "Établi conformément au règlement général RG-273.",
  ],
};

function sampleProps(): TransactionsBoursieresPdfProps {
  return {
    shell,
    donnees: {
      periode: "2026-04",
      sdb_code: "CCA_BOURSE",
      meta: {
        computed_at: "2026-05-02T09:00:00.000Z",
        sources: ["ecritures_comptables", "ordres_bourse"],
        version: 1,
      },
      sections: {
        transactions_boursieres: {
          libelle: "Transactions exécutées sur la période · marché BVMAC",
          unite: "XAF",
          total: 1_245_000_000,
          lignes: [
            {
              libelle: "Obligation État du Gabon 6,25% 2029 · achat",
              valeur: 750_000_000,
              unite: "XAF",
              meta: { isin: "GA0000071479", count: 12, sens: "ACHAT" },
            },
            {
              libelle: "Action CCA Bank · vente",
              valeur: 320_000_000,
              unite: "XAF",
              meta: { isin: "GA0000054231", count: 8, sens: "VENTE" },
            },
            {
              libelle: "Obligation BDEAC 5,5% 2031 · achat",
              valeur: 175_000_000,
              unite: "XAF",
              meta: { isin: "CG0000012345", count: 4, sens: "ACHAT" },
            },
          ],
        },
      },
    },
  };
}

describe("rendu réel · TransactionsBoursieresPdf", () => {
  it("produit un PDF non vide commençant par %PDF", async () => {
    const buffer = await renderToBuffer(<TransactionsBoursieresPdf {...sampleProps()} />);
    expect(buffer.length).toBeGreaterThan(1000);
    expect(buffer.subarray(0, 5).toString("latin1")).toBe("%PDF-");
  });

  it("rend aussi sans aucune transaction (liste vide)", async () => {
    const props = sampleProps();
    props.donnees.sections.transactions_boursieres.lignes = [];
    props.donnees.sections.transactions_boursieres.total = 0;
    const buffer = await renderToBuffer(<TransactionsBoursieresPdf {...props} />);
    expect(buffer.length).toBeGreaterThan(1000);
    expect(buffer.subarray(0, 5).toString("latin1")).toBe("%PDF-");
  });

  it("rend la bannière de provenance quand elle est fournie", async () => {
    const props = sampleProps();
    props.shell = {
      ...props.shell,
      provenance: [
        "Source : mouvements de titres issus du fichier d'export.",
        "Hors périmètre : exécutions d'ordres, OST, frais.",
      ],
    };
    const buffer = await renderToBuffer(<TransactionsBoursieresPdf {...props} />);
    expect(buffer.length).toBeGreaterThan(1000);
    expect(buffer.subarray(0, 5).toString("latin1")).toBe("%PDF-");
  });
});
