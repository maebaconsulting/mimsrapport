/// <reference path="../pb_data/types.d.ts" />

// Ajoute `clients.first_seen_at` : date du premier import ayant fait apparaître
// le client. Renseigné UNE SEULE FOIS, à la création du client (jamais réécrit
// lors des ré-imports). Permet de repérer les nouveaux clients entre deux imports.

migrate(
  (app) => {
    const clients = app.findCollectionByNameOrId("clients");
    clients.fields.add(new DateField({ name: "first_seen_at" }));
    app.save(clients);
  },
  (app) => {
    const clients = app.findCollectionByNameOrId("clients");
    clients.fields.removeByName("first_seen_at");
    app.save(clients);
  },
);
