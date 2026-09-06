# PHASE 3 — UI-C1.2F.1F — IMPLEMENTATION
## Payments Table-Header Filtering + Sorting Alignment

---

# 0. Purpose

Implement the accepted Operations Center table-header filtering pattern for:

```text
/app/payments
```

This stage aligns Payments with the already accepted Requests, Orders, and Bookings registry interaction model:

```text
KPI          → quick business slice
Toolbar      → global registry actions/context
Table Header → column-specific filter
```

Canonical header semantics:

```text
COLUMN LABEL / SORT ICON → SORTING
FILTER ICON / DROPDOWN   → COLUMN FILTER
```

Both sorting and filtering must remain:

```text
server-side
URL-authoritative
reload-compatible
popstate-compatible
```

---

# 1. Baseline

Current repository baseline:

```text
HEAD / origin/master:
2db72e6c8e6e419b6c93df20d6ead5217b5cc6db
```

Accepted stages:

```text
UI-C1.2F.1A — ACCEPTED
UI-C1.2F.1B — ACCEPTED
UI-C1.2F.1C — ACCEPTED
UI-C1.2F.1D — ACCEPTED
UI-C1.2F.1E — ACCEPTED
UI-C1.2F.1G — ACCEPTED
```

Current stage:

```text
UI-C1.2F.1F — THIS STAGE
```

Do not reopen accepted stages unless a genuine regression is reproduced.

---

# 2. Payments Domain Facts — Preserve Exactly

Canonical endpoint:

```text
GET /finance/payments
```

Permission:

```text
finance.payment.read
```

Canonical PaymentStatus values — exactly 6:

```text
PENDING
AUTHORIZED
CAPTURED
FAILED
CANCELLED
REFUNDED
```

Canonical RefundStatus values — exactly 4:

```text
REQUESTED
APPROVED
PROCESSED
FAILED
```

Important current truth:

```text
PaymentStatus.AUTHORIZED
PaymentStatus.REFUNDED
```

may be reserved/unreachable in current runtime, but they remain canonical visible values.

Refund status is a separate dimension from Payment status.

Do not collapse them.

---

# 3. Existing Payments KPI Model — Preserve

Payments registry already has:

```text
Total
PaymentStatus cards
RefundStatus cards
Currency cards
```

Canonical card interaction:

```text
ONE ACTIVE SPECIFIC KPI AT A TIME
```

across all three dimensions:

```text
paymentStatus
refundStatus
currencyCard
```

Meaning:

```text
select PaymentStatus
→ clear refundStatus
→ clear currencyCard

select RefundStatus
→ clear paymentStatus
→ clear currencyCard

select Currency card
→ clear paymentStatus
→ clear refundStatus
```

Total clears all three specific KPI dimensions.

Do not regress this invariant.

---

# 4. Canonical Scope Semantics

Payments backend/read-model contract:

```text
aggregates = server-authoritative overview scope
table total = table-filtered scope
```

Global overview dimensions include:

```text
workspace/channel scope
orderId
search
Header Period
currency
```

Table-only KPI dimensions include:

```text
paymentStatus
refundStatus
currencyCard
```

Canonical rule:

```text
PaymentStatus / RefundStatus / Currency-card change
→ table changes
→ overview KPI cards remain static

Header Period change
→ table changes
→ overview recomputes
```

Do not let table-header filters accidentally re-scope aggregates.

---

# 5. Main UX Goal

Move column-natural Payments filters from toolbar into table headers.

At minimum:

```text
Payment Status
Refund Status
Currency
```

must be represented through the relevant table header filter UI if those columns exist in the actual table.

Do not invent a header filter for a column that does not exist.

Audit the current Payments table first and use only the actual column model.

Target principle:

```text
STATUS / PAYMENT-STATE column
→ sortable label if currently sortable
→ filter icon/dropdown in same header

REFUND column
→ header filter

CURRENCY column
→ header filter
```

---

# 6. Toolbar Target

After this stage, Payments toolbar should retain only global / registry-level controls such as:

```text
[ Search ] [ Reset ] [ CSV ] [ XLSX ]
```

plus any already-existing non-column global control that is canonical for Payments.

Remove toolbar duplicates for:

```text
PaymentStatus
RefundStatus
Currency-card/table currency filter
```

only if those controls are currently column-natural and migrated into headers.

