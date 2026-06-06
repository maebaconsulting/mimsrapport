// -*- coding: utf-8 -*-
// Fiche de contact d'un client (modale). Édite les coordonnées saisies
// manuellement (clients_contacts) : email, mobile, téléphone, WhatsApp, adresse,
// notes. Ces données ne proviennent pas de l'import et survivent aux ré-imports.

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { getPocketBase } from "../lib/pocketbase";
import { withRetry } from "../lib/retry";
import { LoadingState, ErrorState } from "../ui/states";
import { useT } from "../i18n";

const RE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Form = {
  email: string;
  mobile: string;
  telephone: string;
  whatsapp: string;
  adresse: string;
  notes: string;
};

const EMPTY: Form = {
  email: "",
  mobile: "",
  telephone: "",
  whatsapp: "",
  adresse: "",
  notes: "",
};

type State =
  | { kind: "chargement" }
  | { kind: "pret" }
  | { kind: "erreur"; message: string };

export function ClientContactPanel({
  clientId,
  clientName,
  onClose,
  onSaved,
}: {
  clientId: string;
  clientName: string;
  onClose: () => void;
  onSaved?: () => void;
}) {
  const t = useT();
  const [state, setState] = useState<State>({ kind: "chargement" });
  const [recordId, setRecordId] = useState<string | null>(null);
  const [form, setForm] = useState<Form>(EMPTY);
  const [emailErr, setEmailErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveNotice, setSaveNotice] = useState<"idle" | "ok" | "erreur">("idle");
  const [saveErrMsg, setSaveErrMsg] = useState("");
  const overlayRef = useRef<HTMLDivElement>(null);
  const focusAvantRef = useRef<HTMLElement | null>(null);

  const charger = useCallback(async () => {
    setState({ kind: "chargement" });
    try {
      const pb = await getPocketBase();
      try {
        const rec = await pb
          .collection("clients_contacts")
          .getFirstListItem(pb.filter("client = {:c}", { c: clientId }));
        setRecordId(rec.id);
        setForm({
          email: String(rec.email ?? ""),
          mobile: String(rec.mobile ?? ""),
          telephone: String(rec.telephone ?? ""),
          whatsapp: String(rec.whatsapp ?? ""),
          adresse: String(rec.adresse ?? ""),
          notes: String(rec.notes ?? ""),
        });
      } catch {
        // 404 : aucune fiche encore, formulaire vierge.
        setRecordId(null);
        setForm(EMPTY);
      }
      setState({ kind: "pret" });
    } catch (err) {
      setState({ kind: "erreur", message: String(err) });
    }
  }, [clientId]);

  useEffect(() => {
    void charger();
  }, [charger]);

  // Focus piégé + Échap + restitution (modale accessible).
  useEffect(() => {
    focusAvantRef.current = document.activeElement as HTMLElement | null;
    const shell = document.querySelector(".app-shell");
    shell?.setAttribute("inert", "");
    const focusables = (): HTMLElement[] => {
      const root = overlayRef.current;
      if (!root) return [];
      return Array.from(
        root.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input, textarea, [tabindex]:not([tabindex="-1"])',
        ),
      );
    };
    // Préférer le premier champ de saisie ; sinon le premier élément focusable.
    window.requestAnimationFrame(() => {
      const f = focusables();
      const champ = f.find(
        (el) => el.tagName === "INPUT" || el.tagName === "TEXTAREA",
      );
      (champ ?? f[0])?.focus();
    });
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const f = focusables();
      if (f.length === 0) return;
      const first = f[0];
      const last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      shell?.removeAttribute("inert");
      focusAvantRef.current?.focus();
    };
  }, [onClose]);

  function set(key: keyof Form, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
    setSaveNotice("idle");
    if (key === "email") setEmailErr(null);
  }

  async function enregistrer() {
    const email = form.email.trim();
    if (email && !RE_EMAIL.test(email)) {
      setEmailErr(t("contact.email-invalide"));
      document.getElementById("contact-email")?.focus();
      return;
    }
    setSaving(true);
    setSaveNotice("idle");
    try {
      const pb = await getPocketBase();
      const data = { ...form, client: clientId };
      if (recordId) {
        await withRetry(() =>
          pb.collection("clients_contacts").update(recordId, data),
        );
      } else {
        const created = await withRetry(() =>
          pb.collection("clients_contacts").create(data),
        );
        setRecordId(created.id);
      }
      setSaveNotice("ok");
      onSaved?.();
    } catch (err) {
      setSaveNotice("erreur");
      setSaveErrMsg(String(err));
    } finally {
      setSaving(false);
    }
  }

  return createPortal(
    <div
      className="contact-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={t("contact.titre-aria", { nom: clientName })}
      ref={overlayRef}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="contact-modal">
        <div className="contact-modal__head">
          <div>
            <span className="small-caps">{t("contact.fiche-de-contact")}</span>
            <p className="contact-modal__title">{clientName}</p>
          </div>
          <button className="btn" onClick={onClose}>
            {t("contact.fermer")}
          </button>
        </div>

        <div className="contact-modal__body">
          {state.kind === "chargement" && (
            <LoadingState variant="card" label={t("contact.chargement")} />
          )}
          {state.kind === "erreur" && (
            <ErrorState
              message={t("contact.erreur-chargement")}
              detail={state.message}
              onRetry={() => void charger()}
            />
          )}
          {state.kind === "pret" && (
            <div className="contact-fields">
              <label className="report-field" htmlFor="contact-email">
                <span className="small-caps">{t("contact.email")}</span>
                <input
                  id="contact-email"
                  type="email"
                  value={form.email}
                  onChange={(e) => set("email", e.target.value)}
                  aria-invalid={emailErr ? true : undefined}
                  className={emailErr ? "input--invalid" : undefined}
                />
                {emailErr && (
                  <span className="report-field__error">{emailErr}</span>
                )}
              </label>
              <label className="report-field" htmlFor="contact-mobile">
                <span className="small-caps">{t("contact.mobile")}</span>
                <input
                  id="contact-mobile"
                  type="tel"
                  value={form.mobile}
                  onChange={(e) => set("mobile", e.target.value)}
                />
              </label>
              <label className="report-field" htmlFor="contact-telephone">
                <span className="small-caps">{t("contact.telephone")}</span>
                <input
                  id="contact-telephone"
                  type="tel"
                  value={form.telephone}
                  onChange={(e) => set("telephone", e.target.value)}
                />
              </label>
              <label className="report-field" htmlFor="contact-whatsapp">
                <span className="small-caps">{t("contact.whatsapp")}</span>
                <input
                  id="contact-whatsapp"
                  type="tel"
                  value={form.whatsapp}
                  onChange={(e) => set("whatsapp", e.target.value)}
                />
              </label>
              <label className="report-field contact-fields--wide" htmlFor="contact-adresse">
                <span className="small-caps">{t("contact.adresse")}</span>
                <textarea
                  id="contact-adresse"
                  rows={2}
                  value={form.adresse}
                  onChange={(e) => set("adresse", e.target.value)}
                />
              </label>
              <label className="report-field contact-fields--wide" htmlFor="contact-notes">
                <span className="small-caps">{t("contact.notes")}</span>
                <textarea
                  id="contact-notes"
                  rows={3}
                  value={form.notes}
                  onChange={(e) => set("notes", e.target.value)}
                />
              </label>
            </div>
          )}
        </div>

        {state.kind === "pret" && (
          <div className="contact-modal__footer">
            <button
              className="btn btn--primary"
              onClick={enregistrer}
              disabled={saving}
            >
              {saving ? t("contact.enregistrement") : t("contact.enregistrer")}
            </button>
            <div role="status" aria-live="polite">
              {saveNotice === "ok" && (
                <span className="contact-notice contact-notice--ok">
                  {t("contact.enregistre-ok")}
                </span>
              )}
            </div>
            <div role="alert">
              {saveNotice === "erreur" && (
                <span className="contact-notice contact-notice--err">
                  {t("contact.enregistre-erreur", { msg: saveErrMsg })}
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
