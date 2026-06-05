// -*- coding: utf-8 -*-
// Tests des règles pures de déshérence (seuils, statut, motif, inclusion).

import { describe, expect, it } from "vitest";
import {
  moisEcoules,
  statutDesherence,
  dateDesherenceIso,
  motifDesherence,
  inclureLigne,
  DEFAULT_DESHERENCE_SEUILS,
} from "./desherence-compute";

describe("moisEcoules", () => {
  it("compte les mois pleins, jour de fin antérieur retire un mois", () => {
    expect(moisEcoules("2024-01-15", "2024-04-15")).toBe(3);
    expect(moisEcoules("2024-01-15", "2024-04-10")).toBe(2);
    expect(moisEcoules("2026-01-01", "2025-01-01")).toBe(0); // borné à 0
  });
});

describe("statutDesherence", () => {
  const seuils = DEFAULT_DESHERENCE_SEUILS; // 12 mois / 10 ans

  it("ACTIF en deçà du seuil d'inactivité", () => {
    expect(statutDesherence("2026-01-01", "2026-06-05", seuils)).toBe("ACTIF");
  });

  it("INACTIF au-delà de 12 mois, en deçà de 10 ans", () => {
    expect(statutDesherence("2024-01-01", "2026-06-05", seuils)).toBe("INACTIF");
  });

  it("DESHERENCE au-delà de 10 ans", () => {
    expect(statutDesherence("2010-01-01", "2026-06-05", seuils)).toBe("DESHERENCE");
  });
});

describe("dateDesherenceIso", () => {
  it("ajoute le seuil en années à la référence", () => {
    expect(dateDesherenceIso("2014-03-12T00:00:00.000Z", 10).slice(0, 10)).toBe(
      "2024-03-12",
    );
  });
});

describe("motifDesherence", () => {
  it("priorise instrument échu, puis coupon dû, sinon titulaire injoignable", () => {
    expect(motifDesherence({ instrumentEchu: true, couponDu: true })).toBe(
      "INSTRUMENT_ECHU_NON_RECLAME",
    );
    expect(motifDesherence({ instrumentEchu: false, couponDu: true })).toBe(
      "COUPON_NON_ENCAISSE",
    );
    expect(motifDesherence({ instrumentEchu: false, couponDu: false })).toBe(
      "TITULAIRE_INJOIGNABLE",
    );
  });
});

describe("inclureLigne", () => {
  it("exclut les positions actives", () => {
    expect(inclureLigne("ACTIF", 1_000_000)).toBe(false);
  });
  it("inclut les inactives à montant à reverser positif", () => {
    expect(inclureLigne("INACTIF", 1_000_000)).toBe(true);
    expect(inclureLigne("DESHERENCE", 5_000_000)).toBe(true);
  });
  it("exclut les inactives à montant nul", () => {
    expect(inclureLigne("INACTIF", 0)).toBe(false);
  });
});
