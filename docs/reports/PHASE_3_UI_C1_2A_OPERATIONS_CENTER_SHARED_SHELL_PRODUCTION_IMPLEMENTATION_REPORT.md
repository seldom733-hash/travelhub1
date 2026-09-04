# PHASE 3 — COMMERCE CENTER UI-C1.2A
## OPERATIONS CENTER SHARED SHELL — PRODUCTION IMPLEMENTATION REPORT

```text
REPORT TYPE:      Production Implementation Report (31 sections, prompt §38)
STAGE:            UI-C1.2A — OPERATIONS CENTER SHARED SHELL PRODUCTION IMPLEMENTATION
STATUS:           COMPLETE — VISIBLE BROWSER CHANGE CONFIRMED
```

---

## 1. Executive Summary

UI-C1.2A implements the shared production shell of the unified **Operations Center**
(ADR-OPS-014) for the four canonical domain routes:

```text
/app/requests     Заявки        (order.read)
/app/orders       Заказы        (order.read)
/app/bookings     Бронирования  (booking.read)
/app/payments     Платежи       (finance.payment.read)
```

Before this step the three commerce registries rendered as three unrelated pages
(each with its own local page header, independent geometry, no tab bar), and the
existing Payments registry lived at `/app/finance/payments` with no sidebar entry.

After this step, at the same viewport, all four canonical routes share **one
Operations Center page shell**: identical breadcrumbs, the «Центр операций» title,
the same four-tab bar with the route-derived active tab, one content max-width and
padding grammar, one toolbar frame, one registry/table frame, and shared
loading/empty/error primitives. The Payments registry gained a canonical
`/app/payments` shell route plus a `ФИНАНСЫ → Платежи` sidebar entry, while the
historical `/app/finance/payments` route is retained as a compatibility redirect
(preserving query params for analytics drill-downs).

This is a **visible, browser-confirmed UI change** — the hard acceptance principle
of this step (§2 of the prompt). Component/file evidence, side-by-side screenshots,
bounding geometry, and per-tab/per-width browser checks are captured in
`docs/evidence/c12a/`.

---

## 2. Accepted Baseline

```text
D5 — ACCEPTED
D6 — ACCEPTED
D7 — ACCEPTED
UI-C1 — ACCEPTED
UI-C1.1 — ACCEPTED
UI-C1.2 — OPERATIONS CENTER ARCHITECTURE & DESIGN CONTRACT — ACCEPTED
UI-C1.2 VISUAL COMPOSITION & STATUS KPI CONTRACT MICRO-CLOSURE — ACCEPTED
```

Binding micro-closure SHA (superseded by this step for the shell surface):
`c9ef2b496a53b56cc03992705a89616fe567185e` (UI-C1.2 visual-composition contract).

TRUE NEXT executed by this step: **UI-C1.2A — OPERATIONS CENTER SHARED SHELL
IMPLEMENTATION**. UI-C2 and D8 remain NOT STARTED.

---

## 3. Implementation Scope

In scope (UI-C1.2A):

```text
- shared OperationsCenterShell component (+ tabs, slot primitives, states)  DONE
- canonical tab model with route navigation on the four canonical routes    DONE
- permission-aware tabs (order.read / booking.read / finance.payment.read)  DONE
- sidebar: ФИНАНСЫ group + Платежи item, no «Центр операций» sidebar item  DONE
- canonical /app/payments shell route (existing read-only registry mounted) DONE
- /app/finance/payments compatibility redirect (query preserved)            DONE
- minimal shell wrapping of the existing Requests/Orders/Bookings pages     DONE
- removal of duplicate local page headers                                   DONE
- shell i18n (RU/AZ/EN)                                                     DONE
- focused tests + full frontend regression + browser qualification          DONE
```

Out of scope — **hard block respected** (prompt §33): no full registry semantic
migration (UI-C1.2B/C/D), no backend/read-model prerequisites (UI-C1.2E), no full
Payments integration (UI-C1.2F), no KPI regrouping (UI-C1.2G), no
attention/period/filter reconciliation (UI-C1.2H), no Help/i18n domain
qualification (UI-C1.2I), no final browser/security closure (UI-C1.2J/K). UI-C2 and
D8 not started. Backend tree untouched (empty diff; see §21).

---

## 4. Shared Shell Architecture

One canonical component owns the entire registry frame:

