// -*- coding: utf-8 -*-
// Contrat des champs logiques de l'import et mapping par défaut (format
// historique). Le parseur (manar-parser.ts) résout chaque champ logique vers un
// index de colonne via une `ColumnMapping`. Le mapping par défaut reproduit à
// l'identique les index figés historiques (rétrocompatibilité stricte).

/** Correspondance champ logique → index de colonne (0-based), ou null si absent. */
export type ColumnMapping = Record<string, number | null>;

/** Lignes d'en-tête à ignorer dans le format historique. */
export const DEFAULT_HEADER_ROWS = 2;

/**
 * Mapping par défaut · index identiques à l'implémentation positionnelle d'origine.
 * `quantite` est exposé comme champ logique (alimente extra_columns.quantite).
 */
export const DEFAULT_MAPPING: ColumnMapping = {
  manar_op_id: 0,
  no_ordre: 2,
  libelle_instrument: 4,
  poste_code: 5,
  donneur_ordre: 8,
  statut: 9,
  date_saisie: 10,
  date_operation: 11,
  date_valeur: 12,
  date_validation: 14,
  date_annulation: 15,
  compte_especes: 19,
  compte_titres_ctr_partie: 23,
  quantite: 24,
  prix_xaf: 25,
  valeur_nominale_xaf: 26,
  montant_brut_xaf: 31,
  courus_xaf: 33,
  contrat: 35,
  taux_interet: 41,
  operateur_saisie: 46,
  operateur_validation: 47,
  ope_annulation: 48,
  date_echeance: 49,
  isin: 50,
  emetteur_code: 51,
};

/** Colonnes « extra » (non mappées nommément) · conservées dans extra_columns. */
export const EXTRA_COL_NAMES: Record<number, string> = {
  1: "no_evenement",
  3: "titre_code",
  6: "entite_code",
  7: "portefeuille_code",
  13: "date_livraison",
  16: "intermediaire",
  17: "depositaire",
  18: "compte_titres",
  20: "contrepartie",
  21: "desc_contrepartie",
  22: "depositaire_ctr_partie",
  24: "quantite",
  27: "devise_ref",
  28: "taux_ref",
  29: "devise_reg",
  30: "frais_tot",
  32: "montant_net",
  34: "pmv_back",
  36: "titre_jouissance",
  37: "titre_echeance",
  38: "nego_prix",
  39: "nego_ppc",
  40: "nego_spread",
  42: "taux_placement",
  43: "nbre_jours_placement",
  44: "interets",
  45: "decalage_valeur",
  52: "classe",
  53: "categorie",
};

/** Champ logique exposé dans l'écran de mapping (libellé + obligation). */
export interface FieldDef {
  key: string;
  label: string;
  required: boolean;
  hint?: string;
}

/**
 * Champs présentés à l'utilisateur pour la correspondance manuelle. On n'expose
 * que les champs utiles (les colonnes « systématiquement vides » du format
 * historique sont omises ; elles restent null si non mappées).
 */
export const MAPPABLE_FIELDS: FieldDef[] = [
  { key: "manar_op_id", label: "Identifiant d'opération", required: true, hint: "Clé unique de chaque ligne." },
  { key: "donneur_ordre", label: "Client (donneur d'ordre)", required: true, hint: "Identifie le client." },
  { key: "isin", label: "Code ISIN", required: false },
  { key: "emetteur_code", label: "Code émetteur", required: false },
  { key: "poste_code", label: "Poste", required: false },
  { key: "libelle_instrument", label: "Libellé de l'instrument", required: false },
  { key: "statut", label: "Statut", required: false, hint: "F, V, P ou S." },
  { key: "quantite", label: "Quantité", required: false },
  { key: "prix_xaf", label: "Prix unitaire", required: false },
  { key: "valeur_nominale_xaf", label: "Valeur nominale", required: false },
  { key: "montant_brut_xaf", label: "Montant brut", required: false },
  { key: "courus_xaf", label: "Intérêts courus", required: false },
  { key: "taux_interet", label: "Taux d'intérêt", required: false },
  { key: "date_operation", label: "Date d'opération", required: false },
  { key: "date_valeur", label: "Date de valeur", required: false },
  { key: "date_saisie", label: "Date de saisie", required: false },
  { key: "date_validation", label: "Date de validation", required: false },
  { key: "operateur_saisie", label: "Opérateur saisie", required: false },
  { key: "operateur_validation", label: "Opérateur validation", required: false },
];

/** Champs obligatoires (sans eux, l'import ne peut pas dériver les entités). */
export const REQUIRED_FIELDS: string[] = MAPPABLE_FIELDS.filter(
  (f) => f.required,
).map((f) => f.key);
