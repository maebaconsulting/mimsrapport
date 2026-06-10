// -*- coding: utf-8 -*-
// @vitest-environment jsdom
//
// Fiche de contact : chargement (sans fiche existante → formulaire vierge),
// création à l'enregistrement, validation de l'adresse e-mail et fermeture par
// la touche Échap. PocketBase et la logique de réessai sont simulés.

import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, waitFor, screen } from "@testing-library/react";
import { renderWithI18n } from "../test/test-utils";

const h = vi.hoisted(() => ({
  getFirstListItem: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
}));

vi.mock("../lib/pocketbase", () => ({
  getPocketBase: () =>
    Promise.resolve({
      filter: (s: string) => s,
      collection: () => ({
        getFirstListItem: h.getFirstListItem,
        create: h.create,
        update: h.update,
      }),
    }),
}));

// Réessai neutralisé : exécute la fonction une fois, sans temporisation.
vi.mock("../lib/retry", () => ({
  withRetry: (fn: () => unknown) => fn(),
}));

import { ClientContactPanel } from "./ClientContactPanel";

beforeEach(() => {
  h.getFirstListItem.mockReset();
  h.create.mockReset();
  h.update.mockReset();
});

/** Rend le panneau pour un client neuf (aucune fiche existante : 404). */
async function renderVierge() {
  h.getFirstListItem.mockRejectedValue(new Error("404"));
  const onClose = vi.fn();
  const onSaved = vi.fn();
  renderWithI18n(
    <ClientContactPanel
      clientId="cli1"
      clientName="Alice Mballa"
      onClose={onClose}
      onSaved={onSaved}
    />,
  );
  // Attendre la fin du chargement (champ e-mail monté).
  await waitFor(() => {
    if (!document.getElementById("contact-email")) {
      throw new Error("formulaire non chargé");
    }
  });
  return { onClose, onSaved };
}

describe("ClientContactPanel", () => {
  it("crée une fiche à l'enregistrement quand aucune n'existe", async () => {
    h.create.mockResolvedValue({ id: "rec1" });
    const { onSaved } = await renderVierge();

    fireEvent.change(document.getElementById("contact-email")!, {
      target: { value: "alice@example.com" },
    });
    fireEvent.change(document.getElementById("contact-mobile")!, {
      target: { value: "+241 06 00 00 00" },
    });

    const save = screen.getByRole("button", { name: /enregistrer/i });
    fireEvent.click(save);

    await waitFor(() => expect(h.create).toHaveBeenCalledTimes(1));
    const data = h.create.mock.calls[0][0];
    expect(data).toMatchObject({
      client: "cli1",
      email: "alice@example.com",
      mobile: "+241 06 00 00 00",
    });
    expect(h.update).not.toHaveBeenCalled();
    expect(onSaved).toHaveBeenCalled();
    // Avis de succès affiché.
    await waitFor(() =>
      expect(document.querySelector(".contact-notice--ok")).not.toBeNull(),
    );
  });

  it("refuse un e-mail invalide sans appeler la création", async () => {
    await renderVierge();

    fireEvent.change(document.getElementById("contact-email")!, {
      target: { value: "pas-un-email" },
    });
    fireEvent.click(screen.getByRole("button", { name: /enregistrer/i }));

    await waitFor(() => {
      const email = document.getElementById("contact-email")!;
      expect(email.getAttribute("aria-invalid")).toBe("true");
    });
    expect(h.create).not.toHaveBeenCalled();
  });

  it("ferme la modale sur la touche Échap", async () => {
    const { onClose } = await renderVierge();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("précharge les valeurs d'une fiche existante", async () => {
    h.getFirstListItem.mockResolvedValue({
      id: "rec9",
      email: "bob@example.com",
      mobile: "",
      telephone: "011223344",
      whatsapp: "",
      adresse: "Libreville",
      notes: "",
    });
    h.update.mockResolvedValue({});
    renderWithI18n(
      <ClientContactPanel
        clientId="cli2"
        clientName="Bob Onana"
        onClose={vi.fn()}
      />,
    );
    await waitFor(() => {
      const email = document.getElementById("contact-email") as HTMLInputElement | null;
      expect(email?.value).toBe("bob@example.com");
    });
    // Un enregistrement existant → update (pas create).
    fireEvent.click(screen.getByRole("button", { name: /enregistrer/i }));
    await waitFor(() => expect(h.update).toHaveBeenCalledTimes(1));
    expect(h.create).not.toHaveBeenCalled();
    expect(h.update.mock.calls[0][0]).toBe("rec9");
  });
});
