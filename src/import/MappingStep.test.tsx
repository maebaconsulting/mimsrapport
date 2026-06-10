// -*- coding: utf-8 -*-
// @vitest-environment jsdom
//
// Flux de correspondance manuelle des colonnes : la validation des champs
// obligatoires conditionne le bouton « Importer », et la confirmation remonte le
// mapping choisi + le souhait de mémorisation.

import { describe, expect, it, vi } from "vitest";
import { fireEvent } from "@testing-library/react";
import { renderWithI18n } from "../test/test-utils";
import { MappingStep } from "./MappingStep";
import type { ColumnMapping } from "./manar-fields";

const HEADERS = ["Op", "Client", "ISIN"];
const SAMPLE_ROWS = [
  ["OP1", "Alice", "FR0001"],
  ["OP2", "Bob", "FR0002"],
];

/** Bouton « Importer » (seul `btn--primary` de l'étape). */
function confirmButton(container: HTMLElement): HTMLButtonElement {
  const btn = container.querySelector<HTMLButtonElement>("button.btn--primary");
  if (!btn) throw new Error("bouton de confirmation introuvable");
  return btn;
}

describe("MappingStep · validation des champs obligatoires", () => {
  it("désactive « Importer » tant qu'un champ obligatoire n'est pas mappé", () => {
    // donneur_ordre (obligatoire) laissé non mappé.
    const initial: ColumnMapping = { manar_op_id: 0, donneur_ordre: null };
    const { container } = renderWithI18n(
      <MappingStep
        headers={HEADERS}
        sampleRows={SAMPLE_ROWS}
        initialMapping={initial}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(confirmButton(container).disabled).toBe(true);
  });

  it("active « Importer » et remonte le mapping une fois le champ relié", () => {
    const onConfirm = vi.fn();
    const initial: ColumnMapping = { manar_op_id: 0, donneur_ordre: null };
    const { container } = renderWithI18n(
      <MappingStep
        headers={HEADERS}
        sampleRows={SAMPLE_ROWS}
        initialMapping={initial}
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />,
    );

    // Relie « Client (donneur d'ordre) » à la colonne 2 (index 1).
    const select = container.querySelector<HTMLSelectElement>("#map-donneur_ordre");
    expect(select).not.toBeNull();
    fireEvent.change(select!, { target: { value: "1" } });

    const btn = confirmButton(container);
    expect(btn.disabled).toBe(false);
    fireEvent.click(btn);

    expect(onConfirm).toHaveBeenCalledTimes(1);
    const [mapping, remember] = onConfirm.mock.calls[0];
    expect(mapping.manar_op_id).toBe(0);
    expect(mapping.donneur_ordre).toBe(1);
    expect(remember).toBe(true); // case « mémoriser » cochée par défaut
  });

  it("signale une colonne obligatoire mappée mais vide sur l'échantillon", () => {
    // donneur_ordre mappé vers la colonne 3 (index 2), vide dans l'échantillon.
    const emptyCol = [
      ["OP1", "Alice", ""],
      ["OP2", "Bob", ""],
    ];
    const initial: ColumnMapping = { manar_op_id: 0, donneur_ordre: 2 };
    const { container } = renderWithI18n(
      <MappingStep
        headers={HEADERS}
        sampleRows={emptyCol}
        initialMapping={initial}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    // Colonne obligatoire vide → import bloqué.
    expect(confirmButton(container).disabled).toBe(true);
  });

  it("appelle onCancel sur « Annuler »", () => {
    const onCancel = vi.fn();
    const { container } = renderWithI18n(
      <MappingStep
        headers={HEADERS}
        sampleRows={SAMPLE_ROWS}
        initialMapping={{ manar_op_id: 0, donneur_ordre: 1 }}
        onConfirm={vi.fn()}
        onCancel={onCancel}
      />,
    );
    const cancel = Array.from(
      container.querySelectorAll<HTMLButtonElement>("button.btn"),
    ).find((b) => !b.classList.contains("btn--primary"));
    fireEvent.click(cancel!);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
