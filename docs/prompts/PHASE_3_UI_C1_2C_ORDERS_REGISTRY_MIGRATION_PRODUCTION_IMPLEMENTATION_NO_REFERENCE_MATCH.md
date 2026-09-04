# PHASE 3 — COMMERCE CENTER UI-C1.2C
## ORDERS REGISTRY MIGRATION — PRODUCTION IMPLEMENTATION

### IMPLEMENTATION PROMPT
### PRODUCTION CODE REQUIRED

---

## 0. EXECUTION MODE

Выполнить:

```text
UI-C1.2C — ORDERS REGISTRY MIGRATION
```

Accepted baseline:

```text
D5 — ACCEPTED
D6 — ACCEPTED
D7 — ACCEPTED
UI-C1 — ACCEPTED
UI-C1.1 — ACCEPTED
UI-C1.2 DESIGN — ACCEPTED
UI-C1.2A — ACCEPTED
UI-C1.2B — ACCEPTED

UI-C1.2B FINAL SHA:
ec85deb963d1ba9943ecb1ef890a66b45cda2460
```

UI-C2 and D8 remain NOT STARTED.

This is a production implementation stage for `/app/orders`.

---

## 1. SCOPE CORRECTION — REFERENCE CARD DESIGN DEFERRED

The previous requirement to reproduce lifecycle cards from a supplied screenshot/reference is **DEFERRED by product decision**.

For UI-C1.2C:

```text
DO NOT wait for a reference image.
DO NOT perform pixel/reference matching.
DO NOT require a screenshot-derived silhouette.
DO NOT require chevron/reference-specific corners or dimensions.
DO NOT fail the stage because the reference image is unavailable.
```

Use the existing TravelHub / Operations Center visual system.

This instruction supersedes the previous UI-C1.2C requirement that made the supplied screenshot a P0 visual source of truth.

Business semantics, status coverage, grouping, filtering, URL state, KPI/table scope and server authority remain mandatory.

---

## 2. OBJECTIVE

Migrate `/app/orders` into the canonical Operations Center Orders registry:

```text
ЦЕНТР ОПЕРАЦИЙ
[ Заявки ] [ Заказы ] [ Бронирования ] [ Платежи ]

[ Всего заказов ]

ЖИЗНЕННЫЙ ЦИКЛ
[ canonical lifecycle KPI cards ]

АЛЬТЕРНАТИВНЫЕ / REWORK STATES
[ canonical status cards ]

ИСКЛЮЧЕНИЯ
[ canonical exception cards ]

СТАТУС ОПЛАТЫ
[ OrderPaymentStatus cards ]

ATTENTION
[ only if real server-authoritative detector exists ]

TOOLBAR
TABLE
PAGINATION
```

Orders only. Do not start Bookings or Payments migration.

---

## 3. DESIGN PRINCIPLE

```text
UNIFIED OPERATIONS CENTER VISUAL SYSTEM
≠
IDENTICAL BUSINESS COMPOSITION
```

Requests and Orders share page geometry, typography, spacing, card family/tokens, toolbar/table grammar, interaction states and accessibility.

Orders may use different semantic grouping because it has lifecycle, rework, exception and payment dimensions.

No special screenshot-derived card geometry is required.

---

## 4. ORDERSTATUS SOURCE OF TRUTH

Use exactly the canonical `OrderStatus` enum:

```text
NEW
IN_PROCESSING
WAITING_FOR_DATA
READY_FOR_BOOKING
SENT_TO_BOOKING
PARTIALLY_FULFILLED
FULFILLED
READY_TO_CLOSE
CLOSED
CANCELLED
PROBLEM
SUSPENDED
```

No invented, removed, collapsed or renamed statuses.

---

## 5. STATE-MACHINE TRUTH

Canonical audited transitions:

```text
NEW → IN_PROCESSING

IN_PROCESSING → WAITING_FOR_DATA
WAITING_FOR_DATA → IN_PROCESSING

IN_PROCESSING | WAITING_FOR_DATA → READY_FOR_BOOKING

READY_FOR_BOOKING → SENT_TO_BOOKING

SENT_TO_BOOKING | PARTIALLY_FULFILLED → FULFILLED

FULFILLED | READY_TO_CLOSE → CLOSED

active → CANCELLED
active minus PROBLEM → PROBLEM
active minus SUSPENDED → SUSPENDED
```

