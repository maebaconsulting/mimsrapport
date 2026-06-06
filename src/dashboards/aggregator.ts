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
  pmp_xaf: number; // prix moyen pondéré unitaire (coût de revient)
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
  /** Plus/moins-value latente (valorisation − coût de revient pmp). */
  pnl: { coutTotal: number; plusValueLatente: number; perfPct: number };
  /** Concentration clientèle : part du 1er et des 5 premiers détenteurs (%). */
  concentrationClientStats: { top1: number; top5: number };
  /** Indice de Herfindahl émetteur (0-1) et nb d'émetteurs « effectif » (1/HHI). */
  diversification: { hhi: number; nbEffectif: number; nbEmetteurs: number };
  /** Mur d'échéances obligataire : part échéant à court terme (%). */
  murEcheances: { pct12m: number; pct24m: number; montant12m: number };
  /** Maturité moyenne pondérée du book obligataire (années). */
  maturiteMoyenne: number;
  /** Statistiques d'encours par compte. */
  encoursParCompte: { moyen: number; median: number };
  /** Collecte nette (flux entrants − sortants) et rotation du book. */
  activite: { collecteNette: number; turnover: number };
  /** Part souveraine du book (%). */
  partSouveraine: number;
  /** Flux net mensuel (pour cascade / barres divergentes). */
  fluxNetMensuel: Array<{ periode: string; net: number }>;
  /** Indicateurs de qualité des données importées. */
  qualite: {
    positionsSansEmetteur: number;
    partSansEmetteur: number; // %
    obligSansEcheance: number;
    obligSansTaux: number;
    positionsValoNulle: number;
    integriteEmetteurPct: number; // % de positions rattachées
  };
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

  // P&L latent : valorisation − coût de revient (pmp × quantité).
  const coutTotal = positions.reduce((s, p) => s + p.pmp_xaf * p.quantite, 0);
  const plusValueLatente = valorisationTotale - coutTotal;
  const perfPct = coutTotal > 0 ? (plusValueLatente / coutTotal) * 100 : 0;

  // Concentration clientèle (parts déjà triées par toParts ci-dessous).
  const itemsClient = toParts(parClient, valorisationTotale);
  const top1Client = itemsClient.length > 0 ? itemsClient[0].part : 0;
  const top5Client = itemsClient.slice(0, 5).reduce((s, i) => s + i.part, 0);

  // Indice de Herfindahl (HHI) sur les émetteurs (parts en fraction).
  const hhi = itemsEmetteur.reduce((s, i) => s + (i.part / 100) ** 2, 0);
  const nbEffectif = hhi > 0 ? 1 / hhi : 0;
  const nbEmetteurs = new Set(
    positions.map((p) => p.emetteur_id).filter((x): x is string => !!x),
  ).size;

  // Mur d'échéances obligataire (< 12 et < 24 mois) sur l'encours obligataire.
  const now = new Date();
  const dans12m = new Date(now.getFullYear(), now.getMonth() + 12, now.getDate());
  const dans24m = new Date(now.getFullYear(), now.getMonth() + 24, now.getDate());
  let valoOblig = 0;
  let montant12m = 0;
  let montant24m = 0;
  let sommeMaturite = 0;
  for (const p of positions) {
    if (p.instrument_type !== "OBLIGATION") continue;
    valoOblig += p.valorisation_xaf;
    if (!p.date_echeance) continue;
    const d = new Date(p.date_echeance);
    if (isNaN(d.getTime())) continue;
    if (d <= dans12m) montant12m += p.valorisation_xaf;
    if (d <= dans24m) montant24m += p.valorisation_xaf;
    const annees = (d.getTime() - now.getTime()) / (365.25 * 24 * 3600 * 1000);
    if (annees > 0) sommeMaturite += annees * p.valorisation_xaf;
  }
  const pct12m = valoOblig > 0 ? (montant12m / valoOblig) * 100 : 0;
  const pct24m = valoOblig > 0 ? (montant24m / valoOblig) * 100 : 0;
  const maturiteMoyenne = valoOblig > 0 ? sommeMaturite / valoOblig : 0;

  // Encours par compte (moyen + médian).
  const encoursParClient = [...parClient.values()].map((v) => v.valo).sort((a, b) => a - b);
  const moyenCompte =
    encoursParClient.length > 0 ? valorisationTotale / encoursParClient.length : 0;
  const medianCompte =
    encoursParClient.length === 0
      ? 0
      : encoursParClient.length % 2 === 1
        ? encoursParClient[(encoursParClient.length - 1) / 2]
        : (encoursParClient[encoursParClient.length / 2 - 1] +
            encoursParClient[encoursParClient.length / 2]) /
          2;

  // Collecte nette + rotation (turnover) à partir des mouvements.
  let collecteNette = 0;
  let volumeTraite = 0;
  for (const m of mouvements) {
    const signe = m.sens === "ACHAT" || m.sens === "OST_ENTREE" ? 1 : -1;
    collecteNette += signe * m.montant_xaf;
    volumeTraite += m.montant_xaf;
  }
  const turnover = valorisationTotale > 0 ? (volumeTraite / valorisationTotale) * 100 : 0;

  const partSouveraine =
    souverain + corporate > 0 ? (souverain / (souverain + corporate)) * 100 : 0;

  const fluxNetMensuel = moisTries.map(([periode, net]) => ({ periode, net }));

  // Qualité des données.
  const positionsSansEmetteur = positions.filter((p) => !p.emetteur_id).length;
  const valoSansEmetteur = positions
    .filter((p) => !p.emetteur_id)
    .reduce((s, p) => s + p.valorisation_xaf, 0);
  const obligSansEcheance = positions.filter(
    (p) => p.instrument_type === "OBLIGATION" && !p.date_echeance,
  ).length;
  const obligSansTaux = positions.filter(
    (p) => p.instrument_type === "OBLIGATION" && p.taux_interet == null,
  ).length;
  const positionsValoNulle = positions.filter((p) => p.valorisation_xaf <= 0).length;
  const integriteEmetteurPct =
    positions.length > 0
      ? ((positions.length - positionsSansEmetteur) / positions.length) * 100
      : 100;

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
    concentrationClient: itemsClient,
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
    pnl: {
      coutTotal,
      plusValueLatente,
      perfPct: Math.round(perfPct * 100) / 100,
    },
    concentrationClientStats: {
      top1: Math.round(top1Client * 10) / 10,
      top5: Math.round(top5Client * 10) / 10,
    },
    diversification: {
      hhi: Math.round(hhi * 1000) / 1000,
      nbEffectif: Math.round(nbEffectif * 10) / 10,
      nbEmetteurs,
    },
    murEcheances: {
      pct12m: Math.round(pct12m * 10) / 10,
      pct24m: Math.round(pct24m * 10) / 10,
      montant12m,
    },
    maturiteMoyenne: Math.round(maturiteMoyenne * 10) / 10,
    encoursParCompte: { moyen: moyenCompte, median: medianCompte },
    activite: {
      collecteNette,
      turnover: Math.round(turnover * 10) / 10,
    },
    partSouveraine: Math.round(partSouveraine * 10) / 10,
    fluxNetMensuel,
    qualite: {
      positionsSansEmetteur,
      partSansEmetteur:
        valorisationTotale > 0
          ? Math.round((valoSansEmetteur / valorisationTotale) * 1000) / 10
          : 0,
      obligSansEcheance,
      obligSansTaux,
      positionsValoNulle,
      integriteEmetteurPct: Math.round(integriteEmetteurPct * 10) / 10,
    },
  };
}
