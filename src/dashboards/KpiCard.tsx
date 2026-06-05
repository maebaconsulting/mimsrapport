// Carte indicateur · libellé small-caps, grande valeur display tabulaire,
// sous-texte optionnel. Style MoWoBank : fond pastel selon le ton.
// La prop `tone` (pastel plein) prime sur `variant` (sémantique héritée).

export type KpiTone = "sage" | "yellow" | "lilac" | "peach" | "white";

export interface KpiCardProps {
  label: string;
  value: string;
  sub?: string;
  variant?: "default" | "danger" | "success" | "warn";
  tone?: KpiTone;
  /** Mini-série pour une sparkline en aire au bas de la carte (≥ 2 points). */
  spark?: number[];
}

/** Construit deux tracés SVG normalisés (ligne + aire pleine) sur 100×36. */
function buildSparkPaths(spark: number[]): { line: string; area: string } | null {
  if (!spark || spark.length < 2) return null;
  const W = 100;
  const H = 36;
  const pad = 2;
  const min = Math.min(...spark);
  const max = Math.max(...spark);
  const span = max - min || 1;
  const n = spark.length;
  const pts = spark.map((v, i) => {
    const x = (i / (n - 1)) * W;
    const y = pad + (1 - (v - min) / span) * (H - pad * 2);
    return [x, y] as const;
  });
  const line = pts
    .map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`)
    .join(" ");
  const area = `${line} L${W} ${H} L0 ${H} Z`;
  return { line, area };
}

export function KpiCard({ label, value, sub, variant = "default", tone, spark }: KpiCardProps) {
  // Si un ton pastel est fourni, il définit le fond ; sinon on retombe sur
  // la variante sémantique d'origine (rétrocompatibilité).
  const modifier = tone ? `kpi-card--${tone}` : `kpi-card--${variant}`;
  const paths = spark ? buildSparkPaths(spark) : null;
  // Identifiant de dégradé unique par carte (évite les collisions SVG).
  const gradId = `kpi-spark-${label.replace(/[^a-zA-Z0-9]/g, "")}`;
  return (
    <div className={`kpi-card ${modifier}`}>
      <span className="small-caps kpi-card__label">{label}</span>
      <span className="kpi-card__value">{value}</span>
      {sub ? <span className="kpi-card__sub">{sub}</span> : null}
      {paths ? (
        <svg
          className="kpi-card__spark"
          viewBox="0 0 100 36"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--mw-ink)" stopOpacity="0.22" />
              <stop offset="100%" stopColor="var(--mw-ink)" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={paths.area} fill={`url(#${gradId})`} stroke="none" />
          <path
            d={paths.line}
            fill="none"
            stroke="var(--mw-ink)"
            strokeOpacity="0.55"
            strokeWidth="2"
            vectorEffect="non-scaling-stroke"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        </svg>
      ) : null}
    </div>
  );
}
