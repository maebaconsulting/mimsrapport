// -*- coding: utf-8 -*-
// Accueil : tableau de bord d'entrée. Cartes KPI métier consolidées, bandeau de
// provenance, et passerelles vers les vues principales. Quand la base est vide,
// un appel à l'action invite à importer un fichier d'export.

import { useCallback, useEffect, useState } from "react";
import { useT, useLocale } from "../i18n";
import { getPocketBase } from "../lib/pocketbase";
import { loadClientsData, type ClientsData } from "../clients/clients-data";
import { KpiCard } from "../dashboards/KpiCard";
import { LoadingState, ErrorState } from "../ui/states";
import { ProvenanceBanner } from "../ui/ProvenanceBanner";
import "../dashboards/dashboards.css"; // .kpi-row
import "./home.css";

/** Vues accessibles depuis les passerelles de l'accueil. */
type Cible = "import" | "clients" | "rapports" | "tableaux";

type State =
  | { kind: "chargement" }
  | { kind: "vide" }
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

export function HomeView({ onNavigate }: { onNavigate: (c: Cible) => void }) {
  const t = useT();
  const [state, setState] = useState<State>({ kind: "chargement" });

  const charger = useCallback(async () => {
    setState({ kind: "chargement" });
    try {
      const pb = await getPocketBase();
      const data = await loadClientsData(pb);
      setState(
        data.totaux.nb_clients === 0
          ? { kind: "vide" }
          : { kind: "pret", data },
      );
    } catch (err) {
      setState({ kind: "erreur", message: String(err) });
    }
  }, []);

  useEffect(() => {
    void charger();
  }, [charger]);

  return (
    <>
      <header className="app-header">
        <h1 className="app-header__title">{t("home.header-title")}</h1>
        <p className="app-header__subtitle">
          {t("home.header-subtitle")}
        </p>
      </header>

      <section className="app-content">
        {state.kind === "chargement" && (
          <LoadingState
            variant="cards"
            label={t("home.loading-label")}
          />
        )}
        {state.kind === "erreur" && (
          <ErrorState
            message={t("home.error-message")}
            detail={state.message}
            onRetry={() => void charger()}
          />
        )}
        {state.kind === "vide" && (
          <EmptyHome onImport={() => onNavigate("import")} />
        )}
        {state.kind === "pret" && (
          <ReadyHome data={state.data} onNavigate={onNavigate} />
        )}
      </section>
    </>
  );
}

/** Accueil quand la base est vide : invitation à importer. */
function EmptyHome({ onImport }: { onImport: () => void }) {
  const t = useT();
  return (
    <div className="home-empty">
      <div className="home-empty__icon" aria-hidden="true">
        <svg
          width="40"
          height="40"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 16V4" />
          <path d="m7 9 5-5 5 5" />
          <path d="M5 16v2a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-2" />
        </svg>
      </div>
      <h2 className="home-empty__title">{t("home.empty-title")}</h2>
      <p className="home-empty__text">
        {t("home.empty-text")}
      </p>
      <button className="btn btn--primary" onClick={onImport}>
        {t("home.empty-import-button")}
      </button>
    </div>
  );
}

/** Carte de passerelle vers une vue. */
function ActionCard({
  titre,
  texte,
  onClick,
}: {
  titre: string;
  texte: string;
  onClick: () => void;
}) {
  return (
    <button className="home-action" onClick={onClick}>
      <span className="home-action__title">
        {titre}
        <span className="home-action__arrow" aria-hidden="true">
          →
        </span>
      </span>
      <span className="home-action__text">{texte}</span>
    </button>
  );
}

/** Accueil alimenté : provenance, KPI métier et passerelles. */
function ReadyHome({
  data,
  onNavigate,
}: {
  data: ClientsData;
  onNavigate: (c: Cible) => void;
}) {
  const t = useT();
  const locale = useLocale();
  const tot = data.totaux;
  return (
    <div className="home-grid">
      <ProvenanceBanner />

      <div className="kpi-row">
        <KpiCard
          tone="yellow"
          label={t("home.kpi-clients-label")}
          value={tot.nb_clients.toLocaleString(locale)}
          sub={t("home.kpi-clients-sub", { pp: String(tot.nb_pp), pm: String(tot.nb_pm) })}
        />
        <KpiCard
          tone="sage"
          label={t("home.kpi-accounts-label")}
          value={tot.nb_comptes.toLocaleString(locale)}
          sub={t("home.kpi-accounts-sub")}
        />
        <KpiCard
          tone="lilac"
          label={t("home.kpi-positions-label")}
          value={tot.nb_positions.toLocaleString(locale)}
        />
        <KpiCard
          tone="peach"
          label={t("home.kpi-total-label")}
          value={fmtCompact(tot.encours_xaf, locale)}
          sub={fmtXAF(tot.encours_xaf, locale)}
        />
      </div>

      <div className="home-actions">
        <span className="small-caps home-actions__title">{t("home.actions-title")}</span>
        <div className="home-actions__grid">
          <ActionCard
            titre={t("home.action-clients-title")}
            texte={t("home.action-clients-text")}
            onClick={() => onNavigate("clients")}
          />
          <ActionCard
            titre={t("home.action-dashboards-title")}
            texte={t("home.action-dashboards-text")}
            onClick={() => onNavigate("tableaux")}
          />
          <ActionCard
            titre={t("home.action-report-title")}
            texte={t("home.action-report-text")}
            onClick={() => onNavigate("rapports")}
          />
          <ActionCard
            titre={t("home.action-import-title")}
            texte={t("home.action-import-text")}
            onClick={() => onNavigate("import")}
          />
        </div>
      </div>
    </div>
  );
}
