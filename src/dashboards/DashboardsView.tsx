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
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  Treemap,
  XAxis,
  YAxis,
} from "recharts";
import { getPocketBase } from "../lib/pocketbase";
import { useRefreshOnSignal } from "../lib/refresh";
import { useT, useLocale, formatPercent, type TKey } from "../i18n";
import { loadDashboardData } from "./data";
import { computeDashboards, type Dashboards } from "./aggregator";
import { KpiCard } from "./KpiCard";
import { GaugeCard } from "./GaugeCard";
import { LoadingState, ErrorState } from "../ui/states";
import { ProvenanceBanner } from "../ui/ProvenanceBanner";
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

function fmtXAF(n: number, locale: string): string {
  return `${Math.round(n).toLocaleString(locale)} XAF`;
}
/** Montant compact pour les cartes KPI (milliards/millions). */
function fmtXAFCompact(n: number, locale: string): string {
  const abs = Math.abs(n);
  if (abs >= 1e9)
    return `${(n / 1e9).toLocaleString(locale, { maximumFractionDigits: 2 })} Md XAF`;
  if (abs >= 1e6)
    return `${(n / 1e6).toLocaleString(locale, { maximumFractionDigits: 1 })} M XAF`;
  return fmtXAF(n, locale);
}
/** Format compact d'axe : M (millions) / Md (milliards). */
function fmtAxis(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1e9) return `${(n / 1e9).toFixed(1)} Md`;
  if (abs >= 1e6) return `${(n / 1e6).toFixed(0)} M`;
  return String(n);
}

/** Clé i18n du libellé d'une classe d'actifs (la donnée porte le code `cle`). */
const CLASSE_KEY: Record<string, TKey> = {
  ACTION: "dashboards.classe-action",
  OBLIGATION: "dashboards.classe-obligation",
  OPC: "dashboards.classe-opc",
};

