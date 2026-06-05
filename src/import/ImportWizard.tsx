import { useState } from "react";
import { getPocketBase } from "../lib/pocketbase";
import { pickManarFile } from "../lib/fileio";
import { runImport } from "./import-service";
import type { ImportResult, ImportSummary } from "./import-service";

type Phase =
  | { kind: "idle" }
  | { kind: "encours"; step: string; fileName: string }
  | { kind: "deja"; fileName: string; existingFileName: string; data: Uint8Array }
  | { kind: "reussi"; summary: ImportSummary }
  | { kind: "erreur"; message: string };

const COUNT_LABELS: Array<[keyof ImportSummary["counts"], string]> = [
  ["operations", "Opérations brutes"],
  ["emetteurs", "Émetteurs"],
  ["instruments", "Instruments"],
  ["clients", "Clients"],
  ["clientsPP", "· dont personnes physiques"],
  ["clientsPM", "· dont personnes morales"],
  ["portefeuilles", "Portefeuilles"],
  ["mouvements", "Mouvements de titres"],
  ["positions", "Positions"],
];

function formatXAF(n: number): string {
  // Espace insécable comme séparateur de milliers.
  return n.toLocaleString("fr-FR").replace(/ /g, " ") + " XAF";
}

export function ImportWizard({ onImported }: { onImported?: () => void }) {
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });

  async function doImport(
    fileName: string,
    data: Uint8Array,
    replace: boolean,
  ) {
    setPhase({ kind: "encours", step: "Préparation…", fileName });
    try {
      const pb = await getPocketBase();
      const result: ImportResult = await runImport(pb, {
        fileName,
        data,
        replace,
        onProgress: (step) =>
          setPhase({ kind: "encours", step, fileName }),
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
    } catch (err) {
      setPhase({ kind: "erreur", message: String(err) });
    }
  }

  async function handlePick() {
    const picked = await pickManarFile();
    if (!picked) return;
    await doImport(picked.name, picked.bytes, false);
  }

  const busy = phase.kind === "encours";

  return (
    <div className="card" style={{ maxWidth: 720 }}>
      <span className="small-caps">Assistant d'import</span>
      <p className="card__lead">
        Sélectionnez le fichier Manar (« État des instruments saisis sur
        Manar », format .xls ou .xlsx). L'import matérialise les clients,
        portefeuilles, instruments, émetteurs, positions et mouvements.
      </p>

      <div style={{ marginTop: 16 }}>
        <button className="btn btn--primary" onClick={handlePick} disabled={busy}>
          {busy ? "Import en cours…" : "Choisir un fichier Manar"}
        </button>
      </div>

      {phase.kind === "encours" && (
        <p className="import-progress">
          <span className="import-progress__spinner" /> {phase.step}
        </p>
      )}

      {phase.kind === "deja" && (
        <div className="import-notice import-notice--warn">
          <p>
            Ce fichier a déjà été importé avec succès (« {phase.existingFileName}{" "}
            »). Vous pouvez annuler ou remplacer l'import précédent.
          </p>
          <div className="import-notice__actions">
            <button
              className="btn btn--danger"
              onClick={() => doImport(phase.fileName, phase.data, true)}
            >
              Remplacer l'import précédent
            </button>
            <button
              className="btn"
              onClick={() => setPhase({ kind: "idle" })}
            >
              Annuler
            </button>
          </div>
        </div>
      )}

      {phase.kind === "erreur" && (
        <div className="import-notice import-notice--danger">
          <p>Échec de l'import : {phase.message}</p>
          <button className="btn" onClick={() => setPhase({ kind: "idle" })}>
            Recommencer
          </button>
        </div>
      )}

      {phase.kind === "reussi" && (
        <div className="import-notice import-notice--success">
          <p>
            Import réussi en {(phase.summary.durationMs / 1000).toFixed(1)} s ·
            montant brut total {formatXAF(Math.round(phase.summary.montantTotalXaf))}.
          </p>
          <table className="status-table">
            <tbody>
              {COUNT_LABELS.map(([key, label]) => (
                <tr key={key}>
                  <td className="status-table__name">{label}</td>
                  <td className="status-table__count">
                    {phase.summary.counts[key]}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {phase.summary.warnings.length > 0 && (
            <details className="import-warnings">
              <summary>
                {phase.summary.warnings.length} avertissement(s)
              </summary>
              <ul>
                {phase.summary.warnings.slice(0, 20).map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </details>
          )}
          <button
            className="btn"
            style={{ marginTop: 12 }}
            onClick={() => setPhase({ kind: "idle" })}
          >
            Nouvel import
          </button>
        </div>
      )}
    </div>
  );
}