```text
frontend/components/OperationsCenterShell.tsx   (NEW)
```

`OperationsCenterShell` (default export) renders, in fixed vertical order:

```text
BREADCRUMBS (Главная / Центр операций / <active domain>)
ЦЕНТР ОПЕРАЦИЙ                          headerActions (optional)
[ Заявки ] [ Заказы ] [ Бронирования ] [ Платежи ]
────────────────────────────────────────────────────────
  tabpanel → <domain content children> (scroll container)
```

The shell owns: page max-width (`max-w-[1440px]`), horizontal/vertical padding,
breadcrumb grammar, title geometry, tab bar, `role="tabpanel"` main scroll region,
and the shared slot primitives. Business content stays in the domain page —
**shared outer geometry ≠ shared business content** (prompt §14). A domain may
intentionally omit any semantic slot; omitted slots leave **no empty decorative
container** (verified in §14 of the focused tests).

Exported primitives from the same module:

```text
OperationsToolbarSlot     — toolbar frame wrapper
OperationsRegistrySlot    — table frame (rounded-xl border bg-white shadow-sm)
OperationsErrorState      — role="alert", user-safe message + Retry
OperationsLoadingState    — role="status" skeleton (no fake numbers, no jump)
OperationsEmptyState      — shared empty row (message distinguishes
                             NO DATA vs NO RESULTS FOR FILTERS at call site)
```

Tab configuration is centralized (`OPS_TABS`) with canonical
route → labelKey → permission mapping — no page redefines its own tab set.

---

## 5. Route Model

```text
Заявки         → /app/requests        (existing route, now shell-wrapped)
Заказы         → /app/orders          (existing route, now shell-wrapped)
Бронирования   → /app/bookings        (existing route, now shell-wrapped)
Платежи        → /app/payments        (NEW canonical shell route)
```

The active domain is passed to the shell as `activeDomain`; the tab bar derives the
active tab from it. Tabs are real `next/link` anchors performing **actual route
navigation** — there is no client-only tab-state authority (prompt §5). Browser
Back/Forward, direct-URL opening, and deep-linking therefore all work; only the
active domain page mounts its own data fetch (see §22).

Historical `/app/finance/payments` is retained as a **compatibility redirect**
(`frontend/app/app/finance/payments/page.tsx`, now a thin redirect page) that
`router.replace`s to `/app/payments` preserving `window.location.search` — verified
in the browser for drill-down query params (`status=CAPTURED&currency=USD` survive,
§25). Payment detail links inside the registry continue to resolve under the
existing `/app/finance/payments/{code}` detail route (unchanged).

---

## 6. Tab Model

`OperationsCenterTabs` (internal to the shell module) implements:

- `role="tablist"` with `aria-label` from `ops.tabs_aria` (localized);
- each tab: `role="tab"`, `aria-selected`, `aria-controls` → the shared
  `ops-panel-<domain>` panel id; the active tab also receives the canonical id
  `ops-tab-<domain>`;
- active state visually unmistakable: `border-blue-600 bg-blue-50/60
  text-blue-700` on a `border-b-2` bottom border — not text color alone;
- keyboard: Left/Right/Home/End arrow navigation with manual activation
  (focus moves, Enter/Space activates the native anchor navigation); no focus
  trap; visible `focus-visible:ring-2 ring-blue-400`;
- horizontal scroll (`overflow-x-auto`) on narrow screens so the tab set never
  overflows the page;
- tabs localized RU/AZ/EN (`nav.requests` / `nav.orders` / `nav.bookings` /
  `nav.payments`).

Active-tab derivation is from the route via each page's `activeDomain` prop —
`/app/requests` always activates Заявки, `/app/payments` always activates Платежи,
etc. Browser verification asserted `aria-selected` per route (§25).

---

## 7. Permission Model

Canonical tab → permission (prompt §6, ADR-OPS-011):

```text
Заявки       → order.read
Заказы       → order.read
Бронирования → booking.read
Платежи      → finance.payment.read
```

Rules implemented and verified:

- a tab without read permission is **not rendered** (filter on the session user's
  permission list from `useCurrentUser`); the tablist simply contains fewer tabs —
  verified in focused tests with a permission-less finance user;
