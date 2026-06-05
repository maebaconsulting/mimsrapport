import { useCallback, useEffect, useRef, useState } from "react";
import { getPocketBase } from "../lib/pocketbase";
import { saveBytes } from "../lib/fileio";
import {
  generateAttestation,
  listClientsWithPositions,
  type ClientChoice,
} from "./services/attestation";
import { generateReleve } from "./services/releve";

type ReportType = "attestation" | "releve";

const REPORT_TYPES: Array<{ id: ReportType; label: string }> = [
  { id: "attestation", label: "Attestation de portefeuille" },
  { id: "releve", label: "Relevé de compte-titres" },
];

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

export function ReportsView() {
  const [clients, setClients] = useState<ClientChoice[] | null>(null);
  const [clientId, setClientId] = useState<string>("");
  const [reportType, setReportType] = useState<ReportType>("attestation");
  const [dateArrete, setDateArrete] = useState<string>(todayIso());
  const [gen, setGen] = useState<GenState>({ kind: "idle" });
  const [preview, setPreview] = useState<Preview | null>(null);
  const [save, setSave] = useState<SaveNotice>({ kind: "idle" });
  const [loadError, setLoadError] = useState<string | null>(null);
  const frameRef = useRef<HTMLIFrameElement>(null);

  const charger = useCallback(async () => {
    try {
      const pb = await getPocketBase();
      const list = await listClientsWithPositions(pb);
      setClients(list);
      if (list.length > 0) setClientId(list[0].id);
    } catch (err) {
      setLoadError(String(err));
    }
  }, []);

  useEffect(() => {
    void charger();
  }, [charger]);

  // Libère l'object URL courant au démontage (évite les fuites mémoire).
  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview.url);
    };
  }, [preview]);

  function fermerApercu() {
    if (preview) URL.revokeObjectURL(preview.url);
    setPreview(null);
    setSave({ kind: "idle" });
  }

  async function generer() {
    if (!clientId) return;
    setGen({ kind: "generation" });
    setSave({ kind: "idle" });
    try {
      const pb = await getPocketBase();
      const out =
        reportType === "attestation"
          ? await generateAttestation(pb, clientId, dateArrete)
          : await generateReleve(pb, clientId, dateArrete);

      // Aperçu avant tout enregistrement : on n'écrit rien sur disque ici.
      if (preview) URL.revokeObjectURL(preview.url);
      const url = URL.createObjectURL(out.blob);
      const label =
        REPORT_TYPES.find((r) => r.id === reportType)?.label ?? "Rapport";
      setPreview({
        url,
        bytes: out.bytes,
        filename: out.filename,
        hash: out.hash,
        label,
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

  function imprimer() {
    const win = frameRef.current?.contentWindow;
    if (win) {
      win.focus();
      win.print();
    }
  }

  return (
    <>
      <header className="app-header">
        <h1 className="app-header__title">Rapports</h1>
        <p className="app-header__subtitle">
          Production des rapports réglementaires et non réglementaires
        </p>
      </header>

      <section className="app-content">
        <div className="card" style={{ maxWidth: 720 }}>
          <span className="small-caps">Rapports par client</span>
          <p className="card__lead">
            Génère le rapport choisi pour un client à une date d'arrêté, au format
            PDF fidèle à MIMS. Le document s'affiche en aperçu avant
            téléchargement ou impression.
          </p>

          {loadError && (
            <div className="import-notice import-notice--danger">
              <p>Chargement des clients impossible : {loadError}</p>
            </div>
          )}

          {clients !== null && clients.length === 0 && (
            <div className="import-notice import-notice--warn">
              <p>
                Aucun client avec position. Importez d'abord un fichier Manar.
              </p>
            </div>
          )}

          {clients !== null && clients.length > 0 && (
            <div className="report-form">
              <label className="report-field">
                <span className="small-caps">Type de rapport</span>
                <select
                  value={reportType}
                  onChange={(e) => setReportType(e.target.value as ReportType)}
                >
                  {REPORT_TYPES.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="report-field">
                <span className="small-caps">Client</span>
                <select
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                >
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nom_complet} · {c.code} ({c.nb_positions} position
                      {c.nb_positions > 1 ? "s" : ""})
                    </option>
                  ))}
                </select>
              </label>

              <label className="report-field">
                <span className="small-caps">Date d'arrêté</span>
                <input
                  type="date"
                  value={dateArrete}
                  onChange={(e) => setDateArrete(e.target.value)}
                />
              </label>

              <button
                className="btn btn--primary"
                onClick={generer}
                disabled={gen.kind === "generation"}
              >
                {gen.kind === "generation"
                  ? "Génération…"
                  : "Générer l'aperçu"}
              </button>
            </div>
          )}

          {gen.kind === "erreur" && (
            <div className="import-notice import-notice--danger">
              <p>Échec de la génération : {gen.message}</p>
            </div>
          )}
        </div>
      </section>

      {preview && (
        <div
          className="preview-overlay"
          role="dialog"
          aria-modal="true"
          aria-label={`Aperçu · ${preview.label}`}
        >
          <div className="preview-modal">
            <div className="preview-modal__head">
              <div>
                <span className="small-caps">Aperçu avant impression</span>
                <p className="preview-modal__title">
                  {preview.label} · {preview.filename}
                </p>
              </div>
              <div className="preview-actions">
                <button className="btn" onClick={imprimer}>
                  Imprimer
                </button>
                <button className="btn btn--primary" onClick={telecharger}>
                  Télécharger
                </button>
                <button className="btn" onClick={fermerApercu}>
                  Fermer
                </button>
              </div>
            </div>

            <iframe
              ref={frameRef}
              className="preview-frame"
              src={preview.url}
              title={`Aperçu ${preview.label}`}
            />

            <div className="preview-modal__foot">
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 11 }}>
                Empreinte SHA-256 · {preview.hash.slice(0, 16)}…
              </span>
              {save.kind === "ok" && (
                <span className="preview-modal__saved">
                  Enregistré ({save.filename}).
                </span>
              )}
              {save.kind === "annule" && (
                <span className="preview-modal__saved">
                  Enregistrement annulé.
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
