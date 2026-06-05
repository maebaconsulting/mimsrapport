import "./design/tokens.css";
import "./App.css";

/**
 * Shell d'accueil de l'application Reporting Manar.
 * Jalon 0 : coquille vide qui démarre. Les écrans (import, rapports,
 * tableaux de bord) seront branchés aux jalons suivants.
 */
function App() {
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
            <span className="small-caps">État de l'application</span>
            <p className="card__lead">
              La coquille desktop démarre correctement. Les fonctions d'import,
              de production de rapports et de tableaux de bord seront activées
              aux prochains jalons.
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;
