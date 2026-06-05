// -*- coding: utf-8 -*-
// Gabarit PDF · obligation 12 COSUMAF transactions boursières (RG-273).
// Porté de MIMS. Fidélité visuelle : StyleSheet et JSX conservés verbatim.
// Adaptations : retrait de server-only et des imports @/lib ; types inlinés ;
// shell pointant sur notre CosumafPdfShell (mentionsLines, pas de sdbInfo).

import { View, Text, StyleSheet } from "@react-pdf/renderer";
import { CosumafPdfShell, type CosumafPdfShellProps } from "./CosumafPdfShell";
import { COSUMAF_TOKENS, fmtXAF, fmtNombre } from "./cosumaf-tokens";

// Structure des données figées par déclaration COSUMAF (inlinée, pas d'import @/lib).
export type CosumafDonneesLigne = {
  libelle: string;
  valeur: number;
  unite: string;
  meta?: Record<string, string | number | boolean | null>;
};

export type CosumafDonneesSection = {
  libelle: string;
  lignes: CosumafDonneesLigne[];
  total: number;
  unite: string;
};

export type CosumafDonneesJsonb = {
  periode: string;
  sdb_code: string;
  sections: Record<string, CosumafDonneesSection>;
  meta: {
    computed_at: string;
    sources: string[];
    version: number;
  };
};

export interface TransactionsBoursieresPdfProps {
  donnees: CosumafDonneesJsonb;
  shell: Omit<CosumafPdfShellProps, "children" | "titre" | "regulation_ref">;
}

const styles = StyleSheet.create({
  table: { marginTop: 12, borderTopWidth: 1, borderTopColor: COSUMAF_TOKENS.INK },
  header: {
    flexDirection: "row",
    backgroundColor: COSUMAF_TOKENS.GRAY_50,
    padding: 6,
    borderBottomWidth: 1,
    borderBottomColor: COSUMAF_TOKENS.INK,
  },
  row: {
    flexDirection: "row",
    padding: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: COSUMAF_TOKENS.GRAY_200,
  },
  cellIsin: { flex: 2, fontSize: 9, fontFamily: "Courier" },
  cellLib: { flex: 4, fontSize: 9 },
  cellSens: { flex: 1, fontSize: 9, textAlign: "right", fontFamily: "Courier" },
  cellNum: { flex: 2, fontSize: 9, textAlign: "right", fontFamily: "Courier" },
  cellHeader: { fontWeight: 700, color: COSUMAF_TOKENS.INK },
  totalRow: {
    flexDirection: "row",
    backgroundColor: COSUMAF_TOKENS.ACCENT,
    borderTopWidth: 1,
    borderTopColor: COSUMAF_TOKENS.INK,
    padding: 8,
    marginTop: 4,
  },
  totalLib: { flex: 7, fontSize: 10, fontWeight: 700 },
  totalNum: { flex: 2, fontSize: 10, fontWeight: 700, textAlign: "right", fontFamily: "Courier" },
  sousTitre: { fontSize: 10, marginBottom: 4, color: COSUMAF_TOKENS.GRAY_700 },
  empty: { fontSize: 9, color: COSUMAF_TOKENS.GRAY_600, fontWeight: 600, marginTop: 12 },
});

export function TransactionsBoursieresPdf({ donnees, shell }: TransactionsBoursieresPdfProps) {
  const section = donnees.sections["transactions_boursieres"];

  return (
    <CosumafPdfShell {...shell} titre="Transactions boursières" regulation_ref="RG-273">
      {section && section.lignes.length > 0 ? (
        <>
          <Text style={styles.sousTitre}>{section.libelle}</Text>
          <View style={styles.table}>
            <View style={styles.header}>
              <Text style={[styles.cellIsin, styles.cellHeader]}>ISIN</Text>
              <Text style={[styles.cellLib, styles.cellHeader]}>Libellé titre · sens</Text>
              <Text style={[styles.cellSens, styles.cellHeader]}>Nb</Text>
              <Text style={[styles.cellNum, styles.cellHeader]}>Montant</Text>
            </View>
            {section.lignes.map((l, i) => (
              <View key={i} style={styles.row}>
                <Text style={styles.cellIsin}>{String(l.meta?.isin ?? "-")}</Text>
                <Text style={styles.cellLib}>{l.libelle}</Text>
                <Text style={styles.cellSens}>{fmtNombre(Number(l.meta?.count ?? 0))}</Text>
                <Text style={styles.cellNum}>{fmtXAF(l.valeur)}</Text>
              </View>
            ))}
            <View style={styles.totalRow}>
              <Text style={styles.totalLib}>Total transactions</Text>
              <Text style={styles.totalNum}>{fmtXAF(section.total)}</Text>
            </View>
          </View>
        </>
      ) : (
        <Text style={styles.empty}>Aucune transaction sur la période.</Text>
      )}
    </CosumafPdfShell>
  );
}
