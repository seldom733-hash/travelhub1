# PHASE 3 — UI-C1.2F.1E — IMPLEMENTATION
## Bookings Table-Header Filtering + Sorting Alignment

---

# 0. Purpose

Implement the accepted Operations Center table-header filtering pattern for:

```text
/app/bookings
```

This stage aligns Bookings with the already accepted Requests and Orders registry interaction model:

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

Both sorting and filtering remain:

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
22d165384830d3f9f9b7c8c66cefe852b8b8ff13
```

Accepted stages:

```text
UI-C1.2F.1A — ACCEPTED
UI-C1.2F.1B — ACCEPTED
UI-C1.2F.1C — ACCEPTED
UI-C1.2F.1D — ACCEPTED
UI-C1.2F.1G — ACCEPTED
```

Not started:

```text
UI-C1.2F.1E — THIS STAGE
UI-C1.2F.1F — NOT STARTED
```

Do not reopen accepted stages unless this implementation reveals a genuine regression.

---

# 2. Scope

Primary target:

```text
Booking Center registry
/app/bookings
```

Implement:

```text
1. move Booking Status filter from toolbar into Status table header
2. preserve existing server-side sorting
3. unify KPI ↔ header filter state
4. keep URL as the single source of truth
5. preserve shared Header Period semantics
6. preserve static KPI overview semantics
7. preserve registry Reset / tab-switch / reload / popstate behavior
8. add regression tests
9. close Git cleanly
```

---

# 3. Non-Goals

Do NOT implement:

```text
Payments table-header filtering
Requests changes
Orders changes
new Booking statuses
new Booking state transitions
new Booking backend business rules
new Booking detail UI
UI-C1.2G
UI-C2
D8
```

Do NOT redesign the registry.

Do NOT change accepted Header Period semantics.

---

# 4. Canonical Booking Status Model

BookingStatus has exactly 13 canonical values:

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

Important:

```text
PARTIALLY_CONFIRMED DOES NOT EXIST
```

All actual statuses must remain represented by visible KPI cards.

`AWAITING_CONFIRMATION` remains a valid canonical visible status even if no current producer exists.

Do not invent transitions or incoming arrows in this stage.

---

# 5. Accepted KPI Interaction Contract

Bookings already follows the Requests interaction model.

Canonical behavior:

```text
KPI CARDS = STATIC OVERVIEW COUNTS

CLICK STATUS KPI
→ selected KPI becomes active
→ filters ONLY the table
→ all other KPI card values remain unchanged
→ page resets to 1
```

Bookings has one KPI filter dimension:

```text
status
```

Therefore:

```text
one specific status KPI may be active
or Total/default
```

No second KPI dimension exists in this registry.

---

# 6. Header Filter Contract

Move Booking Status filtering into the Status table header.

Target concept:

```text
... | STATUS ↕ ▾ | ...
```

Where:

```text
label / sort interaction → sorting
filter icon / dropdown   → status filter
```

The sort control and filter control must be independent click targets.

Use the accepted shared components/foundation from UI-C1.2F.1C:

```text
SortableHeader
TableHeaderFilter
registry URL-state helpers
```

Prefer reuse over Booking-specific duplication.

---

# 7. Toolbar Target

After this stage, Booking toolbar must NOT contain a Status dropdown.

Target:

```text
[ Search ] [ Reset ] [ CSV ] [ XLSX ]
```

or the exact already-existing Booking export/action set if one of CSV/XLSX is not currently supported.

Important:

```text
do not add new actions merely for visual parity
```

The key requirement is:

```text
Status filter leaves toolbar
Status filter moves to table header
```

Shared Header Period remains in the Operations Center header, not in the Booking toolbar.

---

# 8. KPI ↔ Header Filter = One State

KPI status card and table-header Status filter are two entry points into the SAME state.

Example:

```text
KPI "Подтверждено"
→ status=CONFIRMED
→ table filters
→ CONFIRMED KPI pressed=true
→ Status header shows CONFIRMED
```

And:

```text
Status header → CONFIRMED
→ status=CONFIRMED
→ same URL state
→ same table query
→ CONFIRMED KPI pressed=true
```

Required invariant:

```text
one status state
one URL param
one server query
two UI entry points
```

Do not create separate `headerStatus` / `kpiStatus` authorities.

---

# 9. URL Authority

Canonical URL parameter:

```text
status=<BookingStatus>
```

Status selection must:

```text
set status
reset page → 1
preserve compatible global/local state
```

Status clear must:

```text
remove status
reset page → 1
```

URL is authoritative for:

```text
reload
popstate
deep-link
tab return only when state is actually carried by the URL
```

Do not use unsynchronized component-only state.

---

# 10. Shared Header Period Preservation

Accepted UI-C1.2F.1B contract remains unchanged.

Header Period is GLOBAL:

```text
dateFrom/dateTo
→ KPI overview recomputes
→ table refetches
```

Status is TABLE-ONLY:

```text
status
→ table changes
→ KPI overview remains static
```

Combined scope:

```text
KPI OVERVIEW QUERY
= period/global scope