- a hidden tab is **not a security boundary** — sidebar route guarding
  (`ROUTE_PERMISSION` in `Shell.tsx`) and backend `@RequirePermissions` /
  `finance.payment.read` authority remain untouched and authoritative;
- no new permission names invented; D5/D6/D7 server authority not weakened.

---

## 8. Sidebar Changes

`frontend/components/Shell.tsx` — visible production change:

- introduced `NAV_GROUPS` (exported for tests) replacing the flat `NAV` with a
  grouped model: top-level (Dashboard/Command Center/Analytics) + headed groups
  ОПЕРАЦИИ, **ФИНАНСЫ**, КОММЕРЧЕСКОЕ УПРАВЛЕНИЕ, ПАРТНЁРСКАЯ СЕТЬ, СЕРВИС,
  АДМИНИСТРИРОВАНИЕ;
- group headings are i18n keys (RU/AZ/EN): `nav.group.operations`,
  `nav.group.finance`, etc. — no hardcoded Russian in the sidebar source;
- **ФИНАНСЫ → Платежи** added with permission `finance.payment.read`, href
  `/app/payments`, icon 💳;
- no sidebar item named «Центр операций» was added (the Operations Center is a
  shared workflow shell, not a domain menu item — verified by focused test and by
  the DOM group-heading audit, where the sidebar shows exactly:
  T / ОПЕРАЦИИ / ФИНАНСЫ / КОММЕРЧЕСКОЕ УПРАВЛЕНИЕ / ПАРТНЁРСКАЯ СЕТЬ / СЕРВИС /
  АДМИНИСТРИРОВАНИЕ);
- active sidebar item follows the domain route (`isDashboardPath` prefix match) so
  `/app/payments` highlights ФИНАНСЫ → Платежи and `/app/requests` highlights
  ОПЕРАЦИИ → Заявки.

Groups with zero visible items (permission-filtered) are not rendered; the
«N скрыто» hidden-count hint is preserved.

---

## 9. Payments Canonical Route

```text
frontend/app/app/payments/page.tsx   (NEW)
```

Renders `OperationsCenterShell activeDomain="payments"` and mounts the **existing
read-only Payments registry content** (Finance-owned operational journal, D7
authority untouched) inside the shell slots — no placeholder financial data, no
invented numbers, no duplicated semantics. The existing registry features
(currency/status filters, date range, sortable headers, page-level AggregateSummary
as shipped before, export) are preserved as-is inside the shared toolbar/registry
frames.

Transitional behavior documented (prompt §8): the historical
`/app/finance/payments` route now redirects to `/app/payments` preserving query
params; the canonical shell route is the single entry used by the sidebar and
tab bar. The page-level client summary remains the pre-existing read-model that
UI-C1.2E/F replace with server aggregates in a later stage — flagged, not silently
"fixed" here.

---

## 10. Requests Shell Migration

`frontend/app/app/requests/page.tsx` — MODIFIED (shell-wrapped):

- local page header removed; the page now renders inside
  `OperationsCenterShell activeDomain="requests"`;
- existing KPI grid, toolbar (search / date / reset / export), table and
  pagination moved into shell content slots (KPI area keeps the accepted
  `CommerceKpiCard` visual contract — total card ~16.7% larger, not full-width,
  per the UI-C1.1/C1.2 rule);
- loading/empty/error states adapted to the shared frame primitives;
- no duplicate local title: the only page title is «Центр операций» in the shell
  header, with «Заявки» as the active tab (verified: no second h1 in the DOM).

The Requests semantic registry migration (KPI regrouping, URL state, date filter)
is explicitly **deferred** to UI-C1.2B.

---

## 11. Orders Shell Migration

`frontend/app/app/orders/page.tsx` — MODIFIED (shell-wrapped):

- local page header removed; the page renders inside
  `OperationsCenterShell activeDomain="orders"`;
- existing lifecycle/payment KPI grid, toolbar, quick-preview sidebar, table,
  pagination and detector deep-links preserved and placed in shell slots;
- duplicate title eliminated; «Заказы» is the active tab under the single
  «Центр операций» title.

Orders semantic lifecycle-flow migration deferred to UI-C1.2C.

---

## 12. Bookings Shell Migration

`frontend/app/app/bookings/page.tsx` — MODIFIED (shell-wrapped):

- local page header removed; the page renders inside
  `OperationsCenterShell activeDomain="bookings"`;
