// Configuration de l'accès à PocketBase.
//
// Règle non négociable (specs/01-ARCHITECTURE.md) : l'URL de base de PocketBase
// est LUE D'UNE CONFIGURATION, jamais codée en dur. En mono-poste, Tauri fournit
// l'URL du sidecar local (port choisi au démarrage) via la commande
// `get_pocketbase_url`. En dehors de Tauri (dev navigateur seul), on retombe sur
// le port par défaut.

/**
 * Identifiants de l'utilisateur local (mono-poste).
 *
 * Limite assumée : identifiants fixes locaux, connus de l'app, pour l'auto-login
 * transparent. La base étant locale (127.0.0.1), le modèle de menace est minimal.
 * Le multi-poste basculera sur une vraie gestion de comptes.
 *
 * Ces valeurs DOIVENT correspondre à l'amorçage de la migration
 * pocketbase/pb_migrations/1700000030_regles_et_seed.js.
 */
export const LOCAL_AUTH = {
  email: "poste-local@reporting-manar.app",
  password: "manar-mono-poste-2026",
} as const;

const DEFAULT_URL = "http://127.0.0.1:8090";

/**
 * Identité de la société de bourse exploitant l'application (mono-poste).
 * Figée en v1 ; deviendra paramétrable (collection de paramètres) plus tard.
 */
export const SDB_IDENTITY = {
  nom: "CCA Bourse",
  code: "CCAB",
  ville: "Douala",
} as const;

/** Indique si l'app tourne dans la coque Tauri (et non un navigateur seul). */
export function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

/**
 * Résout l'URL de base de PocketBase. Sous Tauri, demande au noyau Rust le port
 * effectif du sidecar ; sinon, utilise le port par défaut.
 */
export async function resolvePocketBaseUrl(): Promise<string> {
  if (!isTauri()) {
    return DEFAULT_URL;
  }
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    return await invoke<string>("get_pocketbase_url");
  } catch (err) {
    console.warn("URL PocketBase non résolue via Tauri, repli sur le défaut", err);
    return DEFAULT_URL;
  }
}
