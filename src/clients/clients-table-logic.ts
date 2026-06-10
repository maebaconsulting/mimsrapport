// -*- coding: utf-8 -*-
// Logique pure de tri et de filtrage de la table des clients, extraite du
// composant pour être testable sans DOM. `ClientsTable` consomme ces fonctions
// (aucune duplication : le composant n'orchestre que l'état et le rendu).

import type { ClientRow } from "./clients-data";

/** Filtre par type de personne (toutes, physiques, morales). */
export type Filtre = "tous" | "PP" | "PM";

/** Colonnes triables de la table clients. */
export type SortKey =
  | "code"
  | "nom_complet"
  | "type"
  | "compte_titres"
  | "nb_positions"
  | "encours_xaf"
  | "statut"
  | "date_ouverture";

export type SortState = { key: SortKey; dir: "asc" | "desc" };

/**
 * Colonnes numériques : au premier clic, on trie en décroissant (les plus
 * grandes valeurs en tête, comportement attendu pour un encours ou un nombre).
 */
export const NUMERIC_SORT_KEYS: ReadonlySet<SortKey> = new Set<SortKey>([
  "nb_positions",
  "encours_xaf",
]);

/**
 * État de tri après un clic sur l'en-tête `key`. Même colonne : inverse le sens.
 * Nouvelle colonne : numérique → décroissant, texte → croissant.
 */
export function nextSort(current: SortState, key: SortKey): SortState {
  if (current.key === key) {
    return { key, dir: current.dir === "asc" ? "desc" : "asc" };
  }
  return { key, dir: NUMERIC_SORT_KEYS.has(key) ? "desc" : "asc" };
}

/** Critères de filtrage et de tri appliqués à la liste des clients. */
export interface FilterCriteria {
  /** Texte de recherche (nom, code ou compte-titres ; insensible à la casse). */
  recherche: string;
  /** Restriction par type de personne. */
  filtre: Filtre;
  /** Ne garder que les clients apparus lors du dernier import. */
  nouveauxSeulement: boolean;
  /** Colonne et sens de tri. */
  sort: SortState;
}

/**
 * Filtre (type, nouveaux, recherche) puis trie une copie des lignes. Fonction
 * pure : ne modifie pas `rows`. Le tri texte utilise une comparaison française
 * tolérante aux nombres et insensible à la casse/aux accents.
 */
export function filterAndSortRows(
  rows: ClientRow[],
  { recherche, filtre, nouveauxSeulement, sort }: FilterCriteria,
): ClientRow[] {
  const q = recherche.trim().toLowerCase();
  const filtrees = rows.filter((r) => {
    if (filtre !== "tous" && r.type !== filtre) return false;
    if (nouveauxSeulement && !r.is_new) return false;
    if (!q) return true;
    return (
      r.nom_complet.toLowerCase().includes(q) ||
      r.code.toLowerCase().includes(q) ||
      r.compte_titres.toLowerCase().includes(q)
    );
  });
  const facteur = sort.dir === "asc" ? 1 : -1;
  return [...filtrees].sort((a, b) => {
    const va = a[sort.key];
    const vb = b[sort.key];
    if (typeof va === "number" && typeof vb === "number") {
      return (va - vb) * facteur;
    }
    return (
      String(va ?? "").localeCompare(String(vb ?? ""), "fr", {
        numeric: true,
        sensitivity: "base",
      }) * facteur
    );
  });
}
