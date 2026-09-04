# PHASE 3 — COMMERCE CENTER UI-C1.2B
## REQUESTS REGISTRY MIGRATION — PRODUCTION IMPLEMENTATION

### IMPLEMENTATION PROMPT
### PRODUCTION CODE REQUIRED

---

## 0. EXECUTION MODE

Выполнить:

```text
UI-C1.2B — REQUESTS REGISTRY MIGRATION
```

Accepted baseline:

```text
D5 — ACCEPTED
D6 — ACCEPTED
D7 — ACCEPTED
UI-C1 — ACCEPTED
UI-C1.1 — ACCEPTED
UI-C1.2 DESIGN CONTRACT — ACCEPTED
UI-C1.2A — ACCEPTED
```

Accepted UI-C1.2A SHA:

```text
485436a55912d77e58a37e8c87132762a08caa27
```

UI-C2 and D8 remain NOT STARTED.

This is a **production UI implementation step**.

The Requests tab must visibly change in the browser.

---

# 1. OBJECTIVE

Migrate `/app/requests` from the transitional UI-C1.2A shell-wrapped registry into the accepted Operations Center Requests design.

Required outcomes:

```text
/app/requests
→ OperationsCenterShell
→ Requests active
→ canonical Requests KPI composition
→ all 12 actual Request statuses visible
→ shared toolbar grammar
→ canonical server-side filters
→ URL-state synchronization
→ KPI/table scope consistency
→ browser-qualified desktop/tablet/mobile UI
```

This stage is **Requests only**.

Do not implement Orders lifecycle-flow yet.

Do not implement Booking lifecycle-flow yet.

Do not implement final Payments integration yet.

---

# 2. HARD VISUAL ACCEPTANCE PRINCIPLE

At the end of UI-C1.2B, the Requests tab must visibly match the accepted Operations Center visual hierarchy:

```text
ЦЕНТР ОПЕРАЦИЙ
[ Заявки ] [ Заказы ] [ Бронирования ] [ Платежи ]

[ Всего заявок ]

СТАТУСЫ ЗАЯВОК
[ all 12 visible status KPI cards ]

ТРЕБУЕТ ВНИМАНИЯ
[ server-authoritative actionable cards only ]

[ Search ][ Status ][ Additional filters ][ Date* ][ Reset ][ Export ]

TABLE

PAGINATION
```

If `/app/requests` still looks like the old flat KPI area with partial status coverage or inconsistent toolbar placement:

```text
VERDICT B
```

---

# 3. SOURCE OF TRUTH — REQUEST STATUS

Use the actual canonical RequestStatus enum already audited in UI-C1.2:

```text
NEW
CHECKING
SUPPLIER_TIMEOUT
PRICE_CHANGED
CUSTOMER_ACCEPTED
CONFIRMED
CONVERTED
REJECTED
UNAVAILABLE
EXPIRED
CUSTOMER_PAYMENT_TIMEOUT
CANCELLED_BY_CUSTOMER
```

Do NOT invent statuses.

Do NOT rename business semantics.

Do NOT collapse canonical statuses into aggregates.

---

# 4. P0 ALL-STATUS KPI RULE

Binding rule from ADR-OPS-015:

```text
EVERY ACTUAL CANONICAL STATUS
→ ONE VISIBLE STATUS KPI CARD
```

For Requests:

```text
12 actual statuses
→ 12 visible status cards
```

Mandatory:

```text
NEW
CHECKING
SUPPLIER_TIMEOUT
PRICE_CHANGED
CUSTOMER_ACCEPTED
CONFIRMED
CONVERTED
REJECTED
UNAVAILABLE
EXPIRED
CUSTOMER_PAYMENT_TIMEOUT
CANCELLED_BY_CUSTOMER
```

No status may remain filter-only.

---

# 5. TOTAL KPI

Use:

```text
Всего заявок
```

RU/AZ/EN localized.

Visual rule:

```text
Total card
- not full-width
- approximately 15–20% larger than ordinary status KPI
- same visual family
- slightly larger label/value typography
- click clears Request status filter
- page resets to 1
```

Do not regress to:

```text
Все заявки
```

Do not create a full-width hero card.

---

# 6. REQUESTS KPI COMPOSITION

Canonical:

