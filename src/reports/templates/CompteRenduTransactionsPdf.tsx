// -*- coding: utf-8 -*-
// Gabarit PDF A4 portrait · Compte rendu des transactions réalisées (par ordre).
// Porté de MIMS lib/integrations/pdf/templates/CompteRenduTransactionsPdf.tsx.
//
// Adaptations : props autonomes (aucune dépendance @/lib/... ni sdb_id/RLS).
// StyleSheet et JSX verbatim, hex conservés. Aucun fontStyle italic (Inter).
// Polices non enregistrées ici (Inter, JetBrainsMono fournies par l'app/les tests).

import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer";

// ---------------------------------------------------------------------------
// Tokens DS v2.2 (hex inline)
// ---------------------------------------------------------------------------

const INK = '#11191F'
const GRAY_50 = '#FAFAF9'
const GRAY_200 = '#E5E4DC'
const GRAY_600 = '#6B7280'
const GRAY_700 = '#4A4F4D'
const ACCENT = '#FFED90'
const SUCCESS = '#5C7C5C'
const SUCCESS_SOFT = '#E3EBE2'
const DANGER = '#A65151'
const DANGER_SOFT = '#EFD6D2'
const WARNING = '#C8941E'
const WARNING_SOFT = '#F2E4C8'
const INFO = '#3A6B7C'
const INFO_SOFT = '#DCE6EA'

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface CompteRenduTransactionsPdfProps {
  sdb: { nom: string; code: string; rccm: string; agrement: string }
  ordre: {
    code_ordre: string
    statut: string
    sens: string
    type: string
    quantite: number
    prix_limite: number | null
    brut: number
    courus: number
    frais: number
    net: number
    created_at: string
  }
  client: {
    code: string
    nom: string
    classification_risque: string
    date_validite_kyc: string
  }
  instrument: { libelle: string; isin: string }
  workflow: Array<{
    etape: string
    acteur_nom: string
    created_at: string
    commentaire: string | null
  }>
  signatures: {
    front: { nom: string; date: string; audit_id: string }
    middle: { nom: string; date: string; audit_id: string } | null
  }
  hash_sha256: string
  timestamp_rfc3161_mock: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('fr-FR')
  } catch {
    return iso
  }
}

function fmtDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('fr-FR').replace(/\u202f/g, "\u00a0")
  } catch {
    return iso
  }
}

function fmtMontant(n: number): string {
  return n.toLocaleString('fr-FR').replace(/\u202f/g, "\u00a0") + ' XAF'
}

function statutColor(statut: string): { bg: string; text: string } {
  switch (statut) {
    case 'EXECUTE': return { bg: SUCCESS_SOFT, text: SUCCESS }
    case 'VALIDE_MIDDLE': return { bg: SUCCESS_SOFT, text: SUCCESS }
    case 'EN_MARCHE': return { bg: INFO_SOFT, text: INFO }
    case 'SAISI': return { bg: INFO_SOFT, text: INFO }
    case 'CONTROLE_MIDDLE': return { bg: ACCENT, text: INK }
    case 'REJETE_MIDDLE': return { bg: DANGER_SOFT, text: DANGER }
    case 'ANNULE': return { bg: GRAY_200, text: GRAY_600 }
    case 'PARTIELLEMENT_EXECUTE': return { bg: WARNING_SOFT, text: WARNING }
    default: return { bg: GRAY_50, text: GRAY_700 }
  }
}

// Libellés lisibles pour étapes workflow
function etapeLabel(etape: string): string {
  const map: Record<string, string> = {
    SAISIE: 'Saisie',
    CONTROLE_AUTO: 'Contrôle auto',
    ROUTAGE_MIDDLE: 'Routage Middle',
    VALIDATION_MIDDLE: 'Validation Middle',
    EXECUTION: 'Exécution',
    CONFIRMATION: 'Confirmation',
    REJET: 'Rejet',
    ANNULATION: 'Annulation',
  }
  return map[etape] ?? etape
}

