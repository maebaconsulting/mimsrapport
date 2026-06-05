// Service de génération · Attestation de portefeuille de titres.
// Porté du patron MIMS app/_actions/attestation-pdf.ts, adapté au rendu webview
// (pdf().toBlob()) et à PocketBase (sans sdb_id ni RLS).
//
// Étapes : requête des données → composition du nom PP/PM → double passe de hash
// (stabilité du hash imprimé) → journalisation exports_log → retour du Blob.

import { pdf } from "@react-pdf/renderer";
import type PocketBase from "pocketbase";
import { registerPdfFonts } from "../pdf-fonts";
import {
  AttestationPortefeuillePdf,
  type AttestationPortefeuillePdfProps,
} from "../templates/AttestationPortefeuillePdf";
import { buildSdbReportContext } from "../../lib/parametres-sdb";

export interface ClientChoice {
  id: string;
  code: string;
  type: "PP" | "PM";
  nom_complet: string;
  nb_positions: number;
}

/** Champs d'un record `clients` utilisés ici (PocketBase renvoie un RecordModel). */
interface ClientRecord {
  id: string;
  code: string;
  type: "PP" | "PM";
  nom?: string;
  prenom?: string;
}

export interface AttestationOutput {
  blob: Blob;
  bytes: Uint8Array;
  hash: string;
  filename: string;
  clientLabel: string;
}

/** Hash SHA-256 (hex) d'un Blob via WebCrypto. */
export async function sha256HexOfBlob(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Liste les clients disposant d'au moins une position, pour le sélecteur. */
export async function listClientsWithPositions(
  pb: PocketBase,
): Promise<ClientChoice[]> {
  const positions = await pb.collection("positions").getFullList({
    fields: "client",
  });
  const counts = new Map<string, number>();
  for (const p of positions) {
    counts.set(p.client, (counts.get(p.client) ?? 0) + 1);
  }
  const ids = [...counts.keys()];
  if (ids.length === 0) return [];

  const choices: ClientChoice[] = [];
  for (const id of ids) {
    const c = (await pb.collection("clients").getOne(id)) as unknown as ClientRecord;
    choices.push({
      id,
      code: c.code,
      type: c.type,
      nom_complet: await composeClientName(pb, c),
      nb_positions: counts.get(id) ?? 0,
    });
  }
  choices.sort((a, b) => a.nom_complet.localeCompare(b.nom_complet, "fr"));
  return choices;
}

/** Champs d'un record `clients` utilisés par les services de rapport. */
export type { ClientRecord };

/** Compose le nom du client : PP « prénom nom », PM raison sociale (clients_pm). */
export async function composeClientName(
  pb: PocketBase,
  client: ClientRecord,
): Promise<string> {
  if (client.type === "PM") {
    try {
      const pm = await pb
        .collection("clients_pm")
        .getFirstListItem(pb.filter("client = {:c}", { c: client.id }));
      return pm.raison_sociale || client.nom || "Client";
    } catch {
      return client.nom || "Client";
    }
  }
  return `${client.prenom ?? ""} ${client.nom ?? ""}`.trim() || "Client";
}

/** Construit les props (hors hash) du gabarit d'attestation pour un client. */
async function buildBaseProps(
  pb: PocketBase,
  clientId: string,
  dateArrete: string,
): Promise<Omit<AttestationPortefeuillePdfProps, "hash_sha256">> {
  const client = (await pb
    .collection("clients")
    .getOne(clientId)) as unknown as ClientRecord;
  const nomComplet = await composeClientName(pb, client);

  const positions = await pb.collection("positions").getFullList({
    filter: pb.filter("client = {:c}", { c: clientId }),
    expand: "instrument",
  });

  const lignes = positions
    .filter((p) => Number(p.quantite_totale) > 0)
    .map((p) => {
      const inst = p.expand?.instrument as
        | { libelle_fr?: string; isin?: string }
        | undefined;
      return {
        libelle: inst?.libelle_fr || inst?.isin || "—",
        quantite: Number(p.quantite_totale),
        valorisation_xaf: Number(p.valorisation_xaf ?? 0),
      };
    })
    .sort((a, b) => b.valorisation_xaf - a.valorisation_xaf);

  let numeroCompte = client.code;
  try {
    const portefeuille = await pb
      .collection("portefeuilles")
      .getFirstListItem(pb.filter("client = {:c}", { c: clientId }));
    numeroCompte = portefeuille.code || client.code;
  } catch {
    /* pas de portefeuille : on garde le code client */
  }

  // Configuration SDB en vigueur à la date d'arrêté → en-tête + mentions du pied.
  const ctx = await buildSdbReportContext(pb, dateArrete, "releve");

  return {
    sdb: {
      nom: ctx.sdb.nom,
      code: ctx.sdb.code,
      agrement_cosumaf: ctx.sdb.agrement_cosumaf,
      rccm: ctx.sdb.rccm,
      niu: ctx.sdb.niu,
    },
    client: { code: client.code, nom_complet: nomComplet, type: client.type },
    numero_compte: numeroCompte,
    date_arrete: dateArrete,
    lignes,
    timestamp_rfc3161_mock: new Date().toISOString(),
    ville: ctx.ville,
    mentionsLines: ctx.mentionsLines,
    logoUrl: ctx.logoUrl,
  };
}

/**
 * Génère l'attestation PDF d'un client (double passe de hash + log export).
 *
 * @param dateArrete · date d'arrêté ISO (YYYY-MM-DD)
 */
export async function generateAttestation(
  pb: PocketBase,
  clientId: string,
  dateArrete: string,
): Promise<AttestationOutput> {
  registerPdfFonts();

  const base = await buildBaseProps(pb, clientId, dateArrete);

  // Double passe : le hash imprimé dans le pied doit être celui du document.
  const blob1 = await pdf(
    <AttestationPortefeuillePdf {...base} hash_sha256="" />,
  ).toBlob();
  const hash = await sha256HexOfBlob(blob1);
  const blob = await pdf(
    <AttestationPortefeuillePdf {...base} hash_sha256={hash} />,
  ).toBlob();
  const bytes = new Uint8Array(await blob.arrayBuffer());

  // Journalisation AVANT remise du fichier (traçabilité, équivalent auditLogger).
  await pb.collection("exports_log").create({
    type_rapport: "attestation_portefeuille",
    cible: `${base.client.code} · ${dateArrete}`,
    hash_pdf: hash,
    user: pb.authStore.record?.id ?? null,
  });

  const filename = `attestation-portefeuille-${base.client.code}-${dateArrete}.pdf`;
  return { blob, bytes, hash, filename, clientLabel: base.client.nom_complet };
}
