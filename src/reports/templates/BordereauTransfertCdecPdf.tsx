// -*- coding: utf-8 -*-
// Gabarit PDF A4 portrait · bordereau de transfert des avoirs en déshérence (10 ans)
// vers la CDEC / direction nationale BEAC (CEMAC 02/25).
// Porté de MIMS lib/integrations/pdf/templates/BordereauTransfertCdecPdf.tsx.
//
// Adaptations : aucun import interne MIMS (props autonomes). Aucun fontStyle
// italic (contrainte Inter). Hex codés en dur conservés (fidélité MIMS).

import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

const INK = "#11191F";
const GRAY_50 = "#FAFAF9";
const GRAY_200 = "#E5E4DC";
const GRAY_600 = "#6B7280";
const GRAY_700 = "#4A4F4D";
const ACCENT = "#FFED90";
const INFO = "#3A6B7C";

export interface BordereauTransfertCdecPdfProps {
  sdb: { nom: string; code: string };
  destinataire: "CDEC" | "BEAC";
  date_arrete: string;
  lignes: Array<{
    nom_client: string;
    compte_titres: string;
    instrument: string;
    date_desherence: string | null;
    montant_xaf: number;
  }>;
  hash_sha256: string;
  timestamp_rfc3161_mock: string;
  generation_date: string;
}

function fmtDate(iso: string | null): string {
  if (!iso) return "-";
  try { return new Date(iso).toLocaleDateString("fr-FR"); } catch { return iso; }
}
function fmtNombre(n: number): string { return n.toLocaleString("fr-FR").replace(/\u202f/g, "\u00a0"); }

const DEST: Record<string, string> = {
  CDEC: "Caisse des Dépôts et Consignations (CDEC)",
  BEAC: "Direction nationale de la BEAC",
};

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: "Inter", fontSize: 9, color: INK, backgroundColor: "#FFFFFF" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", borderBottomWidth: 1.5, borderBottomColor: INK, paddingBottom: 10, marginBottom: 12 },
  logoBlock: { flexDirection: "row", alignItems: "center", gap: 8 },
  logoCard: { width: 40, height: 40, backgroundColor: ACCENT, borderRadius: 4, justifyContent: "center", alignItems: "center" },
  logoLetter: { fontFamily: "Inter", fontWeight: 600, fontSize: 20, color: INK },
  logoLabel: { fontFamily: "Inter", fontWeight: 600, fontSize: 12, color: INK },
  logoSubLabel: { fontFamily: "Inter", fontSize: 8, color: GRAY_600, marginTop: 2 },
  titleBox: { borderWidth: 0.75, borderColor: GRAY_700, borderRadius: 3, backgroundColor: GRAY_50, paddingVertical: 8, paddingHorizontal: 12, alignItems: "center", marginBottom: 12 },
  titleText: { fontFamily: "Inter", fontWeight: 600, fontSize: 13, color: INK, textTransform: "uppercase", letterSpacing: 0.6, textAlign: "center" },
  intro: { fontFamily: "Inter", fontSize: 10, color: INK, marginBottom: 14, lineHeight: 1.5 },
  bold: { fontFamily: "Inter", fontWeight: 600 },
  tableHeader: { flexDirection: "row", backgroundColor: GRAY_50, borderBottomWidth: 1, borderBottomColor: GRAY_700, paddingVertical: 6, paddingHorizontal: 4 },
  th: { fontFamily: "Inter", fontWeight: 600, fontSize: 7.5, color: GRAY_700, textTransform: "uppercase", letterSpacing: 0.3 },
  row: { flexDirection: "row", paddingVertical: 5, paddingHorizontal: 4, borderBottomWidth: 0.5, borderBottomColor: GRAY_200 },
  rowZebra: { backgroundColor: GRAY_50 },
  cNom: { width: 130, fontSize: 8 },
  cCompte: { width: 100, fontFamily: "JetBrainsMono", fontSize: 8 },
  cInstr: { flex: 1, fontSize: 8 },
  cDate: { width: 60, fontFamily: "JetBrainsMono", fontSize: 7.5, color: GRAY_700 },
  cMontant: { width: 90, fontFamily: "JetBrainsMono", fontSize: 8, textAlign: "right" },
  totalRow: { flexDirection: "row", paddingVertical: 6, paddingHorizontal: 4, borderTopWidth: 1, borderTopColor: INK, backgroundColor: GRAY_50 },
  signRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 36 },
  signBox: { width: 200 },
  signLabel: { fontFamily: "Inter", fontSize: 8, color: GRAY_600, marginBottom: 24 },
  signName: { fontFamily: "Inter", fontWeight: 600, fontSize: 9, color: INK, borderTopWidth: 0.5, borderTopColor: GRAY_700, paddingTop: 4 },
  footer: { position: "absolute", bottom: 20, left: 40, right: 40, borderTopWidth: 0.5, borderTopColor: GRAY_200, paddingTop: 6 },
  footerText: { fontFamily: "Inter", fontSize: 6, color: GRAY_600, textAlign: "center", marginBottom: 2 },
  footerMono: { fontFamily: "JetBrainsMono", fontSize: 6, color: GRAY_600, textAlign: "center" },
  cachet: { position: "absolute", bottom: 50, right: 40, width: 100, height: 56, borderWidth: 0.5, borderColor: GRAY_200, borderRadius: 3, backgroundColor: GRAY_50, padding: 6, alignItems: "center", justifyContent: "center" },
  cachetLabel: { fontFamily: "Inter", fontWeight: 600, fontSize: 6, color: GRAY_700, textAlign: "center", textTransform: "uppercase", letterSpacing: 0.3, marginTop: 3 },
  cachetSub: { fontFamily: "JetBrainsMono", fontSize: 5, color: GRAY_600, textAlign: "center", marginTop: 2 },
});

