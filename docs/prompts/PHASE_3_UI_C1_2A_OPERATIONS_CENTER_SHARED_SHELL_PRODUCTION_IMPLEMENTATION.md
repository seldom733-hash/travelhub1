# PHASE 3 — COMMERCE CENTER UI-C1.2A
## OPERATIONS CENTER SHARED SHELL — PRODUCTION IMPLEMENTATION

### IMPLEMENTATION PROMPT
### PRODUCTION CODE REQUIRED

---

## 0. EXECUTION MODE

Выполнить **UI-C1.2A — Operations Center Shared Shell Implementation**.

Это первый production implementation step после принятия UI-C1.2 Architecture & Design Contract.

Accepted baseline:

```text
D5 — ACCEPTED
D6 — ACCEPTED
D7 — ACCEPTED
UI-C1 — ACCEPTED
UI-C1.1 — ACCEPTED
UI-C1.2 — OPERATIONS CENTER ARCHITECTURE & DESIGN CONTRACT — ACCEPTED
```

Binding UI-C1.2 micro-closure SHA:

```text
c9ef2b496a53b56cc03992705a89616fe567185e
```

TRUE NEXT for this step:

```text
UI-C1.2A — OPERATIONS CENTER SHARED SHELL IMPLEMENTATION
```

UI-C2 and D8 remain NOT STARTED.

This stage **must produce visible browser changes**.

A report that claims success while `/app/requests`, `/app/orders`, `/app/bookings` still visually render as three unrelated registry pages is **VERDICT B**.

---

# 1. OBJECTIVE

Implement the shared production shell for the unified Operations Center:

```text
ЦЕНТР ОПЕРАЦИЙ

[ Заявки ] [ Заказы ] [ Бронирования ] [ Платежи ]

ACTIVE DOMAIN CONTENT
```

The shell must become the canonical registry frame rendered by:

```text
/app/requests
/app/orders
/app/bookings
/app/payments
```

At UI-C1.2A, the goal is **shared shell / tabs / sidebar / route composition / shared registry frame**.

Do not yet perform the full Requests/Orders/Bookings registry semantic migrations assigned to UI-C1.2B/C/D, except for the minimal wrapping/integration required to render them correctly inside the shell.

---

# 2. HARD ACCEPTANCE PRINCIPLE

This step is visual implementation.

Mandatory rule:

> **At the same viewport, `/app/requests`, `/app/orders`, and `/app/bookings` must visibly share one Operations Center page shell.**

If a reviewer ignores the entity-specific table/KPI data, the following must clearly look identical:

- page top geometry;
- page title;
- tabs;
- shell width;
- shell padding;
- vertical rhythm;
- active-tab placement;
- KPI-slot region;
- toolbar slot;
- registry/table slot;
- loading/empty/error slot;
- pagination slot;
- responsive shell behavior.

Token reuse alone is insufficient.

---

# 3. BINDING PAGE COMPOSITION

Implement ADR-OPS-014 in production.

Canonical shell skeleton:

```text
┌──────────────────────────────────────────────────────────────┐
│ BREADCRUMBS / PAGE CONTEXT                                  │
│ ЦЕНТР ОПЕРАЦИЙ                         PERIOD / ACTIONS      │
│                                                              │
│ [ Заявки ] [ Заказы ] [ Бронирования ] [ Платежи ]          │
├──────────────────────────────────────────────────────────────┤
│ TOTAL KPI SLOT                                               │
├──────────────────────────────────────────────────────────────┤
│ PRIMARY STATUS / LIFECYCLE KPI GROUP SLOT                   │
├──────────────────────────────────────────────────────────────┤
│ SECONDARY / EXCEPTION KPI GROUP SLOT                        │
├──────────────────────────────────────────────────────────────┤
│ PAYMENT / REFUND KPI GROUP SLOT                             │
├──────────────────────────────────────────────────────────────┤
│ ATTENTION SLOT                                               │
├──────────────────────────────────────────────────────────────┤
│ SEARCH | FILTERS | DATE SCOPE | RESET | EXPORT              │
├──────────────────────────────────────────────────────────────┤
│ RESULT / SELECTION SUMMARY                                  │
│ REGISTRY TABLE                                               │
├──────────────────────────────────────────────────────────────┤
│ PAGINATION                                                   │
└──────────────────────────────────────────────────────────────┘
```

