// Gabarit PDF A4 portrait · Attestation de portefeuille de titres.
// Porté de MIMS lib/integrations/pdf/templates/AttestationPortefeuillePdf.tsx.
//
// Adaptations : retrait de la dépendance sdbInfo/renderMentionsTemplate de MIMS
// (mentions passées en option). Aucun fontStyle italic (contrainte Inter). Le
// rendu se fait côté webview via pdf().toBlob() (voir services/attestation.ts).

import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Image,
} from "@react-pdf/renderer";
import { Barcode } from "./Barcode";

// Tokens DS v2.2 (hex inline · Tailwind ignoré par React-PDF), verbatim MIMS.
const INK = "#11191F";
const GRAY_50 = "#FAFAF9";
const GRAY_200 = "#E5E4DC";
const GRAY_600 = "#6B7280";
const GRAY_700 = "#4A4F4D";
const ACCENT = "#FFED90";

export interface AttestationPortefeuillePdfProps {
  sdb: {
    nom: string;
    code: string;
    /** Numéro d'agrément COSUMAF (affiché en en-tête si présent). */
    agrement_cosumaf?: string;
    rccm?: string;
    niu?: string;
  };
  client: {
    code: string;
    nom_complet: string;
    type: "PP" | "PM";
  };
  /** Numéro de portefeuille / compte titres (portefeuilles.code). */
  numero_compte: string;
  /** Date d'arrêté de l'attestation (ISO). */
  date_arrete: string;
  lignes: Array<{
    libelle: string;
    quantite: number;
    valorisation_xaf: number;
  }>;
  hash_sha256: string;
  timestamp_rfc3161_mock: string;
  /** Ville d'arrêté (défaut Douala). */
  ville?: string;
  /** Lignes de mentions légales du pied (défaut institutionnel). */
  mentionsLines?: string[];
  /** URL/data du logo SDB (optionnel). */
  logoUrl?: string | null;
}

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("fr-FR");
  } catch {
    return iso;
  }
}

