// Agrégateur pur des tableaux de bord. Aucune I/O : prend des positions et
// mouvements normalisés, calcule les 9 métriques de pilotage (05-DASHBOARDS).
// La logique de concentration est portée de MIMS risk-dashboard.ts
// (computeConcentrationScore, seuil COSUMAF 30 %, sans pénalité ≤ 15 %).

export interface DashPosition {
  client_id: string;
  client_code: string;
  client_nom: string;
  client_type: "PP" | "PM";
  emetteur_id: string | null;
  emetteur_nom: string;
  emetteur_type: "CORPORATE" | "SOUVERAIN" | null;
  instrument_type: "ACTION" | "OBLIGATION" | "OPC";
  taux_interet: number | null;
  date_echeance: string | null;
  quantite: number;
  valorisation_xaf: number;
}

export interface DashMouvement {
  sens: "ACHAT" | "VENTE" | "OST_ENTREE" | "OST_SORTIE";
  date_operation: string | null;
  montant_xaf: number;
}

export type ScoreStatus = "critique" | "attention" | "bon" | "excellent";

export interface PartItem {
  cle: string;
  libelle: string;
  valorisation: number;
  part: number; // pourcentage 0-100
}

export interface Dashboards {
  encours: {
    valorisationTotale: number;
    nbPositions: number;
    nbComptes: number;
  };
  repartitionClasse: PartItem[];
  concentrationEmetteur: {
    items: PartItem[];
    concentrationMax: number; // %
    alerte: boolean; // > 30 %
    score: number; // 0-100
    status: ScoreStatus;
  };
  concentrationClient: PartItem[];
  echeancier: Array<{ annee: string; montant: number }>;
  fluxActivite: Array<{ periode: string; achat: number; vente: number }>;
  /** Encours reconstitué dans le temps : cumul courant des flux nets mensuels. */
  evolutionEncours: Array<{ periode: string; cumule: number }>;
  /** Série brute des cumuls (pour les sparklines KPI). */
  sparkEncours: number[];
  repartitionTypeClient: {
    pp: { comptes: number; valorisation: number };
    pm: { comptes: number; valorisation: number };
  };
  souverainVsCorporate: {
    souverain: number;
    corporate: number;
  };
  tauxMoyenPondereObligataire: number; // %
}

/** Statut d'un score (gauge segmentée, seuils spec 05). */
export function scoreToStatus(score: number): ScoreStatus {
  if (score < 30) return "critique";
  if (score < 60) return "attention";
  if (score < 80) return "bon";
  return "excellent";
}

function toParts(map: Map<string, { libelle: string; valo: number }>, total: number): PartItem[] {
  const items: PartItem[] = [];
  for (const [cle, v] of map.entries()) {
    items.push({
      cle,
      libelle: v.libelle,
      valorisation: v.valo,
      part: total > 0 ? (v.valo / total) * 100 : 0,
    });
  }
  items.sort((a, b) => b.valorisation - a.valorisation);
  return items;
}

/** Score de concentration émetteur (porté de MIMS). */
function concentrationScore(concentrationMax: number): number {
  if (concentrationMax <= 15) return 100;
  return Math.max(0, Math.round(100 - ((concentrationMax - 15) / 85) * 100));
}