At UI-C1.2A, domains may not yet populate every semantic slot with final content.

Therefore implement the shell API so a domain may intentionally omit a non-applicable or not-yet-migrated slot **without creating empty decorative sections**.

Vertical order remains fixed.

---

# 4. REQUIRED SHARED COMPONENT

Create a canonical reusable shell component, preferably:

```tsx
<OperationsCenterShell />
```

It should own:

- page max width;
- horizontal/vertical page padding;
- breadcrumbs/page-context area;
- Operations Center title/header geometry;
- tab bar;
- semantic content slots;
- toolbar container geometry;
- table container geometry;
- loading shell;
- empty shell;
- error shell;
- pagination container;
- responsive behavior.

Suggested API shape:

```tsx
<OperationsCenterShell
  activeDomain="requests"
  tabs={...}
  breadcrumbs={...}
  headerActions={...}
  total={...}
  primaryKpis={...}
  secondaryKpis={...}
  financeKpis={...}
  attention={...}
  toolbar={...}
  resultSummary={...}
  table={...}
  pagination={...}
/>
```

Exact implementation may differ, but ownership must remain centralized.

Do not create four separate near-identical wrappers.

---

# 5. TAB MODEL — P0

Tabs:

```text
Заявки
Заказы
Бронирования
Платежи
```

Canonical routes:

```text
Заявки         → /app/requests
Заказы         → /app/orders
Бронирования   → /app/bookings
Платежи        → /app/payments
```

Tab click must perform real route navigation.

Do NOT make client-only tab state the authority.

Required behavior:

- active tab derives from current route;
- browser Back/Forward works;
- direct URL opens the correct active tab;
- URL is deep-linkable;
- tab switching uses router navigation;
- only active domain page fetches its own registry data;
- no prefetch-driven hidden duplicate business fetches if avoidable;
- tab active state is visually unmistakable;
- tabs are RU/AZ/EN localized.

---

# 6. PERMISSION-AWARE TABS

Canonical permissions:

```text
Requests → order.read
Orders   → order.read
Bookings → booking.read
Payments → finance.payment.read
```

Rules:

- a tab without read permission is not rendered;
- hidden tab is NOT a security boundary;
- backend authorization remains authoritative;
- direct unauthorized route must still be denied by existing route/backend protection;
- do not weaken any D5/D6/D7 server authority.

Do not invent new permission names.

---

# 7. SIDEBAR — VISIBLE PRODUCTION CHANGE REQUIRED

Target sidebar:

```text
ОПЕРАЦИИ
├── Заявки
├── Заказы
└── Бронирования

ФИНАНСЫ
└── Платежи
```

Requirements:

- add `ФИНАНСЫ` group if absent;
- add `Платежи`;
- Payment item permission: `finance.payment.read`;
- active sidebar item follows domain route;
- `/app/payments` highlights `ФИНАНСЫ → Платежи`;
- do NOT add a separate sidebar item called `Центр операций`;
- Operations Center is a shared workflow shell, not a new domain menu item.

This must be visible in browser evidence.

---

# 8. PAYMENTS ROUTE — UI-C1.2A SCOPE

Canonical target:

```text
/app/payments
```

Existing historical surface may be:

```text
/app/finance/payments
```

At UI-C1.2A:

- introduce the canonical `/app/payments` route shell entry;
- it must render Operations Center with `Платежи` active;
- do not perform the full Payments registry migration yet if assigned to UI-C1.2F;
- do not invent placeholder financial data;
- if the existing Payments registry cannot yet be safely migrated, render a truthful transitional shell state that clearly preserves scope and routes to/contains the existing surface without duplicating semantics;
- document the exact transitional behavior.

Preferred behavior:

```text
/app/payments
→ OperationsCenterShell
→ Payments active
→ existing read-only payments registry content mounted/adapted where safe
```

Do not break `/app/finance/payments` existing bookmarks; retain redirect/compatibility path if needed.

