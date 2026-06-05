/// <reference path="../pb_data/types.d.ts" />

// Collection `parametres_sdb` · configuration de la société de bourse qui exploite
// l'application. Ces champs alimentent les en-têtes et pieds de page de tous les
// rapports (identité, agrément COSUMAF, RCCM, NIU, capital, adresse, contacts,
// logo, mentions légales). Voir specs/10-CONFIG-SDB.md.
//
// Versionnement par date d'effet : un rapport réimprimé doit refléter la
// configuration en vigueur à sa date d'arrêté. En mono-poste, il y a typiquement un
// seul enregistrement courant (date_effet_fin vide).
//
// Accès local ouvert (mono-poste, 127.0.0.1), cohérent avec les autres collections
// (cf 1700000030_regles_et_seed.js). Le durcissement par rôle viendra avec le
// multi-poste.

const DEFAULT_MENTIONS_RELEVE =
  "{raison_sociale} · {forme_juridique} au capital de {capital_social} {devise_capital}\n" +
  "RCCM {rccm} · NIU {niu} · Agrément COSUMAF {agrement_cosumaf}\n" +
  "{bp}, {ville}, {pays} · Tél {telephone_principal} · {email_contact}";

const DEFAULT_MENTIONS_DECLARATION =
  "{raison_sociale} · {forme_juridique} · Agrément COSUMAF {agrement_cosumaf}\n" +
  "RCCM {rccm} · NIU {niu} · capital {capital_social} {devise_capital}\n" +
  "Document de reporting réglementaire · marché financier CEMAC / BVMAC";

const DEFAULT_MENTIONS_FACTURE =
  "{raison_sociale} · {forme_juridique} au capital de {capital_social} {devise_capital}\n" +
  "RCCM {rccm} · NIU {niu} · {bp}, {ville}, {pays}";

migrate(
  (app) => {
    const stamps = [
      { type: "autodate", name: "created", onCreate: true, onUpdate: false },
      { type: "autodate", name: "updated", onCreate: true, onUpdate: true },
    ];

    const collection = new Collection({
      type: "base",
      name: "parametres_sdb",
      fields: [
        // Identité
        { type: "text", name: "raison_sociale", required: true, max: 255 },
        { type: "text", name: "code", required: true, max: 64 },
        { type: "text", name: "forme_juridique", max: 128 },
        { type: "number", name: "capital_social" },
        { type: "text", name: "devise_capital", max: 8 },
        // Identifiants légaux
        { type: "text", name: "niu", max: 64 },
        { type: "text", name: "rccm", max: 64 },
        { type: "text", name: "agrement_cosumaf", max: 64 },
        { type: "text", name: "date_agrement", max: 32 },
        { type: "text", name: "code_member_bvmac", max: 64 },
        { type: "text", name: "code_dcr", max: 64 },
        // Adresse
        { type: "text", name: "bp", max: 64 },
        { type: "text", name: "adresse_rue", max: 255 },
        { type: "text", name: "ville", max: 128 },
        { type: "text", name: "pays", max: 64 },
        // Contacts
        { type: "text", name: "telephone_principal", max: 32 },
        { type: "text", name: "telephone_secondaire", max: 32 },
        { type: "text", name: "email_contact", max: 255 },
        { type: "text", name: "site_web", max: 255 },
        // Logo (image, optionnel)
        {
          type: "file",
          name: "logo",
          maxSelect: 1,
          maxSize: 5242880,
          mimeTypes: ["image/png", "image/jpeg", "image/webp"],
        },
        // Mentions légales (3 modèles séparés · relevé, déclaration, facture)
        { type: "text", name: "mentions_releve", max: 2000 },
        { type: "text", name: "mentions_declaration", max: 2000 },
        { type: "text", name: "mentions_facture", max: 2000 },
        // Versionnement par date d'effet (ISO YYYY-MM-DD)
        { type: "text", name: "date_effet_debut", max: 32 },
        { type: "text", name: "date_effet_fin", max: 32 },
        ...stamps,
      ],
      indexes: [],
    });

    app.save(collection);

    // Accès local ouvert (mono-poste), cohérent avec 1700000030_regles_et_seed.js.
    const saved = app.findCollectionByNameOrId("parametres_sdb");
    saved.listRule = "";
    saved.viewRule = "";
    saved.createRule = "";
    saved.updateRule = "";
    saved.deleteRule = "";
    app.save(saved);

    // Amorçage d'un enregistrement par défaut (idempotent) pour que les rapports
    // disposent d'une identité dès l'installation. Valeurs reprises de l'ancienne
    // constante SDB_IDENTITY, complétées de défauts plausibles à personnaliser via
    // l'écran Paramètres.
    let exists = true;
    try {
      app.findFirstRecordByFilter("parametres_sdb", "id != ''");
    } catch (_) {
      exists = false;
    }
    if (!exists) {
      const rec = new Record(collection);
      rec.set("raison_sociale", "CCA Bourse");
      rec.set("code", "CCAB");
      rec.set("forme_juridique", "Société anonyme");
      rec.set("capital_social", 1000000000);
      rec.set("devise_capital", "XAF");
      rec.set("niu", "");
      rec.set("rccm", "");
      rec.set("agrement_cosumaf", "");
      rec.set("date_agrement", "");
      rec.set("code_member_bvmac", "");
      rec.set("code_dcr", "");
      rec.set("bp", "");
      rec.set("adresse_rue", "");
      rec.set("ville", "Douala");
      rec.set("pays", "Cameroun");
      rec.set("telephone_principal", "");
      rec.set("telephone_secondaire", "");
      rec.set("email_contact", "");
      rec.set("site_web", "");
      rec.set("mentions_releve", DEFAULT_MENTIONS_RELEVE);
      rec.set("mentions_declaration", DEFAULT_MENTIONS_DECLARATION);
      rec.set("mentions_facture", DEFAULT_MENTIONS_FACTURE);
      rec.set("date_effet_debut", "2026-01-01");
      rec.set("date_effet_fin", "");
      app.save(rec);
    }
  },
  (app) => {
    try {
      app.delete(app.findCollectionByNameOrId("parametres_sdb"));
    } catch (_) {}
  },
);
