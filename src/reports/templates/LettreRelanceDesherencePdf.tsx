// -*- coding: utf-8 -*-
// Gabarit PDF A4 portrait · courrier de relance déshérence (RG-267 · CEMAC 02/25).
// Porté de MIMS lib/integrations/pdf/templates/LettreRelanceDesherencePdf.tsx.
//
// Adaptations : retrait de l'import MIMS '@/lib/db/types-phase-5-8'
// (renderMentionsTemplate/ParametresSdbRow) au profit de props autonomes
// (mentionsLines, ville) avec replis institutionnels. Aucun fontStyle italic.

import { Document, Page, Text, View, StyleSheet, Image } from "@react-pdf/renderer";

const INK = "#11191F";
const GRAY_50 = "#FAFAF9";
const GRAY_200 = "#E5E4DC";
const GRAY_600 = "#6B7280";
const GRAY_700 = "#4A4F4D";
const ACCENT = "#FFED90";
const INFO = "#3A6B7C";

export interface LettreRelanceDesherencePdfProps {
  sdb: { nom: string; code: string };
  client: { nom_complet: string; adresse: string; type: "PP" | "PM" };
  numero_compte: string;
  /** Dernière manifestation connue (ISO) ou null. */
  derniere_manifestation: string | null;
  /** Seuil de déshérence en années (transfert CDEC/BEAC). */
  seuil_desherence_ans: number;
  destinataire_transfert: "CDEC" | "BEAC";
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

function fmtDate(iso: string | null): string {
  if (!iso) return "-";
  try {
    return new Date(iso).toLocaleDateString("fr-FR");
  } catch {
    return iso;
  }
}

const styles = StyleSheet.create({
  page: { padding: 48, fontFamily: "Inter", fontSize: 10, color: INK, backgroundColor: "#FFFFFF", lineHeight: 1.5 },
  headerTopRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28 },
  logoBlock: { flexDirection: "row", alignItems: "center", gap: 8 },
  logoCard: { width: 40, height: 40, backgroundColor: ACCENT, borderRadius: 4, justifyContent: "center", alignItems: "center" },
  logoLetter: { fontFamily: "Inter", fontWeight: 600, fontSize: 20, color: INK },
  logoLabel: { fontFamily: "Inter", fontWeight: 600, fontSize: 12, color: INK },
  logoSubLabel: { fontFamily: "Inter", fontSize: 8, color: GRAY_600, marginTop: 2 },
  recipientBox: {
    alignSelf: "flex-end", width: 240, borderWidth: 0.5, borderColor: GRAY_200, borderRadius: 3,
    backgroundColor: GRAY_50, padding: 10, marginBottom: 24,
  },
  recipientDate: { fontFamily: "Inter", fontSize: 9, color: INK, marginBottom: 6 },
  recipientName: { fontFamily: "Inter", fontWeight: 600, fontSize: 10, color: INK },
  recipientAddress: { fontFamily: "Inter", fontSize: 9, color: GRAY_700, marginTop: 2 },
  objet: { fontFamily: "Inter", fontWeight: 600, fontSize: 10, color: INK, marginBottom: 18 },
  body: { fontFamily: "Inter", fontSize: 10, color: INK, marginBottom: 12 },
  bold: { fontFamily: "Inter", fontWeight: 600 },
  signatureBlock: { alignItems: "flex-end", marginTop: 24 },
  signatureName: { fontFamily: "Inter", fontWeight: 600, fontSize: 10, color: INK },
  footer: { position: "absolute", bottom: 20, left: 48, right: 48, borderTopWidth: 0.5, borderTopColor: GRAY_200, paddingTop: 6 },
  footerText: { fontFamily: "Inter", fontSize: 6, color: GRAY_600, textAlign: "center", marginBottom: 2 },
  footerMono: { fontFamily: "JetBrainsMono", fontSize: 6, color: GRAY_600, textAlign: "center" },
  cachet: {
    position: "absolute", bottom: 54, right: 48, width: 100, height: 56, borderWidth: 0.5, borderColor: GRAY_200,
    borderRadius: 3, backgroundColor: GRAY_50, padding: 6, alignItems: "center", justifyContent: "center",
  },
  cachetLabel: { fontFamily: "Inter", fontWeight: 600, fontSize: 6, color: GRAY_700, textAlign: "center", textTransform: "uppercase", letterSpacing: 0.3, marginTop: 3 },
  cachetSub: { fontFamily: "JetBrainsMono", fontSize: 5, color: GRAY_600, textAlign: "center", marginTop: 2 },
});