TABLE QUERY
= period/global scope + status
```

Example:

```text
dateFrom=2026-09-01
dateTo=2026-10-01
status=CONFIRMED
```

Expected:

```text
overview = all Booking statuses inside Sep period
table    = CONFIRMED Bookings inside Sep period
```

Do not let status accidentally re-scope overview aggregates.

---

# 11. Sorting Alignment

Bookings already had server-side sorting before this stage.

Audit and preserve it.

Do NOT reimplement sorting unless a concrete defect is found.

Required:

```text
sortable columns continue to sort server-side
sort state remains URL-authoritative
sort coexists with status filter
sort coexists with period
sort coexists with search
```

Use the actual deployed URL convention.

Current Operations Center convention:

```text
sortBy
sortDirection
```

Do not introduce a new parallel `sortOrder` convention.

---

# 12. Sort + Filter Independence

For the Status column:

```text
click sort affordance
→ changes sort only
→ does NOT open/apply filter

click filter affordance
→ changes status filter only
→ does NOT change sort
```

Keyboard interaction must likewise preserve this separation.

Test this explicitly.

---

# 13. Reset Contract

Booking registry Reset must:

```text
CLEAR:
search
status
sort if canonical registry Reset already clears sort
page
other Booking-local filter state

KEEP:
dateFrom
dateTo
shared Header Period
workspace/global scope
```

After Reset:

```text
Total/default KPI active
Status header = All/default
table returns to unfiltered Booking state inside current global period
```

Do not clear Header Period.

---

# 14. Total KPI Contract

Clicking Total:

```text
remove status
page → 1
```

Preserve:

```text
dateFrom/dateTo
search
sort
other compatible non-KPI state
```

Total must not act as a full registry Reset.

---

# 15. Search Coexistence

Search remains toolbar-level.

Required:

```text
search + status
search + sort
search + period
search + status + sort + period
```

must all work server-side.

Changing status must not silently remove search.

Changing sort must not silently remove search or status.

Use the accepted URL-update semantics from the shared foundation.

---

# 16. Tab Switch Semantics

Accepted Operations Center rule:

```text
KEEP:
dateFrom/dateTo

