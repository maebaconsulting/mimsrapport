import { useEffect, useState } from "react";
import "./design/tokens.css";
import "./App.css";
import { getPocketBase } from "./lib/pocketbase";

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

/**
 * Shell d'accueil de l'application Reporting Manar.
 * Jalon 1 : la coquille démarre le sidecar PocketBase et affiche l'état de la
 * connexion + les comptages de collections (vides avant import).
 */
function App() {
  const [state, setState] = useState<ConnState>({ phase: "connexion" });

  useEffect(() => {
    let annule = false;
    (async () => {
      try {
        const pb = await getPocketBase();
        const counts: Record<string, number> = {};
        for (const name of COLLECTIONS) {
          const list = await pb.collection(name).getList(1, 1);
          counts[name] = list.totalItems;
        }
        if (!annule) {
          setState({ phase: "pret", url: pb.baseURL, counts });
        }
      } catch (err) {
        if (!annule) {
          setState({ phase: "erreur", message: String(err) });
        }
      }
    })();
    return () => {
      annule = true;
    };
  }, []);

  return (
    <div className="app-shell">
      <aside className="app-sidebar">
        <div className="app-brand">
          <span className="app-brand__mark">RM</span>
          <span className="app-brand__name">Reporting Manar</span>
        </div>
        <nav className="app-nav">
          <span className="small-caps app-nav__section">Navigation</span>
          <button className="app-nav__item app-nav__item--active" disabled>
            Accueil
          </button>
          <button className="app-nav__item" disabled>
            Import Manar
          </button>
          <button className="app-nav__item" disabled>
            Rapports
          </button>
          <button className="app-nav__item" disabled>
            Tableaux de bord
          </button>
        </nav>
        <div className="app-sidebar__footer small-caps">Version 0.1.0</div>
      </aside>

      <main className="app-main">
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
                  Connecté à PocketBase ({state.url}). Le schéma est en place ;
                  les collections sont vides tant qu'aucun fichier Manar n'est
                  importé.
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
      </main>
    </div>
  );
}

export default App;
