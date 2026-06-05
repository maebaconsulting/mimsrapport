# 02 · Modèle de données (collections PocketBase)

Le schéma reprend les **noms de colonnes réels de MIMS** pour garantir la fidélité
des rapports. Tout est défini par **migrations PocketBase versionnées** (fichiers JS
sous `pocketbase/pb_migrations/`), jouées au premier lancement.

PocketBase ajoute automatiquement `id` (15 car.), `created`, `updated` à chaque
collection. Les relations se font par champ de type `relation`.

## Collections métier (6 entités Manar)

### `clients`
Racine commune PP / PM.

| Champ | Type | Notes |
|-------|------|-------|
| code | text | unique, ex. `CT-MNR-A1B2C3` (code synthétique, voir `03-IMPORT-MANAR.md`) |
| type | select | `PP` \| `PM` |
| nom | text | nom (PP) ou raison sociale de repli |
| prenom | text | PP uniquement |
| provenance | text | `MANAR_MIGRATION` |

### `clients_pp` (extension 1-1)
| Champ | Type | Notes |
|-------|------|-------|
| client | relation → clients | unique |
| date_naissance | date | optionnel (absent de Manar, souvent vide) |
| nationalite | text | optionnel |

### `clients_pm` (extension 1-1)
| Champ | Type | Notes |
|-------|------|-------|
| client | relation → clients | unique |
| raison_sociale | text | |
| rccm | text | synthétique si dérivé, ex. `CM-MIGR-9999-X-<n>` |
| forme_juridique | text | dérivée par heuristique |

### `portefeuilles`
| Champ | Type | Notes |
|-------|------|-------|
| code | text | unique, convention `PORT-<code_client>` |
| libelle | text | `Portefeuille migré Manar · <code_client>` |
| client | relation → clients | |
| devise | select | `XAF` (par défaut) \| `EUR` \| `USD` |
| statut | select | `ACTIF` \| `SUSPENDU` \| `CLOTURE` |
| date_ouverture | date | optionnel |

### `emetteurs`
| Champ | Type | Notes |
|-------|------|-------|
| code | text | unique, ex. `E-GABON` (voir `EMETTEUR_MAP`) |
| nom | text | |
| type | select | `CORPORATE` \| `SOUVERAIN` |
| pays | text | ISO2 (`GA`, `CM`, `CG`, `TD`, `GQ`, `CF`) |
| secteur | text | optionnel |

### `instruments`
| Champ | Type | Notes |
|-------|------|-------|
| isin | text | ISO 6166 ; **colonne réelle `isin`, pas `code_isin`** |
| code_mims | text | `MNR-<isin>` |
| libelle_fr | text | **colonne réelle `libelle_fr`, pas `libelle_court`** |
| type | select | `ACTION` \| `OBLIGATION` \| `OPC` (dérivé de `POSTE`) |
| categorie | text | `ACTIONS` \| `OBLIGATIONS_PRIV` \| `MONETAIRE` \| `OPC` |
| devise | select | `XAF` par défaut |
| emetteur | relation → emetteurs | |
| taux_interet | number | obligations, ex. 5.5000 |
| date_echeance | date | obligations |
| base_couru | text | base de calcul des intérêts courus |
| statut | select | `ACTIVE` \| `PRE_REFERENCE` \| `SUSPENDU` \| `RADIE` |

> Piège hérité de MIMS : les colonnes réelles sont `isin` et `libelle_fr`. Ne jamais
> utiliser `code_isin` / `libelle_court` (bug latent corrigé dans MIMS).

### `positions`
Avoirs agrégés par couple (client × instrument).

| Champ | Type | Notes |
|-------|------|-------|
| client | relation → clients | |
| instrument | relation → instruments | |
| quantite_totale | number | |
| quantite_disponible | number | |
| quantite_reservee | number | défaut 0 |
| quantite_bloquee | number | défaut 0 |
| pmp_xaf | number | prix moyen pondéré (calcul agrégé, voir import) |
| valorisation_xaf | number | |
| derniere_maj | date | |

Index unique logique : (client, instrument).

### `mouvements_titres`
Une ligne par opération Manar valide.

| Champ | Type | Notes |
|-------|------|-------|
| client | relation → clients | |
| instrument | relation → instruments | |
| sens | select | `ACHAT` \| `VENTE` \| `OST_ENTREE` \| `OST_SORTIE` |
| quantite | number | |
| prix_unitaire_xaf | number | |
| date_operation | date | |
| date_valeur | date | |
| statut | select | `VALIDE` \| `EN_ATTENTE` \| `SUSPENDU` |
| source | text | `MANAR_IMPORT` |

## Collections techniques

### `manar_operations`
Ligne brute du fichier, conservée intégralement. Schéma porté de MIMS
`supabase/migrations/20260514000003_phase3_manar_operations.sql`.

Champs clés : `manar_op_id` (clé métier), `statut` (`F`\|`V`\|`P`\|`S`), `isin`,
`libelle_instrument`, `poste_code`, `emetteur_code`, `nature_operation`,
`valeur_nominale_xaf`, `prix_xaf`, `montant_brut_xaf`, `taux_interet`, `courus_xaf`,
`donneur_ordre`, `operateur_saisie`, `operateur_validation`, `date_saisie`,
`date_operation`, `date_valeur`, `date_validation`, et `extra_columns` (JSON) pour
les ~30 colonnes secondaires. Index unique logique : (import, manar_op_id).

### `manar_imports`
Journal des imports. Champs : `file_name`, `file_hash` (SHA-256 hex 64 car.),
`file_size_bytes`, `statut` (`EN_COURS`\|`REUSSI`\|`ECHOUE`\|`ANNULE`),
`nb_operations`, `montant_total_xaf`, `started_at`, `completed_at`, `duration_ms`,
`error_message`. **Idempotence** : un même `file_hash` ne peut pas être réimporté en
statut `REUSSI` (contrainte applicative à la création).

### `exports_log`
Traçabilité des PDF produits (équivalent du `auditLogger` MIMS). Champs :
`type_rapport`, `cible` (client/période concernés), `hash_pdf` (SHA-256), `user`
(relation → users), `created`. Une entrée par export, écrite **avant** de remettre le
fichier à l'utilisateur.

### `parametres_sdb`
Configuration de la société de bourse (identité, agrément COSUMAF, RCCM, NIU, capital,
adresse, contacts, logo, 3 modèles de mentions, période d'effet). Alimente les en-têtes
et pieds de page des rapports. Détail complet dans `10-CONFIG-SDB.md`. Migration
`pocketbase/pb_migrations/1700000050_parametres_sdb.js`.

### `users` (auth natif PocketBase)
Collection d'authentification fournie par PocketBase. Présente dès la v1. En
mono-poste : un utilisateur local créé au premier lancement (auto-login). En
multi-poste : gestion réelle des comptes et des rôles.

## Migrations

- Format PocketBase « collections-as-code » sous `pocketbase/pb_migrations/`
  (fichiers horodatés `1700000000_init_collections.js`, etc.).
- Une migration = une évolution de schéma, idempotente, versionnée dans git.
- Au premier lancement, PocketBase applique les migrations manquantes.
- Ne jamais modifier le schéma uniquement via l'admin UI : toujours par migration,
  pour reproductibilité (contrainte liée au statut pré-1.0 de PocketBase).
