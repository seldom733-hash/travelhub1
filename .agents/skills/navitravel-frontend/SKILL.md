---
name: navitravel-frontend
description: Navitravel frontend engineering workflow — Next.js 16 App Router, React 19, Tailwind design tokens, RU/AZ/EN localization, API integration, and browser verification. Use for pages, filters, forms, tables, and UI polish in this repository.
---

# Navitravel Frontend

Use this skill for `frontend/` work in Navitravel.

## Before editing

- Identify the nearest existing pattern for the same screen type (filters, table, modal, detail panel).
- Preserve `frontend/app/globals.css` tokens: `brand`, `ink`, `panel`, `line`; do not introduce unrelated palettes.
- Never hardcode one language when a key or `useLocale` pattern already exists.
- Prefer shared components: `PageHeader`, `Pagination`, `TableHeaderFilter`, `DateTextInput`, `Price`, `StatusBadge`.
- Preserve accessibility: labels, keyboard focus, `aria-*`, disabled states.

## Localization

- UI copy must work in RU/AZ/EN.
- Use `t(key, locale)` for shared i18n; use a local `tr(ru, az, en)` helper only for screen-specific copy.
- Date placeholders are localized by `DateTextInput`; do not reintroduce native date inputs.
- Product/service codes are not localization: map them through their dictionary or label helper.
- When adding table columns or filter options, update all three languages and any dependent tests.

## Data and state

- Use the shared API client/types rather than ad-hoc fetch shapes.
- On filter changes, make sure the request key includes every query parameter.
- Do not leave stale data visible after a filter change; clear or show loading deliberately.
- For live processes, poll only while an active state exists and stop when terminal.

## Verification

1. `cd frontend && npm run build`
2. Restart the frontend using the project start script if runtime behavior changed.
3. Verify the exact page in a browser at desktop and mobile width.
4. Check RU, AZ, and EN where the task touches labels.
5. Do not claim success from a successful build alone when the task is visual or interactive.

## Guardrails

- Do not use destructive DOM scripts or broad global CSS to hide a component bug.
- Do not remove a field/column because it is inconvenient; preserve the data contract unless the task says otherwise.
- Keep filter and table behavior consistent across similar screens.