RESET:
Booking-specific status
Booking search
Booking page
Booking sort unless explicitly carried by accepted tab contract
```

When switching from Bookings to another Operations Center tab:

```text
period travels
Booking-specific registry state does not leak
```

Do not change shared tab architecture.

---

# 17. Reload / Popstate

Reload with:

```text
/app/bookings?status=CONFIRMED
```

must restore:

```text
CONFIRMED KPI pressed
Status header = CONFIRMED
table filtered by CONFIRMED
```

Reload with:

```text
dateFrom/dateTo + status + sort + search
```

must restore all URL-carried compatible state.

For Back/Forward, use canonical replace-semantics understanding:

```text
do NOT require each filter click to create a history entry
```

Instead verify genuine popstate restore when a browser history entry carrying a Booking URL is restored.

---

# 18. Server-Side Filtering

Status filtering must remain backend/server-authoritative.

Forbidden:

```text
client-side filtering of already-fetched rows
client-side KPI recounting
client-only status selection without URL/server query
```

Verify actual network requests:

```text
/api/v1/bookings?...&status=CONFIRMED...
```

or the repository's actual canonical endpoint.

---

# 19. Export Scope

Existing Booking exports must follow the active table scope.

At minimum verify:

```text
period
search
status
```

are respected by export.

Sorting semantics should remain as already implemented; do not invent a new export sorting requirement unless current export contract supports it.

If CSV/XLSX use server endpoints, prove their request query.

If one format is not supported today, do not add it solely for parity.

---

# 20. Invalid Status / Security

Status is server-authoritative enum scope.

Verify:

```text
valid canonical BookingStatus → accepted
invalid status → canonical validation error
```

No silent fallback.

Do not expose cross-tenant/cross-workspace data.

Preserve accepted workspace/tenant scoping and 404-like isolation semantics.

No frontend-only security gates.

---

# 21. Accessibility

Required:

```text
Status filter control has accessible name
current filter state is perceivable
sort control remains keyboard reachable
filter control remains keyboard reachable
focus visible
aria-pressed KPI state remains correct
```

Do not encode filter state by color alone.

---

# 22. Responsive

Smoke test:

```text
desktop
narrow/mobile-ish viewport
```

Header filter must not make the table unusable.

No redesign required.

Horizontal scrolling is acceptable if already canonical for the registry, but controls must remain operable.

---

# 23. Tests — Mandatory

Add/update Booking registry tests for at least:

```text
1. Status dropdown removed from toolbar
2. shared TableHeaderFilter rendered in Status column
3. Status header filter sets URL status
4. Status header filter resets page
5. Status header filter activates matching KPI
6. KPI click updates same status state
7. KPI click updates matching header filter state
8. clearing header status returns Total/default
9. Total clears status
10. search survives status change
11. period survives status change
12. sort survives status change
13. status survives sort change
14. sort/filter controls are independent
15. reload derives selected KPI/header state from URL
16. registry Reset clears status but preserves period
17. tab switch carries period only
18. static KPI overview does not recalc due to status filter
19. server request contains status
20. invalid status does not silently fall back
```

Also preserve all existing Booking tests.

---

# 24. Regression — Mandatory

Run at minimum:

```text
bookings-registry
table-header-filter
operations-center-shell
orders-registry
requests-registry
registry-url-state tests if present
frontend TSC
frontend build
full vitest
```

Requests and Orders are mandatory regressions because they are accepted reference implementations for the same shared filtering architecture.

Record exact counts.

Known unrelated i18n NBSP failure may remain only if reproduced unchanged and proven unrelated.

---

# 25. Runtime Evidence

Browser evidence must include ACTUAL state.

Minimum cases:

## A. Header Status selection

```text
before URL
after URL
selected Status
matching KPI aria-pressed
table total
network request
```

## B. KPI selection

```text
before URL
after URL
matching header Status
matching KPI aria-pressed
table total
network request
```

## C. Sort + Status coexistence

```text
status=<value>
sortBy=<value>
sortDirection=<value>
```

both remain present and table reflects server-side scope.

## D. Period + Status coexistence

```text
dateFrom/dateTo
status
```

overview remains period-global; table is period+status.

## E. Reset / Total distinction

Prove:

```text
Total clears status only
Reset clears registry-local state but preserves period
```

## F. Reload / popstate

Prove URL-derived restoration.

---

# 26. No Functional Drift

Do not change:

```text
13 Booking statuses
Booking lifecycle semantics
Booking KPI count definitions
Header Period semantics
workspace/tenant authority
Booking detail routes/actions
D6 accepted contracts
```

If implementation discovers a real pre-existing defect outside 1E scope:

```text
record it
classify severity
STOP if it blocks correctness/security
do not silently expand scope
```

---

# 27. Expected Files

Likely touched:

```text
frontend/app/app/bookings/page.tsx
frontend/lib/bookings-registry.spec.tsx
```

Possibly shared UI helper only if a real reusable gap exists.

Documentation/evidence:

```text
docs/prompts/...
docs/reports/...
docs/evidence/...
```

Backend changes are NOT expected.

If backend changes are required, explain the exact blocker before proceeding.

---

# 28. Git Hard Closure

Before commit:

```bash
git status --porcelain=v1
git diff --check
git diff --stat
```

Track all stage artifacts.

Commit implementation.

Example:

```text
feat: align Bookings status filter with table header (UI-C1.2F.1E)
```

Push:

```bash
git push origin master
git fetch origin
```

Then literal proof:

```bash
git status --porcelain=v1
git rev-parse HEAD
git rev-parse origin/master
git log -5 --oneline --decorate
git merge-base --is-ancestor 22d165384830d3f9f9b7c8c66cefe852b8b8ff13 HEAD
```

Required:

```text
status → NO OUTPUT
HEAD == origin/master
baseline ancestry → exit 0
```

---

# 29. Required Final Report

Use ACTUAL evidence only.

```text
PHASE 3 — UI-C1.2F.1E
BOOKINGS TABLE-HEADER FILTERING + SORTING ALIGNMENT

