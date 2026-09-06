# PHASE 3 — UI-C1.2F.1H — FINAL CROSS-REGISTRY REGRESSION QUALIFICATION
## Operations Center — Requests / Orders / Bookings / Payments Unified Regression

---

# 0. Purpose

This stage is the **cross-registry qualification gate** for the completed Operations Center filtering alignment.

All registry-specific implementation work is already accepted:

```text
UI-C1.2F.1A — ACCEPTED
UI-C1.2F.1B — ACCEPTED
UI-C1.2F.1C — ACCEPTED
UI-C1.2F.1D — ACCEPTED
UI-C1.2F.1E — ACCEPTED
UI-C1.2F.1F — ACCEPTED
UI-C1.2F.1G — ACCEPTED
```

This task is:

```text
QUALIFICATION ONLY
```

Do not change functional source code unless a genuine cross-registry blocker is reproduced.

---

# 1. Baseline

Current accepted baseline:

```text
HEAD / origin/master:
17ea8b601ba0cd2171b7d2b7c8c3553389af962e
```

This baseline includes:

```text
Requests table sorting + Status header filter
Orders Status + Payment header filters
Bookings Status header filter
Payments PaymentStatus + Currency header filters
Shared Header Period
Shared TableHeaderFilter foundation
URL-authoritative registry state
```

---

# 2. Canonical Operations Center Contract

Routes:

```text
/app/requests
/app/orders
/app/bookings
/app/payments
```

Tabs:

```text
[ Заявки ] [ Заказы ] [ Бронирования ] [ Платежи ]
```

Canonical interaction model:

```text
KPI          → quick business slice
Toolbar      → registry-level search/actions
Table Header → column-specific filters/sorting
Header       → shared global Period
```

Canonical scope split:

```text
KPI OVERVIEW QUERY SCOPE
= GLOBAL SCOPE

TABLE QUERY SCOPE
= GLOBAL SCOPE
+ TABLE-ONLY FILTERS
```

Global scope includes:

```text
dateFrom
dateTo
workspace / tenant / business context
```

Table-only scope includes registry-specific KPI/header dimensions.

---

# 3. Strict Scope

Allowed:

```text
fresh runtime qualification
browser interaction qualification
network inspection
API/UI reconciliation
cross-registry regression
responsive/accessibility smoke
targeted/full tests
documentation/evidence
Git closure
```

Forbidden unless blocker reproduced:

```text
new feature work
new backend business logic
new statuses
new sorting fields
new filters
new URL model
new navigation model
new UI-C1.2G work
UI-C2
D8
```

If a genuine defect is found:

```text
STOP
REPORT VERDICT B
DO NOT silently patch it inside qualification
```

---

# 4. Registry Contracts to Preserve

## Requests

Canonical table-only dimension:

```text
status
```

Sortable fields already accepted.

Toolbar target:

```text
[ Search ] [ Reset ] [ CSV ] [ XLSX ]
```

Status filter lives in table header.

## Orders

Canonical table-only KPI dimensions:

```text
status
paymentStatus
```

Invariant:

```text
one specific KPI active at a time
```

Status and Payment filters live in table headers.

Invalid dual deep-link canonicalizes deterministically.

## Bookings

Canonical table-only dimension:

```text
status
```

13 BookingStatus values preserved.

Status filter lives in table header.

## Payments

Canonical table-only KPI dimensions:

```text
paymentStatus
refundStatus
currencyCard
```

Invariant:

```text
one specific KPI active across all 3 dimensions
```

Table headers:

```text
PaymentStatus → Status column
CurrencyCard  → Currency column
RefundStatus  → no header filter because no Refund column exists
```

Do not invent a Refund column.

---

# 5. Shared Header Period — Cross-Registry Qualification

Verify Header Period on all 4 registries.

Required:

```text
Period control rendered in shared Operations Center header
no registry-local date controls
no legacy Orders "Обновить" date button
```

Use the same bounded period on each registry, for example:

```text
2026-09-01 → 2026-10-01
```

and another period:

```text
2026-10-01 → 2026-11-01
```

