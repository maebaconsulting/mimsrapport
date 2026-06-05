// -*- coding: utf-8 -*-
// Calculs purs des sections COSUMAF · portés de MIMS
// (lib/services/cosumaf/compute-transactions-boursieres.ts et
//  compute-situation-avoirs.ts), types inlinés pour rester autonome.
//
// Adaptation desktop : l'app mono-poste ne dispose que des données de l'import
// Manar. Les espèces, exécutions d'ordres et catégories de clients ne sont pas
// disponibles ; les services appelants forcent donc solde_especes = 0 et
// categorie = CLIENTELE, et marquent le hors-périmètre via une bannière de
// provenance. Ces fonctions restent neutres : elles agrègent ce qu'on leur passe.

/** Catégories de clients COSUMAF (RG-273). */
export type ClientCategorie = "DIRIGEANT" | "PERSONNEL" | "CLIENTELE";

/** Ligne d'une section de déclaration COSUMAF. */
export type CosumafLigne = {
  libelle: string;
  valeur: number;
  unite: string;
  meta?: Record<string, string | number | boolean | null>;
};

/** Section agrégée d'une déclaration COSUMAF. */
export type CosumafSection = {
  libelle: string;
  lignes: CosumafLigne[];
  total: number;
  unite: string;
};

/** Transaction unitaire (dérivée d'un mouvement de titres côté desktop). */
export type TransactionRow = {
  isin: string;
  libelle_titre: string;
  sens: "ACHAT" | "VENTE";
  quantite: number;
  montant_xaf: number;
};

/**
 * Agrège les transactions par couple (ISIN, sens) sur la période.
 * Une ligne par couple distinct, avec COUNT, somme des quantités et des montants.
 */
export function computeTransactionsBoursieres(
  transactions: TransactionRow[],
  periode: string,
): CosumafSection {
  const agg = new Map<
    string,
    {
      isin: string;
      libelle: string;
      sens: "ACHAT" | "VENTE";
      count: number;
      quantite: number;
      montant: number;
    }
  >();

  for (const t of transactions) {
    const key = `${t.isin}|${t.sens}`;
    const existing = agg.get(key);
    if (existing) {
      existing.count += 1;
      existing.quantite += t.quantite;
      existing.montant += t.montant_xaf;
    } else {
      agg.set(key, {
        isin: t.isin,
        libelle: t.libelle_titre,
        sens: t.sens,
        count: 1,
        quantite: t.quantite,
        montant: t.montant_xaf,
      });
    }
  }

  const lignes: CosumafLigne[] = Array.from(agg.values()).map((a) => ({
    libelle: `${a.libelle} (${a.isin}) · ${a.sens}`,
    valeur: Math.round(a.montant * 100) / 100,
    unite: "XAF",
    meta: { count: a.count, quantite: a.quantite, isin: a.isin, sens: a.sens },
  }));

  const total = lignes.reduce((acc, l) => acc + l.valeur, 0);

  return {
    libelle: `Transactions boursières · ${periode}`,
    lignes,
    total: Math.round(total * 100) / 100,
    unite: "XAF",
  };
}

/** Avoir unitaire (dérivé d'une position côté desktop). */
export type AvoirRow = {
  categorie: ClientCategorie;
  compte_titres_id: string;
  valorisation_titres_xaf: number;
  solde_especes_xaf: number;
};

/**
 * Agrège la situation des avoirs par catégorie de client (RG-273).
 * Les 3 catégories DIRIGEANT/PERSONNEL/CLIENTELE sont toujours présentes dans le
 * résultat même si vides (lisibilité du PDF COSUMAF).
 */
export function computeSituationAvoirs(
  avoirs: AvoirRow[],
  periode: string,
): CosumafSection {
  const categories: ClientCategorie[] = ["DIRIGEANT", "PERSONNEL", "CLIENTELE"];

  const groups: Record<
    ClientCategorie,
    { nbComptes: Set<string>; valeur: number }
  > = {
    DIRIGEANT: { nbComptes: new Set(), valeur: 0 },
    PERSONNEL: { nbComptes: new Set(), valeur: 0 },
    CLIENTELE: { nbComptes: new Set(), valeur: 0 },
  };

  for (const a of avoirs) {
    const g = groups[a.categorie];
    if (!g) continue;
    g.nbComptes.add(a.compte_titres_id);
    g.valeur += (a.valorisation_titres_xaf ?? 0) + (a.solde_especes_xaf ?? 0);
  }

  const lignes: CosumafLigne[] = categories.map((cat) => ({
    libelle: `${cat} · ${groups[cat].nbComptes.size} comptes`,
    valeur: Math.round(groups[cat].valeur * 100) / 100,
    unite: "XAF",
    meta: { categorie: cat, nb_comptes: groups[cat].nbComptes.size },
  }));

  const total = lignes.reduce((acc, l) => acc + l.valeur, 0);

  return {
    libelle: `Situation des avoirs · ${periode}`,
    lignes,
    total: Math.round(total * 100) / 100,
    unite: "XAF",
  };
}
