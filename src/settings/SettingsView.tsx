// Écran « Paramètres » · configuration de la société de bourse (parametres_sdb).
// Ces champs alimentent les en-têtes et pieds de page de tous les rapports.
// Voir specs/10-CONFIG-SDB.md.

import { useEffect, useState } from "react";
import { getPocketBase } from "../lib/pocketbase";
import { DEFAULT_SDB_CONFIG, type SdbConfig } from "../lib/parametres-sdb";

type FieldKind = "text" | "number" | "date" | "textarea";

interface FieldDef {
  key: keyof SdbConfig;
  label: string;
  kind?: FieldKind;
}

interface Section {
  titre: string;
  champs: FieldDef[];
}

const SECTIONS: Section[] = [
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
    titre: "Mentions légales (modèles)",
    champs: [
      { key: "mentions_releve", label: "Mentions · relevés et attestations", kind: "textarea" },
      { key: "mentions_declaration", label: "Mentions · déclarations réglementaires", kind: "textarea" },
      { key: "mentions_facture", label: "Mentions · factures", kind: "textarea" },
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

type FormState = Record<keyof SdbConfig, string>;

function configToForm(c: SdbConfig): FormState {
  const out = {} as FormState;
  for (const key of Object.keys(DEFAULT_SDB_CONFIG) as (keyof SdbConfig)[]) {
    const v = c[key];
    out[key] = v === undefined || v === null ? "" : String(v);
  }
  return out;
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
        <div className="card">
          {notice.kind === "chargement" ? (
            <p className="card__lead">Chargement de la configuration…</p>
          ) : (
            <div className="report-form">
              {SECTIONS.map((section) => (
                <div key={section.titre}>
                  <span className="small-caps">{section.titre}</span>
                  {section.champs.map((champ) => (
                    <label className="report-field" key={String(champ.key)}>
                      <span className="small-caps">{champ.label}</span>
                      {champ.kind === "textarea" ? (
                        <textarea
                          rows={3}
                          value={form[champ.key]}
                          onChange={(e) => set(champ.key, e.target.value)}
                        />
                      ) : (
                        <input
                          type={champ.kind === "number" ? "number" : champ.kind === "date" ? "date" : "text"}
                          value={form[champ.key]}
                          onChange={(e) => set(champ.key, e.target.value)}
                        />
                      )}
                    </label>
                  ))}
                </div>
              ))}

              <div>
                <span className="small-caps">Logo</span>
                <label className="report-field">
                  <span className="small-caps">
                    Image (PNG, JPEG ou WebP · 5 Mo max)
                  </span>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={(e) => setLogoFile(e.target.files?.[0] ?? null)}
                  />
                </label>
              </div>

              <p
                style={{
                  fontSize: 12,
                  color: "var(--mw-fg-muted, #6b7178)",
                  margin: 0,
                }}
              >
                Astuce mentions : utilisez des jetons entre accolades, par exemple
                {" {raison_sociale}, {capital_social}, {rccm}, {niu},"}
                {" {agrement_cosumaf}, {ville}. Un segment dont tous les jetons sont"}
                {" vides est automatiquement masqué."}
              </p>

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
                <p className="import-notice" style={{ marginTop: 8 }}>
                  Configuration enregistrée. Les prochains rapports l'utiliseront.
                </p>
              )}
              {notice.kind === "erreur" && (
                <p
                  className="import-notice"
                  style={{ marginTop: 8, color: "var(--color-danger, #8A2D2D)" }}
                >
                  Erreur : {notice.message}
                </p>
              )}
            </div>
          )}
        </div>
      </section>
    </>
  );
}
