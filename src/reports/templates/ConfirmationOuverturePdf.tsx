// Gabarit PDF A4 portrait · Confirmation d'ouverture de compte titre (lettre).
// Porté de MIMS lib/integrations/pdf/templates/ConfirmationOuverturePdf.tsx.
//
// Adaptations : retrait de la dépendance sdbInfo/renderMentionsTemplate de MIMS
// (mentions/ville passées en options autonomes). Aucun fontStyle italic
// (contrainte Inter). Aucune police enregistrée ici. Logique sdb_id/RLS retirée.
//
// Référence visuelle · Confirmation d'ouverture de compte (CCA Bourse) :
// en-tête logo, bloc destinataire, objet, corps confirmant le n° de compte et
// la date d'ouverture, formule de courtoisie, signature SDB, pied légal.

import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Image,
} from "@react-pdf/renderer";
import { Barcode } from "./Barcode";

// ---------------------------------------------------------------------------
// Tokens DS v2.2 (hex inline · verbatim MIMS)
// ---------------------------------------------------------------------------

const INK = "#11191F";
const GRAY_50 = "#FAFAF9";
const GRAY_200 = "#E5E4DC";
const GRAY_600 = "#6B7280";
const GRAY_700 = "#4A4F4D";
const ACCENT = "#FFED90";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ConfirmationOuverturePdfProps {
  sdb: { nom: string; code: string };
  client: {
    nom_complet: string;
    adresse: string;
    type: "PP" | "PM";
  };
  /** Numéro de compte titres (portefeuilles.code). */
  numero_compte: string;
  /** Date d'ouverture du compte (ISO). */
  date_ouverture: string;
  /** Date d'émission de la lettre (ISO). */
  date_emission: string;
  hash_sha256: string;
  timestamp_rfc3161_mock: string;
  /** Ville d'émission (défaut Douala). */
  ville?: string;
  /** Lignes de mentions légales du pied (défaut institutionnel). */
  mentionsLines?: string[];
  /** URL/data du logo SDB (optionnel). */
  logoUrl?: string | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("fr-FR");
  } catch {
    return iso;
  }
}

