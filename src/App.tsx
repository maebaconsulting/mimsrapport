import { useEffect, useState, type ReactNode } from "react";
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
import { AppHeaderBar, type Lang } from "./ui/AppHeaderBar";

type Vue = "accueil" | "import" | "clients" | "rapports" | "tableaux" | "parametres";

/** Gabarit d'icône cohérent avec le reste de l'app (24px, trait courant). */
function Svg({ children }: { children: ReactNode }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

/** Icône de chaque entrée de navigation. */
const ICONS: Record<Vue, ReactNode> = {
  accueil: (
    <Svg>
      <path d="m3 10 9-7 9 7" />
      <path d="M5 9v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9" />
      <path d="M9 21v-6h6v6" />
    </Svg>
  ),
  import: (
    <Svg>
      <path d="M12 3v12" />
      <path d="m7 10 5 5 5-5" />
      <path d="M5 21h14" />
    </Svg>
  ),
  clients: (
    <Svg>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </Svg>
  ),
  rapports: (
    <Svg>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
      <path d="M8 13h8M8 17h6" />
    </Svg>
  ),
  tableaux: (
    <Svg>
      <path d="M3 3v18h18" />
      <path d="M8 17v-5" />
      <path d="M13 17V8" />
      <path d="M18 17v-3" />
    </Svg>
  ),
  parametres: (
    <Svg>
      <path d="M4 21v-7" />
      <path d="M4 10V3" />
      <path d="M12 21v-9" />
      <path d="M12 8V3" />
      <path d="M20 21v-5" />
      <path d="M20 12V3" />
      <path d="M1 14h6" />
      <path d="M9 8h6" />
      <path d="M17 16h6" />
    </Svg>
  ),
};

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
  // Langue de l'interface (placeholder local au lot 1 ; câblée au contexte i18n
  // au lot 2). Persistance gérée ensuite par le provider i18n.
  const [lang, setLang] = useState<Lang>("fr");
  // Client pré-sélectionné pour la vue Rapports (passerelle depuis Clients).
  const [rapportClientId, setRapportClientId] = useState<string | null>(null);
  // Menu latéral réduit (icônes seules), mémorisé entre sessions.
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem("mr-sidebar-collapsed") === "1";
    } catch {
      return false;
    }
  });

  function toggleSidebar() {
    setCollapsed((c) => {
      const next = !c;
      try {
        localStorage.setItem("mr-sidebar-collapsed", next ? "1" : "0");
      } catch {
        /* localStorage indisponible : repli non mémorisé */
      }
      return next;
    });
  }

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
    <div className={"app-shell" + (collapsed ? " app-shell--collapsed" : "")}>
      <aside
        className={"app-sidebar" + (collapsed ? " app-sidebar--collapsed" : "")}
      >
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
              aria-label={item.label}
              title={collapsed ? item.label : undefined}
              onClick={() => item.enabled && naviguer(item.id)}
              disabled={!item.enabled}
            >
              <span className="app-nav__icon">{ICONS[item.id]}</span>
              <span className="app-nav__label">{item.label}</span>
            </button>
          ))}
        </nav>
        <div className="app-sidebar__footer">
          <button
            type="button"
            className="app-sidebar__toggle"
            onClick={toggleSidebar}
            aria-label={collapsed ? "Déplier le menu" : "Réduire le menu"}
            aria-expanded={!collapsed}
            title={collapsed ? "Déplier le menu" : "Réduire le menu"}
          >
            <span className="app-sidebar__toggle-icon" aria-hidden="true">
              <Svg>
                {collapsed ? (
                  <path d="m9 18 6-6-6-6" />
                ) : (
                  <path d="m15 18-6-6 6-6" />
                )}
              </Svg>
            </span>
            <span className="app-nav__label">Réduire le menu</span>
          </button>
          <span className="app-sidebar__version small-caps">
            Version {__APP_VERSION__}
          </span>
        </div>
      </aside>

      <main className="app-main">
        <AppHeaderBar
          brand="MIMS REPORTING"
          viewLabel={NAV.find((n) => n.id === vue)?.label ?? ""}
          lang={lang}
          onLangChange={setLang}
          labels={{
            notificationsLabel: "Notifications",
            notificationsTitle: "Notifications",
            notificationsEmpty: "Aucune notification",
            languageLabel: "Choisir la langue",
            accountLabel: "Compte",
            accountName: "Jean Mvondo",
            accountRole: "Administrateur",
            signIn: "Se connecter",
            signOut: "Se déconnecter",
          }}
        />
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