Do NOT remove:

```text
Header Period
global/base currency scope if distinct from currencyCard
```

Important distinction:

```text
currency       = global/base scope
currencyCard   = table-only KPI/card filter
```

Do not merge these concepts.

---

# 7. Shared Component Reuse

Use the already accepted shared foundation:

```text
SortableHeader
TableHeaderFilter
registry URL-state helpers
```

Do not create a Payments-only filtering widget unless there is a proven shared-component gap.

The accepted interaction model is already in Requests, Orders, Bookings.

Payments should align to it.

---

# 8. PaymentStatus Header Filter

PaymentStatus header filter must map to the same state used by PaymentStatus KPI cards.

Example:

```text
Header Payment Status → CAPTURED
→ paymentStatus=CAPTURED
→ refundStatus cleared
→ currencyCard cleared
→ page=1
→ CAPTURED KPI pressed=true
→ table server-filtered
→ overview static
```

Reverse:

```text
KPI CAPTURED
→ same paymentStatus state
→ same URL
→ same header filter reflects CAPTURED
```

No duplicate authority.

---

# 9. RefundStatus Header Filter

RefundStatus header filter must map to the same state used by RefundStatus KPI cards.

Example:

```text
Header Refund Status → PROCESSED
→ refundStatus=PROCESSED
→ paymentStatus cleared
→ currencyCard cleared
→ page=1
→ matching Refund KPI pressed=true
→ table server-filtered
→ overview static
```

Reverse KPI→header must also reflect the same state.

---

# 10. Currency Header Filter

Audit the current table and actual currency UX carefully.

Known backend distinction:

```text
currency
= global/base currency scope

currencyCard
= table-only KPI/card filter
```

If the table column filter is intended to represent the table-only currency selection, it must map to:

```text
currencyCard
```

not silently rewrite the global `currency` scope.

Required:

```text
Currency header filter
↔ currencyCard
↔ matching Currency KPI card
↔ same table-only state
```

Do NOT collapse:

```text
currency
and
currencyCard
```

into a single parameter unless the existing backend contract explicitly changed, which is outside this stage.

---

# 11. One-Active-KPI Invariant — Mandatory

This is critical.

At every runtime state:

```text
specific pressed KPI count <= 1
```

across:

```text
PaymentStatus cards
RefundStatus cards
Currency cards
```

Header-filter interactions must obey the same exclusivity.

Required transitions:

```text
paymentStatus → refundStatus
refundStatus → paymentStatus
paymentStatus → currencyCard
currencyCard → paymentStatus
refundStatus → currencyCard
currencyCard → refundStatus
```

Every transition must clear the previous KPI dimension.

---

# 12. Invalid Multi-Dimension Deep Links

Audit current accepted URL canonicalization behavior.

If a URL arrives with more than one table-only KPI dimension, e.g.:

```text
?paymentStatus=CAPTURED&refundStatus=PROCESSED
```

or:

```text
?paymentStatus=CAPTURED&currencyCard=USD
```

the UI must not render multiple specific KPI cards active.

Use the already accepted deterministic canonicalization model.

Do not introduce render-phase router/history mutation.

React/Next rule:

```text
render phase = pure derivation only
post-render normalization = useEffect/router.replace if required
```

No:

```text
window.history.*
router.*
setState
```

during render.

---

# 13. URL Authority

Canonical table-only params:

```text
paymentStatus
refundStatus
currencyCard
```

Sorting:

```text
sortBy
sortDirection
```

Header Period:

```text
dateFrom
dateTo
```

Search remains toolbar/global registry state.

URL is authoritative for:

```text
deep-link
reload
popstate
server query
selected KPI
selected header filter
```

Do not maintain unsynchronized header-only state.

---

# 14. Sorting Alignment

Audit existing Payments sorting before changing anything.

Preserve:

```text
server-side sorting
existing sortable columns
sortBy + sortDirection convention
```

Do not make previously non-sortable business columns sortable unless justified by the current backend allowlist.

Do not silently expand backend sorting surface.

If sorting is already correct, do not rewrite it.

---

# 15. Sort + Filter Independence

For any column that has both sort and filter controls:

```text
sort affordance
→ changes sort only

filter affordance
→ changes filter only
```

Required:

```text
status survives sort
refundStatus survives sort
currencyCard survives sort
sort survives KPI/header filter changes
```

