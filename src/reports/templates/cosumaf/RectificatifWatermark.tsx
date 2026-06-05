// Filigrane RECTIFICATIF V{n} pour les déclarations version >= 2.
// Porté verbatim de MIMS. LOCKED. Utilise Helvetica-Bold (police intégrée
// react-pdf, aucune registration requise).

import { View, Text, StyleSheet } from "@react-pdf/renderer";
import { COSUMAF_TOKENS } from "./cosumaf-tokens";

interface Props {
  version: number; // >= 2 pour afficher
}

const styles = StyleSheet.create({
  watermarkContainer: {
    position: "absolute",
    top: "40%",
    left: 0,
    right: 0,
    alignItems: "center",
    opacity: 0.15,
    transform: "rotate(-35deg)",
    zIndex: 100,
  },
  watermarkText: {
    fontSize: 90,
    fontWeight: 700,
    color: COSUMAF_TOKENS.WATERMARK,
    fontFamily: "Helvetica-Bold",
  },
});

export function RectificatifWatermark({ version }: Props) {
  if (version < 2) return null;
  return (
    <View fixed style={styles.watermarkContainer}>
      <Text style={styles.watermarkText}>{`RECTIFICATIF V${version}`}</Text>
    </View>
  );
}
