// -*- coding: utf-8 -*-
// Persistance des correspondances de colonnes (collection import_mappings),
// indexées par signature des en-têtes. Permet de réappliquer automatiquement le
// bon mapping à un fichier de même structure aux imports suivants.

import type PocketBase from "pocketbase";
import { withRetry } from "../lib/retry";
import { hashFnv1a } from "./manar-migration";
import { DEFAULT_HEADER_ROWS, type ColumnMapping } from "./manar-fields";

export interface StoredMapping {
  mapping: ColumnMapping;
  headerRows: number;
  extraColumns: Record<number, string>;
}

/** Normalise + signe la ligne d'en-têtes (clé stable de reconnaissance du format). */
export function signHeaders(headers: string[]): string {
  const normalized = headers
    .map((h) =>
      String(h ?? "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .trim(),
    )
    .join("|");
  return hashFnv1a(normalized).toString(16);
}

/** Renvoie le mapping mémorisé pour cette structure d'en-têtes, ou null. */
export async function loadMappingForHeaders(
  pb: PocketBase,
  headers: string[],
): Promise<StoredMapping | null> {
  const signature = signHeaders(headers);
  try {
    const rec = await withRetry(() =>
      pb
        .collection("import_mappings")
        .getFirstListItem(pb.filter("header_signature = {:s}", { s: signature })),
    );
    return {
      mapping: (rec.mapping ?? {}) as ColumnMapping,
      headerRows:
        typeof rec.header_rows === "number" ? rec.header_rows : DEFAULT_HEADER_ROWS,
      extraColumns: (rec.extra_columns ?? {}) as Record<number, string>,
    };
  } catch {
    // 404 (aucun mapping) ou injoignable : pas de mapping mémorisé.
    return null;
  }
}

/** Mémorise (crée ou met à jour) le mapping pour cette structure d'en-têtes. */
export async function saveMapping(
  pb: PocketBase,
  params: {
    headers: string[];
    mapping: ColumnMapping;
    headerRows?: number;
    extraColumns?: Record<number, string>;
    libelle?: string;
  },
): Promise<void> {
  const signature = signHeaders(params.headers);
  const data = {
    header_signature: signature,
    libelle: params.libelle ?? "Format personnalisé",
    header_rows: params.headerRows ?? DEFAULT_HEADER_ROWS,
    mapping: params.mapping,
    extra_columns: params.extraColumns ?? {},
    headers_snapshot: params.headers,
    is_default: false,
  };
  try {
    await withRetry(() => pb.collection("import_mappings").create(data));
  } catch {
    // Conflit de signature : mettre à jour l'enregistrement existant.
    const existing = await pb
      .collection("import_mappings")
      .getFirstListItem(pb.filter("header_signature = {:s}", { s: signature }));
    await withRetry(() =>
      pb.collection("import_mappings").update(existing.id, data),
    );
  }
}
