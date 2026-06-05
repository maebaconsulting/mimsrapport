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
}

export function KpiCard({ label, value, sub, variant = "default", tone }: KpiCardProps) {
  // Si un ton pastel est fourni, il définit le fond ; sinon on retombe sur
  // la variante sémantique d'origine (rétrocompatibilité).
  const modifier = tone ? `kpi-card--${tone}` : `kpi-card--${variant}`;
  return (
    <div className={`kpi-card ${modifier}`}>
      <span className="small-caps kpi-card__label">{label}</span>
      <span className="kpi-card__value">{value}</span>
      {sub ? <span className="kpi-card__sub">{sub}</span> : null}
    </div>
  );
}