---

# 9. EXISTING REGISTRIES — MINIMAL MIGRATION ONLY

Wrap these pages into the shared shell:

```text
/app/requests
/app/orders
/app/bookings
```

For UI-C1.2A:

Allowed:

- move existing registry content into shell slots;
- normalize page-level header;
- normalize tab placement;
- normalize page/container geometry;
- move existing toolbar into shell toolbar slot;
- move existing table/pagination into shell slots;
- remove duplicate local page title/header that conflicts with shell;
- adapt local loading/error/empty states to shell geometry.

Not yet required:

- full semantic KPI regrouping;
- all-status KPI migration;
- new Attention detectors;
- Requests URL-state overhaul;
- Orders lifecycle flow;
- Bookings lifecycle flow;
- final Payments read model;
- backend KPI extensions.

Those belong to later stages.

---

# 10. NO DOUBLE HEADERS

After migration there must not be:

```text
ЦЕНТР ОПЕРАЦИЙ
...
ЗАКАЗЫ
...
another local page header
```

or similar stacked duplicate title systems.

Use one hierarchy:

```text
PAGE TITLE:
ЦЕНТР ОПЕРАЦИЙ

ACTIVE TAB:
Заказы
```

The active tab is sufficient domain context.

If a domain-specific subtitle is needed, keep it secondary and consistent across all tabs.

---

# 11. BREADCRUMBS

Use one shared breadcrumb grammar.

Recommended registry form:

```text
Главная / Центр операций / Заказы
```

or the established project-localized equivalent.

Requirements:

- same geometry on all four routes;
- final segment = active domain;
- RU/AZ/EN;
- no raw route keys.

Do not invent a sidebar route `/app/operations` merely to make breadcrumbs work.

---

# 12. HEADER GEOMETRY

Header must be one canonical component/layout.

Required visual hierarchy:

```text
Breadcrumbs
ЦЕНТР ОПЕРАЦИЙ                           optional actions
Tabs
```

Same:

- max width;
- title size;
- title weight;
- spacing;
- tab baseline;
- divider behavior;
- mobile stacking.

Do not allow Requests/Orders/Bookings to define independent header geometry.

---

# 13. TABS VISUAL SYSTEM

Create a reusable visual system:

```text
inactive
hover
active
focus-visible
disabled/non-rendered by permission
```

Requirements:

- active domain obvious without relying only on text color;
- WCAG-conscious contrast;
- keyboard navigation;
- `role="tablist"` / `role="tab"` / associated panel semantics where compatible with route-based tabs;
- visible focus;
- arrow-key behavior if implementing ARIA tabs;
- no focus trap;
- horizontal scroll on narrow screens if needed.

---

# 14. SHARED CONTENT SLOT GRAMMAR

Create stable visual slot primitives or consistent wrapper contracts for:

```text
OperationsTotalSlot
OperationsKpiGroupSlot
OperationsAttentionSlot
OperationsToolbarSlot
OperationsRegistrySlot
OperationsPaginationSlot
```

Exact names optional.

Important:

```text
shared outer geometry
≠
shared business content
```

Do not force a fake refund group into Requests.

Do not add empty boxes when a slot is absent.

---

# 15. TOTAL KPI SLOT

Preserve accepted visual rule:

```text
Total = approximately 15–20% larger than ordinary status KPI
not full-width
```

At UI-C1.2A, keep existing Total card behavior where already available.

Do not reintroduce the old full-width Total hero.

Final all-status migration is later, but shell must support the accepted total-card geometry.

---

# 16. TOOLBAR SLOT

Toolbar outer geometry must be shared now.

Canonical future order:

```text
Search
Primary status
Secondary filters
Date type
From
To
Reset
Export
```

At this stage preserve each domain's existing supported controls, but render them inside one shared toolbar frame.

Do NOT invent unsupported filters merely to fill the toolbar.

The final per-domain normalization occurs in B/C/D/H.

---

# 17. TABLE SLOT

Registry table frame must look consistent across Requests/Orders/Bookings/Payments.

Shared shell/table container must establish:

