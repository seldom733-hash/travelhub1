# PHASE 3 — COMMERCE CENTER UI-C1.2D
## BOOKINGS REGISTRY MIGRATION
### PRODUCTION IMPLEMENTATION PROMPT

---

# 0. EXECUTION MODE

Выполнить следующий production-stage:

```text
UI-C1.2D — BOOKINGS REGISTRY MIGRATION
```

Accepted baseline:

```text
D5 — ACCEPTED
D6 — ACCEPTED
D7 — ACCEPTED

UI-C1 — ACCEPTED
UI-C1.1 — ACCEPTED
UI-C1.2 — ACCEPTED
UI-C1.2A — ACCEPTED
UI-C1.2B — ACCEPTED
UI-C1.2C — ACCEPTED AFTER REMEDIATION R1

BASELINE SHA:
3b12d16def817bf4c91124d3ff14adf692d7aa6c
```

Не начинать:

```text
UI-C1.2E
UI-C1.2F
UI-C2
D8
```

---

# 1. PRIMARY GOAL

Мигрировать `/app/bookings` в канонический Operations Center registry и привести его к тем же утверждённым принципам, что Requests и Orders:

```text
ЦЕНТР ОПЕРАЦИЙ
[ Заявки ] [ Заказы ] [ Бронирования ] [ Платежи ]

[ Всего бронирований ]

SEMANTIC KPI GROUPS
TOOLBAR
TABLE
PAGINATION
```

При этом:

```text
UNIFIED STRUCTURE
≠
IDENTICAL BUSINESS CONTENT
```

Bookings должен использовать общую visual/interaction grammar Operations Center, но сохранять собственную Booking state machine и D6 semantics.

---

# 2. P0 — REQUESTS KPI INTERACTION IS THE CANONICAL REFERENCE

Это обязательный контракт.

```text
REQUESTS KPI INTERACTION
IS THE CANONICAL REFERENCE
FOR BOOKINGS
```

Не повторять старую ошибку Orders.

Canonical behavior:

```text
KPI CARDS = STABLE OVERVIEW

CLICK ONE KPI CARD
        ↓
that card becomes SELECTED
        ↓
filters TABLE ONLY

ALL OTHER KPI CARDS
→ retain overview counts
→ do not zero
→ do not disappear
→ do not re-scope
→ do not get recomputed from filtered table rows
```

---

# 3. BASELINE AUDIT FINDING — MUST BE FIXED

На baseline SHA уже подтверждено:

```text
booking.service.ts
→ status groupBy uses the same where as items/count
```

Это приводит к collapse pattern:

```text
click CONFIRMED
→ where.status=CONFIRMED
→ other Booking KPI aggregates collapse / become 0
```

Такое поведение запрещено.

Также текущие detector filters:

```text
upcoming
overdue
```

влияют на `where.status`.

Для UI-C1.2D необходимо разделить:

```text
OVERVIEW KPI SCOPE
vs
TABLE SCOPE
```

---

# 4. REQUIRED QUERY MODEL

Canonical model:

```text
GLOBAL / OVERVIEW SCOPE
(search, period/date, tenant/workspace, orderId/channel,
 detector predicates, other canonical global filters)
               ↓
        BOOKING OVERVIEW
          13 KPI COUNTS
               │
               │ click one Booking KPI
               ↓
        ACTIVE KPI FILTER
               ↓
          TABLE QUERY
               ↓
       filtered Booking rows
```

Binding:

```text
ACTIVE BOOKING KPI STATUS
MUST BE EXCLUDED
FROM KPI OVERVIEW SCOPE

ACTIVE BOOKING KPI STATUS
MUST BE INCLUDED
IN TABLE SCOPE
```

---

# 5. SERVER AUTHORITY — NO CLIENT KPI FABRICATION

KPI counts remain server-authoritative.

Forbidden:

```text
currentPageItems.filter(...)
currentPageItems.reduce(...)
counting visible rows
fake zero values
client-side aggregate reconstruction
```

Acceptable patterns:

- separate Booking overview endpoint + Booking list endpoint;
- or one endpoint returning stable overview aggregates and table items computed with two server-side scopes;
- or reuse an `overviewBookingWhere(...)` helper analogous to accepted Orders R1.

Do not choose architecture by convenience. First inspect the actual repository and preserve current API compatibility where possible.

