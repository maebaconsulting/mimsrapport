// -*- coding: utf-8 -*-
// Calcul déshérence · helpers purs portés de MIMS (lib/services/desherence/index.ts).
// Base réglementaire CEMAC 02/25 + RG-267.
//
// Adaptation desktop : l'import Manar ne fournit que les mouvements de titres.
// Les sources ordre / portail / contact ne sont pas disponibles ; la dernière
// manifestation se réduit donc à l'activité titres. Les coupons et espèces ne
// sont pas connus : le service appelant les marque « hors périmètre » et retient
// la valorisation des titres comme montant à reverser (décision produit).

export type DesherenceStatut = "ACTIF" | "INACTIF" | "DESHERENCE";

export type DesherenceMotif =
  | "INSTRUMENT_ECHU_NON_RECLAME"
  | "COUPON_NON_ENCAISSE"
  | "TITULAIRE_INJOIGNABLE"
  | "SUCCESSION_NON_REGLEE"
  | "AUTRE";

/** Seuils de déshérence (défauts CEMAC 02/25, aucune saisie côté desktop). */
export interface DesherenceSeuils {
  seuil_inactif_mois: number;
  seuil_desherence_ans: number;
}

export const DEFAULT_DESHERENCE_SEUILS: DesherenceSeuils = {
  seuil_inactif_mois: 12,
  seuil_desherence_ans: 10,
};

/** Nombre de mois pleins écoulés entre deux dates ISO (from ≤ to). */
export function moisEcoules(fromIso: string, toIso: string): number {
  const from = new Date(fromIso);
  const to = new Date(toIso);
  let months =
    (to.getFullYear() - from.getFullYear()) * 12 +
    (to.getMonth() - from.getMonth());
  if (to.getDate() < from.getDate()) months -= 1;
  return Math.max(0, months);
}

/**
 * Statut déshérence selon la dernière manifestation et les seuils.
 * `referenceIso` = dernière manifestation titres (ou date d'ouverture en repli).
 */
export function statutDesherence(
  referenceIso: string,
  dateArreteIso: string,
  seuils: DesherenceSeuils,
): DesherenceStatut {
  const mois = moisEcoules(referenceIso, dateArreteIso);
  if (mois >= seuils.seuil_desherence_ans * 12) return "DESHERENCE";
  if (mois >= seuils.seuil_inactif_mois) return "INACTIF";
  return "ACTIF";
}

/** Date à laquelle la position bascule en déshérence (référence + seuil ans). */
export function dateDesherenceIso(
  referenceIso: string,
  seuilDesherenceAns: number,
): string {
  const d = new Date(referenceIso);
  d.setFullYear(d.getFullYear() + seuilDesherenceAns);
  return d.toISOString();
}

/** Motif déshérence dérivé de la nature de l'avoir échu. */
export function motifDesherence(input: {
  instrumentEchu: boolean;
  couponDu: boolean;
}): DesherenceMotif {
  if (input.instrumentEchu) return "INSTRUMENT_ECHU_NON_RECLAME";
  if (input.couponDu) return "COUPON_NON_ENCAISSE";
  return "TITULAIRE_INJOIGNABLE";
}

/**
 * Une position inactive doit-elle figurer à l'état ? Côté desktop, périmètre
 * « avoir à reverser » : toute position au statut ≥ INACTIF dont le montant à
 * reverser (valorisation titres) est strictement positif.
 */
export function inclureLigne(
  statut: DesherenceStatut,
  montantAReverser: number,
): boolean {
  if (statut === "ACTIF") return false;
  return montantAReverser > 0;
}