// ---------------------------------------------------------------------------
// StyleSheet
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: 'Inter',
    fontSize: 9,
    color: INK,
    backgroundColor: '#FFFFFF',
  },

  // En-tête
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderBottomWidth: 1.5,
    borderBottomColor: INK,
    paddingBottom: 10,
    marginBottom: 12,
  },
  logoBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logoCard: {
    width: 40,
    height: 40,
    backgroundColor: ACCENT,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoLetter: {
    fontFamily: 'Inter',
    fontWeight: 600,
    fontSize: 20,
    color: INK,
  },
  logoLabel: {
    fontFamily: 'Inter',
    fontWeight: 600,
    fontSize: 12,
    color: INK,
  },
  logoSubLabel: {
    fontFamily: 'Inter',
    fontSize: 8,
    color: GRAY_600,
    marginTop: 2,
  },
  headerRight: {
    alignItems: 'flex-end',
  },
  headerDate: {
    fontFamily: 'JetBrainsMono',
    fontSize: 8,
    color: GRAY_600,
  },
  headerPage: {
    fontFamily: 'JetBrainsMono',
    fontSize: 8,
    color: GRAY_700,
    marginTop: 2,
  },

  // Titre document
  docTitle: {
    fontFamily: 'Inter',
    fontWeight: 600,
    fontSize: 14,
    color: INK,
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 6,
  },

  // Référence ordre (Section 2)
  refOrdreBlock: {
    backgroundColor: GRAY_50,
    borderWidth: 0.5,
    borderColor: GRAY_200,
    borderRadius: 3,
    padding: 10,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  refOrdreCode: {
    fontFamily: 'JetBrainsMono',
    fontSize: 14,
    fontWeight: 600,
    color: INK,
  },

  // Chip
  chip: {
    borderRadius: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  chipText: {
    fontFamily: 'Inter',
    fontWeight: 600,
    fontSize: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },

  // Section générique
  section: {
    marginBottom: 10,
  },
  sectionTitle: {
    fontFamily: 'Inter',
    fontWeight: 600,
    fontSize: 10,
    color: INK,
    borderBottomWidth: 0.5,
    borderBottomColor: GRAY_200,
    paddingBottom: 4,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Identité parties (Section 3) · 2 colonnes
  identiteRow: {
    flexDirection: 'row',
    gap: 12,
  },
  identiteCol: {
    flex: 1,
    backgroundColor: GRAY_50,
    borderWidth: 0.5,
    borderColor: GRAY_200,
    borderRadius: 3,
    padding: 8,
  },
  identiteColTitle: {
    fontFamily: 'Inter',
    fontWeight: 600,
    fontSize: 8,
    color: GRAY_700,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginBottom: 4,
  },
  identiteRow2: {
    flexDirection: 'row',
    marginBottom: 3,
  },
  identiteKey: {
    fontFamily: 'Inter',
    fontSize: 8,
    color: GRAY_600,
    width: 80,
  },
  identiteVal: {
    fontFamily: 'Inter',
    fontSize: 8,
    color: INK,
    flex: 1,
  },
  identiteValMono: {
    fontFamily: 'JetBrainsMono',
    fontSize: 8,
    color: INK,
    flex: 1,
  },

  // Caractéristiques ordre (Section 4) · table 2 col
  caracTable: {
    borderWidth: 0.5,
    borderColor: GRAY_200,
    borderRadius: 3,
    overflow: 'hidden',
  },
  caracRow: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderBottomColor: GRAY_200,
  },
  caracRowLast: {
    borderBottomWidth: 0,
  },
  caracKey: {
    fontFamily: 'Inter',
    fontSize: 8,
    color: GRAY_600,
    width: 120,
    paddingHorizontal: 8,
    paddingVertical: 5,
    backgroundColor: GRAY_50,
    borderRightWidth: 0.5,
    borderRightColor: GRAY_200,
  },
  caracVal: {
    fontFamily: 'JetBrainsMono',
    fontSize: 8,
    color: INK,
    flex: 1,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  caracValNormal: {
    fontFamily: 'Inter',
    fontSize: 8,
    color: INK,
    flex: 1,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },

  // Timeline cycle de vie (Section 5) · horizontale simplifiée
  timelineContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 4,
  },
  timelineStep: {
    flex: 1,
    alignItems: 'center',
  },
  timelineDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: SUCCESS,
    marginBottom: 4,
  },
  timelineDotPending: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: GRAY_200,
    borderWidth: 1,
    borderColor: GRAY_600,
    marginBottom: 4,
  },
  timelineDotActive: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: ACCENT,
    borderWidth: 1,
    borderColor: INK,
    marginBottom: 4,
  },
  timelineConnector: {
    position: 'absolute',
    top: 7,
    left: '50%',
    right: '-50%',
    height: 2,
    backgroundColor: GRAY_200,
  },
  timelineConnectorDone: {
    backgroundColor: SUCCESS,
  },
  timelineLabel: {
    fontFamily: 'Inter',
    fontSize: 7,
    color: GRAY_700,
    textAlign: 'center',
  },
  timelineDate: {
    fontFamily: 'JetBrainsMono',
    fontSize: 6,
    color: GRAY_600,
    textAlign: 'center',
    marginTop: 2,
  },
  timelineActeur: {
    fontFamily: 'Inter',
    fontSize: 6,
    color: GRAY_600,
    textAlign: 'center',
    marginTop: 1,
  },

  // Signatures (Section 6)
  signaturesRow: {
    flexDirection: 'row',
    gap: 12,
  },
  signatureBox: {
    flex: 1,
    borderWidth: 1,
    borderColor: GRAY_200,
    borderRadius: 3,
    padding: 10,
    minHeight: 70,
  },
  signatureTitle: {
    fontFamily: 'Inter',
    fontWeight: 600,
    fontSize: 8,
    color: GRAY_700,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginBottom: 4,
  },
  signatureNom: {
    fontFamily: 'Inter',
    fontWeight: 600,
    fontSize: 10,
    color: INK,
    marginBottom: 3,
  },
  signatureDate: {
    fontFamily: 'JetBrainsMono',
    fontSize: 8,
    color: GRAY_600,
    marginBottom: 2,
  },
  signatureAudit: {
    fontFamily: 'JetBrainsMono',
    fontSize: 7,
    color: GRAY_600,
  },
  signatureAbsent: {
    fontFamily: 'Inter',
    fontSize: 8,
    color: GRAY_600,
  },

  // Pied légal
  footer: {
    position: 'absolute',
    bottom: 20,
    left: 40,
    right: 40,
    borderTopWidth: 0.5,
    borderTopColor: GRAY_200,
    paddingTop: 6,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  footerLeft: {
    fontFamily: 'Inter',
    fontSize: 6,
    color: GRAY_600,
    flex: 1,
  },
  footerCenter: {
    fontFamily: 'JetBrainsMono',
    fontSize: 6,
    color: GRAY_600,
    textAlign: 'center',
    flex: 1,
  },
  footerRight: {
    fontFamily: 'Inter',
    fontSize: 6,
    color: GRAY_600,
    textAlign: 'right',
    flex: 1,
  },

  // Cachet mock
  cachet: {
    position: 'absolute',
    bottom: 50,
    right: 40,
    width: 100,
    height: 56,
    borderWidth: 0.5,
    borderColor: GRAY_200,
    borderRadius: 3,
    backgroundColor: GRAY_50,
    padding: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cachetLabel: {
    fontFamily: 'Inter',
    fontWeight: 600,
    fontSize: 6,
    color: GRAY_700,
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginTop: 3,
  },
  cachetSub: {
    fontFamily: 'JetBrainsMono',
    fontSize: 5,
    color: GRAY_600,
    textAlign: 'center',
    marginTop: 2,
  },
})

