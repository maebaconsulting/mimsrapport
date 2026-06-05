import { describe, expect, it } from "vitest";
import {
  computeDashboards,
  scoreToStatus,
  type DashMouvement,
  type DashPosition,
} from "./aggregator";

function pos(p: Partial<DashPosition>): DashPosition {
  return {
    client_id: "c1",
    client_code: "CT-MNR-000001",
    client_nom: "Client 1",
    client_type: "PP",
    emetteur_id: "e1",
    emetteur_nom: "État du Gabon",
    emetteur_type: "SOUVERAIN",
    instrument_type: "OBLIGATION",
    taux_interet: 6,
    date_echeance: "2029-12-31",
    quantite: 100,
    valorisation_xaf: 1_000_000,
    ...p,
  };
}

describe("scoreToStatus", () => {
  it("segmente selon les seuils", () => {
    expect(scoreToStatus(10)).toBe("critique");
    expect(scoreToStatus(45)).toBe("attention");
    expect(scoreToStatus(70)).toBe("bon");
    expect(scoreToStatus(90)).toBe("excellent");
  });
});

describe("computeDashboards", () => {
  it("calcule l'encours global", () => {
    const d = computeDashboards(
      [
        pos({ client_id: "c1", valorisation_xaf: 1_000_000 }),
        pos({ client_id: "c2", valorisation_xaf: 500_000 }),
      ],
      [],
    );
    expect(d.encours.valorisationTotale).toBe(1_500_000);
    expect(d.encours.nbPositions).toBe(2);
    expect(d.encours.nbComptes).toBe(2);
  });

  it("calcule la répartition par classe avec parts", () => {
    const d = computeDashboards(
      [
        pos({ instrument_type: "ACTION", valorisation_xaf: 750_000 }),
        pos({ instrument_type: "OBLIGATION", valorisation_xaf: 250_000 }),
      ],
      [],
    );
    const actions = d.repartitionClasse.find((c) => c.cle === "ACTION");
    expect(actions?.part).toBeCloseTo(75);
  });

  it("détecte une alerte de concentration émetteur > 30 %", () => {
    const d = computeDashboards(
      [
        pos({ emetteur_id: "e1", valorisation_xaf: 800_000 }),
        pos({ emetteur_id: "e2", emetteur_nom: "CCA Bank", valorisation_xaf: 200_000 }),
      ],
      [],
    );
    expect(d.concentrationEmetteur.concentrationMax).toBeCloseTo(80);
    expect(d.concentrationEmetteur.alerte).toBe(true);
    // 80 % de concentration → score faible (dégressif au-delà de 15 %).
    expect(d.concentrationEmetteur.score).toBeLessThan(30);
  });

  it("donne un score parfait si concentration ≤ 15 %", () => {
    const positions: DashPosition[] = [];
    for (let i = 0; i < 10; i++) {
      positions.push(
        pos({ emetteur_id: `e${i}`, valorisation_xaf: 100_000 }),
      );
    }
    const d = computeDashboards(positions, []);
    expect(d.concentrationEmetteur.concentrationMax).toBeCloseTo(10);
    expect(d.concentrationEmetteur.score).toBe(100);
    expect(d.concentrationEmetteur.alerte).toBe(false);
  });

  it("agrège l'échéancier obligataire par année", () => {
    const d = computeDashboards(
      [
        pos({ instrument_type: "OBLIGATION", date_echeance: "2029-06-30", valorisation_xaf: 100 }),
        pos({ instrument_type: "OBLIGATION", date_echeance: "2029-12-31", valorisation_xaf: 200 }),
        pos({ instrument_type: "OBLIGATION", date_echeance: "2031-01-01", valorisation_xaf: 50 }),
        pos({ instrument_type: "ACTION", date_echeance: null, valorisation_xaf: 999 }),
      ],
      [],
    );
    expect(d.echeancier).toEqual([
      { annee: "2029", montant: 300 },
      { annee: "2031", montant: 50 },
    ]);
  });

  it("ventile les flux d'activité achat/vente par mois", () => {
    const mvts: DashMouvement[] = [
      { sens: "ACHAT", date_operation: "2026-01-15", montant_xaf: 1000 },
      { sens: "VENTE", date_operation: "2026-01-20", montant_xaf: 400 },
      { sens: "ACHAT", date_operation: "2026-02-01", montant_xaf: 700 },
    ];
    const d = computeDashboards([], mvts);
    expect(d.fluxActivite).toEqual([
      { periode: "2026-01", achat: 1000, vente: 400 },
      { periode: "2026-02", achat: 700, vente: 0 },
    ]);
  });

  it("reconstitue l'évolution de l'encours par cumul des flux nets mensuels", () => {
    // Mois 01 : +1000 (achat) −400 (vente) = net +600 → cumul 600.
    // Mois 02 : +700 (achat) → net +700 → cumul 1300.
    const mvts: DashMouvement[] = [
      { sens: "ACHAT", date_operation: "2026-01-15", montant_xaf: 1000 },
      { sens: "VENTE", date_operation: "2026-01-20", montant_xaf: 400 },
      { sens: "ACHAT", date_operation: "2026-02-01", montant_xaf: 700 },
    ];
    const d = computeDashboards([], mvts);
    expect(d.evolutionEncours).toEqual([
      { periode: "2026-01", cumule: 600 },
      { periode: "2026-02", cumule: 1300 },
    ]);
    expect(d.sparkEncours).toEqual([600, 1300]);
  });

  it("ignore les dates de mouvement nulles ou mal formées dans l'évolution", () => {
    const mvts: DashMouvement[] = [
      { sens: "ACHAT", date_operation: null, montant_xaf: 999 },
      { sens: "ACHAT", date_operation: "bad", montant_xaf: 999 },
      { sens: "OST_ENTREE", date_operation: "2026-03-10", montant_xaf: 500 },
      { sens: "OST_SORTIE", date_operation: "2026-03-12", montant_xaf: 200 },
    ];
    const d = computeDashboards([], mvts);
    expect(d.evolutionEncours).toEqual([{ periode: "2026-03", cumule: 300 }]);
  });

  it("calcule le taux moyen pondéré obligataire", () => {
    const d = computeDashboards(
      [
        pos({ instrument_type: "OBLIGATION", taux_interet: 6, valorisation_xaf: 1_000_000 }),
        pos({ instrument_type: "OBLIGATION", taux_interet: 4, valorisation_xaf: 1_000_000 }),
        pos({ instrument_type: "ACTION", taux_interet: null, valorisation_xaf: 5_000_000 }),
      ],
      [],
    );
    expect(d.tauxMoyenPondereObligataire).toBeCloseTo(5);
  });

  it("sépare souverain et corporate", () => {
    const d = computeDashboards(
      [
        pos({ emetteur_type: "SOUVERAIN", valorisation_xaf: 600 }),
        pos({ emetteur_type: "CORPORATE", valorisation_xaf: 400 }),
      ],
      [],
    );
    expect(d.souverainVsCorporate).toEqual({ souverain: 600, corporate: 400 });
  });
});