`READY_TO_CLOSE` is a real enum/status but currently has no audited producer.

Therefore it must be visible, but the UI must not invent an incoming transition.

---

## 6. ALL-STATUS RULE — P0

```text
EVERY ACTUAL CANONICAL STATUS
→ ONE VISIBLE KPI CARD
```

Orders:

```text
12 OrderStatus
→ 12 visible cards
```

No real status may remain filter-only.

---

## 7. SEMANTIC KPI GROUPING

Do not make one flat endless grid.

### Primary lifecycle

```text
NEW
IN_PROCESSING
READY_FOR_BOOKING
SENT_TO_BOOKING
FULFILLED
CLOSED
```

These may be visually ordered as a lifecycle sequence.

Simple connectors/arrows are allowed only for truthful transitions.

No special photo/reference shape is required.

### Alternative / rework

```text
WAITING_FOR_DATA
PARTIALLY_FULFILLED
READY_TO_CLOSE
```

Keep visible without forcing them into a false linear path.

### Exceptions

```text
PROBLEM
SUSPENDED
CANCELLED
```

Separate semantic group. Do not use arrows that imply a canonical sequential transition.

---

## 8. TOTAL KPI

Canonical label:

```text
Всего заказов
```

with canonical AZ/EN equivalents.

Requirements:

- not full-width;
- approximately 15–20% larger than ordinary status KPI;
- same Operations Center family;
- click clears applicable Order status dimensions;
- page → 1;
- URL updates;
- server refreshes.

Do not use `Все заказы`.

---

## 9. ORDER PAYMENT STATUS — P0

Use actual canonical `OrderPaymentStatus`:

```text
UNPAID
PARTIALLY_PAID
PAID
REFUNDED
```

Rule:

```text
4 actual OrderPaymentStatus
→ 4 visible payment KPI cards
```

Payment status is a separate dimension from lifecycle.

---

## 10. PAYMENT KPI GROUP

Separate section:

```text
СТАТУС ОПЛАТЫ

[ UNPAID ]
[ PARTIALLY_PAID ]
[ PAID ]
[ REFUNDED ]
```

Visible text must use canonical localized labels, not raw enums.

Click:

```text
payment KPI
→ paymentStatus=<canonical value>
→ page=1
→ URL update
→ server-side table refresh
```

Selected state required.

---

## 11. REFUND KPI — DO NOT FABRICATE

Future refund statuses:

```text
REQUESTED
APPROVED
PROCESSED
FAILED
```

Order-level refund aggregates were staged behind later backend/read-model work.

Therefore:

```text
DO NOT fabricate Order refund counts.
DO NOT derive them from current page rows.
```

If real server-authoritative Order refund aggregates already exist, prove their source before using them. Otherwise defer this group explicitly.

---

## 12. ATTENTION

Render Attention only if a distinct server-authoritative actionable detector/query exists.

```text
ATTENTION = actionable queue
ATTENTION ≠ duplicated status card
```

If no distinct detector exists, omit the zone entirely.

---

## 13. KPI CLICK CONTRACT

Lifecycle/status card:

```text
click
→ status=<OrderStatus>
→ page=1
→ URL update
→ server-side fetch
```

Payment card:

```text
click
→ paymentStatus=<OrderPaymentStatus>
→ page=1
→ URL update
→ server-side fetch
```

Total should clear the status/payment dimensions required for the semantic meaning of `Всего заказов`. Document and test exact reset behavior.

No client-only filtering.

---

## 14. KPI ↔ TABLE SAME-SCOPE — P0

Orders must preserve same-scope aggregate behavior:

```text
ACTIVE FILTER / PERIOD
        ↓
SAME SERVER-SIDE QUERY SCOPE
      ↙               ↘
    KPI               TABLE
```

Lifecycle/payment aggregates and table must use the same relevant backend scope.

Do not regress Orders into global KPI + filtered table.

No KPI counts from current page rows.

If actual repository behavior contradicts this and parity cannot be preserved without backend expansion:

```text
STOP
REPORT GAP
DO NOT DISGUISE IT
```

---

## 15. SEARCH

Search first.

Required:

- server-side;
- debounce ~300–400 ms;
- Enter may commit immediately;
- clear → page 1;
- URL synchronized;
- loading does not block typing;
- no client-side row filtering.

