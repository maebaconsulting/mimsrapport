/// <reference path="../pb_data/types.d.ts" />

// Les 6 entités métier dérivées du fichier Manar (voir specs/02-DATA-MODEL.md).
// Noms de colonnes repris de MIMS pour la fidélité des rapports.
// Pièges hérités : colonnes réelles `isin` et `libelle_fr` (jamais `code_isin` /
// `libelle_court`). Application mono-SDB : aucune colonne `sdb_id`, aucune RLS.
//
// Ordre de création imposé par les relations :
//   clients, emetteurs → clients_pp, clients_pm, portefeuilles, instruments
//   → positions, mouvements_titres

migrate(
  (app) => {
    // Champs d'horodatage communs (PocketBase n'ajoute plus created/updated
    // automatiquement : on les déclare en autodate).
    const stamps = [
      { type: "autodate", name: "created", onCreate: true, onUpdate: false },
      { type: "autodate", name: "updated", onCreate: true, onUpdate: true },
    ]

    const id = (name) => app.findCollectionByNameOrId(name).id

    // 1. clients · racine commune PP / PM
    app.save(
      new Collection({
        type: "base",
        name: "clients",
        fields: [
          { type: "text", name: "code", required: true, max: 64 },
          { type: "select", name: "type", required: true, maxSelect: 1, values: ["PP", "PM"] },
          { type: "text", name: "nom", max: 255 },
          { type: "text", name: "prenom", max: 255 },
          { type: "text", name: "provenance", max: 64 },
          ...stamps,
        ],
        indexes: ["CREATE UNIQUE INDEX idx_clients_code ON clients (code)"],
      })
    )

    // 2. emetteurs
    app.save(
      new Collection({
        type: "base",
        name: "emetteurs",
        fields: [
          { type: "text", name: "code", required: true, max: 64 },
          { type: "text", name: "nom", max: 255 },
          { type: "select", name: "type", maxSelect: 1, values: ["CORPORATE", "SOUVERAIN"] },
          { type: "text", name: "pays", max: 2 },
          { type: "text", name: "secteur", max: 128 },
          ...stamps,
        ],
        indexes: ["CREATE UNIQUE INDEX idx_emetteurs_code ON emetteurs (code)"],
      })
    )

    // 3. clients_pp · extension 1-1
    app.save(
      new Collection({
        type: "base",
        name: "clients_pp",
        fields: [
          { type: "relation", name: "client", required: true, maxSelect: 1, collectionId: id("clients"), cascadeDelete: true },
          { type: "date", name: "date_naissance" },
          { type: "text", name: "nationalite", max: 64 },
          ...stamps,
        ],
        indexes: ["CREATE UNIQUE INDEX idx_clients_pp_client ON clients_pp (client)"],
      })
    )

    // 4. clients_pm · extension 1-1
    app.save(
      new Collection({
        type: "base",
        name: "clients_pm",
        fields: [
          { type: "relation", name: "client", required: true, maxSelect: 1, collectionId: id("clients"), cascadeDelete: true },
          { type: "text", name: "raison_sociale", max: 255 },
          { type: "text", name: "rccm", max: 64 },
          { type: "text", name: "forme_juridique", max: 64 },
          ...stamps,
        ],
        indexes: ["CREATE UNIQUE INDEX idx_clients_pm_client ON clients_pm (client)"],
      })
    )

    // 5. portefeuilles · 1 par client
    app.save(
      new Collection({
        type: "base",
        name: "portefeuilles",
        fields: [
          { type: "text", name: "code", required: true, max: 80 },
          { type: "text", name: "libelle", max: 255 },
          { type: "relation", name: "client", required: true, maxSelect: 1, collectionId: id("clients"), cascadeDelete: true },
          { type: "select", name: "devise", maxSelect: 1, values: ["XAF", "EUR", "USD"] },
          { type: "select", name: "statut", maxSelect: 1, values: ["ACTIF", "SUSPENDU", "CLOTURE"] },
          { type: "date", name: "date_ouverture" },
          ...stamps,
        ],
        indexes: ["CREATE UNIQUE INDEX idx_portefeuilles_code ON portefeuilles (code)"],
      })
    )

    // 6. instruments
    app.save(
      new Collection({
        type: "base",
        name: "instruments",
        fields: [
          // Les ISIN Manar ne sont pas strictement ISO 6166 (12 car.) : certains
          // portent un suffixe (ex. GA000002055-2). Marge de longueur.
          { type: "text", name: "isin", max: 20 },
          { type: "text", name: "code_mims", max: 40 },
          { type: "text", name: "libelle_fr", max: 255 },
          { type: "select", name: "type", maxSelect: 1, values: ["ACTION", "OBLIGATION", "OPC"] },
          { type: "text", name: "categorie", max: 32 },
          { type: "select", name: "devise", maxSelect: 1, values: ["XAF", "EUR", "USD"] },
          { type: "relation", name: "emetteur", maxSelect: 1, collectionId: id("emetteurs"), cascadeDelete: false },
          { type: "number", name: "taux_interet" },
          { type: "date", name: "date_echeance" },
          { type: "text", name: "base_couru", max: 32 },
          { type: "select", name: "statut", maxSelect: 1, values: ["ACTIVE", "PRE_REFERENCE", "SUSPENDU", "RADIE"] },
          ...stamps,
        ],
        indexes: ["CREATE UNIQUE INDEX idx_instruments_isin ON instruments (isin)"],
      })
    )

    // 7. positions · avoirs agrégés par couple (client × instrument)
    app.save(
      new Collection({
        type: "base",
        name: "positions",
        fields: [
          { type: "relation", name: "client", required: true, maxSelect: 1, collectionId: id("clients"), cascadeDelete: true },
          { type: "relation", name: "instrument", required: true, maxSelect: 1, collectionId: id("instruments"), cascadeDelete: true },
          { type: "number", name: "quantite_totale" },
          { type: "number", name: "quantite_disponible" },
          { type: "number", name: "quantite_reservee" },
          { type: "number", name: "quantite_bloquee" },
          { type: "number", name: "pmp_xaf" },
          { type: "number", name: "valorisation_xaf" },
          { type: "date", name: "derniere_maj" },
          ...stamps,
        ],
        indexes: ["CREATE UNIQUE INDEX idx_positions_client_instrument ON positions (client, instrument)"],
      })
    )

    // 8. mouvements_titres · 1 ligne par opération Manar valide
    app.save(
      new Collection({
        type: "base",
        name: "mouvements_titres",
        fields: [
          { type: "relation", name: "client", required: true, maxSelect: 1, collectionId: id("clients"), cascadeDelete: true },
          { type: "relation", name: "instrument", required: true, maxSelect: 1, collectionId: id("instruments"), cascadeDelete: true },
          { type: "select", name: "sens", maxSelect: 1, values: ["ACHAT", "VENTE", "OST_ENTREE", "OST_SORTIE"] },
          { type: "number", name: "quantite" },
          { type: "number", name: "prix_unitaire_xaf" },
          { type: "date", name: "date_operation" },
          { type: "date", name: "date_valeur" },
          { type: "select", name: "statut", maxSelect: 1, values: ["VALIDE", "EN_ATTENTE", "SUSPENDU"] },
          { type: "text", name: "source", max: 32 },
          ...stamps,
        ],
        indexes: [],
      })
    )
  },
  (app) => {
    for (const name of [
      "mouvements_titres",
      "positions",
      "instruments",
      "portefeuilles",
      "clients_pm",
      "clients_pp",
      "emetteurs",
      "clients",
    ]) {
      try {
        app.delete(app.findCollectionByNameOrId(name))
      } catch (_) {}
    }
  }
)