```text
[ Всего заявок ]

СТАТУСЫ ЗАЯВОК

[ NEW ]
[ CHECKING ]
[ SUPPLIER_TIMEOUT ]
[ PRICE_CHANGED ]
[ CUSTOMER_ACCEPTED ]
[ CONFIRMED ]
[ CONVERTED ]
[ REJECTED ]
[ UNAVAILABLE ]
[ EXPIRED ]
[ CUSTOMER_PAYMENT_TIMEOUT ]
[ CANCELLED_BY_CUSTOMER ]
```

Use localized user-facing labels.

Raw enum text must never be shown in production UI if a localized mapping exists.

---

# 7. KPI CARD VISUAL SYSTEM

Requests uses the standard status-card family.

Do NOT use the future Orders lifecycle process-card geometry here.

Requests cards should remain:

```text
registry/status KPI cards
not lifecycle chain cards
```

Shared design family:

- consistent radius;
- consistent border;
- consistent padding;
- same label hierarchy;
- same numeric hierarchy;
- same Help affordance;
- same selected state;
- same hover/focus behavior;
- consistent row/column gaps.

Responsive wrapping is allowed.

---

# 8. STATUS ORDER

Use the accepted canonical order:

```text
NEW
CHECKING
SUPPLIER_TIMEOUT
PRICE_CHANGED
CUSTOMER_ACCEPTED
CONFIRMED
CONVERTED
REJECTED
UNAVAILABLE
EXPIRED
CUSTOMER_PAYMENT_TIMEOUT
CANCELLED_BY_CUSTOMER
```

If implementation proposes a different order, it must justify it by a real business/state-machine rule and document the change.

Do not arbitrarily alphabetize statuses.

---

# 9. KPI CLICK CONTRACT

Each status card:

```text
click
→ set status=<canonical status>
→ reset page=1
→ update URL
→ server-side registry fetch
→ KPI/table refresh under same scope
```

Selected card must have a visible selected state.

Total card:

```text
click
→ clear status
→ page=1
→ update URL
→ server-side refresh
```

No client-only filter behavior.

---

# 10. ATTENTION — REQUESTS

Attention is separate from status overview.

Potential accepted Requests attention semantics from design reconciliation include:

```text
supplier SLA pending
customer decision pending
timeouts
```

But UI-C1.2B must not invent backend detectors.

Implement only if the current backend already exposes a server-authoritative condition sufficient to support the card.

Allowed outcomes:

```text
A. Attention card implemented with real server-side query/filter
B. Attention zone omitted because backend prerequisite is not yet ready
```

Forbidden:

```text
client-side detector from current page rows
hardcoded count
fake count
decorative warning card
```

If a needed detector belongs to UI-C1.2H or another backend prerequisite stage, defer it explicitly.

---

# 11. PERIOD / DATE FILTER — P0 SCOPE RULE

Known design constraint:

```text
Requests list supports date range on createdAt
but KPI endpoint previously did not share filter/period scope
```

Therefore:

```text
DO NOT expose period controls
unless KPI and table share exactly the same backend scope.
```

If backend scope parity is still not available:

```text
date filter remains hidden
```

Do not reintroduce a state where:

```text
TABLE = period-filtered
KPI = global
```

If backend prerequisite was already implemented independently, prove the exact endpoint/query behavior before exposing the date controls.

---

# 12. KPI ↔ TABLE SCOPE — P0

Canonical rule:

```text
ACTIVE SEARCH / FILTER / PERIOD
              ↓
        BACKEND QUERY SCOPE
          ↙           ↘
        KPI           TABLE
```

Requests KPI must reflect the same active Request scope as the table for any UI-exposed filter.

No stale KPI.

No client-side counting.

No separate global KPI request presented as filtered.

---

# 13. SEARCH

Search must be:

```text
first control in toolbar
server-side
debounced ~300–400 ms
```

Behavior:

- typing never blocked by loading;
- Enter may trigger immediate request;
- clear resets page=1;
- query reflected in URL;
- active search refreshes both table and any KPI scope supported by backend;
- no explicit Search submit button unless existing accessibility/user-flow requires it.

Do not implement client-side row filtering.

---

# 14. FILTERS

Primary filter:

```text
Request status
```

Additional filters only if backed by existing server contract, such as current supported:

```text
customerId
partnerId
```

Do not invent new server filters in this stage unless the repository already contains the necessary contract and this stage explicitly wires it.

Do not trust client partnerId for authorization.

---

# 15. URL STATE — REQUIRED

