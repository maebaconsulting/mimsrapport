// Service d'import Manar → PocketBase.
//
// Orchestre l'écriture : hash SHA-256 (idempotence), journal manar_imports,
// opérations brutes, puis dérivation et écriture des 6 entités. Équivalent local
// du dev-commit-manar de MIMS (pas de workflow 4-yeux en mono-poste).
//
// Stratégie d'écriture : « create-first » (un seul aller-retour dans le cas
// courant d'un import frais ; repli sur mise à jour si conflit d'unicité), en
// parallèle par lots. Les mouvements sont liés à l'import (cascade) pour un
// remplacement propre.

import type PocketBase from "pocketbase";
import { ClientResponseError } from "pocketbase";
import { ingestManarBytes } from "./manar-ingestor";
import type { IngestResult } from "./manar-ingestor";
import { parseManarAmount, parseManarDate } from "./manar-parser";
import type { ManarMappedRow } from "./manar-mapping";

export interface ImportCounts {
  operations: number;
  emetteurs: number;
  instruments: number;
  clients: number;
  clientsPP: number;
  clientsPM: number;
  portefeuilles: number;
  positions: number;
  mouvements: number;
}

export interface ImportSummary {
  status: "REUSSI";
  importId: string;
  fileName: string;
  fileHash: string;
  nbOperations: number;
  montantTotalXaf: number;
  durationMs: number;
  counts: ImportCounts;
  warnings: string[];
}

export interface AlreadyImported {
  status: "DEJA_IMPORTE";
  fileHash: string;
  existingImportId: string;
  existingFileName: string;
  existingCompletedAt: string;
}

export type ImportResult = ImportSummary | AlreadyImported;

export interface RunImportOptions {
  fileName: string;
  data: Uint8Array;
  /** Si true, remplace un import REUSSI antérieur de même hash. */
  replace?: boolean;
  /** Callback de progression (étape lisible). */
  onProgress?: (step: string) => void;
}

const POOL = 16;

/** Calcule le hash SHA-256 (hex) du contenu binaire via WebCrypto. */
export async function sha256Hex(data: Uint8Array): Promise<string> {
  const buffer = await crypto.subtle.digest("SHA-256", data as BufferSource);
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function isNotFound(err: unknown): boolean {
  return err instanceof ClientResponseError && err.status === 404;
}

/**
 * Crée le record ; en cas de conflit d'unicité (400), retrouve l'existant et le
 * met à jour. Retourne l'id. Optimal pour un import frais (1 aller-retour).
 */
async function createOrUpdate(
  pb: PocketBase,
  collection: string,
  filter: string,
  data: Record<string, unknown>,
): Promise<string> {
  try {
    const rec = await pb.collection(collection).create(data);
    return rec.id;
  } catch (err) {
    if (err instanceof ClientResponseError && err.status === 400) {
      try {
        const existing = await pb.collection(collection).getFirstListItem(filter);
        const rec = await pb.collection(collection).update(existing.id, data);
        return rec.id;
      } catch (inner) {
        // Si rien à mettre à jour, le 400 initial était une vraie erreur de
        // validation : on le propage.
        if (isNotFound(inner)) throw err;
        throw inner;
      }
    }
    throw err;
  }
}

/** Exécute des tâches par lots de concurrence limitée (localhost, mono-poste). */
async function runPool<T>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<void>,
): Promise<void> {
  let cursor = 0;
  async function next(): Promise<void> {
    const i = cursor++;
    if (i >= items.length) return;
    await worker(items[i], i);
    return next();
  }
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => next()),
  );
}

/** Construit l'enregistrement manar_operations depuis une ligne mappée. */
function toOperationRecord(
  importId: string,
  row: ManarMappedRow,
): Record<string, unknown> {
  return {
    import: importId,
    manar_op_id: row.manar_op_id,
    statut: row.statut,
    isin: row.isin,
    libelle_instrument: row.libelle_instrument,
    poste_code: row.poste_code,
    emetteur_code: row.emetteur_code,
    nature_operation: row.nature_operation,
    valeur_nominale_xaf: parseManarAmount(row.valeur_nominale_xaf),
    prix_xaf: parseManarAmount(row.prix_xaf),
    montant_brut_xaf: parseManarAmount(row.montant_brut_xaf),
    taux_interet: parseManarAmount(row.taux_interet),
    courus_xaf: parseManarAmount(row.courus_xaf),
    donneur_ordre: row.donneur_ordre,
    operateur_saisie: row.operateur_saisie,
    operateur_validation: row.operateur_validation,
    date_saisie: parseManarDate(row.date_saisie),
    date_operation: parseManarDate(row.date_operation),
    date_valeur: parseManarDate(row.date_valeur),
    date_validation: parseManarDate(row.date_validation),
    extra_columns: row.extra_columns,
  };
}

