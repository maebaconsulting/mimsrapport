import {
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Lang } from "../i18n";

/** Libellés courts du sélecteur de langue (non traduits : ce sont des sigles). */
const LANG_LABELS: Record<Lang, string> = {
  fr: "FR",
  en: "EN",
  es: "ES",
};

const LANG_NAMES: Record<Lang, string> = {
  fr: "Français",
  en: "English",
  es: "Español",
};

/** Petite icône 18px, trait courant (cohérente avec la nav). */
function Glyph({ children }: { children: ReactNode }) {
  return (
    <svg
      width="18"
      height="18"
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

/**
 * Menu déroulant générique : déclencheur + panneau.
 * Reprend la mécanique de `SearchableSelect` (fermeture au clic extérieur et à
 * Échap, attributs ARIA haspopup/expanded), sans la recherche.
 */
function HeaderMenu({
  trigger,
  ariaLabel,
  align = "end",
  children,
}: {
  /** Rendu du contenu du bouton déclencheur (reçoit l'état ouvert/fermé). */
  trigger: (open: boolean) => ReactNode;
  ariaLabel: string;
  align?: "start" | "end";
  /** Contenu du panneau ; reçoit une fonction de fermeture. */
  children: (close: () => void) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    function onDocDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="app-topbar__menu" ref={ref}>
      <button
        type="button"
        className="app-topbar__trigger"
        aria-label={ariaLabel}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => setOpen((o) => !o)}
      >
        {trigger(open)}
      </button>
      {open && (
        <div
          className={
            "app-topbar__panel" +
            (align === "start" ? " app-topbar__panel--start" : "")
          }
          id={panelId}
          role="menu"
        >
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

export interface AppHeaderBarProps {
  /** Libellé de la vue courante (dernier segment du fil d'Ariane, en gras). */
  viewLabel: string;
  /** Nom du produit (premier segment du fil d'Ariane). */
  brand: string;
  lang: Lang;
  onLangChange: (lang: Lang) => void;
  /** Textes localisables fournis par l'appelant (placeholder en attendant l'i18n). */
  labels: {
    notificationsLabel: string;
    notificationsTitle: string;
    notificationsEmpty: string;
    languageLabel: string;
    accountLabel: string;
    accountName: string;
    accountRole: string;
    signIn: string;
    signOut: string;
  };
}

/**
 * Barre d'en-tête globale (une seule fois en tête de la zone principale).
 * À gauche : fil d'Ariane « produit / vue ». À droite : cloche de notification,
 * sélecteur de langue et avatar. Aucun champ de recherche (choix produit).
 */
export function AppHeaderBar({
  viewLabel,
  brand,
  lang,
  onLangChange,
  labels,
}: AppHeaderBarProps) {
  const initials = labels.accountName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((m) => m[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <header className="app-topbar">
      <nav className="app-topbar__crumb" aria-label={brand}>
        <span className="app-topbar__crumb-root">{brand}</span>
        <span className="app-topbar__crumb-sep" aria-hidden="true">
          /
        </span>
        <span className="app-topbar__crumb-current" aria-current="page">
          {viewLabel}
        </span>
      </nav>

      <div className="app-topbar__actions">
        {/* Cloche de notification (placeholder : aucune notification) */}
        <HeaderMenu
          ariaLabel={labels.notificationsLabel}
          trigger={() => (
            <span className="app-topbar__icon">
              <Glyph>
                <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
                <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
              </Glyph>
            </span>
          )}
        >
          {() => (
            <div className="app-topbar__notif">
              <p className="app-topbar__notif-title">
                {labels.notificationsTitle}
              </p>
              <p className="app-topbar__notif-empty">
                {labels.notificationsEmpty}
              </p>
            </div>
          )}
        </HeaderMenu>

        {/* Sélecteur de langue */}
        <HeaderMenu
          ariaLabel={labels.languageLabel}
          trigger={(open) => (
            <span className="app-topbar__lang">
              {LANG_LABELS[lang]}
              <span
                className={
                  "app-topbar__caret" + (open ? " app-topbar__caret--up" : "")
                }
                aria-hidden="true"
              >
                ▾
              </span>
            </span>
          )}
        >
          {(close) => (
            <ul className="app-topbar__menu-list" role="none">
              {(Object.keys(LANG_NAMES) as Lang[]).map((code) => (
                <li key={code} role="none">
                  <button
                    type="button"
                    role="menuitemradio"
                    aria-checked={lang === code}
                    className={
                      "app-topbar__menu-item" +
                      (lang === code ? " app-topbar__menu-item--active" : "")
                    }
                    onClick={() => {
                      onLangChange(code);
                      close();
                    }}
                  >
                    <span className="app-topbar__menu-code">
                      {LANG_LABELS[code]}
                    </span>
                    <span>{LANG_NAMES[code]}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </HeaderMenu>

        {/* Avatar + menu de compte (UI seule, non câblé) */}
        <HeaderMenu
          ariaLabel={labels.accountLabel}
          trigger={() => (
            <span className="app-topbar__avatar" aria-hidden="true">
              {initials}
            </span>
          )}
        >
          {(close) => (
            <div className="app-topbar__account">
              <div className="app-topbar__account-head">
                <span className="app-topbar__avatar app-topbar__avatar--lg" aria-hidden="true">
                  {initials}
                </span>
                <div>
                  <p className="app-topbar__account-name">
                    {labels.accountName}
                  </p>
                  <p className="app-topbar__account-role">
                    {labels.accountRole}
                  </p>
                </div>
              </div>
              <ul className="app-topbar__menu-list" role="none">
                <li role="none">
                  <button
                    type="button"
                    role="menuitem"
                    className="app-topbar__menu-item"
                    onClick={close}
                  >
                    <span className="app-topbar__icon">
                      <Glyph>
                        <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                        <path d="M10 17l5-5-5-5" />
                        <path d="M15 12H3" />
                      </Glyph>
                    </span>
                    <span>{labels.signIn}</span>
                  </button>
                </li>
                <li role="none">
                  <button
                    type="button"
                    role="menuitem"
                    className="app-topbar__menu-item"
                    onClick={close}
                  >
                    <span className="app-topbar__icon">
                      <Glyph>
                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                        <path d="M16 17l5-5-5-5" />
                        <path d="M21 12H9" />
                      </Glyph>
                    </span>
                    <span>{labels.signOut}</span>
                  </button>
                </li>
              </ul>
            </div>
          )}
        </HeaderMenu>
      </div>
    </header>
  );
}
