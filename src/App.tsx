import { useCallback, useEffect, useState } from "react";
import "./design/tokens.css";
import "./App.css";
import { getPocketBase } from "./lib/pocketbase";
import { ImportWizard } from "./import/ImportWizard";
import { ReportsView } from "./reports/ReportsView";

type Vue = "accueil" | "import" | "rapports";

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
  { id: "rapports", label: "Rapports", enabled: true },
];

function App() {
  const [vue, setVue] = useState<Vue>("accueil");
  const [state, setState] = useState<ConnState>({ phase: "connexion" });

  const rafraichir = useCallback(async () => {
    try {
      const pb = await getPocketBase();
      const counts: Record<string, number> = {};
      for (const name of COLLECTIONS) {
        const list = await pb.collection(name).getList(1, 1);
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
          <button className="app-nav__item" disabled>
            Tableaux de bord
          </button>
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
        {vue === "rapports" && <ReportsView />}
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
