import { useCallback, useEffect, useState } from "react";
import "./design/tokens.css";
import "./App.css";
import { getPocketBase } from "./lib/pocketbase";
import { ImportWizard } from "./import/ImportWizard";
import { ClientsView } from "./clients/ClientsView";
import { ReportsView } from "./reports/ReportsView";
import { DashboardsView } from "./dashboards/DashboardsView";
import { SettingsView } from "./settings/SettingsView";
import { LicenseGate } from "./LicenseGate";
import { getLicenseStatus, type LicenseStatus } from "./lib/license";
import { withRetry } from "./lib/retry";

type Vue = "accueil" | "import" | "clients" | "rapports" | "tableaux" | "parametres";

type ConnState =
  | { phase: "connexion" }
  | { phase: "pret"; url: string; counts: Record<string, number> }
  | { phase: "erreur"; message: string };

const COLLECTIONS = [
  "clients",
  "portefeuilles",
  "emetteurs",
  "instruments",
  "positions",
  "mouvements_titres",
  "manar_imports",
];

const NAV: Array<{ id: Vue; label: string; enabled: boolean }> = [
  { id: "accueil", label: "Accueil", enabled: true },
  { id: "import", label: "Import Manar", enabled: true },
  { id: "clients", label: "Clients", enabled: true },
  { id: "rapports", label: "Rapports", enabled: true },
  { id: "tableaux", label: "Tableaux de bord", enabled: true },
  { id: "parametres", label: "Paramètres", enabled: true },
];

function App() {
  const [vue, setVue] = useState<Vue>("accueil");
  const [state, setState] = useState<ConnState>({ phase: "connexion" });
  const [license, setLicense] = useState<LicenseStatus | null>(null);

  useEffect(() => {
    void getLicenseStatus().then(setLicense);
  }, []);

  const rafraichir = useCallback(async () => {
    try {
      const pb = await getPocketBase();
      const counts: Record<string, number> = {};
      for (const name of COLLECTIONS) {
        const list = await withRetry(() => pb.collection(name).getList(1, 1));
        counts[name] = list.totalItems;
      }
      setState({ phase: "pret", url: pb.baseURL, counts });
    } catch (err) {
      setState({ phase: "erreur", message: String(err) });
    }
  }, []);

  useEffect(() => {
    void rafraichir();
  }, [rafraichir]);

  if (license === null) {
    return (
      <div className="license-gate">
        <div className="license-card">
          <p className="license-card__text">Vérification de la licence…</p>
        </div>
      </div>
    );
  }
  if (!license.valid) {
    return <LicenseGate status={license} onValid={setLicense} />;
  }

  return (
    <div className="app-shell">
      <aside className="app-sidebar">
        <div className="app-brand">
          <span className="app-brand__mark">RM</span>
          <span className="app-brand__name">Reporting Manar</span>
        </div>
        <nav className="app-nav">
          <span className="small-caps app-nav__section">Navigation</span>
          {NAV.map((item) => (
            <button
              key={item.id}
              className={
                "app-nav__item" +
                (vue === item.id ? " app-nav__item--active" : "")
              }
              onClick={() => item.enabled && setVue(item.id)}
              disabled={!item.enabled}
            >
              {item.label}
            </button>
          ))}
        </nav>
        <div className="app-sidebar__footer small-caps">Version 0.1.0</div>
      </aside>

      <main className="app-main">
        {vue === "accueil" && (
          <AccueilView state={state} />
        )}
        {vue === "import" && (
          <>
            <header className="app-header">
              <h1 className="app-header__title">Import Manar</h1>
              <p className="app-header__subtitle">
                Chargement du fichier Manar et matérialisation des entités
              </p>
            </header>
            <section className="app-content">
              <ImportWizard onImported={rafraichir} />
            </section>
          </>
        )}
        {vue === "clients" && <ClientsView />}
        {vue === "rapports" && <ReportsView />}
        {vue === "tableaux" && <DashboardsView />}
        {vue === "parametres" && <SettingsView />}
      </main>
    </div>
  );
}

function AccueilView({ state }: { state: ConnState }) {
  return (
    <>
      <header className="app-header">
        <h1 className="app-header__title">Accueil</h1>
        <p className="app-header__subtitle">
          Outil de reporting pour société de bourse · marché CEMAC / BVMAC
        </p>
      </header>
      <section className="app-content">
        <div className="card">
          <span className="small-caps">État de la base locale</span>
          {state.phase === "connexion" && (
            <p className="card__lead">Connexion au moteur de données…</p>
          )}
          {state.phase === "erreur" && (
            <p className="card__lead" style={{ color: "var(--color-danger)" }}>
              Connexion impossible : {state.message}
            </p>
          )}
          {state.phase === "pret" && (
            <>
              <p className="card__lead">
                Connecté à PocketBase ({state.url}). Importez un fichier Manar
                pour alimenter les rapports et tableaux de bord.
              </p>
              <table className="status-table">
                <tbody>
                  {COLLECTIONS.map((name) => (
                    <tr key={name}>
                      <td className="status-table__name">{name}</td>
                      <td className="status-table__count">
                        {state.counts[name]}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
      </section>
    </>
  );
}

export default App;