- existing KPI grid, toolbar, table, pagination and detail links preserved;
- «Бронирования» is the active tab under the single shell title.

Bookings lifecycle migration deferred to UI-C1.2D.

---

## 13. Header / Breadcrumb / Tabs Visual Contract

One canonical grammar (implemented once in the shell, used by all four pages):

```text
Главная / Центр операций / <Active Domain>        ← breadcrumb, text-xs slate-400
ЦЕНТР ОПЕРАЦИЙ                              [actions] ← text-2xl font-bold
[ Заявки ] [ Заказы ] [ Бронирования ] [ Платежи ]    ← border-b-2 tab system
```

Identical across routes by construction:

- max width `max-w-[1440px]` + `px-6` left/right padding;
- title size/weight/spacing (single component);
- tab baseline and `-mb-px` divider behavior;
- mobile stacking (flex-wrap title/actions; `overflow-x-auto` tabs);
- header separated by a `border-b border-slate-200` divider.

Browser bounding audit (§25) confirmed the shell header/tab geometry renders on
all four routes at the same vertical rhythm, and **no route defines its own header
geometry anymore**.

---

## 14. Slot Model

Shared slot primitives (see §4). Binding rules honored:

- **shared outer geometry ≠ shared business content** — Requests does not gain a
  fake refund group, Payments does not gain order lifecycle cards;
- a slot that a domain does not populate is simply **absent** — no empty
  decorative box (focused test #8 asserts the shell renders children only and
  pages guard sections behind real data);
- fixed vertical order preserved where a domain provides multiple slots:
  total → status groups → attention → toolbar → table → pagination
  (each domain currently supplies its existing subsets in this canonical order).

---

## 15. Toolbar Frame

`OperationsToolbarSlot` provides the shared frame
(`flex flex-wrap items-center gap-2`). Each domain renders its **existing
supported controls** inside it:

- Requests: search input, date from/to, reset, export, loading indicator;
- Orders: search, date from/to, status select, reset, export;
- Bookings: search, date from/to, status select, reset, export;
- Payments: currency, status, date from/to, clear-status, export.

No unsupported filter was invented to fill the toolbar. The canonical
`Search | Primary status | Secondary filters | Date type | From | To | Reset |
Export` order normalization is deferred to UI-C1.2B/C/D/H per prompt §16.

---

## 16. Registry/Table Frame

`OperationsRegistrySlot` gives all four domains the same outer table container:

```text
overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm
```

Shared behaviors: border/radius, overflow containment, table top spacing via the
frame, loading placement inside the frame, empty state inside the table
(`OperationsEmptyState` row with correct colSpan), error placement above the frame
(`OperationsErrorState`), pagination directly below the table inside the same
frame. Each domain keeps its own columns/row markup — column normalization is
deferred.

---

## 17. Loading / Empty / Error

**Loading** — `OperationsLoadingState`: `role="status"` `aria-busy` skeleton rows;
header/tabs stay stable during a domain fetch; no layout jump from the frame (the
skeleton sits inside the same table frame the data will occupy); no fake KPI
numbers; tab navigation is never blocked (tabs are static links).

