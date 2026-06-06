/// <reference path="../pb_data/types.d.ts" />

// Collection `import_mappings` · correspondances de colonnes mémorisées pour
// l'import du fichier d'export legacy. Clé = signature des en-têtes (hash des
// libellés normalisés) : à l'import suivant, un fichier de même structure
// réutilise automatiquement son mapping sans redemander la correspondance.
//
// Distinct de l'idempotence par hash de contenu (manar_imports.file_hash) :
// ici on reconnaît une STRUCTURE, pas un contenu.
//
// Accès local ouvert (mono-poste, 127.0.0.1), cohérent avec les autres
// collections (cf 1700000030_regles_et_seed.js).

migrate(
  (app) => {
    const stamps = [
      { type: "autodate", name: "created", onCreate: true, onUpdate: false },
      { type: "autodate", name: "updated", onCreate: true, onUpdate: true },
    ];

    const collection = new Collection({
      type: "base",
      name: "import_mappings",
      fields: [
        // Signature des en-têtes normalisés (clé de reconnaissance du format).
        { type: "text", name: "header_signature", required: true, max: 128 },
        { type: "text", name: "libelle", max: 255 },
        // Nombre de lignes d'en-tête à ignorer (2 pour le format historique).
        { type: "number", name: "header_rows" },
        // Correspondance champ logique → index de colonne (0-based).
        { type: "json", name: "mapping", maxSize: 20000 },
        // Noms des colonnes « extra » (index → libellé), pour conservation brute.
        { type: "json", name: "extra_columns", maxSize: 20000 },
        // Instantané des en-têtes réels au moment de la création (diagnostic).
        { type: "json", name: "headers_snapshot", maxSize: 20000 },
        // Marque le mapping du format canonique / dernier utilisé.
        { type: "bool", name: "is_default" },
        ...stamps,
      ],
      indexes: [
        "CREATE UNIQUE INDEX idx_import_mappings_sig ON import_mappings (header_signature)",
      ],
    });

    app.save(collection);

    const saved = app.findCollectionByNameOrId("import_mappings");
    saved.listRule = "";
    saved.viewRule = "";
    saved.createRule = "";
    saved.updateRule = "";
    saved.deleteRule = "";
    app.save(saved);
  },
  (app) => {
    try {
      app.delete(app.findCollectionByNameOrId("import_mappings"));
    } catch (_) {}
  },
);
