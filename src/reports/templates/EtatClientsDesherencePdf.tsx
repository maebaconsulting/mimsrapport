// -*- coding: utf-8 -*-
// Gabarit PDF A4 paysage · État des clients en déshérence (10 colonnes).
// Porté de MIMS lib/integrations/pdf/templates/EtatClientsDesherencePdf.tsx.
//
// Adaptations : retrait de 'server-only' et des imports internes MIMS (aucun ici).
// Props autonomes (mentionsLines en option avec replis institutionnels). Aucun
// fontStyle italic (contrainte Inter). Hex codés en dur conservés (fidélité MIMS).

import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

const INK = "#11191F";
const GRAY_50 = "#FAFAF9";
const GRAY_200 = "#E5E4DC";
const GRAY_600 = "#6B7280";
const GRAY_700 = "#4A4F4D";
const ACCENT = "#FFED90";
const INFO = "#3A6B7C";

export interface EtatClientsDesherencePdfProps {
  sdb: { nom: string; code: string; contact: string };
  date_arrete: string;
  seuils: { inactif_mois: number; desherence_ans: number };
  lignes: Array<{
    nom_client: string;
    compte_titres: string;
    nature_instrument: string;
    date_souscription: string | null;
    date_maturite: string | null;
    montant_investi_xaf: number;
    coupon_xaf: number;
    montant_a_reverser_xaf: number;
    motif: string;
    date_desherence: string | null;
  }>;
  hash_sha256: string;
  timestamp_rfc3161_mock: string;
  generation_date: string;
  /**
   * Bannière de provenance (optionnelle). Signale l'origine Manar des données et
   * le hors-périmètre (coupons et espèces non disponibles).
   */
  provenance?: string[];
}

function fmtDate(iso: string | null): string {
  if (!iso) return "-";
  try {
    return new Date(iso).toLocaleDateString("fr-FR");
  } catch {
    return iso;
  }
}

function fmtDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString("fr-FR").replace(/\u202f/g, "\u00a0");
  } catch {
    return iso;
  }
}

function fmtNombre(n: number): string {
  return n.toLocaleString("fr-FR").replace(/\u202f/g, "\u00a0");
}

const MOTIF_LABEL: Record<string, string> = {
  INSTRUMENT_ECHU_NON_RECLAME: "Instrument échu non réclamé",
  COUPON_NON_ENCAISSE: "Coupon non encaissé",
  TITULAIRE_INJOIGNABLE: "Titulaire injoignable",
  SUCCESSION_NON_REGLEE: "Succession non réglée",
  AUTRE: "Autre",
};

