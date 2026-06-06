// Écran « Paramètres » · configuration de la société de bourse (parametres_sdb).
// Ces champs alimentent les en-têtes et pieds de page de tous les rapports.
// Voir specs/10-CONFIG-SDB.md.
//
// Mise en page en panneaux par section (occupe la largeur), aperçu du logo et
// aperçu en direct des mentions interpolées, barre d'enregistrement collante.

import { useEffect, useMemo, useRef, useState } from "react";
import { getPocketBase } from "../lib/pocketbase";
import {
  DEFAULT_SDB_CONFIG,
  buildMentionsLines,
  type SdbConfig,
  type MentionsFamily,
} from "../lib/parametres-sdb";
import { LoadingState, ErrorState } from "../ui/states";
import { setUnsavedGuard } from "../lib/unsaved-guard";
import "./settings.css";

type FieldKind = "text" | "number" | "date";

interface FieldDef {
  key: keyof SdbConfig;
  label: string;
  kind?: FieldKind;
  required?: boolean;
}

/** Champs obligatoires (identité et identifiants légaux exigés par le régulateur). */
const REQUIRED_FIELDS: (keyof SdbConfig)[] = [
  "raison_sociale",
  "agrement_cosumaf",
  "rccm",
  "niu",
  "email_contact",
];

const RE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RE_URL = /^https?:\/\/.+/i;

type FieldErrors = Partial<Record<keyof SdbConfig, string>>;

