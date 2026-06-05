# 04 · Production des rapports (PDF)

Fidélité **stricte** avec MIMS : on porte les gabarits react-pdf. La seule différence
structurante est l'**environnement de rendu**.

## Directive critique · rendu côté webview, pas côté serveur

MIMS rend les PDF côté serveur : `lib/integrations/pdf/render.ts` est marqué
`server-only`, utilise `renderToBuffer` (Node) et enregistre les polices par **chemin
disque** (`process.cwd()/lib/integrations/pdf/fonts/...ttf`).

**Une webview Tauri n'a pas de Node.** Il faut donc le **build navigateur** de
`@react-pdf/renderer` :

```tsx
import { pdf, Font } from '@react-pdf/renderer'

// Enregistrement des polices par URL d'asset (servies par le bundle frontend),
// PAS par chemin disque.
Font.register({
  family: 'Inter',
  fonts: [
    { src: '/fonts/Inter-Regular.ttf', fontWeight: 400 },
    { src: '/fonts/Inter-SemiBold.ttf', fontWeight: 600 },
  ],
})
Font.register({
  family: 'JetBrainsMono',
  fonts: [
    { src: '/fonts/JetBrainsMono-Regular.ttf', fontWeight: 400 },
    { src: '/fonts/JetBrainsMono-SemiBold.ttf', fontWeight: 600 },
  ],
})

// Rendu en Blob (côté client)
const blob = await pdf(<MonGabaritPdf {...props} />).toBlob()
```

Les gabarits TSX (le JSX `<Document><Page>…`) se portent **quasiment tels quels** ;
seuls l'enregistrement des polices et l'appel de rendu changent.

> Contrainte héritée à respecter absolument : **pas de `fontStyle: 'italic'`** sur
> Inter (la police n'a pas de variante italique → erreur de rendu). L'emphase se fait
> par le poids `fontWeight: 600`.

> Validation à prévoir : confirmer que `@react-pdf/renderer` (build navigateur) rend
> correctement dans WebView2 (Windows, Chromium) et WKWebView (Mac). C'est viable mais
> à tester tôt (voir `09-ROADMAP-MVP.md`, jalon « 1 rapport bout-en-bout »).

## Patron de génération (porté de MIMS)

Référence : `app/_actions/attestation-pdf.ts` (`generateAttestationPortefeuille`).

1. **Requête des données** depuis PocketBase (positions, client, portefeuille…).
2. **Composition du nom** du client selon le type :
   - PP : `${prenom} ${nom}` (trim).
   - PM : `clients_pm.raison_sociale ?? clients.nom`.
   - Toujours composer côté app à partir de `clients_pp`/`clients_pm` (les clients
     n'ont pas de colonne `nom_complet`).
3. **Double passe de hash** (stabilité du hash imprimé dans le pied de page) :
   ```
   blob1 = render(props avec hash = '')
   hash  = SHA-256(blob1)          // via WebCrypto : crypto.subtle.digest
   blob  = render(props avec hash) // hash embarqué dans le pied de page
   ```
4. **Journalisation** dans `exports_log` (type, cible, hash) **avant** de remettre le
   fichier.
5. **Enregistrement** : passer le `blob` (converti en bytes) à Tauri (`tauri-plugin-fs`
   + dialogue d'enregistrement). Nom de fichier : `<type>-<identifiant>-<date>.pdf`.

## Gabarits à porter

Chemins relatifs à la racine MIMS. Copier le TSX, adapter polices + rendu.

### Réglementaires
| Rapport | Gabarit MIMS |
|---------|--------------|
| Transactions boursières (oblig. 12) | `lib/integrations/pdf/templates/cosumaf/TransactionsBoursieresPdf.tsx` |
| Situation des avoirs (oblig. 15) | `lib/integrations/pdf/templates/cosumaf/SituationAvoirsPdf.tsx` |
| État clients en déshérence | `lib/integrations/pdf/templates/EtatClientsDesherencePdf.tsx` |
| Lettre de relance déshérence | `lib/integrations/pdf/templates/LettreRelanceDesherencePdf.tsx` |
| Bordereau de transfert CDEC/BEAC | `lib/integrations/pdf/templates/BordereauTransfertCdecPdf.tsx` |
| Compte rendu des transactions | `lib/integrations/pdf/templates/CompteRenduTransactionsPdf.tsx` |

Les deux gabarits COSUMAF dépendent du dossier partagé
`lib/integrations/pdf/templates/cosumaf/_shared/` :
- `CosumafPdfShell.tsx` · en-tête (logo, SDB, titre, période, référence réglementaire),
  pied de page (hash tronqué, horodatage, autorité, pagination), filigrane rectificatif.
- `RectificatifWatermark.tsx` · filigrane « RECTIFICATIF Vn » si version ≥ 2.
- `cosumaf-tokens.ts` · couleurs + helpers `fmtDate`, `fmtNombre`, `fmtXAF`, `fmtHashCourt`.

### Non réglementaires
| Rapport | Gabarit MIMS |
|---------|--------------|
| Relevé de compte-titres | `lib/integrations/pdf/templates/ReleveCompteTitresPdf.tsx` |
| Attestation de portefeuille | `lib/integrations/pdf/templates/AttestationPortefeuillePdf.tsx` |
| Confirmation d'ouverture | `lib/integrations/pdf/templates/ConfirmationOuverturePdf.tsx` |
| Rapport de réconciliation d'import | `lib/integrations/pdf/templates/ManarReconciliationReport.tsx` |

### À créer (pas de gabarit MIMS existant)
État du portefeuille valorisé, inventaire par instrument, inventaire par émetteur,
échéancier obligataire, état des intérêts courus, répartition par classe d'actifs.
Pour ceux-ci, deux options : un gabarit react-pdf neuf (style `cosumaf-tokens`) ou une
vue tableau exportable. Décider au cas par cas ; plusieurs sont mieux servis en
tableau de bord (voir `05-DASHBOARDS.md`).

## Polices

Copier les 4 fichiers `.ttf` de MIMS dans le bundle frontend (`public/fonts/` ou
équivalent) : `Inter-Regular`, `Inter-SemiBold`, `JetBrainsMono-Regular`,
`JetBrainsMono-SemiBold`. Voir `PORT-SOURCES.md`.

## Format

A4 portrait par défaut (paysage pour les états denses comme la déshérence,
10 colonnes). Couleurs et nombres : tokens de `cosumaf-tokens.ts` (INK `#11191F`,
gris, accent), `tabular-nums`, montants en XAF avec espace insécable.