---

## 16. FILTERS / TOOLBAR

Canonical order:

```text
[ Search ]
[ Lifecycle Status ]
[ Payment Status ]
[ Additional existing supported filters ]
[ From ][ To ] if period parity exists
[ Reset ]
[ CSV ]
[ XLSX ]
```

Use only actual server-supported filters.

Do not invent unsupported business dimensions.

---

## 17. PERIOD

Audit indicated Orders uses `createdAt` period semantics.

Verify repository truth before exposing controls.

If table and KPI aggregates share the same period scope:

```text
From / To
→ backend
→ KPI + table refresh under same scope
```

Use `[from,to)` if that is the actual backend contract and document timezone semantics.

Do not invent a Date Type selector when only `createdAt` is supported.

If parity does not exist, hide the period control.

---

## 18. URL STATE

Persist actual implemented dimensions, expected where supported:

```text
?search=
&status=
&paymentStatus=
&dateFrom=
&dateTo=
&page=
```

Requirements:

- direct URL;
- reload;
- Back/Forward;
- KPI click updates URL;
- filter changes → page 1;
- Reset normalizes URL;
- no update loop.

---

## 19. TABLE PRESERVATION

Preserve Orders business table semantics.

Do not redesign or weaken:

```text
D5 Order action authority
D7 financial authority
Order relations
pricing/commission semantics
server-owned lifecycle fields
tenant/workspace authority
```

The question of `TH-2026-...` vs `ORD-...` identifiers is explicitly outside this stage.

---

## 20. LABEL CONSISTENCY / i18n

For every `OrderStatus` and `OrderPaymentStatus`:

```text
KPI
filter
table badge
detail badge
Help
```

must use one canonical localized business label source.

RU/AZ/EN required.

No raw enum text visible.

---

## 21. MONEY / DATE

Use canonical locale-aware formatting.

Do not introduce raw Decimal serialization, manual currency concatenation or inconsistent date formatting.

D7 remains backend financial authority.

---

## 22. LOADING / EMPTY / ERROR

Use shared Operations Center states.

Loading:
- stable shell;
- no fake KPI zeroes.

Empty:
- distinguish no Orders vs no results for filters.

Error:
- localized user-safe message;
- Retry where appropriate;
- no backend stack trace.

---

## 23. ACCESSIBILITY

Interactive KPI cards:

- real accessible controls;
- keyboard reachable;
- visible focus;
- programmatic selected state;
- meaningful accessible name;
- decorative connectors hidden from assistive technology;
- no click-only divs.

---

## 24. RESPONSIVE

Mandatory:

```text
1680
768
390
```

Verify Total, lifecycle, rework, exceptions, payment group, toolbar, table and pagination.

Cards may wrap.

Contained horizontal scroll is acceptable where necessary.

No page-level horizontal overflow.

There is **no requirement** to reproduce the previously supplied screenshot/card geometry.

---

## 25. REQUESTS REGRESSION

UI-C1.2B accepted SHA:

```text
ec85deb963d1ba9943ecb1ef890a66b45cda2460
```

Verify `/app/requests` still preserves:

- `Всего заявок`;
- 12/12 RequestStatus;
- URL state;
- server-side filtering;
- date hidden while Requests KPI period parity is absent;
- RU/AZ/EN.

Do not modify Requests merely to simplify Orders.

---

## 26. PAYMENTS FUTURE CONTRACT — PRESERVE ONLY

Do not implement Payments registry in C.

Preserve future requirement:

```text
PaymentStatus:
PENDING
AUTHORIZED
CAPTURED
FAILED
CANCELLED
REFUNDED

RefundStatus:
REQUESTED
APPROVED
PROCESSED
FAILED
```

Also preserve the newly accepted future currency requirement:

```text
Payments Currency KPI/filter group
→ separate compact cards
→ server-side currency filter
→ actual supported/server-returned currencies only
→ not mixed with PaymentStatus
```

Implementation belongs to later Payments stages.

---

## 27. FOCUSED TESTS — REQUIRED

At minimum:

