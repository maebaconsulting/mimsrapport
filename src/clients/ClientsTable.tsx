// -*- coding: utf-8 -*-
// Table autonome des clients consolidés issus du dernier import.
// Charge ses propres données et gère recherche + filtre PP/PM. Réutilisée par la
// vue « Clients » (avec bandeau KPI) et par l'écran d'import (après import réussi).

import { useCallback, useEffect, useMemo, useState } from "react";
import { getPocketBase } from "../lib/pocketbase";
import { useRefreshOnSignal } from "../lib/refresh";
import { KpiCard } from "../dashboards/KpiCard";
import { loadClientsData, type ClientRow, type ClientsData } from "./clients-data";
import { LoadingState, ErrorState } from "../ui/states";
import { useT, useLocale, type TFunc, type TKey } from "../i18n";
import "../dashboards/dashboards.css";
import "./clients.css";

type Filtre = "tous" | "PP" | "PM";

type SortKey =
  | "code"
  | "nom_complet"
  | "type"
  | "compte_titres"
  | "nb_positions"
  | "encours_xaf"
  | "statut"
  | "date_ouverture";

/** Colonnes triables de la table (clé de libellé i18n, clé de tri, alignement, type). */
const COLUMNS: Array<{
  key: SortKey;
  labelKey: TKey;
  num?: boolean;
  numeric?: boolean;
}> = [
  { key: "code", labelKey: "clients.col-code" },
  { key: "nom_complet", labelKey: "clients.col-nom" },
  { key: "type", labelKey: "clients.col-type" },
  { key: "compte_titres", labelKey: "clients.col-compte-titres" },
  { key: "nb_positions", labelKey: "clients.col-positions", num: true, numeric: true },
  { key: "encours_xaf", labelKey: "clients.col-encours", num: true, numeric: true },
  { key: "statut", labelKey: "clients.col-statut" },
  { key: "date_ouverture", labelKey: "clients.col-ouverture" },
];

type SortState = { key: SortKey; dir: "asc" | "desc" };

const PAGE_SIZE_OPTIONS = [15, 30, 50];

type State =
  | { kind: "chargement" }
  | { kind: "pret"; data: ClientsData }
  | { kind: "erreur"; message: string };

function fmtXAF(n: number, locale: string): string {
  return `${Math.round(n).toLocaleString(locale)} XAF`;
}

