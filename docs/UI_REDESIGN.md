# UI refresh — public marketplace

## Direction

A single modern visual system for the public marketplace: deep Caspian ink,
sea-glass accent, warm paper text, and editorial display typography. The goal is
to make discovery, search, destination browsing, product cards, and auth feel
like one product rather than separate legacy screens.

## Tokens

| Token | Value |
|---|---|
| Canvas | `#071417` |
| Surface | `#0d2226` |
| Card | `#122b30` |
| Border | `#23464a` |
| Text | `#f4f0e6` |
| Muted | `#9bb1ae` |
| Accent | `#a8e6cf` |
| Display font | Unbounded |
| Body font | Onest |
| Radius | 20px cards / 12px controls |

The published constructor `designConfig` is refreshed by
`20261031190000_refresh_marketplace_design_tokens`.

## What changed

- global public tokens, typography, focus states, selection and controls;
- marketplace header: logo tile, brand lockup, pill navigation/auth actions;
- search panel: compact segmented tabs, glass surface, accent submit;
- product cards: dark editorial cards with image, category, supplier code,
  price, date, nights and hover state;
- destination directory and destination cards now use the same card language;
- product detail pages inherit the dark public shell (including legacy
  slate/blue utility classes);
- login and registration use a split image/form layout instead of standalone
  blue auth screens;
- mobile hero no longer overflows the viewport; arrows are desktop-only and
  brand/auth controls fit the mobile header;
- footer and public layout use the same ink/surface/border tokens.

## Verification

- `npx tsc --noEmit` — pass
- `npm run build` — pass
- `npx vitest run` — **1122 tests / 77 files pass**
- Browser screenshots: `reports/demo/final-home.png`,
  `final-home-mobile.png`, `final-login.png` and `ui5-*` page shots.
