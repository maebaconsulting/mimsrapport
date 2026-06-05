// Service de génération · Relevé de compte-titres.
// Dérive positions + mouvements + synthèse d'un client depuis PocketBase, rend le
// gabarit (build navigateur), double passe de hash, journal exports_log.

import { pdf } from "@react-pdf/renderer";
import type PocketBase from "pocketbase";
import { registerPdfFonts } from "../pdf-fonts";
import {
  ReleveCompteTitresPdf,
  type ReleveCompteTitresPdfProps,
} from "../templates/ReleveCompteTitresPdf";
import { SDB_IDENTITY } from "../../lib/config";
import {
  composeClientName,
  sha256HexOfBlob,
  type ClientRecord,
} from "./attestation";

export interface ReleveOutput {
  blob: Blob;
  bytes: Uint8Array;
  hash: string;
  filename: string;
}

interface InstrumentLite {
  isin?: string;
  libelle_fr?: string;
  categorie?: string;
  devise?: string;
}

function sensReleve(sens: string): "ACHAT" | "VENTE" | "OST" {
  if (sens === "VENTE") return "VENTE";
  if (sens === "ACHAT") return "ACHAT";
  return "OST"; // OST_ENTREE / OST_SORTIE
}

async function buildBaseProps(
  pb: PocketBase,
  clientId: string,
  dateArrete: string,
): Promise<Omit<ReleveCompteTitresPdfProps, "hash_sha256">> {
  const client = (await pb
    .collection("clients")
    .getOne(clientId)) as unknown as ClientRecord;
  const nomComplet = await composeClientName(pb, client);

  const positionsRaw = await pb.collection("positions").getFullList({
    filter: pb.filter("client = {:c}", { c: clientId }),
    expand: "instrument",
  });

  const positions = positionsRaw
    .filter((p) => Number(p.quantite_totale) > 0)
    .map((p) => {
      const inst = (p.expand?.instrument ?? {}) as InstrumentLite;
      return {
        isin: inst.isin ?? "—",
        libelle: inst.libelle_fr ?? inst.isin ?? "—",
        classe: inst.categorie ?? "—",
        quantite: Number(p.quantite_totale),
        prix_moyen_pondere: Number(p.pmp_xaf ?? 0),
        valorisation_xaf: Number(p.valorisation_xaf ?? 0),
        devise: inst.devise ?? "XAF",
      };
    });

  const mouvementsRaw = await pb.collection("mouvements_titres").getFullList({
    filter: pb.filter("client = {:c}", { c: clientId }),
    expand: "instrument",
    sort: "date_operation",
  });

  const mouvements = mouvementsRaw.map((m) => {
    const inst = (m.expand?.instrument ?? {}) as InstrumentLite;
    const quantite = Number(m.quantite ?? 0);
    const prix = Number(m.prix_unitaire_xaf ?? 0);
    return {
      date: m.date_operation ?? dateArrete,
      libelle: inst.libelle_fr ?? inst.isin ?? "—",
      isin: inst.isin ?? "—",
      sens: sensReleve(m.sens),
      quantite,
      prix,
      montant_xaf: quantite * prix,
    };
  });

  // Période : amplitude des dates de mouvements, sinon la date d'arrêté.
  const dates = mouvements.map((m) => m.date).filter(Boolean).sort();
  const debut = dates[0] ?? dateArrete;
  const fin = dates[dates.length - 1] ?? dateArrete;

  const valorisationFin = positions.reduce(
    (s, p) => s + p.valorisation_xaf,
    0,
  );

  return {
    sdb: { nom: SDB_IDENTITY.nom, code: SDB_IDENTITY.code },
    client: {
      code: client.code,
      nom_complet: nomComplet,
      type: client.type,
      nationalite: "—",
      adresse: "—",
    },
    periode: { debut, fin },
    iban_mock: `XAF-${client.code}`,
    positions,
    mouvements,
    synthese: {
      valorisation_debut: null,
      valorisation_fin: valorisationFin,
      gain_perte: 0,
      frais_collectes: 0,
    },
    timestamp_rfc3161_mock: new Date().toISOString(),
    ville: SDB_IDENTITY.ville,
  };
}

/** Génère le relevé de compte-titres PDF d'un client (double hash + log). */
export async function generateReleve(
  pb: PocketBase,
  clientId: string,
  dateArrete: string,
): Promise<ReleveOutput> {
  registerPdfFonts();
  const base = await buildBaseProps(pb, clientId, dateArrete);

  const blob1 = await pdf(
    <ReleveCompteTitresPdf {...base} hash_sha256="" />,
  ).toBlob();
  const hash = await sha256HexOfBlob(blob1);
  const blob = await pdf(
    <ReleveCompteTitresPdf {...base} hash_sha256={hash} />,
  ).toBlob();
  const bytes = new Uint8Array(await blob.arrayBuffer());

  await pb.collection("exports_log").create({
    type_rapport: "releve_compte_titres",
    cible: `${base.client.code} · ${dateArrete}`,
    hash_pdf: hash,
    user: pb.authStore.record?.id ?? null,
  });

  const filename = `releve-compte-titres-${base.client.code}-${dateArrete}.pdf`;
  return { blob, bytes, hash, filename };
}
