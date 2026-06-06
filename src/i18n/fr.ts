/**
 * Dictionnaire français : source de vérité de l'i18n.
 *
 * Les clés sont à plat, préfixées par domaine (`nav.*`, `header.*`, `home.*`,
 * `import.*`, `clients.*`, `reports.*`, `dashboards.*`, `settings.*`,
 * `states.*`, `contact.*`, `mapping.*`). Le type `Dict` est dérivé de cet
 * objet : les dictionnaires `en`/`es` doivent en couvrir toutes les clés
 * (complétude garantie à la compilation).
 *
 * Note : pas d'`as const` ici, pour que les valeurs soient typées `string`
 * (et non leur littéral), afin que `en`/`es` puissent fournir d'autres textes.
 */
export const fr = {
  // Navigation (menu latéral + fil d'Ariane)
  "nav.accueil": "Accueil",
  "nav.import": "Import",
  "nav.clients": "Clients",
  "nav.rapports": "Rapports",
  "nav.tableaux": "Tableaux de bord",
  "nav.parametres": "Paramètres",
  "nav.section": "Navigation",
  "nav.collapse": "Réduire le menu",
  "nav.expand": "Déplier le menu",
  "nav.version": "Version {version}",

  // Barre d'en-tête
  "header.notifications": "Notifications",
  "header.notificationsEmpty": "Aucune notification",
  "header.language": "Choisir la langue",
  "header.account": "Compte",
  "header.accountRole": "Administrateur",
  "header.signIn": "Se connecter",
  "header.signOut": "Se déconnecter",
};

/** Type structurel du dictionnaire (toutes les clés, valeurs `string`). */
export type Dict = typeof fr;

/** Union des clés de traduction disponibles. */
export type TKey = keyof Dict;