Record actual KPI/table totals for all four.

Required:

```text
period changes overview
period changes table
URL == visible period == API scope
```

---

# 6. Cross-Registry KPI Static-Overview Rule

For each registry, within one fixed period:

```text
select one table-only KPI/header filter
```

Verify:

```text
table changes
matching KPI becomes active
other KPI counts remain static
overview is not narrowed by table-only filter
```

Then change only Header Period.

Verify:

```text
overview recomputes
selected compatible KPI filter remains active
table refetches under new period + active filter
page → 1
```

Minimum:

```text
Requests  → status
Orders    → status or paymentStatus
Bookings  → status
Payments  → paymentStatus / refundStatus / currencyCard
```

---

# 7. KPI ↔ Header Synchronization

For all header-backed dimensions prove both directions.

## Requests

```text
KPI status ↔ Status header
```

## Orders

```text
Lifecycle KPI ↔ Status header
Payment KPI   ↔ Payment header
```

## Bookings

```text
KPI status ↔ Status header
```

## Payments

```text
PaymentStatus KPI ↔ Status header
Currency KPI      ↔ Currency header
```

RefundStatus remains KPI-only because no Refund column exists.

Required:

```text
one state
one URL param
same server query
same selected state
```

---

# 8. One-Active-KPI Invariants

## Orders

Exercise:

```text
status → paymentStatus → status
```

At every step:

```text
specific pressed KPI count = 1
only one KPI dimension remains in URL
```

## Payments

Exercise:

```text
paymentStatus
→ refundStatus
→ currencyCard
→ paymentStatus
```

At every step:

```text
specific pressed KPI count = 1
only one KPI dimension remains in URL
```

---

# 9. Deep-Link Canonicalization

## Orders

Open invalid dual-filter URL:

```text
?status=CLOSED&paymentStatus=PAID
```

Required:

```text
first render specific KPI count <= 1
deterministic canonicalization
no render-phase router mutation
no React/Router warning
no request storm
```

## Payments

Open invalid multi-filter URL, e.g.:

```text
?paymentStatus=CAPTURED&refundStatus=PROCESSED&currencyCard=USD
```

Required:

```text
first render specific KPI count <= 1
deterministic canonicalization
only one KPI dimension survives
unrelated period/search/sort preserved
```

---

# 10. Sorting Regression — All Registries

Verify sorting remains server-side and URL-authoritative.

Minimum one sortable column per registry:

```text
Requests
Orders
Bookings
Payments
```

Required:

```text
sortBy
sortDirection
```

persist in URL and server query.

Verify coexistence with active table-header filter.

---

# 11. Sort / Filter Independence

For every registry column that supports both sorting and filtering:

```text
sort click changes sort only
filter interaction changes filter only
```

Required:

```text
filter survives sort
sort survives filter
search survives both
period survives both
```

No coupled accidental resets.

---

# 12. Toolbar Regression

Expected toolbar pattern:

```text
[ Search ] [ Reset ] [ CSV ] [ XLSX ]
```

or actual accepted action subset per registry.

Verify:

```text
Requests — no Status toolbar filter
Orders   — no Status / Payment toolbar filters
Bookings — no Status toolbar filter
Payments — no KPI select filters in toolbar
```

Do not require nonexistent export formats solely for visual parity.

---

# 13. Reset vs Total — All Registries

For each registry prove:

## Total

```text
clears active KPI/table-only dimension(s)
preserves Header Period
preserves compatible search/sort where canonical
page → 1
```

## Registry Reset

```text
clears registry-local search/filter state
preserves Header Period
resets page
```

Do not conflate Total and Reset.

---

# 14. Tab Switch Semantics

Full cycle:

```text
Requests
→ Orders
→ Bookings
→ Payments
→ Requests
```

Before each switch, source registry should contain:

```text
dateFrom/dateTo
+ search
+ active table-only filter
+ sort
```

Required destination URL:

```text
KEEP:
dateFrom/dateTo

DROP:
source-registry search
source-registry KPI/table-only filters
source-registry sort/page
```

No registry state leakage across tabs.

---

# 15. Reload

