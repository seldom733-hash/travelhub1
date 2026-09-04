# PHASE 3 — COMMERCE CENTER UI-C1.2C
## REMEDIATION R1 — KPI INTERACTION PARITY WITH REQUESTS

### IMPLEMENTATION PROMPT
### PRODUCTION CODE REQUIRED

---

## 0. EXECUTION MODE

Выполнить узкую remediation-итерацию:

```text
UI-C1.2C — REMEDIATION R1
KPI INTERACTION PARITY WITH REQUESTS
```

Текущий UI-C1.2C implementation checkpoint:

```text
0ae7dc9ba866f6c6a9238e04a9ccc4cf53a37dd2
```

Этот SHA является checkpoint, но **не accepted final SHA UI-C1.2C**, потому что текущая реализация Orders нарушает утверждённый interaction contract KPI-карточек.

Не начинать:

```text
UI-C1.2D
UI-C1.2E
UI-C2
D8
```

---

# 1. ROOT CAUSE / REJECTED BEHAVIOR

Текущая реализация Orders построена по модели:

```text
ACTIVE FILTER
     ↓
same server-side where
   ↙       ↘
KPI       TABLE
```

То есть выбранный `status` / `paymentStatus` входит одновременно:

- в scope таблицы;
- в scope `aggregates.lifecycle`;
- в scope `aggregates.payment`.

В результате клик по одной KPI-карточке может пересчитать / обнулить остальные KPI-карточки.

Это поведение **отклонено продуктовым решением**.

Текущий implementation report сам подтверждает, что `aggregates.lifecycle` и `aggregates.payment` вычисляются по тому же `where`, что и `items/total`.

Эту часть контракта необходимо исправить.

---

# 2. CANONICAL REFERENCE BEHAVIOR

## Requests is the source of truth

Binding rule:

```text
REQUESTS KPI INTERACTION
IS THE CANONICAL REFERENCE BEHAVIOR
FOR ORDERS AND BOOKINGS.
```

Нужно сделать Orders **ровно так, как уже работают Requests** с точки зрения выбора KPI-карточки.

Не изобретать новую механику.

Перед изменениями:

1. проинспектировать текущую реализацию `/app/requests`;
2. определить, как Requests:
   - хранят selected KPI;
   - формируют table filter;
   - получают KPI overview counts;
   - не пересчитывают остальные KPI после выбора;
   - сбрасывают KPI filter через Total;
   - синхронизируют URL;
3. переиспользовать тот же interaction contract для Orders.

---

# 3. CORE CONTRACT — P0

```text
KPI CARDS = STABLE OVERVIEW

CLICKED KPI CARD
→ becomes SELECTED
→ filters TABLE ONLY

NON-SELECTED KPI CARDS
→ retain their overview counts
→ do not become zero
→ do not disappear
→ do not get re-scoped by the selected KPI
→ do not get recomputed from filtered table rows
```

This is mandatory.

---

# 4. REQUIRED ORDERS BEHAVIOR

Example initial state:

```text
Всего заказов          646

NEW                      82
IN_PROCESSING           104
READY_FOR_BOOKING        65
SENT_TO_BOOKING          51
FULFILLED               210
CLOSED                   97
PROBLEM                  12
SUSPENDED                 8
...
```

Click:

```text
PROBLEM
```

Expected result:

```text
Всего заказов          646

NEW                      82
IN_PROCESSING           104
READY_FOR_BOOKING        65
SENT_TO_BOOKING          51
FULFILLED               210
CLOSED                   97
[ PROBLEM ]              12   ← SELECTED
SUSPENDED                 8
...
```

Table:

```text
TABLE
→ only rows matching status=PROBLEM
```

Forbidden:

```text
NEW                       0
IN_PROCESSING             0
READY_FOR_BOOKING         0
...
PROBLEM                  12
```

---

# 5. ONE ACTIVE KPI CARD AT A TIME

Mirror Requests behavior.

At any moment only one KPI-card selection is active.

Example:

```text
click PROBLEM
→ PROBLEM selected
→ table status=PROBLEM
```

Then:

```text
click CLOSED
→ PROBLEM deselected
→ CLOSED selected
→ table status=CLOSED
```

