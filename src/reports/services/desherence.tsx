// -*- coding: utf-8 -*-
// Services de génération · déshérence (CEMAC 02/25 · RG-267).
//  · État des clients en déshérence (échelle société)
//  · Lettre de relance déshérence (par client)
//
// Adaptation desktop · l'inactivité se mesure sur la seule activité titres
// (mouvements issus du fichier d'export). Coupons et espèces ne sont pas connus :
// coupon = 0 (affiché « - »), et le montant à reverser retient la valorisation
// des titres. Seuils par défaut CEMAC, aucune saisie. Rendu webview, double hash.

import { pdf } from "@react-pdf/renderer";
import type PocketBase from "pocketbase";
import { registerPdfFonts } from "../pdf-fonts";
import {
  EtatClientsDesherencePdf,
  type EtatClientsDesherencePdfProps,
} from "../templates/EtatClientsDesherencePdf";
import {
  LettreRelanceDesherencePdf,
  type LettreRelanceDesherencePdfProps,
} from "../templates/LettreRelanceDesherencePdf";
import {
  statutDesherence,
  dateDesherenceIso,
  motifDesherence,
  inclureLigne,
  DEFAULT_DESHERENCE_SEUILS,
} from "../../lib/desherence-compute";
import { buildSdbReportContext } from "../../lib/parametres-sdb";
import {
  composeClientName,
  sha256HexOfBlob,
  type ClientRecord,
} from "./attestation";

export interface DesherenceOutput {
  blob: Blob;
  bytes: Uint8Array;
  hash: string;
  filename: string;
}

const PROVENANCE_ETAT = [
  "Source : positions et mouvements de titres issus du fichier d'export.",
  "Inactivité mesurée sur la seule activité titres (dernier mouvement) — ordres, portail et contacts non disponibles.",
  "Coupons et espèces hors périmètre (affichés « - ») ; montant à reverser = valorisation des titres.",
  `Seuils CEMAC par défaut : inactif ${DEFAULT_DESHERENCE_SEUILS.seuil_inactif_mois} mois, déshérence ${DEFAULT_DESHERENCE_SEUILS.seuil_desherence_ans} ans.`,
];

interface InstrumentLite {
  isin?: string;
  libelle_fr?: string;
  date_echeance?: string;
}

interface PortefeuilleLite {
  client: string;
  code?: string;
  date_ouverture?: string;
}

/** Dernière manifestation titres par client (max date_operation). */
async function dernieresManifestations(
  pb: PocketBase,
): Promise<Map<string, string>> {
  const mvts = await pb.collection("mouvements_titres").getFullList({
    fields: "client,date_operation",
  });
  const max = new Map<string, string>();
  for (const m of mvts) {
    const c = String(m.client);
    const d = m.date_operation as string | undefined;
    if (!d) continue;
    const prev = max.get(c);
    if (!prev || d > prev) max.set(c, d);
  }
  return max;
}

type EtatLigne = EtatClientsDesherencePdfProps["lignes"][number];

/** Construit les lignes de l'état de déshérence (échelle société). */
async function buildEtatLignes(
  pb: PocketBase,
  dateArrete: string,
): Promise<EtatLigne[]> {
  const seuils = DEFAULT_DESHERENCE_SEUILS;
  const manifestations = await dernieresManifestations(pb);

  // Portefeuilles : compte titres + date d'ouverture (repli de référence).
  const portefeuilles = (await pb
    .collection("portefeuilles")
    .getFullList({ fields: "client,code,date_ouverture" })) as unknown as PortefeuilleLite[];
  const pfByClient = new Map<string, PortefeuilleLite>();
  for (const p of portefeuilles) pfByClient.set(String(p.client), p);

  const positions = await pb.collection("positions").getFullList({
    expand: "instrument",
  });

  // Cache des noms de clients (évite de recomposer par position).
  const nameCache = new Map<string, string>();
  async function nomClient(clientId: string): Promise<string> {
    const cached = nameCache.get(clientId);
    if (cached) return cached;
    const client = (await pb
      .collection("clients")
      .getOne(clientId)) as unknown as ClientRecord;
    const nom = await composeClientName(pb, client);
    nameCache.set(clientId, nom);
    return nom;
  }

  const lignes: EtatLigne[] = [];
  for (const p of positions) {
    if (Number(p.quantite_totale) <= 0) continue;
    const clientId = String(p.client);
    const pf = pfByClient.get(clientId);
    const reference = manifestations.get(clientId) ?? pf?.date_ouverture ?? null;
    if (!reference) continue; // aucune référence d'inactivité calculable

    const valorisation = Number(p.valorisation_xaf ?? 0);
    const statut = statutDesherence(reference, dateArrete, seuils);
    if (!inclureLigne(statut, valorisation)) continue;

    const inst = (p.expand?.instrument ?? {}) as InstrumentLite;
    const echeance = inst.date_echeance ?? null;
    const instrumentEchu = !!echeance && echeance < dateArrete;
    const montantInvesti = Number(p.pmp_xaf ?? 0) * Number(p.quantite_totale ?? 0);

    lignes.push({
      nom_client: await nomClient(clientId),
      compte_titres: pf?.code ?? clientId,
      nature_instrument: inst.libelle_fr ?? inst.isin ?? "—",
      date_souscription: null, // non disponible dans le fichier d'export
      date_maturite: echeance,
      montant_investi_xaf: montantInvesti,
      coupon_xaf: 0, // hors périmètre
      montant_a_reverser_xaf: valorisation,
      motif: motifDesherence({ instrumentEchu, couponDu: false }),
      date_desherence: dateDesherenceIso(reference, seuils.seuil_desherence_ans).slice(0, 10),
    });
  }

  lignes.sort((a, b) => b.montant_a_reverser_xaf - a.montant_a_reverser_xaf);
  return lignes;
}

