import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { fr, type Dict, type TKey } from "./fr";
import { en } from "./en";
import { es } from "./es";

export type { TKey } from "./fr";

/** Langues prises en charge par l'interface. */
export type Lang = "fr" | "en" | "es";

/** Clé de persistance de la langue choisie. */
export const LANG_STORAGE_KEY = "mr-lang";

const DICTS: Record<Lang, Dict> = { fr, en, es };

/** Locale BCP-47 par langue (sélection des formats nombres/dates natifs). */
const LOCALES: Record<Lang, string> = {
  fr: "fr-FR",
  en: "en-US",
  es: "es-ES",
};

/** Locale BCP-47 dérivée d'une langue (utilisable hors composant). */
export function localeFor(lang: Lang): string {
  return LOCALES[lang];
}

/** Signature de la fonction de traduction. */
export type TFunc = (
  key: TKey,
  vars?: Record<string, string | number>,
) => string;

interface LangContextValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  /** Locale BCP-47 active (`fr-FR`, `en-US`, `es-ES`). */
  locale: string;
  t: TFunc;
}

const LangContext = createContext<LangContextValue | null>(null);

/** Lit la langue persistée, avec repli sur le français. */
function readStoredLang(): Lang {
  try {
    const v = localStorage.getItem(LANG_STORAGE_KEY);
    if (v === "fr" || v === "en" || v === "es") return v;
  } catch {
    /* localStorage indisponible : langue par défaut */
  }
  return "fr";
}

/** Remplace les marqueurs `{nom}` par les variables fournies. */
function interpolate(
  template: string,
  vars?: Record<string, string | number>,
): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (m, k) =>
    k in vars ? String(vars[k]) : m,
  );
}

/**
 * Typographie française : remplace l'espace ordinaire précédant la ponctuation
 * haute (`:` `;` `!` `?` `%` `»`) et suivant `«` par une espace insécable (U+00A0).
 * Appliqué uniquement en FR, sur le gabarit (avant interpolation) : les
 * dictionnaires peuvent ainsi s'écrire avec des espaces normales. N'altère
 * pas `://` (aucune espace avant les deux-points dans une URL).
 */
function frenchTypography(s: string): string {
  return s.replace(/ ([:;!?%»])/g, " $1").replace(/(«) /g, "$1 ");
}

/** Provider i18n : englobe l'application (monté dans `main.tsx`). */
export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(readStoredLang);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    try {
      localStorage.setItem(LANG_STORAGE_KEY, next);
    } catch {
      /* persistance indisponible : choix non mémorisé */
    }
  }, []);

  // Reflète la langue sur <html lang> (accessibilité + formats natifs).
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const value = useMemo<LangContextValue>(() => {
    const dict = DICTS[lang];
    const t: TFunc = (key, vars) => {
      const template = dict[key] ?? fr[key] ?? String(key);
      const typed = lang === "fr" ? frenchTypography(template) : template;
      return interpolate(typed, vars);
    };
    return { lang, setLang, locale: LOCALES[lang], t };
  }, [lang, setLang]);

  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

function useI18n(): LangContextValue {
  const ctx = useContext(LangContext);
  if (!ctx) {
    throw new Error("useI18n doit être utilisé dans <LangProvider>");
  }
  return ctx;
}

/** Hook principal : fonction de traduction `t(cle, vars?)`. */
export function useT(): TFunc {
  return useI18n().t;
}

/** Hook d'accès à la langue active et à son sélecteur. */
export function useLang(): [Lang, (lang: Lang) => void] {
  const { lang, setLang } = useI18n();
  return [lang, setLang];
}

/** Hook d'accès à la locale BCP-47 active (formats nombres/dates). */
export function useLocale(): string {
  return useI18n().locale;
}