// ---------------------------------------------------------------------------
// StyleSheet
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  page: {
    padding: 48,
    fontFamily: "Inter",
    fontSize: 10,
    color: INK,
    backgroundColor: "#FFFFFF",
    lineHeight: 1.5,
  },

  // En-tête
  headerTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 32,
  },
  logoBlock: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
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

  // Bloc destinataire (encadré)
  recipientBox: {
    alignSelf: "flex-end",
    width: 240,
    borderWidth: 0.5,
    borderColor: GRAY_200,
    borderRadius: 3,
    backgroundColor: GRAY_50,
    padding: 10,
    marginBottom: 28,
  },
  recipientDate: {
    fontFamily: "Inter",
    fontSize: 9,
    color: INK,
    marginBottom: 6,
  },
  recipientName: {
    fontFamily: "Inter",
    fontWeight: 600,
    fontSize: 10,
    color: INK,
  },
  recipientAddress: {
    fontFamily: "Inter",
    fontSize: 9,
    color: GRAY_700,
    marginTop: 2,
  },

  // Objet
  objet: {
    fontFamily: "Inter",
    fontWeight: 600,
    fontSize: 10,
    color: INK,
    marginBottom: 20,
  },

  // Corps de lettre
  bodyText: {
    fontFamily: "Inter",
    fontSize: 10,
    color: INK,
    marginBottom: 14,
  },
  bodyBold: {
    fontFamily: "Inter",
    fontWeight: 600,
  },

  // Signature
  signatureBlock: {
    alignItems: "flex-end",
    marginTop: 28,
  },
  signatureName: {
    fontFamily: "Inter",
    fontWeight: 600,
    fontSize: 10,
    color: INK,
  },

  // Pied légal
  footer: {
    position: "absolute",
    bottom: 20,
    left: 48,
    right: 48,
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

// ---------------------------------------------------------------------------
// Mentions de repli institutionnelles
// ---------------------------------------------------------------------------

const DEFAULT_MENTIONS = [
  "CREDIT COMMUNAUTAIRE D'AFRIQUE BOURSE Société Anonyme au capital de 300 000 000 F CFA",
  "Solution MIMS · MAEBA Consulting · Agrément COSUMAF · Conformité OHADA · Règlement n° 2014/03",
];

// ---------------------------------------------------------------------------
// Composant principal
// ---------------------------------------------------------------------------

export function ConfirmationOuverturePdf({
  sdb,
  client,
  numero_compte,
  date_ouverture,
  date_emission,
  hash_sha256,
  ville,
  mentionsLines,
  logoUrl,
}: ConfirmationOuverturePdfProps) {
  const hashTronque = hash_sha256.slice(0, 8);

  const villeEmission = ville ?? "Douala";

  const raisonSociale = `MIMS · ${sdb.nom}`;

  // Civilité générique · PP « Madame, Monsieur », PM « Madame, Monsieur »
  const civilite = "Madame, Monsieur";

  const mentions =
    mentionsLines && mentionsLines.length > 0 ? mentionsLines : DEFAULT_MENTIONS;

  return (
    <Document
      title={`Confirmation d'ouverture de compte - ${numero_compte}`}
      author="MIMS REPORTING · MAEBA Consulting"
      subject="Confirmation d'ouverture de compte titre"
      creator="MIMS REPORTING"
    >
      <Page size="A4" style={styles.page} wrap>
        {/* En-tête */}
        <View style={styles.headerTopRow}>
          <View style={styles.logoBlock}>
            {logoUrl ? (
              <Image src={logoUrl} style={{ maxWidth: 80, maxHeight: 40, objectFit: "contain" }} />
            ) : (
              <View style={styles.logoCard}>
                <Text style={styles.logoLetter}>M</Text>
              </View>
            )}
            <View>
              <Text style={styles.logoLabel}>{raisonSociale}</Text>
              <Text style={styles.logoSubLabel}>{sdb.code}</Text>
            </View>
          </View>
        </View>

        {/* Bloc destinataire */}
        <View style={styles.recipientBox}>
          <Text style={styles.recipientDate}>
            {villeEmission}, le {fmtDate(date_emission)}
          </Text>
          <Text style={styles.recipientName}>{client.nom_complet}</Text>
          {client.adresse ? (
            <Text style={styles.recipientAddress}>{client.adresse}</Text>
          ) : null}
        </View>

        {/* Objet */}
        <Text style={styles.objet}>Objet : Confirmation d'ouverture de compte titre</Text>

        {/* Corps */}
        <Text style={styles.bodyText}>{civilite},</Text>
        <Text style={styles.bodyText}>
          {"Nous avons l’honneur de vous confirmer l’ouverture dans nos livres de votre compte titre numéro "}
          <Text style={styles.bodyBold}>{numero_compte}</Text>
          {" en date du "}
          <Text style={styles.bodyBold}>{fmtDate(date_ouverture)}</Text>
          {"."}
        </Text>
        <Text style={styles.bodyText}>
          {`Vous souhaitant bonne réception de la présente, nous vous prions de croire, ${civilite}, en l’assurance de notre considération distinguée.`}
        </Text>

        {/* Signature */}
        <View style={styles.signatureBlock}>
          <Text style={styles.signatureName}>{raisonSociale}</Text>
        </View>

        {/* Pied légal */}
        <View style={styles.footer} fixed>
          {mentions.map((line, idx) => (
            <Text key={`mention-${idx}`} style={styles.footerText}>
              {line}
            </Text>
          ))}
          <Text style={styles.footerMono}>
            {"Hash SHA-256 · "}{hashTronque}{"... · Horodatage RFC 3161 mock Phase 2 · cryptographique Phase 8"}
          </Text>
          <Text
            style={[styles.footerMono, { marginTop: 2 }]}
            render={({ pageNumber, totalPages }) => `${pageNumber}/${totalPages}`}
          />
        </View>

        {/* Code-barres de référence */}
        <View
          style={{ position: "absolute", bottom: 48, right: 40, alignItems: "flex-end" }}
          fixed
        >
          <Barcode value={hash_sha256.slice(0, 8)} height={28} unit={0.6} />
        </View>
      </Page>
    </Document>
  );
}
