import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { createPortal } from "react-dom";
import { getPocketBase } from "../lib/pocketbase";
import { saveBytes } from "../lib/fileio";
import {
  generateAttestation,
  listClientsWithPositions,
  type ClientChoice,
} from "./services/attestation";
import { generateReleve } from "./services/releve";
import { generateConfirmationOuverture } from "./services/confirmation-ouverture";
import {
  generateTransactionsBoursieres,
  generateSituationAvoirs,
} from "./services/cosumaf";
import {
  generateEtatClientsDesherence,
  generateLettreRelanceDesherence,
} from "./services/desherence";
import { ErrorState } from "../ui/states";
import { useT, useLocale, type TKey } from "../i18n";

type ReportType =
  | "attestation"
  | "releve"
  | "confirmation_ouverture"
  | "lettre_desherence"
  | "cosumaf_transactions"
  | "cosumaf_avoirs"
  | "etat_desherence";

/** Portée d'un rapport : par client sélectionné, ou à l'échelle de la société. */
type ReportScope = "client" | "societe";

interface ReportDef {
  id: ReportType;
  labelKey: TKey;
  scope: ReportScope;
  groupeKey: TKey;
}

const REPORT_TYPES: ReportDef[] = [
  { id: "attestation", labelKey: "reports.type-attestation", scope: "client", groupeKey: "reports.group-client-documents" },
  { id: "releve", labelKey: "reports.type-releve", scope: "client", groupeKey: "reports.group-client-documents" },
  { id: "confirmation_ouverture", labelKey: "reports.type-confirmation-ouverture", scope: "client", groupeKey: "reports.group-client-documents" },
  { id: "lettre_desherence", labelKey: "reports.type-lettre-desherence", scope: "client", groupeKey: "reports.group-client-documents" },
  { id: "cosumaf_transactions", labelKey: "reports.type-cosumaf-transactions", scope: "societe", groupeKey: "reports.group-regulatory-company" },
  { id: "cosumaf_avoirs", labelKey: "reports.type-cosumaf-avoirs", scope: "societe", groupeKey: "reports.group-regulatory-company" },
  { id: "etat_desherence", labelKey: "reports.type-etat-desherence", scope: "societe", groupeKey: "reports.group-regulatory-company" },
];

function scopeOf(id: ReportType): ReportScope {
  return REPORT_TYPES.find((r) => r.id === id)?.scope ?? "client";
}

interface ComboOption {
  id: string;
  label: string;
}

