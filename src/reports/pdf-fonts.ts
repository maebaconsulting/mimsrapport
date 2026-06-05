// Enregistrement des polices pour @react-pdf/renderer · BUILD NAVIGATEUR.
//
// Directive critique (specs/04-REPORTS.md) : dans une webview Tauri (pas de Node),
// les polices se chargent par URL d'asset (servies par le bundle frontend depuis
// public/fonts), JAMAIS par chemin disque comme le render.ts server-only de MIMS.
//
// Contrainte héritée : pas de variante italique sur Inter (la police n'a pas
// d'italique → erreur de rendu). L'emphase passe par fontWeight: 600.

import { Font } from "@react-pdf/renderer";

let registered = false;

/** Enregistre Inter + JetBrainsMono par URL (idempotent). */
export function registerPdfFonts(): void {
  if (registered) return;

  Font.register({
    family: "Inter",
    fonts: [
      { src: "/fonts/Inter-Regular.ttf", fontWeight: 400 },
      { src: "/fonts/Inter-SemiBold.ttf", fontWeight: 600 },
    ],
  });

  Font.register({
    family: "JetBrainsMono",
    fonts: [
      { src: "/fonts/JetBrainsMono-Regular.ttf", fontWeight: 400 },
      { src: "/fonts/JetBrainsMono-SemiBold.ttf", fontWeight: 600 },
    ],
  });

  // Désactive la césure automatique (évite de couper codes ISIN et libellés).
  Font.registerHyphenationCallback((word) => [word]);

  registered = true;
}
