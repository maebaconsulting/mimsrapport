// Accès à l'état de licence (validé côté Rust, hors ligne). En dehors de la
// coque Tauri (dev navigateur), on considère la licence valide pour permettre le
// développement.

import { isTauri } from "./config";

export interface LicenseStatus {
  valid: boolean;
  reason?: string | null;
  sdb?: string | null;
  sdb_code?: string | null;
  expires_at?: string | null;
}

const DEV_STATUS: LicenseStatus = {
  valid: true,
  sdb: "Mode développement",
  sdb_code: "DEV",
  expires_at: null,
};

/** Récupère l'état de la licence installée. */
export async function getLicenseStatus(): Promise<LicenseStatus> {
  if (!isTauri()) return DEV_STATUS;
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<LicenseStatus>("get_license_status");
}

/** Ouvre un dialogue pour installer une licence ; retourne le nouvel état. */
export async function installLicense(): Promise<LicenseStatus> {
  if (!isTauri()) return DEV_STATUS;
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<LicenseStatus>("install_license");
}
