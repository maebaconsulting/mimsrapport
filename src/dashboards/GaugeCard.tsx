// -*- coding: utf-8 -*-
// Jauge de ratio (demi-arc) : lit une valeur bornée par rapport à des zones de
// tolérance (vert / orange / rouge) et un seuil de référence. Sobre, sans
// aiguille décorative : arc de zones + arc de valeur + repère de seuil + valeur
// centrale. Couleurs depuis les tokens --mw-*. Accessible (role="img"+aria-label).

import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";

type Zone = "success" | "warning" | "danger";

export interface GaugeCardProps {
  label: string;
  valeur: number;
  min?: number;
  max: number;
  /** Bornes des zones, en unité de la valeur (attention puis critique). */
  seuils: { attention: number; critique: number };
  unite?: string;
  /** true si « haut = bon » (ex. un score /100). */
  sensInverse?: boolean;
  /** Repère de seuil affiché sur l'arc (ex. limite COSUMAF 30 %). */
  reference?: { valeur: number; libelle: string };
  /** Formatage de la valeur centrale (défaut : entier + unité). */
  formatValeur?: (n: number) => string;
  /** Ton de fond de la carte. */
  tone?: "white" | "sage" | "yellow" | "lilac" | "peach";
}

const LIBELLE_ZONE: Record<Zone, string> = {
  success: "Bon",
  warning: "À surveiller",
  danger: "Alerte",
};

function zoneDe(
  valeur: number,
  seuils: { attention: number; critique: number },
  sensInverse: boolean,
): Zone {
  if (sensInverse) {
    if (valeur >= seuils.critique) return "success";
    if (valeur >= seuils.attention) return "warning";
    return "danger";
  }
  if (valeur >= seuils.critique) return "danger";
  if (valeur >= seuils.attention) return "warning";
  return "success";
}

export function GaugeCard({
  label,
  valeur,
  min = 0,
  max,
  seuils,
  unite = "",
  sensInverse = false,
  reference,
  formatValeur,
  tone = "white",
}: GaugeCardProps) {
  const span = max - min || 1;
  const frac = Math.max(0, Math.min(1, (valeur - min) / span));
  const zone = zoneDe(valeur, seuils, sensInverse);
  const fmt = formatValeur ?? ((n: number) => `${Math.round(n)}${unite ? " " + unite : ""}`);

  // Arc de zones (track) : largeurs proportionnelles aux seuils.
  const a = Math.max(0, Math.min(1, (seuils.attention - min) / span));
  const c = Math.max(a, Math.min(1, (seuils.critique - min) / span));
  const zonesTrack = sensInverse
    ? [
        { w: a, key: "danger" },
        { w: c - a, key: "warning" },
        { w: 1 - c, key: "success" },
      ]
    : [
        { w: a, key: "success" },
        { w: c - a, key: "warning" },
        { w: 1 - c, key: "danger" },
      ];

  // Arc de valeur : portion remplie + reste transparent.
  const valeurData = [
    { name: "v", value: frac },
    { name: "reste", value: 1 - frac },
  ];

  // Repère de seuil (fin secteur) optionnel.
  const refFrac =
    reference != null
      ? Math.max(0, Math.min(1, (reference.valeur - min) / span))
      : null;
  const refData =
    refFrac != null
      ? [
          { name: "av", value: Math.max(0, refFrac - 0.006) },
          { name: "tick", value: 0.012 },
          { name: "ap", value: Math.max(0, 1 - refFrac - 0.006) },
        ]
      : null;

  const aria =
    `${label} : ${fmt(valeur)}` +
    (reference ? `, ${reference.libelle} ${reference.valeur}${unite ? " " + unite : ""}` : "") +
    `, zone ${LIBELLE_ZONE[zone]}`;

  return (
    <div className={`gauge-card kpi-card kpi-card--${tone}`} role="img" aria-label={aria}>
      <span className="small-caps kpi-card__label">{label}</span>
      <div className="gauge-card__chart">
        <ResponsiveContainer width="100%" height={120}>
          <PieChart>
            <Pie
              data={zonesTrack}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="100%"
              startAngle={180}
              endAngle={0}
              innerRadius={62}
              outerRadius={82}
              stroke="none"
              isAnimationActive={false}
            >
              {zonesTrack.map((z, i) => (
                <Cell key={i} fill={`var(--mw-${z.key}-bg)`} />
              ))}
            </Pie>
            <Pie
              data={valeurData}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="100%"
              startAngle={180}
              endAngle={0}
              innerRadius={62}
              outerRadius={82}
              stroke="none"
              isAnimationActive={false}
            >
              <Cell fill={`var(--mw-${zone}-solid)`} />
              <Cell fill="transparent" />
            </Pie>
            {refData && (
              <Pie
                data={refData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="100%"
                startAngle={180}
                endAngle={0}
                innerRadius={58}
                outerRadius={86}
                stroke="none"
                isAnimationActive={false}
              >
                <Cell fill="transparent" />
                <Cell fill="var(--mw-ink)" />
                <Cell fill="transparent" />
              </Pie>
            )}
          </PieChart>
        </ResponsiveContainer>
        <span className="gauge-card__value">{fmt(valeur)}</span>
      </div>
      <span className={`gauge-card__state gauge-card__state--${zone}`}>
        {LIBELLE_ZONE[zone]}
        {reference ? ` · ${reference.libelle} ${reference.valeur}${unite ? " " + unite : ""}` : ""}
      </span>
    </div>
  );
}
