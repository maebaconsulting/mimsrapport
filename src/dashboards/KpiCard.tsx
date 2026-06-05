// Carte KPI · label small-caps, valeur en chiffres tabulaires, sous-texte
// optionnel, bord danger optionnel. Inspiré de MIMS components/dashboard/KpiCard.

export interface KpiCardProps {
  label: string;
  value: string;
  sub?: string;
  variant?: "default" | "danger" | "success" | "warn";
}

export function KpiCard({ label, value, sub, variant = "default" }: KpiCardProps) {
  return (
    <div className={`kpi-card kpi-card--${variant}`}>
      <span className="small-caps kpi-card__label">{label}</span>
      <span className="kpi-card__value">{value}</span>
      {sub ? <span className="kpi-card__sub">{sub}</span> : null}
    </div>
  );
}