const DEST_LABEL: Record<string, string> = {
  CDEC: "la Caisse des Dépôts et Consignations",
  BEAC: "la direction nationale de la BEAC",
};

const DEFAULT_MENTIONS = [
  "Solution MIMS · MAEBA Consulting · Conforme Règlement CEMAC N°02/25 · RG-267",
];

export function LettreRelanceDesherencePdf({
  sdb,
  client,
  numero_compte,
  derniere_manifestation,
  seuil_desherence_ans,
  destinataire_transfert,
  date_emission,
  hash_sha256,
  timestamp_rfc3161_mock,
  ville,
  mentionsLines,
  logoUrl,
}: LettreRelanceDesherencePdfProps) {
  const hashTronque = hash_sha256.slice(0, 8);
  const villeEmission = ville ?? "Douala";
  const raisonSociale = sdb.nom;
  const civilite = "Madame, Monsieur";
  const mentions = mentionsLines && mentionsLines.length > 0 ? mentionsLines : DEFAULT_MENTIONS;

  return (
    <Document title={`Relance déshérence - ${numero_compte}`} author="Reporting Manar · MAEBA Consulting" subject="Relance déshérence RG-267" creator="Reporting Manar">
      <Page size="A4" style={styles.page} wrap>
        <View style={styles.headerTopRow}>
          <View style={styles.logoBlock}>
            {logoUrl ? (
              // eslint-disable-next-line jsx-a11y/alt-text
              <Image src={logoUrl} style={{ maxWidth: 80, maxHeight: 40, objectFit: "contain" }} />
            ) : (
              <View style={styles.logoCard}><Text style={styles.logoLetter}>M</Text></View>
            )}
            <View>
              <Text style={styles.logoLabel}>{raisonSociale}</Text>
              <Text style={styles.logoSubLabel}>{sdb.code}</Text>
            </View>
          </View>
        </View>

        <View style={styles.recipientBox}>
          <Text style={styles.recipientDate}>{villeEmission}, le {fmtDate(date_emission)}</Text>
          <Text style={styles.recipientName}>{client.nom_complet}</Text>
          {client.adresse ? <Text style={styles.recipientAddress}>{client.adresse}</Text> : null}
        </View>

        <Text style={styles.objet}>Objet : Compte titre inactif · invitation à se manifester</Text>

        <Text style={styles.body}>{civilite},</Text>
        <Text style={styles.body}>
          {"Nos services constatent qu’aucune opération ni manifestation de votre part n’a été enregistrée sur votre compte titre numéro "}
          <Text style={styles.bold}>{numero_compte}</Text>
          {derniere_manifestation ? (
            <Text>{" depuis le "}<Text style={styles.bold}>{fmtDate(derniere_manifestation)}</Text></Text>
          ) : null}
          {"."}
        </Text>
        <Text style={styles.body}>
          {`Conformément au Règlement CEMAC N°02/25 relatif au traitement des comptes inactifs et des avoirs en déshérence, nous vous invitons à vous rapprocher de nos services afin de régulariser la situation de votre compte. À défaut de manifestation de votre part au terme d’une période de `}
          <Text style={styles.bold}>{seuil_desherence_ans} ans</Text>
          {` d’inactivité, vos avoirs seront transférés à ${DEST_LABEL[destinataire_transfert] ?? destinataire_transfert} conformément à la réglementation en vigueur.`}
        </Text>
        <Text style={styles.body}>
          {`Nous vous prions de croire, ${civilite}, en l’assurance de notre considération distinguée.`}
        </Text>

        <View style={styles.signatureBlock}>
          <Text style={styles.signatureName}>{raisonSociale}</Text>
        </View>

        <View style={styles.footer} fixed>
          {mentions.map((line, idx) => (<Text key={`m-${idx}`} style={styles.footerText}>{line}</Text>))}
          <Text style={styles.footerMono}>{"Hash SHA-256 · "}{hashTronque}{"... · Horodatage RFC 3161 mock"}</Text>
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
