/// <reference path="../pb_data/types.d.ts" />

// Collection d'authentification `users` (présente dès la v1).
// Mono-poste : un utilisateur local est créé au premier lancement (auto-login).
// Multi-poste : gestion réelle des comptes et des rôles.
//
// Création défensive : selon la version de PocketBase, une collection `users`
// peut déjà exister à l'initialisation. On ne la recrée que si elle est absente.

migrate(
  (app) => {
    let exists = true
    try {
      app.findCollectionByNameOrId("users")
    } catch (_) {
      exists = false
    }
    if (exists) {
      return
    }

    const collection = new Collection({
      type: "auth",
      name: "users",
      // Mono-poste : règles permissives (accès local seulement, 127.0.0.1).
      // En multi-poste, durcir ces règles.
      listRule: "id = @request.auth.id",
      viewRule: "id = @request.auth.id",
      createRule: null,
      updateRule: "id = @request.auth.id",
      deleteRule: null,
      fields: [
        { type: "text", name: "name", max: 255 },
      ],
      passwordAuth: { enabled: true, identityFields: ["email"] },
    })
    app.save(collection)
  },
  (app) => {
    // Ne pas supprimer `users` au revert : collection potentiellement système.
  }
)
