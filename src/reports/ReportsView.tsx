import { useCallback, useEffect, useRef, useState } from "react";
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
  label: string;
  scope: ReportScope;
  groupe: string;
}

const REPORT_TYPES: ReportDef[] = [
  { id: "attestation", label: "Attestation de portefeuille", scope: "client", groupe: "Documents client" },
  { id: "releve", label: "Relevé de compte-titres", scope: "client", groupe: "Documents client" },
  { id: "confirmation_ouverture", label: "Confirmation d'ouverture de compte", scope: "client", groupe: "Documents client" },
  { id: "lettre_desherence", label: "Lettre de relance déshérence", scope: "client", groupe: "Documents client" },
  { id: "cosumaf_transactions", label: "COSUMAF · Transactions boursières (obl. 12)", scope: "societe", groupe: "États réglementaires (société)" },
  { id: "cosumaf_avoirs", label: "COSUMAF · Situation des avoirs (obl. 15)", scope: "societe", groupe: "États réglementaires (société)" },
  { id: "etat_desherence", label: "État des clients en déshérence", scope: "societe", groupe: "États réglementaires (société)" },
];

function scopeOf(id: ReportType): ReportScope {
  return REPORT_TYPES.find((r) => r.id === id)?.scope ?? "client";
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
      const label =
        REPORT_TYPES.find((r) => r.id === reportType)?.label ?? "Rapport";
      setPreview({
        url,
        bytes: out.bytes,
        filename: out.filename,
        hash: out.hash,
        label,
        scopeLabel:
          scope === "societe"
            ? "État réglementaire · société"
            : "Document client",
        generatedAt: new Date().toLocaleString("fr-FR").replace(/ /g, " "),
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
          <span className="small-caps">Production de rapports</span>
          <p className="card__lead">
            Documents par client ou états réglementaires à l'échelle de la
            société, à une date d'arrêté, au format PDF fidèle à MIMS. Le document
            s'affiche en aperçu avant téléchargement ou impression.
          </p>

          {loadError && (
            <div className="import-notice import-notice--danger">
              <p>Chargement des clients impossible : {loadError}</p>
            </div>
          )}

          {clients !== null && (
            <div className="report-form">
              <label className="report-field">
                <span className="small-caps">Type de rapport</span>
                <select
                  value={reportType}
                  onChange={(e) => setReportType(e.target.value as ReportType)}
                >
                  {[...new Set(REPORT_TYPES.map((r) => r.groupe))].map((g) => (
                    <optgroup key={g} label={g}>
                      {REPORT_TYPES.filter((r) => r.groupe === g).map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.label}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </label>

              {scopeOf(reportType) === "client" &&
                (clients.length > 0 ? (
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
                ) : (
                  <div className="import-notice import-notice--warn">
                    <p>
                      Aucun client avec position. Importez d'abord un fichier
                      Manar pour les documents par client.
                    </p>
                  </div>
                ))}

              <label className="report-field">
                <span className="small-caps">
                  {scopeOf(reportType) === "societe"
                    ? "Date d'arrêté (mois de la période)"
                    : "Date d'arrêté"}
                </span>
                <input
                  type="date"
                  value={dateArrete}
                  onChange={(e) => setDateArrete(e.target.value)}
                />
              </label>

              <button
                className="btn btn--primary"
                onClick={generer}
                disabled={
                  gen.kind === "generation" ||
                  (scopeOf(reportType) === "client" &&
                    (clients.length === 0 || !clientId))
                }
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
                <p className="preview-modal__title">{preview.label}</p>
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

            <div className="preview-modal__body">
              <iframe
                ref={frameRef}
                className="preview-frame"
                src={preview.url}
                title={`Aperçu ${preview.label}`}
              />

              <aside className="preview-rail">
                <section className="preview-rail__block">
                  <span className="small-caps">Informations clés</span>
                  <dl className="preview-meta">
                    <div className="preview-meta__row">
                      <dt>Périmètre</dt>
                      <dd>{preview.scopeLabel}</dd>
                    </div>
                    <div className="preview-meta__row">
                      <dt>Fichier</dt>
                      <dd className="preview-meta__mono">{preview.filename}</dd>
                    </div>
                    <div className="preview-meta__row">
                      <dt>Taille</dt>
                      <dd>{preview.sizeKo} ko</dd>
                    </div>
                    <div className="preview-meta__row">
                      <dt>Généré le</dt>
                      <dd>{preview.generatedAt}</dd>
                    </div>
                  </dl>
                </section>

                <section className="preview-rail__block">
                  <span className="small-caps">Empreinte SHA-256</span>
                  <code className="preview-hash">{preview.hash}</code>
                </section>

                <section className="preview-rail__block">
                  <span className="small-caps">Production</span>
                  <ul className="preview-steps">
                    <li>Données lues depuis la base locale</li>
                    <li>Rendu PDF · gabarit fidèle MIMS</li>
                    <li>Empreinte SHA-256 scellée</li>
                    <li>Aperçu prêt · export journalisé</li>
                  </ul>
                </section>

                {save.kind === "ok" && (
                  <div className="preview-rail__notice preview-rail__notice--ok">
                    Enregistré · {save.filename}
                  </div>
                )}
                {save.kind === "annule" && (
                  <div className="preview-rail__notice">
                    Enregistrement annulé.
                  </div>
                )}
              </aside>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