- border/radius;
- overflow behavior;
- table top spacing;
- loading placement;
- empty state placement;
- error placement;
- pagination relationship;
- desktop width;
- tablet behavior;
- mobile horizontal scroll boundary.

Do not rewrite all domain columns yet.

---

# 18. LOADING STATE

Implement shared loading geometry.

Requirements:

- header and tabs remain stable;
- loading does not cause major layout jump;
- toolbar should not disappear if existing UX allows continued input;
- registry table area shows shell-compatible skeleton/spinner;
- no fake KPI numbers.

Do not block tab navigation during a domain fetch.

---

# 19. EMPTY STATE

Shared empty-state frame.

Distinguish:

```text
NO DATA EXISTS
vs
NO RESULTS FOR ACTIVE FILTERS
```

When filters are active, provide Reset where domain already supports it or the shell can safely invoke existing reset behavior.

Do not create fake CTA actions.

---

# 20. ERROR STATE

Shared error-state frame.

Requirements:

- user-safe message;
- retry where possible;
- no backend stack traces;
- no raw API error object dumps;
- tabs/sidebar remain navigable;
- no existence leakage across workspace/tenant boundary.

---

# 21. RESPONSIVE CONTRACT

Mandatory browser widths:

```text
1680
768
390
```

Desktop:

```text
Header
Tabs
Content slots
Toolbar
Table
Pagination
```

Tablet:

- same semantic order;
- tabs may scroll;
- toolbar wraps predictably;
- no accidental double column if too narrow.

Mobile:

- page hierarchy preserved;
- tabs horizontally scroll or fit safely;
- no page-level horizontal overflow;
- table may have its own horizontal scroll;
- active tab remains visible;
- sidebar behavior preserves existing shell mechanics.

Do not change the business semantic order per breakpoint.

---

# 22. CANONICAL VISUAL PARITY CHECK — P0

Capture `/app/requests`, `/app/orders`, `/app/bookings` side by side at same viewport.

Required:

```text
same title baseline
same tab baseline
same content max width
same shell left/right padding
same top spacing
same toolbar outer container
same table outer container
same pagination outer alignment
```

The current business contents may differ.

Acceptance test:

> Blur/ignore the actual text and data. The three registry pages must clearly look like the same application template with only the active tab/content changed.

If not, VERDICT B.

---

# 23. PAYMENTS TAB VISUAL EVIDENCE

Also show:

```text
/app/payments
```

At minimum prove:

- Operations Center title;
- Payments active tab;
- sidebar `ФИНАНСЫ → Платежи`;
- permission-aware visibility;
- canonical route works;
- no fake production data.

If full existing payment registry is reused, show it mounted within shared shell.

---

# 24. I18N

Touched shell surfaces require RU/AZ/EN.

Required keys include equivalents of:

```text
Центр операций
Заявки
Заказы
Бронирования
Платежи
Финансы
```

Do not hardcode Russian text in shared production components.

Existing canonical status labels remain untouched unless necessary.

---

# 25. ACCESSIBILITY

Mandatory:

- semantic nav/tab labeling;
- keyboard reachable tabs;
- visible focus;
- active tab communicated semantically;
- proper headings;
- loading status accessible;
- error/empty region readable by assistive tech;
- no icon-only control without accessible name.

---

# 26. SECURITY / AUTHORITY PRESERVATION

Must preserve:

```text
D5 Order action authority
D6 Booking action authority
D7 backend financial authority
server-side RBAC
workspace/tenant isolation
404-like cross-context behavior
audit immutability
```

The shell must never trust:

```text
client partnerId
client tenantId
hidden tab state
sidebar visibility
```

for authorization.

No security weakening is acceptable for visual unification.

---

# 27. PERFORMANCE

Only active registry should execute domain business fetches.

Avoid:

```text
Requests + Orders + Bookings + Payments all fetching just because tabs are rendered
```

Tabs may be static route links/config.

Check for:

- duplicate fetch caused by wrapper + page;
- unnecessary mount/unmount loops;
- repeated i18n fetches;
- unstable React keys;
- accidental infinite URL-state loops.

---

# 28. TESTS — REQUIRED