1. 12/12 OrderStatus visible;
2. canonical semantic grouping;
3. alternative/rework states visible;
4. exception states visible;
5. no false transition into `READY_TO_CLOSE`;
6. no false exception sequence;
7. 4/4 OrderPaymentStatus visible;
8. lifecycle KPI → server-side status;
9. payment KPI → server-side paymentStatus;
10. selected lifecycle KPI;
11. selected payment KPI;
12. Total reset;
13. page reset after search/filter;
14. URL write;
15. URL restore/direct URL;
16. Back/Forward;
17. server-side search;
18. period behavior;
19. KPI/table same scope;
20. no client KPI counting;
21. no raw enums;
22. RU/AZ/EN;
23. loading;
24. empty;
25. error;
26. responsive composition;
27. Requests regression;
28. D5/D7 preservation.

---

## 28. REGRESSION

Run:

```text
frontend typecheck
frontend build
focused Orders registry tests
Operations Center shell tests
Requests registry tests
commerce detail-system tests
frontend full suite
```

Run appropriate D5/D6/D7 regression coverage.

Prove any claimed pre-existing failure.

---

## 29. BROWSER QUALIFICATION

Mandatory `/app/orders` at:

```text
1680
768
390
```

Verify:

- Operations Center;
- Orders active;
- `Всего заказов`;
- 12/12 OrderStatus;
- lifecycle grouping;
- rework group;
- exception group;
- 4/4 OrderPaymentStatus;
- status KPI click;
- payment KPI click;
- URL;
- reload;
- Back/Forward;
- Search;
- Reset;
- period if exposed;
- server refresh;
- no raw enums;
- RU/AZ/EN;
- no page-level horizontal overflow.

**Reference-image comparison is NOT REQUIRED.**

---

## 30. STATUS COVERAGE MATRIX — REQUIRED

| OrderStatus | Visible KPI | Group | Localized label | Filter param | Count source |
|---|---:|---|---|---|---|
| NEW | YES | lifecycle | ... | ... | server |
| IN_PROCESSING | YES | lifecycle | ... | ... | server |
| WAITING_FOR_DATA | YES | rework | ... | ... | server |
| READY_FOR_BOOKING | YES | lifecycle | ... | ... | server |
| SENT_TO_BOOKING | YES | lifecycle | ... | ... | server |
| PARTIALLY_FULFILLED | YES | rework | ... | ... | server |
| FULFILLED | YES | lifecycle | ... | ... | server |
| READY_TO_CLOSE | YES | rework | ... | ... | server |
| CLOSED | YES | lifecycle | ... | ... | server |
| CANCELLED | YES | exception | ... | ... | server |
| PROBLEM | YES | exception | ... | ... | server |
| SUSPENDED | YES | exception | ... | ... | server |

All 12 = YES.

---

## 31. PAYMENT COVERAGE MATRIX — REQUIRED

| OrderPaymentStatus | Visible KPI | Localized label | Filter param | Count source |
|---|---:|---|---|---|
| UNPAID | YES | ... | ... | server |
| PARTIALLY_PAID | YES | ... | ... | server |
| PAID | YES | ... | ... | server |
| REFUNDED | YES | ... | ... | server |

All 4 = YES.

---

## 32. KPI/TABLE SCOPE MATRIX — REQUIRED

| Filter | Table scope | Lifecycle KPI scope | Payment KPI scope | Same backend semantics? | UI exposed? |
|---|---|---|---|---|---:|
| Search | ... | ... | ... | YES/NO | YES |
| Lifecycle status | ... | ... | ... | YES/NO | YES |
| Payment status | ... | ... | ... | YES/NO | YES |
| Date | ... | ... | ... | YES/NO | YES/NO |
| Other | ... | ... | ... | YES/NO | ... |

No exposed filter may falsely imply unsupported KPI parity.

---

## 33. BEFORE / AFTER EVIDENCE

Required:

```text
BEFORE
transitional Orders registry

AFTER
Total
→ lifecycle
→ alternative/rework
→ exceptions
→ payment status
→ toolbar
→ table
→ pagination
```

Must prove visible production UI change.

No screenshot-reference matching required.

---

## 34. SECURITY PRESERVATION

Preserve:

```text
server-side RBAC
workspace/tenant isolation
404-like cross-context behavior
D5 Order action authority
D6 Booking authority
D7 backend financial authority
audit immutability
```

UI hiding is not a security boundary.

---

## 35. NON-SCOPE — HARD BLOCK

Do NOT implement:

