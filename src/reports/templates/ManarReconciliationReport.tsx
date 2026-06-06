// -*- coding: utf-8 -*-
// Gabarit PDF A4 portrait · Rapport de réconciliation Manar Bridge.
// Porté de MIMS lib/integrations/pdf/templates/ManarReconciliationReport.tsx.
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
// Tokens DS (hex inline · React-PDF ignore Tailwind)
// ---------------------------------------------------------------------------

const INK = '#11191F'
const GRAY_100 = '#F4F4F2'
const GRAY_200 = '#E5E4DC'
const GRAY_600 = '#6B7178'
const GRAY_700 = '#4A4F4D'
const WHITE = '#FFFFFF'
const ACCENT_DARK = '#1A3A4A' // en-tête rapport (bleu foncé sobre)
const SUCCESS = '#5C7C5C'
const SUCCESS_SOFT = '#E3EBE2'
const WARNING = '#C8941E'
const WARNING_SOFT = '#F2E4C8'
const INFO = '#3A6B7C'
const INFO_SOFT = '#DCE6EA'

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ManarReconciliationReportProps {
  importId: string
  fileName: string
  fileHash: string
  importedAt: string      // ISO date
  operateur: string
  durationMs: number
  nbOperations: number
  montantTotalXaf: number
  sdbName: string         // ex : 'CCA BOURSE'
  // Agrégats
  statutBreakdown: Array<{ statut: 'F' | 'V' | 'P' | 'S'; nb: number; montant: number }>
  emetteurBreakdown: Array<{ code: string; nb: number; pct: number; montant: number }>
  operateurBreakdown: Array<{
    nom: string
    nbSaisies: number
    pctSaisies: number
    nbValidations: number
    pctValidations: number
  }>
  preReferencesCount: number
  preReferences?: Array<{ type: 'POSTE' | 'EMETTEUR'; code: string; count: number }>
  exportedAt: string      // ISO date · moment de la génération du rapport
  hash_sha256?: string    // CR-02 · hash 2-pass (vide au pass 1)
}

// ---------------------------------------------------------------------------
// Helpers formatage
// ---------------------------------------------------------------------------

function fmtDate(iso: string): string {
  try {
    const d = new Date(iso)
    const dd = String(d.getDate()).padStart(2, '0')
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const yyyy = d.getFullYear()
    return `${dd}/${mm}/${yyyy}`
  } catch {
    return iso
  }
}

