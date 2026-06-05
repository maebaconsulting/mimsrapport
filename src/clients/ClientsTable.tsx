// -*- coding: utf-8 -*-
// Table autonome des clients consolidés issus de l'import Manar.
// Charge ses propres données et gère recherche + filtre PP/PM. Réutilisée par la
// vue « Clients » (avec bandeau KPI) et par l'écran d'import (après import réussi).

import { useCallback, useEffect, useMemo, useState } from "react";
import { getPocketBase } from "../lib/pocketbase";
import { KpiCard } from "../dashboards/KpiCard";
import { loadClientsData, type ClientRow, type ClientsData } from "./clients-data";
import "../dashboards/dashboards.css";
import "./clients.css";

type Filtre = "tous" | "PP" | "PM";

const PAGE_SIZE_OPTIONS = [15, 30, 50];

type State =
  | { kind: "chargement" }
  | { kind: "pret"; data: ClientsData }
  | { kind: "erreur"; message: string };

function fmtXAF(n: number): string {
  return `${Math.round(n).toLocaleString("fr-FR").replace(/ /g, " ")} XAF`;
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

export interface ClientsTableProps {
  /** Affiche le bandeau d'indicateurs au-dessus de la table (défaut : true). */
  showKpis?: boolean;
  /** Incrémenter cette valeur force un rechargement des données. */
  reloadKey?: number;
}

export function ClientsTable({ showKpis = true, reloadKey = 0 }: ClientsTableProps) {
  const [state, setState] = useState<State>({ kind: "chargement" });
  const [recherche, setRecherche] = useState("");
  const [filtre, setFiltre] = useState<Filtre>("tous");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE_OPTIONS[0]);

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
  }, [charger, reloadKey]);

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

  // Revenir en page 1 quand le filtre, la recherche, la taille de page ou les
  // données changent (évite de rester sur une page désormais vide).
  useEffect(() => {
    setPage(1);
  }, [recherche, filtre, pageSize, reloadKey]);

  const pageCount = Math.max(1, Math.ceil(lignesFiltrees.length / pageSize));
  const pageSure = Math.min(page, pageCount);
  const debut = (pageSure - 1) * pageSize;
  const lignesPage = lignesFiltrees.slice(debut, debut + pageSize);

  if (state.kind === "chargement") {
    return (
      <div className="card">
        <p className="card__lead">Chargement des clients…</p>
      </div>
    );
  }

  if (state.kind === "erreur") {
    return (
      <div className="import-notice import-notice--danger">
        <p>Chargement impossible : {state.message}</p>
      </div>
    );
  }

  if (state.data.totaux.nb_clients === 0) {
    return (
      <div className="import-notice import-notice--warn">
        <p>
          Aucun client. Importez d'abord un fichier Manar pour alimenter cette
          vue.
        </p>
      </div>
    );
  }

  const { data } = state;

  return (
    <div className="clients-view">
      {showKpis && (
        <div className="kpi-row">
          <KpiCard
            tone="yellow"
            label="Clients actifs"
            value={data.totaux.nb_clients.toLocaleString("fr-FR")}
            sub={`${data.totaux.nb_pp} pers. physiques · ${data.totaux.nb_pm} pers. morales`}
          />
          <KpiCard
            tone="sage"
            label="Comptes titres"
            value={data.totaux.nb_comptes.toLocaleString("fr-FR")}
          />
          <KpiCard
            tone="lilac"
            label="Positions"
            value={data.totaux.nb_positions.toLocaleString("fr-FR")}
          />
          <KpiCard
            tone="peach"
            label="Encours total"
            value={fmtCompact(data.totaux.encours_xaf)}
            sub={fmtXAF(data.totaux.encours_xaf)}
          />
        </div>
      )}

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
          {data.totaux.nb_clients.toLocaleString("fr-FR")}
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
              {lignesPage.map((r) => (
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
                  <td className="num data-cell-encours">{fmtXAF(r.encours_xaf)}</td>
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

        {lignesFiltrees.length > 0 && (
          <div className="data-pager">
            <label className="data-pager__size">
              <span>Lignes par page</span>
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
              >
                {PAGE_SIZE_OPTIONS.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>

            <div className="data-pager__nav">
              <span className="data-pager__range">
                {(debut + 1).toLocaleString("fr-FR")}–
                {Math.min(debut + pageSize, lignesFiltrees.length).toLocaleString(
                  "fr-FR",
                )}{" "}
                sur {lignesFiltrees.length.toLocaleString("fr-FR")}
              </span>
              <div className="data-pager__buttons">
                <button
                  className="data-pager__btn"
                  onClick={() => setPage(1)}
                  disabled={pageSure <= 1}
                  aria-label="Première page"
                >
                  «
                </button>
                <button
                  className="data-pager__btn"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={pageSure <= 1}
                  aria-label="Page précédente"
                >
                  ‹
                </button>
                <span className="data-pager__page">
                  Page {pageSure} / {pageCount}
                </span>
                <button
                  className="data-pager__btn"
                  onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                  disabled={pageSure >= pageCount}
                  aria-label="Page suivante"
                >
                  ›
                </button>
                <button
                  className="data-pager__btn"
                  onClick={() => setPage(pageCount)}
                  disabled={pageSure >= pageCount}
                  aria-label="Dernière page"
                >
                  »
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
