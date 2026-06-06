// -*- coding: utf-8 -*-
// Services de génération · états réglementaires COSUMAF (RG-273).
//  · Transactions boursières (obligation 12) ← mouvements_titres (ACHAT/VENTE)
//  · Situation des avoirs (obligation 15)   ← positions valorisées
//
// Ces états sont produits à l'échelle de la société (pas par client). L'app
// desktop ne disposant que des données de l'import Manar, certaines dimensions
// COSUMAF ne sont pas couvertes : on les marque honnêtement via une bannière de
// provenance et on ne fabrique aucune saisie (espèces = 0, catégorie = CLIENTELE,
// OST et exécutions d'ordres hors périmètre). Rendu webview, double hash, log.

import { pdf } from "@react-pdf/renderer";
import type PocketBase from "pocketbase";
import { registerPdfFonts } from "../pdf-fonts";
import {
  TransactionsBoursieresPdf,
  type CosumafDonneesJsonb,
} from "../templates/cosumaf/TransactionsBoursieresPdf";
import { SituationAvoirsPdf } from "../templates/cosumaf/SituationAvoirsPdf";
import type { CosumafPdfShellProps } from "../templates/cosumaf/CosumafPdfShell";
import {
  computeTransactionsBoursieres,
  computeSituationAvoirs,
  type TransactionRow,
  type AvoirRow,
} from "../../lib/cosumaf-compute";
import { buildSdbReportContext } from "../../lib/parametres-sdb";
import { sha256HexOfBlob } from "./attestation";

export interface CosumafOutput {
  blob: Blob;
  bytes: Uint8Array;
  hash: string;
  filename: string;
}

const AUTORITE =
  "COSUMAF · Commission de surveillance du marché financier de l'Afrique centrale";

type ShellBase = Omit<
  CosumafPdfShellProps,
  "children" | "titre" | "regulation_ref" | "hash_sha256"
>;

/** Mois ISO (YYYY-MM) de la date d'arrêté + libellé français (« avril 2026 »). */
function periodeDepuisDate(dateArrete: string): { ym: string; libelle: string } {
  const ym = dateArrete.slice(0, 7);
  let libelle = ym;
  try {
    libelle = new Date(`${ym}-01T00:00:00Z`).toLocaleDateString("fr-FR", {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    });
  } catch {
    /* repli sur YYYY-MM */
  }
  return { ym, libelle };
}

/** Construit la base du shell COSUMAF depuis la configuration SDB en vigueur. */
async function buildShellBase(
  pb: PocketBase,
  dateArrete: string,
  provenance: string[],
): Promise<{ shell: ShellBase; ctxCode: string; periode: ReturnType<typeof periodeDepuisDate> }> {
  const ctx = await buildSdbReportContext(pb, dateArrete, "declaration");
  const periode = periodeDepuisDate(dateArrete);
  return {
    ctxCode: ctx.sdb.code,
    periode,
    shell: {
      sdb_code: ctx.sdb.code,
      sdb_nom: ctx.sdb.nom,
      sdb_agrement: ctx.sdb.agrement_cosumaf,
      periode_libelle: periode.libelle,
      version: 1,
      timestamp_rfc3161_mock: new Date().toISOString(),
      autorite_emettrice: AUTORITE,
      mentionsLines: ctx.mentionsLines,
      logoUrl: ctx.logoUrl,
      provenance,
    },
  };
}

interface InstrumentLite {
  isin?: string;
  libelle_fr?: string;
}

// ---------------------------------------------------------------------------
// Obligation 12 · Transactions boursières
// ---------------------------------------------------------------------------

const PROVENANCE_TRANSACTIONS = [
  "Source : mouvements de titres issus du fichier d'export, sens ACHAT et VENTE.",
  "Hors périmètre (non disponible dans le fichier d'export) : exécutions d'ordres détaillées, opérations sur titres (OST), frais.",
  "Montant estimé par quantité × prix unitaire du mouvement.",
];

async function buildTransactionsDonnees(
  pb: PocketBase,
  sdbCode: string,
  periode: { ym: string; libelle: string },
): Promise<CosumafDonneesJsonb> {
  // Mouvements du mois de la date d'arrêté (bornes du mois civil).
  const debut = `${periode.ym}-01`;
  const finExclue = moisSuivant(periode.ym);
  const rows = await pb.collection("mouvements_titres").getFullList({
    filter: pb.filter("date_operation >= {:d} && date_operation < {:f}", {
      d: debut,
      f: finExclue,
    }),
    expand: "instrument",
    sort: "date_operation",
  });

  const transactions: TransactionRow[] = rows
    .filter((m) => m.sens === "ACHAT" || m.sens === "VENTE")
    .map((m) => {
      const inst = (m.expand?.instrument ?? {}) as InstrumentLite;
      const quantite = Number(m.quantite ?? 0);
      const prix = Number(m.prix_unitaire_xaf ?? 0);
      return {
        isin: inst.isin ?? "—",
        libelle_titre: inst.libelle_fr ?? inst.isin ?? "—",
        sens: m.sens as "ACHAT" | "VENTE",
        quantite,
        montant_xaf: quantite * prix,
      };
    });

  const section = computeTransactionsBoursieres(transactions, periode.libelle);

  return {
    periode: periode.ym,
    sdb_code: sdbCode,
    meta: {
      computed_at: new Date().toISOString(),
      sources: ["import_manar:mouvements_titres"],
      version: 1,
    },
    sections: { transactions_boursieres: section },
  };
}