/** Calcule l'ensemble des tableaux de bord. */
export function computeDashboards(
  positions: DashPosition[],
  mouvements: DashMouvement[],
): Dashboards {
  const valorisationTotale = positions.reduce(
    (s, p) => s + p.valorisation_xaf,
    0,
  );
  const comptes = new Set(positions.map((p) => p.client_id));

  // Répartition par classe d'actifs.
  const parClasse = new Map<string, { libelle: string; valo: number }>();
  const libelleClasse: Record<DashPosition["instrument_type"], string> = {
    ACTION: "Actions",
    OBLIGATION: "Obligations",
    OPC: "OPC",
  };
  for (const p of positions) {
    const cur = parClasse.get(p.instrument_type) ?? {
      libelle: libelleClasse[p.instrument_type],
      valo: 0,
    };
    cur.valo += p.valorisation_xaf;
    parClasse.set(p.instrument_type, cur);
  }

  // Concentration par émetteur.
  const parEmetteur = new Map<string, { libelle: string; valo: number }>();
  for (const p of positions) {
    const key = p.emetteur_id ?? "INCONNU";
    const cur = parEmetteur.get(key) ?? {
      libelle: p.emetteur_nom || "Inconnu",
      valo: 0,
    };
    cur.valo += p.valorisation_xaf;
    parEmetteur.set(key, cur);
  }
  const itemsEmetteur = toParts(parEmetteur, valorisationTotale);
  const concentrationMax = itemsEmetteur.length > 0 ? itemsEmetteur[0].part : 0;
  const score = concentrationScore(concentrationMax);

  // Concentration par client.
  const parClient = new Map<string, { libelle: string; valo: number }>();
  for (const p of positions) {
    const cur = parClient.get(p.client_id) ?? {
      libelle: p.client_nom || p.client_code,
      valo: 0,
    };
    cur.valo += p.valorisation_xaf;
    parClient.set(p.client_id, cur);
  }

  // Échéancier obligataire (par année d'échéance).
  const parAnnee = new Map<string, number>();
  for (const p of positions) {
    if (p.instrument_type !== "OBLIGATION" || !p.date_echeance) continue;
    const annee = p.date_echeance.slice(0, 4);
    if (!/^\d{4}$/.test(annee)) continue;
    parAnnee.set(annee, (parAnnee.get(annee) ?? 0) + p.valorisation_xaf);
  }
  const echeancier = [...parAnnee.entries()]
    .map(([annee, montant]) => ({ annee, montant }))
    .sort((a, b) => a.annee.localeCompare(b.annee));

  // Flux d'activité (achat/vente par mois).
  const parMois = new Map<string, { achat: number; vente: number }>();
  for (const m of mouvements) {
    if (!m.date_operation) continue;
    const mois = m.date_operation.slice(0, 7); // yyyy-mm
    if (!/^\d{4}-\d{2}$/.test(mois)) continue;
    const cur = parMois.get(mois) ?? { achat: 0, vente: 0 };
    if (m.sens === "ACHAT" || m.sens === "OST_ENTREE") cur.achat += m.montant_xaf;
    else cur.vente += m.montant_xaf;
    parMois.set(mois, cur);
  }
  const fluxActivite = [...parMois.entries()]
    .map(([periode, v]) => ({ periode, achat: v.achat, vente: v.vente }))
    .sort((a, b) => a.periode.localeCompare(b.periode));

  // Évolution de l'encours reconstitué : flux net mensuel cumulé.
  // Flux net = somme(ACHAT|OST_ENTREE) − somme(VENTE|OST_SORTIE) par mois.
  const fluxNetParMois = new Map<string, number>();
  for (const m of mouvements) {
    if (!m.date_operation) continue;
    const mois = m.date_operation.slice(0, 7); // yyyy-mm
    if (!/^\d{4}-\d{2}$/.test(mois)) continue;
    const signe = m.sens === "ACHAT" || m.sens === "OST_ENTREE" ? 1 : -1;
    fluxNetParMois.set(mois, (fluxNetParMois.get(mois) ?? 0) + signe * m.montant_xaf);
  }
  const moisTries = [...fluxNetParMois.entries()].sort((a, b) =>
    a[0].localeCompare(b[0]),
  );
  let cumul = 0;
  const evolutionEncours = moisTries.map(([periode, net]) => {
    cumul += net;
    return { periode, cumule: cumul };
  });
  const sparkEncours = evolutionEncours.map((p) => p.cumule);

  // Répartition par type de client.
  const ppComptes = new Set<string>();
  const pmComptes = new Set<string>();
  let ppValo = 0;
  let pmValo = 0;
  for (const p of positions) {
    if (p.client_type === "PP") {
      ppComptes.add(p.client_id);
      ppValo += p.valorisation_xaf;
    } else {
      pmComptes.add(p.client_id);
      pmValo += p.valorisation_xaf;
    }
  }

  // Souverain vs corporate.
  let souverain = 0;
  let corporate = 0;
  for (const p of positions) {
    if (p.emetteur_type === "SOUVERAIN") souverain += p.valorisation_xaf;
    else if (p.emetteur_type === "CORPORATE") corporate += p.valorisation_xaf;
  }

  // Taux moyen pondéré obligataire (pondéré par valorisation).
  let sommePondere = 0;
  let sommePoids = 0;
  for (const p of positions) {
    if (p.instrument_type !== "OBLIGATION" || p.taux_interet == null) continue;
    sommePondere += p.taux_interet * p.valorisation_xaf;
    sommePoids += p.valorisation_xaf;
  }
  const tauxMoyenPondereObligataire =
    sommePoids > 0 ? sommePondere / sommePoids : 0;

  return {
    encours: {
      valorisationTotale,
      nbPositions: positions.length,
      nbComptes: comptes.size,
    },
    repartitionClasse: toParts(parClasse, valorisationTotale),
    concentrationEmetteur: {
      items: itemsEmetteur,
      concentrationMax: Math.round(concentrationMax * 10) / 10,
      alerte: concentrationMax > 30,
      score,
      status: scoreToStatus(score),
    },
    concentrationClient: toParts(parClient, valorisationTotale),
    echeancier,
    fluxActivite,
    evolutionEncours,
    sparkEncours,
    repartitionTypeClient: {
      pp: { comptes: ppComptes.size, valorisation: ppValo },
      pm: { comptes: pmComptes.size, valorisation: pmValo },
    },
    souverainVsCorporate: { souverain, corporate },
    tauxMoyenPondereObligataire:
      Math.round(tauxMoyenPondereObligataire * 100) / 100,
  };
}
