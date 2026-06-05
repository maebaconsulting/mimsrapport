import { useCallback, useEffect, useState } from "react";
import { getPocketBase } from "../lib/pocketbase";
import { saveBytes } from "../lib/fileio";
import {
  generateAttestation,
  listClientsWithPositions,
  type ClientChoice,
} from "./services/attestation";

type GenState =
  | { kind: "idle" }
  | { kind: "generation" }
  | { kind: "ok"; filename: string; hash: string; enregistre: boolean }
  | { kind: "erreur"; message: string };

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

export function ReportsView() {
  const [clients, setClients] = useState<ClientChoice[] | null>(null);
  const [clientId, setClientId] = useState<string>("");
  const [dateArrete, setDateArrete] = useState<string>(todayIso());
  const [gen, setGen] = useState<GenState>({ kind: "idle" });
  const [loadError, setLoadError] = useState<string | null>(null);

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

  async function generer() {
    if (!clientId) return;
    setGen({ kind: "generation" });
    try {
      const pb = await getPocketBase();
      const out = await generateAttestation(pb, clientId, dateArrete);
      const enregistre = await saveBytes(out.bytes, out.filename);
      setGen({
        kind: "ok",
        filename: out.filename,
        hash: out.hash,
        enregistre,
      });
    } catch (err) {
      setGen({ kind: "erreur", message: String(err) });
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
          <span className="small-caps">Attestation de portefeuille de titres</span>
          <p className="card__lead">
            Génère l'attestation d'un client à une date d'arrêté, au format PDF
            fidèle à MIMS (rendu côté application).
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
                  : "Générer le PDF"}
              </button>
            </div>
          )}

          {gen.kind === "ok" && (
            <div className="import-notice import-notice--success">
              <p>
                {gen.enregistre
                  ? `Attestation enregistrée (${gen.filename}).`
                  : "Génération réussie (enregistrement annulé)."}
              </p>
              <p style={{ fontFamily: "var(--font-mono)", fontSize: 11 }}>
                Empreinte SHA-256 · {gen.hash.slice(0, 16)}…
              </p>
            </div>
          )}

          {gen.kind === "erreur" && (
            <div className="import-notice import-notice--danger">
              <p>Échec de la génération : {gen.message}</p>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
