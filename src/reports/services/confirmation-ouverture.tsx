// Service de génération · Confirmation d'ouverture de compte titres (lettre).
// Per-client, sur le patron de l'attestation : requête PocketBase (client +
// portefeuille), contexte SDB versionné par date d'arrêté, double passe de hash,
// journal exports_log. Rendu webview (pdf().toBlob()), sans sdb_id ni RLS.

import { pdf } from "@react-pdf/renderer";
import type PocketBase from "pocketbase";
import { registerPdfFonts } from "../pdf-fonts";
import {
  ConfirmationOuverturePdf,
  type ConfirmationOuverturePdfProps,
} from "../templates/ConfirmationOuverturePdf";
import { buildSdbReportContext } from "../../lib/parametres-sdb";
import {
  composeClientName,
  sha256HexOfBlob,
  type ClientRecord,
} from "./attestation";

export interface ConfirmationOuvertureOutput {
  blob: Blob;
  bytes: Uint8Array;
  hash: string;
  filename: string;
}

/** Record `portefeuilles` (champs utilisés ici). */
interface PortefeuilleRecord {
  code: string;
  date_ouverture?: string;
}

/** Construit les props (hors hash) de la confirmation d'ouverture d'un client. */
async function buildBaseProps(
  pb: PocketBase,
  clientId: string,
  dateArrete: string,
): Promise<Omit<ConfirmationOuverturePdfProps, "hash_sha256">> {
  const client = (await pb
    .collection("clients")
    .getOne(clientId)) as unknown as ClientRecord;
  const nomComplet = await composeClientName(pb, client);

  // Portefeuille : numéro de compte + date d'ouverture réelle si disponibles.
  let numeroCompte = client.code;
  let dateOuverture = dateArrete;
  try {
    const portefeuille = (await pb
      .collection("portefeuilles")
      .getFirstListItem(
        pb.filter("client = {:c}", { c: clientId }),
      )) as unknown as PortefeuilleRecord;
    numeroCompte = portefeuille.code || client.code;
    if (portefeuille.date_ouverture) dateOuverture = portefeuille.date_ouverture;
  } catch {
    /* pas de portefeuille : on retombe sur le code client et la date d'arrêté */
  }

  // Configuration SDB en vigueur à la date d'arrêté → en-tête + mentions du pied.
  const ctx = await buildSdbReportContext(pb, dateArrete, "releve");

  return {
    sdb: { nom: ctx.sdb.nom, code: ctx.sdb.code },
    client: {
      nom_complet: nomComplet,
      // Le schéma clients n'expose pas d'adresse postale : repli neutre.
      adresse: "—",
      type: client.type,
    },
    numero_compte: numeroCompte,
    date_ouverture: dateOuverture,
    date_emission: dateArrete,
    timestamp_rfc3161_mock: new Date().toISOString(),
    ville: ctx.ville,
    mentionsLines: ctx.mentionsLines,
    logoUrl: ctx.logoUrl,
  };
}

/** Génère la confirmation d'ouverture PDF d'un client (double hash + log). */
export async function generateConfirmationOuverture(
  pb: PocketBase,
  clientId: string,
  dateArrete: string,
): Promise<ConfirmationOuvertureOutput> {
  registerPdfFonts();
  const base = await buildBaseProps(pb, clientId, dateArrete);

  // Double passe : le hash imprimé dans le pied doit être celui du document final.
  const blob1 = await pdf(
    <ConfirmationOuverturePdf {...base} hash_sha256="" />,
  ).toBlob();
  const hash = await sha256HexOfBlob(blob1);
  const blob = await pdf(
    <ConfirmationOuverturePdf {...base} hash_sha256={hash} />,
  ).toBlob();
  const bytes = new Uint8Array(await blob.arrayBuffer());

  await pb.collection("exports_log").create({
    type_rapport: "confirmation_ouverture",
    cible: `${base.numero_compte} · ${dateArrete}`,
    hash_pdf: hash,
    user: pb.authStore.record?.id ?? null,
  });

  const filename = `confirmation-ouverture-${base.numero_compte}-${dateArrete}.pdf`;
  return { blob, bytes, hash, filename };
}
