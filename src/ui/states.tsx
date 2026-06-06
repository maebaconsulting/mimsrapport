// -*- coding: utf-8 -*-
// Composants d'état partagés : chargement (squelettes) et erreur (message
// métier + reprise + détail technique). Centralisent un comportement jusque-là
// dupliqué et garantissent l'accessibilité (aria-live, role) de façon uniforme.
//
// Convention du codebase : les vues exposent un état discriminé
//   type State = { kind: "chargement" } | { kind: "erreur"; message } | …
// Ces composants se branchent directement sur les branches "chargement" et
// "erreur" de ce type.

import { useT } from "../i18n";
import "./states.css";

/* ------------------------------------------------------------------ */
/* Squelettes                                                          */
/* ------------------------------------------------------------------ */

/** Bloc de chargement scintillant. `width`/`height` acceptent toute unité CSS. */
export function Skeleton({
  width = "100%",
  height = 14,
  radius,
  className,
  style,
}: {
  width?: number | string;
  height?: number | string;
  radius?: number | string;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <span
      className={"skeleton" + (className ? ` ${className}` : "")}
      aria-hidden="true"
      style={{
        width,
        height,
        borderRadius: radius,
        ...style,
      }}
    />
  );
}

/** Squelette de table : en-tête + `rows` lignes de `cols` cellules. */
export function SkeletonTable({
  rows = 8,
  cols = 6,
}: {
  rows?: number;
  cols?: number;
}) {
  const grid = { gridTemplateColumns: `repeat(${cols}, 1fr)` };
  return (
    <div className="skeleton-table" aria-hidden="true">
      <div className="skeleton-table__row skeleton-table__row--head" style={grid}>
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} height={11} width={i === 1 ? "70%" : "45%"} />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div className="skeleton-table__row" key={r} style={grid}>
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={c} height={13} width={c === 1 ? "80%" : "55%"} />
          ))}
        </div>
      ))}
    </div>
  );
}

/** Squelette d'une rangée de cartes (KPI, panneaux). */
export function SkeletonCards({
  count = 4,
  height = 96,
}: {
  count?: number;
  height?: number;
}) {
  return (
    <div className="skeleton-cards" aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} height={height} radius="var(--mw-radius-xl)" />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* État de chargement                                                  */
/* ------------------------------------------------------------------ */

type LoadingVariant = "card" | "table" | "cards" | "panels";

/**
 * État de chargement accessible. Affiche un squelette adapté au contexte et
 * annonce la progression aux lecteurs d'écran (role="status", aria-live="polite").
 */
export function LoadingState({
  label,
  variant = "card",
  rows,
  cols,
}: {
  label?: string;
  variant?: LoadingVariant;
  rows?: number;
  cols?: number;
}) {
  const t = useT();
  return (
    <div className="loading-state" role="status" aria-live="polite">
      <span className="sr-only">{label ?? t("states.loading")}</span>
      {variant === "card" && (
        <div className="card">
          <Skeleton width={140} height={11} />
          <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
            <Skeleton width="90%" />
            <Skeleton width="75%" />
            <Skeleton width="60%" />
          </div>
        </div>
      )}
      {variant === "cards" && <SkeletonCards count={rows ?? 4} />}
      {variant === "table" && (
        <>
          <SkeletonCards count={4} />
          <div className="loading-state__spacer" />
          <div className="card card--flush">
            <SkeletonTable rows={rows ?? 8} cols={cols ?? 6} />
          </div>
        </>
      )}
      {variant === "panels" && (
        <>
          <SkeletonCards count={4} />
          <div className="loading-state__spacer" />
          <div className="skeleton-panels">
            {Array.from({ length: rows ?? 4 }).map((_, i) => (
              <Skeleton key={i} height={220} radius="var(--mw-radius-xl)" />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* État d'erreur                                                       */
/* ------------------------------------------------------------------ */

/**
 * État d'erreur orienté utilisateur : message métier compréhensible, bouton de
 * reprise optionnel et détail technique replié dans un <details>. Annoncé en
 * role="alert" (aria-live assertive implicite) pour les lecteurs d'écran.
 */
export function ErrorState({
  message,
  detail,
  onRetry,
  retryLabel,
  tone = "danger",
}: {
  message: string;
  detail?: string;
  onRetry?: () => void;
  retryLabel?: string;
  tone?: "danger" | "warn";
}) {
  const t = useT();
  return (
    <div className={`import-notice import-notice--${tone}`} role="alert">
      <p>{message}</p>
      {onRetry && (
        <div className="import-notice__actions">
          <button className="btn" onClick={onRetry}>
            {retryLabel ?? t("states.retry")}
          </button>
        </div>
      )}
      {detail && (
        <details className="import-warnings">
          <summary>{t("states.technical-detail")}</summary>
          <p style={{ marginTop: 6 }}>{detail}</p>
        </details>
      )}
    </div>
  );
}