/** Génère l'état COSUMAF des transactions boursières (obligation 12). */
export async function generateTransactionsBoursieres(
  pb: PocketBase,
  dateArrete: string,
  log = true,
): Promise<CosumafOutput> {
  registerPdfFonts();
  const { shell, ctxCode, periode } = await buildShellBase(
    pb,
    dateArrete,
    PROVENANCE_TRANSACTIONS,
  );
  const donnees = await buildTransactionsDonnees(pb, ctxCode, periode);

  const blob1 = await pdf(
    <TransactionsBoursieresPdf shell={{ ...shell, hash_sha256: "" }} donnees={donnees} />,
  ).toBlob();
  const hash = await sha256HexOfBlob(blob1);
  const blob = await pdf(
    <TransactionsBoursieresPdf shell={{ ...shell, hash_sha256: hash }} donnees={donnees} />,
  ).toBlob();
  const bytes = new Uint8Array(await blob.arrayBuffer());

  if (log) {
    await pb.collection("exports_log").create({
      type_rapport: "cosumaf_transactions_boursieres",
      cible: `Société · ${periode.ym}`,
      hash_pdf: hash,
      user: pb.authStore.record?.id ?? null,
    });
  }

  const filename = `cosumaf-transactions-boursieres-${periode.ym}.pdf`;
  return { blob, bytes, hash, filename };
}

// ---------------------------------------------------------------------------
// Obligation 15 · Situation des avoirs
// ---------------------------------------------------------------------------

const PROVENANCE_AVOIRS = [
  "Source : positions valorisées issues du fichier d'export, à la date d'arrêté.",
  "Catégorisation : tous les comptes sont rattachés à « Clientèle » — Dirigeants et Personnel non renseignés dans le fichier d'export.",
  "Hors périmètre : soldes espèces non disponibles, fixés à 0.",
];

async function buildAvoirsDonnees(
  pb: PocketBase,
  sdbCode: string,
  periode: { ym: string; libelle: string },
): Promise<CosumafDonneesJsonb> {
  const positions = await pb.collection("positions").getFullList({
    fields: "client,quantite_totale,valorisation_xaf",
  });

  // 1 portefeuille par client : le client tient lieu d'identifiant de compte.
  const avoirs: AvoirRow[] = positions
    .filter((p) => Number(p.quantite_totale) > 0)
    .map((p) => ({
      categorie: "CLIENTELE",
      compte_titres_id: String(p.client),
      valorisation_titres_xaf: Number(p.valorisation_xaf ?? 0),
      solde_especes_xaf: 0,
    }));

  const section = computeSituationAvoirs(avoirs, periode.libelle);

  return {
    periode: periode.ym,
    sdb_code: sdbCode,
    meta: {
      computed_at: new Date().toISOString(),
      sources: ["import_manar:positions"],
      version: 1,
    },
    sections: { situation_avoirs: section },
  };
}

/** Génère l'état COSUMAF de la situation des avoirs (obligation 15). */
export async function generateSituationAvoirs(
  pb: PocketBase,
  dateArrete: string,
  log = true,
): Promise<CosumafOutput> {
  registerPdfFonts();
  const { shell, ctxCode, periode } = await buildShellBase(
    pb,
    dateArrete,
    PROVENANCE_AVOIRS,
  );
  const donnees = await buildAvoirsDonnees(pb, ctxCode, periode);

  const blob1 = await pdf(
    <SituationAvoirsPdf shell={{ ...shell, hash_sha256: "" }} donnees={donnees} />,
  ).toBlob();
  const hash = await sha256HexOfBlob(blob1);
  const blob = await pdf(
    <SituationAvoirsPdf shell={{ ...shell, hash_sha256: hash }} donnees={donnees} />,
  ).toBlob();
  const bytes = new Uint8Array(await blob.arrayBuffer());

  if (log) {
    await pb.collection("exports_log").create({
      type_rapport: "cosumaf_situation_avoirs",
      cible: `Société · ${periode.ym}`,
      hash_pdf: hash,
      user: pb.authStore.record?.id ?? null,
    });
  }

  const filename = `cosumaf-situation-avoirs-${periode.ym}.pdf`;
  return { blob, bytes, hash, filename };
}

/** Premier jour du mois suivant (borne haute exclusive), format YYYY-MM-DD. */
function moisSuivant(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  const ny = m === 12 ? y + 1 : y;
  const nm = m === 12 ? 1 : m + 1;
  return `${ny}-${String(nm).padStart(2, "0")}-01`;
}
