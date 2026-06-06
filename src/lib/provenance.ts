// -*- coding: utf-8 -*-
// Provenance des données : dernier import Manar réussi (fichier + horodatage).
// Sert de signal de confiance régulateur, affiché en tête des vues de données.

import type PocketBase from "pocketbase";
import { withRetry } from "./retry";

export interface Provenance {
  fileName: string;
  importedAt: string; // ISO (completed_at, repli created)
}

/**
 * Renvoie la provenance du dernier import réussi, ou null si aucun import.
 * Ne lève pas : en cas d'erreur, renvoie null (l'affichage reste silencieux).
 */
export async function loadProvenance(
  pb: PocketBase,
): Promise<Provenance | null> {
  try {
    const list = await withRetry(() =>
      pb.collection("manar_imports").getList(1, 1, {
        filter: 'statut = "REUSSI"',
        sort: "-created",
      }),
    );
    const rec = list.items[0] as unknown as
      | { file_name?: string; completed_at?: string; created?: string }
      | undefined;
    if (!rec || !rec.file_name) return null;
    return {
      fileName: rec.file_name,
      importedAt: rec.completed_at || rec.created || "",
    };
  } catch {
    return null;
  }
}
