// -*- coding: utf-8 -*-
// Vue « Clients » · présente les données importées (clients consolidés) en table
// dense avec bandeau d'indicateurs, recherche et filtre PP/PM. Inspiration poste
// de travail MIMS, exécutée avec les tokens MoWoBank.

import { useCallback, useEffect, useMemo, useState } from "react";
import { getPocketBase } from "../lib/pocketbase";
import { KpiCard } from "../dashboards/KpiCard";
import { loadClientsData, type ClientRow, type ClientsData } from "./clients-data";
import "../dashboards/dashboards.css";
import "./clients.css";

type Filtre = "tous" | "PP" | "PM";

type State =
  | { kind: "chargement" }
  | { kind: "pret"; data: ClientsData }
  | { kind: "erreur"; message: string };

function fmtXAF(n: number): string {
  return `${Math.round(n).toLocaleString("fr-FR").replace(/ /g, " ")} XAF`;
}

/** Encours compact en milliards/millions pour les KPI. */
function fmtCompact(n: number): string {
  if (n >= 1e9) return `${(n / 1e9).toFixed(2).replace(".", ",")} Md XAF`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1).replace(".", ",")} M XAF`;
  return fmtXAF(n);
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("fr-FR");
  } catch {
    return iso;
  }
}

function statutPill(statut: ClientRow["statut"]) {
  switch (statut) {
    case "ACTIF":
      return <span className="pill pill--actif">Actif</span>;
    case "SUSPENDU":
      return <span className="pill pill--suspendu">Suspendu</span>;
    case "CLOTURE":
      return <span className="pill pill--cloture">Clôturé</span>;
    default:
      return <span className="pill pill--neutre">—</span>;
  }
}

export function ClientsView() {
  const [state, setState] = useState<State>({ kind: "chargement" });
  const [recherche, setRecherche] = useState("");
  const [filtre, setFiltre] = useState<Filtre>("tous");

  const charger = useCallback(async () => {
    setState({ kind: "chargement" });
    try {
      const pb = await getPocketBase();
      const data = await loadClientsData(pb);
      setState({ kind: "pret", data });
    } catch (err) {
      setState({ kind: "erreur", message: String(err) });
    }
  }, []);

  useEffect(() => {
    void charger();
  }, [charger]);

  const lignesFiltrees = useMemo(() => {
    if (state.kind !== "pret") return [];
    const q = recherche.trim().toLowerCase();
    return state.data.rows.filter((r) => {
      if (filtre !== "tous" && r.type !== filtre) return false;
      if (!q) return true;
      return (
        r.nom_complet.toLowerCase().includes(q) ||
        r.code.toLowerCase().includes(q) ||
        r.compte_titres.toLowerCase().includes(q)
      );
    });
  }, [state, recherche, filtre]);

  return (
    <>
      <header className="app-header">
        <h1 className="app-header__title">Clients</h1>
        <p className="app-header__subtitle">
          Données consolidées issues de l'import Manar · comptes, positions et
          encours par client
        </p>
      </header>

      <section className="app-content">
        {state.kind === "chargement" && (
          <div className="card">
            <p className="card__lead">Chargement des clients…</p>
          </div>
        )}

        {state.kind === "erreur" && (
          <div className="import-notice import-notice--danger">
            <p>Chargement impossible : {state.message}</p>
          </div>
        )}

        {state.kind === "pret" && state.data.totaux.nb_clients === 0 && (
          <div className="import-notice import-notice--warn">
            <p>
              Aucun client. Importez d'abord un fichier Manar pour alimenter
              cette vue.
            </p>
          </div>
        )}

        {state.kind === "pret" && state.data.totaux.nb_clients > 0 && (
          <div className="clients-view">
            <div className="kpi-row">
              <KpiCard
                tone="yellow"
                label="Clients actifs"
                value={state.data.totaux.nb_clients.toLocaleString("fr-FR")}
                sub={`${state.data.totaux.nb_pp} pers. physiques · ${state.data.totaux.nb_pm} pers. morales`}
              />
              <KpiCard
                tone="sage"
                label="Comptes titres"
                value={state.data.totaux.nb_comptes.toLocaleString("fr-FR")}
              />
              <KpiCard
                tone="lilac"
                label="Positions"
                value={state.data.totaux.nb_positions.toLocaleString("fr-FR")}
              />
              <KpiCard
                tone="peach"
                label="Encours total"
                value={fmtCompact(state.data.totaux.encours_xaf)}
                sub={fmtXAF(state.data.totaux.encours_xaf)}
              />
            </div>

            <div className="clients-toolbar">
              <input
                className="clients-search"
                type="search"
                placeholder="Rechercher un client, un code, un compte…"
                value={recherche}
                onChange={(e) => setRecherche(e.target.value)}
              />
              <div className="clients-segment" role="group" aria-label="Filtre par type">
                {(["tous", "PP", "PM"] as Filtre[]).map((f) => (
                  <button
                    key={f}
                    aria-pressed={filtre === f}
                    onClick={() => setFiltre(f)}
                  >
                    {f === "tous" ? "Tous" : f}
                  </button>
                ))}
              </div>
              <span className="clients-count">
                {lignesFiltrees.length.toLocaleString("fr-FR")} sur{" "}
                {state.data.totaux.nb_clients.toLocaleString("fr-FR")}
              </span>
            </div>

            <div className="data-card">
              <div className="data-scroll">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Code</th>
                      <th>Nom</th>
                      <th>Type</th>
                      <th>Compte titres</th>
                      <th className="num">Positions</th>
                      <th className="num">Encours</th>
                      <th>Statut</th>
                      <th>Ouverture</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lignesFiltrees.map((r) => (
                      <tr key={r.id}>
                        <td className="data-cell-code">{r.code}</td>
                        <td className="data-cell-name">{r.nom_complet}</td>
                        <td>
                          <span className={`pill pill--${r.type.toLowerCase()}`}>
                            {r.type}
                          </span>
                        </td>
                        <td className="data-cell-mono">{r.compte_titres}</td>
                        <td className="num">{r.nb_positions}</td>
                        <td className="num data-cell-encours">
                          {fmtXAF(r.encours_xaf)}
                        </td>
                        <td>{statutPill(r.statut)}</td>
                        <td className="data-cell-mono">{fmtDate(r.date_ouverture)}</td>
                      </tr>
                    ))}
                    {lignesFiltrees.length === 0 && (
                      <tr>
                        <td className="data-empty" colSpan={8}>
                          Aucun client ne correspond à la recherche.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </section>
    </>
  );
}
