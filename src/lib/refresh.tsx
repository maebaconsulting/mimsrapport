// Signal de rafraîchissement global des vues de données.
//
// Objectif : une vue déjà affichée doit se resynchroniser avec la base sans
// rechargement manuel, dans trois cas (sans abonnement temps réel) :
//  - après un import (les écritures rendent les autres vues périmées) ;
//  - au retour sur l'application (la fenêtre reprend le focus) ;
//  - au démarrage, si la base n'était pas prête (une seconde tentative
//    automatique peu après le lancement).
//
// Mise en œuvre : un compteur `revision` partagé, incrémenté par ces
// déclencheurs. Les vues l'écoutent via `useRefreshOnSignal` et effectuent un
// rechargement SILENCIEUX (les données restent à l'écran, mise à jour en
// arrière-plan ; pas de squelette, erreurs transitoires ignorées). Le squelette
// reste réservé au premier chargement et au réessai manuel.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

interface RefreshContextValue {
  /** Compteur incrémenté à chaque déclencheur de rafraîchissement. */
  revision: number;
  /** Force un rafraîchissement (ex. après un import réussi). */
  refresh: () => void;
}

const RefreshContext = createContext<RefreshContextValue>({
  revision: 0,
  refresh: () => {},
});

/** Provider du signal de rafraîchissement ; englobe l'application. */
export function RefreshProvider({ children }: { children: ReactNode }) {
  const [revision, setRevision] = useState(0);
  const refresh = useCallback(() => setRevision((r) => r + 1), []);

  useEffect(() => {
    // Retour sur l'app (focus fenêtre / onglet redevenu visible).
    const onFocus = () => setRevision((r) => r + 1);
    const onVisible = () => {
      if (document.visibilityState === "visible") setRevision((r) => r + 1);
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);

    // Démarrage : une seconde tentative automatique peu après le lancement,
    // au cas où la base n'était pas encore prête au premier chargement.
    const demarrage = window.setTimeout(() => setRevision((r) => r + 1), 1500);

    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
      window.clearTimeout(demarrage);
    };
  }, []);

  return (
    <RefreshContext.Provider value={{ revision, refresh }}>
      {children}
    </RefreshContext.Provider>
  );
}

/** Accès au signal de rafraîchissement (revision + refresh manuel). */
export function useRefresh(): RefreshContextValue {
  return useContext(RefreshContext);
}

/**
 * Exécute `rafraichir` à chaque signal de rafraîchissement (focus, import,
 * tentative de démarrage), en ignorant le montage initial (le premier
 * chargement reste géré par la vue elle-même).
 */
export function useRefreshOnSignal(rafraichir: () => void): void {
  const { revision } = useRefresh();
  const premierRendu = useRef(true);
  // `rafraichir` est conservé dans une ref pour ne dépendre que de `revision`.
  const ref = useRef(rafraichir);
  ref.current = rafraichir;
  useEffect(() => {
    if (premierRendu.current) {
      premierRendu.current = false;
      return;
    }
    ref.current();
  }, [revision]);
}
