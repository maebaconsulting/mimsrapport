/// <reference path="../pb_data/types.d.ts" />

// Règles d'accès API (mono-poste) et amorçage de l'utilisateur local.
//
// Mono-poste : la base vit en local (127.0.0.1) et un seul utilisateur l'exploite.
// On autorise donc tout accès AUTHENTIFIÉ aux collections métier et techniques
// (`@request.auth.id != ""`). En multi-poste, durcir ces règles par rôle.
//
// L'utilisateur local est amorcé ici pour permettre l'auto-login transparent du
// frontend. Ses identifiants sont connus de l'app (constantes côté frontend).
// Limite assumée mono-poste : identifiants fixes locaux. Le multi-poste bascule
// sur une vraie gestion de comptes (déjà fournie par PocketBase).

const LOCAL_EMAIL = "poste-local@reporting-manar.app"
const LOCAL_PASSWORD = "manar-mono-poste-2026"

const AUTHED = '@request.auth.id != ""'

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
    // Règles d'accès : lecture/écriture pour tout utilisateur authentifié.
    for (const name of BUSINESS_COLLECTIONS) {
      const c = app.findCollectionByNameOrId(name)
      c.listRule = AUTHED
      c.viewRule = AUTHED
      c.createRule = AUTHED
      c.updateRule = AUTHED
      c.deleteRule = AUTHED
      app.save(c)
    }

    // Amorçage de l'utilisateur local (idempotent).
    let userExists = true
    try {
      app.findFirstRecordByData("users", "email", LOCAL_EMAIL)
    } catch (_) {
      userExists = false
    }
    if (!userExists) {
      const users = app.findCollectionByNameOrId("users")
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
    // Revert : retirer l'utilisateur amorcé ; laisser les règles en l'état.
    try {
      const rec = app.findFirstRecordByData("users", "email", LOCAL_EMAIL)
      app.delete(rec)
    } catch (_) {}
  }
)
