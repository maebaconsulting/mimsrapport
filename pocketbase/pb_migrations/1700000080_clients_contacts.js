/// <reference path="../pb_data/types.d.ts" />

// Collection `clients_contacts` · informations de contact saisies manuellement
// (Email, Mobile/Téléphone, WhatsApp, Adresse, Notes). Extension 1-1 de `clients`.
//
// IMPORTANT : ces données ne proviennent PAS du fichier d'export et doivent
// SURVIVRE aux ré-imports. L'import (runImport) ne touche jamais cette collection
// (il fait un upsert sur clients/portefeuilles/positions et ne SUPPRIME jamais de
// client). Le `cascadeDelete: true` ne se déclenche donc que si un client est
// explicitement supprimé, ce que l'import ne fait pas. NE JAMAIS ajouter de
// suppression de clients au chemin d'import sous peine de perdre les contacts.
//
// Accès local ouvert (mono-poste), cohérent avec 1700000030_regles_et_seed.js.

migrate(
  (app) => {
    const stamps = [
      { type: "autodate", name: "created", onCreate: true, onUpdate: false },
      { type: "autodate", name: "updated", onCreate: true, onUpdate: true },
    ];

    const clientsId = app.findCollectionByNameOrId("clients").id;

    const collection = new Collection({
      type: "base",
      name: "clients_contacts",
      fields: [
        {
          type: "relation",
          name: "client",
          required: true,
          maxSelect: 1,
          collectionId: clientsId,
          cascadeDelete: true,
        },
        { type: "text", name: "email", max: 255 },
        { type: "text", name: "mobile", max: 64 },
        { type: "text", name: "telephone", max: 64 },
        { type: "text", name: "whatsapp", max: 64 },
        { type: "text", name: "adresse", max: 1000 },
        { type: "text", name: "notes", max: 5000 },
        ...stamps,
      ],
      indexes: [
        "CREATE UNIQUE INDEX idx_clients_contacts_client ON clients_contacts (client)",
      ],
    });

    app.save(collection);

    const saved = app.findCollectionByNameOrId("clients_contacts");
    saved.listRule = "";
    saved.viewRule = "";
    saved.createRule = "";
    saved.updateRule = "";
    saved.deleteRule = "";
    app.save(saved);
  },
  (app) => {
    try {
      app.delete(app.findCollectionByNameOrId("clients_contacts"));
    } catch (_) {}
  },
);