Requests currently needs URL-state normalization.

Canonical query model should support the subset actually implemented, for example:

```text
?q=
&status=
&customerId=
&partnerId=
&page=
&pageSize=
&sort=
```

Only add date params when KPI/table scope parity exists:

```text
&from=
&to=
```

Requirements:

- reload preserves active filter state;
- Back/Forward restores UI;
- direct URL reproduces state;
- changing search/filter resets page=1;
- clearing filter removes corresponding param;
- no infinite router/update loop;
- no incompatible legacy params silently retained.

Document final canonical params.

---

# 16. TOOLBAR ORDER

Canonical visible order:

```text
[ Search ]
[ Status ]
[ Additional filters ]
[ Date scope — only if parity exists ]
[ Reset ]
[ CSV ]
[ XLSX ]
```

Do not place Export before Search.

Do not split primary filters into unrelated sections.

Toolbar must use the shared `OperationsToolbarSlot`.

---

# 17. RESET

Reset must clear the active Requests registry state:

```text
search
status
additional filters
date if present
page
sort if reset contract requires
```

Then:

```text
page=1
URL normalized
server fetch refreshed
```

Reset must not remove workspace/tenant scope.

---

# 18. TABLE

Preserve domain-specific Request table semantics.

Do not redesign pricing semantics in this stage.

Existing Request concepts may include:

- Request reference;
- customer/client;
- product/service;
- supplier/provider;
- storefront price;
- confirmed price;
- service date;
- status;
- created date;
- SLA.

Important:

```text
Цена витрины
Подтв. цена
```

must NOT be redefined during this visual migration.

Commission/pricing architecture remains separate.

---

# 19. STATUS BADGES

Table status badge, KPI card label, filter option, detail badge and Help label must use one canonical localized label source.

Do not expose raw:

```text
CUSTOMER_PAYMENT_TIMEOUT
CANCELLED_BY_CUSTOMER
...
```

in visible UI.

---

# 20. TABLE VISUAL FRAME

Use `OperationsRegistrySlot`.

Preserve shared shell geometry.

Requests-specific table can retain its domain columns, but must fit the same outer registry frame as other tabs.

Requirements:

- no duplicate outer card around the shared registry frame;
- consistent header spacing;
- consistent table border;
- consistent pagination relation;
- mobile horizontal scroll remains contained inside the table area.

---

# 21. PAGINATION

Pagination must:

- remain inside the shared registry frame relationship;
- sync with URL `page`;
- reset to 1 on search/filter changes;
- preserve other active query params;
- not trigger client-only slicing.

---

# 22. EXPORT

Preserve CSV/XLSX behavior if currently supported.

Export must respect:

```text
active search/filter scope
workspace/tenant scope
```

If backend export does not support some new UI filter, do not silently claim parity.

Document limitations.

Do not export only the current visible page unless that is the canonical existing behavior and clearly labeled.

---

# 23. HELP AFFORDANCE

Status cards should preserve the accepted Help / Business Dictionary direction.

For touched Requests KPI cards:

- use stable Help topic IDs where registry infrastructure exists;
- same localized label as status badge/filter;
- no duplicate ad hoc explanation text;
- no raw enum in user-facing Help.

Do not expand into full Help implementation beyond touched Requests status surfaces.

---

# 24. I18N

Required RU/AZ/EN parity for:

- Total label;
- all 12 Request status labels;
- group heading;
- search/filter labels;
- Reset;
- empty/error states if touched;
- export labels if touched;
- Help affordance text if touched.

No raw keys in browser.

---

# 25. LOADING / EMPTY / ERROR

Use shared Operations Center primitives.

Loading:

- preserve title/tabs/toolbar;
- no fake KPI values;
- no major layout jump.

Empty:

distinguish:

```text
No data exists
No results for active filters
```

Error:

- user-safe;
- retry where available;
- no raw backend stack;
- tabs remain usable.

---

# 26. RESPONSIVE

Mandatory widths:

```text
1680
768
390
```

Desktop:

- Total card visible;
- 12 status cards form a clean registry grid;
- toolbar remains one coherent section;
- table readable.

Tablet:

- KPI grid wraps predictably;
- no collision between cards;
- toolbar wraps;
- table scroll remains contained.

Mobile:

- Total card still not full-width hero unless necessary due to viewport;
- status cards wrap/stack without breaking hierarchy;
- no page-level horizontal overflow;
- active tabs remain usable;
- table has its own scroll boundary.