For all four registries, load a URL containing:

```text
period
+ one active table-only filter
+ sort where applicable
+ search where applicable
```

Then perform native reload.

Required:

```text
URL preserved
Header Period restored
KPI/header selection restored
table query restored
overview scope restored
```

---

# 16. Popstate / Back-Forward

Canonical registry writes use replace semantics.

Do NOT require every filter click to create a browser history entry.

Instead stage two genuine history entries per at least:

```text
Orders
Payments
```

and one of:

```text
Requests / Bookings
```

Then exercise:

```text
history.back()
history.forward()
```

Required:

```text
URL state restored
period restored
KPI/header state restored
table query restored
overview global scope restored
no desync
```

---

# 17. Active-Domain-Only Fetch

Switch between all four tabs.

Required:

```text
only active registry fetches its domain data
inactive registries do not fetch in the background solely because tabs exist
```

Header Period changes must not trigger all registries simultaneously.

Capture Network proof.

---

# 18. Race / Rapid Interaction

At minimum:

```text
rapid Header Period changes
rapid KPI/header filter changes
rapid sort/filter interaction
```

on at least:

```text
Requests
Payments
```

Required:

```text
final URL = final visible state
final table = final server scope
final overview = final global scope
no stale response overwrite
no infinite request loop
```

---

# 19. API ↔ UI Reconciliation

For one bounded period on all four registries capture:

```text
browser URL
API query
server overview total/aggregates
server table total
rendered KPI total
rendered table total
```

Required:

```text
Rendered KPI == server overview
Rendered table == server table total
URL scope == API scope
```

No symbolic-only proof.

---

# 20. Export Scope Regression

Verify existing export path per registry follows active table scope.

Minimum:

```text
period
search
active table-only filter
```

where each registry export supports these parameters.

Do not invent new export behavior.

Record actual HTTP requests.

---

# 21. Invalid Input Regression

Record actual behavior; do not normalize across domains.

Known existing facts to preserve/report honestly:

```text
Requests malformed date → 400
Payments invalid enum/date → 422
Orders malformed date → 500  (known debt)
Bookings malformed date → 500  (known debt)
Bookings invalid status → 500  (known debt)
```

For this stage:

```text
no silent fallback
no scope divergence
no data leak
```

Known backend validation debts are not blockers unless regression worsens or security leakage appears.

---

# 22. Security Regression Surface

No backend/security code changes are expected in 1H.

Verify at minimum that cross-registry UI work does not bypass:

```text
server-side RBAC
workspace/tenant scope
active-domain-only fetch
404-like cross-context isolation where applicable
```

If no new security code exists, report:

```text
SECURITY REGRESSION SURFACE — NONE
BACKEND SECURITY PATHS — UNCHANGED
```

Do not claim a new full tenant-isolation qualification without actual probes.

---

# 23. Accessibility Cross-Registry Smoke

Verify on all registries:

```text
header filter controls have accessible names
sort/filter controls are distinct
keyboard focus works
Escape closes filter dropdown
KPI aria-pressed correct
active filter state is not color-only
```

Shared Header Period:

```text
labels present
keyboard reachable
clear control accessible
```

---

# 24. Responsive Cross-Registry Smoke

Check at least:

```text
desktop
narrow/mobile-ish viewport
```

for:

```text
Requests
Orders
Bookings
Payments
```

Required:

```text
header filters usable
no critical overlap
tabs usable
Period usable
table operable
```

No redesign in this stage.

---

# 25. Console Proof

Across all qualification scenarios:

```text
Router render warnings             — 0
React warnings introduced          — 0
Hydration mismatches               — 0
Uncaught exceptions                — 0
Infinite update warnings           — 0
```

Deliberate invalid-input HTTP errors may appear as resource errors; classify separately.

---

# 26. Regression Tests — Mandatory

Run at minimum:

```text
requests-registry
orders-registry
bookings-registry
payments-registry
table-header-filter
operations-center-shell
registry-url-state helpers if present
frontend TSC
frontend build
full vitest
```

Record exact counts.

Known pre-existing NBSP i18n failure may remain only if unchanged and unrelated.

