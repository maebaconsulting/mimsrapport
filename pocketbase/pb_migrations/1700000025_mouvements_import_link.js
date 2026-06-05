/// <reference path="../pb_data/types.d.ts" />

// Lie chaque mouvement de titres à son import (relation `import`) + conserve le
// `manar_op_id` d'origine pour la traçabilité. Permet le remplacement propre d'un
// import (cascade) sans dupliquer les mouvements.
//
// Migration séparée car manar_imports est créée après mouvements_titres
// (1700000020 > 1700000010).

migrate(
  (app) => {
    const importId = app.findCollectionByNameOrId("manar_imports").id;
    const mouvements = app.findCollectionByNameOrId("mouvements_titres");
    mouvements.fields.add(
      new RelationField({
        name: "import",
        required: false,
        maxSelect: 1,
        collectionId: importId,
        cascadeDelete: true,
      }),
    );
    mouvements.fields.add(
      new TextField({ name: "manar_op_id", max: 64 }),
    );
    app.save(mouvements);
  },
  (app) => {
    const mouvements = app.findCollectionByNameOrId("mouvements_titres");
    mouvements.fields.removeByName("import");
    mouvements.fields.removeByName("manar_op_id");
    app.save(mouvements);
  },
);
