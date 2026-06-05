// -*- coding: utf-8 -*-
// Chargement consolidé des clients importés, pour la vue « Clients ».
// Quatre lectures PocketBase en lot (pas de N+1) : clients, clients_pm,
// portefeuilles, positions. Agrège l'encours et le nombre de positions par
// client, et compose le nom selon le type (PP « prénom nom », PM raison sociale).

import type PocketBase from "pocketbase";
import { withRetry } from "../lib/retry";

export type StatutCompte = "ACTIF" | "SUSPENDU" | "CLOTURE" | "—";

export interface ClientRow {
  id: string;
  code: string;
  nom_complet: string;
  type: "PP" | "PM";
  compte_titres: string;
  statut: StatutCompte;
  date_ouverture: string | null;
  nb_positions: number;
  encours_xaf: number;
}

export interface ClientsData {
  rows: ClientRow[];
  totaux: {
    nb_clients: number;
    nb_pp: number;
    nb_pm: number;
    nb_comptes: number;
    nb_positions: number;
    encours_xaf: number;
  };
}

interface ClientRec {
  id: string;
  code: string;
  type: "PP" | "PM";
  nom?: string;
  prenom?: string;
}

/** Compose le nom : PP « prénom nom », PM raison sociale (repli sur nom/code). */
function composeName(c: ClientRec, raisonSociale: string | undefined): string {
  if (c.type === "PM") return raisonSociale || c.nom || c.code;
  return `${c.prenom ?? ""} ${c.nom ?? ""}`.trim() || c.nom || c.code;
}

/** Charge et consolide la liste des clients importés. */
export async function loadClientsData(pb: PocketBase): Promise<ClientsData> {
  // Réessai sur injoignabilité transitoire du sidecar (status 0), tout le lot.
  const [clients, clientsPm, portefeuilles, positions] = await withRetry(() =>
    Promise.all([
      pb.collection("clients").getFullList({ fields: "id,code,type,nom,prenom" }),
      pb.collection("clients_pm").getFullList({ fields: "client,raison_sociale" }),
      pb
        .collection("portefeuilles")
        .getFullList({ fields: "client,code,statut,date_ouverture" }),
      pb
        .collection("positions")
        .getFullList({ fields: "client,quantite_totale,valorisation_xaf" }),
    ]),
  );

  const pmByClient = new Map<string, string>();
  for (const pm of clientsPm) pmByClient.set(String(pm.client), pm.raison_sociale);

  const pfByClient = new Map<
    string,
    { code: string; statut: StatutCompte; date_ouverture: string | null }
  >();
  for (const p of portefeuilles) {
    pfByClient.set(String(p.client), {
      code: p.code || "—",
      statut: (p.statut as StatutCompte) || "—",
      date_ouverture: (p.date_ouverture as string) || null,
    });
  }

  const aggByClient = new Map<string, { nb: number; encours: number }>();
  for (const pos of positions) {
    if (Number(pos.quantite_totale) <= 0) continue;
    const c = String(pos.client);
    const prev = aggByClient.get(c) ?? { nb: 0, encours: 0 };
    prev.nb += 1;
    prev.encours += Number(pos.valorisation_xaf ?? 0);
    aggByClient.set(c, prev);
  }

  const rows: ClientRow[] = (clients as unknown as ClientRec[]).map((c) => {
    const pf = pfByClient.get(c.id);
    const agg = aggByClient.get(c.id) ?? { nb: 0, encours: 0 };
    return {
      id: c.id,
      code: c.code,
      nom_complet: composeName(c, pmByClient.get(c.id)),
      type: c.type,
      compte_titres: pf?.code ?? "—",
      statut: pf?.statut ?? "—",
      date_ouverture: pf?.date_ouverture ?? null,
      nb_positions: agg.nb,
      encours_xaf: agg.encours,
    };
  });

  // Tri par encours décroissant (les comptes les plus significatifs en tête).
  rows.sort((a, b) => b.encours_xaf - a.encours_xaf);

  const totaux = {
    nb_clients: rows.length,
    nb_pp: rows.filter((r) => r.type === "PP").length,
    nb_pm: rows.filter((r) => r.type === "PM").length,
    nb_comptes: new Set(rows.map((r) => r.compte_titres).filter((c) => c !== "—"))
      .size,
    nb_positions: rows.reduce((s, r) => s + r.nb_positions, 0),
    encours_xaf: rows.reduce((s, r) => s + r.encours_xaf, 0),
  };

  return { rows, totaux };
}