---

# 27. ACCESSIBILITY

Status KPI cards must be interactive accessible controls if clickable.

Required:

- keyboard focus;
- visible focus state;
- semantic button/link behavior;
- selected state communicated programmatically where applicable;
- no click-only div;
- Help icon accessible name;
- filter/select labels associated;
- loading/empty/error accessible.

---

# 28. SECURITY PRESERVATION

Do not weaken:

```text
server-side RBAC
workspace/tenant isolation
cross-context 404-like behavior
audit authority
D5
D6
D7
```

Requests tab visibility remains presentation only.

No client-supplied tenant/partner scope is authorization.

SEC-UI-01 remains separate unless already closed elsewhere.

Do not silently mark it closed.

---

# 29. PERFORMANCE

Check:

- no duplicate KPI/list fetches;
- no uncontrolled debounce loops;
- no route churn on every render;
- no redundant full registry reload if query unchanged;
- stale response protection for rapidly changing search;
- only active Requests tab fetches Requests data.

---

# 30. FOCUSED TESTS — REQUIRED

Add/adjust tests covering:

1. 12 Request status KPI cards render;
2. Total label `Всего заявок` equivalent;
3. no raw enum labels in visible UI;
4. status card click applies canonical status filter;
5. Total clears status;
6. page resets to 1 after search/filter;
7. selected KPI state;
8. URL state write;
9. URL state restore;
10. browser Back/Forward-compatible query state;
11. search debounce/server-side behavior;
12. Reset behavior;
13. period hidden when KPI parity unavailable;
14. no client-side KPI counting;
15. table and KPI use same exposed query scope;
16. RU/AZ/EN labels;
17. loading state;
18. no-results state;
19. error state;
20. responsive-safe composition contract where testable.

---

# 31. REGRESSION TESTS

Run:

```text
frontend typecheck
frontend build
focused Requests tests
Operations Center shell tests
frontend full suite
```

Also preserve accepted commerce regressions.

No backend change is expected unless a strictly required Request scope prerequisite is already part of accepted in-scope work.

If new backend implementation becomes necessary, STOP and report the gap instead of silently expanding UI-C1.2B.

---

# 32. BROWSER QUALIFICATION — MANDATORY

Browser test:

```text
/app/requests
```

At:

```text
1680
768
390
```

Verify:

- Operations Center title;
- Requests active tab;
- Total KPI correct;
- all 12 statuses visible;
- no raw enums;
- card grid visually coherent;
- selected KPI works;
- click updates filter/table;
- toolbar order correct;
- URL updates;
- reload preserves state;
- Back/Forward works;
- Reset works;
- no period control if KPI parity absent;
- table remains inside shared frame;
- no duplicate page title;
- no horizontal overflow;
- RU/AZ/EN render correctly.

---

# 33. BEFORE / AFTER EVIDENCE

Final report must explicitly show:

```text
BEFORE UI-C1.2B
- shell-wrapped Requests page
- transitional/partial KPI arrangement

AFTER UI-C1.2B
- canonical Requests registry composition
- Total
- 12 visible status cards
- canonical toolbar
- URL-state behavior
- table/pagination in shared frame
```

Provide screenshots or concrete browser evidence.

---

# 34. STATUS COVERAGE MATRIX — REQUIRED

Produce:

| RequestStatus | Visible KPI | Localized label | Filter param | Help ID | Count source |
|---|---:|---|---|---|---|
| NEW | YES | ... | `status=NEW` | ... | server |
| ... | ... | ... | ... | ... | ... |

All 12 must be YES.

Any NO:

```text
VERDICT B
```

---

# 35. KPI/TABLE SCOPE MATRIX — REQUIRED

Document every exposed Request filter:

| Filter | Table scope | KPI scope | Same backend semantics? | UI exposed? |
|---|---|---|---:|---:|
| Search | ... | ... | YES/NO | YES/NO |
| Status | ... | ... | YES/NO | YES/NO |
| customerId | ... | ... | YES/NO | YES/NO |
| partnerId | ... | ... | YES/NO | YES/NO |
| Date | ... | ... | YES/NO | YES/NO |

Rule:

```text
If Same backend semantics = NO
→ filter must not visually imply KPI parity.
```

For period specifically:

```text
if KPI parity = NO
→ period UI hidden
```

---

# 36. NON-SCOPE — HARD BLOCK

