// -*- coding: utf-8 -*-
// Historique des imports Manar · lit la collection manar_imports (journal de
// chaque migration : fichier, statut, opérations, montant, durée). Affiché à
// droite de l'assistant d'import. Se recharge via `reloadKey`.

import { useCallback, useEffect, useState } from "react";
import { getPocketBase } from "../lib/pocketbase";
import "./import.css";

interface ImportRec {
  id: string;
  file_name: string;
  statut: "EN_COURS" | "REUSSI" | "ECHOUE" | "ANNULE";
  nb_operations: number;
  montant_total_xaf: number;
  completed_at: string;
  duration_ms: number;
  created: string;
}

type State =
  | { kind: "chargement" }
  | { kind: "pret"; rows: ImportRec[] }
  | { kind: "erreur"; message: string };

function fmtDateTime(iso: string): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function fmtMontant(n: number): string {
  if (!n) return "—";
  if (n >= 1e9) return `${(n / 1e9).toFixed(1).replace(".", ",")} Md`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(0)} M`;
  return n.toLocaleString("fr-FR");
}

function statutBadge(statut: ImportRec["statut"]) {
  const map: Record<ImportRec["statut"], { cls: string; texte: string }> = {
    REUSSI: { cls: "histo-pill--ok", texte: "Réussi" },
    ECHOUE: { cls: "histo-pill--echec", texte: "Échoué" },
    ANNULE: { cls: "histo-pill--neutre", texte: "Annulé" },
    EN_COURS: { cls: "histo-pill--cours", texte: "En cours" },
  };
  const { cls, texte } = map[statut] ?? map.EN_COURS;
  return <span className={`histo-pill ${cls}`}>{texte}</span>;
}

export function ImportHistory({ reloadKey = 0 }: { reloadKey?: number }) {
  const [state, setState] = useState<State>({ kind: "chargement" });

  const charger = useCallback(async () => {
    setState({ kind: "chargement" });
    try {
      const pb = await getPocketBase();
      const list = await pb
        .collection("manar_imports")
        .getList(1, 25, { sort: "-created" });
      setState({ kind: "pret", rows: list.items as unknown as ImportRec[] });
    } catch (err) {
      setState({ kind: "erreur", message: String(err) });
    }
  }, []);

  useEffect(() => {
    void charger();
  }, [charger, reloadKey]);

  return (
    <section className="import-history">
      <div className="import-history__head">
        <span className="small-caps">Historique des imports</span>
        {state.kind === "pret" && (
          <span className="import-history__count">{state.rows.length}</span>
        )}
      </div>

      {state.kind === "chargement" && (
        <p className="import-history__empty">Chargement…</p>
      )}

      {state.kind === "erreur" && (
        <p className="import-history__empty">Indisponible : {state.message}</p>
      )}

      {state.kind === "pret" && state.rows.length === 0 && (
        <p className="import-history__empty">
          Aucun import enregistré pour l'instant.
        </p>
      )}

      {state.kind === "pret" && state.rows.length > 0 && (
        <ul className="import-history__list">
          {state.rows.map((r) => (
            <li key={r.id} className="import-history__item">
              <div className="import-history__line">
                <span className="import-history__file" title={r.file_name}>
                  {r.file_name}
                </span>
                {statutBadge(r.statut)}
              </div>
              <div className="import-history__meta">
                <span>{fmtDateTime(r.completed_at || r.created)}</span>
                <span aria-hidden="true">·</span>
                <span>{(r.nb_operations || 0).toLocaleString("fr-FR")} op.</span>
                {r.montant_total_xaf > 0 && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>{fmtMontant(r.montant_total_xaf)} XAF</span>
                  </>
                )}
                {r.duration_ms > 0 && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>{(r.duration_ms / 1000).toFixed(1)} s</span>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
