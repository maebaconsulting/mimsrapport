// Écran « Paramètres » · configuration de la société de bourse (parametres_sdb).
// Ces champs alimentent les en-têtes et pieds de page de tous les rapports.
// Voir specs/10-CONFIG-SDB.md.
//
// Mise en page en panneaux par section (occupe la largeur), aperçu du logo et
// aperçu en direct des mentions interpolées, barre d'enregistrement collante.

import { useEffect, useMemo, useState } from "react";
import { getPocketBase } from "../lib/pocketbase";
import {
  DEFAULT_SDB_CONFIG,
  buildMentionsLines,
  type SdbConfig,
  type MentionsFamily,
} from "../lib/parametres-sdb";
import "./settings.css";

type FieldKind = "text" | "number" | "date";

interface FieldDef {
  key: keyof SdbConfig;
  label: string;
  kind?: FieldKind;
}

interface Section {
  titre: string;
  champs: FieldDef[];
}

/** Sections de champs courts, rendues en panneaux avec grille de champs. */
const FIELD_SECTIONS: Section[] = [
  {
    titre: "Identité",
    champs: [
      { key: "raison_sociale", label: "Raison sociale" },
      { key: "code", label: "Code" },
      { key: "forme_juridique", label: "Forme juridique" },
      { key: "capital_social", label: "Capital social", kind: "number" },
      { key: "devise_capital", label: "Devise du capital" },
    ],
  },
  {
    titre: "Identifiants légaux",
    champs: [
      { key: "agrement_cosumaf", label: "Agrément COSUMAF" },
      { key: "date_agrement", label: "Date d'agrément", kind: "date" },
      { key: "rccm", label: "RCCM" },
      { key: "niu", label: "NIU" },
      { key: "code_member_bvmac", label: "Code membre BVMAC" },
      { key: "code_dcr", label: "Code DCR" },
    ],
  },
  {
    titre: "Adresse",
    champs: [
      { key: "bp", label: "Boîte postale" },
      { key: "adresse_rue", label: "Rue" },
      { key: "ville", label: "Ville" },
      { key: "pays", label: "Pays" },
    ],
  },
  {
    titre: "Contacts",
    champs: [
      { key: "telephone_principal", label: "Téléphone principal" },
      { key: "telephone_secondaire", label: "Téléphone secondaire" },
      { key: "email_contact", label: "Email de contact" },
      { key: "site_web", label: "Site web" },
    ],
  },
  {
    titre: "Période d'effet",
    champs: [
      { key: "date_effet_debut", label: "Début d'effet", kind: "date" },
      { key: "date_effet_fin", label: "Fin d'effet (vide = courant)", kind: "date" },
    ],
  },
];

/** Modèles de mentions (textarea + aperçu interpolé), par famille de document. */
const MENTIONS_FIELDS: Array<{
  key: keyof SdbConfig;
  label: string;
  family: MentionsFamily;
}> = [
  { key: "mentions_releve", label: "Relevés et attestations", family: "releve" },
  { key: "mentions_declaration", label: "Déclarations réglementaires", family: "declaration" },
  { key: "mentions_facture", label: "Factures", family: "facture" },
];

type FormState = Record<keyof SdbConfig, string>;

function configToForm(c: SdbConfig): FormState {
  const out = {} as FormState;
  for (const key of Object.keys(DEFAULT_SDB_CONFIG) as (keyof SdbConfig)[]) {
    const v = c[key];
    out[key] = v === undefined || v === null ? "" : String(v);
  }
  return out;
}

/** Reconstruit un SdbConfig depuis le formulaire (pour l'aperçu des mentions). */
function formToConfig(form: FormState): SdbConfig {
  return {
    ...DEFAULT_SDB_CONFIG,
    ...form,
    capital_social: Number(form.capital_social) || 0,
  } as SdbConfig;
}

type Notice =
  | { kind: "idle" }
  | { kind: "chargement" }
  | { kind: "enregistrement" }
  | { kind: "ok" }
  | { kind: "erreur"; message: string };

