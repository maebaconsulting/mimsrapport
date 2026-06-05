import { describe, expect, it } from "vitest";
import { isTauri, resolvePocketBaseUrl, LOCAL_AUTH } from "./config";

describe("config PocketBase", () => {
  it("détecte l'absence de coque Tauri hors navigateur Tauri", () => {
    // En environnement Node de test, l'objet window/__TAURI_INTERNALS__ est absent.
    expect(isTauri()).toBe(false);
  });

  it("retombe sur l'URL locale par défaut hors Tauri", async () => {
    await expect(resolvePocketBaseUrl()).resolves.toBe("http://127.0.0.1:8090");
  });

  it("expose des identifiants locaux cohérents avec l'amorçage de migration", () => {
    expect(LOCAL_AUTH.email).toBe("poste-local@reporting-manar.app");
    // Le mot de passe doit respecter la longueur minimale PocketBase (>= 8).
    expect(LOCAL_AUTH.password.length).toBeGreaterThanOrEqual(8);
  });
});
