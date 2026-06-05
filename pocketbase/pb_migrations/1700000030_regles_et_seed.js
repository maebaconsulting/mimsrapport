/// <reference path="../pb_data/types.d.ts" />

// Règles d'accès API (mono-poste) et amorçage de l'utilisateur local.
//
// Mono-poste : la base vit en LOCAL (127.0.0.1) et un seul utilisateur l'exploite.
// Les collections sont donc en accès local ouvert (règle "" = satisfaite sans
// évaluation d'auth). Choix imposé par une limite de PocketBase : l'évaluation
// d'une règle référençant `@request.auth.id` est NON FIABLE sous charge d'écriture
// concurrente locale (auth vue par intermittence comme vide → « create rule
// failure: sql: no rows in result set » → 400, et échec de validation des
// relations vers `users`). Comme l'API n'écoute que sur 127.0.0.1, l'ouverture
// locale est acceptable. L'authentification et l'auto-login restent présents
// (l'utilisateur local existe) pour l'évolution multi-poste, qui DURCIRA ces
// règles par rôle et exposera PocketBase sur le réseau.
//
// `users` : lecture ouverte en local (nécessaire à la validation de la relation
// exports_log.user) ; création/màj/suppression restent réservées au superuser.

const LOCAL_EMAIL = "poste-local@reporting-manar.app"
const LOCAL_PASSWORD = "manar-mono-poste-2026"

// Règle "" = accès autorisé sans évaluation d'auth (local-only mono-poste).
const LOCAL_OPEN = ""

const BUSINESS_COLLECTIONS = [
  "clients",
  "clients_pp",
  "clients_pm",
  "portefeuilles",
  "emetteurs",
  "instruments",
  "positions",
  "mouvements_titres",
  "manar_imports",
  "manar_operations",
  "exports_log",
]

migrate(
  (app) => {
    // Collections métier et techniques : accès local ouvert.
    for (const name of BUSINESS_COLLECTIONS) {
      const c = app.findCollectionByNameOrId(name)
      c.listRule = LOCAL_OPEN
      c.viewRule = LOCAL_OPEN
      c.createRule = LOCAL_OPEN
      c.updateRule = LOCAL_OPEN
      c.deleteRule = LOCAL_OPEN
      app.save(c)
    }

    // users : lecture ouverte (validation de relation), écriture superuser.
    const users = app.findCollectionByNameOrId("users")
    users.listRule = LOCAL_OPEN
    users.viewRule = LOCAL_OPEN
    app.save(users)

    // Amorçage de l'utilisateur local (idempotent).
    let userExists = true
    try {
      app.findFirstRecordByData("users", "email", LOCAL_EMAIL)
    } catch (_) {
      userExists = false
    }
    if (!userExists) {
      const record = new Record(users)
      record.set("email", LOCAL_EMAIL)
      record.set("name", "Poste local")
      record.set("emailVisibility", false)
      record.set("verified", true)
      record.setPassword(LOCAL_PASSWORD)
      app.save(record)
    }
  },
  (app) => {
    try {
      const rec = app.findFirstRecordByData("users", "email", LOCAL_EMAIL)
      app.delete(rec)
    } catch (_) {}
  }
)
