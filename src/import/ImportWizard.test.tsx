// -*- coding: utf-8 -*-
// @vitest-environment jsdom
//
// Verrouille le comportement du dépôt d'un fichier au mauvais format : le message
// spécifique (« Format non pris en charge… ») doit être AFFICHÉ directement, et
// non relégué au « Détail technique » replié réservé aux traces d'exception.

import { describe, expect, it, vi } from "vitest";
import { fireEvent, waitFor } from "@testing-library/react";
import { renderWithI18n } from "../test/test-utils";

// Modules natifs / lourds neutralisés : le chemin « mauvais format » s'arrête
// avant tout accès PocketBase, fichier ou parseur xlsx.
vi.mock("../lib/pocketbase", () => ({ getPocketBase: vi.fn() }));
vi.mock("../lib/fileio", () => ({ pickManarFile: vi.fn() }));
vi.mock("./import-service", () => ({ runImport: vi.fn() }));
vi.mock("./manar-parser", () => ({ readManarWorkbook: vi.fn() }));
vi.mock("./manar-detect", () => ({ detectMapping: vi.fn() }));
vi.mock("./mapping-store", () => ({
  loadMappingForHeaders: vi.fn(),
  saveMapping: vi.fn(),
}));
vi.mock("./ImportHistory", () => ({ ImportHistory: () => null }));
vi.mock("../clients/ClientsTable", () => ({ ClientsTable: () => null }));

import { ImportWizard } from "./ImportWizard";

/** Construit un évènement de dépôt portant un unique fichier. */
function dropFile(zone: Element, file: File) {
  fireEvent.drop(zone, { dataTransfer: { files: [file] } });
}

describe("ImportWizard · dépôt d'un fichier au mauvais format", () => {
  it("affiche le message de format spécifique, pas seulement le générique", async () => {
    const { container } = renderWithI18n(<ImportWizard />);
    const zone = container.querySelector(".import-dropzone");
    expect(zone).not.toBeNull();

    dropFile(zone!, new File(["x"], "releve.pdf", { type: "application/pdf" }));

    // Le message visible nomme le format rejeté et le fichier déposé.
    const msg = await waitFor(() => {
      const p = Array.from(container.querySelectorAll("p")).find(
        (el) =>
          el.textContent?.includes("Format non pris en charge") &&
          el.textContent.includes("releve.pdf"),
      );
      if (!p) throw new Error("message de format non affiché");
      return p;
    });

    // Affiché en clair (paragraphe direct), pas enfoui dans <details>.
    expect(msg.closest("details")).toBeNull();
    // Aucun bloc « Détail technique » : il n'y a pas de trace à replier ici.
    const details = container.querySelector(".import-warnings");
    expect(details).toBeNull();
  });

  it("propose de recommencer après l'erreur", async () => {
    const { container } = renderWithI18n(<ImportWizard />);
    const zone = container.querySelector(".import-dropzone");
    dropFile(zone!, new File(["x"], "donnees.csv", { type: "text/csv" }));

    await waitFor(() => {
      const erreur = container.querySelector(".import-notice--danger");
      if (!erreur) throw new Error("état d'erreur absent");
    });
    // Un bouton d'action de reprise est présent dans le bloc d'erreur.
    const action = container.querySelector(
      ".import-notice--danger .import-notice__actions button",
    );
    expect(action).not.toBeNull();
  });
});