For Orders this rule applies across lifecycle and payment KPI groups.

Example:

```text
click FULFILLED
→ FULFILLED selected
→ table status=FULFILLED
```

Then:

```text
click PAID
→ FULFILLED deselected
→ PAID selected
→ lifecycle status filter removed
→ table paymentStatus=PAID
```

Do not combine two KPI-card selections unless Requests already do so.

---

# 6. TOTAL KPI CONTRACT

`Всего заказов` is the reset/default KPI state.

Required:

```text
click TOTAL
→ clear active KPI-card status/payment filter
→ Total becomes selected/default state
→ table returns to unfiltered KPI-card scope
→ other non-KPI global filters remain according to canonical Requests behavior
```

Do not zero or recompute the status/payment overview because Total is clicked.

---

# 7. SEPARATE TWO TYPES OF FILTERING

This remediation must explicitly distinguish:

## A. KPI-card table filter

Examples:

```text
status=PROBLEM
paymentStatus=PAID
```

This filter:

```text
FILTERS TABLE ONLY
DOES NOT RE-SCOPE KPI OVERVIEW COUNTS
```

## B. Global registry scope filters

Examples may include, if already canonical and supported:

```text
search
dateFrom
dateTo
customerId
partner/business scope
workspace/tenant scope
detector/deep-link scope
```

These may legitimately define the overall overview scope if that is the established Requests/registry contract.

Do **not** blindly remove all filtering from KPI counts.

The mandatory change is specifically:

```text
ACTIVE KPI CARD FILTER
MUST NOT RE-SCOPE THE OTHER KPI CARDS
```

---

# 8. REQUIRED QUERY MODEL

The implementation should conceptually behave like:

```text
GLOBAL / OVERVIEW SCOPE
(search, period, tenant, etc. as canonically supported)
               ↓
        OVERVIEW AGGREGATES
       ↙                 ↘
lifecycle KPI counts   payment KPI counts
       │                 │
       └──── stable ──────┘

              user clicks one KPI
                      ↓
             ACTIVE KPI FILTER
                      ↓
                 TABLE QUERY
                      ↓
              filtered table rows
```

Equivalent implementation approaches are allowed, provided the observable and server-authoritative result is correct.

---

# 9. SERVER AUTHORITY — NO CLIENT FABRICATION

The fix must **not** solve the problem by counting cards from cached browser data or current page rows.

Forbidden:

```text
items.filter(...)
items.reduce(...)
current-page row counting
fabricated zero/default aggregates
```

KPI overview counts remain server-authoritative.

If separate backend aggregate and table requests are necessary, that is acceptable.

If one endpoint can return both `overviewAggregates` and filtered rows using separate server-side scopes, that is also acceptable.

What matters:

```text
SERVER AUTHORITATIVE KPI COUNTS
+
TABLE-ONLY ACTIVE KPI FILTER
```

---

# 10. BACKEND/API CONTRACT AUDIT — REQUIRED

Before coding, inspect:

```text
GET /orders
listOrders service/query
aggregate lifecycle query
aggregate payment query
status/paymentStatus filter construction
Requests list/KPI implementation
```

Report current and target behavior.

If backend change is needed, keep it minimal and scoped to this remediation.

Do not weaken:

```text
RBAC
tenant/workspace scoping
D5 Order authority
D7 finance authority
audit
pagination
export
```

---

# 11. ORDERS LIFECYCLE KPI CARDS

All 12 remain visible:

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

Selecting any one:

```text
→ selected visual state
→ table status filter
→ all 11 other lifecycle cards retain overview count
→ all 4 payment cards retain overview count
```

---

# 12. ORDERS PAYMENT KPI CARDS

All 4 remain visible:

```text
UNPAID
PARTIALLY_PAID
PAID
REFUNDED
```

Selecting any one:

```text
→ selected visual state
→ table paymentStatus filter
→ lifecycle KPI overview counts remain unchanged
→ other payment KPI overview counts remain unchanged
```

Selecting a payment KPI must replace the previous lifecycle KPI selection, matching Requests-style one-active-card behavior adapted to Orders.

---

# 13. SELECTED VISUAL STATE

