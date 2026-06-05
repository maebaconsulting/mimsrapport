import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { getPocketBase } from "../lib/pocketbase";
import { loadDashboardData } from "./data";
import { computeDashboards, type Dashboards } from "./aggregator";
import { KpiCard } from "./KpiCard";
import "./dashboards.css";

const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--chart-6)",
  "var(--chart-accent)",
];

function fmtXAF(n: number): string {
  return `${Math.round(n).toLocaleString("fr-FR")} XAF`;
}
/** Montant compact pour les cartes KPI (milliards/millions). */
function fmtXAFCompact(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1e9)
    return `${(n / 1e9).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} Md XAF`;
  if (abs >= 1e6)
    return `${(n / 1e6).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} M XAF`;
  return fmtXAF(n);
}
function fmtPct(n: number): string {
  return `${n.toFixed(1)} %`;
}

type State =
  | { kind: "chargement" }
  | { kind: "vide" }
  | { kind: "pret"; d: Dashboards }
  | { kind: "erreur"; message: string };

export function DashboardsView() {
  const [state, setState] = useState<State>({ kind: "chargement" });

  useEffect(() => {
    let annule = false;
    (async () => {
      try {
        const pb = await getPocketBase();
        const data = await loadDashboardData(pb);
        if (annule) return;
        if (data.positions.length === 0) {
          setState({ kind: "vide" });
          return;
        }
        setState({ kind: "pret", d: computeDashboards(data.positions, data.mouvements) });
      } catch (err) {
        if (!annule) setState({ kind: "erreur", message: String(err) });
      }
    })();
    return () => {
      annule = true;
    };
  }, []);

  return (
    <>
      <header className="app-header">
        <h1 className="app-header__title">Tableaux de bord</h1>
        <p className="app-header__subtitle">
          Pilotage des encours, concentration, allocation et flux
        </p>
      </header>

      <section className="app-content">
        {state.kind === "chargement" && (
          <div className="card">
            <p className="card__lead">Calcul des indicateurs…</p>
          </div>
        )}
        {state.kind === "vide" && (
          <div className="import-notice import-notice--warn">
            <p>Aucune position. Importez d'abord un fichier Manar.</p>
          </div>
        )}
        {state.kind === "erreur" && (
          <div className="import-notice import-notice--danger">
            <p>Chargement impossible : {state.message}</p>
          </div>
        )}
        {state.kind === "pret" && <DashboardsContent d={state.d} />}
      </section>
    </>
  );
}

