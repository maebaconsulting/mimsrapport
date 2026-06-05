/// <reference path="../pb_data/types.d.ts" />

// Désactive le logging des requêtes de PocketBase (logs.maxDays = 0).
//
// Motif : PocketBase écrit un log par requête dans auxiliary.db. Sous une rafale
// d'écritures/lectures concurrentes (mono-poste local), cette contention provoque
// par intermittence l'échec de l'évaluation des règles d'accès référençant
// `@request.auth.id` (« create rule failure: sql: no rows in result set » → 400).
// L'application tient déjà sa propre traçabilité (manar_imports, exports_log) ;
// le journal de requêtes interne n'est pas nécessaire.

migrate(
  (app) => {
    const settings = app.settings();
    settings.logs.maxDays = 0;
    app.save(settings);
  },
  (app) => {
    const settings = app.settings();
    settings.logs.maxDays = 5;
    app.save(settings);
  },
);
