// Code-barres Code 39 pour les rapports PDF (@react-pdf/renderer).
//
// Sans dépendance ni canvas (sûr en rendu jsdom des tests) : chaque caractère
// Code 39 est un motif de 9 éléments (barres/espaces) étroits ou larges, rendu
// par une suite de <View> remplies. Jeu de caractères : 0-9 A-Z, espace, - . et
// le délimiteur « * » (début/fin). Convient pour encoder un préfixe de hash.

import { View, Text } from "@react-pdf/renderer";

// Motifs Code 39 : 9 éléments alternant barre/espace (barre en premier),
// « w » = élément large, « n » = étroit.
const CODE39: Record<string, string> = {
  "0": "nnnwwnwnn", "1": "wnnwnnnnw", "2": "nnwwnnnnw", "3": "wnwwnnnnn",
  "4": "nnnwwnnnw", "5": "wnnwwnnnn", "6": "nnwwwnnnn", "7": "nnnwnnwnw",
  "8": "wnnwnnwnn", "9": "nnwwnnwnn",
  A: "wnnnnwnnw", B: "nnwnnwnnw", C: "wnwnnwnnn", D: "nnnnwwnnw",
  E: "wnnnwwnnn", F: "nnwnwwnnn", G: "nnnnnwwnw", H: "wnnnnwwnn",
  I: "nnwnnwwnn", J: "nnnnwwwnn", K: "wnnnnnnww", L: "nnwnnnnww",
  M: "wnwnnnnwn", N: "nnnnwnnww", O: "wnnnwnnwn", P: "nnwnwnnwn",
  Q: "nnnnnnwww", R: "wnnnnnwwn", S: "nnwnnnwwn", T: "nnnnwnwwn",
  U: "wwnnnnnnw", V: "nwwnnnnnw", W: "wwwnnnnnn", X: "nwnnwnnnw",
  Y: "wwnnwnnnn", Z: "nwwnwnnnn",
  "-": "nwnnnnwnw", ".": "wwnnnnwnn", " ": "nwwnnnwnn", "*": "nwnnwnwnn",
};

export interface BarcodeProps {
  /** Valeur encodée (limitée à 0-9 A-Z espace - . ; les autres sont ignorés). */
  value: string;
  /** Hauteur des barres en points. */
  height?: number;
  /** Largeur d'un élément étroit en points (le large vaut 3×). */
  unit?: number;
  /** Couleur des barres. */
  color?: string;
  /** Affiche la valeur en clair sous le code-barres. */
  showText?: boolean;
}

/** Code-barres Code 39 rendu en barres pleines (View). */
export function Barcode({
  value,
  height = 30,
  unit = 0.6,
  color = "#11191F",
  showText = true,
}: BarcodeProps) {
  const clean = value.toUpperCase().replace(/[^0-9A-Z\-. ]/g, "");
  const data = `*${clean}*`;
  const elements: Array<{ bar: boolean; w: number }> = [];
  for (let i = 0; i < data.length; i++) {
    const motif = CODE39[data[i]];
    if (!motif) continue;
    for (let j = 0; j < 9; j++) {
      elements.push({ bar: j % 2 === 0, w: motif[j] === "w" ? unit * 3 : unit });
    }
    // Espace inter-caractère (étroit).
    if (i < data.length - 1) elements.push({ bar: false, w: unit });
  }
  return (
    <View>
      <View style={{ flexDirection: "row", height }}>
        {elements.map((e, idx) => (
          <View
            key={idx}
            style={{
              width: e.w,
              height,
              backgroundColor: e.bar ? color : "transparent",
            }}
          />
        ))}
      </View>
      {showText ? (
        <Text
          style={{
            fontFamily: "JetBrainsMono",
            fontSize: 6,
            color,
            textAlign: "center",
            letterSpacing: 1,
            marginTop: 2,
          }}
        >
          {clean}
        </Text>
      ) : null}
    </View>
  );
}
