// -*- coding: utf-8 -*-
// Tests des calculs purs COSUMAF (agrégation transactions et avoirs).

import { describe, expect, it } from "vitest";
import {
  computeTransactionsBoursieres,
  computeSituationAvoirs,
  type TransactionRow,
  type AvoirRow,
} from "./cosumaf-compute";

describe("computeTransactionsBoursieres", () => {
  it("agrège par couple (ISIN, sens) avec count, quantité et montant", () => {
    const rows: TransactionRow[] = [
      { isin: "GA001", libelle_titre: "Oblig GA", sens: "ACHAT", quantite: 10, montant_xaf: 1_000_000 },
      { isin: "GA001", libelle_titre: "Oblig GA", sens: "ACHAT", quantite: 5, montant_xaf: 500_000 },
      { isin: "GA001", libelle_titre: "Oblig GA", sens: "VENTE", quantite: 3, montant_xaf: 300_000 },
      { isin: "CM002", libelle_titre: "Action CM", sens: "ACHAT", quantite: 7, montant_xaf: 700_000 },
    ];
    const section = computeTransactionsBoursieres(rows, "2026-04");

    expect(section.lignes).toHaveLength(3); // (GA001,ACHAT) (GA001,VENTE) (CM002,ACHAT)
    const gaAchat = section.lignes.find(
      (l) => l.meta?.isin === "GA001" && l.meta?.sens === "ACHAT",
    );
    expect(gaAchat?.meta?.count).toBe(2);
    expect(gaAchat?.meta?.quantite).toBe(15);
    expect(gaAchat?.valeur).toBe(1_500_000);
    expect(section.total).toBe(1_000_000 + 500_000 + 300_000 + 700_000);
    expect(section.libelle).toContain("2026-04");
  });

  it("renvoie une section vide et un total nul sans transaction", () => {
    const section = computeTransactionsBoursieres([], "2026-04");
    expect(section.lignes).toHaveLength(0);
    expect(section.total).toBe(0);
  });
});

describe("computeSituationAvoirs", () => {
  it("présente toujours les 3 catégories, même vides", () => {
    const section = computeSituationAvoirs([], "2026-04");
    expect(section.lignes).toHaveLength(3);
    expect(section.lignes.map((l) => l.meta?.categorie)).toEqual([
      "DIRIGEANT",
      "PERSONNEL",
      "CLIENTELE",
    ]);
    expect(section.total).toBe(0);
  });

  it("agrège valorisation + espèces par compte distinct et somme par catégorie", () => {
    const rows: AvoirRow[] = [
      { categorie: "CLIENTELE", compte_titres_id: "P1", valorisation_titres_xaf: 1_000_000, solde_especes_xaf: 0 },
      { categorie: "CLIENTELE", compte_titres_id: "P1", valorisation_titres_xaf: 500_000, solde_especes_xaf: 0 },
      { categorie: "CLIENTELE", compte_titres_id: "P2", valorisation_titres_xaf: 2_000_000, solde_especes_xaf: 0 },
      { categorie: "DIRIGEANT", compte_titres_id: "D1", valorisation_titres_xaf: 3_000_000, solde_especes_xaf: 0 },
    ];
    const section = computeSituationAvoirs(rows, "2026-04");

    const clientele = section.lignes.find((l) => l.meta?.categorie === "CLIENTELE");
    expect(clientele?.meta?.nb_comptes).toBe(2); // P1 et P2 distincts
    expect(clientele?.valeur).toBe(3_500_000);

    const dirigeant = section.lignes.find((l) => l.meta?.categorie === "DIRIGEANT");
    expect(dirigeant?.meta?.nb_comptes).toBe(1);
    expect(dirigeant?.valeur).toBe(3_000_000);

    expect(section.total).toBe(6_500_000);
  });
});
