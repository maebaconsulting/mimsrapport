// Accès fichiers côté webview : dialogue natif (chemin) + lecture/écriture des
// octets via commandes Rust. Hors Tauri (dev navigateur), pickManarFile retombe
// sur un <input type="file"> pour rester testable.

import { isTauri } from "./config";

export interface PickedFile {
  name: string;
  bytes: Uint8Array;
}

const MANAR_FILTERS = [
  { name: "Fichier Manar", extensions: ["xls", "xlsx"] },
];

/** Ouvre un dialogue et retourne le fichier Manar choisi (ou null si annulé). */
export async function pickManarFile(): Promise<PickedFile | null> {
  if (isTauri()) {
    const { open } = await import("@tauri-apps/plugin-dialog");
    const { invoke } = await import("@tauri-apps/api/core");
    const selected = await open({ multiple: false, filters: MANAR_FILTERS });
    if (!selected || typeof selected !== "string") return null;
    const buffer = await invoke<ArrayBuffer>("read_file_bytes", {
      path: selected,
    });
    const name = selected.split(/[\\/]/).pop() ?? "manar.xlsx";
    return { name, bytes: new Uint8Array(buffer) };
  }

  // Repli navigateur (dev) : input fichier masqué.
  return pickViaInput();
}

function pickViaInput(): Promise<PickedFile | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".xls,.xlsx";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) {
        resolve(null);
        return;
      }
      const bytes = new Uint8Array(await file.arrayBuffer());
      resolve({ name: file.name, bytes });
    };
    input.click();
  });
}

/** Ouvre un dialogue d'enregistrement et écrit les octets sur disque (jalon 3). */
export async function saveBytes(
  bytes: Uint8Array,
  defaultName: string,
): Promise<boolean> {
  if (!isTauri()) {
    // Repli navigateur : téléchargement.
    const blob = new Blob([bytes as BlobPart]);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = defaultName;
    a.click();
    URL.revokeObjectURL(url);
    return true;
  }
  const { save } = await import("@tauri-apps/plugin-dialog");
  const { invoke } = await import("@tauri-apps/api/core");
  const path = await save({ defaultPath: defaultName });
  if (!path) return false;
  await invoke("write_file_bytes", { path, contents: Array.from(bytes) });
  return true;
}
