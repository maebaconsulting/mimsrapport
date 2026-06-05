# 03 · Import Manar (parsing + mapping)

Port de la logique MIMS `lib/services/manar/{manar-parser,manar-mapping,manar-migration}.ts`.
Ces fichiers sont la **source de vérité** ; ce document en reproduit l'essentiel mais
toute ambiguïté se tranche en relisant l'original.

## Pipeline

```
.xls choisi (dialogue Tauri)
  → 1. parse SheetJS → ManarRawRow[] (54 colonnes normalisées)
  → 2. map codes (POSTE/EMETTEUR, PP/PM) → ManarMappedRow[]
  → 3. file_hash SHA-256 + écriture manar_imports (EN_COURS)
  → 4. écriture manar_operations (par lots)
  → 5. dérivation des 6 entités → écriture clients/portefeuilles/instruments/
        emetteurs/positions/mouvements_titres
  → 6. manar_imports = REUSSI (compteurs, durée)
```

En mono-poste, pas de workflow 4-yeux : l'import matérialise directement les entités
(équivalent du `dev-commit-manar` de MIMS, pas du parcours UI Direction → Conformité).

## 1. Lecture du fichier (SheetJS)

Librairie : `xlsx` (SheetJS). Le fichier réel est un BIFF8 (Excel 97-2003) ; la
version anonymisée est un XLSX. Détecter par magic bytes :

- BIFF8 (`.xls`) : `D0 CF 11 E0`
- XLSX (ZIP) : `50 4B 03 04`

Configuration de lecture :

```js
XLSX.read(buffer, { type: 'buffer', cellDates: false, codepage: 1252 })
// puis sheet_to_json avec { header: 1, raw: false }  → tout en chaînes
```

