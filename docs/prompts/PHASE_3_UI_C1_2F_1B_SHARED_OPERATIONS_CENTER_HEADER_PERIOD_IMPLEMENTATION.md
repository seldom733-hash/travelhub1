# PHASE 3 — UI-C1.2F.1B — SHARED OPERATIONS CENTER HEADER PERIOD IMPLEMENTATION

## 0. Purpose

Implement the accepted **Shared Operations Center Header Period** for:

```text
Requests
Orders
Bookings
Payments
```

This is the first **visible UI stage** of UI-C1.2F.1.

The period becomes a shared temporal context owned by the Operations Center header and must synchronize:

```text
HEADER PERIOD
→ KPI OVERVIEW
→ TABLE
```

Do not implement table-header filtering yet.

Do not start:

```text
UI-C1.2F.1C
UI-C1.2G
UI-C2
D8
```

---

# 1. Canonical Baseline

Accepted stage:

```text
UI-C1.2F.1A — ACCEPTED AFTER REMEDIATION R1
FINAL SHA:
4f71acc60631e0a90825185a01d4574853412d83
```

Expected branch:

```text
master
```

Before any change:

```bash
git status --porcelain=v1
git rev-parse HEAD
git rev-parse origin/master
git log -5 --oneline --decorate
```

Required baseline:

```text
working tree = clean
HEAD == origin/master
HEAD == 4f71acc60631e0a90825185a01d4574853412d83
```

If not, STOP and report actual state.

---

# 2. Accepted Architecture — DO NOT REOPEN

Canonical Operations Center routes:

```text
/app/requests
/app/orders
/app/bookings
/app/payments
```

Canonical ownership:

```text
Operations Center
├── Requests
├── Orders
├── Bookings
└── Payments
```

Payments remains finance-domain owned but participates in Operations Center workflow context.

Canonical UI ownership:

```text
OPERATIONS CENTER HEADER
→ shared period/date range

REGISTRY TOOLBAR
→ search + reset + export + registry actions

TABLE HEADER
→ column-specific filters
```

This stage implements only the first two items related to period ownership:

```text
shared Header Period
remove duplicated local date controls
```

Do NOT implement table-header filters in this task.

---

# 3. Core Global Scope Contract

The period is a **GLOBAL SCOPE**.

Canonical rule:

```text
GLOBAL PERIOD
→ affects KPI
→ affects Table
```

This is different from table-only filters:

```text
status
paymentStatus
refundStatus
currencyCard
```

which remain:

```text
TABLE-ONLY
→ affect Table
→ do NOT re-scope KPI overview
```

Canonical formula:

```text
KPI QUERY SCOPE
= GLOBAL SCOPE

TABLE QUERY SCOPE
= GLOBAL SCOPE
+ TABLE-ONLY FILTERS
```

---

# 4. Header Period UI

Add a period/date-range control to the shared `OperationsCenterShell` header.

Target conceptual layout:

```text
┌──────────────────────────────────────────────────────────────┐
│ Breadcrumbs                                                  │
│ Центр операций                            [ Period control ]  │
├──────────────────────────────────────────────────────────────┤
│ [Заявки] [Заказы] [Бронирования] [Платежи]                   │
└──────────────────────────────────────────────────────────────┘
```

The exact existing design system must be used.

Do not introduce a visually unrelated custom control.

Use existing shared date input/calendar primitives where available.

---

# 5. URL Authority

The shared period must be URL-authoritative.

Canonical params:

```text
dateFrom
dateTo
```

The Header Period control reads from and writes to those params.

Do NOT create a second hidden period state that can diverge from the URL.

Target:

```text
URL
↕
Header Period
↕
active registry API query
↕
KPI + table
```

Browser reload must preserve period because the URL is authoritative.

---

# 6. Tab Navigation Persistence

Switching between:

```text
Requests
Orders
Bookings
Payments
```

must preserve only the shared period.

Example:

```text
/app/orders?dateFrom=2026-09-01&dateTo=2026-10-01
```

click:

```text
Bookings
```

target:

```text
/app/bookings?dateFrom=2026-09-01&dateTo=2026-10-01
```

Do NOT carry registry-specific filters.

On tab switch, reset:

```text
search
status
paymentStatus
refundStatus
currencyCard
page
selected KPI
registry-specific sort unless already explicitly shared by accepted architecture
```

Canonical target:

```text
KEEP:
dateFrom
dateTo

RESET:
everything registry-specific
```

---

# 7. Same Registry — Period Change Semantics

Changing the Header Period while remaining on the same registry is different from tab switching.

Required:

```text
KEEP:
compatible selected KPI / table-only filter

CHANGE:
KPI overview → recompute for new period
table → refetch for new period + preserved table-only filter
page → 1
```

Example:

```text
Orders
September
selected KPI = IN_PROCESSING
KPI IN_PROCESSING = 35
table = September + IN_PROCESSING

↓ change Header Period to October

selected KPI remains IN_PROCESSING
KPI IN_PROCESSING recomputes, e.g. 42
table = October + IN_PROCESSING
page = 1
```

Do NOT clear selected KPI merely because the period changed.

---

# 8. Requests Integration

Requests is now backend-ready after UI-C1.2F.1A.

Canonical backend state:

```text
Requests list:
dateFrom/dateTo → createdAt

Requests KPI:
dateFrom/dateTo → createdAt

boundary:
[from,to)

invalid date params:
HTTP 400 Bad Request

status:
table-only
```

Implement Requests frontend consumption of shared Header Period.

Required:

```text
Requests list call
→ includes dateFrom/dateTo from URL

Requests KPI call
→ includes same dateFrom/dateTo from URL
```

Do NOT add local Requests date inputs.

Requests toolbar must remain free of duplicated date controls.

---

# 9. Orders Integration

Current Orders registry already has local toolbar date controls.

Move period ownership to the shared Header.

Required:

```text
remove local Orders dateFrom input
remove local Orders dateTo input

Orders API:
continue receiving dateFrom/dateTo from URL

Orders KPI:
continue re-scoping under period

Orders table:
continue re-scoping under period
```

Preserve compatibility:

```text
from/to
```

aliases if currently accepted by existing code/deep links.

Canonical new URL generated by Operations Center must use:

```text
dateFrom
dateTo
```

Do not break old compatible links.

---

# 10. Bookings Integration

Remove local Booking date controls from registry toolbar.

Shared Header Period must feed:

```text
Bookings KPI
Bookings table
```

using existing canonical:

```text
createdAt
dateFrom/dateTo
```

Preserve selected Booking status across same-registry period changes.

Do not alter Booking state machine or D6 invariants.

---

# 11. Payments Integration

Remove local Payment date controls from registry toolbar.

Shared Header Period must feed:

```text
Payments KPI aggregates
Payments table
```

Preserve accepted payment semantics:

```text
dateField=createdAt
→ default Operations Center registry period

dateField=paidAt
→ existing analytics/deep-link compatibility
```

Do not silently force or rewrite an existing explicit:

```text
dateField=paidAt
```

deep link.

Preserve:

```text
currency
= GLOBAL/base scope

currencyCard
= TABLE-ONLY
```

Do not repurpose `currency`.

---

# 12. Registry Toolbar Target

After this stage, date controls must no longer appear in local toolbar for:

```text
Orders
Bookings
Payments
```

Requests never receives local date controls.

Conceptual target:

```text
Requests:
[ Search ] [ Reset ] [ CSV / actual supported exports ]

Orders:
[ Search ] [ Status ] [ Payment ] [ Reset ] [ CSV ] [ XLSX ]

Bookings:
[ Search ] [ Status ] [ Reset ] [ CSV ] [ XLSX ]

Payments:
[ Search ] [ Reset ] [ CSV ] [ XLSX ]
```

Important:

```text
status/payment filters remain where they currently are for now.
```

Their migration to table headers belongs to later stages.

Do NOT prematurely implement UI-C1.2F.1C+.

---

# 13. Registry Reset Semantics

Registry Reset must clear registry-specific state but preserve Header Period.