/** Encours compact en milliards/millions pour les KPI. */
function fmtCompact(n: number, locale: string): string {
  if (n >= 1e9) return `${(n / 1e9).toFixed(2).replace(".", ",")} Md XAF`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1).replace(".", ",")} M XAF`;
  return fmtXAF(n, locale);
}

function fmtDate(iso: string | null, locale: string): string {
  if (!iso) return "-";
  try {
    return new Date(iso).toLocaleDateString(locale);
  } catch {
    return iso;
  }
}

function statutPill(statut: ClientRow["statut"], t: TFunc) {
  switch (statut) {
    case "ACTIF":
      return <span className="pill pill--actif">{t("clients.statut-actif")}</span>;
    case "SUSPENDU":
      return <span className="pill pill--suspendu">{t("clients.statut-suspendu")}</span>;
    case "CLOTURE":
      return <span className="pill pill--cloture">{t("clients.statut-cloture")}</span>;
    default:
      return <span className="pill pill--neutre">-</span>;
  }
}

export interface ClientsTableProps {
  /** Affiche le bandeau d'indicateurs au-dessus de la table (défaut : true). */
  showKpis?: boolean;
  /** Incrémenter cette valeur force un rechargement des données. */
  reloadKey?: number;
  /**
   * Si fourni, ajoute une colonne d'action « Générer un rapport » par ligne
   * (pour les clients ayant au moins une position). Reçoit l'id du client.
   */
  onGenerateReport?: (clientId: string) => void;
  /**
   * Si fourni, rend le nom du client cliquable pour ouvrir sa fiche de contact.
   */
  onOpenClient?: (clientId: string, clientName: string) => void;
}

export function ClientsTable({
  showKpis = true,
  reloadKey = 0,
  onGenerateReport,
  onOpenClient,
}: ClientsTableProps) {
  const t = useT();
  const locale = useLocale();
  /** Libellé complet d'un type de client (PP/PM) pour les infobulles. */
  const typeLabel = (type: "PP" | "PM") =>
    type === "PP" ? t("clients.type-pp") : t("clients.type-pm");
  const [state, setState] = useState<State>({ kind: "chargement" });
  const [recherche, setRecherche] = useState("");
  const [filtre, setFiltre] = useState<Filtre>("tous");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE_OPTIONS[0]);
  // Filtre « clients apparus lors du dernier import ».
  const [nouveauxSeulement, setNouveauxSeulement] = useState(false);
  // Tri par défaut : encours décroissant (cohérent avec le tri initial des données).
  const [sort, setSort] = useState<SortState>({ key: "encours_xaf", dir: "desc" });

  function trier(key: SortKey) {
    setSort((s) => {
      if (s.key === key) return { key, dir: s.dir === "asc" ? "desc" : "asc" };
      // Premier clic : numérique → décroissant, texte → croissant.
      const numeric = COLUMNS.find((c) => c.key === key)?.numeric;
      return { key, dir: numeric ? "desc" : "asc" };
    });
  }

  // `silent` : rafraîchissement en arrière-plan (focus/import) sans squelette
  // ni écrasement de l'écran en cas d'erreur transitoire.
  const charger = useCallback(async (silent = false) => {
    if (!silent) setState({ kind: "chargement" });
    try {
      const pb = await getPocketBase();
      const data = await loadClientsData(pb);
      setState({ kind: "pret", data });
    } catch (err) {
      if (!silent) setState({ kind: "erreur", message: String(err) });
    }
  }, []);

  useEffect(() => {
    void charger();
  }, [charger, reloadKey]);

  useRefreshOnSignal(() => void charger(true));

  const lignesFiltrees = useMemo(() => {
    if (state.kind !== "pret") return [];
    const q = recherche.trim().toLowerCase();
    const filtrees = state.data.rows.filter((r) => {
      if (filtre !== "tous" && r.type !== filtre) return false;
      if (nouveauxSeulement && !r.is_new) return false;
      if (!q) return true;
      return (
        r.nom_complet.toLowerCase().includes(q) ||
        r.code.toLowerCase().includes(q) ||
        r.compte_titres.toLowerCase().includes(q)
      );
    });
    const facteur = sort.dir === "asc" ? 1 : -1;
    return [...filtrees].sort((a, b) => {
      const va = a[sort.key];
      const vb = b[sort.key];
      if (typeof va === "number" && typeof vb === "number") {
        return (va - vb) * facteur;
      }
      return (
        String(va ?? "").localeCompare(String(vb ?? ""), "fr", {
          numeric: true,
          sensitivity: "base",
        }) * facteur
      );
    });
  }, [state, recherche, filtre, sort, nouveauxSeulement]);

  // Revenir en page 1 quand le filtre, la recherche, la taille de page ou les
  // données changent (évite de rester sur une page désormais vide).
  useEffect(() => {
    setPage(1);
  }, [recherche, filtre, pageSize, reloadKey, sort, nouveauxSeulement]);

  const pageCount = Math.max(1, Math.ceil(lignesFiltrees.length / pageSize));
  const pageSure = Math.min(page, pageCount);
  const debut = (pageSure - 1) * pageSize;
  const lignesPage = lignesFiltrees.slice(debut, debut + pageSize);

  if (state.kind === "chargement") {
    return (
      <LoadingState
        variant={showKpis ? "table" : "card"}
        label={t("clients.chargement")}
        cols={8}
      />
    );
  }

  if (state.kind === "erreur") {
    return (
      <ErrorState
        message={t("clients.erreur-serveur")}
        detail={state.message}
        onRetry={() => void charger()}
      />
    );
  }

  if (state.data.totaux.nb_clients === 0) {
    return (
      <div className="import-notice import-notice--warn">
        <p>{t("clients.vide-aucun-client")}</p>
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
            label={t("clients.kpi-clients-actifs")}
            value={data.totaux.nb_clients.toLocaleString(locale)}
            sub={t("clients.kpi-repartition-pp-pm", {
              pp: data.totaux.nb_pp,
              pm: data.totaux.nb_pm,
            })}
          />
          <KpiCard
            tone="sage"
            label={t("clients.kpi-comptes-titres")}
            value={data.totaux.nb_comptes.toLocaleString(locale)}
          />
          <KpiCard
            tone="lilac"
            label={t("clients.kpi-positions")}
            value={data.totaux.nb_positions.toLocaleString(locale)}
          />
          <KpiCard
            tone="peach"
            label={t("clients.kpi-encours-total")}
            value={fmtCompact(data.totaux.encours_xaf, locale)}
            sub={fmtXAF(data.totaux.encours_xaf, locale)}
          />
        </div>
      )}

      <div className="clients-toolbar">
        <input
          className="clients-search"
          type="search"
          placeholder={t("clients.recherche-placeholder")}
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
        />
        <div
          className="clients-segment"
          role="group"
          aria-label={t("clients.filtre-par-type")}
        >
          {(["tous", "PP", "PM"] as Filtre[]).map((f) => (
            <button
              key={f}
              aria-pressed={filtre === f}
              onClick={() => setFiltre(f)}
              title={f === "tous" ? t("clients.tous-les-clients") : typeLabel(f)}
              aria-label={
                f === "tous" ? t("clients.tous-les-clients") : typeLabel(f)
              }
            >
              {f === "tous" ? t("clients.filtre-tous") : f}
            </button>
          ))}
        </div>
        {data.rows.some((r) => r.is_new) && (
          <button
            type="button"
            className={
              "clients-newfilter" +
              (nouveauxSeulement ? " clients-newfilter--on" : "")
            }
            aria-pressed={nouveauxSeulement}
            onClick={() => setNouveauxSeulement((v) => !v)}
            title={t("clients.filtre-nouveaux-titre")}
          >
            {t("clients.filtre-nouveaux", {
              n: data.rows.filter((r) => r.is_new).length,
            })}
          </button>
        )}
        <span className="clients-count">
          {t("clients.compte-sur", {
            n: lignesFiltrees.length.toLocaleString(locale),
            total: data.totaux.nb_clients.toLocaleString(locale),
          })}
        </span>
      </div>

      <div className="data-card">
        <div className="data-scroll">
          <table className="data-table">
            <caption className="sr-only">{t("clients.table-caption")}</caption>
            <thead>
              <tr>
                {COLUMNS.map((col) => {
                  const actif = sort.key === col.key;
                  return (
                    <th
                      key={col.key}
                      scope="col"
                      className={col.num ? "num" : undefined}
                      aria-sort={
                        actif
                          ? sort.dir === "asc"
                            ? "ascending"
                            : "descending"
                          : "none"
                      }
                    >
                      <button
                        type="button"
                        className={
                          "data-sort" + (actif ? " data-sort--active" : "")
                        }
                        onClick={() => trier(col.key)}
                      >
                        {t(col.labelKey)}
                        <span className="data-sort__icon" aria-hidden="true">
                          {actif ? (sort.dir === "asc" ? "▲" : "▼") : "↕"}
                        </span>
                      </button>
                    </th>
                  );
                })}
                {onGenerateReport && (
                  <th scope="col" className="num">
                    <span className="sr-only">{t("clients.col-actions")}</span>
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {lignesPage.map((r) => (
                <tr key={r.id}>
                  <td className="data-cell-code">{r.code}</td>
                  <td className="data-cell-name">
                    {onOpenClient ? (
                      <button
                        type="button"
                        className="data-cell-namebtn"
                        onClick={() => onOpenClient(r.id, r.nom_complet)}
                        title={t("clients.ouvrir-fiche-contact")}
                      >
                        {r.nom_complet}
                      </button>
                    ) : (
                      r.nom_complet
                    )}
                    {r.has_contact && (
                      <span
                        className="contact-dot"
                        title={t("clients.contact-renseigne")}
                        aria-label={t("clients.contact-renseigne")}
                      >
                        ✉
                      </span>
                    )}
                    {r.is_new && (
                      <span
                        className="pill pill--nouveau"
                        title={t("clients.nouveau-titre")}
                      >
                        {t("clients.nouveau")}
                      </span>
                    )}
                  </td>
                  <td>
                    <span
                      className={`pill pill--${r.type.toLowerCase()}`}
                      title={typeLabel(r.type)}
                    >
                      <span aria-hidden="true">{r.type}</span>
                      <span className="sr-only">{typeLabel(r.type)}</span>
                    </span>
                  </td>
                  <td className="data-cell-mono">{r.compte_titres}</td>
                  <td className="num">{r.nb_positions}</td>
                  <td className="num data-cell-encours">{fmtXAF(r.encours_xaf, locale)}</td>
                  <td>{statutPill(r.statut, t)}</td>
                  <td className="data-cell-mono">{fmtDate(r.date_ouverture, locale)}</td>
                  {onGenerateReport && (
                    <td className="num">
                      {r.nb_positions > 0 && (
                        <button
                          className="data-row-action"
                          onClick={() => onGenerateReport(r.id)}
                          aria-label={t("clients.generer-rapport-pour", {
                            nom: r.nom_complet,
                          })}
                          title={t("clients.generer-rapport-pour", {
                            nom: r.nom_complet,
                          })}
                        >
                          {t("clients.rapport")}
                          <span aria-hidden="true"> →</span>
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
              {lignesFiltrees.length === 0 && (
                <tr>
                  <td
                    className="data-empty"
                    colSpan={COLUMNS.length + (onGenerateReport ? 1 : 0)}
                  >
                    {t("clients.aucun-resultat")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {lignesFiltrees.length > 0 && (
          <div className="data-pager">
            <label className="data-pager__size">
              <span>{t("clients.lignes-par-page")}</span>
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
                {t("clients.pager-plage", {
                  debut: (debut + 1).toLocaleString(locale),
                  fin: Math.min(
                    debut + pageSize,
                    lignesFiltrees.length,
                  ).toLocaleString(locale),
                  total: lignesFiltrees.length.toLocaleString(locale),
                })}
              </span>
              <div className="data-pager__buttons">
                <button
                  className="data-pager__btn"
                  onClick={() => setPage(1)}
                  disabled={pageSure <= 1}
                  aria-label={t("clients.premiere-page")}
                >
                  «
                </button>
                <button
                  className="data-pager__btn"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={pageSure <= 1}
                  aria-label={t("clients.page-precedente")}
                >
                  ‹
                </button>
                <span className="data-pager__page">
                  {t("clients.pager-page", { page: pageSure, total: pageCount })}
                </span>
                <button
                  className="data-pager__btn"
                  onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                  disabled={pageSure >= pageCount}
                  aria-label={t("clients.page-suivante")}
                >
                  ›
                </button>
                <button
                  className="data-pager__btn"
                  onClick={() => setPage(pageCount)}
                  disabled={pageSure >= pageCount}
                  aria-label={t("clients.derniere-page")}
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