---

# 6. CANONICAL BOOKING STATUS COVERAGE — 13/13

Every actual canonical `BookingStatus` must have one visible KPI card.

Required 13 statuses:

```text
NEW
PREPARING_REQUEST
SENT_TO_SUPPLIER
AWAITING_CONFIRMATION
CONFIRMED
IN_SERVICE
COMPLETED
NEEDS_CLARIFICATION
SUPPLIER_REJECTED
CHANGE_REQUESTED
CANCELLATION_REQUESTED
CANCELLED
PROBLEM
```

Acceptance:

```text
13/13 visible
0 filter-only hidden canonical statuses
0 invented statuses
0 raw enum labels in UI
```

`PARTIALLY_CONFIRMED` DOES NOT EXIST and must not be introduced.

---

# 7. BOOKING STATE MACHINE — DO NOT INVENT TRANSITIONS

Canonical transitions:

```text
prepare:
NEW → PREPARING_REQUEST

send:
NEW / PREPARING_REQUEST → SENT_TO_SUPPLIER

requestClarification:
SENT_TO_SUPPLIER / AWAITING_CONFIRMATION
→ NEEDS_CLARIFICATION

resume:
NEEDS_CLARIFICATION → SENT_TO_SUPPLIER

confirm:
SENT_TO_SUPPLIER / AWAITING_CONFIRMATION
→ CONFIRMED

reject:
SENT_TO_SUPPLIER / AWAITING_CONFIRMATION
→ SUPPLIER_REJECTED

service:
CONFIRMED → IN_SERVICE

requestChange:
CONFIRMED / IN_SERVICE → CHANGE_REQUESTED

resolveChange:
CHANGE_REQUESTED → CONFIRMED

requestCancellation:
CONFIRMED / IN_SERVICE / CHANGE_REQUESTED / NEEDS_CLARIFICATION
→ CANCELLATION_REQUESTED

complete:
IN_SERVICE → COMPLETED

cancel:
ACTIVE → CANCELLED

problem:
ACTIVE except PROBLEM → PROBLEM
```

No visual arrow / connector may imply a transition that does not exist.

---

# 8. SPECIAL RULE — AWAITING_CONFIRMATION

`AWAITING_CONFIRMATION` is a real canonical enum/status and therefore must have a visible KPI card.

But current state-machine audit shows no current producer into it.

Therefore:

```text
AWAITING_CONFIRMATION
→ visible KPI card
→ filterable
→ localized
→ Help-ready
→ NO FALSE INCOMING ARROW
```

Do not remove it because it currently has no producer.

Do not fabricate a producer only to make the diagram look cleaner.

---

# 9. SEMANTIC KPI GROUPING

Do not render one flat endless row if the existing Operations Center semantic grouping can be reused truthfully.

Recommended truthful grouping:

## 9.1 Primary / lifecycle flow

```text
NEW
→ PREPARING_REQUEST
→ SENT_TO_SUPPLIER

CONFIRMED
→ IN_SERVICE
→ COMPLETED
```

These may visually read as lifecycle sequences only where transitions are real.

## 9.2 Adjacent / waiting

```text
AWAITING_CONFIRMATION
```

Visible, but no false incoming connector.

## 9.3 Decision / change / operational exception

```text
NEEDS_CLARIFICATION
CHANGE_REQUESTED
CANCELLATION_REQUESTED
PROBLEM
```

## 9.4 Terminal exception outcomes

```text
SUPPLIER_REJECTED
CANCELLED
```

Exact visual grouping may be adjusted after inspecting current shared components, but semantic truth is mandatory.

---

# 10. TOTAL KPI

Use:

```text
Всего бронирований
```

with corresponding canonical AZ/EN localization.

Do not use:

```text
Все бронирования
```

Total visual treatment must remain aligned with accepted Operations Center grammar:

```text
~15–20% larger than ordinary KPI card
NOT full-width hero
same visual language
```

Total value must be the **overview total**, not the table-filtered pagination total.

---

# 11. ONE ACTIVE KPI CARD AT A TIME

Exactly like Requests.

Example:

```text
click CONFIRMED
→ CONFIRMED selected
→ table status=CONFIRMED
```

Then:

```text
click COMPLETED
→ CONFIRMED deselected
→ COMPLETED selected
→ table status=COMPLETED
```

