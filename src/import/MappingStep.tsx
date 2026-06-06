// -*- coding: utf-8 -*-
// Étape de correspondance des colonnes : affichée quand la structure du fichier
// n'est pas reconnue automatiquement. L'utilisateur relie chaque champ attendu à
// une colonne réelle (avec aperçu de valeurs), puis lance l'import.

import { useMemo, useState } from "react";
import { MAPPABLE_FIELDS, type ColumnMapping } from "./manar-fields";

export function MappingStep({
  headers,
  sampleRows,
  initialMapping,
  onConfirm,
  onCancel,
}: {
  headers: string[];
  sampleRows: string[][];
  initialMapping: ColumnMapping;
  onConfirm: (mapping: ColumnMapping, remember: boolean) => void;
  onCancel: () => void;
}) {
  const [mapping, setMapping] = useState<ColumnMapping>({ ...initialMapping });
  const [remember, setRemember] = useState(true);

  // Aperçu des premières valeurs non vides d'une colonne.
  function apercu(idx: number | null | undefined): string {
    if (idx === null || idx === undefined) return "";
    const vals = sampleRows
      .map((r) => (r[idx] ?? "").trim())
      .filter((v) => v !== "")
      .slice(0, 3);
    return vals.join(" · ");
  }

  // Une colonne obligatoire est invalide si non mappée ou vide sur l'échantillon.
  const errors = useMemo(() => {
    const e: Record<string, string> = {};
    for (const f of MAPPABLE_FIELDS) {
      if (!f.required) continue;
      const idx = mapping[f.key];
      if (idx === null || idx === undefined) {
        e[f.key] = "À relier à une colonne.";
      } else if (apercu(idx) === "") {
        e[f.key] = "La colonne choisie semble vide.";
      }
    }
    return e;
    // apercu dépend de sampleRows (stable) ; recalcul sur mapping suffit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapping]);

  const valide = Object.keys(errors).length === 0;

  return (
    <div className="mapping-step">
      <div className="import-notice import-notice--warn" role="status">
        <p>
          La structure de ce fichier n'est pas reconnue. Reliez chaque champ
          attendu à la colonne correspondante du fichier, puis lancez l'import.
        </p>
      </div>

      <div className="mapping-grid">
        {MAPPABLE_FIELDS.map((f) => {
          const idx = mapping[f.key];
          const erreur = errors[f.key];
          const selectId = `map-${f.key}`;
          return (
            <div className="mapping-row" key={f.key}>
              <label className="mapping-row__field" htmlFor={selectId}>
                {f.label}
                {f.required && (
                  <span className="report-field__required" aria-hidden="true">
                    {" "}
                    *
                  </span>
                )}
              </label>
              <select
                id={selectId}
                className={"mapping-row__select" + (erreur ? " input--invalid" : "")}
                value={idx ?? ""}
                aria-invalid={erreur ? true : undefined}
                onChange={(ev) => {
                  const v = ev.target.value;
                  setMapping((m) => ({
                    ...m,
                    [f.key]: v === "" ? null : Number(v),
                  }));
                }}
              >
                <option value="">— Non mappé —</option>
                {headers.map((h, i) => (
                  <option key={i} value={i}>
                    {`Col ${i + 1} · ${h || "(sans titre)"}`}
                  </option>
                ))}
              </select>
              <span className="mapping-row__preview">
                {erreur ? (
                  <span className="report-field__error">{erreur}</span>
                ) : (
                  apercu(idx) && <>Aperçu : {apercu(idx)}</>
                )}
              </span>
            </div>
          );
        })}
      </div>

      <div className="mapping-step__footer">
        <label className="mapping-step__remember">
          <input
            type="checkbox"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
          />
          Mémoriser cette correspondance pour ce format de fichier
        </label>
        <div className="import-notice__actions">
          <button
            className="btn btn--primary"
            disabled={!valide}
            onClick={() => onConfirm(mapping, remember)}
          >
            Importer avec cette correspondance
          </button>
          <button className="btn" onClick={onCancel}>
            Annuler
          </button>
        </div>
      </div>
    </div>
  );
}