unless the canonical interaction explicitly clears only conflicting KPI dimensions.

Sorting itself is not a KPI dimension and must not be cleared by selecting a KPI.

---

# 16. Search Coexistence

Search remains toolbar-level.

Required combinations:

```text
search + paymentStatus
search + refundStatus
search + currencyCard
search + sort
search + period
search + period + one KPI dimension + sort
```

Changing the KPI/header filter must preserve search.

Changing sort must preserve search and active KPI dimension.

---

# 17. Header Period Coexistence

Accepted UI-C1.2F.1B semantics remain unchanged.

Example:

```text
dateFrom=2026-09-01
dateTo=2026-10-01
paymentStatus=CAPTURED
```

Expected:

```text
overview = all Payments in Sep global scope
table    = CAPTURED Payments in Sep
```

Likewise for:

```text
refundStatus
currencyCard
```

Period change:

```text
preserve compatible active KPI dimension
page → 1
overview recomputes
table refetches under new period + active table-only filter
```

---

# 18. Total Contract

Clicking Total must:

```text
clear paymentStatus
clear refundStatus
clear currencyCard
page → 1
```

Preserve:

```text
dateFrom/dateTo
search
sort
global/base currency
orderId
other compatible global scope
```

Total is not a full Reset.

---

# 19. Registry Reset Contract

Payments registry Reset must clear registry-local state according to the accepted registry contract while preserving Header Period.

At minimum:

```text
CLEAR:
paymentStatus
refundStatus
currencyCard
search
page
sort if canonical reset currently clears sort

KEEP:
dateFrom
dateTo
global/base workspace scope
global/base currency if it is intentionally a global scope
```

Do not clear Header Period.

---

# 20. Tab Switch Semantics

Accepted Operations Center rule:

```text
KEEP:
dateFrom/dateTo

RESET:
Payments-specific KPI filters
search
page
Payments-specific sort
other registry-local state
```

Do not leak:

```text
paymentStatus
refundStatus
currencyCard
```

into Requests/Orders/Bookings URLs.

---

# 21. Reload / Popstate

Reload with one valid KPI dimension must restore:

```text
selected KPI
matching table-header filter
table query
overview global scope
```

For Back/Forward:

```text
do NOT require each filter change to create a browser history entry
```

Use the accepted replace-semantics model.

Stage real history entries carrying Payments URLs and verify genuine popstate restore.

---

# 22. Server-Side Filtering

All filtering must remain backend-authoritative.

Forbidden:

```text
client-only row filtering
client-side recounting of KPI aggregates
filtering only currently loaded page
frontend-only currency/refund/payment scoping
```

Verify actual request queries.

Where the backend returns aggregates and table data in one response, prove:

```text
aggregates remain global/base scope
table total reflects table-only filter
```

---

# 23. Export Scope

Existing Payments export must follow active table scope.

Verify at minimum:

```text
period
search
paymentStatus OR refundStatus OR currencyCard
```

where supported by the actual export endpoint.

Do not invent export behavior not currently supported.

If one table-only dimension is not accepted by export today, classify/report instead of silently changing unrelated backend semantics.

---

# 24. Invalid Enum / Currency Handling

Known Payments validation contract:

```text
invalid enum/currency/date → 422
```

Verify actual behavior for:

```text
invalid paymentStatus
invalid refundStatus
invalid currency / currencyCard value
```

No silent fallback.

Do not generalize Requests 400 or Bookings 500 to Payments.

---

# 25. Security / Isolation

Preserve:

```text
finance.payment.read
server-side RBAC
workspace/context scoping
Storefront explicit scope invisible/empty
cross-context 404-like behavior where applicable
```

Because this is a UI filtering stage, backend changes are not expected.

Do not claim a new security qualification merely because the path is unchanged.

If no backend/security code changed, report:

```text
SECURITY REGRESSION SURFACE — NONE / BACKEND UNCHANGED
```

If actual isolation probes are run, record them separately.

---

# 26. Accessibility

Required:

```text
each header filter has accessible name
aria-expanded / popup semantics correct
keyboard navigation works
Escape closes dropdown
sort and filter controls are distinct
selected KPI aria-pressed correct
filter state perceivable beyond color alone
```

Do not regress the shared TableHeaderFilter contract.

---