The clicked KPI must be unmistakably selected.

Preserve current accessible selected state if already correct:

```text
aria-pressed=true
```

Required:

- selected style visible;
- previous KPI deselected when another KPI is clicked;
- keyboard activation works;
- focus state remains visible;
- selected state survives URL reload if URL represents the active KPI;
- Back/Forward restores correct selected KPI.

Do not change KPI counts merely to indicate selection.

---

# 14. URL CONTRACT

Preserve canonical URL state.

Examples:

```text
/app/orders?status=PROBLEM
/app/orders?paymentStatus=PAID
```

Required:

```text
status KPI selected
→ status=<value>
→ paymentStatus removed
→ page=1
```

```text
payment KPI selected
→ paymentStatus=<value>
→ status removed
→ page=1
```

Total:

```text
→ status removed
→ paymentStatus removed
→ page normalized
```

Reload and Back/Forward must reproduce both:

- selected card;
- table filter.

But KPI overview counts must still remain stable.

---

# 15. SEARCH / PERIOD INTERACTION

Do not accidentally freeze KPI counts against legitimate global scope changes.

If Requests behavior and accepted architecture define search/period as overview-scope dimensions, then:

```text
search/date changes
→ overview KPI counts MAY refresh
→ table refreshes
```

But then selecting a KPI inside that global scope:

```text
→ table changes
→ overview cards remain fixed within that global scope
```

Example:

```text
date = September
→ KPI overview recalculated for September
→ click PROBLEM
→ table shows September PROBLEM rows
→ KPI cards continue showing all September status counts
```

This distinction must be tested.

---

# 16. DETECTOR / DEEP-LINK SCOPE

Current Orders implementation has backend detector filters such as:

```text
cancelledWithin
paymentFailed
pendingRefund
```

Audit how Requests/global scope semantics should apply.

If detector deep link defines a global registry scope, it may scope overview + table.

But once inside that scope, a clicked KPI must still behave as:

```text
selected KPI
→ filters table only
→ does not collapse other KPI counts inside detector scope
```

Do not silently break detector deep links.

---

# 17. EXPORT

Audit existing CSV/XLSX semantics.

Do not change export behavior unless required.

Document whether export follows:

```text
current TABLE filter scope
```

If active KPI is `PROBLEM`, export should follow the already canonical Orders export contract. Do not make KPI overview changes affect export independently.

---

# 18. DO NOT CHANGE VISUAL COMPOSITION

This is an interaction/data-scope remediation.

Do **not** redesign:

- lifecycle card appearance;
- card grouping;
- card sizes;
- arrows/connectors;
- toolbar composition;
- table columns;
- responsive layout;
- Operations Center shell.

Reference-card/photo similarity remains deferred.

---

# 19. REQUESTS — MUST REMAIN UNCHANGED

Requests is the accepted behavioral reference.

Do not modify Requests to match Orders.

Rule:

```text
ORDERS → MATCH REQUESTS
NOT
REQUESTS → MATCH ORDERS
```

Run Requests regression and prove its KPI behavior remains unchanged.

---

# 20. BOOKINGS — AUDIT ONLY, DO NOT IMPLEMENT YET

Bookings currently shows the same undesirable KPI-collapse pattern according to product observation.

For this remediation:

```text
DO NOT implement UI-C1.2D yet.
```

But inspect enough to document how the same Requests KPI interaction contract will be applied in UI-C1.2D.

Do not modify Booking production behavior unless strictly shared-code correction makes it unavoidable and is explicitly proven safe.

Preferred scope:

```text
Orders remediation now
Bookings remediation/migration in UI-C1.2D
```

---

# 21. FOCUSED TESTS — P0

Add/adjust tests that explicitly prove values do not collapse.

Minimum:

### Lifecycle selection

Initial server overview:

```text
NEW=82
IN_PROCESSING=104
PROBLEM=12
CLOSED=97
```

Click `PROBLEM`.

Assert:

```text
PROBLEM selected
table request contains status=PROBLEM
NEW still 82
IN_PROCESSING still 104
PROBLEM still 12
CLOSED still 97
```

### Change lifecycle selection

Click `CLOSED`.

Assert:

