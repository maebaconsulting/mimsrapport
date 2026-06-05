// Accès fichiers côté webview. Les dialogues natifs sont pilotés côté Rust et le
// chemin choisi ne traverse jamais l'IPC (sécurité). Hors Tauri (dev navigateur),
// on retombe sur les API du navigateur pour rester testable.

import { isTauri } from "./config";

export interface PickedFile {
  name: string;
  bytes: Uint8Array;
}

/** Ouvre un dialogue et retourne le fichier Manar choisi (ou null si annulé). */
export async function pickManarFile(): Promise<PickedFile | null> {
  if (isTauri()) {
    const { invoke } = await import("@tauri-apps/api/core");
    // Le Rust ouvre le dialogue et mémorise le chemin ; on ne reçoit que le nom.
    const name = await invoke<string | null>("pick_manar_file");
    if (!name) return null;
    const buffer = await invoke<ArrayBuffer>("read_picked_file");
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
  const { invoke } = await import("@tauri-apps/api/core");
  // Le Rust ouvre le dialogue d'enregistrement et écrit ; chemin choisi côté Rust.
  return invoke<boolean>("save_pdf", {
    contents: Array.from(bytes),
    defaultName,
  });
}