Add focused frontend tests for:

1. shell renders all permitted tabs;
2. tabs hidden when permission absent;
3. active tab derived from route;
4. route navigation per tab;
5. sidebar Finance→Payments presence;
6. Payments canonical `/app/payments`;
7. shell slot ordering;
8. omitted slot does not leave empty visual container;
9. loading state;
10. empty state;
11. error state;
12. responsive-safe class/contracts where testable;
13. RU/AZ/EN shell labels;
14. no duplicate local page title after wrapping.

Preserve existing tests.

---

# 29. REGRESSION TESTS

Run at minimum:

```text
frontend typecheck
frontend build
frontend focused tests
frontend full test suite
```

Also run accepted D5/D6/D7 regression suites appropriate to repository setup.

No backend change is expected in UI-C1.2A.

If backend must be touched unexpectedly, STOP and explain why before expanding scope.

---

# 30. BROWSER QUALIFICATION — MANDATORY

This is not optional.

Browser matrix:

```text
A. /app/requests
B. /app/orders
C. /app/bookings
D. /app/payments
```

Widths:

```text
1680
768
390
```

At 1680, capture side-by-side or equivalent comparable screenshots for A/B/C.

At minimum verify:

- visible Operations Center title;
- four-tab set subject to permissions;
- correct active tab;
- shared page width;
- shared page padding;
- shared header;
- shared toolbar frame;
- shared table frame;
- sidebar active state;
- Payments under Finance;
- no duplicate headers;
- no page overflow;
- no raw translation keys;
- no broken routes.

---

# 31. BEFORE / AFTER EVIDENCE

Final report must include:

```text
BEFORE:
Requests registry shell
Orders registry shell
Bookings registry shell
Payments existing route/surface

AFTER:
same OperationsCenterShell on all four canonical routes
```

Include concrete component/file evidence.

Do not rely only on narrative claims.

---

# 32. FILE / COMPONENT EVIDENCE

Report exact files changed.

Expected categories:

```text
frontend/components/OperationsCenterShell.tsx     NEW
frontend/components/OperationsCenterTabs.tsx      NEW or equivalent
frontend/app/app/requests/page.tsx                 MODIFIED
frontend/app/app/orders/page.tsx                   MODIFIED
frontend/app/app/bookings/page.tsx                 MODIFIED
frontend/app/app/payments/page.tsx                 NEW/MODIFIED
frontend/.../Shell.tsx                             MODIFIED
frontend/i18n/...                                  MODIFIED
tests                                              NEW/MODIFIED
```

Exact paths may differ.

Do not claim a file changed if it did not.

---

# 33. NON-SCOPE — HARD BLOCK

Do NOT implement in UI-C1.2A:

```text
UI-C1.2B Requests full registry migration
UI-C1.2C Orders semantic lifecycle-flow migration
UI-C1.2D Bookings semantic lifecycle-flow migration
UI-C1.2E backend/read-model prerequisites
UI-C1.2F full Payments integration
UI-C1.2G final KPI semantic grouping
UI-C1.2H Attention/period/filter reconciliation
UI-C1.2I Help/i18n full domain qualification
UI-C1.2J final browser/security closure
UI-C1.2K final overall hard closure

UI-C2
D8
pricing/commission redesign
new status enums
new state transitions
```

Only shell-level i18n required by this step is in scope.

---

# 34. SEC-UI-01

Request server-authority remediation remains separate unless already completed elsewhere.

Do not silently close `SEC-UI-01` merely by changing the shell.

Do not expand Request action authority work into UI-C1.2A.

---

# 35. VISUAL ACCEPTANCE MATRIX

Final report must fill:

| Gate | Result | Evidence |
|---|---|---|
| Shared OperationsCenterShell exists | | |
| Requests uses shared shell | | |
| Orders uses shared shell | | |
| Bookings uses shared shell | | |
| `/app/payments` canonical shell route exists | | |
| Four tabs render per permission | | |
| Active tab correct on each route | | |
| Browser history/deep links work | | |
| Sidebar Operations group correct | | |
| Sidebar Finance→Payments visible | | |
| No `Центр операций` sidebar item | | |
| Header geometry same | | |
| Tabs geometry same | | |
| Toolbar frame same | | |
| Registry/table frame same | | |
| No duplicate local page headers | | |
| Loading shell consistent | | |
| Empty shell consistent | | |
| Error shell consistent | | |
| 1680 qualification | | |
| 768 qualification | | |
| 390 qualification | | |
| RU/AZ/EN shell labels | | |
| Permissions preserved | | |
| D5 preserved | | |
| D6 preserved | | |
| D7 preserved | | |
| UI-C2 not started | | |
| D8 not started | | |

Any P0 FAIL → overall VERDICT B.

---

# 36. AUTOMATIC VERDICT B CONDITIONS

Return VERDICT B if any occur:

```text
- production pages still look like independent registries
- title "ЦЕНТР ОПЕРАЦИЙ" not visible on canonical registry routes
- tabs are client-only state without canonical route navigation
- `/app/payments` missing
- Payments remains invisible from sidebar
- Payments placed under ОПЕРАЦИИ instead of ФИНАНСЫ
- new sidebar item "Центр операций" added
- duplicate local page headers remain
- shell exists only as an unused component
- different pages define their own shell geometry
- all tabs trigger parallel business fetches
- unauthorized tabs rendered
- frontend hidden state treated as authorization
- D5/D6/D7 authority weakened
- raw i18n keys visible
- broken mobile/tablet layout
- no browser evidence
- no visible UI change
- UI-C2 started
- D8 started
```

---

# 37. GIT HARD CLOSURE

Required:

```bash
git status --porcelain=v1
git rev-parse HEAD
git rev-parse origin/master
```

Acceptance:

```text
porcelain = empty
HEAD == origin/master
one canonical 40-char SHA
```

Do not leave untracked screenshots/build artifacts unless intentionally committed and appropriate.

---

# 38. REQUIRED FINAL REPORT STRUCTURE

```text
1. Executive Summary
2. Accepted Baseline
3. Implementation Scope
4. Shared Shell Architecture
5. Route Model
6. Tab Model
7. Permission Model
8. Sidebar Changes
9. Payments Canonical Route
10. Requests Shell Migration
11. Orders Shell Migration
12. Bookings Shell Migration
13. Header / Breadcrumb / Tabs Visual Contract
14. Slot Model
15. Toolbar Frame
16. Registry/Table Frame
17. Loading / Empty / Error
18. Responsive Behavior
19. i18n
20. Accessibility
21. Security Preservation
22. Performance / Active-Tab Fetching
23. Focused Tests
24. Regression Tests
25. Browser Qualification
26. Before / After Evidence
27. Visual Acceptance Matrix
28. Non-Scope Verification
29. Git Hard Closure
30. Final Verdict
31. TRUE NEXT
```

---

# 39. REQUIRED FINAL VERDICT

If all gates pass:

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
<40-char SHA>

VISIBLE UI CHANGE — CONFIRMED
SHARED OPERATIONS CENTER SHELL — CONFIRMED
PAYMENTS SIDEBAR ENTRY — CONFIRMED
/app/payments — CONFIRMED

UI-C2 — NOT STARTED
D8 — NOT STARTED

TRUE NEXT:
UI-C1.2B — REQUESTS REGISTRY MIGRATION
```

If any P0 gate fails:

```text
VERDICT B — UI-C1.2A
OPERATIONS CENTER SHARED SHELL
PRODUCTION IMPLEMENTATION FAILED

UI-C1.2A — NOT ACCEPTED
UI-C1.2B — NOT STARTED
UI-C2 — NOT STARTED
D8 — NOT STARTED
```

---

# 40. FINAL BINDING PRINCIPLE

```text
THIS STEP MUST BE VISIBLE IN THE BROWSER.
```

```text
ONE OPERATIONS CENTER
ONE SHARED SHELL
FOUR CANONICAL DOMAIN ROUTES
FOUR PERMISSION-AWARE TABS
ONE CONSISTENT PAGE COMPOSITION
```

```text
VISUAL PARITY
IS AN ACCEPTANCE GATE,
NOT A POLISH TASK.
```