```text
reference-image/card-shape reproduction
pixel-perfect screenshot matching
UI-C1.2D Bookings migration
UI-C1.2E general backend/read-model stage
UI-C1.2F Payments migration
UI-C1.2G–K final cross-domain closure
UI-C2
D8
pricing/commission redesign
TH-* vs ORD-* identifier redesign
new statuses
new transitions
```

---

## 36. AUTOMATIC VERDICT B

VERDICT B if:

```text
- fewer than 12 OrderStatus cards
- any canonical OrderStatus remains filter-only
- fewer than 4 OrderPaymentStatus cards
- payment status mixed into lifecycle
- raw enums visible
- false transition shown
- READY_TO_CLOSE receives invented incoming transition
- client-side registry filtering replaces server filtering
- KPI counts come from current page rows
- exposed filter creates hidden KPI/table scope divergence
- Total is full-width hero
- URL state absent
- no visible production UI change
- D5 authority weakened
- D7 authority changed
- UI-C1.2D started
- UI-C2 started
- D8 started
```

Missing screenshot/reference matching is **NOT** a failure.

---

## 37. GIT HARD CLOSURE

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

## 38. REQUIRED REPORT

Report must include:

```text
1. Executive Summary
2. Accepted Baseline
3. Scope Correction — Reference Matching Deferred
4. Implementation Scope
5. OrderStatus Source of Truth
6. State-Machine Truth
7. Total KPI
8. KPI Semantic Composition
9. Primary Lifecycle
10. Alternative/Rework
11. Exceptions
12. No-False-Transition Proof
13. OrderPaymentStatus
14. Payment KPI Group
15. Refund Deferral
16. Attention
17. KPI Click Contract
18. KPI ↔ Table Scope
19. Search
20. Filters
21. Period
22. URL State
23. Toolbar / Reset
24. Table Preservation
25. Formatting / Labels / i18n
26. Loading / Empty / Error
27. Accessibility
28. Responsive
29. Focused Tests
30. Regression Tests
31. Browser Qualification
32. Status Coverage Matrix
33. Payment Coverage Matrix
34. KPI/Table Scope Matrix
35. Before / After Evidence
36. Security Preservation
37. Requests Regression
38. Non-Scope Verification
39. Git Hard Closure
40. Final Verdict
41. TRUE NEXT
```

---

## 39. FINAL VERDICT FORMAT

If all gates pass:

```text
VERDICT A — UI-C1.2C
ORDERS REGISTRY MIGRATION
PRODUCTION IMPLEMENTATION ACCEPTED

D5 — ACCEPTED
D6 — ACCEPTED
D7 — ACCEPTED

UI-C1 — ACCEPTED
UI-C1.1 — ACCEPTED
UI-C1.2 — ACCEPTED
UI-C1.2A — ACCEPTED
UI-C1.2B — ACCEPTED

UI-C1.2C — ACCEPTED

FINAL SHA:
<40-char SHA>

ORDER STATUS KPI COVERAGE — 12/12
ORDER PAYMENT KPI COVERAGE — 4/4
LIFECYCLE SEMANTICS — PASS
NO FALSE TRANSITIONS — PASS
KPI/TABLE SERVER SCOPE — PASS
VISIBLE UI CHANGE — CONFIRMED

REFERENCE-MATCH CARD DESIGN — DEFERRED BY PRODUCT DECISION

UI-C1.2D — NOT STARTED
UI-C2 — NOT STARTED
D8 — NOT STARTED

TRUE NEXT:
UI-C1.2D — BOOKINGS REGISTRY MIGRATION
```

If P0 fails:

```text
VERDICT B — UI-C1.2C
UI-C1.2C — NOT ACCEPTED
UI-C1.2D — NOT STARTED
UI-C2 — NOT STARTED
D8 — NOT STARTED
```

---

## 40. FINAL BINDING PRINCIPLE

```text
BUSINESS SEMANTICS FIRST.
REFERENCE CARD SHAPE DEFERRED.
```

Implement now:

```text
12/12 OrderStatus
truthful semantic grouping
4/4 OrderPaymentStatus
server-authoritative counts
server-side filtering
KPI/table scope integrity
URL state
RU/AZ/EN
responsive Operations Center UI
```

Do not block UI-C1.2C because the lifecycle-card reference image is unavailable.