function fmtNombre(n: number): string {
  return n.toLocaleString("fr-FR").replace(/\u202f/g, "\u00a0");
}

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: "Inter",
    fontSize: 9,
    color: INK,
    backgroundColor: "#FFFFFF",
  },
  headerTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 18,
  },
  logoBlock: { flexDirection: "row", alignItems: "center", gap: 8 },
  logoCard: {
    width: 40,
    height: 40,
    backgroundColor: ACCENT,
    borderRadius: 4,
    justifyContent: "center",
    alignItems: "center",
  },
  logoLetter: {
    fontFamily: "Inter",
    fontWeight: 600,
    fontSize: 20,
    color: INK,
  },
  logoLabel: {
    fontFamily: "Inter",
    fontWeight: 600,
    fontSize: 12,
    color: INK,
  },
  logoSubLabel: {
    fontFamily: "Inter",
    fontSize: 8,
    color: GRAY_600,
    marginTop: 2,
  },
  headerCity: {
    fontFamily: "Inter",
    fontSize: 9,
    color: INK,
    textAlign: "right",
  },
  titleBox: {
    borderWidth: 0.75,
    borderColor: GRAY_700,
    borderRadius: 3,
    backgroundColor: GRAY_50,
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignItems: "center",
    marginBottom: 18,
  },
  titleText: {
    fontFamily: "Inter",
    fontWeight: 600,
    fontSize: 13,
    color: INK,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    textAlign: "center",
  },
  attestBlock: { marginBottom: 16 },
  attestText: {
    fontFamily: "Inter",
    fontSize: 10,
    color: INK,
    lineHeight: 1.5,
  },
  attestBold: { fontFamily: "Inter", fontWeight: 600 },
  tableContainer: {
    borderWidth: 0.5,
    borderColor: GRAY_200,
    borderRadius: 2,
    overflow: "hidden",
    marginBottom: 16,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: GRAY_50,
    borderBottomWidth: 1,
    borderBottomColor: GRAY_700,
    paddingVertical: 6,
    paddingHorizontal: 6,
  },
  tableHeaderCell: {
    fontFamily: "Inter",
    fontWeight: 600,
    fontSize: 8,
    color: GRAY_700,
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 5,
    paddingHorizontal: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: GRAY_200,
    alignItems: "center",
  },
  tableRowZebra: { backgroundColor: GRAY_50 },
  cellValeur: { flex: 1, fontFamily: "Inter", fontSize: 9, color: INK },
  cellQuantite: {
    width: 110,
    textAlign: "right",
    fontFamily: "JetBrainsMono",
    fontSize: 9,
    color: INK,
  },
  cellMontant: {
    width: 130,
    textAlign: "right",
    fontFamily: "JetBrainsMono",
    fontSize: 9,
    color: INK,
  },
  tableTotal: {
    flexDirection: "row",
    paddingVertical: 6,
    paddingHorizontal: 6,
    borderTopWidth: 1,
    borderTopColor: INK,
    backgroundColor: GRAY_50,
  },
  totalLabel: {
    flex: 1,
    fontFamily: "Inter",
    fontWeight: 600,
    fontSize: 9,
    color: INK,
    textAlign: "right",
    paddingRight: 8,
  },
  totalValue: {
    width: 130,
    textAlign: "right",
    fontFamily: "JetBrainsMono",
    fontWeight: 600,
    fontSize: 10,
    color: INK,
  },
  closing: { marginTop: 6 },
  closingText: {
    fontFamily: "Inter",
    fontSize: 10,
    color: INK,
    marginBottom: 24,
  },
  signatureBlock: { alignItems: "flex-end" },
  signatureCity: {
    fontFamily: "Inter",
    fontSize: 9,
    color: INK,
    marginBottom: 28,
  },
  signatureTitle: {
    fontFamily: "Inter",
    fontWeight: 600,
    fontSize: 9,
    color: INK,
  },
  footer: {
    position: "absolute",
    bottom: 20,
    left: 40,
    right: 40,
    borderTopWidth: 0.5,
    borderTopColor: GRAY_200,
    paddingTop: 6,
  },
  footerText: {
    fontFamily: "Inter",
    fontSize: 6,
    color: GRAY_600,
    textAlign: "center",
    marginBottom: 2,
  },
  footerMono: {
    fontFamily: "JetBrainsMono",
    fontSize: 6,
    color: GRAY_600,
    textAlign: "center",
  },
});

const DEFAULT_MENTIONS = [
  "Solution MIMS · MAEBA Consulting · marché financier CEMAC / BVMAC",
  "Document de reporting · conformité COSUMAF · Règlement n° 2014/03",
];

