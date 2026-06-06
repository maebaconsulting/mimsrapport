import { useState } from "react";
import { getPocketBase } from "../lib/pocketbase";
import { pickManarFile } from "../lib/fileio";
import { runImport } from "./import-service";
import type { ImportResult, ImportSummary } from "./import-service";
import { readManarWorkbook } from "./manar-parser";
import { detectMapping } from "./manar-detect";
import { loadMappingForHeaders, saveMapping } from "./mapping-store";
import { REQUIRED_FIELDS, type ColumnMapping } from "./manar-fields";
import { MappingStep } from "./MappingStep";
import { ClientsTable } from "../clients/ClientsTable";
import { ImportHistory } from "./ImportHistory";
import { ErrorState } from "../ui/states";
import { useT, useLocale, type TFunc } from "../i18n";
import "./import.css";

type Phase =
  | { kind: "idle" }
  | { kind: "encours"; step: string; fileName: string }
  | {
      kind: "mapping";
      fileName: string;
      data: Uint8Array;
      headers: string[];
      sampleRows: string[][];
      mapping: ColumnMapping;
      missingRequired: string[];
    }
  | {
      kind: "deja";
      fileName: string;
      existingFileName: string;
      data: Uint8Array;
      mapping?: ColumnMapping;
    }
  | { kind: "reussi"; summary: ImportSummary }
  | { kind: "erreur"; message: string };

function formatXAF(n: number, locale: string): string {
  return n.toLocaleString(locale) + " XAF";
}

/** Tuiles du récapitulatif d'import (grille horizontale). */
function statTiles(
  s: ImportSummary,
  t: TFunc,
  locale: string,
): Array<{ label: string; value: string; sub?: string }> {
  const c = s.counts;
  return [
    { label: t("import.tile-operations"), value: c.operations.toLocaleString(locale) },
    {
      label: t("import.tile-clients"),
      value: c.clients.toLocaleString(locale),
      sub: t("import.tile-clients-sub", { pp: c.clientsPP, pm: c.clientsPM }),
    },
    { label: t("import.tile-portfolios"), value: c.portefeuilles.toLocaleString(locale) },
    { label: t("import.tile-issuers"), value: c.emetteurs.toLocaleString(locale) },
    { label: t("import.tile-instruments"), value: c.instruments.toLocaleString(locale) },
    { label: t("import.tile-movements"), value: c.mouvements.toLocaleString(locale) },
    { label: t("import.tile-positions"), value: c.positions.toLocaleString(locale) },
    {
      label: t("import.tile-new-clients"),
      value: s.nbNewClients.toLocaleString(locale),
      sub: s.nbNewClients > 0 ? t("import.tile-new-clients-since") : t("import.tile-new-clients-none"),
    },
    {
      label: t("import.tile-total-amount"),
      value: formatXAF(Math.round(s.montantTotalXaf), locale),
    },
  ];
}

