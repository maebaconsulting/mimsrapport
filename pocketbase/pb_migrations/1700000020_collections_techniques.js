/// <reference path="../pb_data/types.d.ts" />

// Collections techniques : journal des imports, lignes brutes Manar, traçabilité
// des exports PDF (voir specs/02-DATA-MODEL.md).
//
// Ordre : manar_imports → manar_operations (relation import) ; exports_log
// (relation users, déjà créée).

migrate(
  (app) => {
    const stamps = [
      { type: "autodate", name: "created", onCreate: true, onUpdate: false },
      { type: "autodate", name: "updated", onCreate: true, onUpdate: true },
    ]
    const id = (name) => app.findCollectionByNameOrId(name).id

    // manar_imports · journal des imports
    app.save(
      new Collection({
        type: "base",
        name: "manar_imports",
        fields: [
          { type: "text", name: "file_name", max: 512 },
          { type: "text", name: "file_hash", max: 64 },
          { type: "number", name: "file_size_bytes" },
          { type: "select", name: "statut", maxSelect: 1, values: ["EN_COURS", "REUSSI", "ECHOUE", "ANNULE"] },
          { type: "number", name: "nb_operations" },
          { type: "number", name: "montant_total_xaf" },
          { type: "date", name: "started_at" },
          { type: "date", name: "completed_at" },
          { type: "number", name: "duration_ms" },
          { type: "text", name: "error_message", max: 2000 },
          ...stamps,
        ],
        // Pas d'unicité globale sur file_hash : un import ÉCHOUÉ peut être rejoué.
        // L'idempotence (refus si déjà REUSSI) est une contrainte applicative.
        indexes: ["CREATE INDEX idx_manar_imports_hash ON manar_imports (file_hash)"],
      })
    )

    // manar_operations · ligne brute du fichier, conservée intégralement
    app.save(
      new Collection({
        type: "base",
        name: "manar_operations",
        fields: [
          { type: "relation", name: "import", required: true, maxSelect: 1, collectionId: id("manar_imports"), cascadeDelete: true },
          { type: "text", name: "manar_op_id", required: true, max: 64 },
          { type: "select", name: "statut", maxSelect: 1, values: ["F", "V", "P", "S"] },
          { type: "text", name: "isin", max: 20 },
          { type: "text", name: "libelle_instrument", max: 255 },
          { type: "text", name: "poste_code", max: 32 },
          { type: "text", name: "emetteur_code", max: 32 },
          { type: "text", name: "nature_operation", max: 64 },
          { type: "number", name: "valeur_nominale_xaf" },
          { type: "number", name: "prix_xaf" },
          { type: "number", name: "montant_brut_xaf" },
          { type: "number", name: "taux_interet" },
          { type: "number", name: "courus_xaf" },
          { type: "text", name: "donneur_ordre", max: 255 },
          { type: "text", name: "operateur_saisie", max: 128 },
          { type: "text", name: "operateur_validation", max: 128 },
          { type: "date", name: "date_saisie" },
          { type: "date", name: "date_operation" },
          { type: "date", name: "date_valeur" },
          { type: "date", name: "date_validation" },
          { type: "json", name: "extra_columns", maxSize: 50000 },
          ...stamps,
        ],
        indexes: ["CREATE UNIQUE INDEX idx_manar_operations_import_op ON manar_operations (import, manar_op_id)"],
      })
    )

    // exports_log · traçabilité des PDF produits (équivalent auditLogger MIMS)
    app.save(
      new Collection({
        type: "base",
        name: "exports_log",
        fields: [
          { type: "text", name: "type_rapport", max: 128 },
          { type: "text", name: "cible", max: 512 },
          { type: "text", name: "hash_pdf", max: 64 },
          { type: "relation", name: "user", maxSelect: 1, collectionId: id("users"), cascadeDelete: false },
          ...stamps,
        ],
        indexes: [],
      })
    )
  },
  (app) => {
    for (const name of ["exports_log", "manar_operations", "manar_imports"]) {
      try {
        app.delete(app.findCollectionByNameOrId(name))
      } catch (_) {}
    }
  }
)
