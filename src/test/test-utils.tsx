// -*- coding: utf-8 -*-
// Utilitaires partagés des tests de composants. `renderWithI18n` enveloppe le
// composant testé du fournisseur i18n (langue par défaut : français), pour que
// `useT()`/`useLocale()` fonctionnent sans configuration supplémentaire.

import { render, type RenderOptions } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";
import { LangProvider } from "../i18n";

function Wrapper({ children }: { children: ReactNode }) {
  return <LangProvider>{children}</LangProvider>;
}

/** Rend `ui` enveloppé du `LangProvider` (FR par défaut). */
export function renderWithI18n(
  ui: ReactElement,
  options?: Omit<RenderOptions, "wrapper">,
) {
  return render(ui, { wrapper: Wrapper, ...options });
}

// Réexporte l'API de Testing Library pour des imports uniques dans les tests.
export * from "@testing-library/react";