export function ImportWizard({
  onImported,
  onNavigate,
}: {
  onImported?: () => void;
  /** Passerelles d'enchaînement après un import réussi. */
  onNavigate?: (c: "clients" | "rapports" | "tableaux") => void;
}) {
  const t = useT();
  const locale = useLocale();
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [historyKey, setHistoryKey] = useState(0);
  // Confirmation à deux temps avant le remplacement (action irréversible).
  const [confirmRemplace, setConfirmRemplace] = useState(false);
  // Survol d'un fichier au-dessus de la zone de dépôt (retour visuel).
  const [dragSurvol, setDragSurvol] = useState(false);

  async function doImport(
    fileName: string,
    data: Uint8Array,
    replace: boolean,
    mapping?: ColumnMapping,
  ) {
    setConfirmRemplace(false);
    setPhase({ kind: "encours", step: t("import.step-preparing"), fileName });
    try {
      const pb = await getPocketBase();
      const result: ImportResult = await runImport(pb, {
        fileName,
        data,
        replace,
        mapping,
        onProgress: (step) => setPhase({ kind: "encours", step, fileName }),
      });
      if (result.status === "DEJA_IMPORTE") {
        setPhase({
          kind: "deja",
          fileName,
          existingFileName: result.existingFileName,
          data,
          mapping,
        });
      } else {
        setPhase({ kind: "reussi", summary: result });
        onImported?.();
      }
      setHistoryKey((k) => k + 1); // l'historique manar_imports a changé
    } catch (err) {
      setPhase({ kind: "erreur", message: String(err) });
      setHistoryKey((k) => k + 1);
    }
  }

  // Détermine la correspondance de colonnes avant l'import : mapping mémorisé,
  // sinon auto-détection ; si la structure est inconnue, ouvre l'étape de mapping.
  async function preparerImport(fileName: string, data: Uint8Array) {
    setPhase({ kind: "encours", step: t("import.step-analyzing"), fileName });
    let wb;
    try {
      wb = readManarWorkbook(data);
    } catch (err) {
      setPhase({ kind: "erreur", message: String(err) });
      return;
    }
    try {
      const pb = await getPocketBase();
      const stored = await loadMappingForHeaders(pb, wb.headers);
      if (stored && REQUIRED_FIELDS.every((k) => stored.mapping[k] != null)) {
        await doImport(fileName, data, false, stored.mapping);
        return;
      }
      const det = detectMapping(wb.headers, wb.sampleRows);
      if (det.confidence === "auto") {
        await doImport(fileName, data, false, det.mapping);
        return;
      }
      setPhase({
        kind: "mapping",
        fileName,
        data,
        headers: wb.headers,
        sampleRows: wb.sampleRows,
        mapping: det.mapping,
        missingRequired: det.missingRequired,
      });
    } catch (err) {
      setPhase({ kind: "erreur", message: String(err) });
    }
  }

  async function handlePick() {
    const picked = await pickManarFile();
    if (!picked) return;
    await preparerImport(picked.name, picked.bytes);
  }

  // Glisser-déposer réel : dépose d'un .xls/.xlsx sur la zone. Le clic reste le
  // chemin principal (et le repli là où le dépôt n'est pas disponible).
  async function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragSurvol(false);
    if (busy) return;
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    if (!/\.xlsx?$/i.test(file.name)) {
      setPhase({
        kind: "erreur",
        message: t("import.unsupported-format", { nom: file.name }),
      });
      return;
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    await preparerImport(file.name, bytes);
  }

  const busy = phase.kind === "encours";

  return (
    <>
      <div className="import-top">
        <div className="card import-card">
          <span className="small-caps">{t("import.wizard-title")}</span>
          <p className="card__lead">{t("import.wizard-lead")}</p>

          {(phase.kind === "idle" || phase.kind === "encours") && (
            <button
              type="button"
              className={
                "import-dropzone" +
                (dragSurvol ? " import-dropzone--survol" : "")
              }
              onClick={handlePick}
              disabled={busy}
              onDragOver={(e) => {
                e.preventDefault();
                if (!busy) setDragSurvol(true);
              }}
              onDragLeave={() => setDragSurvol(false)}
              onDrop={(e) => void handleDrop(e)}
            >
              <span className="import-dropzone__icon" aria-hidden="true">
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"
                  strokeLinejoin="round">
                  <path d="M12 16V4" />
                  <path d="m7 9 5-5 5 5" />
                  <path d="M5 16v2a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-2" />
                </svg>
              </span>
              <span className="import-dropzone__title">
                {busy
                  ? t("import.dropzone-busy")
                  : dragSurvol
                    ? t("import.dropzone-drop-here")
                    : t("import.dropzone-choose")}
              </span>
              <span className="import-dropzone__hint">
                {t("import.dropzone-hint")}
              </span>
            </button>
          )}

          {phase.kind === "encours" && (
            <p className="import-progress" role="status" aria-live="polite">
              <span className="import-progress__spinner" /> {phase.step}
            </p>
          )}

          {phase.kind === "mapping" && (
            <MappingStep
              headers={phase.headers}
              sampleRows={phase.sampleRows}
              initialMapping={phase.mapping}
              onCancel={() => setPhase({ kind: "idle" })}
              onConfirm={(mapping, remember) => {
                if (remember) {
                  void getPocketBase()
                    .then((pb) =>
                      saveMapping(pb, { headers: phase.headers, mapping }),
                    )
                    .catch(() => {
                      /* la mémorisation est best-effort */
                    });
                }
                void doImport(phase.fileName, phase.data, false, mapping);
              }}
            />
          )}

          {phase.kind === "deja" && !confirmRemplace && (
            <div className="import-notice import-notice--warn" role="status">
              <p>
                {t("import.already-imported", { fichier: phase.existingFileName })}
              </p>
              <div className="import-notice__actions">
                <button
                  className="btn btn--danger"
                  onClick={() => setConfirmRemplace(true)}
                >
                  {t("import.replace-previous")}
                </button>
                <button className="btn" onClick={() => setPhase({ kind: "idle" })}>
                  {t("import.cancel")}
                </button>
              </div>
            </div>
          )}

          {phase.kind === "deja" && confirmRemplace && (
            <div className="import-notice import-notice--danger" role="alert">
              <p>{t("import.confirm-replace-warning")}</p>
              <div className="import-notice__actions">
                <button
                  className="btn btn--danger"
                  onClick={() =>
                    doImport(phase.fileName, phase.data, true, phase.mapping)
                  }
                >
                  {t("import.confirm-replace-yes")}
                </button>
                <button
                  className="btn"
                  onClick={() => setConfirmRemplace(false)}
                >
                  {t("import.go-back")}
                </button>
              </div>
            </div>
          )}

          {phase.kind === "erreur" && (
            <ErrorState
              message={t("import.error-failed")}
              detail={phase.message}
              onRetry={() => setPhase({ kind: "idle" })}
              retryLabel={t("import.retry-label")}
            />
          )}

          {phase.kind === "reussi" && (
            <div
              className="import-notice import-notice--success"
              role="status"
              aria-live="polite"
            >
              <p>
                {t("import.success-message", {
                  s: (phase.summary.durationMs / 1000).toFixed(1),
                })}
              </p>
              <div className="import-notice__actions" style={{ marginTop: 4 }}>
                {onNavigate && (
                  <>
                    <button
                      className="btn btn--primary"
                      onClick={() => onNavigate("tableaux")}
                    >
                      {t("import.view-dashboards")}
                    </button>
                    <button className="btn" onClick={() => onNavigate("rapports")}>
                      {t("import.generate-report")}
                    </button>
                  </>
                )}
                <button className="btn" onClick={() => setPhase({ kind: "idle" })}>
                  {t("import.new-import")}
                </button>
              </div>
            </div>
          )}
        </div>

        <ImportHistory reloadKey={historyKey} />
      </div>

      {phase.kind === "reussi" && (
        <section className="import-stats">
          <span className="small-caps">{t("import.recap-title")}</span>
          <div className="stat-grid">
            {statTiles(phase.summary, t, locale).map((tile) => (
              <div key={tile.label} className="stat-tile">
                <span className="small-caps stat-tile__label">{tile.label}</span>
                <span className="stat-tile__value">{tile.value}</span>
                {tile.sub && <span className="stat-tile__sub">{tile.sub}</span>}
              </div>
            ))}
          </div>
          {phase.summary.nbNewClients > 0 && (
            <details className="import-warnings">
              <summary>
                {t("import.new-clients-detected", { n: phase.summary.nbNewClients })}
              </summary>
              <ul>
                {phase.summary.newClients.slice(0, 50).map((c) => (
                  <li key={c.code}>
                    {c.type === "PP"
                      ? `${c.prenom ?? ""} ${c.nom}`.trim()
                      : c.nom}{" "}
                    · {c.code}
                  </li>
                ))}
              </ul>
            </details>
          )}
          {phase.summary.warnings.length > 0 && (
            <details className="import-warnings">
              <summary>
                {t("import.warnings-count", { n: phase.summary.warnings.length })}
              </summary>
              <ul>
                {phase.summary.warnings.slice(0, 20).map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </details>
          )}
        </section>
      )}

      {phase.kind === "reussi" && (
        <section className="import-data">
          <span className="small-caps">{t("import.imported-clients")}</span>
          <ClientsTable showKpis={false} />
        </section>
      )}
    </>
  );
}