```text
PROBLEM deselected
CLOSED selected
table request status=CLOSED
overview counts unchanged
```

### Payment selection

Initial payment overview:

```text
UNPAID=200
PARTIALLY_PAID=30
PAID=390
REFUNDED=26
```

Click `PAID`.

Assert:

```text
PAID selected
status removed
paymentStatus=PAID
all lifecycle overview counts unchanged
all payment overview counts unchanged
```

### Total

Click Total.

Assert:

```text
status removed
paymentStatus removed
Total/default selected
overview values unchanged within same global scope
table returns to KPI-unfiltered scope
```

---

# 22. GLOBAL-SCOPE TEST

If period is exposed:

```text
dateFrom=A
dateTo=B
```

Server returns period overview.

Then click `PROBLEM`.

Assert:

```text
table = date scope + PROBLEM
KPI overview = full date scope
NOT date scope + PROBLEM
```

This test is mandatory if Orders period UI remains exposed.

---

# 23. URL / HISTORY TESTS

Required:

1. direct `/app/orders?status=PROBLEM`;
2. selected `PROBLEM`;
3. table filtered by `PROBLEM`;
4. other KPI counts remain overview counts;
5. direct `?paymentStatus=PAID`;
6. selected `PAID`;
7. lifecycle counts stable;
8. Back/Forward switches selected KPI correctly;
9. counts do not collapse during history navigation.

---

# 24. BROWSER QUALIFICATION — REQUIRED

Live browser:

```text
1680
768
390
```

At minimum demonstrate:

### Orders lifecycle
- capture initial KPI values;
- click one lifecycle card;
- prove selected state;
- prove table changes;
- prove at least several other lifecycle counts remain numerically identical;
- prove payment cards remain numerically identical.

### Orders payment
- click one payment card;
- prove selected state;
- prove lifecycle selection cleared;
- prove table changes;
- prove all card values stay stable.

### Total
- click Total;
- prove active KPI filter resets;
- prove table returns;
- prove overview values remain correct.

### Requests comparison
Side-by-side behavioral comparison or equivalent evidence showing Orders now follows Requests interaction semantics.

No photo/card geometry comparison required.

---

# 25. REQUIRED EVIDENCE MATRIX

Report:

| Scenario | Selected KPI | Table filter | Other lifecycle KPI counts | Payment KPI counts | Result |
|---|---|---|---|---|---|
| Initial | Total/default | none | baseline | baseline | PASS |
| click PROBLEM | PROBLEM | status=PROBLEM | unchanged | unchanged | PASS |
| click CLOSED | CLOSED | status=CLOSED | unchanged | unchanged | PASS |
| click PAID | PAID | paymentStatus=PAID | unchanged | unchanged | PASS |
| click Total | Total/default | none | unchanged | unchanged | PASS |

Use real test/browser values.

---

# 26. QUERY-SCOPE MATRIX — REQUIRED

Replace the old ambiguous `same where` matrix with an explicit two-scope matrix.

Example structure:

| Dimension | Overview KPI scope | Table scope | KPI click re-scopes overview? |
|---|---|---|---:|
| Workspace/Tenant | YES | YES | N/A |
| Search | document actual contract | document actual contract | NO |
| Date | document actual contract | document actual contract | NO |
| Detector | document actual contract | document actual contract | NO |
| Lifecycle KPI selection | EXCLUDED from overview | INCLUDED in table | NO |
| Payment KPI selection | EXCLUDED from overview | INCLUDED in table | NO |

The exact global-scope rows must reflect actual repository behavior.

P0 requirement:

```text
Lifecycle KPI selection → EXCLUDED from KPI overview scope
Payment KPI selection   → EXCLUDED from KPI overview scope
```

---

# 27. AUTOMATIC VERDICT B CONDITIONS

Return VERDICT B if any of the following occur:

```text
- click PROBLEM causes any unrelated KPI count to zero/recompute from status=PROBLEM scope
- click PAID causes lifecycle counts to collapse
- selected KPI filters KPI overview itself
- KPI counts are computed from current table/page rows
- multiple KPI cards stay selected contrary to Requests behavior
- Total does not clear active KPI-card filter
- URL state and selected state diverge
- reload loses selected state
- Back/Forward restores table filter but not selected card
- Requests behavior is changed/regressed
- D5 authority is weakened
- D7 finance authority is changed
- UI-C1.2D is started
- UI-C2 or D8 is started
```