---

# 27. Qualification-Only Rule

Before Git closure run:

```bash
git status --porcelain=v1
git diff --stat
git diff --check
```

Expected changes:

```text
docs/prompts/...
docs/reports/...
docs/evidence/...
```

If functional source files changed:

```text
STOP
VERDICT B
```

unless a genuine reproduced blocker requires a separate remediation stage.

Do not silently convert 1H into implementation work.

---

# 28. Git Hard Closure

Track:

```text
1H prompt
1H report
runtime evidence
network captures/screenshots if saved
```

Commit docs/evidence only.

Example:

```text
docs: finalize UI-C1.2F.1H cross-registry qualification
```

Push and fetch:

```bash
git push origin master
git fetch origin
```

Then literal proof:

```bash
git status --porcelain=v1
git rev-parse HEAD
git rev-parse origin/master
git log -6 --oneline --decorate
git merge-base --is-ancestor 17ea8b601ba0cd2171b7d2b7c8c3553389af962e HEAD
echo $LASTEXITCODE
```

Required:

```text
status → NO OUTPUT
HEAD == origin/master
baseline ancestry → 0
```

---

# 29. Required Final Report

Use ACTUAL evidence only.

```text
PHASE 3 — UI-C1.2F.1H
CROSS-REGISTRY REGRESSION QUALIFICATION

BASELINE SHA:
17ea8b601ba0cd2171b7d2b7c8c3553389af962e

QUALIFICATION HEAD:
<actual>

FINAL SHA:
<actual>

SHARED HEADER PERIOD 4/4             — PASS
NO LOCAL DATE CONTROLS               — PASS
TOOLBAR ALIGNMENT 4/4                — PASS

REQUESTS KPI↔HEADER                  — PASS
ORDERS KPI↔HEADER                    — PASS
BOOKINGS KPI↔HEADER                  — PASS
PAYMENTS KPI↔HEADER                  — PASS

ORDERS ONE-ACTIVE-KPI                — PASS
PAYMENTS ONE-ACTIVE-KPI              — PASS
DEEP-LINK CANONICALIZATION           — PASS

STATIC OVERVIEW RULE 4/4             — PASS
PERIOD + TABLE FILTER 4/4            — PASS
SORT + FILTER 4/4                    — PASS
SEARCH + FILTER 4/4                  — PASS

TOTAL / RESET 4/4                    — PASS
TAB SWITCH PERIOD-ONLY               — PASS
RELOAD 4/4                           — PASS
POPSTATE                             — PASS
ACTIVE-DOMAIN-ONLY FETCH             — PASS
RACE / FINAL-URL AUTHORITY           — PASS

API ↔ UI RECONCILIATION 4/4         — PASS
EXPORT SCOPE                         — PASS
INVALID INPUT NO-SILENT-FALLBACK     — PASS

SECURITY REGRESSION SURFACE          — NONE
ACCESSIBILITY                        — PASS
RESPONSIVE                           — PASS
CONSOLE ERRORS                       — 0

REQUESTS TESTS                       — <actual>
ORDERS TESTS                         — <actual>
BOOKINGS TESTS                       — <actual>
PAYMENTS TESTS                       — <actual>
TARGETED TOTAL                       — <actual>
FULL VITEST                          — <actual>
TSC                                  — PASS
BUILD                                — PASS

FUNCTIONAL SOURCE CHANGES            — NONE
ALL STAGE ARTIFACTS TRACKED          — PASS
WORKING TREE CLEAN                   — PASS
HEAD == origin/master                — PASS
BASELINE ANCESTRY                    — PASS
GIT HARD CLOSURE                     — PASS

VERDICT A — UI-C1.2F.1H ACCEPTED
```

If any mandatory invariant fails:

```text
VERDICT B — UI-C1.2F.1H NOT ACCEPTED

BLOCKER:
<exact reproduced defect or missing proof>
```

---

# 30. STOP

After 1H:

```text
STOP
```

Do not start:

```text
UI-C1.2F.1I
UI-C1.2G
UI-C2
D8
```

Wait for independent review.
