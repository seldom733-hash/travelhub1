# UI refresh — public marketplace

## Direction

The approved direction is **Logo Grove**: a light botanical canvas built from the
company logo's green, warm off-white surfaces, editorial serif headlines and a
quiet dark-green action color.

## Tokens

| Token | Value |
|---|---|
| Canvas | `#f1f4ec` |
| Surface | `#fbfcf8` |
| Text | `#1d2a20` |
| Muted | `#64746a` |
| Accent / logo green | `#3f7a36` |
| Bright logo green | `#7fd858` |
| Border | `#d5e0d2` |
| Display font | Playfair Display |
| Body font | Manrope |
| Radius | 18px cards / 12px controls |

The palette is applied to the published constructor `designConfig` and its
published versions by
`20261031210000_apply_grove_marketplace_palette`.

## What changed

- global public tokens, typography, focus states, selection and controls;
- marketplace header: logo tile, brand lockup, green pill actions;
- hero: editorial title above a large image, floating search card overlapping
  the image bottom;
- search panel: compact segmented tabs, white surface, green submit;
- product cards: light editorial cards with image, category, supplier code,
  price, date, nights and hover state;
- destination directory and destination cards use the same card language;
- product detail pages inherit the light public shell (including legacy
  slate/blue utility classes);
- login and registration keep a dark contrast split screen while the public
  marketplace uses the light Grove canvas;
- mobile hero no longer overflows the viewport; carousel arrows are
  desktop-only and brand/auth controls fit the mobile header;
- footer and public layout use the same light ink/surface/border tokens.

## Verification

- `npx tsc --noEmit` — pass
- `npm run build` — pass
- `npx vitest run` — 1122 tests / 77 files pass
- Browser screenshots: `reports/demo/grove-final-home.png`,
  `grove-final-home-mobile.png`, `grove-final-dest.png`,
  `grove-final-search.png`, `grove-final-pdp.png`.
