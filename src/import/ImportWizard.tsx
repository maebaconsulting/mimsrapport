import { useState } from "react";
import { getPocketBase } from "../lib/pocketbase";
import { pickManarFile } from "../lib/fileio";
import { runImport } from "./import-service";
import type { ImportResult, ImportSummary } from "./import-service";
import { ClientsTable } from "../clients/ClientsTable";
import { ImportHistory } from "./ImportHistory";
import { ErrorState } from "../ui/states";
import "./import.css";

type Phase =
  | { kind: "idle" }
  | { kind: "encours"; step: string; fileName: string }
  | { kind: "deja"; fileName: string; existingFileName: string; data: Uint8Array }
  | { kind: "reussi"; summary: ImportSummary }
  | { kind: "erreur"; message: string };

function formatXAF(n: number): string {
  return n.toLocaleString("fr-FR").replace(/ /g, " ") + " XAF";
}

/** Tuiles du récapitulatif d'import (grille horizontale). */
function statTiles(s: ImportSummary): Array<{ label: string; value: string; sub?: string }> {
  const c = s.counts;
  return [
    { label: "Opérations brutes", value: c.operations.toLocaleString("fr-FR") },
    {
      label: "Clients",
      value: c.clients.toLocaleString("fr-FR"),
      sub: `${c.clientsPP} pers. physiques · ${c.clientsPM} pers. morales`,
    },
    { label: "Portefeuilles", value: c.portefeuilles.toLocaleString("fr-FR") },
    { label: "Émetteurs", value: c.emetteurs.toLocaleString("fr-FR") },
    { label: "Instruments", value: c.instruments.toLocaleString("fr-FR") },
    { label: "Mouvements de titres", value: c.mouvements.toLocaleString("fr-FR") },
    { label: "Positions", value: c.positions.toLocaleString("fr-FR") },
    {
      label: "Montant brut total",
      value: formatXAF(Math.round(s.montantTotalXaf)),
    },
  ];
}

export function ImportWizard({ onImported }: { onImported?: () => void }) {
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [historyKey, setHistoryKey] = useState(0);
  // Confirmation à deux temps avant le remplacement (action irréversible).
  const [confirmRemplace, setConfirmRemplace] = useState(false);

  async function doImport(
    fileName: string,
    data: Uint8Array,
    replace: boolean,
  ) {
    setConfirmRemplace(false);
    setPhase({ kind: "encours", step: "Préparation…", fileName });
    try {
      const pb = await getPocketBase();
      const result: ImportResult = await runImport(pb, {
        fileName,
        data,
        replace,
        onProgress: (step) => setPhase({ kind: "encours", step, fileName }),
      });
      if (result.status === "DEJA_IMPORTE") {
        setPhase({
          kind: "deja",
          fileName,
          existingFileName: result.existingFileName,
          data,
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

  async function handlePick() {
    const picked = await pickManarFile();
    if (!picked) return;
    await doImport(picked.name, picked.bytes, false);
  }

  const busy = phase.kind === "encours";

  return (
    <>
      <div className="import-top">
        <div className="card import-card">
          <span className="small-caps">Assistant d'import</span>
          <p className="card__lead">
            Sélectionnez le fichier Manar (« État des instruments saisis sur
            Manar », format .xls ou .xlsx). L'import enregistre les clients,
            portefeuilles, instruments, émetteurs, positions et mouvements.
          </p>

          {(phase.kind === "idle" || phase.kind === "encours") && (
            <button
              type="button"
              className="import-dropzone"
              onClick={handlePick}
              disabled={busy}
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
                {busy ? "Import en cours…" : "Choisir un fichier Manar"}
              </span>
              <span className="import-dropzone__hint">
                Formats acceptés : .xls, .xlsx
              </span>
            </button>
          )}

          {phase.kind === "encours" && (
            <p className="import-progress" role="status" aria-live="polite">
              <span className="import-progress__spinner" /> {phase.step}
            </p>
          )}

          {phase.kind === "deja" && !confirmRemplace && (
            <div className="import-notice import-notice--warn" role="status">
              <p>
                Ce fichier a déjà été importé avec succès (« {phase.existingFileName}{" "}
                »). Vous pouvez annuler ou remplacer l'import précédent.
              </p>
              <div className="import-notice__actions">
                <button
                  className="btn btn--danger"
                  onClick={() => setConfirmRemplace(true)}
                >
                  Remplacer l'import précédent
                </button>
                <button className="btn" onClick={() => setPhase({ kind: "idle" })}>
                  Annuler
                </button>
              </div>
            </div>
          )}

          {phase.kind === "deja" && confirmRemplace && (
            <div className="import-notice import-notice--danger" role="alert">
              <p>
                Confirmer le remplacement ? Les données de l'import précédent
                seront définitivement supprimées puis recréées à partir de ce
                fichier. Cette action est irréversible.
              </p>
              <div className="import-notice__actions">
                <button
                  className="btn btn--danger"
                  onClick={() => doImport(phase.fileName, phase.data, true)}
                >
                  Oui, remplacer définitivement
                </button>
                <button
                  className="btn"
                  onClick={() => setConfirmRemplace(false)}
                >
                  Revenir
                </button>
              </div>
            </div>
          )}

          {phase.kind === "erreur" && (
            <ErrorState
              message="L'import du fichier Manar a échoué. Vérifiez le fichier puis recommencez."
              detail={phase.message}
              onRetry={() => setPhase({ kind: "idle" })}
              retryLabel="Recommencer"
            />
          )}

          {phase.kind === "reussi" && (
            <div
              className="import-notice import-notice--success"
              role="status"
              aria-live="polite"
            >
              <p>
                Import réussi en {(phase.summary.durationMs / 1000).toFixed(1)} s.
                Les entités ci-dessous ont été enregistrées dans la base locale.
              </p>
              <button
                className="btn"
                style={{ marginTop: 4 }}
                onClick={() => setPhase({ kind: "idle" })}
              >
                Nouvel import
              </button>
            </div>
          )}
        </div>

        <ImportHistory reloadKey={historyKey} />
      </div>

      {phase.kind === "reussi" && (
        <section className="import-stats">
          <span className="small-caps">Récapitulatif de l'import</span>
          <div className="stat-grid">
            {statTiles(phase.summary).map((t) => (
              <div key={t.label} className="stat-tile">
                <span className="small-caps stat-tile__label">{t.label}</span>
                <span className="stat-tile__value">{t.value}</span>
                {t.sub && <span className="stat-tile__sub">{t.sub}</span>}
              </div>
            ))}
          </div>
          {phase.summary.warnings.length > 0 && (
            <details className="import-warnings">
              <summary>{phase.summary.warnings.length} avertissement(s)</summary>
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
          <span className="small-caps">Clients importés</span>
          <ClientsTable showKpis={false} />
        </section>
      )}
    </>
  );
}
