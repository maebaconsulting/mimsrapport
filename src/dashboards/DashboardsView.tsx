import { useCallback, useEffect, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Label,
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
import { LoadingState, ErrorState } from "../ui/states";
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
/** Format compact d'axe : M (millions) / Md (milliards). */
function fmtAxis(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1e9) return `${(n / 1e9).toFixed(1)} Md`;
  if (abs >= 1e6) return `${(n / 1e6).toFixed(0)} M`;
  return String(n);
}

/** Infobulle MoWoBank : carte blanche arrondie, ombre douce, valeurs mono. */
function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number | string; color?: string }>;
  label?: string | number;
}) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="chart-tooltip">
      {label != null && label !== "" ? (
        <div className="chart-tooltip__label">{String(label)}</div>
      ) : null}
      {payload.map((p, i) => (
        <div className="chart-tooltip__row" key={i}>
          {p.color ? (
            <span
              className="chart-tooltip__dot"
              style={{ background: p.color }}
            />
          ) : null}
          {p.name ? (
            <span className="chart-tooltip__name">{p.name}</span>
          ) : null}
          <span className="chart-tooltip__value">{fmtXAF(Number(p.value))}</span>
        </div>
      ))}
    </div>
  );
}

type State =
  | { kind: "chargement" }
  | { kind: "vide" }
  | { kind: "pret"; d: Dashboards }
  | { kind: "erreur"; message: string };

export function DashboardsView() {
  const [state, setState] = useState<State>({ kind: "chargement" });
  const [reloadKey, setReloadKey] = useState(0);

  const charger = useCallback(() => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    let annule = false;
    setState({ kind: "chargement" });
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
  }, [reloadKey]);

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
          <LoadingState variant="panels" label="Calcul des indicateurs en cours…" />
        )}
        {state.kind === "vide" && (
          <div className="import-notice import-notice--warn">
            <p>Aucune position. Importez d'abord un fichier Manar.</p>
          </div>
        )}
        {state.kind === "erreur" && (
          <ErrorState
            message="Impossible de calculer les indicateurs. Vérifiez que le serveur de données local est démarré, puis réessayez."
            detail={state.message}
            onRetry={charger}
          />
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
          spark={d.sparkEncours}
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
        {/* 1. Évolution de l'encours reconstitué (pleine largeur) */}
        <Panel titre="Évolution de l'encours (reconstitué)" pleineLargeur>
          {d.evolutionEncours.length === 0 ? (
            <Vide />
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={d.evolutionEncours} margin={{ left: 4, right: 8, top: 8 }}>
                <defs>
                  <linearGradient id="grad-encours" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.45} />
                    <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  vertical={false}
                  stroke="var(--mw-border)"
                  strokeDasharray="3 3"
                />
                <XAxis dataKey="periode" tick={{ fontSize: 10 }} />
                <YAxis tickFormatter={(v) => fmtAxis(Number(v))} tick={{ fontSize: 11 }} />
                <Tooltip content={<ChartTooltip />} />
                <Area
                  type="monotone"
                  dataKey="cumule"
                  name="Encours"
                  stroke="var(--chart-1)"
                  strokeWidth={2}
                  fill="url(#grad-encours)"
                  dot={false}
                  activeDot={{ r: 3 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </Panel>

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
                <CartesianGrid
                  vertical={false}
                  stroke="var(--mw-border)"
                  strokeDasharray="3 3"
                />
                <XAxis dataKey="annee" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={(v) => fmtAxis(Number(v))} tick={{ fontSize: 11 }} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="montant" name="Échéance" fill="var(--chart-2)" radius={[4, 4, 0, 0]} />
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
              <AreaChart data={d.fluxActivite} margin={{ left: 4, right: 8, top: 8 }}>
                <defs>
                  <linearGradient id="grad-achat" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--chart-4)" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="var(--chart-4)" stopOpacity={0.08} />
                  </linearGradient>
                  <linearGradient id="grad-vente" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--chart-5)" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="var(--chart-5)" stopOpacity={0.08} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  vertical={false}
                  stroke="var(--mw-border)"
                  strokeDasharray="3 3"
                />
                <XAxis dataKey="periode" tick={{ fontSize: 10 }} />
                <YAxis tickFormatter={(v) => fmtAxis(Number(v))} tick={{ fontSize: 11 }} />
                <Tooltip content={<ChartTooltip />} />
                <Area
                  type="monotone"
                  dataKey="achat"
                  name="Achat"
                  stackId="flux"
                  stroke="var(--chart-4)"
                  strokeWidth={2}
                  fill="url(#grad-achat)"
                  dot={false}
                />
                <Area
                  type="monotone"
                  dataKey="vente"
                  name="Vente"
                  stackId="flux"
                  stroke="var(--chart-5)"
                  strokeWidth={2}
                  fill="url(#grad-vente)"
                  dot={false}
                />
              </AreaChart>
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

        {/* 8. Dette souveraine vs privée */}
        <Panel titre="Souverain et privé">
          <DonutChart
            data={[
              { name: "Souverain", value: d.souverainVsCorporate.souverain },
              { name: "Privé", value: d.souverainVsCorporate.corporate },
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
                libelle: "Privé",
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
  pleineLargeur = false,
}: {
  titre: string;
  badge?: { texte: string; variant: "danger" | "success" };
  children: React.ReactNode;
  pleineLargeur?: boolean;
}) {
  return (
    <div className={`dash-panel${pleineLargeur ? " dash-panel--full" : ""}`}>
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

function DonutChart({
  data,
  centerLabel,
}: {
  data: Array<{ name: string; value: number }>;
  centerLabel?: string;
}) {
  const total = data.reduce((s, x) => s + x.value, 0);
  if (total <= 0) return <Vide />;
  const centre = centerLabel ?? fmtXAFCompact(total);
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
          <Label
            position="center"
            content={({ viewBox }) => {
              const vb = viewBox as { cx?: number; cy?: number } | undefined;
              if (!vb || vb.cx == null || vb.cy == null) return null;
              return (
                <text
                  x={vb.cx}
                  y={vb.cy}
                  textAnchor="middle"
                  dominantBaseline="central"
                  className="donut-center"
                >
                  {centre}
                </text>
              );
            }}
          />
        </Pie>
        <Tooltip content={<ChartTooltip />} />
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
          content={({ active, payload }) => {
            if (!active || !payload || payload.length === 0) return null;
            const p = payload[0] as {
              payload?: { name?: string; part?: number };
              value?: number | string;
            };
            return (
              <div className="chart-tooltip">
                {p.payload?.name ? (
                  <div className="chart-tooltip__label">{p.payload.name}</div>
                ) : null}
                <div className="chart-tooltip__row">
                  <span className="chart-tooltip__value">
                    {fmtXAF(Number(p.value))} ({fmtPct(Number(p.payload?.part ?? 0))})
                  </span>
                </div>
              </div>
            );
          }}
        />
        <Bar dataKey="value" fill="var(--chart-2)" radius={[0, 4, 4, 0]} />
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