function fmtDateTime(iso: string): string {
  try {
    const d = new Date(iso)
    return `${fmtDate(iso)} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  } catch {
    return iso
  }
}

function fmtMontant(val: number): string {
  // Format français avec espace comme séparateur de milliers
  return val.toLocaleString('fr-FR', { maximumFractionDigits: 0 }) + ' XAF'
}

function fmtDuree(ms: number): string {
  return (ms / 1000).toFixed(1) + 's'
}

function fmtPct(val: number): string {
  return val.toFixed(1) + ' %'
}

// Libellés statuts Manar
const STATUT_LIBELLES: Record<'F' | 'V' | 'P' | 'S', string> = {
  F: 'FINALISÉ',
  V: 'VALIDÉ',
  P: 'EN COURS',
  S: 'SUSPENDU',
}

// ---------------------------------------------------------------------------
// StyleSheet
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Inter',
    fontSize: 8,
    color: INK,
    paddingTop: 32,
    paddingBottom: 48,
    paddingHorizontal: 36,
    backgroundColor: WHITE,
  },
  // Section 1 · En-tête
  header: {
    backgroundColor: ACCENT_DARK,
    borderRadius: 2,
    padding: 14,
    marginBottom: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerLeft: {
    flex: 1,
  },
  headerLogo: {
    fontSize: 14,
    fontWeight: 600,
    color: WHITE,
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  headerSdb: {
    fontSize: 9,
    color: '#A0C4D4',
    marginBottom: 2,
  },
  headerConfidentiel: {
    fontSize: 7,
    color: '#A0C4D4',
    marginTop: 4,
  },
  headerRight: {
    alignItems: 'flex-end',
  },
  headerDate: {
    fontSize: 8,
    color: WHITE,
    marginBottom: 2,
  },
  // Sections
  section: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 9,
    fontWeight: 600,
    color: ACCENT_DARK,
    borderBottomWidth: 1,
    borderBottomColor: GRAY_200,
    paddingBottom: 3,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  // Identification import
  identRow: {
    flexDirection: 'row',
    marginBottom: 3,
  },
  identLabel: {
    width: 110,
    color: GRAY_600,
    fontSize: 7.5,
  },
  identValue: {
    flex: 1,
    color: INK,
    fontSize: 7.5,
  },
  identValueMono: {
    flex: 1,
    fontFamily: 'JetBrainsMono',
    fontSize: 7,
    color: GRAY_700,
    wordBreak: 'break-all',
  },
  // KPI box
  kpiRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  kpiBox: {
    flex: 1,
    backgroundColor: GRAY_100,
    borderRadius: 3,
    padding: 8,
    alignItems: 'center',
  },
  kpiValue: {
    fontSize: 14,
    fontWeight: 600,
    color: ACCENT_DARK,
    marginBottom: 2,
  },
  kpiLabel: {
    fontSize: 7,
    color: GRAY_600,
    textAlign: 'center',
  },
  // Tableau
  table: {
    marginBottom: 4,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: GRAY_200,
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderBottomColor: GRAY_200,
    paddingVertical: 3,
    paddingHorizontal: 6,
  },
  tableRowAlt: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderBottomColor: GRAY_200,
    paddingVertical: 3,
    paddingHorizontal: 6,
    backgroundColor: GRAY_100,
  },
  th: {
    fontSize: 7,
    fontWeight: 600,
    color: GRAY_700,
  },
  td: {
    fontSize: 7.5,
    color: INK,
  },
  // Pied de page
  footer: {
    position: 'absolute',
    bottom: 20,
    left: 36,
    right: 36,
    borderTopWidth: 0.5,
    borderTopColor: GRAY_200,
    paddingTop: 6,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  footerText: {
    fontSize: 6.5,
    color: GRAY_600,
  },
  footerHash: {
    fontFamily: 'JetBrainsMono',
    fontSize: 6,
    color: GRAY_600,
  },
  // Badge statut
  badgeF: { backgroundColor: SUCCESS_SOFT, color: SUCCESS },
  badgeV: { backgroundColor: INFO_SOFT, color: INFO },
  badgeP: { backgroundColor: WARNING_SOFT, color: WARNING },
  badgeS: { backgroundColor: GRAY_100, color: GRAY_600 },
  badge: {
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 2,
    fontSize: 7,
    fontWeight: 600,
  },
  // Pré-références
  preRefItem: {
    flexDirection: 'row',
    marginBottom: 2,
    paddingLeft: 8,
  },
  preRefBullet: {
    width: 10,
    fontSize: 7.5,
    color: WARNING,
  },
  preRefText: {
    fontSize: 7.5,
    color: INK,
  },
})

// ---------------------------------------------------------------------------
// Composants internes
// ---------------------------------------------------------------------------

interface StatutBadgeProps {
  statut: 'F' | 'V' | 'P' | 'S'
}
function StatutBadge({ statut }: StatutBadgeProps) {
  const badgeStyle = {
    F: styles.badgeF,
    V: styles.badgeV,
    P: styles.badgeP,
    S: styles.badgeS,
  }[statut]
  return (
    <Text style={[styles.badge, badgeStyle]}>{STATUT_LIBELLES[statut]}</Text>
  )
}

// ---------------------------------------------------------------------------
// Template principal
// ---------------------------------------------------------------------------

export function ManarReconciliationReport(props: ManarReconciliationReportProps) {
  const {
    importId,
    fileName,
    fileHash,
    importedAt,
    operateur,
    durationMs,
    nbOperations,
    montantTotalXaf,
    sdbName,
    statutBreakdown,
    emetteurBreakdown,
    operateurBreakdown,
    preReferencesCount,
    preReferences,
    exportedAt,
    hash_sha256 = '',
  } = props

  const totalStatutNb = statutBreakdown.reduce((s, r) => s + r.nb, 0)
  const totalStatutMontant = statutBreakdown.reduce((s, r) => s + r.montant, 0)

  return (
    <Document>
      <Page size="A4" orientation="portrait" style={styles.page}>
        {/* Section 1 · En-tête */}
        <View style={styles.header} fixed>
          <View style={styles.headerLeft}>
            <Text style={styles.headerLogo}>MIMS</Text>
            <Text style={styles.headerSdb}>{sdbName}</Text>
            <Text style={styles.headerConfidentiel}>
              RAPPORT DE RÉCONCILIATION · CONFIDENTIEL
            </Text>
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.headerDate}>Généré le {fmtDateTime(exportedAt)}</Text>
            <Text style={{ fontSize: 7, color: '#A0C4D4', marginTop: 2 }}>
              Import ID · {importId.slice(0, 8).toUpperCase()}
            </Text>
          </View>
        </View>

        {/* Section 2 · Identification de l'import */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Identification de l'import</Text>
          <View style={styles.identRow}>
            <Text style={styles.identLabel}>Fichier source</Text>
            <Text style={styles.identValue}>{fileName}</Text>
          </View>
          <View style={styles.identRow}>
            <Text style={styles.identLabel}>Date d'import</Text>
            <Text style={styles.identValue}>{fmtDate(importedAt)}</Text>
          </View>
          <View style={styles.identRow}>
            <Text style={styles.identLabel}>Opérateur</Text>
            <Text style={styles.identValue}>{operateur}</Text>
          </View>
          <View style={styles.identRow}>
            <Text style={styles.identLabel}>Durée ingestion</Text>
            <Text style={styles.identValue}>{fmtDuree(durationMs)}</Text>
          </View>
          <View style={styles.identRow}>
            <Text style={styles.identLabel}>Hash SHA-256</Text>
            <Text style={styles.identValueMono}>{fileHash}</Text>
          </View>
        </View>

        {/* Section 3 · Synthèse globale */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Synthèse globale</Text>
          <View style={styles.kpiRow}>
            <View style={styles.kpiBox}>
              <Text style={styles.kpiValue}>{nbOperations.toLocaleString('fr-FR').replace(/\u202f/g, "\u00a0")}</Text>
              <Text style={styles.kpiLabel}>Opérations ingérées</Text>
            </View>
            <View style={styles.kpiBox}>
              <Text style={styles.kpiValue}>{fmtMontant(montantTotalXaf)}</Text>
              <Text style={styles.kpiLabel}>Montant total brut</Text>
            </View>
            <View style={styles.kpiBox}>
              <Text style={styles.kpiValue}>{fmtDuree(durationMs)}</Text>
              <Text style={styles.kpiLabel}>Durée ingestion</Text>
            </View>
          </View>
        </View>

        {/* Section 4 · Répartition par statut */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Répartition par statut</Text>
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={[styles.th, { flex: 2 }]}>Statut</Text>
              <Text style={[styles.th, { flex: 1, textAlign: 'right' }]}>Nb</Text>
              <Text style={[styles.th, { flex: 1, textAlign: 'right' }]}>%</Text>
              <Text style={[styles.th, { flex: 3, textAlign: 'right' }]}>Montant XAF</Text>
              <Text style={[styles.th, { flex: 1, textAlign: 'right' }]}>%</Text>
            </View>
            {statutBreakdown.map((row, idx) => (
              <View key={row.statut} style={idx % 2 === 0 ? styles.tableRow : styles.tableRowAlt}>
                <View style={{ flex: 2 }}>
                  <StatutBadge statut={row.statut} />
                </View>
                <Text style={[styles.td, { flex: 1, textAlign: 'right' }]}>
                  {row.nb.toLocaleString('fr-FR').replace(/\u202f/g, "\u00a0")}
                </Text>
                <Text style={[styles.td, { flex: 1, textAlign: 'right' }]}>
                  {totalStatutNb > 0 ? fmtPct((row.nb / totalStatutNb) * 100) : '-'}
                </Text>
                <Text style={[styles.td, { flex: 3, textAlign: 'right' }]}>
                  {row.montant.toLocaleString('fr-FR').replace(/\u202f/g, "\u00a0")}
                </Text>
                <Text style={[styles.td, { flex: 1, textAlign: 'right' }]}>
                  {totalStatutMontant > 0 ? fmtPct((row.montant / totalStatutMontant) * 100) : '-'}
                </Text>
              </View>
            ))}
            <View style={[styles.tableRow, { backgroundColor: GRAY_200 }]}>
              <Text style={[styles.td, { flex: 2, fontWeight: 600 }]}>TOTAL</Text>
              <Text style={[styles.td, { flex: 1, fontWeight: 600, textAlign: 'right' }]}>
                {totalStatutNb.toLocaleString('fr-FR').replace(/\u202f/g, "\u00a0")}
              </Text>
              <Text style={[styles.td, { flex: 1, textAlign: 'right' }]}>100 %</Text>
              <Text style={[styles.td, { flex: 3, fontWeight: 600, textAlign: 'right' }]}>
                {totalStatutMontant.toLocaleString('fr-FR').replace(/\u202f/g, "\u00a0")}
              </Text>
              <Text style={[styles.td, { flex: 1, textAlign: 'right' }]}>100 %</Text>
            </View>
          </View>
        </View>

        {/* Section 5 · Répartition par émetteur */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Répartition par émetteur</Text>
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={[styles.th, { flex: 2 }]}>Émetteur</Text>
              <Text style={[styles.th, { flex: 1, textAlign: 'right' }]}>Nb</Text>
              <Text style={[styles.th, { flex: 1, textAlign: 'right' }]}>%</Text>
              <Text style={[styles.th, { flex: 3, textAlign: 'right' }]}>Montant XAF</Text>
            </View>
            {emetteurBreakdown.map((row, idx) => (
              <View key={row.code} style={idx % 2 === 0 ? styles.tableRow : styles.tableRowAlt}>
                <Text style={[styles.td, { flex: 2 }]}>{row.code}</Text>
                <Text style={[styles.td, { flex: 1, textAlign: 'right' }]}>
                  {row.nb.toLocaleString('fr-FR').replace(/\u202f/g, "\u00a0")}
                </Text>
                <Text style={[styles.td, { flex: 1, textAlign: 'right' }]}>{fmtPct(row.pct)}</Text>
                <Text style={[styles.td, { flex: 3, textAlign: 'right' }]}>
                  {row.montant.toLocaleString('fr-FR').replace(/\u202f/g, "\u00a0")}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* Section 6 · Répartition par opérateur */}
        {operateurBreakdown.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Répartition par opérateur</Text>
            <View style={styles.table}>
              <View style={styles.tableHeader}>
                <Text style={[styles.th, { flex: 2 }]}>Opérateur</Text>
                <Text style={[styles.th, { flex: 1, textAlign: 'right' }]}>Saisies</Text>
                <Text style={[styles.th, { flex: 1, textAlign: 'right' }]}>% saisies</Text>
                <Text style={[styles.th, { flex: 1, textAlign: 'right' }]}>Validations</Text>
                <Text style={[styles.th, { flex: 1, textAlign: 'right' }]}>% valid.</Text>
              </View>
              {operateurBreakdown.map((row, idx) => (
                <View key={row.nom} style={idx % 2 === 0 ? styles.tableRow : styles.tableRowAlt}>
                  <Text style={[styles.td, { flex: 2 }]}>{row.nom}</Text>
                  <Text style={[styles.td, { flex: 1, textAlign: 'right' }]}>
                    {row.nbSaisies.toLocaleString('fr-FR').replace(/\u202f/g, "\u00a0")}
                  </Text>
                  <Text style={[styles.td, { flex: 1, textAlign: 'right' }]}>
                    {fmtPct(row.pctSaisies)}
                  </Text>
                  <Text style={[styles.td, { flex: 1, textAlign: 'right' }]}>
                    {row.nbValidations.toLocaleString('fr-FR').replace(/\u202f/g, "\u00a0")}
                  </Text>
                  <Text style={[styles.td, { flex: 1, textAlign: 'right' }]}>
                    {fmtPct(row.pctValidations)}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Section 7 · Fiches pré-référence */}
        {preReferencesCount > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              Fiches pré-référence créées ({preReferencesCount})
            </Text>
            <Text style={{ fontSize: 7.5, color: WARNING, marginBottom: 4 }}>
              {preReferencesCount} code(s) inconnu(s) détecté(s) · fiches créées automatiquement (RG-258)
            </Text>
            {(preReferences ?? []).map((ref, idx) => (
              <View key={idx} style={styles.preRefItem}>
                <Text style={styles.preRefBullet}>·</Text>
                <Text style={styles.preRefText}>
                  {ref.type} · {ref.code} ({ref.count} occurrence{ref.count > 1 ? 's' : ''})
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Section 8 · Pied de page */}
        <View style={styles.footer} fixed>
          <Text
            style={styles.footerText}
            render={({ pageNumber, totalPages }) =>
              `Page ${pageNumber} / ${totalPages} · Généré par MIMS REPORTING · ${fmtDateTime(exportedAt)}`
            }
          />
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.footerText}>Traçable audit_log</Text>
            {hash_sha256 && (
              <Text style={styles.footerHash}>SHA-256 · {hash_sha256.slice(0, 16)}…</Text>
            )}
          </View>
        </View>
      </Page>
    </Document>
  )
}