BASELINE SHA:
22d165384830d3f9f9b7c8c66cefe852b8b8ff13

IMPLEMENTATION SHA:
<actual>

FINAL SHA:
<actual>

STATUS REMOVED FROM TOOLBAR          — PASS
STATUS FILTER IN TABLE HEADER        — PASS
SHARED TableHeaderFilter             — PASS

KPI ↔ HEADER SAME STATE              — PASS
URL AUTHORITY                        — PASS
PAGE RESET                           — PASS
TOTAL RESET                          — PASS
REGISTRY RESET                       — PASS

STATIC KPI OVERVIEW                  — PASS
PERIOD + STATUS SCOPE                — PASS
SEARCH + STATUS                      — PASS
SORT + STATUS                        — PASS
SORT/FILTER INDEPENDENT              — PASS

RELOAD                               — PASS
POPSTATE RESTORE                     — PASS
TAB SWITCH PERIOD-ONLY               — PASS

SERVER-SIDE FILTERING                — PASS
EXPORT SCOPE                         — PASS
INVALID STATUS HANDLING              — PASS
TENANT/WORKSPACE ISOLATION           — PASS

ACCESSIBILITY                        — PASS
RESPONSIVE                           — PASS
CONSOLE ERRORS                       — 0

BOOKINGS TESTS                       — <actual>
REQUESTS REGRESSION                  — <actual>
ORDERS REGRESSION                    — <actual>
TARGETED TOTAL                       — <actual>
FULL VITEST                          — <actual>
TSC                                  — PASS
BUILD                                — PASS

WORKING TREE CLEAN                   — PASS
HEAD == origin/master                — PASS
BASELINE ANCESTRY                    — PASS
GIT HARD CLOSURE                     — PASS

VERDICT A — UI-C1.2F.1E ACCEPTED
```

If any mandatory invariant fails:

```text
VERDICT B — UI-C1.2F.1E NOT ACCEPTED

BLOCKER:
<exact issue>
```

---

# 30. Stop Rule

After UI-C1.2F.1E:

```text
STOP
```

Do not automatically start:

```text
UI-C1.2F.1F
UI-C1.2F.1H
UI-C1.2F.1I
UI-C1.2G
UI-C2
D8
```

Wait for independent review.