/** Liste déroulante recherchable (combobox autonome, sans dépendance). */
function SearchableSelect({
  options,
  value,
  onChange,
  placeholder,
}: {
  options: ComboOption[];
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const listId = "combo-list";

  const selected = options.find((o) => o.id === value);
  const q = query.trim().toLowerCase();
  const filtered = (
    q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options
  ).slice(0, 50);

  useEffect(() => {
    function onDocDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocDown);
    return () => document.removeEventListener("mousedown", onDocDown);
  }, []);

  // Garde l'option active dans les bornes et visible.
  useEffect(() => {
    if (active >= filtered.length) setActive(0);
    if (open) {
      document
        .getElementById(`combo-opt-${active}`)
        ?.scrollIntoView({ block: "nearest" });
    }
  }, [active, filtered.length, open]);

  function choisir(id: string) {
    onChange(id);
    setOpen(false);
    setQuery("");
  }

  function onKey(e: ReactKeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((a) => Math.min(a + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      if (open && filtered[active]) {
        e.preventDefault();
        choisir(filtered[active].id);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div className="combobox" ref={ref}>
      <input
        className="combobox__input"
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open ? `combo-opt-${active}` : undefined}
        placeholder={placeholder}
        value={open ? query : (selected?.label ?? "")}
        onFocus={() => {
          setOpen(true);
          setQuery("");
          setActive(0);
        }}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          setActive(0);
        }}
        onKeyDown={onKey}
      />
      <span className="combobox__caret" aria-hidden="true">▾</span>
      {open && (
        <ul className="combobox__list" role="listbox" id={listId}>
          {filtered.length === 0 ? (
            <li className="combobox__empty">{t("reports.no-result")}</li>
          ) : (
            filtered.map((o, i) => (
              <li
                key={o.id}
                id={`combo-opt-${i}`}
                role="option"
                aria-selected={i === active}
                className={
                  "combobox__option" +
                  (i === active ? " combobox__option--active" : "")
                }
                onMouseEnter={() => setActive(i)}
                onMouseDown={(e) => {
                  e.preventDefault();
                  choisir(o.id);
                }}
              >
                {o.label}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}

type GenState =
  | { kind: "idle" }
  | { kind: "generation" }
  | { kind: "erreur"; message: string };

/** Aperçu PDF courant (avant téléchargement ou impression). */
interface Preview {
  url: string; // object URL du Blob (affiché dans l'iframe)
  bytes: Uint8Array;
  filename: string;
  hash: string;
  label: string;
  scopeLabel: string; // « Document client » ou « État réglementaire (société) »
  generatedAt: string; // horodatage de génération (formaté fr-FR)
  sizeKo: number; // taille du PDF en kilo-octets
}

type SaveNotice =
  | { kind: "idle" }
  | { kind: "ok"; filename: string }
  | { kind: "annule" };

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

/** Dernier jour du mois « AAAA-MM » au format ISO (date d'arrêté mensuelle). */
function finDeMois(ym: string): string {
  if (!/^\d{4}-\d{2}$/.test(ym)) return todayIso();
  const [a, m] = ym.split("-").map(Number);
  const dernier = new Date(a, m, 0).getDate(); // jour 0 du mois suivant = fin du mois
  return `${ym}-${String(dernier).padStart(2, "0")}`;
}

export function ReportsView({
  initialClientId,
}: {
  /** Client à pré-sélectionner (passerelle « Générer un rapport » depuis Clients). */
  initialClientId?: string | null;
} = {}) {
  const t = useT();
  const locale = useLocale();
  const [clients, setClients] = useState<ClientChoice[] | null>(null);
  const [clientId, setClientId] = useState<string>("");
  const [reportType, setReportType] = useState<ReportType>("attestation");
  const [dateArrete, setDateArrete] = useState<string>(todayIso());
  const [gen, setGen] = useState<GenState>({ kind: "idle" });
  const [preview, setPreview] = useState<Preview | null>(null);
  const [save, setSave] = useState<SaveNotice>({ kind: "idle" });
  const [loadError, setLoadError] = useState<string | null>(null);
  const [printing, setPrinting] = useState(false); // modale d'impression ouverte
  const printFrameRef = useRef<HTMLIFrameElement>(null);
  const printOverlayRef = useRef<HTMLDivElement>(null);
  const focusAvantModaleRef = useRef<HTMLElement | null>(null);

  const charger = useCallback(async () => {
    try {
      const pb = await getPocketBase();
      const list = await listClientsWithPositions(pb);
      setClients(list);
      if (list.length > 0) {
        // Honore le client pré-sélectionné s'il a des positions, sinon le 1er.
        const voulu =
          initialClientId && list.some((c) => c.id === initialClientId)
            ? initialClientId
            : list[0].id;
        setClientId(voulu);
      }
    } catch (err) {
      setLoadError(String(err));
    }
  }, [initialClientId]);

  useEffect(() => {
    void charger();
  }, [charger]);

  // Libère l'object URL courant au démontage (évite les fuites mémoire).
  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview.url);
    };
  }, [preview]);

  // Modale d'impression : piège de focus, fermeture par Échap, fond inert,
  // restitution du focus à la fermeture (a11y des fenêtres modales).
  useEffect(() => {
    if (!printing) return;
    focusAvantModaleRef.current = document.activeElement as HTMLElement | null;
    const shell = document.querySelector(".app-shell");
    shell?.setAttribute("inert", "");

    const focusables = (): HTMLElement[] => {
      const root = printOverlayRef.current;
      if (!root) return [];
      return Array.from(
        root.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], iframe, [tabindex]:not([tabindex="-1"])',
        ),
      );
    };

    // Déplace le focus à l'intérieur de la modale à l'ouverture.
    window.requestAnimationFrame(() => focusables()[0]?.focus());

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        setPrinting(false);
        return;
      }
      if (e.key !== "Tab") return;
      const f = focusables();
      if (f.length === 0) return;
      const premier = f[0];
      const dernier = f[f.length - 1];
      if (e.shiftKey && document.activeElement === premier) {
        e.preventDefault();
        dernier.focus();
      } else if (!e.shiftKey && document.activeElement === dernier) {
        e.preventDefault();
        premier.focus();
      }
    }

    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      shell?.removeAttribute("inert");
      focusAvantModaleRef.current?.focus();
    };
  }, [printing]);

  function fermerApercu() {
    if (preview) URL.revokeObjectURL(preview.url);
    setPreview(null);
    setSave({ kind: "idle" });
    setPrinting(false);
  }

  async function generer() {
    const scope = scopeOf(reportType);
    if (scope === "client" && !clientId) return;
    setGen({ kind: "generation" });
    setSave({ kind: "idle" });
    try {
      const pb = await getPocketBase();
      let out: { blob: Blob; bytes: Uint8Array; hash: string; filename: string };
      switch (reportType) {
        case "attestation":
          out = await generateAttestation(pb, clientId, dateArrete);
          break;
        case "releve":
          out = await generateReleve(pb, clientId, dateArrete);
          break;
        case "confirmation_ouverture":
          out = await generateConfirmationOuverture(pb, clientId, dateArrete);
          break;
        case "lettre_desherence":
          out = await generateLettreRelanceDesherence(pb, clientId, dateArrete);
          break;
        case "cosumaf_transactions":
          out = await generateTransactionsBoursieres(pb, dateArrete);
          break;
        case "cosumaf_avoirs":
          out = await generateSituationAvoirs(pb, dateArrete);
          break;
        case "etat_desherence":
          out = await generateEtatClientsDesherence(pb, dateArrete);
          break;
      }

      // Aperçu avant tout enregistrement : on n'écrit rien sur disque ici.
      if (preview) URL.revokeObjectURL(preview.url);
      const url = URL.createObjectURL(out.blob);
      const labelKey = REPORT_TYPES.find((r) => r.id === reportType)?.labelKey;
      const label = labelKey ? t(labelKey) : t("reports.fallback-label");
      setPreview({
        url,
        bytes: out.bytes,
        filename: out.filename,
        hash: out.hash,
        label,
        scopeLabel:
          scope === "societe"
            ? t("reports.scope-regulatory-company")
            : t("reports.scope-client-document"),
        generatedAt: new Date().toLocaleString(locale),
        sizeKo: Math.max(1, Math.round(out.bytes.length / 1024)),
      });
      setGen({ kind: "idle" });
    } catch (err) {
      setGen({ kind: "erreur", message: String(err) });
    }
  }

  async function telecharger() {
    if (!preview) return;
    try {
      const ok = await saveBytes(preview.bytes, preview.filename);
      setSave(ok ? { kind: "ok", filename: preview.filename } : { kind: "annule" });
    } catch (err) {
      setGen({ kind: "erreur", message: String(err) });
    }
  }

  // L'impression passe par une modale dédiée : on l'ouvre ici, et le rendu du
  // document y déclenche le dialogue d'impression natif (cf. lancerImpression).
  function imprimer() {
    setPrinting(true);
  }

  function lancerImpression() {
    const win = printFrameRef.current?.contentWindow;
    if (win) {
      win.focus();
      win.print();
    }
  }

  return (
    <>
      <header className="app-header">
        <h1 className="app-header__title">{t("reports.header-title")}</h1>
        <p className="app-header__subtitle">
          {t("reports.header-subtitle")}
        </p>
      </header>

      <section className="app-content">
        <div className="reports-controls card">
          <span className="small-caps">{t("reports.production-title")}</span>

          {loadError && (
            <ErrorState
              message={t("reports.load-error")}
              detail={loadError}
              onRetry={() => {
                setLoadError(null);
                void charger();
              }}
            />
          )}

          {clients !== null && (
            <div className="reports-form-row">
              <label className="report-field">
                <span className="small-caps">{t("reports.field-report-type")}</span>
                <select
                  value={reportType}
                  onChange={(e) => setReportType(e.target.value as ReportType)}
                >
                  {[...new Set(REPORT_TYPES.map((r) => r.groupeKey))].map((g) => (
                    <optgroup key={g} label={t(g)}>
                      {REPORT_TYPES.filter((r) => r.groupeKey === g).map((r) => (
                        <option key={r.id} value={r.id}>
                          {t(r.labelKey)}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </label>

              {scopeOf(reportType) === "client" &&
                (clients.length > 0 ? (
                  <label className="report-field reports-field--client">
                    <span className="small-caps">{t("reports.field-client")}</span>
                    <SearchableSelect
                      value={clientId}
                      onChange={setClientId}
                      placeholder={t("reports.client-search-placeholder")}
                      options={clients.map((c) => ({
                        id: c.id,
                        label: `${c.nom_complet} · ${c.code} (${
                          c.nb_positions > 1
                            ? t("reports.positions-plural", {
                                count: String(c.nb_positions),
                              })
                            : t("reports.positions-singular", {
                                count: String(c.nb_positions),
                              })
                        })`,
                      }))}
                    />
                  </label>
                ) : (
                  <div className="import-notice import-notice--warn reports-warn">
                    <p>
                      {t("reports.no-client-with-position")}
                    </p>
                  </div>
                ))}

              <label className="report-field">
                <span className="small-caps">
                  {scopeOf(reportType) === "societe"
                    ? t("reports.field-cutoff-month")
                    : t("reports.field-cutoff-date")}
                </span>
                {scopeOf(reportType) === "societe" ? (
                  <input
                    type="month"
                    value={dateArrete.slice(0, 7)}
                    onChange={(e) => setDateArrete(finDeMois(e.target.value))}
                  />
                ) : (
                  <input
                    type="date"
                    value={dateArrete}
                    onChange={(e) => setDateArrete(e.target.value)}
                  />
                )}
              </label>

              <button
                className="btn btn--primary reports-generate"
                onClick={generer}
                disabled={
                  gen.kind === "generation" ||
                  (scopeOf(reportType) === "client" &&
                    (clients.length === 0 || !clientId))
                }
              >
                {gen.kind === "generation"
                  ? t("reports.generating")
                  : t("reports.generate-preview")}
              </button>
            </div>
          )}

          {gen.kind === "erreur" && (
            <ErrorState
              message={t("reports.generation-error")}
              detail={gen.message}
              onRetry={generer}
            />
          )}

          <div className="sr-only" role="status" aria-live="polite">
            {gen.kind === "generation" ? t("reports.generation-in-progress") : ""}
          </div>
        </div>

        {preview ? (
          <div className="reports-preview">
            <div className="reports-doc">
              <div className="reports-doc__head">
                <span className="small-caps">{t("reports.document-preview")}</span>
                <p className="reports-doc__title">{preview.label}</p>
              </div>
              <iframe
                className="reports-doc__frame"
                src={preview.url}
                title={t("reports.preview-frame-title", { label: preview.label })}
              />
            </div>

            <aside className="reports-rail">
              <div className="reports-rail__actions">
                <button className="btn btn--primary" onClick={imprimer}>
                  {t("reports.print")}
                </button>
                <button className="btn" onClick={telecharger}>
                  {t("reports.download")}
                </button>
                <button className="btn" onClick={fermerApercu}>
                  {t("reports.close-preview")}
                </button>
              </div>

              <div role="status" aria-live="polite">
                {save.kind === "ok" && (
                  <div className="preview-rail__notice preview-rail__notice--ok">
                    {t("reports.saved-notice", { filename: save.filename })}
                  </div>
                )}
                {save.kind === "annule" && (
                  <div className="preview-rail__notice">
                    {t("reports.save-cancelled")}
                  </div>
                )}
              </div>

              <section className="preview-rail__block">
                <span className="small-caps">{t("reports.key-info")}</span>
                <dl className="preview-meta">
                  <div className="preview-meta__row">
                    <dt>{t("reports.meta-scope")}</dt>
                    <dd>{preview.scopeLabel}</dd>
                  </div>
                  <div className="preview-meta__row">
                    <dt>{t("reports.meta-file")}</dt>
                    <dd className="preview-meta__mono">{preview.filename}</dd>
                  </div>
                  <div className="preview-meta__row">
                    <dt>{t("reports.meta-size")}</dt>
                    <dd>{t("reports.meta-size-value", { size: String(preview.sizeKo) })}</dd>
                  </div>
                  <div className="preview-meta__row">
                    <dt>{t("reports.meta-generated-on")}</dt>
                    <dd>{preview.generatedAt}</dd>
                  </div>
                </dl>
              </section>

              <section className="preview-rail__block">
                <span className="small-caps">{t("reports.sha256-fingerprint")}</span>
                <code className="preview-hash">{preview.hash}</code>
              </section>

              <section className="preview-rail__block">
                <span className="small-caps">{t("reports.production-steps-title")}</span>
                <ul className="preview-steps">
                  <li>{t("reports.step-data-read")}</li>
                  <li>{t("reports.step-pdf-render")}</li>
                  <li>{t("reports.step-sha256-computed")}</li>
                  <li>{t("reports.step-preview-ready")}</li>
                </ul>
              </section>
            </aside>
          </div>
        ) : (
          <div className="reports-empty">
            <div className="reports-empty__icon" aria-hidden="true">
              <svg width="34" height="34" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"
                strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <path d="M14 2v6h6" />
                <path d="M8 13h8M8 17h6" />
              </svg>
            </div>
            <p className="reports-empty__text">
              {t("reports.empty-hint")}
            </p>
          </div>
        )}
      </section>

      {/* Modale dédiée à l'impression du document affiché (portail hors du
          <main> pour pouvoir rendre la coquille inerte). */}
      {printing &&
        preview &&
        createPortal(
          <div
            className="preview-overlay"
            role="dialog"
            aria-modal="true"
            aria-label={`Impression · ${preview.label}`}
            ref={printOverlayRef}
            onClick={(e) => {
              if (e.target === e.currentTarget) setPrinting(false);
            }}
          >
            <div className="preview-modal print-modal">
              <div className="preview-modal__head">
                <div>
                  <span className="small-caps">Impression</span>
                  <p className="preview-modal__title">{preview.label}</p>
                </div>
                <div className="preview-actions">
                  <button className="btn btn--primary" onClick={lancerImpression}>
                    Imprimer
                  </button>
                  <button className="btn" onClick={() => setPrinting(false)}>
                    Fermer
                  </button>
                </div>
              </div>
              <iframe
                ref={printFrameRef}
                className="preview-frame"
                src={preview.url}
                title={`Impression ${preview.label}`}
              />
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