/**
 * Importe un fichier Manar dans PocketBase. Idempotent par file_hash : refuse un
 * réimport déjà REUSSI sauf si `replace` est vrai.
 */
export async function runImport(
  pb: PocketBase,
  opts: RunImportOptions,
): Promise<ImportResult> {
  const { fileName, data, replace = false, onProgress } = opts;
  const progress = (s: string) => onProgress?.(s);

  progress("Calcul de l'empreinte du fichier…");
  const fileHash = await sha256Hex(data);

  // Idempotence : un même hash déjà REUSSI ne se réimporte pas sans remplacement.
  // Binding de paramètres (pb.filter) : les valeurs ne sont jamais interpolées
  // brutes dans le filtre (protection contre l'injection).
  const priorReussi = await pb.collection("manar_imports").getList(1, 50, {
    filter: pb.filter('file_hash = {:h} && statut = "REUSSI"', { h: fileHash }),
    sort: "-created",
  });

  if (priorReussi.totalItems > 0 && !replace) {
    const existing = priorReussi.items[0];
    return {
      status: "DEJA_IMPORTE",
      fileHash,
      existingImportId: existing.id,
      existingFileName: existing.file_name,
      existingCompletedAt: existing.completed_at,
    };
  }

  if (priorReussi.totalItems > 0 && replace) {
    progress("Suppression de l'import précédent…");
    for (const prev of priorReussi.items) {
      // Cascade : supprime manar_operations et mouvements_titres liés.
      await pb.collection("manar_imports").delete(prev.id);
    }
  }

  // Pipeline en mémoire.
  progress("Analyse du fichier (parsing + dérivation)…");
  const ingest: IngestResult = ingestManarBytes(data);
  const { mappingResult, derived } = ingest;

  const startedAt = new Date();
  const montantTotal = ingest.reconciliationAggs.reduce(
    (sum, agg) => sum + agg.manar_montant_brut_xaf,
    0,
  );

  const importRecord = await pb.collection("manar_imports").create({
    file_name: fileName,
    file_hash: fileHash,
    file_size_bytes: data.length,
    statut: "EN_COURS",
    nb_operations: mappingResult.rows.length,
    montant_total_xaf: montantTotal,
    started_at: startedAt.toISOString(),
  });
  const importId = importRecord.id;

  try {
    // 1. Opérations brutes (création parallèle).
    progress(`Écriture des ${mappingResult.rows.length} opérations…`);
    await runPool(mappingResult.rows, POOL, async (row) => {
      await pb.collection("manar_operations").create(
        toOperationRecord(importId, row),
      );
    });

    // 2. Émetteurs.
    progress("Dérivation des émetteurs…");
    const emetteurIdByCode = new Map<string, string>();
    await runPool(derived.emetteurs, POOL, async (e) => {
      const id = await createOrUpdate(pb, "emetteurs", pb.filter("code = {:v}", { v: e.code }), {
        code: e.code,
        nom: e.nom,
        type: e.type,
        pays: e.pays,
        secteur: e.secteur,
      });
      emetteurIdByCode.set(e.code, id);
    });

    // 3. Clients + extensions PP/PM.
    progress("Dérivation des clients…");
    const clientIdByCode = new Map<string, string>();
    await runPool(derived.clients, POOL, async (c) => {
      const id = await createOrUpdate(pb, "clients", pb.filter("code = {:v}", { v: c.code }), {
        code: c.code,
        type: c.type,
        nom: c.nom,
        prenom: c.prenom,
        provenance: c.provenance,
      });
      clientIdByCode.set(c.code, id);
    });
    await runPool(derived.clients, POOL, async (c) => {
      const clientId = clientIdByCode.get(c.code);
      if (!clientId) return;
      const byClient = pb.filter("client = {:v}", { v: clientId });
      if (c.type === "PP") {
        await createOrUpdate(pb, "clients_pp", byClient, {
          client: clientId,
        });
      } else {
        await createOrUpdate(pb, "clients_pm", byClient, {
          client: clientId,
          raison_sociale: c.raison_sociale,
          rccm: c.rccm,
          forme_juridique: c.forme_juridique,
        });
      }
    });
    const nbPP = derived.clients.filter((c) => c.type === "PP").length;
    const nbPM = derived.clients.filter((c) => c.type === "PM").length;

    // 4. Portefeuilles.
    progress("Dérivation des portefeuilles…");
    await runPool(derived.portefeuilles, POOL, async (p) => {
      const clientId = clientIdByCode.get(p.client_code);
      if (!clientId) return;
      await createOrUpdate(pb, "portefeuilles", pb.filter("code = {:v}", { v: p.code }), {
        code: p.code,
        libelle: p.libelle,
        client: clientId,
        devise: p.devise,
        statut: p.statut,
      });
    });

    // 5. Instruments.
    progress("Dérivation des instruments…");
    const instrumentIdByIsin = new Map<string, string>();
    await runPool(derived.instruments, POOL, async (inst) => {
      const emetteurId = emetteurIdByCode.get(inst.emetteur_code) ?? null;
      const id = await createOrUpdate(pb, "instruments", pb.filter("isin = {:v}", { v: inst.isin }), {
        isin: inst.isin,
        code_mims: inst.code_mims,
        libelle_fr: inst.libelle_fr,
        type: inst.type,
        categorie: inst.categorie,
        devise: inst.devise,
        emetteur: emetteurId,
        taux_interet: inst.taux_interet,
        date_echeance: inst.date_echeance,
        base_couru: inst.base_couru,
        statut: inst.statut,
      });
      instrumentIdByIsin.set(inst.isin, id);
    });

    // 6. Mouvements (création parallèle ; liés à l'import pour cascade).
    progress(`Écriture des ${derived.mouvements.length} mouvements…`);
    let nbMouvements = 0;
    await runPool(derived.mouvements, POOL, async (m) => {
      const clientId = clientIdByCode.get(m.client_code);
      const instrumentId = instrumentIdByIsin.get(m.isin);
      if (!clientId || !instrumentId) return; // ISIN sans instrument dérivé
      await pb.collection("mouvements_titres").create({
        import: importId,
        manar_op_id: m.manar_op_id,
        client: clientId,
        instrument: instrumentId,
        sens: m.sens,
        quantite: m.quantite,
        prix_unitaire_xaf: m.prix_unitaire_xaf,
        date_operation: m.date_operation,
        date_valeur: m.date_valeur,
        statut: m.statut,
        source: "MANAR_IMPORT",
      });
      nbMouvements++;
    });

    // 7. Positions (create-first ; upsert par couple client+instrument).
    progress("Agrégation des positions…");
    let nbPositions = 0;
    await runPool(derived.positions, POOL, async (pos) => {
      const clientId = clientIdByCode.get(pos.client_code);
      const instrumentId = instrumentIdByIsin.get(pos.isin);
      if (!clientId || !instrumentId) return;
      await createOrUpdate(
        pb,
        "positions",
        pb.filter("client = {:c} && instrument = {:i}", {
          c: clientId,
          i: instrumentId,
        }),
        {
          client: clientId,
          instrument: instrumentId,
          quantite_totale: pos.quantite_totale,
          quantite_disponible: pos.quantite_totale,
          quantite_reservee: 0,
          quantite_bloquee: 0,
          pmp_xaf: pos.pmp_xaf,
          valorisation_xaf:
            pos.pmp_xaf != null ? pos.pmp_xaf * pos.quantite_totale : null,
          derniere_maj: startedAt.toISOString(),
        },
      );
      nbPositions++;
    });

    // 8. Clôture du journal (REUSSI).
    const completedAt = new Date();
    const durationMs = completedAt.getTime() - startedAt.getTime();
    await pb.collection("manar_imports").update(importId, {
      statut: "REUSSI",
      completed_at: completedAt.toISOString(),
      duration_ms: durationMs,
    });

    return {
      status: "REUSSI",
      importId,
      fileName,
      fileHash,
      nbOperations: mappingResult.rows.length,
      montantTotalXaf: montantTotal,
      durationMs,
      counts: {
        operations: mappingResult.rows.length,
        emetteurs: derived.emetteurs.length,
        instruments: derived.instruments.length,
        clients: derived.clients.length,
        clientsPP: nbPP,
        clientsPM: nbPM,
        portefeuilles: derived.portefeuilles.length,
        positions: nbPositions,
        mouvements: nbMouvements,
      },
      warnings: [
        ...ingest.parseResult.warnings.map((w) => w.message),
        ...derived.warnings,
      ],
    };
  } catch (err) {
    await pb
      .collection("manar_imports")
      .update(importId, {
        statut: "ECHOUE",
        error_message: String(err).slice(0, 2000),
        completed_at: new Date().toISOString(),
      })
      .catch(() => undefined);
    throw err;
  }
}
