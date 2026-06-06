import { useState } from "react";
import { installLicense, type LicenseStatus } from "./lib/license";

// Écran de blocage affiché si la licence est absente, invalide ou expirée.
// L'application ne charge pas les fonctions d'import/reporting sans licence
// valide (validation cryptographique hors ligne par la coque Rust).

export function LicenseGate({
  status,
  onValid,
}: {
  status: LicenseStatus;
  onValid: (s: LicenseStatus) => void;
}) {
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);

  async function importer() {
    setErreur(null);
    setEnCours(true);
    try {
      const next = await installLicense();
      if (next.valid) {
        onValid(next);
      } else {
        setErreur(next.reason ?? "Licence non valide");
      }
    } catch (err) {
      setErreur(String(err));
    } finally {
      setEnCours(false);
    }
  }

  return (
    <div className="license-gate">
      <div className="license-card">
        <div className="app-brand" style={{ justifyContent: "center" }}>
          <span className="app-brand__mark">RM</span>
          <span className="app-brand__name" style={{ color: "var(--color-ink)" }}>
            Reporting Manar
          </span>
        </div>
        <h1 className="license-card__title">Licence requise</h1>
        <p className="license-card__text">
          {status.reason ?? "Aucune licence valide n'a été trouvée."} Pour
          utiliser l'application, installez votre fichier de licence fourni par
          MAEBA Consulting.
        </p>
        {status.sdb && status.sdb !== "Mode développement" && (
          <p className="license-card__meta">
            Licence détectée : {status.sdb}
            {status.expires_at ? ` · expiration ${status.expires_at}` : ""}
          </p>
        )}
        {erreur && (
          <p className="license-card__error">{erreur}</p>
        )}
        <button
          className="btn btn--primary"
          onClick={importer}
          disabled={enCours}
        >
          {enCours ? "Vérification…" : "Installer une licence"}
        </button>
      </div>
    </div>
  );
}