# 27. Responsive

Smoke test:

```text
desktop
narrow/mobile-ish viewport
```

Required:

```text
header filter controls remain operable
table remains usable
no overlap that blocks sorting/filtering
```

No redesign in this stage.

---

# 28. Tests — Mandatory

Add/update Payments registry tests covering at minimum:

```text
1. toolbar PaymentStatus filter removed
2. toolbar RefundStatus filter removed
3. toolbar Currency table-filter duplicate removed if applicable
4. PaymentStatus header filter present
5. RefundStatus header filter present
6. Currency header filter present if actual table column exists
7. PaymentStatus header → URL + KPI
8. RefundStatus header → URL + KPI
9. Currency header → currencyCard + KPI
10. KPI → matching header state
11. paymentStatus clears refundStatus/currencyCard
12. refundStatus clears paymentStatus/currencyCard
13. currencyCard clears paymentStatus/refundStatus
14. specific pressed KPI count <= 1
15. invalid dual/multi deep-link canonicalization
16. no render-phase router/history mutation
17. page resets to 1 on filter change
18. search survives filter change
19. period survives filter change
20. sort survives filter change
21. active KPI filter survives sort
22. Total clears all three table-only KPI dimensions
23. Reset preserves Header Period
24. reload derives full state from URL
25. popstate restores URL-carried state
26. static aggregates under table-only filter
27. aggregates recompute under Header Period
28. table query contains only the active KPI dimension
29. export follows active table scope
30. invalid enum/currency returns canonical error behavior
31. accessibility markers
```

Preserve existing Payments tests.

---

# 29. Regression — Mandatory

Run at minimum:

```text
payments-registry
orders-registry
bookings-registry
requests-registry
table-header-filter
operations-center-shell
registry-url-state helpers if present
frontend TSC
frontend build
full vitest
```

Requests/Orders/Bookings are mandatory regressions because they are accepted reference registries for this architecture.

Record exact counts.

Known unrelated i18n NBSP failure may remain only if unchanged and proven unrelated.

---

# 30. Runtime Evidence — Mandatory

Minimum actual browser cases:

## CASE A — PaymentStatus header

```text
before URL
after URL
selected header
selected KPI
specific pressed count
table total
overview total
network request
```

## CASE B — RefundStatus header

Same evidence.

## CASE C — Currency header / currencyCard

Same evidence.

## CASE D — Cross-dimension exclusivity

Prove actual transitions:

```text
CAPTURED → PROCESSED
PROCESSED → currencyCard
currencyCard → CAPTURED
```

At every step:

```text
specific pressed KPI count = 1
only one table-only KPI param remains
```

## CASE E — Invalid multi-filter deep-link

Open at least one invalid URL with 2+ KPI dimensions.

Required:

```text
deterministic canonicalization
first rendered specific KPI count <= 1
no Router render warning
no React warning
no request storm
canonical API query contains one table-only KPI dimension
```

## CASE F — Sort coexistence

Prove active KPI dimension + sort both survive.

## CASE G — Period coexistence

Prove:

```text
overview = period-global
table = period + active KPI dimension
```

## CASE H — Total / Reset distinction

Prove exact URL behavior.

## CASE I — Reload / Popstate

Prove URL-derived state restoration.

---

# 31. Network Proof

For each table-only dimension prove:

```text
PaymentStatus selected
→ API list/table scope carries paymentStatus only

RefundStatus selected
→ API carries refundStatus only

CurrencyCard selected
→ API carries currencyCard only
```

Do not allow stale opposite dimensions.

Where aggregates are in the same payload, record:

```text
aggregates total
table total
```

and show they obey the canonical split.

No request storm.

---

# 32. Console Proof

After all qualification scenarios:

```text
Router render warnings             — 0
React warnings introduced          — 0
Hydration mismatches               — 0
Uncaught exceptions                — 0
Infinite update warnings           — 0
```

Deliberate invalid-input network errors may appear as browser resource errors; classify separately.

---

# 33. Expected Files

Likely functional files:

```text
frontend/app/app/payments/page.tsx
frontend/lib/payments-registry.spec.tsx
```

Possibly shared component/helper only if a proven reusable gap exists.

Documentation/evidence:

```text
docs/prompts/...
docs/reports/...
docs/evidence/...
```

Backend changes are NOT expected.

