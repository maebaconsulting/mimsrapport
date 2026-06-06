// -*- coding: utf-8 -*-
// Étape de correspondance des colonnes : affichée quand la structure du fichier
// n'est pas reconnue automatiquement. L'utilisateur relie chaque champ attendu à
// une colonne réelle (avec aperçu de valeurs), puis lance l'import.

import { useMemo, useState } from "react";
import { MAPPABLE_FIELDS, type ColumnMapping } from "./manar-fields";
import { useT, type TKey } from "../i18n";

// Correspondance id de champ logique → clé i18n du libellé. Les libellés FR
// restent dans manar-fields.ts (donnée consommée par les tests) ; ici on n'expose
// que la clé de traduction pour l'affichage.
const FIELD_LABEL_KEY: Record<string, TKey> = {
  manar_op_id: "mapping.field-manar_op_id",
  donneur_ordre: "mapping.field-donneur_ordre",
  isin: "mapping.field-isin",
  emetteur_code: "mapping.field-emetteur_code",
  poste_code: "mapping.field-poste_code",
  libelle_instrument: "mapping.field-libelle_instrument",
  statut: "mapping.field-statut",
  quantite: "mapping.field-quantite",
  prix_xaf: "mapping.field-prix_xaf",
  valeur_nominale_xaf: "mapping.field-valeur_nominale_xaf",
  montant_brut_xaf: "mapping.field-montant_brut_xaf",
  courus_xaf: "mapping.field-courus_xaf",
  taux_interet: "mapping.field-taux_interet",
  date_operation: "mapping.field-date_operation",
  date_valeur: "mapping.field-date_valeur",
  date_saisie: "mapping.field-date_saisie",
  date_validation: "mapping.field-date_validation",
  operateur_saisie: "mapping.field-operateur_saisie",
  operateur_validation: "mapping.field-operateur_validation",
};

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
  const t = useT();
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
    const e: Record<string, TKey> = {};
    for (const f of MAPPABLE_FIELDS) {
      if (!f.required) continue;
      const idx = mapping[f.key];
      if (idx === null || idx === undefined) {
        e[f.key] = "mapping.error-not-mapped";
      } else if (apercu(idx) === "") {
        e[f.key] = "mapping.error-empty-column";
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
        <p>{t("mapping.unrecognized-structure")}</p>
      </div>

      <div className="mapping-grid">
        {MAPPABLE_FIELDS.map((f) => {
          const idx = mapping[f.key];
          const erreur = errors[f.key];
          const selectId = `map-${f.key}`;
          return (
            <div className="mapping-row" key={f.key}>
              <label className="mapping-row__field" htmlFor={selectId}>
                {t(FIELD_LABEL_KEY[f.key])}
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
                <option value="">{t("mapping.option-unmapped")}</option>
                {headers.map((h, i) => (
                  <option key={i} value={i}>
                    {t("mapping.option-column", {
                      n: i + 1,
                      titre: h || t("mapping.column-untitled"),
                    })}
                  </option>
                ))}
              </select>
              <span className="mapping-row__preview">
                {erreur ? (
                  <span className="report-field__error">{t(erreur)}</span>
                ) : (
                  apercu(idx) && <>{t("mapping.preview", { valeurs: apercu(idx) })}</>
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
          {t("mapping.remember")}
        </label>
        <div className="import-notice__actions">
          <button
            className="btn btn--primary"
            disabled={!valide}
            onClick={() => onConfirm(mapping, remember)}
          >
            {t("mapping.confirm")}
          </button>
          <button className="btn" onClick={onCancel}>
            {t("mapping.cancel")}
          </button>
        </div>
      </div>
    </div>
  );
}