Only one Booking KPI status card may remain selected at a time.

---

# 12. TOTAL RESET BEHAVIOR

Click Total:

```text
→ clear active Booking KPI status filter
→ Total becomes selected/default
→ table returns to KPI-unfiltered Booking scope
→ overview counts remain stable inside current global scope
```

Other non-KPI global filters remain according to actual canonical registry behavior.

---

# 13. SELECTED STATE / ACCESSIBILITY

Selected KPI must be visually obvious and accessible.

Required:

```text
aria-pressed=true
```

or equivalent existing accepted shared pattern.

Must support:

- mouse click;
- keyboard activation;
- focus-visible;
- one selected card;
- reload restoration;
- Back/Forward restoration;
- URL state parity.

---

# 14. URL CONTRACT

Audit existing Booking registry query params first.

Target behavior should preserve canonical route:

```text
/app/bookings
```

Status card click:

```text
?status=CONFIRMED
```

or actual existing canonical param if different.

Required semantics:

```text
click status card
→ URL updated
→ page=1
→ selected state updated
→ server table refresh
→ KPI overview remains stable
```

Total:

```text
→ status removed
→ page normalized
```

Do not invent incompatible URL params if current Booking registry already has a canonical contract.

---

# 15. DETECTOR FILTERS — UPCOMING / OVERDUE

This is P0 because current audit found that detector filters interact with `where.status`.

Treat:

```text
upcoming
overdue
```

as GLOBAL REGISTRY SCOPE / detector predicates, not KPI-card selections.

Required conceptual behavior:

```text
DETECTOR SCOPE
→ may scope overview
→ scopes table

THEN click one Booking KPI
→ table additionally filtered by clicked status
→ other Booking KPI values remain stable within detector overview
```

Do not let KPI status selection remove or corrupt the detector scope.

Do not let detector implementation accidentally collapse all status counts by injecting a BookingStatus predicate into the overview.

If detector semantics inherently require status constraints, preserve detector semantics through a dedicated overview-safe predicate/query representation rather than naively deleting meaningful detector logic.

Document the exact implementation.

---

# 16. SEARCH / DATE / ORDER / CHANNEL SCOPE

Audit actual Booking backend and frontend support before changing UI.

Potential existing global scope dimensions may include:

```text
search
date range
orderId
channel / acquisitionSource / business context
workspace / tenant
```

Do not invent unsupported filters.

If a filter is already canonical and server-supported, preserve it.

Global filters may legitimately refresh both:

```text
KPI overview
+
table
```

But:

```text
KPI CARD CLICK
MUST NOT
RE-SCOPE KPI COUNTS
```

---

# 17. PERIOD / DATE SEMANTICS

Before exposing or changing date controls, inspect which Booking date fields are actually supported server-side.

Potentially relevant business dates include:

```text
createdAt
service date/time
```

Do not assume both are filterable.

If period control already exists and is server-authoritative:

```text
period change
→ overview refresh
→ table refresh
```

Then:

```text
click CONFIRMED
→ table = period + CONFIRMED
→ overview = full period overview
```

This distinction must be tested.

---

# 18. TOOLBAR GRAMMAR

Align with Operations Center registry grammar:

```text
[ Search ]
[ Primary status filter if still needed ]
[ Additional supported filters ]
[ Date range if actually supported ]
[ Reset if applicable ]
[ CSV ]
[ XLSX ]
```

Search should remain first.

Do not add controls merely because Orders has them.

Bookings business/filter capabilities remain source-of-truth-driven.

---

# 19. CARD LABELS / LOCALIZATION

All Booking KPI labels must come from the same canonical localization source used for Booking status badges/filters.

No divergent names.

No raw enum strings in production UI.

Required:

```text
RU
AZ
EN
```

Total label also localized consistently.

---

# 20. TABLE CONSISTENCY

Preserve unified Operations Center table grammar:

- headers;
- density;
- cell padding;
- status placement;
- reference style;
- dates;
- hover;
- empty state;
- pagination;
- responsive behavior.

Do not redesign entity-specific columns merely for visual symmetry.

Booking table business content remains Booking-specific.

---

# 21. D6 PRESERVATION — P0

UI-C1.2D must not weaken accepted D6 behavior.

Preserve:

```text
Booking PATCH accepts only { action }
server-owned forged fields → 422
availableActions remains server-authoritative
atomic mutation + audit
optimistic concurrency
cross-context isolation
full-page Booking detail semantics
```

Do not move Booking action authority into frontend state.

Do not change D6 state-machine authority to make registry UI easier.

---

# 22. D7 FINANCIAL AUTHORITY PRESERVATION

Booking finance remains derived from linked Order canonical truth under D7.

Do not introduce independent Booking financial calculations.

Do not recalculate:

```text
dueAmount
refundableAmount
payment truth
```

inside Booking registry.

If financial fields are displayed, preserve accepted D7 authority.

---

# 23. SECURITY PRESERVATION

Must preserve:

```text
server-side RBAC
workspace/tenant isolation
cross-context 404-like behavior
no existence leakage
permission-aware navigation
audit immutability
```

Client hidden cards/tabs are never a security boundary.

Do not trust client-provided tenant/partner IDs.

---

# 24. NO REQUESTS / ORDERS REGRESSION

Requests remains behavioral reference.

Orders R1 is now accepted.

Required:

```text
REQUESTS — unchanged
ORDERS — unchanged
BOOKINGS — migrated to the same KPI interaction contract
```

Do not "normalize" Requests or Orders back to same-filtered-where behavior.

---

# 25. REQUIRED BACKEND AUDIT

Before coding, inspect:

```text
Booking Prisma enum/entity
booking.service.ts
booking controller/query DTO
booking list endpoint
status groupBy/aggregate logic
pagination total
upcoming detector
overdue detector
date filters
search
orderId/channel scope
workspace/tenant scoping
export
Booking registry frontend page
Booking status shared/i18n definitions
shared Operations Center KPI components
```

Produce before/after scope notes.

---

# 26. REQUIRED OVERVIEW HELPER CONTRACT

If using a helper analogous to Orders, it must be Booking-specific and semantically correct.

Naive target:

```text
overviewBookingWhere(tableWhere)
→ remove ACTIVE KPI status dimension
→ retain all global scope dimensions
```

But detector semantics require care.

Do not simply delete `status` if detector predicates are represented via `where.status` and deleting it would destroy `upcoming/overdue` global scope semantics.

Instead, refactor detector/global predicates so the overview retains their intended scope while excluding only the explicit KPI-card selection.

The report must prove this distinction.

---

# 27. FOCUSED KPI STABILITY TESTS — P0

Use real mocked/server aggregate values.

Example baseline:

```text
NEW                    41
PREPARING_REQUEST      18
SENT_TO_SUPPLIER       32
AWAITING_CONFIRMATION   7
CONFIRMED              64
IN_SERVICE             21
COMPLETED             119
NEEDS_CLARIFICATION     9
SUPPLIER_REJECTED       6
CHANGE_REQUESTED        8
CANCELLATION_REQUESTED  5
CANCELLED              13
PROBLEM                 4
```

### Click CONFIRMED

Assert:

```text
CONFIRMED selected
table request contains status=CONFIRMED

all 13 KPI counts remain identical to overview
Total remains overview total
```

### Switch to PROBLEM

Assert:

```text
CONFIRMED deselected
PROBLEM selected
table request status=PROBLEM
all overview counts unchanged
```

### Click Total

Assert:

```text
status removed
Total selected/default
table returns to KPI-unfiltered scope
overview unchanged
```

---

# 28. DETECTOR SCOPE TESTS — P0

For `upcoming`:

```text
upcoming scope active
→ server returns overview counts for upcoming scope
→ click CONFIRMED
→ table = upcoming + CONFIRMED
→ overview remains the full upcoming overview
```

For `overdue`:

```text
overdue scope active
→ click PROBLEM
→ table = overdue + PROBLEM
→ other KPI cards keep overdue overview counts
```

No collapse.

---

# 29. AWAITING_CONFIRMATION TEST

Required:

```text
AWAITING_CONFIRMATION KPI visible
localized
clickable
selected state works
table filters correctly
other KPI counts unchanged
```

And lifecycle composition must prove:

```text
NO FALSE INCOMING ARROW
```

---

# 30. 13/13 COVERAGE MATRIX — REQUIRED

Report:

| BookingStatus | Visible KPI | Semantic group | Localized RU label | Filter param | Server count source |
|---|---:|---|---|---|---|
| NEW | YES | ... | ... | status=NEW | server |
| ... | ... | ... | ... | ... | ... |
| PROBLEM | YES | ... | ... | status=PROBLEM | server |

All 13 rows required.

---

# 31. KPI STABILITY EVIDENCE MATRIX — REQUIRED

Report with real values:

| Scenario | Selected KPI | Table filter | Other KPI counts | Total | Result |
|---|---|---|---|---|---|
| Initial | Total/default | none | baseline | overview | PASS |
| click CONFIRMED | CONFIRMED | status=CONFIRMED | unchanged | unchanged | PASS |
| click PROBLEM | PROBLEM | status=PROBLEM | unchanged | unchanged | PASS |
| click AWAITING_CONFIRMATION | AWAITING_CONFIRMATION | status=... | unchanged | unchanged | PASS |
| click Total | Total/default | none | unchanged | unchanged | PASS |

---

# 32. QUERY-SCOPE MATRIX — REQUIRED

Must explicitly separate overview and table.

Minimum structure:

| Dimension | Overview KPI scope | Table scope | KPI click re-scopes overview? |
|---|---|---|---:|
| Workspace/Tenant | YES | YES | N/A |
| Search | actual | actual | NO |
| Date/Period | actual | actual | NO |
| orderId/channel | actual | actual | NO |
| upcoming detector | YES | YES | NO |
| overdue detector | YES | YES | NO |
| Booking KPI selection (`status`) | EXCLUDED | INCLUDED | NO |

Do not report a false generic "same where" PASS.

P0 acceptance:

```text
Booking KPI selection (`status`)
→ EXCLUDED from overview KPI scope
→ INCLUDED in table scope
```

---

# 33. BROWSER QUALIFICATION — REQUIRED

Live browser at:

```text
1680
768
390
```

Verify:

- Operations Center shell/tabs;
- Total size/label;
- 13/13 KPI cards;
- truthful semantic grouping;
- no false AWAITING_CONFIRMATION arrow;
- selected card state;
- table changes;
- all other KPI values remain stable;
- Total reset;
- URL/reload;
- Back/Forward;
- search/filter coexistence;
- upcoming/overdue if UI/deep-link accessible;
- RU/AZ/EN;
- responsive layout;
- no horizontal overflow.

Capture before/after evidence.

---

# 34. REGRESSION

Run at minimum:

```text
frontend typecheck
frontend build
Bookings registry focused tests
Requests registry tests
Orders registry tests
Operations Center shell tests
commerce detail-system tests
frontend full suite
```

If backend changes:

```text
backend typecheck
backend build
Booking module focused tests
D6 relevant regression tests
D7 relevant regression tests
```

Document known pre-existing failures separately and prove they are unchanged.

---

# 35. EXPORT

Audit existing Booking CSV/XLSX export.

Do not invent export if not already part of accepted scope.

If present, preserve server-side table-filter semantics and ensure active KPI filter follows the current table/export contract.

Do not derive export data from client-visible rows.

---

# 36. OUT OF SCOPE

Do not implement:

```text
Payments backend/read-model prerequisites
Payments registry
currency KPI cards
refund KPI groups
Help full implementation beyond required existing hooks
Commerce Relation Chain
D8 Global Temporal Visibility
reference-image card geometry matching
pricing/commission redesign
Booking detail redesign
```

Reference-match card design remains deferred.

---

# 37. AUTOMATIC VERDICT B CONDITIONS

Return VERDICT B if any occurs:

```text
- fewer than 13 canonical BookingStatus cards are visible
- any invented BookingStatus appears
- PARTIALLY_CONFIRMED is introduced
- AWAITING_CONFIRMATION is hidden
- false incoming arrow to AWAITING_CONFIRMATION is shown
- clicking a Booking KPI re-scopes/zeros other KPI cards
- Total uses table-filtered pagination total
- KPI counts come from current page rows
- more than one Booking KPI card stays selected
- selected state and URL diverge
- Back/Forward restores table filter but not selected KPI
- upcoming/overdue global scope is accidentally deleted from overview
- detector scope collapses unrelated KPI cards
- Requests behavior regresses
- Orders R1 behavior regresses
- D6 server authority is weakened
- D7 finance authority is weakened
- tenant/workspace isolation changes
- UI-C1.2E or later stage is started
- UI-C2 or D8 is started
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
new canonical 40-char SHA
```