export function AttestationPortefeuillePdf({
  sdb,
  client,
  numero_compte,
  date_arrete,
  lignes,
  hash_sha256,
  timestamp_rfc3161_mock,
  ville,
  mentionsLines,
  logoUrl,
}: AttestationPortefeuillePdfProps) {
  const hashTronque = hash_sha256.slice(0, 8);
  const total = lignes.reduce((s, l) => s + l.valorisation_xaf, 0);
  const villeArrete = ville ?? "Douala";
  const raisonSociale = sdb.nom;
  const mentions =
    mentionsLines && mentionsLines.length > 0 ? mentionsLines : DEFAULT_MENTIONS;

  return (
    <Document
      title={`Attestation de portefeuille - ${client.code} - ${fmtDate(date_arrete)}`}
      author="MIMS REPORTING · MAEBA Consulting"
      subject="Attestation de portefeuille de titres"
      creator="MIMS REPORTING"
    >
      <Page size="A4" style={styles.page} wrap>
        <View style={styles.headerTopRow}>
          <View style={styles.logoBlock}>
            {logoUrl ? (
              <Image
                src={logoUrl}
                style={{ maxWidth: 80, maxHeight: 40, objectFit: "contain" }}
              />
            ) : (
              <View style={styles.logoCard}>
                <Text style={styles.logoLetter}>M</Text>
              </View>
            )}
            <View>
              <Text style={styles.logoLabel}>{raisonSociale}</Text>
              <Text style={styles.logoSubLabel}>{sdb.code}</Text>
              {sdb.agrement_cosumaf ? (
                <Text style={styles.logoSubLabel}>
                  {`Agrément COSUMAF · ${sdb.agrement_cosumaf}`}
                </Text>
              ) : null}
            </View>
          </View>
          <Text style={styles.headerCity}>
            {villeArrete}, le {fmtDate(date_arrete)}
          </Text>
        </View>

        <View style={styles.titleBox}>
          <Text style={styles.titleText}>
            Attestation de portefeuille de titres (au {fmtDate(date_arrete)})
          </Text>
        </View>

        <View style={styles.attestBlock}>
          <Text style={styles.attestText}>
            {"Nous soussigné, "}
            <Text style={styles.attestBold}>{raisonSociale}</Text>
            {", attestons que "}
            <Text style={styles.attestBold}>{client.nom_complet}</Text>
            {" (compte n° "}
            <Text style={styles.attestBold}>{numero_compte}</Text>
            {`) détient à la date du ${fmtDate(date_arrete)} les valeurs mobilières suivantes :`}
          </Text>
        </View>

        <View style={styles.tableContainer}>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Valeur</Text>
            <Text
              style={[styles.tableHeaderCell, { width: 110, textAlign: "right" }]}
            >
              Quantité
            </Text>
            <Text
              style={[styles.tableHeaderCell, { width: 130, textAlign: "right" }]}
            >
              Valeur (XAF)
            </Text>
          </View>

          {lignes.length === 0 ? (
            <View style={{ padding: 12, alignItems: "center" }}>
              <Text
                style={{ fontFamily: "Inter", fontSize: 9, color: GRAY_600 }}
              >
                Aucune position titres à la date d'arrêté.
              </Text>
            </View>
          ) : (
            lignes.map((l, idx) => (
              <View
                key={`${l.libelle}-${idx}`}
                style={[
                  styles.tableRow,
                  idx % 2 === 1 ? styles.tableRowZebra : {},
                ]}
                wrap={false}
              >
                <Text style={styles.cellValeur}>{l.libelle}</Text>
                <Text style={styles.cellQuantite}>{fmtNombre(l.quantite)}</Text>
                <Text style={styles.cellMontant}>
                  {fmtNombre(l.valorisation_xaf)}
                </Text>
              </View>
            ))
          )}

          <View style={styles.tableTotal}>
            <Text style={styles.totalLabel}>
              Montant total du portefeuille XAF
            </Text>
            <Text style={styles.totalValue}>{fmtNombre(total)}</Text>
          </View>
        </View>

        <View style={styles.closing}>
          <Text style={styles.closingText}>
            Fait pour servir et valoir ce que de droit.
          </Text>
          <View style={styles.signatureBlock}>
            <Text style={styles.signatureCity}>
              {villeArrete}, le {fmtDate(date_arrete)}
            </Text>
            <Text style={styles.signatureTitle}>Le Directeur Général</Text>
          </View>
        </View>

        <View style={styles.footer} fixed>
          {mentions.map((line, idx) => (
            <Text key={`mention-${idx}`} style={styles.footerText}>
              {line}
            </Text>
          ))}
          <Text style={styles.footerMono}>
            {"Hash SHA-256 · "}
            {hashTronque}
            {"... · horodatage "}
            {timestamp_rfc3161_mock.slice(0, 19).replace("T", " ")}
          </Text>
          <Text
            style={[styles.footerMono, { marginTop: 2 }]}
            render={({ pageNumber, totalPages }) =>
              `${pageNumber}/${totalPages}`
            }
          />
        </View>

        <View
          style={{
            position: "absolute",
            bottom: 48,
            right: 40,
            alignItems: "flex-end",
          }}
          fixed
        >
          <Barcode value={hash_sha256.slice(0, 8)} height={28} unit={0.6} />
        </View>
      </Page>
    </Document>
  );
}
