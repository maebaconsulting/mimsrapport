// -*- coding: utf-8 -*-
// Gabarit PDF · obligation 15 COSUMAF situation des avoirs (RG-273).
// Porté de MIMS. Fidélité visuelle : StyleSheet et JSX conservés verbatim.
// Adaptations : retrait de server-only et des imports @/lib ; types inlinés ;
// shell pointant sur notre CosumafPdfShell (mentionsLines, pas de sdbInfo).
//
// Affichage strict des 3 catégories DIRIGEANT/PERSONNEL/CLIENTELE même
// si 0 comptes (lisibilité PDF · décision Plan 05-02).

import { View, Text, StyleSheet } from "@react-pdf/renderer";
import { CosumafPdfShell, type CosumafPdfShellProps } from "./CosumafPdfShell";
import { COSUMAF_TOKENS, fmtXAF, fmtNombre } from "./cosumaf-tokens";
import type { CosumafDonneesJsonb } from "./TransactionsBoursieresPdf";

export type { CosumafDonneesJsonb } from "./TransactionsBoursieresPdf";

export interface SituationAvoirsPdfProps {
  donnees: CosumafDonneesJsonb;
  shell: Omit<CosumafPdfShellProps, "children" | "titre" | "regulation_ref">;
}

const styles = StyleSheet.create({
  table: { marginTop: 12, borderTopWidth: 1, borderTopColor: COSUMAF_TOKENS.INK },
  header: {
    flexDirection: "row",
    backgroundColor: COSUMAF_TOKENS.GRAY_50,
    borderBottomWidth: 1,
    borderBottomColor: COSUMAF_TOKENS.INK,
    padding: 6,
  },
  row: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: COSUMAF_TOKENS.GRAY_200,
    padding: 6,
  },
  cellCat: { flex: 3, fontSize: 9, fontWeight: 700, color: COSUMAF_TOKENS.INK },
  cellNb: { flex: 2, fontSize: 9, textAlign: "right", fontFamily: "Courier" },
  cellVal: { flex: 3, fontSize: 9, textAlign: "right", fontFamily: "Courier" },
  cellHeader: { fontWeight: 700, color: COSUMAF_TOKENS.INK },
  totalRow: {
    flexDirection: "row",
    backgroundColor: COSUMAF_TOKENS.ACCENT,
    borderTopWidth: 1,
    borderTopColor: COSUMAF_TOKENS.INK,
    padding: 8,
    marginTop: 4,
  },
  totalLib: { flex: 5, fontSize: 10, fontWeight: 700 },
  totalNum: { flex: 3, fontSize: 10, fontWeight: 700, textAlign: "right", fontFamily: "Courier" },
  sousTitre: { fontSize: 10, marginBottom: 4, color: COSUMAF_TOKENS.GRAY_700 },
  note: { fontSize: 8, color: COSUMAF_TOKENS.GRAY_600, marginTop: 8, fontWeight: 600 },
});

export function SituationAvoirsPdf({ donnees, shell }: SituationAvoirsPdfProps) {
  const section = donnees.sections["situation_avoirs"];

  if (!section) {
    return (
      <CosumafPdfShell {...shell} titre="Situation des avoirs" regulation_ref="RG-273">
        <Text>Aucune donnée disponible pour cette période.</Text>
      </CosumafPdfShell>
    );
  }

  return (
    <CosumafPdfShell {...shell} titre="Situation des avoirs" regulation_ref="RG-273">
      <Text style={styles.sousTitre}>{section.libelle}</Text>
      <View style={styles.table}>
        <View style={styles.header}>
          <Text style={[styles.cellCat, styles.cellHeader]}>Catégorie</Text>
          <Text style={[styles.cellNb, styles.cellHeader]}>Nb comptes</Text>
          <Text style={[styles.cellVal, styles.cellHeader]}>Valorisation</Text>
        </View>
        {section.lignes.map((l, i) => (
          <View key={i} style={styles.row}>
            <Text style={styles.cellCat}>{String(l.meta?.categorie ?? l.libelle)}</Text>
            <Text style={styles.cellNb}>{fmtNombre(Number(l.meta?.nb_comptes ?? 0))}</Text>
            <Text style={styles.cellVal}>{fmtXAF(l.valeur)}</Text>
          </View>
        ))}
        <View style={styles.totalRow}>
          <Text style={styles.totalLib}>Total avoirs</Text>
          <Text style={styles.totalNum}>{fmtXAF(section.total)}</Text>
        </View>
      </View>
      <Text style={styles.note}>
        Catégorisation conforme à la grille COSUMAF · Dirigeants, Personnel, Clientèle.
      </Text>
    </CosumafPdfShell>
  );
}