Baseline:

```text
3b12d16def817bf4c91124d3ff14adf692d7aa6c
```

must remain traceable as the accepted UI-C1.2C baseline, not be reused as UI-C1.2D final SHA.

---

# 39. REQUIRED REPORT STRUCTURE

```text
1. Executive Summary
2. Accepted Baseline
3. Current Bookings Audit
4. Booking State Machine Verification
5. 13/13 Status Coverage
6. AWAITING_CONFIRMATION Special Case
7. Target Registry Composition
8. KPI Semantic Grouping
9. Requests Behavioral Reference
10. Root Cause of KPI Collapse
11. Overview Scope vs Table Scope
12. Detector Semantics — upcoming/overdue
13. Backend/API Changes
14. Frontend Changes
15. Total KPI
16. Selected State
17. URL / History
18. Search / Filter / Period Semantics
19. Localization RU/AZ/EN
20. Table / Pagination / Export
21. D6 Preservation
22. D7 Preservation
23. Security Preservation
24. Requests Regression
25. Orders Regression
26. Focused Tests
27. Detector Scope Tests
28. AWAITING_CONFIRMATION Test
29. 13/13 Coverage Matrix
30. KPI Stability Evidence Matrix
31. Query-Scope Matrix
32. Browser Qualification
33. Responsive Qualification
34. Regression
35. Git Hard Closure
36. Final Verdict
37. TRUE NEXT
```

---

# 40. REQUIRED FINAL VERDICT

If all gates pass:

```text
VERDICT A — UI-C1.2D
BOOKINGS REGISTRY MIGRATION — ACCEPTED

D5 — ACCEPTED
D6 — ACCEPTED
D7 — ACCEPTED

UI-C1 — ACCEPTED
UI-C1.1 — ACCEPTED
UI-C1.2 — ACCEPTED
UI-C1.2A — ACCEPTED
UI-C1.2B — ACCEPTED
UI-C1.2C — ACCEPTED AFTER REMEDIATION R1
UI-C1.2D — ACCEPTED

FINAL SHA:
<new 40-char SHA>

BOOKING STATUS KPI COVERAGE — 13/13 PASS
REQUESTS KPI BEHAVIOR PARITY — PASS
BOOKINGS KPI SELECTED STATE — PASS
BOOKINGS TABLE-ONLY KPI FILTERING — PASS
BOOKINGS KPI COUNT STABILITY — PASS
TOTAL RESET — PASS
UPCOMING DETECTOR SCOPE — PASS
OVERDUE DETECTOR SCOPE — PASS
AWAITING_CONFIRMATION VISIBILITY — PASS
NO FALSE AWAITING_CONFIRMATION TRANSITION — PASS
URL / HISTORY — PASS
SERVER-AUTHORITATIVE OVERVIEW — PASS
NO CLIENT-SIDE KPI FABRICATION — PASS
D6 PRESERVATION — PASS
D7 PRESERVATION — PASS
SECURITY PRESERVATION — PASS

REFERENCE-MATCH CARD DESIGN — DEFERRED

UI-C1.2E — NOT STARTED
UI-C2 — NOT STARTED
D8 — NOT STARTED

TRUE NEXT:
UI-C1.2E — PAYMENTS BACKEND / READ-MODEL PREREQUISITES
```

If any P0 gate fails:

```text
VERDICT B — UI-C1.2D
BOOKINGS REGISTRY MIGRATION — NOT ACCEPTED

UI-C1.2E — NOT STARTED
UI-C2 — NOT STARTED
D8 — NOT STARTED
```

---

# 41. FINAL BINDING RULE

```text
REQUESTS = KPI INTERACTION REFERENCE

BOOKINGS MUST MATCH IT:

CLICKED BOOKING KPI
→ SELECTED
→ FILTERS TABLE ONLY

OTHER BOOKING KPI CARDS
→ STATIC WITHIN CURRENT OVERVIEW SCOPE

13/13 BOOKING STATUSES
→ ALL VISIBLE

AWAITING_CONFIRMATION
→ VISIBLE
→ NO FALSE INCOMING TRANSITION
```

Do not reinterpret this as "same filtered where for KPI and table".

That model is explicitly rejected.