Required:

```text
clears:
search
status
paymentStatus
refundStatus
currencyCard
page → 1
other registry-specific filters

preserves:
dateFrom
dateTo
```

This applies independently to each registry.

Do not let existing Reset helpers accidentally erase the Header Period.

---

# 14. Header Period Clear

The Header Period control needs its own clear/reset behavior.

Required:

```text
Header Period clear
→ clears dateFrom/dateTo
→ preserves compatible selected KPI/table-only filter
→ page = 1
→ KPI recompute for default/unbounded period
→ table refetch for default/unbounded period + selected table-only filter
```

If the current product has a defined default period instead of unbounded scope, use the real existing contract and document it.

Do not invent a new default range silently.

---

# 15. Header Period Partial Range

Support the same practical partial-range semantics already accepted by backend contracts:

```text
dateFrom only
dateTo only
dateFrom + dateTo
```

The UI may represent an open-ended range appropriately.

Do not produce invalid dates or malformed query strings.

---

# 16. Validation Behavior

Do not duplicate backend validation logic in a way that changes API authority.

Frontend may prevent obviously malformed manual input, but backend remains authoritative.

For Requests, canonical invalid date API behavior after UI-C1.2F.1A is:

```text
HTTP 400 Bad Request
```

Preserve existing behavior for sibling registries.

Do not attempt to normalize all domains to another status code in this stage.

---

# 17. KPI Synchronization — Mandatory Browser Behavior

For all four registries prove:

```text
1. select a period
2. KPI values change to that period
3. table rows change to that period
```

Then:

```text
1. click a KPI status card
2. table narrows
3. KPI overview values remain stable
```

Then:

```text
1. keep KPI selected
2. change Header Period
3. selected KPI remains selected
4. all KPI counts recompute
5. table uses new period + selected KPI filter
6. page resets to 1
```

This interaction is mandatory.

---

# 18. Tab-Switch Browser Behavior

For each transition:

```text
Requests → Orders
Orders → Bookings
Bookings → Payments
Payments → Requests
```

prove:

```text
dateFrom/dateTo preserved
search reset
entity status/payment/refund/currencyCard reset
selected KPI reset to default/Total
page reset to 1
```

Also prove Back/Forward navigation restores the corresponding URL-derived state.

---

# 19. Do Not Preserve Wrong State Across Tabs

Explicitly prevent URLs such as:

```text
/app/bookings?paymentStatus=PAID
```

being generated merely because user came from Orders.

Or:

```text
/app/requests?currencyCard=USD
```

because user came from Payments.

Only shared period crosses registry boundaries.

---

# 20. No Duplicate Period Controls

After implementation there must be one visible period owner:

```text
Operations Center Header
```

No duplicate date controls in:

```text
Requests toolbar
Orders toolbar
Bookings toolbar
Payments toolbar
```

This must be verified visually at:

```text
1680px
768px
390px
```

---

# 21. Accessibility

Period control must be accessible.

Minimum:

```text
proper label / accessible name
keyboard reachable
clear focus state
calendar/popover keyboard accessible if used
screen-reader-readable selected range
clear action accessible
```

If two date fields are used, each needs an explicit accessible label.

Do not rely on placeholder text as the only label.

---

# 22. Responsive Contract

Verify at:

```text
1680px
768px
390px
```

Target:

```text
1680:
period inline in header where space permits

768:
period may wrap below title/header actions

390:
compact period trigger or vertically stacked controls
without horizontal page overflow
```

Do not shrink text or controls below usable sizes merely to force one line.

---

# 23. i18n

All new user-visible labels must use existing RU/AZ/EN localization architecture.

No raw translation keys.

No hardcoded Russian-only control text.

At minimum cover:

```text
Period
From
To
Clear period
Apply if explicit apply action exists
```

Use existing localization conventions.

---

# 24. Loading / Error States

Changing period triggers server refetch.

Do not produce stale mismatch where:

```text
new period visible in Header
old KPI values remain indefinitely
old table remains indefinitely
```

Use existing loading/transition patterns.