const styles = StyleSheet.create({
  page: { padding: 30, fontFamily: "Inter", fontSize: 8, color: INK, backgroundColor: "#FFFFFF" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    borderBottomWidth: 1.5,
    borderBottomColor: INK,
    paddingBottom: 8,
    marginBottom: 6,
  },
  logoBlock: { flexDirection: "row", alignItems: "center", gap: 6 },
  logoCard: { width: 36, height: 36, backgroundColor: ACCENT, borderRadius: 4, justifyContent: "center", alignItems: "center" },
  logoLetter: { fontFamily: "Inter", fontWeight: 600, fontSize: 18, color: INK },
  logoLabel: { fontFamily: "Inter", fontWeight: 600, fontSize: 11, color: INK },
  logoSubLabel: { fontFamily: "Inter", fontSize: 8, color: GRAY_600, marginTop: 2 },
  headerCenter: { flex: 1, alignItems: "center" },
  headerTitle: { fontFamily: "Inter", fontWeight: 600, fontSize: 13, color: INK, textTransform: "uppercase", letterSpacing: 1 },
  headerSubtitle: { fontFamily: "Inter", fontSize: 8, color: GRAY_600, marginTop: 3 },
  headerRight: { alignItems: "flex-end" },
  headerDate: { fontFamily: "JetBrainsMono", fontSize: 8, color: GRAY_600 },
  headerPage: { fontFamily: "JetBrainsMono", fontSize: 8, color: GRAY_700, marginTop: 2 },

  metaPeriode: {
    backgroundColor: GRAY_50,
    paddingHorizontal: 8,
    paddingVertical: 5,
    marginBottom: 6,
    borderRadius: 2,
    borderWidth: 0.5,
    borderColor: GRAY_200,
  },
  metaText: { fontFamily: "Inter", fontSize: 8, color: GRAY_700 },

  provenanceBanner: {
    backgroundColor: GRAY_50,
    borderWidth: 0.5,
    borderColor: INFO,
    paddingHorizontal: 8,
    paddingVertical: 5,
    marginBottom: 6,
    borderRadius: 2,
  },
  provenanceTitre: { fontFamily: "Inter", fontWeight: 600, fontSize: 7, color: INFO, marginBottom: 1, textTransform: "uppercase", letterSpacing: 0.3 },
  provenanceLine: { fontFamily: "Inter", fontSize: 7, color: GRAY_700 },

  tableHeader: {
    flexDirection: "row",
    backgroundColor: GRAY_50,
    borderTopWidth: 0.5,
    borderTopColor: GRAY_200,
    borderBottomWidth: 1,
    borderBottomColor: GRAY_700,
    paddingVertical: 5,
    paddingHorizontal: 2,
  },
  th: { fontFamily: "Inter", fontWeight: 600, fontSize: 7, color: GRAY_700, textTransform: "uppercase", letterSpacing: 0.3 },
  row: {
    flexDirection: "row",
    paddingVertical: 4,
    paddingHorizontal: 2,
    borderBottomWidth: 0.5,
    borderBottomColor: GRAY_200,
    minHeight: 18,
    alignItems: "center",
  },
  rowZebra: { backgroundColor: GRAY_50 },

  cNom: { width: 110, fontSize: 7 },
  cCompte: { width: 86, fontFamily: "JetBrainsMono", fontSize: 7 },
  cNature: { flex: 1, fontSize: 7 },
  cSousc: { width: 52, fontFamily: "JetBrainsMono", fontSize: 7, color: GRAY_700 },
  cMatur: { width: 52, fontFamily: "JetBrainsMono", fontSize: 7, color: GRAY_700 },
  cInvesti: { width: 70, fontFamily: "JetBrainsMono", fontSize: 8, textAlign: "right" },
  cCoupon: { width: 56, fontFamily: "JetBrainsMono", fontSize: 8, textAlign: "right" },
  cReverser: { width: 74, fontFamily: "JetBrainsMono", fontSize: 8, textAlign: "right" },
  cMotif: { width: 84, fontSize: 6.5 },
  cDateD: { width: 52, fontFamily: "JetBrainsMono", fontSize: 7, color: GRAY_700 },

  totalRow: {
    flexDirection: "row",
    paddingVertical: 5,
    paddingHorizontal: 2,
    borderTopWidth: 1,
    borderTopColor: INK,
    backgroundColor: GRAY_50,
  },

  footer: {
    position: "absolute",
    bottom: 18,
    left: 30,
    right: 30,
    borderTopWidth: 0.5,
    borderTopColor: GRAY_200,
    paddingTop: 5,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  footerLeft: { fontFamily: "Inter", fontSize: 6, color: GRAY_600, flex: 1 },
  footerCenter: { fontFamily: "JetBrainsMono", fontSize: 6, color: GRAY_600, textAlign: "center", flex: 1 },
  footerRight: { fontFamily: "Inter", fontSize: 6, color: GRAY_600, textAlign: "right", flex: 1 },

  cachet: {
    position: "absolute",
    bottom: 50,
    right: 30,
    width: 90,
    height: 52,
    borderWidth: 0.5,
    borderColor: GRAY_200,
    borderRadius: 3,
    backgroundColor: GRAY_50,
    padding: 5,
    alignItems: "center",
    justifyContent: "center",
  },
  cachetLabel: { fontFamily: "Inter", fontWeight: 600, fontSize: 6, color: GRAY_700, textAlign: "center", textTransform: "uppercase", letterSpacing: 0.3, marginTop: 3 },
  cachetSub: { fontFamily: "JetBrainsMono", fontSize: 5, color: GRAY_600, textAlign: "center", marginTop: 2 },
});

export function EtatClientsDesherencePdf({
  sdb,
  date_arrete,
  seuils,
  lignes,
  hash_sha256,
  timestamp_rfc3161_mock,
  generation_date,
  provenance,
}: EtatClientsDesherencePdfProps) {
  const hashTronque = hash_sha256.slice(0, 8);
  const totalReverser = lignes.reduce((s, l) => s + l.montant_a_reverser_xaf, 0);

  return (
    <Document
      title={`État des clients en déshérence - ${sdb.code} - ${fmtDate(date_arrete)}`}
      author="Reporting Manar · MAEBA Consulting"
      subject="État des clients en déshérence · CEMAC 02/25"
      creator="Reporting Manar"
    >
      <Page size="A4" orientation="landscape" style={styles.page} wrap>
        <View style={styles.header} fixed>
          <View style={styles.logoBlock}>
            <View style={styles.logoCard}>
              <Text style={styles.logoLetter}>M</Text>
            </View>
            <View>
              <Text style={styles.logoLabel}>{sdb.nom}</Text>
              <Text style={styles.logoSubLabel}>{sdb.code} · {sdb.contact}</Text>
            </View>
          </View>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>État des clients en déshérence</Text>
            <Text style={styles.headerSubtitle}>
              Au {fmtDate(date_arrete)} · Règlement CEMAC N°02/25 · RG-267
            </Text>
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.headerDate}>Édition · {fmtDateTime(generation_date)}</Text>
            <Text
              style={styles.headerPage}
              render={({ pageNumber, totalPages }) => `Page ${pageNumber} / ${totalPages}`}
              fixed
            />
          </View>
        </View>

        <View style={styles.metaPeriode} fixed>
          <Text style={styles.metaText}>
            {"Seuils · inactif "}{seuils.inactif_mois}{" mois · déshérence "}{seuils.desherence_ans}{" ans"}
            {"  ·  "}{lignes.length}{" ligne"}{lignes.length > 1 ? "s" : ""}
            {"  ·  Devise · XAF"}
          </Text>
        </View>

        {provenance && provenance.length > 0 && (
          <View style={styles.provenanceBanner}>
            <Text style={styles.provenanceTitre}>
              Provenance et périmètre des données
            </Text>
            {provenance.map((line, idx) => (
              <Text key={idx} style={styles.provenanceLine}>
                {line}
              </Text>
            ))}
          </View>
        )}

        <View style={styles.tableHeader} fixed>
          <Text style={[styles.th, styles.cNom]}>Nom du client</Text>
          <Text style={[styles.th, styles.cCompte]}>Compte titres</Text>
          <Text style={[styles.th, styles.cNature]}>Nature instrument</Text>
          <Text style={[styles.th, styles.cSousc]}>Date sousc.</Text>
          <Text style={[styles.th, styles.cMatur]}>Date matur.</Text>
          <Text style={[styles.th, { ...styles.cInvesti, textAlign: "right" }]}>Mt investi</Text>
          <Text style={[styles.th, { ...styles.cCoupon, textAlign: "right" }]}>Coupon</Text>
          <Text style={[styles.th, { ...styles.cReverser, textAlign: "right" }]}>Mt à reverser</Text>
          <Text style={[styles.th, styles.cMotif]}>Motif déshérence</Text>
          <Text style={[styles.th, styles.cDateD]}>Date déshér.</Text>
        </View>

        {lignes.map((l, i) => (
          <View key={`${l.compte_titres}-${i}`} style={[styles.row, i % 2 === 1 ? styles.rowZebra : {}]} wrap={false}>
            <Text style={[styles.cNom, { color: INK }]}>{l.nom_client}</Text>
            <Text style={styles.cCompte}>{l.compte_titres}</Text>
            <Text style={[styles.cNature, { color: INK }]}>{l.nature_instrument}</Text>
            <Text style={styles.cSousc}>{fmtDate(l.date_souscription)}</Text>
            <Text style={styles.cMatur}>{fmtDate(l.date_maturite)}</Text>
            <Text style={styles.cInvesti}>{fmtNombre(l.montant_investi_xaf)}</Text>
            <Text style={styles.cCoupon}>{l.coupon_xaf > 0 ? fmtNombre(l.coupon_xaf) : "-"}</Text>
            <Text style={styles.cReverser}>{fmtNombre(l.montant_a_reverser_xaf)}</Text>
            <Text style={[styles.cMotif, { color: GRAY_700 }]}>{MOTIF_LABEL[l.motif] ?? l.motif}</Text>
            <Text style={styles.cDateD}>{fmtDate(l.date_desherence)}</Text>
          </View>
        ))}

        {lignes.length === 0 && (
          <View style={{ paddingVertical: 24, alignItems: "center" }}>
            <Text style={{ fontFamily: "Inter", fontSize: 10, color: GRAY_600 }}>
              Aucun client en déshérence à la date d'arrêté.
            </Text>
          </View>
        )}

        {lignes.length > 0 && (
          <View style={styles.totalRow}>
            <Text style={{ flex: 1, fontFamily: "Inter", fontWeight: 600, fontSize: 8, color: INK, textAlign: "right", paddingRight: 8 }}>
              Total montant à reverser XAF
            </Text>
            <Text style={{ width: 74, fontFamily: "JetBrainsMono", fontWeight: 600, fontSize: 9, color: INK, textAlign: "right" }}>
              {fmtNombre(totalReverser)}
            </Text>
            <Text style={{ width: 136 }}> </Text>
          </View>
        )}

        <View style={styles.footer} fixed>
          <Text style={styles.footerLeft}>
            Document généré par Reporting Manar · Conforme Règlement CEMAC N°02/25 (avoirs en déshérence) · RG-267
          </Text>
          <Text style={styles.footerCenter}>
            {"Hash SHA-256 · "}{hashTronque}{"... · Horodatage RFC 3161 mock"}
          </Text>
          <Text style={styles.footerRight}>{"© 2026 MAEBA Consulting · Solution MIMS"}</Text>
        </View>

        <View style={styles.cachet} fixed>
          <Text style={{ fontFamily: "JetBrainsMono", fontSize: 10, color: INFO }}>[V]</Text>
          <Text style={styles.cachetLabel}>Cachet électronique</Text>
          <Text style={styles.cachetLabel}>Reporting Manar</Text>
          <Text style={styles.cachetSub}>{timestamp_rfc3161_mock.slice(0, 10)}</Text>
        </View>
      </Page>
    </Document>
  );
}
