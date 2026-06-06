import { useEffect, useState } from "react";
import "./design/tokens.css";
import "./App.css";
import { ImportWizard } from "./import/ImportWizard";
import { ClientsView } from "./clients/ClientsView";
import { ReportsView } from "./reports/ReportsView";
import { DashboardsView } from "./dashboards/DashboardsView";
import { SettingsView } from "./settings/SettingsView";
import { HomeView } from "./home/HomeView";
import { LicenseGate } from "./LicenseGate";
import { getLicenseStatus, type LicenseStatus } from "./lib/license";
import { confirmDiscardIfDirty } from "./lib/unsaved-guard";

type Vue = "accueil" | "import" | "clients" | "rapports" | "tableaux" | "parametres";

const NAV: Array<{ id: Vue; label: string; enabled: boolean }> = [
  { id: "accueil", label: "Accueil", enabled: true },
  { id: "import", label: "Import", enabled: true },
  { id: "clients", label: "Clients", enabled: true },
  { id: "rapports", label: "Rapports", enabled: true },
  { id: "tableaux", label: "Tableaux de bord", enabled: true },
  { id: "parametres", label: "Paramètres", enabled: true },
];

function App() {
  const [vue, setVue] = useState<Vue>("accueil");
  const [license, setLicense] = useState<LicenseStatus | null>(null);
  // Client pré-sélectionné pour la vue Rapports (passerelle depuis Clients).
  const [rapportClientId, setRapportClientId] = useState<string | null>(null);

  // Change de vue, en demandant confirmation si la vue courante a des
  // modifications non enregistrées (cf. Paramètres).
  function naviguer(cible: Vue) {
    if (cible === vue) return;
    if (!confirmDiscardIfDirty()) return;
    setVue(cible);
  }

  // Passerelle « Générer un rapport pour ce client » depuis la table clients.
  function genererRapportPour(clientId: string) {
    setRapportClientId(clientId);
    naviguer("rapports");
  }

  useEffect(() => {
    void getLicenseStatus().then(setLicense);
  }, []);

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
          <span className="app-brand__mark">MR</span>
          <span className="app-brand__name">MIMS REPORTING</span>
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
              aria-current={vue === item.id ? "page" : undefined}
              onClick={() => item.enabled && naviguer(item.id)}
              disabled={!item.enabled}
            >
              {item.label}
            </button>
          ))}
        </nav>
        <div className="app-sidebar__footer small-caps">
          Version {__APP_VERSION__}
        </div>
      </aside>

      <main className="app-main">
        {vue === "accueil" && <HomeView onNavigate={naviguer} />}
        {vue === "import" && (
          <>
            <header className="app-header">
              <h1 className="app-header__title">Import des données</h1>
              <p className="app-header__subtitle">
                Chargement du fichier d'export et enregistrement des entités
              </p>
            </header>
            <section className="app-content">
              <ImportWizard onNavigate={naviguer} />
            </section>
          </>
        )}
        {vue === "clients" && (
          <ClientsView onGenerateReport={genererRapportPour} />
        )}
        {vue === "rapports" && (
          <ReportsView initialClientId={rapportClientId} />
        )}
        {vue === "tableaux" && <DashboardsView />}
        {vue === "parametres" && <SettingsView />}
      </main>
    </div>
  );
}

export default App;
