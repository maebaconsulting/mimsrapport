// Configuration de la société de bourse (collection PocketBase `parametres_sdb`).
//
// Ces données alimentent les en-têtes et pieds de page de tous les rapports.
// Voir specs/10-CONFIG-SDB.md. Les fonctions pures (interpolation des mentions,
// sélection par date d'effet) sont testées dans parametres-sdb.test.ts.

import type PocketBase from "pocketbase";

/** Famille de mentions légales selon le type de document. */
export type MentionsFamily = "releve" | "declaration" | "facture";

/** Configuration complète d'une SDB (un enregistrement parametres_sdb). */
export interface SdbConfig {
  raison_sociale: string;
  code: string;
  forme_juridique: string;
  capital_social: number;
  devise_capital: string;
  niu: string;
  rccm: string;
  agrement_cosumaf: string;
  date_agrement: string;
  code_member_bvmac: string;
  code_dcr: string;
  bp: string;
  adresse_rue: string;
  ville: string;
  pays: string;
  telephone_principal: string;
  telephone_secondaire: string;
  email_contact: string;
  site_web: string;
  mentions_releve: string;
  mentions_declaration: string;
  mentions_facture: string;
  date_effet_debut: string;
  date_effet_fin: string;
}

/** Identité SDB injectée dans l'en-tête des gabarits. */
export interface SdbHeaderInfo {
  nom: string;
  code: string;
  forme_juridique?: string;
  capital_social?: number;
  devise_capital?: string;
  rccm?: string;
  niu?: string;
  agrement_cosumaf?: string;
  ville?: string;
}

/** Contexte SDB prêt à passer aux services de rapport. */
export interface SdbReportContext {
  sdb: SdbHeaderInfo;
  ville: string;
  logoUrl: string | null;
  mentionsLines: string[];
}

const DEFAULT_MENTIONS_RELEVE =
  "{raison_sociale} · {forme_juridique} au capital de {capital_social} {devise_capital}\n" +
  "RCCM {rccm} · NIU {niu} · Agrément COSUMAF {agrement_cosumaf}\n" +
  "{bp}, {ville}, {pays} · Tél {telephone_principal} · {email_contact}";

const DEFAULT_MENTIONS_DECLARATION =
  "{raison_sociale} · {forme_juridique} · Agrément COSUMAF {agrement_cosumaf}\n" +
  "RCCM {rccm} · NIU {niu} · capital {capital_social} {devise_capital}\n" +
  "Document de reporting réglementaire · marché financier CEMAC / BVMAC";

const DEFAULT_MENTIONS_FACTURE =
  "{raison_sociale} · {forme_juridique} au capital de {capital_social} {devise_capital}\n" +
  "RCCM {rccm} · NIU {niu} · {bp}, {ville}, {pays}";

/**
 * Configuration par défaut (repli). Utilisée si aucun enregistrement n'existe,
 * et comme socle pour compléter les champs manquants d'un enregistrement partiel.
 */
export const DEFAULT_SDB_CONFIG: SdbConfig = {
  raison_sociale: "CCA Bourse",
  code: "CCAB",
  forme_juridique: "Société anonyme",
  capital_social: 1000000000,
  devise_capital: "XAF",
  niu: "",
  rccm: "",
  agrement_cosumaf: "",
  date_agrement: "",
  code_member_bvmac: "",
  code_dcr: "",
  bp: "",
  adresse_rue: "",
  ville: "Douala",
  pays: "Cameroun",
  telephone_principal: "",
  telephone_secondaire: "",
  email_contact: "",
  site_web: "",
  mentions_releve: DEFAULT_MENTIONS_RELEVE,
  mentions_declaration: DEFAULT_MENTIONS_DECLARATION,
  mentions_facture: DEFAULT_MENTIONS_FACTURE,
  date_effet_debut: "",
  date_effet_fin: "",
};