---

# 28. REGRESSION

Run:

```text
frontend typecheck
frontend build
focused Orders KPI interaction tests
Orders registry tests
Requests registry tests
Operations Center shell tests
commerce detail tests
frontend full suite
```

If backend changed:

```text
backend typecheck/build
focused Orders backend tests
D5 relevant regressions
D7 relevant regressions
```

Document pre-existing failures separately.

---

# 29. GIT HARD CLOSURE

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
new canonical 40-char SHA
```

The old checkpoint:

```text
0ae7dc9ba866f6c6a9238e04a9ccc4cf53a37dd2
```

must not be reported as final accepted UI-C1.2C SHA after remediation.

---

# 30. REQUIRED REPORT STRUCTURE

```text
1. Executive Summary
2. Baseline / Rejected Behavior
3. Requests Reference Audit
4. Root Cause
5. Target Interaction Contract
6. Overview Scope vs Table Scope
7. Backend/API Changes
8. Frontend State Changes
9. Lifecycle KPI Behavior
10. Payment KPI Behavior
11. Total KPI Behavior
12. Selected Visual State
13. URL State
14. Search / Period Semantics
15. Detector / Deep-Link Semantics
16. Export Semantics
17. No Client-Side Counting Proof
18. Requests Regression
19. Bookings Forward Note
20. Focused Tests
21. Global-Scope Test
22. URL / History Tests
23. Browser Qualification
24. KPI Stability Evidence Matrix
25. Query-Scope Matrix
26. Security Preservation
27. Regression
28. Git Hard Closure
29. Final Verdict
30. TRUE NEXT
```

---

# 31. REQUIRED FINAL VERDICT

If all gates pass:

```text
VERDICT A — UI-C1.2C REMEDIATION R1
KPI INTERACTION PARITY WITH REQUESTS — ACCEPTED

D5 — ACCEPTED
D6 — ACCEPTED
D7 — ACCEPTED

UI-C1 — ACCEPTED
UI-C1.1 — ACCEPTED
UI-C1.2 — ACCEPTED
UI-C1.2A — ACCEPTED
UI-C1.2B — ACCEPTED

UI-C1.2C — ACCEPTED AFTER REMEDIATION R1

FINAL SHA:
<new 40-char SHA>

REQUESTS KPI BEHAVIOR REFERENCE — PASS
ORDERS KPI SELECTED STATE — PASS
ORDERS TABLE-ONLY KPI FILTERING — PASS
LIFECYCLE KPI COUNT STABILITY — PASS
PAYMENT KPI COUNT STABILITY — PASS
TOTAL RESET — PASS
URL / HISTORY — PASS
SERVER-AUTHORITATIVE OVERVIEW — PASS
NO CLIENT-SIDE KPI FABRICATION — PASS

REFERENCE-MATCH CARD DESIGN — DEFERRED

UI-C1.2D — NOT STARTED
UI-C2 — NOT STARTED
D8 — NOT STARTED

TRUE NEXT:
UI-C1.2D — BOOKINGS REGISTRY MIGRATION
WITH THE SAME REQUESTS KPI INTERACTION CONTRACT
```

If any P0 gate fails:

```text
VERDICT B — UI-C1.2C REMEDIATION R1
UI-C1.2C — NOT ACCEPTED

UI-C1.2D — NOT STARTED
UI-C2 — NOT STARTED
D8 — NOT STARTED
```

---

# 32. FINAL BINDING RULE

```text
REQUESTS IS THE KPI-CLICK BEHAVIORAL REFERENCE.

CLICKED CARD:
SELECTED + FILTERS TABLE ONLY.

OTHER CARDS:
STATIC WITHIN THE CURRENT OVERVIEW SCOPE.

ORDERS MUST BEHAVE EXACTLY THE SAME WAY.
```

Do not reinterpret this as “same filtered query for KPI and table”.

That previous implementation model is exactly what this remediation replaces.
