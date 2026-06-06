// Dérivation des 6 entités métier depuis les lignes Manar mappées.
// Porté de MIMS lib/services/manar/manar-migration.ts.
//
// Adaptations mono-SDB : retrait de sdb_id, place_id, exists_in_mims et de la
// logique de pré-référence MIMS. Les helpers de mapping/déduction restent purs
// et fidèles à l'original (statuts, PP/PM, PMP, codes synthétiques).

import { EMETTEUR_MAP, POSTE_MAP } from "./manar-mapping";
import type { ManarMappedRow } from "./manar-mapping";

export type MimsStatut = "VALIDE" | "EN_ATTENTE" | "SUSPENDU";
export type MovementSens = "ACHAT" | "VENTE" | "OST_ENTREE" | "OST_SORTIE";
export type InstrumentType = "ACTION" | "OBLIGATION" | "OPC";

export interface EmetteurCandidate {
  code: string;
  nom: string;
  type: "CORPORATE" | "SOUVERAIN";
  pays: string;
  secteur: string | null;
}

export interface InstrumentCandidate {
  isin: string;
  code_mims: string;
  libelle_fr: string;
  type: InstrumentType;
  categorie: string;
  devise: string;
  emetteur_code: string;
  taux_interet: number | null;
  date_echeance: string | null;
  base_couru: string | null;
  statut: "ACTIVE" | "PRE_REFERENCE";
}

export interface ClientCandidate {
  code: string;
  type: "PP" | "PM";
  nom: string;
  prenom: string | null;
  provenance: string;
  // Extensions 1-1
  raison_sociale: string | null;
  rccm: string | null;
  forme_juridique: string | null;
}

export interface PortefeuilleCandidate {
  code: string;
  libelle: string;
  client_code: string;
  devise: string;
  statut: "ACTIF";
}

export interface AggregatedPosition {
  client_code: string;
  isin: string;
  quantite_totale: number;
  pmp_xaf: number | null;
  /** Valeur nominale (Manar MONTANTDEV) reprise de l'opération la plus récente. */
  valeur_nominale_xaf: number | null;
  /** Coupon couru (Manar INTERET COURU) repris de l'opération la plus récente. */
  courus_xaf: number | null;
  /** Date du dernier mouvement de la position (ISO « yyyy-mm-dd »). */
  derniere_maj: string | null;
}

export interface MovementToCreate {
  client_code: string;
  isin: string;
  sens: MovementSens;
  quantite: number;
  prix_unitaire_xaf: number | null;
  /** Valeur nominale de l'opération (Manar MONTANTDEV). */
  valeur_nominale_xaf: number | null;
  /** Coupon couru de l'opération (Manar INTERET COURU). */
  courus_xaf: number | null;
  date_operation: string;
  date_valeur: string;
  statut: MimsStatut;
  manar_op_id: string;
}

export interface DerivedEntities {
  emetteurs: EmetteurCandidate[];
  instruments: InstrumentCandidate[];
  clients: ClientCandidate[];
  portefeuilles: PortefeuilleCandidate[];
  positions: AggregatedPosition[];
  mouvements: MovementToCreate[];
  warnings: string[];
}

// ===========================================================================
// Helpers de mapping (purs, fidèles à MIMS)
// ===========================================================================

/** Mapping statuts Manar → MIMS (D-MNR-03). */
export function mapManarStatutToMimsStatut(
  statut: "F" | "V" | "P" | "S",
): MimsStatut {
  switch (statut) {
    case "F":
    case "V":
      return "VALIDE";
    case "P":
      return "EN_ATTENTE";
    case "S":
      return "SUSPENDU";
  }
}

const PM_INDICES = [
  "SARL", "SAS", "EURL", "SCS", "SNC", "SCI", "GIE",
  "BANK", "BANQUE", "SOCIETE", "SOCIÉTÉ", "GROUP", "GROUPE", "HOLDING",
  "TRUST", "INTERNATIONAL", "COMPAGNIE", "CIE", "CORP", "ASSURANCE",
  " SA ", " SA$", "^SA ", "^SA-", " SA-",
];

/** Heuristique PP/PM depuis le donneur d'ordre Manar. Défaut · PP. */
export function deduceClientTypeFromDonneurOrdre(
  donneurOrdre: string,
): "PP" | "PM" {
  const upper = ` ${donneurOrdre.toUpperCase()} `;
  for (const indice of PM_INDICES) {
    if (indice.startsWith("^") || indice.endsWith("$")) {
      const re = new RegExp(indice.replace(/^\^/, "\\b").replace(/\$$/, "\\b"));
      if (re.test(upper)) return "PM";
    } else if (upper.includes(indice)) {
      return "PM";
    }
  }
  return "PP";
}

