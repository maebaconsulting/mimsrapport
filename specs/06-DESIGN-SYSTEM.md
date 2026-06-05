# 06 · Design system (identique à MIMS)

Objectif : **même design graphique que MIMS**. Porter intégralement les tokens DS v2.2
depuis `app/globals.css` (source verrouillée). Reproduire les hex à l'identique. Les
valeurs ci-dessous sont vérifiées ; en cas de doute, `app/globals.css` fait foi.

Esprit : sobriété institutionnelle, densité d'abord, `tabular-nums` partout, traçabilité
visible. Pas de décor, pas de dégradé sauf « soft » dans les overlays de graphiques.

## Couleurs de marque

```css
--color-ink: #11191F;            /* sidebar, boutons primaires, texte sur clair */
--color-surface: #F4F3EC;        /* fond de canevas principal */
--color-surface-raised: #FFFFFF; /* fond des cartes */
--color-accent: #FFED90;         /* or pâle, indicateur actif */
--color-accent-soft: #FFF6C9;    /* fond carte attention */
```

## Niveaux de gris (WCAG 2.1 AA)

```css
--color-gray-50:  #FAFAF9;
--color-gray-100: #F0EFE8;   /* hover, chip neutre */
--color-gray-200: #E5E4DC;   /* bordures, séparateurs */
--color-gray-300: #D1CFC4;
--color-gray-400: #6E6C67;   /* texte secondaire */
--color-gray-500: #5F5C58;
--color-gray-600: #424751;   /* labels de section, en-têtes de colonne */
--color-gray-700: #2D3138;
--color-gray-900: #11191F;   /* = ink */
```

## Couleurs sémantiques

```css
--color-success: #2D5A2D;  --color-success-soft: #E8F0E8;
--color-warning: #8C5C0F;  --color-warning-soft: #F8EFD8;
--color-danger:  #8A2D2D;  --color-danger-soft:  #F5E3E3;
--color-info:    #1F4A57;  --color-info-soft:    #DEE9ED;
--color-critical:#7A1E1E;  --color-critical-soft:#ECD5D5;
```

## Couleurs métier (utiles aux rapports/dashboards)

Secteurs instruments, pays CEMAC (pills GA/CG/CM/TD/GQ/CF), organismes (COSUMAF
`#2D5A2D`, BVMAC `#1A3D6B`, BEAC `#9A5A1E`, DCR `#52524A`), segments clients, profils
de risque. Liste complète dans `app/globals.css` (lignes ~10-265) ; porter le bloc tel
quel.

## Règles verrouillées (LOCKED)

1. Jamais de couleur Tailwind par défaut (`bg-blue-XXX`) : toujours un token DS.
2. `var(--color-ink)` est un **fond**, **jamais une bordure**.
3. Les bordures sont `--color-gray-200` ou transparentes.
4. `tabular-nums` obligatoire sur toutes les valeurs numériques (réglé globalement sur
   `<html>` via `font-feature-settings`).
5. Small-caps sur les labels de colonne et de section.
6. Pas d'emoji 3D, pas de dégradé sauf « soft ».
7. Pas de tiret cadratin : point médian `·` ou flèche `→`.
8. Montants avec espace insécable comme séparateur de milliers (`1 247`).

## Typographie

Polices (chargées localement, équivalent `next/font` côté MIMS) :

```css
--font-sans: "IBM Plex Sans", system-ui, sans-serif;   /* titres, labels, nav */
--font-mono: "IBM Plex Mono", "JetBrains Mono", ui-monospace, monospace; /* nombres, codes, dates */
--font-ui:   "Inter", system-ui, sans-serif;            /* corps, 13-14px */
```

Poids : IBM Plex Sans 400/500/600/700, IBM Plex Mono 400/500/600, Inter 400/500/600.
(Le portail client MIMS utilise Playfair Display ; **non concerné** ici.)

Échelle :

```css
--text-h1: 24px/600/1.25;  --text-h2: 18px/600/1.30;  --text-h3: 14px/600/1.40;
--text-body: 14px/1.43;    --text-sm: 13px/1.38;       --text-xs: 11px/500/1.45;
```

Classe small-caps :

```css
.small-caps { font-size: 11px; font-weight: 500; text-transform: uppercase;
              letter-spacing: 0.5px; color: var(--color-gray-600); }
```

## Géométrie et espacement

```css
--spacing: 4px;                /* unité de base */
--row-height-dense: 36px;      /* tables opérationnelles (LOCKED) */
--row-header-height: 40px;
--page-header-height: 90px;
--document-a4: 794px;
--radius-sm: 4px; --radius-md: 6px; --radius-lg: 12px; --radius-pill: 999px;
--ease-out: cubic-bezier(0.16, 1, 0.3, 1);
--duration-fast: 150ms; --duration-base: 200ms; --duration-slow: 300ms;
```

Anneau de focus :

```css
:focus-visible { outline: none; box-shadow: 0 0 0 3px rgba(255, 237, 144, 0.6); }
```

## Note sur l'adaptation desktop

L'app étant mono-utilisateur desktop, on peut alléger la navigation MIMS (pas de
sidebar à 95 permissions) tout en gardant **strictement les mêmes tokens** : couleurs,
typographie, densité, radius, focus. Le « même design » porte sur le langage visuel,
pas sur la structure de navigation complète de MIMS.

## Source de port

`app/globals.css` (bloc `@theme` / `:root`, tokens LOCKED) et `app/[locale]/layout.tsx`
(chargement des polices). Voir `PORT-SOURCES.md`.
