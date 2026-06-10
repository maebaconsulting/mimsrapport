// -*- coding: utf-8 -*-
import { describe, expect, it } from "vitest";
import type { ClientRow } from "./clients-data";
import {
  filterAndSortRows,
  nextSort,
  type FilterCriteria,
} from "./clients-table-logic";

/** Fabrique une ligne client avec des valeurs par défaut surchargeables. */
function row(over: Partial<ClientRow> & Pick<ClientRow, "id">): ClientRow {
  return {
    id: over.id,
    code: over.code ?? "C-" + over.id,
    nom_complet: over.nom_complet ?? "Client " + over.id,
    type: over.type ?? "PP",
    compte_titres: over.compte_titres ?? "CT-" + over.id,
    statut: over.statut ?? "ACTIF",
    date_ouverture: over.date_ouverture ?? null,
    nb_positions: over.nb_positions ?? 0,
    encours_xaf: over.encours_xaf ?? 0,
    first_seen_at: over.first_seen_at ?? null,
    is_new: over.is_new ?? false,
    has_contact: over.has_contact ?? false,
  };
}

const CRITERES: FilterCriteria = {
  recherche: "",
  filtre: "tous",
  nouveauxSeulement: false,
  sort: { key: "encours_xaf", dir: "desc" },
};

const ECHANTILLON: ClientRow[] = [
  row({ id: "1", nom_complet: "Alice Mballa", code: "C-100", type: "PP", encours_xaf: 500, nb_positions: 2, is_new: true, compte_titres: "CT-ALPHA" }),
  row({ id: "2", nom_complet: "Banque Centrale", code: "C-200", type: "PM", encours_xaf: 3000, nb_positions: 5, compte_titres: "CT-BETA" }),
  row({ id: "3", nom_complet: "Émile Ndong", code: "C-300", type: "PP", encours_xaf: 1500, nb_positions: 1, compte_titres: "CT-GAMMA" }),
];

describe("nextSort · bascule de tri sur clic d'en-tête", () => {
  it("inverse le sens quand on reclique la même colonne", () => {
    expect(nextSort({ key: "encours_xaf", dir: "desc" }, "encours_xaf")).toEqual({
      key: "encours_xaf",
      dir: "asc",
    });
    expect(nextSort({ key: "encours_xaf", dir: "asc" }, "encours_xaf")).toEqual({
      key: "encours_xaf",
      dir: "desc",
    });
  });

  it("commence en décroissant pour une nouvelle colonne numérique", () => {
    expect(nextSort({ key: "code", dir: "asc" }, "nb_positions")).toEqual({
      key: "nb_positions",
      dir: "desc",
    });
    expect(nextSort({ key: "code", dir: "asc" }, "encours_xaf")).toEqual({
      key: "encours_xaf",
      dir: "desc",
    });
  });

  it("commence en croissant pour une nouvelle colonne texte", () => {
    expect(nextSort({ key: "encours_xaf", dir: "desc" }, "nom_complet")).toEqual({
      key: "nom_complet",
      dir: "asc",
    });
  });
});

describe("filterAndSortRows · filtrage", () => {
  it("filtre par type de personne (PP/PM)", () => {
    const pp = filterAndSortRows(ECHANTILLON, { ...CRITERES, filtre: "PP" });
    expect(pp.map((r) => r.id)).toEqual(["3", "1"]); // encours décroissant
    const pm = filterAndSortRows(ECHANTILLON, { ...CRITERES, filtre: "PM" });
    expect(pm.map((r) => r.id)).toEqual(["2"]);
  });

  it("ne garde que les nouveaux clients quand demandé", () => {
    const res = filterAndSortRows(ECHANTILLON, {
      ...CRITERES,
      nouveauxSeulement: true,
    });
    expect(res.map((r) => r.id)).toEqual(["1"]);
  });

  it("recherche par nom, code ou compte-titres, insensible à la casse", () => {
    expect(
      filterAndSortRows(ECHANTILLON, { ...CRITERES, recherche: "banque" }).map((r) => r.id),
    ).toEqual(["2"]);
    expect(
      filterAndSortRows(ECHANTILLON, { ...CRITERES, recherche: "C-300" }).map((r) => r.id),
    ).toEqual(["3"]);
    expect(
      filterAndSortRows(ECHANTILLON, { ...CRITERES, recherche: "ct-gamma" }).map((r) => r.id),
    ).toEqual(["3"]);
  });

  it("retourne une liste vide si rien ne correspond", () => {
    expect(
      filterAndSortRows(ECHANTILLON, { ...CRITERES, recherche: "introuvable" }),
    ).toHaveLength(0);
  });
});

describe("filterAndSortRows · tri", () => {
  it("trie numériquement (encours) dans les deux sens", () => {
    const desc = filterAndSortRows(ECHANTILLON, {
      ...CRITERES,
      sort: { key: "encours_xaf", dir: "desc" },
    });
    expect(desc.map((r) => r.encours_xaf)).toEqual([3000, 1500, 500]);
    const asc = filterAndSortRows(ECHANTILLON, {
      ...CRITERES,
      sort: { key: "encours_xaf", dir: "asc" },
    });
    expect(asc.map((r) => r.encours_xaf)).toEqual([500, 1500, 3000]);
  });

  it("trie le texte avec les accents (Émile traité comme E)", () => {
    const asc = filterAndSortRows(ECHANTILLON, {
      ...CRITERES,
      sort: { key: "nom_complet", dir: "asc" },
    });
    expect(asc.map((r) => r.nom_complet)).toEqual([
      "Alice Mballa",
      "Banque Centrale",
      "Émile Ndong",
    ]);
  });

  it("ne modifie pas le tableau d'entrée (fonction pure)", () => {
    const copie = [...ECHANTILLON];
    filterAndSortRows(ECHANTILLON, {
      ...CRITERES,
      sort: { key: "nom_complet", dir: "asc" },
    });
    expect(ECHANTILLON).toEqual(copie);
  });
});
