import { describe, expect, it } from "vitest";
import {
  normalizeManarValue,
  parseManarAmount,
  parseManarDate,
} from "./manar-parser";
import {
  deduceClientTypeFromDonneurOrdre,
  hashFnv1a,
  splitNomPrenomFromLabel,
  syntheticClientCode,
  syntheticRccm,
} from "./manar-migration";

describe("normalizeManarValue", () => {
  it("convertit les nulls sémantiques en null (insensible à la casse)", () => {
    for (const v of ["NEANT", "neant", "NULL", "N/A", "na", "-", "", "   "]) {
      expect(normalizeManarValue(v)).toBeNull();
    }
  });
  it("préserve et trim les valeurs réelles", () => {
    expect(normalizeManarValue("  CCAB  ")).toBe("CCAB");
    expect(normalizeManarValue("E-GABON")).toBe("E-GABON");
  });
  it("gère null et undefined", () => {
    expect(normalizeManarValue(null)).toBeNull();
    expect(normalizeManarValue(undefined)).toBeNull();
  });
});

describe("parseManarDate", () => {
  it("convertit dd/mm/yyyy en yyyy-mm-dd", () => {
    expect(parseManarDate("13/05/2024")).toBe("2024-05-13");
    expect(parseManarDate("01/01/2000")).toBe("2000-01-01");
  });
  it("rejette les formats et plages invalides", () => {
    expect(parseManarDate("32/01/2024")).toBeNull(); // jour hors plage
    expect(parseManarDate("01/13/2024")).toBeNull(); // mois hors plage
    expect(parseManarDate("01/01/1800")).toBeNull(); // année hors plage
    expect(parseManarDate("2024-05-13")).toBeNull(); // déjà ISO, format refusé
    expect(parseManarDate("efgh-cd-ab")).toBeNull();
    expect(parseManarDate(null)).toBeNull();
  });
});

describe("parseManarAmount", () => {
  it("parse le format numérique brut", () => {
    expect(parseManarAmount("2000000000")).toBe(2000000000);
  });
  it("parse le format français (espace insécable, virgule décimale)", () => {
    // U+00A0 entre les milliers, virgule décimale
    expect(parseManarAmount("1 247,50")).toBe(1247.5);
    expect(parseManarAmount("10 000")).toBe(10000);
  });
  it("retourne null sur entrée vide ou non numérique", () => {
    expect(parseManarAmount(null)).toBeNull();
    expect(parseManarAmount("abc")).toBeNull();
  });
});

describe("hashFnv1a", () => {
  it("est déterministe et non signé 32 bits", () => {
    const h1 = hashFnv1a("DUPONT Jean");
    const h2 = hashFnv1a("DUPONT Jean");
    expect(h1).toBe(h2);
    expect(h1).toBeGreaterThanOrEqual(0);
    expect(h1).toBeLessThanOrEqual(0xffffffff);
  });
  it("produit un code client au format CT-MNR-XXXXXX", () => {
    expect(syntheticClientCode("DUPONT Jean")).toMatch(/^CT-MNR-[0-9A-F]{6}$/);
    // Stabilité : même entrée → même code.
    expect(syntheticClientCode("ACME SARL")).toBe(
      syntheticClientCode("ACME SARL"),
    );
  });
  it("produit un RCCM synthétique compatible", () => {
    const code = syntheticClientCode("ACME SARL");
    expect(syntheticRccm(code)).toMatch(/^CM-MIGR-9999-X-\d{6}$/);
  });
});

describe("deduceClientTypeFromDonneurOrdre", () => {
  it("détecte les personnes morales", () => {
    expect(deduceClientTypeFromDonneurOrdre("ACME SARL")).toBe("PM");
    expect(deduceClientTypeFromDonneurOrdre("CCA BANK")).toBe("PM");
    expect(deduceClientTypeFromDonneurOrdre("GROUPE HOLDING")).toBe("PM");
  });
  it("classe le reste en personne physique", () => {
    expect(deduceClientTypeFromDonneurOrdre("DUPONT Jean")).toBe("PP");
  });
});

describe("splitNomPrenomFromLabel", () => {
  it("sépare nom (majuscules) et prénom", () => {
    expect(splitNomPrenomFromLabel("DUPONT Jean")).toEqual({
      nom: "DUPONT",
      prenom: "Jean",
    });
  });
  it("tolère les préfixes de civilité", () => {
    expect(splitNomPrenomFromLabel("M. MARTIN Paul")).toEqual({
      nom: "MARTIN",
      prenom: "Paul",
    });
  });
  it("gère un token unique", () => {
    expect(splitNomPrenomFromLabel("KOUASSI")).toEqual({
      nom: "KOUASSI",
      prenom: null,
    });
  });
});