/** Libellé d'axe/infobulle pour une période « YYYY-MM », localisé (mois abrégé + année). */
function fmtPeriode(p: string, locale: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(p);
  if (!m) return p;
  const annee = Number(m[1]);
  const mois = Number(m[2]);
  if (!annee || !mois) return p;
  return new Date(annee, mois - 1, 1).toLocaleDateString(locale, {
    month: "short",
    year: "numeric",
  });
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
  const locale = useLocale();
  if (!active || !payload || payload.length === 0) return null;
  // fmtPeriode localise un libellé « YYYY-MM » (mois/année) et laisse les
  // autres libellés inchangés (année « YYYY », catégories).
  const labelText = fmtPeriode(String(label), locale);
  return (
    <div className="chart-tooltip">
      {label != null && label !== "" ? (
        <div className="chart-tooltip__label">{labelText}</div>
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
          <span className="chart-tooltip__value">{fmtXAF(Number(p.value), locale)}</span>
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
  const t = useT();
  const [state, setState] = useState<State>({ kind: "chargement" });
  const [reloadKey, setReloadKey] = useState(0);

  // `silent` : rafraîchissement en arrière-plan (focus/import) sans squelette
  // ni écrasement de l'écran en cas d'erreur transitoire.
  const fetchDashboard = useCallback(async (silent: boolean) => {
    if (!silent) setState({ kind: "chargement" });
    try {
      const pb = await getPocketBase();
      const data = await loadDashboardData(pb);
      if (data.positions.length === 0) {
        setState({ kind: "vide" });
        return;
      }
      setState({ kind: "pret", d: computeDashboards(data.positions, data.mouvements) });
    } catch (err) {
      if (!silent) setState({ kind: "erreur", message: String(err) });
    }
  }, []);

  // Réessai manuel (bouton) : recharge avec squelette.
  const charger = useCallback(() => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    void fetchDashboard(false);
  }, [fetchDashboard, reloadKey]);

  useRefreshOnSignal(() => void fetchDashboard(true));

  return (
    <>
      <header className="app-header">
        <p className="app-header__subtitle">
          {t("dashboards.sous-titre")}
        </p>
      </header>

      <section className="app-content">
        <ProvenanceBanner />
        {state.kind === "chargement" && (
          <LoadingState variant="panels" label={t("dashboards.chargement")} />
        )}
        {state.kind === "vide" && (
          <div className="import-notice import-notice--warn">
            <p>{t("dashboards.vide")}</p>
          </div>
        )}
        {state.kind === "erreur" && (
          <ErrorState
            message={t("dashboards.erreur")}
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
  const t = useT();
  const locale = useLocale();
  // Libellés issus de la couche données : on traduit via le code stable `cle`
  // (classes d'actifs) et la sentinelle « INCONNU » (émetteur sans nom).
  const classeLabel = (item: { cle: string; libelle: string }) =>
    CLASSE_KEY[item.cle] ? t(CLASSE_KEY[item.cle]) : item.libelle;
  const emetteurLabel = (item: { cle: string; libelle: string }) =>
    item.cle === "INCONNU" ? t("dashboards.emetteur-inconnu") : item.libelle;
  return (
    <div className="dash-grid">
      {/* 1. Encours global + indicateurs clés */}
      <div className="kpi-row">
        <KpiCard
          label={t("dashboards.kpi-encours-global")}
          value={fmtXAFCompact(d.encours.valorisationTotale, locale)}
          sub={t("dashboards.kpi-encours-global-sub", {
            nb: String(d.encours.nbPositions),
            montant: fmtXAF(d.encours.valorisationTotale, locale),
          })}
          tone="sage"
          spark={d.sparkEncours}
        />
        <KpiCard
          label={t("dashboards.kpi-comptes-titres")}
          value={String(d.encours.nbComptes)}
          sub={t("dashboards.kpi-comptes-titres-sub")}
          tone="lilac"
        />
        <KpiCard
          label={t("dashboards.kpi-concentration-max-emetteur")}
          value={formatPercent(d.concentrationEmetteur.concentrationMax, locale)}
          sub={t("dashboards.kpi-limite-cosumaf")}
          variant={d.concentrationEmetteur.alerte ? "danger" : "success"}
          tone={d.concentrationEmetteur.alerte ? "peach" : "yellow"}
        />
        <KpiCard
          label={t("dashboards.kpi-taux-moyen-pondere")}
          value={formatPercent(d.tauxMoyenPondereObligataire, locale)}
          tone="yellow"
        />
      </div>

      {/* 2. Indicateurs financiers complémentaires */}
      <div className="kpi-row">
        <KpiCard
          label={t("dashboards.kpi-pnl-latente")}
          value={fmtXAFCompact(d.pnl.plusValueLatente, locale)}
          sub={t("dashboards.kpi-pnl-latente-sub", { pct: formatPercent(d.pnl.perfPct, locale) })}
          variant={d.pnl.plusValueLatente >= 0 ? "success" : "danger"}
          tone="sage"
        />
        <KpiCard
          label={t("dashboards.kpi-encours-moyen-median")}
          value={fmtXAFCompact(d.encoursParCompte.moyen, locale)}
          sub={t("dashboards.kpi-encours-moyen-median-sub", {
            median: fmtXAFCompact(d.encoursParCompte.median, locale),
          })}
          tone="lilac"
        />
        <KpiCard
          label={t("dashboards.kpi-maturite-moyenne")}
          value={t("dashboards.kpi-maturite-moyenne-value", {
            ans: d.maturiteMoyenne.toLocaleString(locale),
          })}
          sub={t("dashboards.kpi-maturite-moyenne-sub", { pct: formatPercent(d.murEcheances.pct12m, locale) })}
          tone="yellow"
        />
        <KpiCard
          label={t("dashboards.kpi-collecte-nette")}
          value={fmtXAFCompact(d.activite.collecteNette, locale)}
          sub={t("dashboards.kpi-collecte-nette-sub", { pct: formatPercent(d.activite.turnover, locale) })}
          variant={d.activite.collecteNette >= 0 ? "success" : "danger"}
          tone="peach"
        />
      </div>

      {/* 3. Jauges de ratio (risque & conformité) */}
      <span className="dash-section-title small-caps">{t("dashboards.section-risque-conformite")}</span>
      <div className="dash-gauges">
        <GaugeCard
          label={t("dashboards.gauge-concentration-max-emetteur")}
          valeur={d.concentrationEmetteur.concentrationMax}
          max={100}
          seuils={{ attention: 20, critique: 30 }}
          unite="%"
          locale={locale}
          reference={{ valeur: 30, libelle: t("dashboards.reference-limite-cosumaf") }}
        />
        <GaugeCard
          label={t("dashboards.gauge-concentration-premier-client")}
          valeur={d.concentrationClientStats.top1}
          max={100}
          seuils={{ attention: 15, critique: 25 }}
          unite="%"
          locale={locale}
        />
        <GaugeCard
          label={t("dashboards.gauge-mur-echeances")}
          valeur={d.murEcheances.pct12m}
          max={100}
          seuils={{ attention: 15, critique: 30 }}
          unite="%"
          locale={locale}
        />
        <GaugeCard
          label={t("dashboards.gauge-score-diversification")}
          valeur={d.concentrationEmetteur.score}
          max={100}
          seuils={{ attention: 30, critique: 60 }}
          sensInverse
          formatValeur={(n) => `${Math.round(n)}/100`}
        />
      </div>

      {(d.qualite.positionsSansEmetteur > 0 ||
        d.qualite.obligSansEcheance > 0 ||
        d.qualite.positionsValoNulle > 0) && (
        <p className="dash-quality small-caps">
          {t("dashboards.qualite-donnees", { pct: formatPercent(d.qualite.integriteEmetteurPct, locale) })}
          {d.qualite.positionsSansEmetteur > 0 &&
            ` · ${t("dashboards.qualite-sans-emetteur", { nb: String(d.qualite.positionsSansEmetteur) })}`}
          {d.qualite.obligSansEcheance > 0 &&
            ` · ${t("dashboards.qualite-sans-echeance", { nb: String(d.qualite.obligSansEcheance) })}`}
          {d.qualite.positionsValoNulle > 0 &&
            ` · ${t("dashboards.qualite-valo-nulle", { nb: String(d.qualite.positionsValoNulle) })}`}
        </p>
      )}

      <div className="dash-panels">
        {/* 1. Évolution de l'encours reconstitué (pleine largeur) */}
        <Panel titre={t("dashboards.panel-evolution-encours")} pleineLargeur>
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
                <XAxis
                  dataKey="periode"
                  tick={{ fontSize: 10 }}
                  tickFormatter={(v) => fmtPeriode(String(v), locale)}
                />
                <YAxis tickFormatter={(v) => fmtAxis(Number(v))} tick={{ fontSize: 11 }} />
                <Tooltip content={<ChartTooltip />} />
                <Area
                  type="monotone"
                  dataKey="cumule"
                  name={t("dashboards.serie-encours")}
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
        <Panel titre={t("dashboards.panel-repartition-classe")}>
          <DonutChart
            data={d.repartitionClasse.map((c) => ({
              name: classeLabel(c),
              value: c.valorisation,
            }))}
          />
          <Legend
            items={d.repartitionClasse.map((c, i) => ({
              libelle: classeLabel(c),
              valeur: formatPercent(c.part, locale),
              color: CHART_COLORS[i % CHART_COLORS.length],
            }))}
          />
        </Panel>

        {/* 3. Concentration par émetteur */}
        <Panel
          titre={t("dashboards.panel-concentration-emetteur")}
          badge={
            d.concentrationEmetteur.alerte
              ? { texte: t("dashboards.badge-alerte-30"), variant: "danger" }
              : {
                  texte: t("dashboards.badge-score", {
                    score: String(d.concentrationEmetteur.score),
                  }),
                  variant: "success",
                }
          }
        >
          <HBarChart
            data={d.concentrationEmetteur.items.slice(0, 6).map((e) => ({
              name: emetteurLabel(e),
              value: e.valorisation,
              part: e.part,
            }))}
          />
        </Panel>

        {/* 4. Concentration par client */}
        <Panel titre={t("dashboards.panel-concentration-client")}>
          <HBarChart
            data={d.concentrationClient.slice(0, 8).map((c) => ({
              name: c.libelle,
              value: c.valorisation,
              part: c.part,
            }))}
          />
        </Panel>

        {/* 4b. Treemap d'exposition par émetteur */}
        <Panel titre={t("dashboards.panel-treemap-exposition")}>
          {d.concentrationEmetteur.items.length === 0 ? (
            <Vide />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <Treemap
                data={d.concentrationEmetteur.items.slice(0, 12).map((e, i) => ({
                  name: emetteurLabel(e),
                  size: e.valorisation,
                  part: e.part,
                  fill:
                    e.part > 30
                      ? "var(--mw-danger-solid)"
                      : CHART_COLORS[i % CHART_COLORS.length],
                }))}
                dataKey="size"
                stroke="var(--mw-white)"
                content={<TreemapCell locale={locale} />}
                isAnimationActive={false}
              />
            </ResponsiveContainer>
          )}
        </Panel>

        {/* 4c. Flux net mensuel (barres divergentes) */}
        <Panel titre={t("dashboards.panel-flux-net-mensuel")}>
          {d.fluxNetMensuel.length === 0 ? (
            <Vide />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={d.fluxNetMensuel} margin={{ left: 4, right: 8, top: 8 }}>
                <CartesianGrid
                  vertical={false}
                  stroke="var(--mw-border)"
                  strokeDasharray="3 3"
                />
                <XAxis
                  dataKey="periode"
                  tick={{ fontSize: 10 }}
                  tickFormatter={(v) => fmtPeriode(String(v), locale)}
                />
                <YAxis tickFormatter={(v) => fmtAxis(Number(v))} tick={{ fontSize: 11 }} />
                <Tooltip content={<ChartTooltip />} />
                <ReferenceLine y={0} stroke="var(--mw-border-strong)" />
                <Bar dataKey="net" name={t("dashboards.serie-flux-net")} radius={[3, 3, 0, 0]}>
                  {d.fluxNetMensuel.map((m) => (
                    <Cell
                      key={m.periode}
                      fill={m.net >= 0 ? "var(--chart-4)" : "var(--chart-5)"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </Panel>

        {/* 5. Échéancier obligataire · mur de liquidité (couleur par horizon) */}
        <Panel titre={t("dashboards.panel-echeancier-obligataire")}>
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
                <Bar dataKey="montant" name={t("dashboards.serie-echeance")} radius={[4, 4, 0, 0]}>
                  {d.echeancier.map((e) => {
                    const an = Number(e.annee);
                    const ecart = an - new Date().getFullYear();
                    const couleur =
                      ecart <= 1
                        ? "var(--mw-danger-solid)"
                        : ecart <= 2
                          ? "var(--mw-warning-solid)"
                          : "var(--mw-success-solid)";
                    return <Cell key={e.annee} fill={couleur} />;
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </Panel>

        {/* 6. Flux d'activité */}
        <Panel titre={t("dashboards.panel-flux-activite")}>
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
                <XAxis
                  dataKey="periode"
                  tick={{ fontSize: 10 }}
                  tickFormatter={(v) => fmtPeriode(String(v), locale)}
                />
                <YAxis tickFormatter={(v) => fmtAxis(Number(v))} tick={{ fontSize: 11 }} />
                <Tooltip content={<ChartTooltip />} />
                <Area
                  type="monotone"
                  dataKey="achat"
                  name={t("dashboards.serie-achat")}
                  stackId="flux"
                  stroke="var(--chart-4)"
                  strokeWidth={2}
                  fill="url(#grad-achat)"
                  dot={false}
                />
                <Area
                  type="monotone"
                  dataKey="vente"
                  name={t("dashboards.serie-vente")}
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
        <Panel titre={t("dashboards.panel-repartition-type-client")}>
          <DonutChart
            data={[
              { name: t("dashboards.serie-personnes-physiques"), value: d.repartitionTypeClient.pp.valorisation },
              { name: t("dashboards.serie-personnes-morales"), value: d.repartitionTypeClient.pm.valorisation },
            ]}
          />
          <Legend
            items={[
              {
                libelle: t("dashboards.legende-pp", {
                  comptes: String(d.repartitionTypeClient.pp.comptes),
                }),
                valeur: fmtXAFCompact(d.repartitionTypeClient.pp.valorisation, locale),
                color: CHART_COLORS[0],
              },
              {
                libelle: t("dashboards.legende-pm", {
                  comptes: String(d.repartitionTypeClient.pm.comptes),
                }),
                valeur: fmtXAFCompact(d.repartitionTypeClient.pm.valorisation, locale),
                color: CHART_COLORS[1],
              },
            ]}
          />
        </Panel>

        {/* 8. Dette souveraine vs privée */}
        <Panel titre={t("dashboards.panel-souverain-prive")}>
          <DonutChart
            data={[
              { name: t("dashboards.serie-souverain"), value: d.souverainVsCorporate.souverain },
              { name: t("dashboards.serie-prive"), value: d.souverainVsCorporate.corporate },
            ]}
          />
          <Legend
            items={[
              {
                libelle: t("dashboards.serie-souverain"),
                valeur: fmtXAFCompact(d.souverainVsCorporate.souverain, locale),
                color: CHART_COLORS[0],
              },
              {
                libelle: t("dashboards.serie-prive"),
                valeur: fmtXAFCompact(d.souverainVsCorporate.corporate, locale),
                color: CHART_COLORS[1],
              },
            ]}
          />
        </Panel>
      </div>

      <p className="dash-note small-caps">{t("dashboards.note-evolution-temporelle")}</p>
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
  const t = useT();
  return <p className="dash-vide">{t("dashboards.aucune-donnee")}</p>;
}

/** Cellule de treemap : rectangle coloré + libellé si la place le permet. */
function TreemapCell(props: {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  name?: string;
  part?: number;
  fill?: string;
  locale?: string;
}) {
  const {
    x = 0,
    y = 0,
    width = 0,
    height = 0,
    name,
    part,
    fill,
    locale = "fr-FR",
  } = props;
  return (
    <g>
      <rect x={x} y={y} width={width} height={height} fill={fill} stroke="var(--mw-white)" />
      {width > 64 && height > 30 && (
        <>
          <text x={x + 8} y={y + 18} fontSize={11} fontWeight={600} fill="var(--mw-ink)">
            {name}
          </text>
          {part != null && (
            <text x={x + 8} y={y + 33} fontSize={10} fill="var(--mw-ink)">
              {formatPercent(part, locale)}
            </text>
          )}
        </>
      )}
    </g>
  );
}

function DonutChart({
  data,
  centerLabel,
}: {
  data: Array<{ name: string; value: number }>;
  centerLabel?: string;
}) {
  const locale = useLocale();
  const total = data.reduce((s, x) => s + x.value, 0);
  if (total <= 0) return <Vide />;
  const centre = centerLabel ?? fmtXAFCompact(total, locale);
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
  const locale = useLocale();
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
                    {fmtXAF(Number(p.value), locale)} ({formatPercent(Number(p.payload?.part ?? 0), locale)})
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
