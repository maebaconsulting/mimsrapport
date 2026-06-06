// -*- coding: utf-8 -*-
// Accueil : tableau de bord d'entrée. Cartes KPI métier consolidées, bandeau de
// provenance, et passerelles vers les vues principales. Quand la base est vide,
// un appel à l'action invite à importer un fichier d'export.

import { useCallback, useEffect, useState } from "react";
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

function fmtXAF(n: number): string {
  return `${Math.round(n).toLocaleString("fr-FR")} XAF`;
}

/** Encours compact en milliards/millions pour les KPI. */
function fmtCompact(n: number): string {
  if (n >= 1e9) return `${(n / 1e9).toFixed(2).replace(".", ",")} Md XAF`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1).replace(".", ",")} M XAF`;
  return fmtXAF(n);
}

export function HomeView({ onNavigate }: { onNavigate: (c: Cible) => void }) {
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
        <h1 className="app-header__title">Accueil</h1>
        <p className="app-header__subtitle">
          Outil de reporting pour société de bourse · marché CEMAC / BVMAC
        </p>
      </header>

      <section className="app-content">
        {state.kind === "chargement" && (
          <LoadingState
            variant="cards"
            label="Chargement des indicateurs d'accueil en cours…"
          />
        )}
        {state.kind === "erreur" && (
          <ErrorState
            message="Connexion à la base de données locale impossible. Vérifiez que le serveur est démarré, puis réessayez."
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
      <h2 className="home-empty__title">Aucune donnée pour l'instant</h2>
      <p className="home-empty__text">
        Importez un fichier d'export pour
        alimenter les indicateurs, les tableaux de bord et la production de
        rapports.
      </p>
      <button className="btn btn--primary" onClick={onImport}>
        Importer un fichier d'export
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
  const t = data.totaux;
  return (
    <div className="home-grid">
      <ProvenanceBanner />

      <div className="kpi-row">
        <KpiCard
          tone="yellow"
          label="Clients"
          value={t.nb_clients.toLocaleString("fr-FR")}
          sub={`${t.nb_pp} pers. physiques · ${t.nb_pm} pers. morales`}
        />
        <KpiCard
          tone="sage"
          label="Comptes-titres"
          value={t.nb_comptes.toLocaleString("fr-FR")}
          sub="Portefeuilles-titres distincts"
        />
        <KpiCard
          tone="lilac"
          label="Positions"
          value={t.nb_positions.toLocaleString("fr-FR")}
        />
        <KpiCard
          tone="peach"
          label="Encours total"
          value={fmtCompact(t.encours_xaf)}
          sub={fmtXAF(t.encours_xaf)}
        />
      </div>

      <div className="home-actions">
        <span className="small-caps home-actions__title">Que faire ensuite</span>
        <div className="home-actions__grid">
          <ActionCard
            titre="Consulter les clients"
            texte="Parcourir, rechercher et trier les comptes-titres importés."
            onClick={() => onNavigate("clients")}
          />
          <ActionCard
            titre="Voir les tableaux de bord"
            texte="Encours, concentration, allocation et flux d'activité."
            onClick={() => onNavigate("tableaux")}
          />
          <ActionCard
            titre="Générer un rapport"
            texte="Documents client et états réglementaires COSUMAF."
            onClick={() => onNavigate("rapports")}
          />
          <ActionCard
            titre="Nouvel import"
            texte="Charger un nouveau fichier ou remplacer l'import courant."
            onClick={() => onNavigate("import")}
          />
        </div>
      </div>
    </div>
  );
}