/** Génère l'état des clients en déshérence (double hash + log). */
export async function generateEtatClientsDesherence(
  pb: PocketBase,
  dateArrete: string,
  log = true,
): Promise<DesherenceOutput> {
  registerPdfFonts();
  const ctx = await buildSdbReportContext(pb, dateArrete, "declaration");
  const lignes = await buildEtatLignes(pb, dateArrete);

  const base: Omit<EtatClientsDesherencePdfProps, "hash_sha256"> = {
    sdb: { nom: ctx.sdb.nom, code: ctx.sdb.code, contact: ctx.contact },
    date_arrete: dateArrete,
    seuils: {
      inactif_mois: DEFAULT_DESHERENCE_SEUILS.seuil_inactif_mois,
      desherence_ans: DEFAULT_DESHERENCE_SEUILS.seuil_desherence_ans,
    },
    lignes,
    timestamp_rfc3161_mock: new Date().toISOString(),
    generation_date: new Date().toISOString(),
    provenance: PROVENANCE_ETAT,
  };

  const blob1 = await pdf(
    <EtatClientsDesherencePdf {...base} hash_sha256="" />,
  ).toBlob();
  const hash = await sha256HexOfBlob(blob1);
  const blob = await pdf(
    <EtatClientsDesherencePdf {...base} hash_sha256={hash} />,
  ).toBlob();
  const bytes = new Uint8Array(await blob.arrayBuffer());

  if (log) {
    await pb.collection("exports_log").create({
      type_rapport: "etat_clients_desherence",
      cible: `Société · ${dateArrete} · ${lignes.length} ligne(s)`,
      hash_pdf: hash,
      user: pb.authStore.record?.id ?? null,
    });
  }

  const filename = `etat-clients-desherence-${dateArrete}.pdf`;
  return { blob, bytes, hash, filename };
}

/** Génère la lettre de relance déshérence d'un client (double hash + log). */
export async function generateLettreRelanceDesherence(
  pb: PocketBase,
  clientId: string,
  dateArrete: string,
  log = true,
): Promise<DesherenceOutput> {
  registerPdfFonts();
  const ctx = await buildSdbReportContext(pb, dateArrete, "declaration");
  const client = (await pb
    .collection("clients")
    .getOne(clientId)) as unknown as ClientRecord;
  const nomComplet = await composeClientName(pb, client);

  // Compte titres + dernière manifestation titres du client.
  let numeroCompte = client.code;
  try {
    const pf = (await pb
      .collection("portefeuilles")
      .getFirstListItem(
        pb.filter("client = {:c}", { c: clientId }),
      )) as unknown as PortefeuilleLite;
    numeroCompte = pf.code || client.code;
  } catch {
    /* pas de portefeuille : on garde le code client */
  }

  const manifestations = await dernieresManifestations(pb);
  const derniereManifestation = manifestations.get(clientId) ?? null;

  const base: Omit<LettreRelanceDesherencePdfProps, "hash_sha256"> = {
    sdb: { nom: ctx.sdb.nom, code: ctx.sdb.code },
    client: { nom_complet: nomComplet, adresse: "—", type: client.type },
    numero_compte: numeroCompte,
    derniere_manifestation: derniereManifestation,
    seuil_desherence_ans: DEFAULT_DESHERENCE_SEUILS.seuil_desherence_ans,
    destinataire_transfert: "CDEC",
    date_emission: dateArrete,
    timestamp_rfc3161_mock: new Date().toISOString(),
    ville: ctx.ville,
    mentionsLines: ctx.mentionsLines,
    logoUrl: ctx.logoUrl,
  };

  const blob1 = await pdf(
    <LettreRelanceDesherencePdf {...base} hash_sha256="" />,
  ).toBlob();
  const hash = await sha256HexOfBlob(blob1);
  const blob = await pdf(
    <LettreRelanceDesherencePdf {...base} hash_sha256={hash} />,
  ).toBlob();
  const bytes = new Uint8Array(await blob.arrayBuffer());

  if (log) {
    await pb.collection("exports_log").create({
      type_rapport: "lettre_relance_desherence",
      cible: `${numeroCompte} · ${dateArrete}`,
      hash_pdf: hash,
      user: pb.authStore.record?.id ?? null,
    });
  }

  const filename = `lettre-relance-desherence-${numeroCompte}-${dateArrete}.pdf`;
  return { blob, bytes, hash, filename };
}
