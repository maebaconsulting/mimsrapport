// -*- coding: utf-8 -*-
// Réessai sur erreur transitoire pour les lectures PocketBase.
//
// Motivation : le sidecar PocketBase peut être momentanément injoignable (au
// démarrage, lors d'un redémarrage, ou sous une contention passagère). Le SDK
// renvoie alors une ClientResponseError de status 0 (« Something went wrong »),
// pas une erreur HTTP. Sans réessai, une simple navigation échoue à tort. Ce
// helper reflète la robustesse déjà appliquée à l'authentification (ensureAuth)
// et aux écritures d'import (withRetry interne au service d'import).

/**
 * Une erreur est transitoire si elle vaut la peine d'être réessayée :
 *  - status 0 (échec réseau / serveur injoignable), hors annulation volontaire ;
 *  - status >= 500 (erreur serveur) ;
 *  - erreur réseau brute (TypeError « Failed to fetch »).
 * Les 4xx (hors annulation) sont des erreurs clientes : on ne réessaie pas.
 */
export function isTransient(err: unknown): boolean {
  const e = err as { status?: unknown; isAbort?: unknown } | null;
  // Annulation explicite (auto-cancellation) : ne jamais réessayer.
  if (e && e.isAbort) return false;
  if (e && typeof e.status === "number") {
    return e.status === 0 || e.status >= 500;
  }
  return err instanceof TypeError;
}

export interface RetryOptions {
  /** Nombre total de tentatives (défaut 4). */
  tries?: number;
  /** Délai de base entre tentatives, en ms ; croît linéairement (défaut 350). */
  delayMs?: number;
}

/** Délai (séparé pour être contournable en test). */
function wait(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Exécute `fn`, en réessayant sur erreur transitoire avec un délai croissant.
 * Relance immédiatement toute erreur non transitoire (4xx, logique applicative)
 * et relance la dernière erreur après épuisement des tentatives.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: RetryOptions = {},
): Promise<T> {
  const tries = opts.tries ?? 4;
  const delayMs = opts.delayMs ?? 350;
  let last: unknown;
  for (let i = 0; i < tries; i++) {
    try {
      return await fn();
    } catch (err) {
      last = err;
      if (!isTransient(err) || i === tries - 1) throw err;
      await wait(delayMs * (i + 1));
    }
  }
  throw last;
}