/** Formate un montant entier avec espace insécable (U+00A0) tous les 3 chiffres. */
export function formatCapital(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "";
  const s = Math.round(n).toString();
  return s.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

/** Valeur d'un jeton de mentions ('' si vide ou inconnu). */
function tokenValue(config: SdbConfig, token: string): string {
  switch (token) {
    case "capital_social":
      return formatCapital(config.capital_social);
    case "raison_sociale":
    case "code":
    case "forme_juridique":
    case "devise_capital":
    case "niu":
    case "rccm":
    case "agrement_cosumaf":
    case "date_agrement":
    case "code_member_bvmac":
    case "code_dcr":
    case "bp":
    case "adresse_rue":
    case "ville":
    case "pays":
    case "telephone_principal":
    case "telephone_secondaire":
    case "email_contact":
    case "site_web":
      return String(config[token] ?? "").trim();
    default:
      return "";
  }
}

/**
 * Interpole un modèle de mentions et renvoie les lignes non vides.
 *
 * Règle de propreté : chaque ligne est découpée en segments séparés par « · » ;
 * un segment dont TOUS les jetons sont vides est supprimé (évite « RCCM · NIU »
 * sans valeurs). Les segments de texte statique (sans jeton) sont conservés.
 */
export function interpolateMentions(
  template: string,
  config: SdbConfig,
): string[] {
  if (!template) return [];
  return template
    .split("\n")
    .map((line) => interpolateLine(line, config))
    .filter((line) => line.trim() !== "");
}

function interpolateLine(line: string, config: SdbConfig): string {
  const segments = line.split(" · ");
  const kept: string[] = [];
  for (const seg of segments) {
    const tokens = [...seg.matchAll(/\{(\w+)\}/g)].map((m) => m[1]);
    if (tokens.length > 0 && tokens.every((t) => tokenValue(config, t) === "")) {
      continue; // segment entièrement vide → supprimé
    }
    const rendered = seg
      .replace(/\{(\w+)\}/g, (_, t: string) => tokenValue(config, t))
      .replace(/\s+/g, " ")
      .trim();
    if (rendered !== "") kept.push(rendered);
  }
  return kept.join(" · ");
}

/** Modèle de mentions pour une famille de document. */
export function mentionsTemplateFor(
  config: SdbConfig,
  family: MentionsFamily,
): string {
  if (family === "declaration") return config.mentions_declaration;
  if (family === "facture") return config.mentions_facture;
  return config.mentions_releve;
}

/** Lignes de mentions interpolées pour une famille de document. */
export function buildMentionsLines(
  config: SdbConfig,
  family: MentionsFamily,
): string[] {
  return interpolateMentions(mentionsTemplateFor(config, family), config);
}

/** Identité d'en-tête dérivée de la configuration. */
export function toHeaderInfo(config: SdbConfig): SdbHeaderInfo {
  return {
    nom: config.raison_sociale,
    code: config.code,
    forme_juridique: config.forme_juridique || undefined,
    capital_social: config.capital_social || undefined,
    devise_capital: config.devise_capital || undefined,
    rccm: config.rccm || undefined,
    niu: config.niu || undefined,
    agrement_cosumaf: config.agrement_cosumaf || undefined,
    ville: config.ville || undefined,
  };
}

/** Enregistrement minimal attendu pour la sélection par date d'effet. */
export interface SdbConfigRecordLike {
  date_effet_debut?: string;
  date_effet_fin?: string;
}

/**
 * Choisit l'enregistrement en vigueur à une date donnée : `date_effet_debut`
 * antérieure ou égale à la date, et `date_effet_fin` vide ou postérieure ou égale.
 * En cas d'ambiguïté, le plus récent `date_effet_debut` l'emporte. Si aucun ne
 * couvre la date, on renvoie le plus récent (repli), ou null si la liste est vide.
 * Les dates sont comparées au format ISO (YYYY-MM-DD), comparable lexicalement.
 */
export function pickConfigForDate<T extends SdbConfigRecordLike>(
  records: T[],
  dateISO: string,
): T | null {
  if (records.length === 0) return null;
  const sorted = [...records].sort((a, b) =>
    (a.date_effet_debut ?? "").localeCompare(b.date_effet_debut ?? ""),
  );
  const inEffect = sorted.filter((r) => {
    const debut = r.date_effet_debut ?? "";
    const fin = r.date_effet_fin ?? "";
    const debutOk = debut === "" || debut <= dateISO;
    const finOk = fin === "" || dateISO <= fin;
    return debutOk && finOk;
  });
  if (inEffect.length > 0) return inEffect[inEffect.length - 1];
  return sorted[sorted.length - 1];
}

/** Fusionne un enregistrement PocketBase (partiel) avec les valeurs par défaut. */
export function mergeConfig(
  record: Record<string, unknown> | null,
): SdbConfig {
  if (!record) return { ...DEFAULT_SDB_CONFIG };
  const out = { ...DEFAULT_SDB_CONFIG };
  for (const key of Object.keys(DEFAULT_SDB_CONFIG) as (keyof SdbConfig)[]) {
    const v = record[key];
    if (v === undefined || v === null || v === "") continue;
    if (key === "capital_social") {
      const n = Number(v);
      if (Number.isFinite(n)) out.capital_social = n;
    } else {
      (out[key] as string) = String(v);
    }
  }
  return out;
}

/** Construit l'URL d'un fichier PocketBase sans dépendre de la version du SDK. */
function fileUrl(
  pb: PocketBase,
  record: { id: string; collectionId?: string; collectionName?: string },
  filename: string,
): string {
  const coll = record.collectionId || record.collectionName || "parametres_sdb";
  return `${pb.baseURL}/api/files/${coll}/${record.id}/${filename}`;
}

/**
 * Charge la configuration SDB en vigueur à `dateISO` (défaut : aujourd'hui),
 * et construit le contexte de rapport (identité, ville, logo, mentions).
 *
 * @param family · famille de mentions (relevé par défaut)
 */
export async function buildSdbReportContext(
  pb: PocketBase,
  dateISO: string,
  family: MentionsFamily = "releve",
): Promise<SdbReportContext> {
  let record: Record<string, unknown> | null = null;
  try {
    const list = await pb.collection("parametres_sdb").getFullList();
    const chosen = pickConfigForDate(
      list as unknown as SdbConfigRecordLike[],
      dateISO,
    );
    record = (chosen as unknown as Record<string, unknown>) ?? null;
  } catch {
    record = null; // collection absente ou vide : on retombe sur les défauts
  }

  const config = mergeConfig(record);
  const logoFile =
    record && typeof record.logo === "string" ? (record.logo as string) : "";
  const logoUrl =
    logoFile && record
      ? fileUrl(
          pb,
          record as unknown as { id: string; collectionId?: string },
          logoFile,
        )
      : null;

  return {
    sdb: toHeaderInfo(config),
    ville: config.ville || "Douala",
    logoUrl,
    mentionsLines: buildMentionsLines(config, family),
  };
}
