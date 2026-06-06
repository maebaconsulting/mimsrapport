// Chargement des données de tableau de bord depuis PocketBase et normalisation
// vers la forme attendue par l'agrégateur pur (aggregator.ts).

import type PocketBase from "pocketbase";
import type { DashMouvement, DashPosition } from "./aggregator";

interface EmetteurLite {
  id?: string;
  nom?: string;
  type?: "CORPORATE" | "SOUVERAIN";
}
interface InstrumentLite {
  type?: "ACTION" | "OBLIGATION" | "OPC";
  taux_interet?: number | null;
  date_echeance?: string | null;
  expand?: { emetteur?: EmetteurLite };
}
interface ClientLite {
  id?: string;
  code?: string;
  type?: "PP" | "PM";
  nom?: string;
  prenom?: string;
}

function clientNom(c: ClientLite): string {
  if (c.type === "PM") return c.nom || c.code || "Client";
  return `${c.prenom ?? ""} ${c.nom ?? ""}`.trim() || c.code || "Client";
}

export interface DashboardData {
  positions: DashPosition[];
  mouvements: DashMouvement[];
}

/** Charge et normalise positions + mouvements pour les tableaux de bord. */
export async function loadDashboardData(
  pb: PocketBase,
): Promise<DashboardData> {
  const positionsRaw = await pb.collection("positions").getFullList({
    expand: "client,instrument,instrument.emetteur",
  });

  const positions: DashPosition[] = positionsRaw.map((p) => {
    const client = (p.expand?.client ?? {}) as ClientLite;
    const instrument = (p.expand?.instrument ?? {}) as InstrumentLite;
    const emetteur = (instrument.expand?.emetteur ?? {}) as EmetteurLite;
    return {
      client_id: client.id ?? p.client,
      client_code: client.code ?? "—",
      client_nom: clientNom(client),
      client_type: client.type ?? "PP",
      emetteur_id: emetteur.id ?? null,
      emetteur_nom: emetteur.nom ?? "Inconnu",
      emetteur_type: emetteur.type ?? null,
      instrument_type: instrument.type ?? "OBLIGATION",
      taux_interet: instrument.taux_interet ?? null,
      date_echeance: instrument.date_echeance ?? null,
      quantite: Number(p.quantite_totale ?? 0),
      valorisation_xaf: Number(p.valorisation_xaf ?? 0),
      pmp_xaf: Number(p.pmp_xaf ?? 0),
    };
  });

  const mouvementsRaw = await pb.collection("mouvements_titres").getFullList();
  const mouvements: DashMouvement[] = mouvementsRaw.map((m) => ({
    sens: m.sens,
    date_operation: m.date_operation ?? null,
    montant_xaf: Number(m.quantite ?? 0) * Number(m.prix_unitaire_xaf ?? 0),
  }));

  return { positions, mouvements };
}
