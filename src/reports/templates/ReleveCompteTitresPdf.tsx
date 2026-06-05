// Gabarit PDF A4 portrait · Relevé de compte-titres (7 sections 01-07).
// Porté de MIMS lib/integrations/pdf/templates/ReleveCompteTitresPdf.tsx.
//
// Adaptations : retrait de la dépendance sdbInfo/renderMentionsTemplate de MIMS
// (mentions/ville passées en options autonomes). Aucun fontStyle italic
// (contrainte Inter). Aucune police enregistrée ici. Logique sdb_id/RLS retirée.
//
// Référence visuelle · Relevé de compte titres (CCA Bourse) reproduit verbatim :
// en-tête logo, titre centré souligné « RELEVE DE COMPTE TITRES », date d'arrêté,
// tableau positions titres, mouvements, synthèse, pied institutionnel.

import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Image,
} from "@react-pdf/renderer";

// ---------------------------------------------------------------------------
// Tokens DS v2.2 (hex inline · verbatim MIMS)
// ---------------------------------------------------------------------------

const INK = "#11191F";
const GRAY_50 = "#FAFAF9";
const GRAY_200 = "#E5E4DC";
const GRAY_600 = "#6B7280";
const GRAY_700 = "#4A4F4D";
const ACCENT = "#FFED90";
const SUCCESS = "#5C7C5C";
const DANGER = "#A65151";
const INFO = "#3A6B7C";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ReleveCompteTitresPdfProps {
  sdb: { nom: string; code: string };
  client: {
    code: string;
    nom_complet: string;
    type: "PP" | "PM";
    cni_passeport?: string;
    rccm?: string;
    nationalite: string;
    adresse: string;
  };
  periode: { debut: string; fin: string };
  iban_mock: string;
  positions: Array<{
    isin: string;
    libelle: string;
    classe: string;
    quantite: number;
    prix_moyen_pondere: number;
    valorisation_xaf: number;
    devise: string;
  }>;
  mouvements: Array<{
    date: string;
    libelle: string;
    isin: string;
    sens: "ACHAT" | "VENTE" | "OST";
    quantite: number;
    prix: number;
    montant_xaf: number;
  }>;
  synthese: {
    valorisation_debut: number | null;
    valorisation_fin: number;
    gain_perte: number;
    frais_collectes: number;
  };
  hash_sha256: string;
  timestamp_rfc3161_mock: string;
  /** Ville d'arrêté (défaut Douala). */
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

function fmtNombre(n: number): string {
  return n.toLocaleString("fr-FR").replace(/\u202f/g, "\u00a0");
}

// ---------------------------------------------------------------------------
// StyleSheet
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: "Inter",
    fontSize: 9,
    color: INK,
    backgroundColor: "#FFFFFF",
  },

  // Section numero (ex : "01 ·")
  sectionNumero: {
    fontFamily: "JetBrainsMono",
    fontSize: 9,
    color: GRAY_700,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  sectionTitreText: {
    fontFamily: "Inter",
    fontWeight: 600,
    fontSize: 11,
    color: INK,
  },
  sectionTitreRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 6,
    borderBottomWidth: 1,
    borderBottomColor: INK,
    paddingBottom: 4,
    marginBottom: 8,
  },

  // === Section 01 · En-tête ===
  header: {
    marginBottom: 16,
  },
  headerTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
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
  headerRightBlock: {
    alignItems: "flex-end",
  },
  headerCity: {
    fontFamily: "Inter",
    fontSize: 9,
    color: INK,
  },
  headerClientRef: {
    fontFamily: "Inter",
    fontWeight: 600,
    fontSize: 9,
    color: INK,
    marginTop: 3,
  },
  headerClientRefMono: {
    fontFamily: "JetBrainsMono",
    fontSize: 9,
    color: INK,
  },
  headerAdresse: {
    fontFamily: "Inter",
    fontSize: 8,
    color: GRAY_600,
    marginTop: 2,
    textTransform: "uppercase",
  },

  // Titre principal centré (reproduit PDF CCA)
  docTitleContainer: {
    alignItems: "center",
    marginBottom: 8,
  },
  docTitle: {
    fontFamily: "Inter",
    fontWeight: 600,
    fontSize: 14,
    color: INK,
    textTransform: "uppercase",
    textDecoration: "underline",
    letterSpacing: 1.5,
    textAlign: "center",
  },
  dateArrete: {
    fontFamily: "Inter",
    fontWeight: 600,
    fontSize: 10,
    color: INK,
    textAlign: "center",
    marginTop: 4,
  },

  // === Section 02 · Identité titulaire ===
  identiteGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 0,
  },
  identiteRow: {
    flexDirection: "row",
    marginBottom: 4,
    width: "100%",
  },
  identiteKey: {
    fontFamily: "Inter",
    fontSize: 8,
    color: GRAY_600,
    width: 110,
  },
  identiteVal: {
    fontFamily: "Inter",
    fontSize: 8,
    color: INK,
    flex: 1,
  },
  identiteValMono: {
    fontFamily: "JetBrainsMono",
    fontSize: 8,
    color: INK,
    flex: 1,
  },

  // === Section 03 · Période et compte ===
  periodeBlock: {
    backgroundColor: GRAY_50,
    borderWidth: 0.5,
    borderColor: GRAY_200,
    borderRadius: 3,
    padding: 8,
  },
  periodeRow: {
    flexDirection: "row",
    marginBottom: 3,
  },
  periodeKey: {
    fontFamily: "Inter",
    fontSize: 8,
    color: GRAY_600,
    width: 110,
  },
  periodeVal: {
    fontFamily: "JetBrainsMono",
    fontSize: 8,
    color: INK,
    flex: 1,
  },

  // === Section 04 · Positions titres ===
  tableContainer: {
    borderWidth: 0.5,
    borderColor: GRAY_200,
    borderRadius: 2,
    overflow: "hidden",
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: GRAY_50,
    borderBottomWidth: 1,
    borderBottomColor: GRAY_700,
    paddingVertical: 5,
    paddingHorizontal: 4,
  },
  tableHeaderCell: {
    fontFamily: "Inter",
    fontWeight: 600,
    fontSize: 7,
    color: GRAY_700,
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 4,
    paddingHorizontal: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: GRAY_200,
    alignItems: "center",
  },
  tableRowZebra: {
    backgroundColor: GRAY_50,
  },
  tableCell: {
    fontFamily: "Inter",
    fontSize: 8,
    color: INK,
  },
  tableCellMono: {
    fontFamily: "JetBrainsMono",
    fontSize: 8,
    color: INK,
  },

  // Colonnes positions
  posColCompte: { width: 52, fontSize: 7 },
  posColIsin: { width: 80 },
  posColLibelle: { flex: 1 },
  posColSolde: { width: 52, textAlign: "right" },
  posColNominal: { width: 52, textAlign: "right" },
  posColCours: { width: 46, textAlign: "right" },
  posColCC: { width: 50, textAlign: "right" },
  posColValorisation: { width: 72, textAlign: "right" },
  posColDerniere: { width: 50, textAlign: "right", fontSize: 7 },

  // Colonnes mouvements
  mvtColDate: { width: 52 },
  mvtColLibelle: { flex: 1 },
  mvtColIsin: { width: 74 },
  mvtColSens: { width: 34, textAlign: "center" },
  mvtColQte: { width: 46, textAlign: "right" },
  mvtColPrix: { width: 52, textAlign: "right" },
  mvtColMontant: { width: 68, textAlign: "right" },

  // Ligne total
  tableTotal: {
    flexDirection: "row",
    justifyContent: "flex-end",
    paddingVertical: 5,
    paddingHorizontal: 4,
    borderTopWidth: 1,
    borderTopColor: INK,
    backgroundColor: GRAY_50,
  },
  tableTotalLabel: {
    fontFamily: "Inter",
    fontWeight: 600,
    fontSize: 9,
    color: INK,
    flex: 1,
    textAlign: "right",
    paddingRight: 8,
  },
  tableTotalValue: {
    fontFamily: "JetBrainsMono",
    fontWeight: 600,
    fontSize: 9,
    color: INK,
    width: 90,
    textAlign: "right",
  },

  // === Section 06 · Synthèse ===
  syntheseBlock: {
    borderWidth: 0.5,
    borderColor: GRAY_200,
    borderRadius: 3,
    overflow: "hidden",
  },
  syntheseRow: {
    flexDirection: "row",
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: GRAY_200,
  },
  syntheseRowTotal: {
    backgroundColor: GRAY_50,
    borderBottomWidth: 0,
  },
  syntheseKey: {
    fontFamily: "Inter",
    fontSize: 8,
    color: GRAY_600,
    flex: 1,
  },
  syntheseVal: {
    fontFamily: "JetBrainsMono",
    fontWeight: 600,
    fontSize: 9,
    color: INK,
    textAlign: "right",
    width: 120,
  },
  syntheseValPositif: {
    color: SUCCESS,
  },
  syntheseValNegatif: {
    color: DANGER,
  },

  // === Section 07 · Pied légal ===
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

  // Cachet mock
  cachet: {
    position: "absolute",
    bottom: 50,
    right: 40,
    width: 100,
    height: 56,
    borderWidth: 0.5,
    borderColor: GRAY_200,
    borderRadius: 3,
    backgroundColor: GRAY_50,
    padding: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  cachetLabel: {
    fontFamily: "Inter",
    fontWeight: 600,
    fontSize: 6,
    color: GRAY_700,
    textAlign: "center",
    textTransform: "uppercase",
    letterSpacing: 0.3,
    marginTop: 3,
  },
  cachetSub: {
    fontFamily: "JetBrainsMono",
    fontSize: 5,
    color: GRAY_600,
    textAlign: "center",
    marginTop: 2,
  },

  // Séparateur section
  sectionWrapper: {
    marginBottom: 12,
  },

  // Page number (fixed)
  pageNumber: {
    position: "absolute",
    bottom: 8,
    right: 40,
    fontFamily: "JetBrainsMono",
    fontSize: 7,
    color: GRAY_600,
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
// Sous-composant : titre de section numéroté
// ---------------------------------------------------------------------------

function SectionTitre({ numero, titre }: { numero: string; titre: string }) {
  return (
    <View style={styles.sectionTitreRow}>
      <Text style={styles.sectionNumero}>{numero} ·</Text>
      <Text style={styles.sectionTitreText}>{titre}</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Composant principal
// ---------------------------------------------------------------------------

export function ReleveCompteTitresPdf({
  sdb,
  client,
  periode,
  iban_mock,
  positions,
  mouvements,
  synthese,
  hash_sha256,
  timestamp_rfc3161_mock,
  ville,
  mentionsLines,
  logoUrl,
}: ReleveCompteTitresPdfProps) {
  const hashTronque = hash_sha256.slice(0, 8);
  const totalValorisation = positions.reduce((s, p) => s + p.valorisation_xaf, 0);
  const totalPortefeuille = totalValorisation;

  // Colonne N° compte · utilise le code client comme numéro de compte
  const numCompte = `TI${client.code.replace("CT-", "").replace(/-/g, "")}`;

  const villeArrete = ville ?? "Douala";

  const raisonSociale = `MIMS · ${sdb.nom}`;

  const mentions =
    mentionsLines && mentionsLines.length > 0 ? mentionsLines : DEFAULT_MENTIONS;

  return (
    <Document
      title={`Relevé de compte-titres - ${client.code} - ${fmtDate(periode.fin)}`}
      author="Reporting Manar · MAEBA Consulting"
      subject="Relevé de compte-titres COSUMAF"
      creator="Reporting Manar"
    >
      <Page size="A4" style={styles.page} wrap>

        {/* ================================================================
            Section 01 · En-tête institutionnelle
        ================================================================ */}
        <View style={styles.header}>
          {/* Logo + identification SDB à gauche · coordonnées client à droite */}
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

            <View style={styles.headerRightBlock}>
              <Text style={styles.headerCity}>
                {villeArrete}, le {fmtDate(periode.fin)}
              </Text>
              <Text style={styles.headerClientRef}>{client.nom_complet}</Text>
              <Text style={{ fontFamily: "Inter", fontSize: 8, color: GRAY_600, marginTop: 1 }}>
                {"Numéro Portefeuille : "}<Text style={styles.headerClientRefMono}>{numCompte}</Text>
              </Text>
              <Text style={styles.headerAdresse}>{client.adresse}</Text>
            </View>
          </View>

          {/* Titre centré souligné (reproduit PDF CCA Bourse) */}
          <View style={styles.docTitleContainer}>
            <Text style={styles.docTitle}>Relevé de compte titres</Text>
            <Text style={styles.dateArrete}>
              Date d'arrêté : {fmtDate(periode.fin)}
            </Text>
          </View>
        </View>

        {/* ================================================================
            Section 02 · Identité titulaire
        ================================================================ */}
        <View style={styles.sectionWrapper}>
          <SectionTitre numero="02" titre="Identité du titulaire" />
          <View style={styles.identiteGrid}>
            <View style={styles.identiteRow}>
              <Text style={styles.identiteKey}>Code client ·</Text>
              <Text style={styles.identiteValMono}>{client.code}</Text>
            </View>
            <View style={styles.identiteRow}>
              <Text style={styles.identiteKey}>Nom complet ·</Text>
              <Text style={styles.identiteVal}>{client.nom_complet}</Text>
            </View>
            <View style={styles.identiteRow}>
              <Text style={styles.identiteKey}>
                {client.type === "PM" ? "RCCM ·" : "CNI / Passeport ·"}
              </Text>
              <Text style={styles.identiteValMono}>
                {client.type === "PM" ? (client.rccm ?? "-") : (client.cni_passeport ?? "-")}
              </Text>
            </View>
            <View style={styles.identiteRow}>
              <Text style={styles.identiteKey}>Nationalité ·</Text>
              <Text style={styles.identiteVal}>{client.nationalite}</Text>
            </View>
            <View style={styles.identiteRow}>
              <Text style={styles.identiteKey}>Adresse fiscale ·</Text>
              <Text style={styles.identiteVal}>{client.adresse}</Text>
            </View>
          </View>
        </View>

        {/* ================================================================
            Section 03 · Période et compte
        ================================================================ */}
        <View style={styles.sectionWrapper}>
          <SectionTitre numero="03" titre="Période et compte" />
          <View style={styles.periodeBlock}>
            <View style={styles.periodeRow}>
              <Text style={styles.periodeKey}>Compte titres ·</Text>
              <Text style={styles.periodeVal}>{numCompte}</Text>
            </View>
            <View style={styles.periodeRow}>
              <Text style={styles.periodeKey}>IBAN (mock Phase 2) ·</Text>
              <Text style={styles.periodeVal}>{iban_mock}</Text>
            </View>
            <View style={styles.periodeRow}>
              <Text style={styles.periodeKey}>Période du relevé ·</Text>
              <Text style={styles.periodeVal}>
                {fmtDate(periode.debut)} au {fmtDate(periode.fin)}
              </Text>
            </View>
          </View>
        </View>

        {/* ================================================================
            Section 04 · Positions titres au {date fin}
            Reproduit tableau PDF CCA : N° compte, Code ISIN, Désignation valeur,
            Solde, Nominal, Cours, CC, Valorisation XA, Dernière M
        ================================================================ */}
        <View style={styles.sectionWrapper}>
          <SectionTitre numero="04" titre={`Positions titres au ${fmtDate(periode.fin)}`} />

          <View style={styles.tableContainer}>
            {/* En-tête */}
            <View style={styles.tableHeader}>
              <Text style={[styles.tableHeaderCell, styles.posColCompte]}>N° compte</Text>
              <Text style={[styles.tableHeaderCell, styles.posColIsin]}>Code ISIN</Text>
              <Text style={[styles.tableHeaderCell, styles.posColLibelle]}>Désignation valeur</Text>
              <Text style={[styles.tableHeaderCell, styles.posColSolde, { textAlign: "right" }]}>Solde</Text>
              <Text style={[styles.tableHeaderCell, styles.posColNominal, { textAlign: "right" }]}>Nominal</Text>
              <Text style={[styles.tableHeaderCell, styles.posColCours, { textAlign: "right" }]}>Cours</Text>
              <Text style={[styles.tableHeaderCell, styles.posColCC, { textAlign: "right" }]}>CC</Text>
              <Text style={[styles.tableHeaderCell, styles.posColValorisation, { textAlign: "right" }]}>Valorisation XAF</Text>
              <Text style={[styles.tableHeaderCell, styles.posColDerniere, { textAlign: "right" }]}>Dernière M.</Text>
            </View>

            {/* Lignes positions */}
            {positions.length === 0 ? (
              <View style={{ padding: 12, alignItems: "center" }}>
                <Text style={{ fontFamily: "Inter", fontSize: 8, color: GRAY_600 }}>
                  Aucune position titres sur la période.
                </Text>
              </View>
            ) : (
              positions.map((pos, idx) => (
                <View
                  key={`${pos.isin}-${idx}`}
                  style={[styles.tableRow, idx % 2 === 1 ? styles.tableRowZebra : {}]}
                  wrap={false}
                >
                  <Text style={[styles.tableCellMono, styles.posColCompte, { fontSize: 7 }]}>
                    {numCompte}
                  </Text>
                  <Text style={[styles.tableCellMono, styles.posColIsin, { fontSize: 7 }]}>
                    {pos.isin}
                  </Text>
                  <Text style={[styles.tableCell, styles.posColLibelle, { fontSize: 7 }]}>
                    {pos.libelle}
                  </Text>
                  <Text style={[styles.tableCellMono, styles.posColSolde, { textAlign: "right" }]}>
                    {fmtNombre(pos.quantite)}
                  </Text>
                  <Text style={[styles.tableCellMono, styles.posColNominal, { textAlign: "right" }]}>
                    -
                  </Text>
                  <Text style={[styles.tableCellMono, styles.posColCours, { textAlign: "right" }]}>
                    {pos.prix_moyen_pondere.toLocaleString("fr-FR", { minimumFractionDigits: 3, maximumFractionDigits: 3 })}
                  </Text>
                  <Text style={[styles.tableCellMono, styles.posColCC, { textAlign: "right" }]}>
                    -
                  </Text>
                  <Text style={[styles.tableCellMono, styles.posColValorisation, { textAlign: "right" }]}>
                    {fmtNombre(pos.valorisation_xaf)}
                  </Text>
                  <Text style={[styles.tableCellMono, styles.posColDerniere, { textAlign: "right", fontSize: 6 }]}>
                    {fmtDate(periode.fin)}
                  </Text>
                </View>
              ))
            )}

            {/* Total valorisation (reproduit PDF CCA) */}
            <View style={styles.tableTotal}>
              <Text style={styles.tableTotalLabel}>
                Valeur totale des positions titres XAF
              </Text>
              <Text style={styles.tableTotalValue}>
                {fmtNombre(totalValorisation)}
              </Text>
            </View>
          </View>
        </View>

        {/* ================================================================
            Section 05 · Mouvements de la période
        ================================================================ */}
        <View style={styles.sectionWrapper}>
          <SectionTitre numero="05" titre="Mouvements de la période" />

          <View style={styles.tableContainer}>
            {/* En-tête */}
            <View style={styles.tableHeader}>
              <Text style={[styles.tableHeaderCell, styles.mvtColDate]}>Date</Text>
              <Text style={[styles.tableHeaderCell, styles.mvtColLibelle]}>Libellé opération</Text>
              <Text style={[styles.tableHeaderCell, styles.mvtColIsin]}>Code ISIN</Text>
              <Text style={[styles.tableHeaderCell, styles.mvtColSens, { textAlign: "center" }]}>Sens</Text>
              <Text style={[styles.tableHeaderCell, styles.mvtColQte, { textAlign: "right" }]}>Qté</Text>
              <Text style={[styles.tableHeaderCell, styles.mvtColPrix, { textAlign: "right" }]}>Prix</Text>
              <Text style={[styles.tableHeaderCell, styles.mvtColMontant, { textAlign: "right" }]}>Montant XAF</Text>
            </View>

            {/* Lignes mouvements */}
            {mouvements.length === 0 ? (
              <View style={{ padding: 12, alignItems: "center" }}>
                <Text style={{ fontFamily: "Inter", fontSize: 8, color: GRAY_600 }}>
                  Aucun mouvement sur la période.
                </Text>
              </View>
            ) : (
              mouvements.map((mvt, idx) => {
                const sensColor = mvt.sens === "ACHAT"
                  ? SUCCESS
                  : mvt.sens === "VENTE" ? DANGER : GRAY_600;
                return (
                  <View
                    key={`mvt-${idx}`}
                    style={[styles.tableRow, idx % 2 === 1 ? styles.tableRowZebra : {}]}
                    wrap={false}
                  >
                    <Text style={[styles.tableCellMono, styles.mvtColDate, { fontSize: 7 }]}>
                      {fmtDate(mvt.date)}
                    </Text>
                    <Text style={[styles.tableCell, styles.mvtColLibelle, { fontSize: 7 }]}>
                      {mvt.libelle}
                    </Text>
                    <Text style={[styles.tableCellMono, styles.mvtColIsin, { fontSize: 7 }]}>
                      {mvt.isin}
                    </Text>
                    <Text style={[styles.tableCellMono, styles.mvtColSens, { textAlign: "center", color: sensColor, fontWeight: 600, fontSize: 7 }]}>
                      {mvt.sens}
                    </Text>
                    <Text style={[styles.tableCellMono, styles.mvtColQte, { textAlign: "right" }]}>
                      {fmtNombre(mvt.quantite)}
                    </Text>
                    <Text style={[styles.tableCellMono, styles.mvtColPrix, { textAlign: "right" }]}>
                      {mvt.prix.toLocaleString("fr-FR", { minimumFractionDigits: 3, maximumFractionDigits: 3 })}
                    </Text>
                    <Text style={[styles.tableCellMono, styles.mvtColMontant, { textAlign: "right" }]}>
                      {fmtNombre(mvt.montant_xaf)}
                    </Text>
                  </View>
                );
              })
            )}
          </View>
        </View>

        {/* ================================================================
            Section 06 · Synthèse
        ================================================================ */}
        <View style={styles.sectionWrapper}>
          <SectionTitre numero="06" titre="Synthèse de la période" />

          <View style={styles.syntheseBlock}>
            <View style={styles.syntheseRow}>
              <Text style={styles.syntheseKey}>Valorisation début de période</Text>
              <Text style={styles.syntheseVal}>
                {synthese.valorisation_debut === null
                  ? "-"
                  : `${fmtNombre(synthese.valorisation_debut)} XAF`}
              </Text>
            </View>
            <View style={styles.syntheseRow}>
              <Text style={styles.syntheseKey}>Valorisation fin de période</Text>
              <Text style={styles.syntheseVal}>
                {fmtNombre(synthese.valorisation_fin)} XAF
              </Text>
            </View>
            <View style={styles.syntheseRow}>
              <Text style={styles.syntheseKey}>
                {synthese.gain_perte >= 0 ? "Plus-value sur la période" : "Moins-value sur la période"}
              </Text>
              <Text style={[
                styles.syntheseVal,
                synthese.gain_perte >= 0 ? styles.syntheseValPositif : styles.syntheseValNegatif,
              ]}>
                {synthese.gain_perte >= 0 ? "+" : ""}{fmtNombre(synthese.gain_perte)} XAF
              </Text>
            </View>
            <View style={styles.syntheseRow}>
              <Text style={styles.syntheseKey}>Frais collectés</Text>
              <Text style={styles.syntheseVal}>
                {fmtNombre(synthese.frais_collectes)} XAF
              </Text>
            </View>
            <View style={[styles.syntheseRow, styles.syntheseRowTotal]}>
              <Text style={[styles.syntheseKey, { fontWeight: 600, fontSize: 10, color: INK }]}>
                Valeur totale du portefeuille
              </Text>
              <Text style={[styles.syntheseVal, { fontSize: 11 }]}>
                {fmtNombre(totalPortefeuille)} XAF
              </Text>
            </View>
          </View>
        </View>

        {/* ================================================================
            Section 07 · Pied légal et cachet
        ================================================================ */}
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

        {/* Cachet électronique mock */}
        <View style={styles.cachet} fixed>
          <Text style={{ fontFamily: "JetBrainsMono", fontSize: 10, color: INFO }}>
            [V]
          </Text>
          <Text style={styles.cachetLabel}>Cachet électronique</Text>
          <Text style={styles.cachetLabel}>Reporting Manar</Text>
          <Text style={styles.cachetSub}>
            {timestamp_rfc3161_mock.slice(0, 10)}
          </Text>
        </View>

      </Page>
    </Document>
  );
}