function DashboardsContent({ d }: { d: Dashboards }) {
  return (
    <div className="dash-grid">
      {/* 1. Encours global + indicateurs clés */}
      <div className="kpi-row">
        <KpiCard
          label="Encours global"
          value={fmtXAFCompact(d.encours.valorisationTotale)}
          sub={`${d.encours.nbPositions} positions · ${fmtXAF(d.encours.valorisationTotale)}`}
          tone="sage"
        />
        <KpiCard label="Comptes titres" value={String(d.encours.nbComptes)} tone="lilac" />
        <KpiCard
          label="Concentration max émetteur"
          value={fmtPct(d.concentrationEmetteur.concentrationMax)}
          sub={`limite COSUMAF 30 %`}
          variant={d.concentrationEmetteur.alerte ? "danger" : "success"}
          tone={d.concentrationEmetteur.alerte ? "peach" : "yellow"}
        />
        <KpiCard
          label="Taux moyen pondéré obligataire"
          value={fmtPct(d.tauxMoyenPondereObligataire)}
          tone="yellow"
        />
      </div>

      <div className="dash-panels">
        {/* 2. Répartition par classe d'actifs */}
        <Panel titre="Répartition par classe d'actifs">
          <DonutChart
            data={d.repartitionClasse.map((c) => ({
              name: c.libelle,
              value: c.valorisation,
            }))}
          />
          <Legend
            items={d.repartitionClasse.map((c, i) => ({
              libelle: c.libelle,
              valeur: fmtPct(c.part),
              color: CHART_COLORS[i % CHART_COLORS.length],
            }))}
          />
        </Panel>

        {/* 3. Concentration par émetteur */}
        <Panel
          titre="Concentration par émetteur"
          badge={
            d.concentrationEmetteur.alerte
              ? { texte: "Alerte > 30 %", variant: "danger" }
              : { texte: `Score ${d.concentrationEmetteur.score}/100`, variant: "success" }
          }
        >
          <HBarChart
            data={d.concentrationEmetteur.items.slice(0, 6).map((e) => ({
              name: e.libelle,
              value: e.valorisation,
              part: e.part,
            }))}
          />
        </Panel>

        {/* 4. Concentration par client */}
        <Panel titre="Concentration par client (top 8)">
          <HBarChart
            data={d.concentrationClient.slice(0, 8).map((c) => ({
              name: c.libelle,
              value: c.valorisation,
              part: c.part,
            }))}
          />
        </Panel>

        {/* 5. Échéancier obligataire */}
        <Panel titre="Échéancier obligataire">
          {d.echeancier.length === 0 ? (
            <Vide />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={d.echeancier}>
                <XAxis dataKey="annee" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={(v) => `${(v / 1e6).toFixed(0)}M`} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => fmtXAF(Number(v))} />
                <Bar dataKey="montant" fill="var(--chart-2)" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Panel>

        {/* 6. Flux d'activité */}
        <Panel titre="Flux d'activité (achat / vente)">
          {d.fluxActivite.length === 0 ? (
            <Vide />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={d.fluxActivite}>
                <XAxis dataKey="periode" tick={{ fontSize: 10 }} />
                <YAxis tickFormatter={(v) => `${(v / 1e6).toFixed(0)}M`} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => fmtXAF(Number(v))} />
                <Bar dataKey="achat" name="Achat" fill="var(--chart-4)" radius={[3, 3, 0, 0]} />
                <Bar dataKey="vente" name="Vente" fill="var(--chart-6)" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Panel>

        {/* 7. Répartition par type de client */}
        <Panel titre="Répartition par type de client">
          <DonutChart
            data={[
              { name: "Personnes physiques", value: d.repartitionTypeClient.pp.valorisation },
              { name: "Personnes morales", value: d.repartitionTypeClient.pm.valorisation },
            ]}
          />
          <Legend
            items={[
              {
                libelle: `PP · ${d.repartitionTypeClient.pp.comptes} comptes`,
                valeur: fmtXAF(d.repartitionTypeClient.pp.valorisation),
                color: CHART_COLORS[0],
              },
              {
                libelle: `PM · ${d.repartitionTypeClient.pm.comptes} comptes`,
                valeur: fmtXAF(d.repartitionTypeClient.pm.valorisation),
                color: CHART_COLORS[1],
              },
            ]}
          />
        </Panel>

        {/* 8. Souverain vs corporate */}
        <Panel titre="Souverain vs corporate">
          <DonutChart
            data={[
              { name: "Souverain", value: d.souverainVsCorporate.souverain },
              { name: "Corporate", value: d.souverainVsCorporate.corporate },
            ]}
          />
          <Legend
            items={[
              {
                libelle: "Souverain",
                valeur: fmtXAF(d.souverainVsCorporate.souverain),
                color: CHART_COLORS[0],
              },
              {
                libelle: "Corporate",
                valeur: fmtXAF(d.souverainVsCorporate.corporate),
                color: CHART_COLORS[1],
              },
            ]}
          />
        </Panel>
      </div>

      <p className="dash-note small-caps">
        Les vues d'évolution temporelle s'appuient sur la chronologie des
        mouvements importés ; sur un import unique, elles restent partielles.
      </p>
    </div>
  );
}

function Panel({
  titre,
  badge,
  children,
}: {
  titre: string;
  badge?: { texte: string; variant: "danger" | "success" };
  children: React.ReactNode;
}) {
  return (
    <div className="dash-panel">
      <div className="dash-panel__head">
        <span className="small-caps">{titre}</span>
        {badge ? (
          <span className={`dash-badge dash-badge--${badge.variant}`}>
            {badge.texte}
          </span>
        ) : null}
      </div>
      <div className="dash-panel__body">{children}</div>
    </div>
  );
}

function Vide() {
  return <p className="dash-vide">Aucune donnée disponible.</p>;
}

function DonutChart({ data }: { data: Array<{ name: string; value: number }> }) {
  const total = data.reduce((s, x) => s + x.value, 0);
  if (total <= 0) return <Vide />;
  return (
    <ResponsiveContainer width="100%" height={180}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          innerRadius={42}
          outerRadius={70}
          paddingAngle={1}
        >
          {data.map((_, i) => (
            <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
          ))}
        </Pie>
        <Tooltip formatter={(v) => fmtXAF(Number(v))} />
      </PieChart>
    </ResponsiveContainer>
  );
}

function HBarChart({
  data,
}: {
  data: Array<{ name: string; value: number; part: number }>;
}) {
  if (data.length === 0) return <Vide />;
  return (
    <ResponsiveContainer width="100%" height={Math.max(160, data.length * 28)}>
      <BarChart layout="vertical" data={data} margin={{ left: 8, right: 16 }}>
        <XAxis type="number" hide />
        <YAxis
          type="category"
          dataKey="name"
          width={130}
          tick={{ fontSize: 10 }}
        />
        <Tooltip
          formatter={(v, _n, p) =>
            `${fmtXAF(Number(v))} (${fmtPct((p as { payload: { part: number } }).payload.part)})`
          }
        />
        <Bar dataKey="value" fill="var(--chart-2)" radius={[0, 3, 3, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function Legend({
  items,
}: {
  items: Array<{ libelle: string; valeur: string; color: string }>;
}) {
  return (
    <ul className="dash-legend">
      {items.map((it, i) => (
        <li key={i}>
          <span className="dash-legend__dot" style={{ background: it.color }} />
          <span className="dash-legend__label">{it.libelle}</span>
          <span className="dash-legend__value">{it.valeur}</span>
        </li>
      ))}
    </ul>
  );
}