Do NOT implement:

```text
UI-C1.2C Orders lifecycle-flow
UI-C1.2D Bookings lifecycle-flow
UI-C1.2E general backend/read-model phase
UI-C1.2F Payments full integration
UI-C1.2G cross-domain final KPI semantic grouping
UI-C1.2H cross-domain Attention/period reconciliation
UI-C1.2J/K final closure
UI-C2
D8
pricing/commission redesign
new Request statuses
new Request state transitions
```

Important future visual requirement:

```text
Orders lifecycle cards will later use the supplied visual reference
as the exact visual source of truth for card shape/geometry/connectors.
```

Do NOT apply that Orders-specific card form to Requests.

---

# 37. AUTOMATIC VERDICT B CONDITIONS

Return VERDICT B if:

```text
- fewer than 12 Request status cards visible
- any canonical Request status remains filter-only
- raw enum labels visible
- Total becomes full-width hero
- Total label regresses to "Все заявки"
- status KPI click performs client-only filtering
- URL state not preserved
- date filter exposed while KPI remains global
- KPI counts come from current page rows
- toolbar order remains inconsistent
- Requests uses Orders lifecycle card geometry
- duplicate local page header returns
- browser evidence missing
- no visible UI change
- UI-C1.2C started
- UI-C2 started
- D8 started
```

---

# 38. GIT HARD CLOSURE

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

---

# 39. REQUIRED REPORT STRUCTURE

```text
1. Executive Summary
2. Accepted Baseline
3. Implementation Scope
4. RequestStatus Source of Truth
5. Total KPI
6. 12-Status KPI Composition
7. Status Card Visual System
8. KPI Click/Selection Contract
9. Attention
10. Search
11. Filters
12. Period / Date Scope
13. URL State
14. Toolbar
15. Reset
16. Request Table Preservation
17. Status Labels / Badges
18. KPI ↔ Table Scope
19. Export
20. Help
21. i18n
22. Loading / Empty / Error
23. Responsive
24. Accessibility
25. Security Preservation
26. Performance
27. Focused Tests
28. Regression Tests
29. Browser Qualification
30. Before / After Evidence
31. Status Coverage Matrix
32. KPI/Table Scope Matrix
33. Non-Scope Verification
34. Git Hard Closure
35. Final Verdict
36. TRUE NEXT
```

---

# 40. REQUIRED FINAL VERDICT

If all gates pass:

```text
VERDICT A — UI-C1.2B
REQUESTS REGISTRY MIGRATION
PRODUCTION IMPLEMENTATION ACCEPTED

D5 — ACCEPTED
D6 — ACCEPTED
D7 — ACCEPTED
UI-C1 — ACCEPTED
UI-C1.1 — ACCEPTED
UI-C1.2 — ACCEPTED
UI-C1.2A — ACCEPTED

UI-C1.2B — ACCEPTED

FINAL SHA:
<40-char SHA>

REQUESTS TOTAL KPI — CONFIRMED
REQUESTS STATUS KPI COVERAGE — 12/12
REQUESTS URL STATE — CONFIRMED
REQUESTS KPI/TABLE SCOPE — QUALIFIED
VISIBLE UI CHANGE — CONFIRMED

UI-C1.2C — NOT STARTED
UI-C2 — NOT STARTED
D8 — NOT STARTED

TRUE NEXT:
UI-C1.2C — ORDERS REGISTRY MIGRATION
```

If any P0 fails:

```text
VERDICT B — UI-C1.2B
REQUESTS REGISTRY MIGRATION FAILED

UI-C1.2B — NOT ACCEPTED
UI-C1.2C — NOT STARTED
UI-C2 — NOT STARTED
D8 — NOT STARTED
```

---

# 41. FINAL BINDING PRINCIPLE

```text
REQUESTS
= COMPLETE STATUS OVERVIEW
+ SERVER-AUTHORITATIVE FILTERING
+ URL-ADDRESSABLE REGISTRY STATE
+ KPI/TABLE SCOPE CONSISTENCY
```

```text
12 CANONICAL REQUEST STATUSES
→ 12 VISIBLE STATUS KPI CARDS
```

```text
REQUESTS STATUS GRID
≠
ORDERS LIFECYCLE FLOW
```

The Orders reference-specific card **shape, silhouette, geometry and connectors** are reserved for UI-C1.2C and must not be copied into Requests.