/** Valide le formulaire. Renvoie une carte champ → message (vide si tout est bon). */
function validateForm(form: Record<keyof SdbConfig, string>): FieldErrors {
  const errs: FieldErrors = {};
  for (const k of REQUIRED_FIELDS) {
    if (!form[k]?.trim()) errs[k] = "Ce champ est obligatoire.";
  }
  const email = form.email_contact?.trim();
  if (email && !RE_EMAIL.test(email)) {
    errs.email_contact = "Adresse email invalide (ex. contact@societe.cm).";
  }
  const url = form.site_web?.trim();
  if (url && !RE_URL.test(url)) {
    errs.site_web = "URL invalide (commencez par http:// ou https://).";
  }
  return errs;
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
      { key: "raison_sociale", label: "Raison sociale", required: true },
      { key: "code", label: "Code" },
      { key: "forme_juridique", label: "Forme juridique" },
      { key: "capital_social", label: "Capital social", kind: "number" },
      { key: "devise_capital", label: "Devise du capital" },
    ],
  },
  {
    titre: "Identifiants légaux",
    champs: [
      { key: "agrement_cosumaf", label: "Agrément COSUMAF", required: true },
      { key: "date_agrement", label: "Date d'agrément", kind: "date" },
      { key: "rccm", label: "RCCM", required: true },
      { key: "niu", label: "NIU", required: true },
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
      { key: "email_contact", label: "Email de contact", required: true },
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
  const [errors, setErrors] = useState<FieldErrors>({});
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  // Instantané du formulaire au chargement, pour détecter les modifications.
  const [snapshot, setSnapshot] = useState<FormState>(() =>
    configToForm(DEFAULT_SDB_CONFIG),
  );

  // Modifications en attente : formulaire différent de l'instantané, ou nouveau logo.
  const dirty = useMemo(
    () => logoFile !== null || JSON.stringify(form) !== JSON.stringify(snapshot),
    [form, snapshot, logoFile],
  );

  // Expose l'état « dirty » à la coquille (garde de navigation) + alerte de fermeture.
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;
  useEffect(() => {
    setUnsavedGuard(() => dirtyRef.current);
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (dirtyRef.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      setUnsavedGuard(null);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, []);

  useEffect(() => {
    let annule = false;
    setNotice({ kind: "chargement" });
    setLoadError(null);
    void (async () => {
      try {
        const pb = await getPocketBase();
        const list = await pb.collection("parametres_sdb").getFullList();
        if (annule) return;
        let chargee = configToForm(DEFAULT_SDB_CONFIG);
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
          chargee = configToForm(merged);
          // Aperçu du logo déjà enregistré, le cas échéant.
          if (typeof rec.logo === "string" && rec.logo) {
            setLogoApercu(
              `${pb.baseURL}/api/files/${rec.collectionId}/${rec.id}/${rec.logo}`,
            );
          }
        }
        setForm(chargee);
        setSnapshot(chargee);
        setNotice({ kind: "idle" });
      } catch (err) {
        if (!annule) setLoadError(String(err));
      }
    })();
    return () => {
      annule = true;
    };
  }, [reloadKey]);

  function set(key: keyof SdbConfig, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
    // Le bandeau de succès est furtif : il disparaît dès qu'on modifie un champ.
    setNotice((n) => (n.kind === "ok" ? { kind: "idle" } : n));
    // Efface l'erreur du champ corrigé.
    setErrors((e) => {
      if (!e[key]) return e;
      const next = { ...e };
      delete next[key];
      return next;
    });
  }

  function choisirLogo(file: File | null) {
    setLogoFile(file);
    if (file) setLogoApercu(URL.createObjectURL(file));
    setNotice((n) => (n.kind === "ok" ? { kind: "idle" } : n));
  }

  // Aperçu des mentions interpolées, recalculé à la frappe.
  const apercuMentions = useMemo(() => {
    const cfg = formToConfig(form);
    const out = {} as Record<MentionsFamily, string[]>;
    for (const m of MENTIONS_FIELDS) out[m.family] = buildMentionsLines(cfg, m.family);
    return out;
  }, [form]);

  async function enregistrer() {
    const errs = validateForm(form);
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      setNotice({
        kind: "erreur",
        message:
          "Certains champs obligatoires sont manquants ou invalides. Corrigez-les avant d'enregistrer.",
      });
      // Place le focus sur le premier champ en erreur.
      const premier = Object.keys(errs)[0];
      window.requestAnimationFrame(() => {
        document.getElementById(`field-${premier}`)?.focus();
      });
      return;
    }
    setErrors({});
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
      // Le formulaire enregistré devient le nouvel instantané : plus rien « dirty ».
      setSnapshot({ ...form });
      setLogoFile(null);
      setNotice({ kind: "ok" });
    } catch (err) {
      setNotice({ kind: "erreur", message: String(err) });
    }
  }

  function renderField(champ: FieldDef) {
    const id = `field-${String(champ.key)}`;
    const erreur = errors[champ.key];
    const errId = erreur ? `${id}-err` : undefined;
    return (
      <label className="report-field" key={String(champ.key)} htmlFor={id}>
        <span className="small-caps">
          {champ.label}
          {champ.required && (
            <span className="report-field__required" aria-hidden="true">
              {" "}
              *
            </span>
          )}
        </span>
        <input
          id={id}
          type={
            champ.kind === "number"
              ? "number"
              : champ.kind === "date"
                ? "date"
                : "text"
          }
          value={form[champ.key]}
          onChange={(e) => set(champ.key, e.target.value)}
          required={champ.required}
          aria-required={champ.required || undefined}
          aria-invalid={erreur ? true : undefined}
          aria-describedby={errId}
          className={erreur ? "input--invalid" : undefined}
        />
        {erreur && (
          <span className="report-field__error" id={errId}>
            {erreur}
          </span>
        )}
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
        {loadError ? (
          <ErrorState
            message="Impossible de charger la configuration. Vérifiez que le serveur de données local est démarré, puis réessayez."
            detail={loadError}
            onRetry={() => setReloadKey((k) => k + 1)}
          />
        ) : notice.kind === "chargement" ? (
          <LoadingState
            variant="card"
            label="Chargement de la configuration en cours…"
          />
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
              {dirty && notice.kind !== "enregistrement" && (
                <span className="settings-actions__dirty">
                  Modifications non enregistrées
                </span>
              )}
              <div role="status" aria-live="polite">
                {notice.kind === "ok" && (
                  <span className="settings-actions__notice settings-actions__notice--ok">
                    Configuration enregistrée. Les prochains rapports l'utiliseront.
                  </span>
                )}
              </div>
              <div role="alert">
                {notice.kind === "erreur" && (
                  <span className="settings-actions__notice settings-actions__notice--err">
                    {notice.message}
                  </span>
                )}
              </div>
            </div>
          </div>
        )}
      </section>
    </>
  );
}