// ---------------------------------------------------------------------------
// Composant principal
// ---------------------------------------------------------------------------

export function CompteRenduTransactionsPdf({
  sdb,
  ordre,
  client,
  instrument,
  workflow,
  signatures,
  hash_sha256,
  timestamp_rfc3161_mock,
}: CompteRenduTransactionsPdfProps) {
  const hashTronque = hash_sha256.slice(0, 8)
  const statutChip = statutColor(ordre.statut)

  return (
    <Document
      title={`Compte rendu - ${ordre.code_ordre}`}
      author="Reporting Manar · MAEBA Consulting"
      subject="Compte rendu des transactions réalisées"
      creator="Reporting Manar"
    >
      <Page size="A4" style={styles.page} wrap>

        {/* Section 1 · En-tête institutionnelle */}
        <View style={styles.header}>
          <View style={styles.logoBlock}>
            <View style={styles.logoCard}>
              <Text style={styles.logoLetter}>M</Text>
            </View>
            <View>
              <Text style={styles.logoLabel}>{sdb.nom}</Text>
              <Text style={styles.logoSubLabel}>{sdb.code} · Agrément {sdb.agrement}</Text>
            </View>
          </View>

          <View style={styles.headerRight}>
            <Text style={styles.headerDate}>
              {fmtDateTime(ordre.created_at)}
            </Text>
            <Text
              style={styles.headerPage}
              render={({ pageNumber, totalPages }) =>
                `Page ${pageNumber} / ${totalPages}`
              }
            />
          </View>
        </View>

        {/* Titre document */}
        <Text style={styles.docTitle}>Compte rendu des transactions réalisées</Text>

        {/* Section 2 · Référence ordre */}
        <View style={styles.refOrdreBlock}>
          <View>
            <Text style={{ fontFamily: 'Inter', fontSize: 8, color: GRAY_600, marginBottom: 2 }}>
              Code ordre
            </Text>
            <Text style={styles.refOrdreCode}>{ordre.code_ordre}</Text>
          </View>
          <View style={[styles.chip, { backgroundColor: statutChip.bg }]}>
            <Text style={[styles.chipText, { color: statutChip.text }]}>
              {ordre.statut.replace(/_/g, ' ')}
            </Text>
          </View>
        </View>

        {/* Section 3 · Identité des parties */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Identité des parties</Text>
          <View style={styles.identiteRow}>
            {/* Bloc client */}
            <View style={styles.identiteCol}>
              <Text style={styles.identiteColTitle}>Donneur d'ordres · Client</Text>
              <View style={styles.identiteRow2}>
                <Text style={styles.identiteKey}>Code ·</Text>
                <Text style={styles.identiteValMono}>{client.code}</Text>
              </View>
              <View style={styles.identiteRow2}>
                <Text style={styles.identiteKey}>Nom ·</Text>
                <Text style={styles.identiteVal}>{client.nom}</Text>
              </View>
              <View style={styles.identiteRow2}>
                <Text style={styles.identiteKey}>Classification ·</Text>
                <Text style={styles.identiteVal}>{client.classification_risque}</Text>
              </View>
              <View style={styles.identiteRow2}>
                <Text style={styles.identiteKey}>KYC valide au ·</Text>
                <Text style={styles.identiteValMono}>{fmtDate(client.date_validite_kyc)}</Text>
              </View>
            </View>

            {/* Bloc SDB */}
            <View style={styles.identiteCol}>
              <Text style={styles.identiteColTitle}>Intermédiaire · SDB</Text>
              <View style={styles.identiteRow2}>
                <Text style={styles.identiteKey}>Code ·</Text>
                <Text style={styles.identiteValMono}>{sdb.code}</Text>
              </View>
              <View style={styles.identiteRow2}>
                <Text style={styles.identiteKey}>Raison sociale ·</Text>
                <Text style={styles.identiteVal}>{sdb.nom}</Text>
              </View>
              <View style={styles.identiteRow2}>
                <Text style={styles.identiteKey}>RCCM ·</Text>
                <Text style={styles.identiteValMono}>{sdb.rccm}</Text>
              </View>
              <View style={styles.identiteRow2}>
                <Text style={styles.identiteKey}>Agrément COSUMAF ·</Text>
                <Text style={styles.identiteValMono}>{sdb.agrement}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Section 4 · Caractéristiques de l'ordre */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Caractéristiques de l'ordre</Text>
          <View style={styles.caracTable}>
            <View style={styles.caracRow}>
              <Text style={styles.caracKey}>Instrument</Text>
              <Text style={styles.caracValNormal}>{instrument.libelle}</Text>
            </View>
            <View style={styles.caracRow}>
              <Text style={styles.caracKey}>Code ISIN</Text>
              <Text style={styles.caracVal}>{instrument.isin}</Text>
            </View>
            <View style={styles.caracRow}>
              <Text style={styles.caracKey}>Sens</Text>
              <Text style={styles.caracValNormal}>{ordre.sens}</Text>
            </View>
            <View style={styles.caracRow}>
              <Text style={styles.caracKey}>Type d'ordre</Text>
              <Text style={styles.caracValNormal}>{ordre.type}</Text>
            </View>
            <View style={styles.caracRow}>
              <Text style={styles.caracKey}>Quantité</Text>
              <Text style={styles.caracVal}>{ordre.quantite.toLocaleString('fr-FR').replace(/\u202f/g, "\u00a0")} titres</Text>
            </View>
            <View style={styles.caracRow}>
              <Text style={styles.caracKey}>Prix limite</Text>
              <Text style={styles.caracVal}>
                {ordre.prix_limite !== null
                  ? ordre.prix_limite.toLocaleString('fr-FR').replace(/\u202f/g, "\u00a0") + ' XAF'
                  : 'Au marché'}
              </Text>
            </View>
            <View style={styles.caracRow}>
              <Text style={styles.caracKey}>Montant brut</Text>
              <Text style={styles.caracVal}>{fmtMontant(ordre.brut)}</Text>
            </View>
            <View style={styles.caracRow}>
              <Text style={styles.caracKey}>Courus</Text>
              <Text style={styles.caracVal}>{fmtMontant(ordre.courus)}</Text>
            </View>
            <View style={styles.caracRow}>
              <Text style={styles.caracKey}>Frais</Text>
              <Text style={styles.caracVal}>{fmtMontant(ordre.frais)}</Text>
            </View>
            <View style={[styles.caracRow, styles.caracRowLast]}>
              <Text style={[styles.caracKey, { fontWeight: 600 }]}>Net total</Text>
              <Text style={[styles.caracVal, { fontWeight: 600, color: INK }]}>
                {fmtMontant(ordre.net)}
              </Text>
            </View>
          </View>
        </View>

        {/* Section 5 · Cycle de vie résumé (timeline horizontale) */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Cycle de vie</Text>
          <View style={styles.timelineContainer}>
            {workflow.length === 0 ? (
              <Text style={{ fontFamily: 'Inter', fontSize: 8, color: GRAY_600 }}>
                Aucune étape enregistrée.
              </Text>
            ) : (
              workflow.map((step, idx) => (
                <View key={idx} style={styles.timelineStep}>
                  <View
                    style={
                      idx < workflow.length - 1
                        ? styles.timelineDot
                        : styles.timelineDotActive
                    }
                  />
                  <Text style={styles.timelineLabel}>{etapeLabel(step.etape)}</Text>
                  <Text style={styles.timelineDate}>
                    {fmtDate(step.created_at)}
                  </Text>
                  <Text style={styles.timelineActeur}>{step.acteur_nom}</Text>
                  {step.commentaire ? (
                    <Text style={[styles.timelineActeur, { color: WARNING }]}>
                      {step.commentaire}
                    </Text>
                  ) : null}
                </View>
              ))
            )}
          </View>
        </View>

        {/* Section 6 · Signatures Front et Middle */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Signatures</Text>
          <View style={styles.signaturesRow}>
            {/* Signature Front */}
            <View style={styles.signatureBox}>
              <Text style={styles.signatureTitle}>Front Office</Text>
              <Text style={styles.signatureNom}>{signatures.front.nom}</Text>
              <Text style={styles.signatureDate}>
                {fmtDateTime(signatures.front.date)}
              </Text>
              <Text style={styles.signatureAudit}>
                Réf. audit · {signatures.front.audit_id.slice(0, 8)}
              </Text>
            </View>

            {/* Signature Middle */}
            <View style={styles.signatureBox}>
              <Text style={styles.signatureTitle}>Middle Office</Text>
              {signatures.middle ? (
                <>
                  <Text style={styles.signatureNom}>{signatures.middle.nom}</Text>
                  <Text style={styles.signatureDate}>
                    {fmtDateTime(signatures.middle.date)}
                  </Text>
                  <Text style={styles.signatureAudit}>
                    Réf. audit · {signatures.middle.audit_id.slice(0, 8)}
                  </Text>
                </>
              ) : (
                <Text style={styles.signatureAbsent}>En attente de validation Middle Office</Text>
              )}
            </View>
          </View>
        </View>

        {/* Section 7 · Pied légal */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerLeft}>
            Reporting Manar · COSUMAF Règlement n° 2014/03 · RG-056 à RG-063 (quatre yeux) · RG-045 (9 contrôles)
          </Text>
          <Text style={styles.footerCenter}>
            {'Hash · '}{hashTronque}{'... · RFC 3161 mock'}
          </Text>
          <Text style={styles.footerRight}>
            {'© 2026 MAEBA Consulting · Solution MIMS'}
          </Text>
        </View>

        {/* Section 8 · Cachet électronique mock */}
        <View style={styles.cachet} fixed>
          <Text style={{ fontFamily: 'JetBrainsMono', fontSize: 10, color: INFO }}>
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
  )
}
