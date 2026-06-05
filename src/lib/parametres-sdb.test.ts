import { describe, it, expect } from "vitest";
import {
  DEFAULT_SDB_CONFIG,
  formatCapital,
  interpolateMentions,
  buildMentionsLines,
  pickConfigForDate,
  mergeConfig,
  toHeaderInfo,
  type SdbConfig,
} from "./parametres-sdb";

function cfg(overrides: Partial<SdbConfig>): SdbConfig {
  return { ...DEFAULT_SDB_CONFIG, ...overrides };
}

/** Supprime toute espace (normale, fine, insécable) pour comparer des montants. */
function noSpaces(s: string): string {
  return s.replace(/\s/g, "");
}

describe("formatCapital", () => {
  it("groupe les chiffres par 3", () => {
    expect(noSpaces(formatCapital(1000000000))).toBe("1000000000");
    expect(noSpaces(formatCapital(5000))).toBe("5000");
  });
  it("renvoie vide pour 0 ou invalide", () => {
    expect(formatCapital(0)).toBe("");
    expect(formatCapital(NaN)).toBe("");
  });
});

describe("interpolateMentions", () => {
  it("remplace les jetons et ne laisse aucune accolade", () => {
    const lines = buildMentionsLines(
      cfg({
        rccm: "CM-DLA-2020-B-1234",
        niu: "P012345678901X",
        agrement_cosumaf: "SDB-2021-007",
      }),
      "releve",
    );
    const joined = lines.join("\n");
    expect(joined).not.toContain("{");
    expect(joined).toContain("CCA Bourse");
    expect(joined).toContain("CM-DLA-2020-B-1234");
    expect(joined).toContain("SDB-2021-007");
  });

  it("formate le capital dans la première ligne", () => {
    const lines = buildMentionsLines(cfg({}), "releve");
    expect(noSpaces(lines[0])).toContain("1000000000");
    expect(lines[0]).toContain("au capital de");
  });

  it("supprime un segment dont tous les jetons sont vides", () => {
    // rccm/niu/agrement vides → la ligne « RCCM · NIU · Agrément » disparaît.
    const lines = buildMentionsLines(
      cfg({ rccm: "", niu: "", agrement_cosumaf: "" }),
      "releve",
    );
    expect(lines.some((l) => l.includes("RCCM"))).toBe(false);
  });

  it("garde un segment partiel et retire les segments vides voisins", () => {
    const lines = buildMentionsLines(
      cfg({ rccm: "CM-DLA-2020-B-1234", niu: "", agrement_cosumaf: "" }),
      "releve",
    );
    const ligneRccm = lines.find((l) => l.includes("RCCM"));
    expect(ligneRccm).toBe("RCCM CM-DLA-2020-B-1234");
  });

  it("renvoie une liste vide pour un modèle vide", () => {
    expect(interpolateMentions("", cfg({}))).toEqual([]);
  });
});

describe("pickConfigForDate", () => {
  const recs = [
    { id: "a", date_effet_debut: "2025-01-01", date_effet_fin: "2025-12-31" },
    { id: "b", date_effet_debut: "2026-01-01", date_effet_fin: "" },
  ];

  it("choisit l'enregistrement en vigueur à la date", () => {
    expect(pickConfigForDate(recs, "2025-06-15")?.id).toBe("a");
    expect(pickConfigForDate(recs, "2026-06-15")?.id).toBe("b");
  });

  it("couvre le futur quand date_effet_fin est vide", () => {
    expect(pickConfigForDate(recs, "2030-01-01")?.id).toBe("b");
  });

  it("repli sur le plus récent si aucun ne couvre la date", () => {
    expect(pickConfigForDate(recs, "2020-01-01")?.id).toBe("b");
  });

  it("renvoie null pour une liste vide", () => {
    expect(pickConfigForDate([], "2026-01-01")).toBeNull();
  });
});

describe("mergeConfig", () => {
  it("renvoie les défauts si record est null", () => {
    expect(mergeConfig(null)).toEqual(DEFAULT_SDB_CONFIG);
  });

  it("écrase uniquement les champs fournis non vides", () => {
    const merged = mergeConfig({
      rccm: "CM-DLA-9-9",
      ville: "",
      capital_social: "5000",
    });
    expect(merged.rccm).toBe("CM-DLA-9-9");
    expect(merged.ville).toBe(DEFAULT_SDB_CONFIG.ville); // vide ignoré
    expect(merged.capital_social).toBe(5000);
  });
});

describe("toHeaderInfo", () => {
  it("mappe les champs et met undefined sur les vides", () => {
    const h = toHeaderInfo(cfg({ agrement_cosumaf: "", rccm: "CM-1" }));
    expect(h.nom).toBe("CCA Bourse");
    expect(h.code).toBe("CCAB");
    expect(h.rccm).toBe("CM-1");
    expect(h.agrement_cosumaf).toBeUndefined();
  });
});