KPI and table should reconcile to the same current URL period after fetch completion.

Do not introduce client-side fake recalculation.

---

# 25. Server Authority

All filtering remains server-side.

Forbidden:

```text
load all rows
filter by date in browser
calculate KPI in frontend
derive KPI from current table page
```

Required:

```text
Header URL state
→ server query
→ server-authoritative KPI + table
```

---

# 26. Security

Preserve:

```text
RBAC
workspace/tenant isolation
PLATFORM/PARTNER context
404-like cross-context semantics where applicable
D5/D6/D7 invariants
Payment PCI/PII restrictions
```

Shared period state must not bypass authorization.

Do not expose inaccessible tab content through prefetch or hidden requests.

Only active domain should continue mounting/fetching as per accepted UI-C1.2A behavior.

---

# 27. Performance

Period changes should trigger only the active registry's required requests.

Do not fetch all four registries on every period change.

Required:

```text
active tab only
→ active KPI/list queries
```

Tab links may preserve period in href without mounting inactive registries.

---

# 28. Required Browser Scenarios

At minimum execute and record evidence for:

## Requests

```text
R1 Header period changes KPI + table
R2 selected status survives period change
R3 Reset preserves period
R4 clear period preserves selected status
R5 tab switch preserves period only
```

## Orders

```text
O1 local date controls removed
O2 Header period changes KPI + table
O3 lifecycle KPI selection survives period change
O4 payment KPI selection survives period change
O5 Reset preserves period
O6 from/to compatibility not broken
```

## Bookings

```text
B1 local date controls removed
B2 Header period changes KPI + table
B3 selected status survives period change
B4 Reset preserves period
```

## Payments

```text
P1 local date controls removed
P2 Header period changes KPI + table
P3 selected paymentStatus survives period change
P4 selected refundStatus survives period change
P5 selected currencyCard survives period change
P6 currency global vs currencyCard table-only distinction preserved
P7 dateField=paidAt compatibility preserved
```

---

# 29. Required URL / History Scenarios

Prove:

```text
direct load with dateFrom/dateTo
reload
Back
Forward
tab switch
same-tab period change
registry Reset
Header Period clear
```

Expected state must always derive from URL.

---

# 30. Regression

Run targeted and relevant regression:

```text
Requests UI-C1.2B behavior
Orders UI-C1.2C behavior
Bookings UI-C1.2D behavior
Payments UI-C1.2F behavior
UI-C1.2F.1A Requests KPI date scope
OperationsCenterShell tabs
legacy Payments redirect
permission-aware tabs
```

Also run:

```text
backend TSC
backend build
frontend TSC
frontend build
relevant frontend tests
```

Do not label failures “pre-existing” without baseline evidence.

---

# 31. Required Visual Evidence

Provide screenshots or equivalent browser evidence at:

```text
1680px
768px
390px
```

Show at least:

```text
Operations Center Header with Period
all four tabs
one registry with period applied
one registry toolbar without old date controls
mobile/compact behavior
```

Also include a browser proof that KPI values change when the Header Period changes.

---

# 32. Files Changed

Report actual files only.

Do not use speculative file counts.

Likely affected areas may include:

```text
OperationsCenterShell
Requests registry
Orders registry
Bookings registry
Payments registry
shared URL helpers
i18n
tests
```

but implementation must follow actual code.

---

# 33. Git Hard Closure

Before commit:

```bash
git status --porcelain=v1
git diff --check
git diff --stat
```

Commit only intended files.

Suggested commit:

```bash
git commit -m "feat: add shared operations center period"
git push origin master
```

Then prove:

```bash
git status --porcelain=v1
git rev-parse HEAD
git rev-parse origin/master
git log -3 --oneline --decorate
```

Required:

```text
git status → NO OUTPUT
HEAD == origin/master
```

Also prove accepted baseline ancestry:

```bash
git merge-base --is-ancestor 4f71acc60631e0a90825185a01d4574853412d83 HEAD
```

Expected exit code:

```text
0
```

---

# 34. Acceptance Criteria

UI-C1.2F.1B passes only if:

```text
1. shared Header Period is visibly implemented
2. Header Period is URL-authoritative
3. dateFrom/dateTo persist across registry tabs
4. entity-specific filters do not persist across tabs
5. Requests consumes period for KPI + table
6. Orders consumes period for KPI + table
7. Bookings consumes period for KPI + table
8. Payments consumes period for KPI + table
9. Orders local date controls removed
10. Bookings local date controls removed
11. Payments local date controls removed
12. Requests does not gain local date controls
13. period change recomputes KPI + table
14. selected KPI survives same-registry period change
15. page resets to 1 on period change
16. registry Reset preserves period
17. Header clear changes only period scope and resets page
18. Back/Forward/reload restore URL-derived state
19. only active registry fetches
20. RU/AZ/EN present
21. accessibility verified
22. responsive 1680/768/390 verified
23. security/RBAC preserved
24. regression passes
25. working tree clean
26. HEAD == origin/master
```

---

# 35. Required Final Report

The final report must include:

```text
A. Baseline
B. Current UI before change
C. Implementation
D. Header Period component behavior
E. URL/state contract
F. Requests evidence
G. Orders evidence
H. Bookings evidence
I. Payments evidence
J. KPI synchronization evidence
K. Tab-switch persistence evidence
L. Reset/clear evidence
M. Browser history evidence
N. Accessibility
O. Responsive evidence
P. Security
Q. Regression
R. Files changed
S. Git hard closure
T. Final verdict
```

---

# 36. Final Verdict Format

If successful:

```text
VERDICT A — UI-C1.2F.1B
SHARED OPERATIONS CENTER HEADER PERIOD — ACCEPTED

BASELINE SHA:
4f71acc60631e0a90825185a01d4574853412d83

FINAL SHA:
<actual>

HEADER PERIOD UI                  — PASS
URL AUTHORITY                     — PASS
PERIOD → KPI + TABLE              — PASS
REQUESTS PERIOD SYNC              — PASS
ORDERS PERIOD SYNC                — PASS
BOOKINGS PERIOD SYNC              — PASS
PAYMENTS PERIOD SYNC              — PASS

LOCAL DATE CONTROLS REMOVED       — PASS
REQUESTS NO LOCAL DATE CONTROL    — PASS

SAME-REGISTRY KPI PRESERVATION    — PASS
TAB SWITCH PERIOD PERSISTENCE     — PASS
TAB SWITCH LOCAL RESET            — PASS
REGISTRY RESET PRESERVES PERIOD   — PASS
HEADER CLEAR                      — PASS

BACK / FORWARD / RELOAD           — PASS
ACTIVE-DOMAIN FETCH ONLY          — PASS

RU/AZ/EN                          — PASS
ACCESSIBILITY                     — PASS
RESPONSIVE 1680/768/390           — PASS
SECURITY / RBAC                   — PASS
REGRESSION                        — PASS

WORKING TREE CLEAN                — PASS
HEAD == origin/master             — PASS
BASELINE ANCESTRY                 — PASS
GIT HARD CLOSURE                  — PASS

UI-C1.2F.1B — ACCEPTED

UI-C1.2F.1C — NOT STARTED
UI-C1.2G — NOT STARTED
UI-C2 — NOT STARTED
D8 — NOT STARTED

TRUE NEXT:
UI-C1.2F.1C — Shared TableHeaderFilter Component
```

If any mandatory item fails:

```text
VERDICT B — UI-C1.2F.1B
SHARED OPERATIONS CENTER HEADER PERIOD — NOT ACCEPTED

BLOCKERS:
- <exact blocker>

UI-C1.2F.1C — NOT STARTED
UI-C1.2G — NOT STARTED
UI-C2 — NOT STARTED
D8 — NOT STARTED
```

---

# 37. Stop Rule

Implement only UI-C1.2F.1B.

Do not start UI-C1.2F.1C automatically.

After implementation, tests, browser proof, commit/push, and clean Git closure:

```text
STOP
```

The next stage is authorized only after independent review of the UI-C1.2F.1B report.