Structure : ligne 0 = titre du rapport, ligne 1 = noms de colonnes, lignes 2+ =
opérations (≈166 lignes × 54 colonnes dans l'échantillon).

## 2. Mapping des 54 colonnes

Index → champ cible. Les colonnes notées « toujours NULL » sont présentes mais vides
dans le format Manar ; les colonnes secondaires vont dans `extra_columns` (JSON).

| Col | En-tête Manar | Champ cible |
|-----|---------------|-------------|
| 0 | N° OPERATION | manar_op_id (requis) |
| 1 | N° EVENEMENT | extra.no_evenement |
| 2 | N° ORDRE | no_ordre (toujours NULL) |
| 3 | TITRE | extra.titre_code |
| 4 | DESC TITRE | libelle_instrument |
| 5 | POSTE | poste_code |
| 6 | ENTITÉ | extra.entite_code |
| 7 | PORTEFEUILLE | extra.portefeuille_code |
| 8 | DESC PORTEFEUILLE | donneur_ordre (identifiant client) |
| 9 | STATUT | statut (F\|V\|P\|S) |
| 10 | DATE SAISI | date_saisie |
| 11 | DATE OPERATION | date_operation |
| 12 | DATE VALEUR | date_valeur |
| 13 | DATE LIVRAISON | extra.date_livraison |
| 14 | DATE VALIDATION | date_validation |
| 15 | DATE ANNULATION | (toujours NULL) |
| 16 | INTERMEDIAIRE | extra.intermediaire |
| 17 | DEPOSITAIRE | extra.depositaire |
| 18 | COMPTE TITRES | extra.compte_titres |
| 19 | COMPTE ESPECES | (toujours NULL) |
| 20 | CONTREPARTIE | extra.contrepartie |
| 21 | DESC CONTREPARTIE | extra.desc_contrepartie |
| 22 | DEPOSITAIRE CTR | extra.depositaire_ctr_partie |
| 23 | COMPTE TITRES CTR | (toujours NULL) |
| 24 | QUANTITÉ | extra.quantite |
| 25 | COURS | prix_xaf |
| 26 | MONTANTDEV | valeur_nominale_xaf |
| 27 | DEVISE_REF | extra.devise_ref |
| 28 | TAUX_REF | extra.taux_ref |
| 29 | DEVISE_REG | extra.devise_reg |
| 30 | FRAIS TOT | extra.frais_tot |
| 31 | MONTANT BRUT | montant_brut_xaf |
| 32 | MONTANT NET | extra.montant_net |
| 33 | INTERET COURU | courus_xaf |
| 34 | PMV BACK | extra.pmv_back |
| 35 | CONTRAT | (toujours NULL) |
| 36 | TITRE JOUISSANCE | extra.titre_jouissance |
| 37 | TITRE ECHEANCE | extra.titre_echeance |
| 38 | NEGO PRIX | extra.nego_prix |
| 39 | NEGO PPC | extra.nego_ppc |
| 40 | NEGO SPREAD | extra.nego_spread |
| 41 | TAUX NEGOCIATION | taux_interet |
| 42 | TAUX PLACEMENT | extra.taux_placement |
| 43 | NBRE JOURS PLCMT | extra.nbre_jours_placement |
| 44 | INTERETS | extra.interets |
| 45 | DECALAGE VALEUR | extra.decalage_valeur |
| 46 | OPE FRONT | operateur_saisie |
| 47 | OPE BACK | operateur_validation |
| 48 | OPE ANNULATION | (toujours NULL) |
| 49 | DATE ÉCHÉANCE | date_echeance (toujours NULL côté op) |
| 50 | CODE ISIN | isin |
| 51 | EMETTEUR | emetteur_code |
| 52 | CLASSE | extra.classe |
| 53 | CATÉGORIE | extra.categorie |

## Normalisation des valeurs

```js
// nulls sémantiques (insensible à la casse) : NEANT, NULL, N/A, NA, -, ''
function normalizeManarValue(raw) {
  if (!raw) return null
  const t = raw.trim()
  if (t === '' || ['NEANT','NULL','N/A','NA','-'].includes(t.toUpperCase())) return null
  return t
}

// dates dd/mm/yyyy → yyyy-mm-dd (regex stricte + bornes j 1-31, m 1-12, a 1900-2100)
function parseManarDate(raw) {
  if (!raw || !/^\d{2}\/\d{2}\/\d{4}$/.test(raw.trim())) return null
  const [dd, mm, yyyy] = raw.trim().split('/')
  /* valider les bornes puis */ return `${yyyy}-${mm}-${dd}`
}

// montants format FR : espace insécable (U+00A0) en milliers, virgule décimale
function parseManarAmount(raw) {
  if (!raw) return null
  const n = parseFloat(raw.replace(/[\s ]/g, '').replace(',', '.'))
  return isNaN(n) ? null : n
}
```

## 3. Dictionnaires de mapping

### POSTE → type d'instrument (`POSTE_MAP`, 8 codes)

| Code | Libellé | Sens |
|------|---------|------|
| AOBLNC | Actif · Obligation non cotée | ACTIF |
| AOBLB | Actif · Obligation en bourse | ACTIF |
| AACTB | Actif · Action en bourse | ACTIF |
| AACTNC | Actif · Action non cotée | ACTIF |
| SOBLP | Passif · Obligation propre | PASSIF |
| SXOBL | Passif · Obligation extérieure | PASSIF |
| EXACT | Externe · Action cotée tiers | ACTIF |
| EXOBL | Externe · Obligation tiers | ACTIF |

Le type d'instrument (`ACTION`\|`OBLIGATION`\|`OPC`) se déduit du préfixe POSTE
(ACT → action, OBL → obligation).

### EMETTEUR → identité (`EMETTEUR_MAP`, 10 codes)

`E-GABON` (État du Gabon, GA), `E-CCA` (CCA Bank, CM), `E-TCHAD` (État du Tchad, TD),
`E-CONGO` (État du Congo, CG), `E-BIACMR` (BIA Cameroun, CM), `E-BDEAC` (BDEAC, GA),
`E-CAMEROUN` (État du Cameroun, CM), `E-SCG-RE` (SCG Réassurance, CG),
`E-LAREGIONALE` (La Régionale, CM), `CCAB` (CCA Bourse, CM). Le `type`
(`SOUVERAIN`\|`CORPORATE`) se déduit (États → souverain, sociétés → corporate).

## 4. Dérivation des 6 entités

1. **emetteurs** : depuis `emetteur_code` via `EMETTEUR_MAP` ; déduire type, pays,
   RCCM synthétique si corporate. Provenance `MANAR_MIGRATION`.
2. **instruments** : depuis `isin` + `libelle_instrument` + `poste_code` ; type déduit
   du POSTE ; `code_mims = MNR-<isin>`.
3. **clients_pp / clients_pm** : depuis `donneur_ordre`. Heuristique PM si le libellé
   contient `SARL|SAS|EURL|SCS|SNC|SCI|GIE|BANK|BANQUE|SOCIETE|SOCIÉTÉ|GROUP|GROUPE|HOLDING`…
   sinon PP (split nom/prénom). Code synthétique :
   `CT-MNR-<fnv1a(donneur_ordre) hex 6 car.>`. RCCM PM synthétique compatible regex.
4. **portefeuilles** : 1 par client, `code = PORT-<code_client>`.
5. **positions** : agrégées par (client, isin). N'inclure que les statuts **VALIDE**
   (F + V) ; exclure `EN_ATTENTE` (P) et `SUSPENDU` (S) du stock. PMP = moyenne
   pondérée des coûts d'acquisition.
6. **mouvements_titres** : 1 par opération ; `sens` déduit de la nature ; `source =
   MANAR_IMPORT`.

### Mapping des statuts (D-MNR-03)

`F → VALIDE`, `V → VALIDE`, `P → EN_ATTENTE`, `S → SUSPENDU`.

### Calcul PMP (cas d'agrégation)

```
pmp = (pmp_existant * qte_existante + pmp_nouveau * qte_nouvelle)
      / (qte_existante + qte_nouvelle)        // si dénominateur > 0
```

### Hash synthétique (FNV-1a) pour les codes clients

```js
function hashFnv1a(s) {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = (h * 16777619) >>> 0 }
  return h >>> 0
}
// CT-MNR-<hex 6 car. en majuscules>
```

## 5. Idempotence

- **Fichier** : `file_hash` SHA-256 (recalculé côté app, jamais fourni par le client).
  Refus de réimport d'un hash déjà en statut `REUSSI`.
- **Opération** : unicité logique (import, manar_op_id).
- L'app doit proposer une action claire si le fichier est déjà importé (annuler ou
  remplacer l'import précédent).

## Échantillon de test

`samples/manar/ETAT DES INSRUMENTS SAISIS SUR MANAR-ANONYME.xlsx` (copié de MIMS,
voir `PORT-SOURCES.md`). 166 opérations, PII anonymisée (colonnes 8, 46, 47). Sert de
golden-file pour les tests (voir `08-TESTING.md`).