/** Split « DUPONT Jean » → { nom: 'DUPONT', prenom: 'Jean' }. */
export function splitNomPrenomFromLabel(label: string): {
  nom: string;
  prenom: string | null;
} {
  const cleaned = label
    .replace(/^(M\.?|MME\.?|MR\.?|MRS\.?|DR\.?|PR\.?)\s+/i, "")
    .trim();
  const tokens = cleaned.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return { nom: cleaned || "INCONNU", prenom: null };
  if (tokens.length === 1) return { nom: tokens[0].toUpperCase(), prenom: null };

  const upperTokens = tokens.filter(
    (t) => t === t.toUpperCase() && t.length >= 2,
  );
  if (upperTokens.length === 1) {
    const upperToken = upperTokens[0];
    const restTokens = tokens.filter((t) => t !== upperToken);
    return { nom: upperToken, prenom: restTokens.join(" ") || null };
  }
  return { nom: tokens[0].toUpperCase(), prenom: tokens.slice(1).join(" ") || null };
}

function parseNumeric(raw: string | null | undefined): number {
  if (raw === null || raw === undefined) return 0;
  const n = Number(String(raw).replace(/\s+/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

/**
 * Déduit la quantité du mouvement : priorité aux colonnes extra (QUANTITE / NB
 * TITRES), repli sur montant_brut / prix, défaut 1.
 */
export function deduceQuantiteFromRow(row: ManarMappedRow): number {
  const extras = row.extra_columns ?? {};
  for (const [key, value] of Object.entries(extras)) {
    if (
      typeof key === "string" &&
      /quantit[eé]|nombre.*titres?|nb.*titres?/i.test(key)
    ) {
      const n = parseNumeric(value);
      if (n > 0) return Math.round(n);
    }
  }
  const montant = parseNumeric(row.montant_brut_xaf);
  const prix = parseNumeric(row.prix_xaf);
  if (prix > 0 && montant > 0) {
    return Math.max(1, Math.round(montant / prix));
  }
  return 1;
}

/** Déduit le type d'instrument depuis le code POSTE Manar. */
export function deduceInstrumentTypeFromPoste(
  posteCode: string | null,
): InstrumentType {
  if (!posteCode) return "OBLIGATION";
  const poste = POSTE_MAP[posteCode];
  if (!poste) return "OBLIGATION";
  if (/action/i.test(poste.libelle)) return "ACTION";
  if (/oblig/i.test(poste.libelle)) return "OBLIGATION";
  return "OBLIGATION";
}

/** Déduit type d'émetteur CORPORATE/SOUVERAIN depuis le code Manar. */
export function deduceEmetteurTypeFromCode(
  emetteurCode: string,
): "CORPORATE" | "SOUVERAIN" {
  const emetteur = EMETTEUR_MAP[emetteurCode];
  if (emetteur) {
    return /État|Etat|State/i.test(emetteur.libelle) ? "SOUVERAIN" : "CORPORATE";
  }
  if (emetteurCode.toUpperCase().startsWith("E-")) {
    return /GABON|TCHAD|CONGO|CAMEROUN|CENTRAFRIQUE|GUINEE/i.test(emetteurCode)
      ? "SOUVERAIN"
      : "CORPORATE";
  }
  return "CORPORATE";
}

/** Déduit le sens MIMS depuis la nature d'opération Manar. */
export function deduceSensFromNatureOperation(
  natureOperation: string | null,
): MovementSens {
  if (!natureOperation) return "ACHAT";
  const upper = natureOperation.toUpperCase();
  if (/VENTE|CESS/i.test(upper)) return "VENTE";
  if (/ACHAT|ACQ|SOUSCRIPT/i.test(upper)) return "ACHAT";
  if (/OST|DIVIDEND|COUPON/i.test(upper)) return "OST_ENTREE";
  return "ACHAT";
}

// ===========================================================================
// Codes synthétiques
// ===========================================================================

/** Hash stable FNV-1a 32-bit (déterministe, non cryptographique). */
export function hashFnv1a(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = (hash * 16777619) >>> 0;
  }
  return hash >>> 0;
}

/** Code client synthétique stable · CT-MNR-XXXXXX (6 hex). */
export function syntheticClientCode(donneurOrdre: string): string {
  const hex = hashFnv1a(donneurOrdre)
    .toString(16)
    .toUpperCase()
    .padStart(8, "0")
    .slice(0, 6);
  return `CT-MNR-${hex}`;
}

/** RCCM synthétique compatible · CM-MIGR-9999-X-NNNNNN. */
export function syntheticRccm(clientCode: string): string {
  const hex = clientCode.replace(/[^0-9A-F]/gi, "").slice(-6) || "000000";
  const numericPart = String(parseInt(hex, 16) % 1000000).padStart(6, "0");
  return `CM-MIGR-9999-X-${numericPart}`;
}

// ===========================================================================
// Agrégation positions + PMP
// ===========================================================================

/**
 * Agrège les mouvements par (client, instrument) avec PMP pondéré. Seuls les
 * mouvements VALIDE contribuent au stock ; les positions ≤ 0 sont filtrées.
 */
export function aggregatePositionsByClientInstrument(
  movements: MovementToCreate[],
): AggregatedPosition[] {
  const map = new Map<
    string,
    {
      quantite: number;
      cost: number;
      valeur_nominale_xaf: number | null;
      courus_xaf: number | null;
      derniere_maj: string | null;
    }
  >();
  for (const m of movements) {
    if (m.statut !== "VALIDE") continue;
    const key = `${m.client_code}::${m.isin}`;
    const current =
      map.get(key) ??
      ({
        quantite: 0,
        cost: 0,
        valeur_nominale_xaf: null,
        courus_xaf: null,
        derniere_maj: null,
      } as const);
    const signedQty =
      m.sens === "ACHAT" || m.sens === "OST_ENTREE" ? m.quantite : -m.quantite;
    const cost = signedQty * (m.prix_unitaire_xaf ?? 0);
    // Nominal, coupon couru et date « dernière maj » repris de l'opération la
    // plus récente de la position (dates ISO comparables lexicographiquement).
    // Sémantique provisoire, à confirmer côté métier (cf. courrier).
    const plusRecent =
      current.derniere_maj === null || m.date_operation > current.derniere_maj;
    map.set(key, {
      quantite: current.quantite + signedQty,
      cost: current.cost + cost,
      valeur_nominale_xaf: plusRecent
        ? (m.valeur_nominale_xaf ?? current.valeur_nominale_xaf)
        : current.valeur_nominale_xaf,
      courus_xaf: plusRecent
        ? (m.courus_xaf ?? current.courus_xaf)
        : current.courus_xaf,
      derniere_maj: plusRecent ? m.date_operation : current.derniere_maj,
    });
  }

  const positions: AggregatedPosition[] = [];
  for (const [key, value] of map.entries()) {
    if (value.quantite <= 0) continue;
    const [client_code, isin] = key.split("::");
    positions.push({
      client_code,
      isin,
      quantite_totale: value.quantite,
      pmp_xaf: value.quantite > 0 ? value.cost / value.quantite : null,
      valeur_nominale_xaf: value.valeur_nominale_xaf,
      courus_xaf: value.courus_xaf,
      derniere_maj: value.derniere_maj,
    });
  }
  return positions;
}

/** PMP pondéré d'une série d'acquisitions. */
export function computePMP(
  acquisitions: Array<{ quantite: number; prix_unitaire_xaf: number }>,
): number {
  if (acquisitions.length === 0) return 0;
  const totalQty = acquisitions.reduce((s, m) => s + m.quantite, 0);
  if (totalQty <= 0) return 0;
  const totalCost = acquisitions.reduce(
    (s, m) => s + m.quantite * m.prix_unitaire_xaf,
    0,
  );
  return totalCost / totalQty;
}

function deriveCategorie(type: InstrumentType): string {
  switch (type) {
    case "ACTION":
      return "ACTIONS";
    case "OBLIGATION":
      return "OBLIGATIONS_PRIV";
    case "OPC":
      return "OPC";
  }
}

// ===========================================================================
// Dérivation maître des 6 entités
// ===========================================================================

/**
 * Dérive les 6 entités métier depuis les lignes Manar mappées. Pure (aucune
 * I/O) : l'écriture PocketBase est faite par le service d'import.
 */
export function deriveEntities(rows: ManarMappedRow[]): DerivedEntities {
  const warnings: string[] = [];

  const emetteurMap = new Map<string, EmetteurCandidate>();
  const instrumentMap = new Map<string, InstrumentCandidate>();
  const clientMap = new Map<string, ClientCandidate>();
  const portefeuilleMap = new Map<string, PortefeuilleCandidate>();
  const movements: MovementToCreate[] = [];

  const today = new Date().toISOString().slice(0, 10);

  for (const op of rows) {
    // ---- Émetteur ----
    if (op.emetteur_code && !emetteurMap.has(op.emetteur_code)) {
      const type = deduceEmetteurTypeFromCode(op.emetteur_code);
      emetteurMap.set(op.emetteur_code, {
        code: op.emetteur_code,
        nom: EMETTEUR_MAP[op.emetteur_code]?.libelle ?? op.emetteur_code,
        type,
        pays: EMETTEUR_MAP[op.emetteur_code]?.pays ?? "CM",
        secteur: null,
      });
    }

    // ---- Instrument ----
    if (op.isin && op.emetteur_code) {
      if (!instrumentMap.has(op.isin)) {
        const instType = deduceInstrumentTypeFromPoste(op.poste_code);
        instrumentMap.set(op.isin, {
          isin: op.isin,
          code_mims: `MNR-${op.isin}`,
          libelle_fr: op.libelle_instrument ?? op.isin,
          type: instType,
          categorie: deriveCategorie(instType),
          devise: "XAF",
          emetteur_code: op.emetteur_code,
          taux_interet:
            instType === "OBLIGATION" ? parseNumeric(op.taux_interet) || null : null,
          date_echeance: null,
          base_couru: instType === "OBLIGATION" ? "30/360" : null,
          statut: op.is_pre_reference ? "PRE_REFERENCE" : "ACTIVE",
        });
      }
    } else if (op.isin && !op.emetteur_code) {
      warnings.push(
        `Opération ${op.manar_op_id} · ISIN ${op.isin} sans emetteur_code · instrument ignoré`,
      );
    }

    // ---- Client (depuis donneur_ordre) ----
    if (!op.donneur_ordre) {
      warnings.push(
        `Opération ${op.manar_op_id} · donneur_ordre manquant · client ignoré`,
      );
      continue;
    }
    const clientCode = syntheticClientCode(op.donneur_ordre);
    if (!clientMap.has(clientCode)) {
      const clientType = deduceClientTypeFromDonneurOrdre(op.donneur_ordre);
      const { nom, prenom } =
        clientType === "PP"
          ? splitNomPrenomFromLabel(op.donneur_ordre)
          : { nom: op.donneur_ordre.toUpperCase(), prenom: null };

      const safePrenom =
        clientType === "PP"
          ? prenom
            ? prenom.slice(0, 100)
            : "(à compléter)"
          : prenom
            ? prenom.slice(0, 100)
            : null;

      clientMap.set(clientCode, {
        code: clientCode,
        type: clientType,
        nom: nom.slice(0, 100),
        prenom: safePrenom,
        provenance: "MANAR_MIGRATION",
        raison_sociale:
          clientType === "PM" ? op.donneur_ordre.slice(0, 200) : null,
        rccm: clientType === "PM" ? syntheticRccm(clientCode) : null,
        forme_juridique: clientType === "PM" ? "SA" : null,
      });
    }

    // ---- Portefeuille (1 par client) ----
    const portefeuilleCode = `PORT-${clientCode}`;
    if (!portefeuilleMap.has(portefeuilleCode)) {
      portefeuilleMap.set(portefeuilleCode, {
        code: portefeuilleCode,
        client_code: clientCode,
        libelle: `Portefeuille · ${clientCode}`,
        devise: "XAF",
        statut: "ACTIF",
      });
    }

    // ---- Mouvement (si ISIN présent) ----
    if (op.isin) {
      movements.push({
        client_code: clientCode,
        isin: op.isin,
        sens: deduceSensFromNatureOperation(op.nature_operation),
        quantite: deduceQuantiteFromRow(op),
        prix_unitaire_xaf: op.prix_xaf ? parseNumeric(op.prix_xaf) || null : null,
        valeur_nominale_xaf: op.valeur_nominale_xaf
          ? parseNumeric(op.valeur_nominale_xaf) || null
          : null,
        courus_xaf: op.courus_xaf ? parseNumeric(op.courus_xaf) || null : null,
        date_operation: op.date_operation
          ? toIsoDate(op.date_operation)
          : today,
        date_valeur: op.date_valeur
          ? toIsoDate(op.date_valeur)
          : op.date_operation
            ? toIsoDate(op.date_operation)
            : today,
        statut: mapManarStatutToMimsStatut(op.statut),
        manar_op_id: op.manar_op_id,
      });
    }
  }

  const positions = aggregatePositionsByClientInstrument(movements);

  return {
    emetteurs: Array.from(emetteurMap.values()),
    instruments: Array.from(instrumentMap.values()),
    clients: Array.from(clientMap.values()),
    portefeuilles: Array.from(portefeuilleMap.values()),
    positions,
    mouvements: movements,
    warnings,
  };
}

/** Convertit une date Manar dd/mm/yyyy en ISO ; laisse passer une date déjà ISO. */
function toIsoDate(raw: string): string {
  const trimmed = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const m = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  return trimmed;
}
