/// <reference path="../pb_data/types.d.ts" />

// Ajoute à `positions` la valeur nominale (Manar col. 26 · MONTANTDEV) et le
// coupon couru (Manar col. 33 · INTERET COURU), afin d'alimenter les colonnes
// « Nominal » et « CC » du relevé de compte-titres avec des données réelles.
// La date « Dernière M. » du relevé réutilise le champ existant `derniere_maj`,
// désormais renseigné avec la date du dernier mouvement de la position.

migrate(
  (app) => {
    const positions = app.findCollectionByNameOrId("positions");
    positions.fields.add(new NumberField({ name: "valeur_nominale_xaf" }));
    positions.fields.add(new NumberField({ name: "courus_xaf" }));
    app.save(positions);
  },
  (app) => {
    const positions = app.findCollectionByNameOrId("positions");
    positions.fields.removeByName("valeur_nominale_xaf");
    positions.fields.removeByName("courus_xaf");
    app.save(positions);
  },
);
