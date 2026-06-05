# 07 · Packaging, CI/CD et licence

## Environnements

- **Développement** : macOS (poste de l'auteur). Build local Tauri pour Mac (dmg/app)
  pour itérer.
- **Release cible** : **Windows** (back-office des SDB). Produite par **GitHub Actions**
  sur un runner `windows-latest`.

Tauri ne cross-compile pas confortablement Mac → Windows : la release Windows se
construit donc sur un runner Windows, pas sur le Mac.

## Bundling du sidecar PocketBase

PocketBase est un binaire externe, embarqué via la fonctionnalité **sidecar** de Tauri
(`tauri.conf.json` → `bundle.externalBin`). Le binaire est **spécifique à la
plateforme** :

- build Mac → `pocketbase` (darwin, arm64/x64)
- build Windows → `pocketbase.exe` (windows amd64)

Convention Tauri : nommer le binaire avec le **triplet de cible** (ex.
`pocketbase-x86_64-pc-windows-msvc.exe`, `pocketbase-aarch64-apple-darwin`). Un script
de préparation télécharge la **version figée** de PocketBase pour la plateforme avant
le build (le binaire n'est pas committé, voir `.gitignore`).

> Épingler une version PocketBase précise (pré-1.0). Documenter ce numéro et ne le
> monter qu'après lecture du changelog.

## Workflow GitHub Actions (esquisse)

`.github/workflows/release-windows.yml` :

```yaml
on:
  push:
    tags: ['v*']
jobs:
  build-windows:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4        # + pnpm
      - uses: dtolnay/rust-toolchain@stable
      - run: pnpm install
      - run: pwsh ./scripts/fetch-pocketbase.ps1   # télécharge pocketbase.exe (version figée)
      - run: pnpm tauri build                       # produit .msi / .exe (NSIS)
      - uses: softprops/action-gh-release@v2        # attache les installeurs à la release
        with:
          files: src-tauri/target/release/bundle/**/*.{msi,exe}
```

Détails à câbler lors du dev : cache Rust/pnpm, matrice si build Mac aussi voulu,
secrets de signature.

## Signature de code

- **Windows** : signer le `.msi`/`.exe` (certificat Authenticode) pour éviter les
  alertes SmartScreen. Secret stocké dans GitHub Actions. Optionnel au tout début,
  fortement recommandé pour une diffusion commerciale.
- **Mac** (si build Mac distribué) : signature + notarisation Apple.

## Versioning

Version unique partagée entre `package.json`, `tauri.conf.json` et le tag git `vX.Y.Z`.
Le tag déclenche la release.

## Module licence

Objectif commercial : ne déverrouiller l'app que pour un client ayant acquis la
licence. Garder **léger** en v1.

- **Fichier de licence signé**, validé **hors ligne** au démarrage par la coque Rust
  (vérification d'une signature cryptographique avec une clé publique embarquée).
- Contenu : identité du client (SDB), date d'expiration, périmètre. Pas d'appel réseau
  requis (cohérent avec le mono-poste hors ligne).
- Si licence absente/invalide/expirée : écran de blocage, l'app ne charge pas les
  fonctions d'import/reporting.
- Évolution possible (multi-poste) : validation côté serveur PocketBase.

YAGNI : pas de serveur de licences, pas d'activation en ligne en v1.

## Données utilisateur et sauvegardes

- La base SQLite de PocketBase vit dans le dossier de données utilisateur (résolu par
  Tauri). Jamais dans le bundle de l'app.
- Prévoir une commande d'export/sauvegarde de la base (copie du fichier SQLite) pour
  que l'utilisateur puisse archiver, et préparer la migration vers un serveur en
  multi-poste.