**Empty** — `OperationsEmptyState` shared `<tr><td colSpan>` row. The two
semantics are distinguished at the call sites: «Данных нет» (no data exists) vs
«По заданным фильтрам результатов нет» (active filters, with Reset preserved in
each domain's toolbar where it already exists). No fake CTA actions.

**Error** — `OperationsErrorState`: `role="alert"`, user-safe localized message
(`ops.error`), optional Retry button; never renders backend stack traces or raw
API dumps; sidebar and tabs remain navigable; no workspace/tenant existence
leakage beyond the pre-existing API behavior.

---

## 18. Responsive Behavior

Browser-verified at the three mandatory widths (1680 / 768 / 390) on **all four**
canonical routes — 12/12 checks, zero horizontal overflow (`overflow=0px` on
every route × width, §25):

- **Desktop 1680** — full header/tabs/content slots/toolbar/table/pagination;
- **Tablet 768** — same semantic order; toolbar wraps predictably (flex-wrap); tab
  set scrolls if needed; no accidental double column;
- **Mobile 390** — page hierarchy preserved; tabs horizontally scroll or fit
  safely; no page-level overflow (the table's own horizontal-scroll boundary is
  unchanged from the pre-existing registries); active tab remains visible;
  sidebar behavior unchanged (existing Shell collapse mechanics untouched).

Business semantic order per breakpoint is unchanged.

---

## 19. i18n

All shell surfaces are localized RU/AZ/EN in `frontend/lib/i18n.tsx` (no
hardcoded Russian in shared production components). Added keys:

```text
nav.payments            Платежи / Ödənişlər / Payments
nav.finance             Финансы / Maliyyə / Finance
nav.group.operations    ОПЕРАЦИИ / ƏMƏLİYYATLAR / OPERATIONS   (heading)
nav.group.finance       ФИНАНСЫ / MALİYYƏ / FINANCE           (heading)
ops.title               Центр операций / Əməliyyat Mərkəzi / Operations Center
ops.home                Главная / Ana səhifə / Home
ops.breadcrumbs_aria    Хлебные крошки / Breadcrumbs / Breadcrumbs
ops.tabs_aria           Разделы центра операций / ... / Operations Center sections
ops.loading             Загрузка… / Yüklənir… / Loading…
ops.empty_no_data       Данных нет / Məlumat yoxdur / No data
ops.empty_no_results    По заданным фильтрам результатов нет / ...
ops.error               Не удалось загрузить данные / ...
ops.retry               Повторить / Yenidən cəhd edin / Retry
```

Existing tab labels (`nav.requests` / `nav.orders` / `nav.bookings`) were already
canonical and are reused. Focused tests assert RU/AZ/EN values for the shell title,
payments and finance labels. No raw translation keys observed in the browser DOM.

---

## 20. Accessibility

Implemented and verified:

- semantic nav/tab labeling: `role="tablist"`, `role="tab"`,
  `role="tabpanel"`, `aria-selected`, `aria-controls`, `aria-label` on the
  tablist (localized) and on the breadcrumb nav;
- keyboard-reachable tabs with Left/Right/Home/End handling and manual activation;
- visible focus (`focus-visible:ring-2 ring-blue-400`) on tabs and retry button;
- active tab communicated semantically via `aria-selected="true"`;
- proper heading hierarchy (single `h1` «Центр операций» per page — no duplicate
  local titles);
- loading status accessible (`role="status"` + `aria-busy` + `sr-only` text);
- error region `role="alert"`; empty state readable as a table row;
- no icon-only control without accessible name (sidebar item carries
  `aria-label`/`title`; tab links have visible text).

---

## 21. Security Preservation

- **No backend change** — `git diff -- backend` is empty; only the untracked
  browser-qualification script lives under `backend/`. D5 order action authority,
  D6 booking action authority and D7 backend financial authority are untouched
  files; server-side RBAC, workspace/tenant isolation, 404-like cross-context
  behavior and audit immutability are unchanged.
- The shell never trusts client `partnerId`/`tenantId`/hidden-tab-state/sidebar
  visibility for authorization: tab hiding is presentation only; existing
  route-guard (`ROUTE_PERMISSION` redirect) and backend `@RequirePermissions`
  remain authoritative. No security weakening was made for visual unification.
- SEC-UI-01 request server-authority remediation remains OPEN (not closed by this
  step, per prompt §34).

---

## 22. Performance / Active-Tab Fetching

- Tabs are **static route links/config** (`OPS_TABS`) — no tab renders a page, so
  there is no Requests+Orders+Bookings+Payments parallel business fetch;
- only the active domain page executes its own data fetch (each registry page
  mounts its own client component as before — the shell adds no data layer);
- no wrapper+page duplicate fetch (the shell performs no data loading at all);
- no mount/unmount loops, no repeated i18n fetches, no unstable keys introduced;
- `useSearchParams`-based pages keep their existing Suspense boundaries.

---

## 23. Focused Tests

`frontend/lib/operations-center-shell.spec.tsx` (NEW) — **19/19 passed**.

Coverage mapped to prompt §28:

1. shell renders all permitted tabs (4-tab set for a full-permission user);
2. tabs hidden when permission absent (finance user without
   `finance.payment.read` sees no Платежи);
3. active tab derived from route (`activeDomain` → correct `aria-selected`);
4. route navigation per tab (tab hrefs are the four canonical routes);
5. sidebar ФИНАНСЫ → Платежи presence (NAV_GROUPS structure);
6. Payments canonical route `/app/payments` in the tab config;
7. shell slot ordering (toolbar before registry frame; vertical grammar);
8. omitted slot leaves no empty visual container;
9. loading state (`role="status"`, `aria-busy`);
10. empty state (message/colSpan semantics);
11. error state (`role="alert"`, retry);
12. responsive-safe contracts (scrollable tab container classes);
13. RU/AZ/EN shell labels (`ops.title`, `nav.payments`, `nav.finance`);
14. no duplicate local page title after wrapping (single «Центр операций» title);
+ breadcrumb final segment, `aria-controls` wiring, header actions slot,
+ permission mapping constants.

Existing tests preserved (full suite in §24).

---

## 24. Regression Tests

```text
frontend typecheck      npx tsc --noEmit             PASS (clean)
frontend build          npx next build               PASS (all routes compiled)
frontend focused        vitest lib/operations-center-shell.spec.tsx
                                                     19/19 PASS
frontend full suite     vitest run                   409 passed, 1 failed (410)
```

The single full-suite failure is the **pre-existing `formatPrice` NBSP failure**
(`lib/i18n.spec.ts`) — environment-dependent Intl non-breaking space vs regular
space, demonstrated on baseline via `git stash` in the R2 round and documented in
R2/R3 reports. Not caused by this step.

Backend regression (prompt §29): **no backend change expected and none made** —
the backend tree diff is empty. The D5/D6/D7-related backend suites
(`commerce-chain.invariants`, `payment.service`, `refund.service`,
`financial-integrity-checker`, `settlement.service`) were run for the record:
`payment.service` / `refund.service` show a **pre-existing spec/source drift**
(production now requires `reason` on manual payment initiation; the older specs
don't pass it) and `commerce-chain.invariants` shows reference-pattern assertions
failing in this environment — all three fail identically at the untouched HEAD
baseline and are outside UI-C1.2A's frontend-only scope. D5/D6/D7 status is
preserved (no authority change); remediation of those spec suites belongs to the
finance/backend track, not this step.

---

## 25. Browser Qualification

Mandatory matrix (prompt §30) executed headless Chromium against the live stack:

```text
Routes:   /app/requests, /app/orders, /app/bookings, /app/payments
Widths:   1680, 768, 390
```

**40/40 checks PASS** (`docs/evidence/c12a/c12a_browser_results.json`):

| Check | Result |
|---|---|
| login (admin → platform app) | PASS |
| h1 «Центр операций» on all four routes | PASS ×4 |
| four-tab set rendered on all four routes | PASS ×4 |
| correct active tab per route (`aria-selected=true` = Заявки/Заказы/Бронирования/Платежи) | PASS ×4 |
| tabpanel has content table (business data loads in-shell) | PASS ×4 |
| sidebar ФИНАНСЫ group heading present on every route | PASS ×4 |
| sidebar Платежи item → href `/app/payments` | PASS ×4 |
| legacy `/app/finance/payments` redirects to `/app/payments` | PASS |
| drill-down query params preserved through redirect (`status=CAPTURED&currency=USD`) | PASS |
| responsive 1680/768/390 — no horizontal overflow, all four routes | PASS ×12 |

Evidence artifacts (`docs/evidence/c12a/`):

```text
c12a_tab_requests.png / c12a_tab_orders.png / c12a_tab_bookings.png /
c12a_tab_payments.png         — each route at true 1680×1050
c12a_side_by_side_ops_center.png  — four-panel side-by-side composite
c12a_browser_results.json         — full per-check results + DOM audit
```

The side-by-side composite satisfies the §22 canonical-parity acceptance test:
ignoring the entity data, the four pages clearly look like **one application
template** (same title baseline, same tab baseline, same max width/padding, same
toolbar/table frames) with only the active tab and content changed.

---

## 26. Before / After Evidence

```text
BEFORE:
  Requests registry  — independent page with local header, no tabs
  Orders registry    — independent page with local header, no tabs
  Bookings registry  — independent page with local header, no tabs
  Payments           — /app/finance/payments only; no sidebar entry;
                       reachable solely via analytics drill-down

AFTER:
  /app/requests    → OperationsCenterShell (Заявки active)  — requests table etc. in-shell
  /app/orders      → OperationsCenterShell (Заказы active)  — orders table etc. in-shell
  /app/bookings    → OperationsCenterShell (Бронирования active)
  /app/payments    → OperationsCenterShell (Платежи active) — existing registry mounted
  /app/finance/payments → compatibility redirect to /app/payments (query preserved)
  Sidebar          → ОПЕРАЦИИ {Заявки/Заказы/Бронирования} + ФИНАНСЫ {Платежи}
```

Concrete component/file evidence:

```text
frontend/components/OperationsCenterShell.tsx      NEW  — the one shared shell
frontend/components/Shell.tsx                       MOD  — NAV_GROUPS + ФИНАНСЫ→Платежи
frontend/app/app/requests/page.tsx                  MOD  — shell-wrapped, header removed
frontend/app/app/orders/page.tsx                    MOD  — shell-wrapped, header removed
frontend/app/app/bookings/page.tsx                  MOD  — shell-wrapped, header removed
frontend/app/app/payments/page.tsx                  NEW  — canonical Payments shell route
frontend/app/app/finance/payments/page.tsx          MOD  — compatibility redirect
frontend/lib/i18n.tsx                               MOD  — shell/nav keys RU/AZ/EN
frontend/lib/metric-drilldown.ts                    MOD  — drill-down → /app/payments
frontend/lib/operations-center-shell.spec.tsx       NEW  — focused tests
backend/tmp_c12a_browser_verify.py                  NEW  — qualification script (evidence)
docs/evidence/c12a/*                                NEW  — screenshots + JSON evidence
```

The tab-bar visual system lives inside `OperationsCenterShell.tsx` (single
`OperationsCenterTabs` implementation, not a separate file — equivalent ownership,
no duplicated wrappers, prompt §4/§32 "or equivalent" satisfied).

---

## 27. Visual Acceptance Matrix

| Gate | Result | Evidence |
|---|---|---|
| Shared OperationsCenterShell exists | ✅ | `frontend/components/OperationsCenterShell.tsx` |
| Requests uses shared shell | ✅ | `requests/page.tsx` → shell; DOM h1/tabs check |
| Orders uses shared shell | ✅ | `orders/page.tsx` → shell; DOM h1/tabs check |
| Bookings uses shared shell | ✅ | `bookings/page.tsx` → shell; DOM h1/tabs check |
| `/app/payments` canonical shell route exists | ✅ | `payments/page.tsx` + sidebar href |
| Four tabs render per permission | ✅ | focused tests + browser (4 tabs on all routes) |
| Active tab correct on each route | ✅ | `aria-selected` audit ×4 (browser) |
| Browser history/deep links work | ✅ | route-based tabs; direct URLs open correct active tab |
| Sidebar Operations group correct | ✅ | ОПЕРАЦИИ → Заявки/Заказы/Бронирования |
| Sidebar Finance→Payments visible | ✅ | ФИНАНСЫ → Платежи → `/app/payments` (browser) |
| No «Центр операций» sidebar item | ✅ | focused test + DOM group audit |
| Header geometry same | ✅ | single shell component; side-by-side composite |
| Tabs geometry same | ✅ | single tab component; side-by-side composite |
| Toolbar frame same | ✅ | `OperationsToolbarSlot` on all four |
| Registry/table frame same | ✅ | `OperationsRegistrySlot` on all four |
| No duplicate local page headers | ✅ | single h1 per page (DOM); focused test 14 |
| Loading shell consistent | ✅ | `OperationsLoadingState` + focused test 9 |
| Empty shell consistent | ✅ | `OperationsEmptyState` + focused test 10 |
| Error shell consistent | ✅ | `OperationsErrorState` + focused test 11 |
| 1680 qualification | ✅ | 4/4 no-overflow + full-page screenshots |
| 768 qualification | ✅ | 4/4 no-overflow |
| 390 qualification | ✅ | 4/4 no-overflow |
| RU/AZ/EN shell labels | ✅ | i18n keys + focused test 13 |
| Permissions preserved | ✅ | permission-aware tabs; backend untouched |
| D5 preserved | ✅ | backend diff empty |
| D6 preserved | ✅ | backend diff empty |
| D7 preserved | ✅ | backend diff empty |
| UI-C2 not started | ✅ | non-scope verified (§28) |
| D8 not started | ✅ | non-scope verified (§28) |

No P0 gate FAIL → **VERDICT A**.

---

## 28. Non-Scope Verification

Hard block (prompt §33) verified — none implemented:

```text
UI-C1.2B Requests full registry migration        — NOT STARTED
UI-C1.2C Orders lifecycle-flow migration         — NOT STARTED
UI-C1.2D Bookings lifecycle-flow migration       — NOT STARTED
UI-C1.2E backend/read-model prerequisites        — NOT STARTED (backend untouched)
UI-C1.2F full Payments integration               — NOT STARTED (existing surface mounted only)
UI-C1.2G final KPI semantic grouping             — NOT STARTED
UI-C1.2H Attention/period/filter reconciliation  — NOT STARTED
UI-C1.2I Help/i18n full domain qualification     — NOT STARTED
UI-C1.2J final browser/security closure          — NOT STARTED
UI-C1.2K final overall hard closure              — NOT STARTED
UI-C2                                           — NOT STARTED
D8                                              — NOT STARTED
pricing/commission redesign / new status enums / new state transitions — NOT STARTED
SEC-UI-01                                       — still OPEN (not closed by shell change)
```

Only shell-level i18n required by this step was added (prompt §33 allowance).

---

## 29. Git Hard Closure

```bash
git status --porcelain=v1
git rev-parse HEAD
git rev-parse origin/master
```

```text
porcelain = empty
HEAD == origin/master
canonical SHA = 485436a55912d77e58a37e8c87132762a08caa27
```

All implementation, test, i18n, shell and evidence files are committed; the
browser-qualification script and evidence artifacts are intentionally committed as
evidence (consistent with prior R2/R3 rounds). Working tree is clean; `HEAD`
equals `origin/master` at a single canonical 40-char SHA.

---

## 30. Final Verdict

```text
VERDICT A — UI-C1.2A
OPERATIONS CENTER SHARED SHELL
PRODUCTION IMPLEMENTATION ACCEPTED

D5 — ACCEPTED
D6 — ACCEPTED
D7 — ACCEPTED
UI-C1 — ACCEPTED
UI-C1.1 — ACCEPTED
UI-C1.2 DESIGN CONTRACT — ACCEPTED

UI-C1.2A — ACCEPTED

FINAL SHA:
485436a55912d77e58a37e8c87132762a08caa27

VISIBLE UI CHANGE — CONFIRMED
SHARED OPERATIONS CENTER SHELL — CONFIRMED
PAYMENTS SIDEBAR ENTRY — CONFIRMED
/app/payments — CONFIRMED

UI-C2 — NOT STARTED
D8 — NOT STARTED

TRUE NEXT:
UI-C1.2B — REQUESTS REGISTRY MIGRATION
```

Automatic VERDICT-B conditions (prompt §36) — all cleared:

```text
pages still look like independent registries      — NO (one shared shell, proven)
title «ЦЕНТР ОПЕРАЦИЙ» not visible on routes      — NO (visible on all four)
tabs client-only without route navigation         — NO (real route links)
/app/payments missing                             — NO (canonical route live)
Payments invisible from sidebar                   — NO (ФИНАНСЫ → Платежи)
Payments under ОПЕРАЦИИ                           — NO (under ФИНАНСЫ)
new «Центр операций» sidebar item                 — NO
duplicate local page headers                      — NO (single h1, test-verified)
shell unused component                            — NO (all four routes render it)
pages define their own shell geometry             — NO (one shell component)
all tabs trigger parallel business fetches        — NO (static links; active page only)
unauthorized tabs rendered                        — NO (permission filter)
frontend hidden state treated as authorization    — NO (backend authoritative, untouched)
D5/D6/D7 authority weakened                       — NO (backend diff empty)
raw i18n keys visible                             — NO (browser audit clean)
broken mobile/tablet layout                       — NO (12/12 responsive checks)
no browser evidence                               — NO (docs/evidence/c12a/)
no visible UI change                              — NO (browser-confirmed)
UI-C2 started                                     — NO
D8 started                                        — NO
```

---

## 31. TRUE NEXT

```text
UI-C1.2B — REQUESTS REGISTRY MIGRATION
(semantic KPI regrouping, all-status KPI migration, URL-state overhaul,
 date-filter normalization inside the now-shared shell)

Then, in order: UI-C1.2C Orders → UI-C1.2D Bookings → UI-C1.2E backend/read-model
prerequisites → UI-C1.2F Payments integration → UI-C1.2G–K.
```
