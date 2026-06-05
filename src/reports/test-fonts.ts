// Helper de tests · enregistre Inter + JetBrainsMono par chemin disque (Node).
// Les tests de rendu réel l'appellent avant renderToBuffer. En production, l'app
// charge ces mêmes polices par URL (voir pdf-fonts.ts).

import { fileURLToPath } from "node:url";
import { Font } from "@react-pdf/renderer";

let done = false;

export function registerTestFonts(): void {
  if (done) return;
  const fontPath = (name: string) =>
    fileURLToPath(new URL(`../../public/fonts/${name}`, import.meta.url));
  Font.register({
    family: "Inter",
    fonts: [
      { src: fontPath("Inter-Regular.ttf"), fontWeight: 400 },
      { src: fontPath("Inter-SemiBold.ttf"), fontWeight: 600 },
    ],
  });
  Font.register({
    family: "JetBrainsMono",
    fonts: [
      { src: fontPath("JetBrainsMono-Regular.ttf"), fontWeight: 400 },
      { src: fontPath("JetBrainsMono-SemiBold.ttf"), fontWeight: 600 },
    ],
  });
  Font.registerHyphenationCallback((word) => [word]);
  done = true;
}
