# 10 · Configuration de la société de bourse (en-têtes et pieds de page)

Les rapports portent l'identité réglementaire de la société de bourse (SDB) qui les
émet. Cette identité est **paramétrable et persistée**, plus codée en dur. Elle
alimente les en-têtes et pieds de page de tous les rapports.

Implémenté · collection PocketBase `parametres_sdb`, helper `src/lib/parametres-sdb.ts`,
écran `src/settings/SettingsView.tsx`, câblage des services attestation et relevé.

## Champs de configuration

| Groupe | Champ | Obligatoire | Placement |
|--------|-------|:-----------:|-----------|
| Identité | raison_sociale | oui | en-tête (nom) + pied (mentions) |
| | code | oui | en-tête |
| | forme_juridique | — | pied (mentions) |
| | capital_social + devise_capital | — | pied (mentions) |
| Identifiants légaux | agrement_cosumaf | oui (métier) | **en-tête** + pied |
| | date_agrement | — | usage interne |
| | rccm | oui (métier) | pied |
| | niu | oui (métier) | pied |
| | code_member_bvmac | — | pied (optionnel) |
| | code_dcr | — | pied (optionnel) |
| Adresse | bp, adresse_rue, ville, pays | ville utile | en-tête (ville) + pied |
| Contacts | telephone_principal, telephone_secondaire, email_contact, site_web | — | pied |
| Logo | logo (fichier image) | — | en-tête (haut gauche) |
| Mentions | mentions_releve, mentions_declaration, mentions_facture | — | pied (3 modèles) |
| Période d'effet | date_effet_debut, date_effet_fin | — | sélection par date d'arrêté |

## Trois principes

1. **Configuration ≠ métadonnées document ≠ traçabilité.** La config (identité) est
   statique ; le titre/période/référence réglementaire sont propres à chaque rapport ;
   le hash, l'horodatage et la pagination sont **calculés** au rendu, jamais saisis.
2. **Mentions par famille.** Trois modèles séparés selon le document : `releve`
   (relevés, attestations), `declaration` (rapports réglementaires COSUMAF),
   `facture`. Le modèle contient des **jetons** `{champ}` remplacés au rendu.
3. **Versionnement par date d'effet.** Un rapport réimprimé reflète la config en
   vigueur à sa **date d'arrêté** (`pickConfigForDate`), pas la config courante. En
   mono-poste il y a typiquement un seul enregistrement courant (date_effet_fin vide).

## Interpolation des mentions

`buildMentionsLines(config, family)` interpole le modèle et renvoie les lignes non
vides. Jetons disponibles : `{raison_sociale}`, `{forme_juridique}`,
`{capital_social}` (formaté avec espace insécable), `{devise_capital}`, `{rccm}`,
`{niu}`, `{agrement_cosumaf}`, `{date_agrement}`, `{code_member_bvmac}`, `{code_dcr}`,
`{bp}`, `{adresse_rue}`, `{ville}`, `{pays}`, `{telephone_principal}`,
`{telephone_secondaire}`, `{email_contact}`, `{site_web}`.

**Règle de propreté** : chaque ligne est découpée en segments séparés par « · » ;
un segment dont **tous** les jetons sont vides est supprimé (évite « RCCM · NIU » sans
valeurs). Les segments de texte statique sont conservés.

Modèles par défaut (amorcés en migration) :

```
relevé :
  {raison_sociale} · {forme_juridique} au capital de {capital_social} {devise_capital}
  RCCM {rccm} · NIU {niu} · Agrément COSUMAF {agrement_cosumaf}
  {bp}, {ville}, {pays} · Tél {telephone_principal} · {email_contact}

déclaration :
  {raison_sociale} · {forme_juridique} · Agrément COSUMAF {agrement_cosumaf}
  RCCM {rccm} · NIU {niu} · capital {capital_social} {devise_capital}
  Document de reporting réglementaire · marché financier CEMAC / BVMAC
```

## Répartition en-tête / pied (rendu)

- **En-tête** : logo (si présent), raison sociale, code, **agrément COSUMAF** (ligne
  dédiée si renseigné), ville et date à droite. Pour les états COSUMAF, le shell
  `CosumafPdfShell` accepte `sdb_agrement` (optionnel).
- **Pied (fixe, chaque page)** : bloc mentions interpolées (forme juridique, capital,
  RCCM, NIU, agrément, siège) puis ligne de traçabilité (hash, horodatage, autorité,
  pagination).

## Surface technique

- **Collection** · `pocketbase/pb_migrations/1700000050_parametres_sdb.js` (champs +
  accès local ouvert + amorçage d'un enregistrement par défaut + 3 modèles de mentions).
- **Helper** · `src/lib/parametres-sdb.ts` :
  - `buildSdbReportContext(pb, dateISO, family)` → `{ sdb, ville, logoUrl, mentionsLines }`
    (à appeler dans chaque service de rapport).
  - fonctions pures testées : `interpolateMentions`, `pickConfigForDate`,
    `mergeConfig`, `toHeaderInfo`, `formatCapital` (`parametres-sdb.test.ts`).
- **Écran** · `src/settings/SettingsView.tsx` (onglet « Paramètres »), formulaire
  groupé + upload logo, persiste dans `parametres_sdb`.
- **Câblage** · services `attestation` et `relevé` appellent `buildSdbReportContext`
  et passent `sdb` (avec agrément/RCCM/NIU), `ville`, `mentionsLines`, `logoUrl`.

## Reste à faire (suivi)

- Fait · confirmation d'ouverture, COSUMAF transactions (obl. 12) et situation des
  avoirs (obl. 15), état des clients en déshérence et lettre de relance sont câblés
  sur `buildSdbReportContext` et surfacés dans l'UI. Le contexte expose désormais
  `contact` (email ou téléphone de conformité) pour l'en-tête de l'état déshérence.
- Restent portés mais non surfacés : bordereau de transfert CDEC/BEAC, compte rendu
  des transactions, rapport de réconciliation d'import.
- Optionnel : éditeur de prévisualisation des mentions interpolées dans l'écran
  Paramètres.