If backend changes become necessary, stop and explain the exact blocker before expanding scope.

---

# 34. No Functional Drift

Do not change:

```text
PaymentStatus enum
RefundStatus enum
refund lifecycle
Payment/Refund financial semantics
currency vs currencyCard distinction
D7 accepted formulas
finance ownership
RBAC
Header Period contract
Operations Center tab model
```

If a real pre-existing backend defect appears:

```text
record it
classify it
do not silently expand this UI stage
```

---

# 35. Git Hard Closure

Before commit:

```bash
git status --porcelain=v1
git diff --check
git diff --stat
```

Track all stage-owned prompts/reports/evidence.

Commit implementation.

Example:

```text
feat: align Payments filters with table headers (UI-C1.2F.1F)
```

Push:

```bash
git push origin master
git fetch origin
```

Literal proof:

```bash
git status --porcelain=v1
git rev-parse HEAD
git rev-parse origin/master
git log -5 --oneline --decorate
git merge-base --is-ancestor 2db72e6c8e6e419b6c93df20d6ead5217b5cc6db HEAD
echo $LASTEXITCODE
```

Required:

```text
status → NO OUTPUT
HEAD == origin/master
baseline ancestry exit code → 0
```

---

# 36. Required Final Report

Use ACTUAL values only.

```text
PHASE 3 — UI-C1.2F.1F
PAYMENTS TABLE-HEADER FILTERING + SORTING ALIGNMENT

BASELINE SHA:
2db72e6c8e6e419b6c93df20d6ead5217b5cc6db

IMPLEMENTATION SHA:
<actual>

FINAL SHA:
<actual>

PAYMENT STATUS REMOVED FROM TOOLBAR   — PASS
REFUND STATUS REMOVED FROM TOOLBAR    — PASS
CURRENCY COLUMN FILTER ALIGNED        — PASS / N/A with reason

PAYMENT STATUS HEADER FILTER          — PASS
REFUND STATUS HEADER FILTER           — PASS
CURRENCY HEADER FILTER                — PASS / N/A with reason
SHARED TableHeaderFilter              — PASS

KPI ↔ HEADER SAME STATE               — PASS
ONE ACTIVE KPI ACROSS 3 DIMENSIONS    — PASS
MULTI-FILTER DEEP-LINK NORMALIZATION  — PASS
NO RENDER-PHASE ROUTER MUTATION       — PASS

URL AUTHORITY                         — PASS
PAGE RESET                            — PASS
TOTAL RESET                           — PASS
REGISTRY RESET                        — PASS

STATIC KPI OVERVIEW                   — PASS
PERIOD + KPI FILTER SCOPE             — PASS
SEARCH + KPI FILTER                   — PASS
SORT + KPI FILTER                     — PASS
SORT/FILTER INDEPENDENT               — PASS

RELOAD                                — PASS
POPSTATE RESTORE                      — PASS
TAB SWITCH PERIOD-ONLY                — PASS

SERVER-SIDE FILTERING                 — PASS
EXPORT SCOPE                          — PASS
INVALID ENUM/CURRENCY HANDLING        — PASS

SECURITY REGRESSION SURFACE           — NONE / BACKEND UNCHANGED
ACCESSIBILITY                         — PASS
RESPONSIVE                            — PASS
CONSOLE ERRORS                        — 0

PAYMENTS TESTS                        — <actual>
REQUESTS REGRESSION                   — <actual>
ORDERS REGRESSION                     — <actual>
BOOKINGS REGRESSION                   — <actual>
TARGETED TOTAL                        — <actual>
FULL VITEST                           — <actual>
TSC                                   — PASS
BUILD                                 — PASS

WORKING TREE CLEAN                    — PASS
HEAD == origin/master                 — PASS
BASELINE ANCESTRY                     — PASS
GIT HARD CLOSURE                      — PASS

VERDICT A — UI-C1.2F.1F ACCEPTED
```

If any mandatory invariant fails:

```text
VERDICT B — UI-C1.2F.1F NOT ACCEPTED

BLOCKER:
<exact reproduced defect>
```

---

# 37. Stop Rule

After UI-C1.2F.1F:

```text
STOP
```

Do not automatically start:

```text
UI-C1.2F.1H
UI-C1.2F.1I
UI-C1.2G
UI-C2
D8
```

Wait for independent review.