export function SettingsView() {
  const [form, setForm] = useState<FormState>(configToForm(DEFAULT_SDB_CONFIG));
  const [recordId, setRecordId] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoApercu, setLogoApercu] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice>({ kind: "chargement" });

  useEffect(() => {
    void (async () => {
      try {
        const pb = await getPocketBase();
        const list = await pb.collection("parametres_sdb").getFullList();
        if (list.length > 0) {
          const rec = list[0] as unknown as Record<string, unknown>;
          setRecordId(String(rec.id));
          const merged = { ...DEFAULT_SDB_CONFIG };
          for (const key of Object.keys(DEFAULT_SDB_CONFIG) as (keyof SdbConfig)[]) {
            const v = rec[key];
            if (v !== undefined && v !== null && v !== "") {
              if (key === "capital_social") merged.capital_social = Number(v);
              else (merged[key] as string) = String(v);
            }
          }
          setForm(configToForm(merged));
          // Aperçu du logo déjà enregistré, le cas échéant.
          if (typeof rec.logo === "string" && rec.logo) {
            setLogoApercu(
              `${pb.baseURL}/api/files/${rec.collectionId}/${rec.id}/${rec.logo}`,
            );
          }
        }
        setNotice({ kind: "idle" });
      } catch (err) {
        setNotice({ kind: "erreur", message: String(err) });
      }
    })();
  }, []);

  function set(key: keyof SdbConfig, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function choisirLogo(file: File | null) {
    setLogoFile(file);
    if (file) setLogoApercu(URL.createObjectURL(file));
  }

  // Aperçu des mentions interpolées, recalculé à la frappe.
  const apercuMentions = useMemo(() => {
    const cfg = formToConfig(form);
    const out = {} as Record<MentionsFamily, string[]>;
    for (const m of MENTIONS_FIELDS) out[m.family] = buildMentionsLines(cfg, m.family);
    return out;
  }, [form]);

  async function enregistrer() {
    setNotice({ kind: "enregistrement" });
    try {
      const pb = await getPocketBase();
      const data = new FormData();
      for (const key of Object.keys(DEFAULT_SDB_CONFIG) as (keyof SdbConfig)[]) {
        data.append(key, form[key] ?? "");
      }
      if (logoFile) data.append("logo", logoFile);

      if (recordId) {
        await pb.collection("parametres_sdb").update(recordId, data);
      } else {
        const created = await pb.collection("parametres_sdb").create(data);
        setRecordId(created.id);
      }
      setNotice({ kind: "ok" });
    } catch (err) {
      setNotice({ kind: "erreur", message: String(err) });
    }
  }

  function renderField(champ: FieldDef) {
    return (
      <label className="report-field" key={String(champ.key)}>
        <span className="small-caps">{champ.label}</span>
        <input
          type={
            champ.kind === "number"
              ? "number"
              : champ.kind === "date"
                ? "date"
                : "text"
          }
          value={form[champ.key]}
          onChange={(e) => set(champ.key, e.target.value)}
        />
      </label>
    );
  }

  return (
    <>
      <header className="app-header">
        <h1 className="app-header__title">Paramètres de la société de bourse</h1>
        <p className="app-header__subtitle">
          Identité, agrément et mentions légales repris dans les en-têtes et pieds
          de page de tous les rapports
        </p>
      </header>

      <section className="app-content">
        {notice.kind === "chargement" ? (
          <div className="card">
            <p className="card__lead">Chargement de la configuration…</p>
          </div>
        ) : (
          <div className="settings-view">
            <div className="settings-grid">
              {FIELD_SECTIONS.map((section) => (
                <div className="settings-panel" key={section.titre}>
                  <div className="settings-panel__head">
                    <span className="small-caps">{section.titre}</span>
                  </div>
                  <div className="settings-fields">
                    {section.champs.map(renderField)}
                  </div>
                </div>
              ))}

              <div className="settings-panel">
                <div className="settings-panel__head">
                  <span className="small-caps">Logo</span>
                </div>
                <div className="settings-logo">
                  <div className="settings-logo__preview">
                    {logoApercu ? (
                      <img src={logoApercu} alt="Aperçu du logo" />
                    ) : (
                      <span className="settings-logo__placeholder">
                        Aucun logo
                      </span>
                    )}
                  </div>
                  <label className="report-field settings-logo__input">
                    <span className="small-caps">
                      Image (PNG, JPEG ou WebP · 5 Mo max)
                    </span>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={(e) => choisirLogo(e.target.files?.[0] ?? null)}
                    />
                  </label>
                </div>
              </div>

              <div className="settings-panel settings-panel--wide">
                <div className="settings-panel__head">
                  <span className="small-caps">Mentions légales (modèles)</span>
                </div>
                <p className="settings-hint">
                  Utilisez des jetons entre accolades, par exemple{" "}
                  <code>{"{raison_sociale}"}</code>, <code>{"{capital_social}"}</code>,{" "}
                  <code>{"{rccm}"}</code>, <code>{"{niu}"}</code>,{" "}
                  <code>{"{agrement_cosumaf}"}</code>, <code>{"{ville}"}</code>. Un
                  segment dont tous les jetons sont vides est automatiquement masqué.
                </p>
                <div className="settings-mentions">
                  {MENTIONS_FIELDS.map((m) => (
                    <div className="settings-mention" key={String(m.key)}>
                      <label className="report-field">
                        <span className="small-caps">{m.label}</span>
                        <textarea
                          rows={3}
                          value={form[m.key]}
                          onChange={(e) => set(m.key, e.target.value)}
                        />
                      </label>
                      <div className="settings-preview">
                        <span className="small-caps">Aperçu en pied de page</span>
                        {apercuMentions[m.family].length > 0 ? (
                          apercuMentions[m.family].map((ligne, i) => (
                            <p key={i} className="settings-preview__line">
                              {ligne}
                            </p>
                          ))
                        ) : (
                          <p className="settings-preview__vide">
                            Aucune ligne (jetons vides).
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="settings-actions">
              <button
                className="btn btn--primary"
                onClick={enregistrer}
                disabled={notice.kind === "enregistrement"}
              >
                {notice.kind === "enregistrement"
                  ? "Enregistrement…"
                  : "Enregistrer la configuration"}
              </button>
              {notice.kind === "ok" && (
                <span className="settings-actions__notice settings-actions__notice--ok">
                  Configuration enregistrée. Les prochains rapports l'utiliseront.
                </span>
              )}
              {notice.kind === "erreur" && (
                <span className="settings-actions__notice settings-actions__notice--err">
                  Erreur : {notice.message}
                </span>
              )}
            </div>
          </div>
        )}
      </section>
    </>
  );
}
