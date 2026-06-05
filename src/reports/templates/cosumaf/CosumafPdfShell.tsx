// Shell partagé des gabarits COSUMAF · en-tête SDB + référence réglementaire,
// pied de page (cachet hash, horodatage, autorité, pagination), filigrane
// rectificatif. Porté de MIMS, adapté : mentions passées en option (retrait de
// renderMentionsTemplate/ParametresSdbRow). Utilise Helvetica (police intégrée).

import type { ReactNode } from "react";
import {
  Document,
  Page,
  View,
  Text,
  StyleSheet,
  Image,
} from "@react-pdf/renderer";
import { COSUMAF_TOKENS, fmtHashCourt } from "./cosumaf-tokens";
import { RectificatifWatermark } from "./RectificatifWatermark";

export interface CosumafPdfShellProps {
  titre: string;
  sdb_code: string;
  sdb_nom: string;
  periode_libelle: string;
  regulation_ref: string;
  version: number; // 1 ou >= 2 (rectif)
  motif_rectification?: string; // requis si version >= 2
  hash_sha256: string;
  timestamp_rfc3161_mock: string;
  autorite_emettrice: string;
  children: ReactNode;
  /** Lignes de mentions légales du pied (optionnel). */
  mentionsLines?: string[];
  /** URL/data du logo (optionnel). */
  logoUrl?: string | null;
}

const styles = StyleSheet.create({
  page: {
    backgroundColor: "#FFFFFF",
    color: COSUMAF_TOKENS.INK,
    fontFamily: "Helvetica",
    fontSize: 9,
    padding: 32,
    paddingBottom: 84,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    borderBottomWidth: 1,
    borderBottomColor: COSUMAF_TOKENS.INK,
    paddingBottom: 8,
    marginBottom: 12,
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  headerLeftText: { flexDirection: "column" },
  logo: { maxWidth: 80, maxHeight: 40, objectFit: "contain" },
  sdbCode: { fontSize: 12, fontWeight: 700, color: COSUMAF_TOKENS.INK },
  sdbNom: { fontSize: 9, color: COSUMAF_TOKENS.GRAY_700, marginTop: 2 },
  headerRight: { flexDirection: "column", alignItems: "flex-end" },
  mentionsBlock: {
    marginBottom: 4,
    paddingBottom: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: COSUMAF_TOKENS.GRAY_200,
  },
  mentionsLine: {
    fontSize: 6,
    color: COSUMAF_TOKENS.GRAY_700,
    textAlign: "center",
    marginBottom: 1,
  },
  docTitre: { fontSize: 11, fontWeight: 700, color: COSUMAF_TOKENS.INK },
  docPeriode: { fontSize: 9, color: COSUMAF_TOKENS.GRAY_700, marginTop: 2 },
  docReg: { fontSize: 8, color: COSUMAF_TOKENS.GRAY_600, marginTop: 2 },
  docRectif: { fontSize: 8, color: COSUMAF_TOKENS.DANGER, marginTop: 2 },
  content: { marginTop: 4 },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 32,
    right: 32,
    borderTopWidth: 1,
    borderTopColor: COSUMAF_TOKENS.GRAY_200,
    paddingTop: 6,
  },
  footerRow: { flexDirection: "row", justifyContent: "space-between" },
  footerLabel: { fontSize: 7, color: COSUMAF_TOKENS.GRAY_600 },
  footerValue: {
    fontSize: 7,
    color: COSUMAF_TOKENS.INK,
    fontFamily: "Helvetica-Bold",
  },
  pageNum: { fontSize: 7, color: COSUMAF_TOKENS.GRAY_600, textAlign: "right" },
  motifRectif: {
    marginTop: 4,
    padding: 6,
    backgroundColor: COSUMAF_TOKENS.DANGER_SOFT,
    fontSize: 8,
    color: COSUMAF_TOKENS.DANGER,
  },
});

export function CosumafPdfShell(props: CosumafPdfShellProps) {
  const {
    titre,
    sdb_code,
    sdb_nom,
    periode_libelle,
    regulation_ref,
    version,
    motif_rectification,
    hash_sha256,
    timestamp_rfc3161_mock,
    autorite_emettrice,
    children,
    mentionsLines,
    logoUrl,
  } = props;

  const docTitle = `${titre} · ${sdb_code} · ${periode_libelle}${
    version > 1 ? ` · Rectificatif V${version}` : ""
  }`;

  const mentions = mentionsLines ?? [];

  return (
    <Document
      title={docTitle}
      author={autorite_emettrice}
      subject="Déclaration COSUMAF"
    >
      <Page size="A4" style={styles.page}>
        <RectificatifWatermark version={version} />

        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            {logoUrl ? <Image src={logoUrl} style={styles.logo} /> : null}
            <View style={styles.headerLeftText}>
              <Text style={styles.sdbCode}>{sdb_code}</Text>
              <Text style={styles.sdbNom}>{sdb_nom}</Text>
            </View>
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.docTitre}>{titre}</Text>
            <Text style={styles.docPeriode}>{`Période · ${periode_libelle}`}</Text>
            <Text style={styles.docReg}>
              {`Référence réglementaire · ${regulation_ref}`}
            </Text>
            {version > 1 ? (
              <Text style={styles.docRectif}>
                {`Version rectificative V${version}`}
              </Text>
            ) : null}
          </View>
        </View>

        <View style={styles.content}>{children}</View>

        {version > 1 && motif_rectification ? (
          <View style={styles.motifRectif}>
            <Text>{`Motif de rectification · ${motif_rectification}`}</Text>
          </View>
        ) : null}

        <View style={styles.footer} fixed>
          {mentions.length > 0 ? (
            <View style={styles.mentionsBlock}>
              {mentions.map((line, idx) => (
                <Text key={idx} style={styles.mentionsLine}>
                  {line}
                </Text>
              ))}
            </View>
          ) : null}
          <View style={styles.footerRow}>
            <Text style={styles.footerLabel}>
              {`Cachet SHA-256 · `}
              <Text style={styles.footerValue}>
                {fmtHashCourt(hash_sha256)}
              </Text>
            </Text>
            <Text style={styles.footerLabel}>
              {`Horodatage RFC 3161 mock · `}
              <Text style={styles.footerValue}>{timestamp_rfc3161_mock}</Text>
            </Text>
          </View>
          <View style={styles.footerRow}>
            <Text style={styles.footerLabel}>
              {`Autorité émettrice · `}
              <Text style={styles.footerValue}>{autorite_emettrice}</Text>
            </Text>
            <Text
              style={styles.pageNum}
              render={({ pageNumber, totalPages }) =>
                `${pageNumber} / ${totalPages}`
              }
            />
          </View>
        </View>
      </Page>
    </Document>
  );
}