export function BordereauTransfertCdecPdf({
  sdb, destinataire, date_arrete, lignes, hash_sha256, timestamp_rfc3161_mock,
}: BordereauTransfertCdecPdfProps) {
  const hashTronque = hash_sha256.slice(0, 8);
  const total = lignes.reduce((s, l) => s + l.montant_xaf, 0);

  return (
    <Document title={`Bordereau transfert ${destinataire} - ${sdb.code}`} author="MIMS REPORTING · MAEBA Consulting" subject="Bordereau transfert déshérence CEMAC 02/25" creator="MIMS REPORTING">
      <Page size="A4" style={styles.page} wrap>
        <View style={styles.header}>
          <View style={styles.logoBlock}>
            <View style={styles.logoCard}><Text style={styles.logoLetter}>M</Text></View>
            <View>
              <Text style={styles.logoLabel}>{sdb.nom}</Text>
              <Text style={styles.logoSubLabel}>{sdb.code}</Text>
            </View>
          </View>
        </View>

        <View style={styles.titleBox}>
          <Text style={styles.titleText}>Bordereau de transfert · avoirs en déshérence (au {fmtDate(date_arrete)})</Text>
        </View>

        <Text style={styles.intro}>
          {"En application du Règlement CEMAC N°02/25, la SDB "}<Text style={styles.bold}>{sdb.nom}</Text>
          {" procède au transfert des avoirs en déshérence ci-dessous (inactivité supérieure au seuil réglementaire) à "}
          <Text style={styles.bold}>{DEST[destinataire] ?? destinataire}</Text>{"."}
        </Text>

        <View>
          <View style={styles.tableHeader}>
            <Text style={[styles.th, styles.cNom]}>Nom du client</Text>
            <Text style={[styles.th, styles.cCompte]}>Compte titres</Text>
            <Text style={[styles.th, styles.cInstr]}>Instrument</Text>
            <Text style={[styles.th, styles.cDate]}>Date déshér.</Text>
            <Text style={[styles.th, { ...styles.cMontant, textAlign: "right" }]}>Montant XAF</Text>
          </View>
          {lignes.map((l, i) => (
            <View key={`${l.compte_titres}-${i}`} style={[styles.row, i % 2 === 1 ? styles.rowZebra : {}]} wrap={false}>
              <Text style={styles.cNom}>{l.nom_client}</Text>
              <Text style={styles.cCompte}>{l.compte_titres}</Text>
              <Text style={styles.cInstr}>{l.instrument}</Text>
              <Text style={styles.cDate}>{fmtDate(l.date_desherence)}</Text>
              <Text style={styles.cMontant}>{fmtNombre(l.montant_xaf)}</Text>
            </View>
          ))}
          {lignes.length === 0 && (
            <View style={{ paddingVertical: 20, alignItems: "center" }}>
              <Text style={{ fontFamily: "Inter", fontSize: 10, color: GRAY_600 }}>Aucun avoir à transférer à la date d'arrêté.</Text>
            </View>
          )}
          {lignes.length > 0 && (
            <View style={styles.totalRow}>
              <Text style={{ flex: 1, fontFamily: "Inter", fontWeight: 600, fontSize: 9, color: INK, textAlign: "right", paddingRight: 8 }}>Total à transférer XAF</Text>
              <Text style={{ width: 90, fontFamily: "JetBrainsMono", fontWeight: 600, fontSize: 10, color: INK, textAlign: "right" }}>{fmtNombre(total)}</Text>
            </View>
          )}
        </View>

        <View style={styles.signRow}>
          <View style={styles.signBox}>
            <Text style={styles.signLabel}>Pour la SDB · Le Directeur Général</Text>
            <Text style={styles.signName}>{sdb.nom}</Text>
          </View>
          <View style={styles.signBox}>
            <Text style={styles.signLabel}>Pour {destinataire} · réception</Text>
            <Text style={styles.signName}>{DEST[destinataire] ?? destinataire}</Text>
          </View>
        </View>

        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>Bordereau généré par MIMS REPORTING · Conforme Règlement CEMAC N°02/25 · RG-267</Text>
          <Text style={styles.footerMono}>{"Hash SHA-256 · "}{hashTronque}{"... · Horodatage RFC 3161 mock"}</Text>
        </View>
        <View style={styles.cachet} fixed>
          <Text style={{ fontFamily: "JetBrainsMono", fontSize: 10, color: INFO }}>[V]</Text>
          <Text style={styles.cachetLabel}>Cachet électronique</Text>
          <Text style={styles.cachetLabel}>MIMS REPORTING</Text>
          <Text style={styles.cachetSub}>{timestamp_rfc3161_mock.slice(0, 10)}</Text>
        </View>
      </Page>
    </Document>
  );
}
