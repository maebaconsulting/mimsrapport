// -*- coding: utf-8 -*-
// Garde « modifications non enregistrées ». Permet à une vue (ex. Paramètres) de
// signaler qu'elle a des changements en attente, et à la coquille applicative de
// le vérifier avant de changer de page, sans coupler les composants entre eux.

let dirtyCheck: (() => boolean) | null = null;

/** Enregistre (ou retire avec null) le prédicat « y a-t-il des changements ? ». */
export function setUnsavedGuard(fn: (() => boolean) | null): void {
  dirtyCheck = fn;
}

/** Vrai si la vue active a des modifications non enregistrées. */
export function hasUnsavedChanges(): boolean {
  return dirtyCheck ? dirtyCheck() : false;
}

/**
 * Demande confirmation si des changements sont en attente. Renvoie true si la
 * navigation peut se poursuivre (pas de changement, ou utilisateur d'accord).
 */
export function confirmDiscardIfDirty(): boolean {
  if (!hasUnsavedChanges()) return true;
  return window.confirm(
    "Des modifications ne sont pas enregistrées. Quitter cette page sans les enregistrer ?",
  );
}
