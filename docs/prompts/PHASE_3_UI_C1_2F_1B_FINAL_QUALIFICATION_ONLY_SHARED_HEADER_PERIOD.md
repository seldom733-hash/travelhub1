# PHASE 3 — UI-C1.2F.1B — FINAL QUALIFICATION ONLY
## Shared Operations Center Header Period — Runtime / Cross-Registry / Git Closure

---

# 0. Purpose

`UI-C1.2F.1B` functional remediation is already considered implemented.

Known functional fix:

```text
Shared Operations Center Header Period
→ dateFrom/dateTo are global Operations Center scope
→ affect KPI overview + table
→ local registry date controls are removed
→ Orders-only "Обновить" date-apply button is removed
```

Previously observed runtime A/B proof:

```text
              Sep 2026    Oct 2026
Requests          82          60
Orders            66          47
Bookings          48          29
Payments          52          36
```

But the stage was NOT accepted because final qualification remained incomplete.

This task is:

```text
QUALIFICATION ONLY
```

Do NOT change functional code unless a real defect is reproduced.

---

# 1. Canonical Contract

Header Period is GLOBAL scope:

```text
HEADER PERIOD
→ affects KPI overview
→ affects Table
```

Canonical query model:

```text
KPI OVERVIEW QUERY SCOPE
= GLOBAL SCOPE

TABLE QUERY SCOPE
= GLOBAL SCOPE
+ TABLE-ONLY SCOPE
```

Global scope includes:

```text
dateFrom
dateTo
workspace / tenant / business context
```

Table-only scope includes registry-specific filters such as:

```text
status
paymentStatus
refundStatus
currencyCard
and analogous KPI/header filters
```

Static KPI rule:

```text
status/payment/refund/currency-card change
→ table changes
→ KPI overview counts remain unchanged

period change
→ table changes
→ KPI overview recomputes
```

---

# 2. Strict Scope

Allowed:

```text
restart current frontend/runtime
browser qualification
network qualification
API/UI reconciliation
cross-registry verification
responsive/accessibility smoke
targeted regression tests
documentation/evidence
Git hard closure
```

Forbidden unless a real blocker is reproduced:

```text
new UI architecture
new period semantics
new date controls
new toolbar controls
Requests local date filters
Orders "Обновить" reintroduction
Bookings/Payments feature work
UI-C1.2F.1E
UI-C1.2F.1F
UI-C1.2G
UI-C2
D8
```

If a real runtime defect is found:

```text
STOP
REPORT VERDICT B
DO NOT silently fix it in this qualification task
```

---

# 3. Prove Current Runtime

Record:

```bash
git rev-parse HEAD
```

Restart frontend/runtime from that exact working tree.

Record:

```text
QUALIFICATION HEAD:
<sha>

RUNTIME:
<fresh dev/build runtime proof>
```

Do not qualify against stale bundle/cache.

---

# 4. Shared Header Presence — All 4 Registries

Verify on:

```text
/app/requests
/app/orders
/app/bookings
/app/payments
```

Required on each:

```text
shared Operations Center header visible
Period control visible in shared header
dateFrom/dateTo represented by same shared control model
no registry-local date controls
```

Specific negative checks:

```text
Requests toolbar — NO local date inputs
Orders toolbar   — NO local date inputs
Orders           — NO legacy "Обновить" date-apply button
Bookings toolbar — NO local date inputs
Payments toolbar — NO local date inputs
```

---

# 5. CASE A — Requests Period A/B

Start from Requests with no table-only status filter.

Set:

```text
dateFrom=2026-09-01
dateTo=2026-10-01
```

Record ACTUAL:

```text
URL
Header Period values
KPI total
table total
API request(s)
```

Then change to:

```text
dateFrom=2026-10-01
dateTo=2026-11-01
```

Record ACTUAL again.

Required:

```text
period URL changes
KPI overview recomputes
table refetches
KPI total matches server overview
table total matches server list
```

Do not rely only on the previously reported 82/60 numbers; capture current runtime values.

---

# 6. CASE B — Orders Period A/B

Repeat for Orders.

Record:

```text
Sep URL / KPI total / table total / API
Oct URL / KPI total / table total / API
```

Required:

```text
KPI overview changes with period
table changes with period
no local date apply button
```

---

# 7. CASE C — Bookings Period A/B

Repeat for Bookings.

Required:

```text
Header Period affects KPI overview
Header Period affects table
URL is authoritative
```

---

# 8. CASE D — Payments Period A/B

Repeat for Payments.

Required:

```text
Header Period affects payment KPI overview
Header Period affects payment table
no mixed-scope drift
```

Payments keeps its canonical finance-owned backend semantics; only qualify period data flow here.

---

# 9. API/UI Reconciliation — All Registries

For each registry and at least one period:

```text
Requests
Orders
Bookings
Payments
```

capture:

```text
1. browser URL
2. API request query
3. server overview total / aggregates
4. server table total
5. rendered KPI total
6. rendered table total
```

Required:

```text
Rendered KPI total == server overview total
Rendered table total == server table total
Period in UI == period in URL == period in API request
```

No symbolic “same-scope” statements only; actual values required.

---

# 10. Selected KPI Preservation During Period Change

This is mandatory.

For each registry type where applicable, activate one table-only KPI filter, then change Header Period.

Minimum required:

```text
Requests: status KPI
Orders: lifecycle OR payment KPI
Bookings: status KPI
Payments: paymentStatus OR refundStatus OR currencyCard
```

Required:

```text
selected KPI remains selected if compatible
same table-only filter remains in URL
page resets to 1
table refetches under:
  NEW PERIOD + EXISTING TABLE-ONLY FILTER

KPI overview recomputes under:
  NEW PERIOD ONLY / GLOBAL SCOPE
```

Crucial invariant:

```text
selected KPI filter MUST NOT re-scope overview counts
```

Capture actual:

```text
before period change
after period change
selected KPI aria-pressed
URL
overview total
table total
API requests
```

---

# 11. Static KPI Overview Under Table-Only Filter

At a fixed period:

```text
click/select one KPI filter
```

Verify:

```text
table changes
selected KPI becomes active
other KPI counts do NOT zero
other KPI counts do NOT recalculate due to table-only filter
```

Then change only the Header Period.

Verify:

```text
all KPI overview values may recompute
table remains filtered by selected KPI
```

Do this at minimum on:

```text
Requests
Orders
Bookings
Payments
```

---

# 12. Header Period Clear

From a bounded period:

```text
dateFrom
dateTo
```

and with one compatible selected KPI/table-only filter active:

clear the Header Period.

Required:

```text
dateFrom removed
dateTo removed
selected KPI/table-only filter preserved
page resets to 1
KPI overview recomputes for default/unbounded period
table refetches for default/unbounded period + selected KPI filter
```

Registry Reset is NOT used for this case.

---

# 13. Registry Reset Must Not Clear Header Period

For each registry:

1. set Header Period
2. add local search and/or KPI/table-only filter
3. press registry Reset

Required:

```text
KEEP:
dateFrom/dateTo

CLEAR:
registry-local search
registry-local KPI/table-only filters
registry-local sort if reset contract says so
page → 1
```

Header Period must remain unchanged.

---

# 14. Tab Switch Semantics

Start on one registry with:

```text
dateFrom/dateTo
+ registry-local filter
+ search
+ sort
```

Switch tabs:

```text
Requests → Orders
Orders → Bookings
Bookings → Payments
Payments → Requests
```

Required:

```text
KEEP:
dateFrom/dateTo

RESET:
selected KPI/table-only filter from previous registry
search
page
registry-specific state
sort unless explicitly justified otherwise
```

Tab link must carry period only, not unrelated entity-specific filters.

Capture actual URLs before and after.

---

# 15. Reload

For all four registries, at least one bounded period:

```text
URL with dateFrom/dateTo
→ reload
```

Required:

```text
Header Period restores from URL
KPI overview restores same period scope
table restores same period scope
```

At least one case must also include a compatible selected KPI/table-only filter.

---

# 16. Popstate / Back-Forward Restore

Use the canonical Operations Center URL model.

Do NOT require per-filter history entries if registry URL state uses replace semantics.

Instead stage two real browser history entries carrying different valid URLs, then use genuine:

```text
history.back()
history.forward()
```

Required after popstate:

```text
Header Period matches restored URL
registry-local filter state matches restored URL
selected KPI matches URL
table query matches URL
overview query matches global period
no state desync
```

Perform at least:

```text
one Orders case
one Requests or Payments case
```

---

# 17. Partial Period Inputs

Qualify behavior for:

```text
dateFrom only
dateTo only
```

Use the actual accepted backend semantics.

Required:

```text
no frontend crash
URL remains authoritative
API receives only the supplied bound
KPI and table use same global period scope
```

If the product intentionally forbids partial ranges, prove the canonical validation behavior instead.

Do not invent a new rule.

---

# 18. Invalid Date Handling

Verify canonical backend/UI behavior for malformed date parameters on the relevant registry endpoints.

Known Requests contract:

```text
malformed Requests date → HTTP 400
```

Do not generalize one domain's HTTP code to another without actual proof.

Record actual behavior for:

```text
Requests
Orders
Bookings
Payments
```

Goal:

```text
no silent fallback
no client/server scope divergence
```

---

# 19. Active-Domain-Only Fetching

Switch among Operations Center tabs.

Verify:

```text
only active registry domain mounts/fetches
inactive registry data queries are not fired just because tabs exist
```

Header Period must not cause all four registry domains to fetch simultaneously.

Capture Network proof.

---

# 20. Race / Rapid Period Changes

Rapidly change the period at least twice.

Required:

```text
final URL == final visible Header Period
final KPI overview == final period
final table == final period
no stale earlier response overwrites final state
no infinite request loop
```

If request cancellation/deduplication is not implemented, final rendered state still must correspond to the final URL.

---

# 21. Network Proof

For each registry capture actual list/overview requests.

Required:

```text
dateFrom/dateTo present as expected
selected table-only filter present only in table scope
overview request does not accidentally inherit table-only filter
```

Where backend uses one endpoint returning both table + aggregates, prove that the server aggregates remain global-scope while table total is table-scoped.

No request storm.

---

# 22. Console Proof

After all qualification scenarios:

```text
Router render warnings             — 0
React warnings introduced          — 0
Hydration mismatches               — 0
Uncaught exceptions                — 0
Infinite update warnings           — 0
```

---

# 23. Responsive Smoke

Check shared Header Period at minimum:

```text
desktop
narrow/mobile-ish viewport
```

Required:

```text
Period remains usable
does not overlap registry tabs
does not obscure primary controls
no horizontal layout break severe enough to block operation
```

Do not redesign in this stage.

---

# 24. Accessibility Smoke

Verify:

```text
date inputs/controls keyboard reachable
labels / accessible names present
focus visible
tab order logical
```

No deep accessibility redesign; qualification only.

---

# 25. Regression Tests / Build

Run the existing relevant suites, at minimum:

```text
operations-center-shell
requests-registry
orders-registry
bookings-registry
payments-registry
shared date/header tests if present
frontend TSC
frontend build
full relevant vitest
```

Record exact counts.

Any known pre-existing unrelated failure must be identified explicitly.

---

# 26. No Functional Source Changes Rule

Before Git closure:

```bash
git status --porcelain=v1
git diff --stat
git diff --check
```

Expected qualification changes:

```text
docs/prompts/...
docs/reports/...
docs/evidence/...
```

If functional source files changed:

```text
STOP
REPORT WHY
VERDICT B unless a newly reproduced defect genuinely requires remediation
```

Do not silently convert qualification into implementation work.

---

# 27. Git Hard Closure

Track all stage artifacts:

```text
1B original prompt
1B remediation prompt
1B final qualification prompt
reports
evidence
screenshots/network captures
```

Commit documentation/evidence closure.

Example:

```text
docs: finalize UI-C1.2F.1B qualification
```

Push:

```bash
git push origin master
git fetch origin
```

Then provide literal output:

```bash
git status --porcelain=v1
git rev-parse HEAD
git rev-parse origin/master
git log -5 --oneline --decorate
```

Also prove ancestry of the 1B functional remediation commit if known.

Known prior functional remediation SHA:

```text
ea5f6dc533dea49238a33627baf0586ace481758
```

Use:

```bash
git merge-base --is-ancestor ea5f6dc533dea49238a33627baf0586ace481758 HEAD
echo $LASTEXITCODE
```

Required:

```text
status → NO OUTPUT
HEAD == origin/master
ancestry exit code → 0
```

If that SHA is not present in the current repository history, stop and explain rather than inventing ancestry.

---

# 28. Required Final Report

Use ACTUAL values.

```text
UI-C1.2F.1B — FINAL QUALIFICATION

QUALIFICATION HEAD BEFORE TEST:
<sha>

FUNCTIONAL REMEDIATION SHA:
ea5f6dc533dea49238a33627baf0586ace481758
(or verified actual replacement SHA if repository history proves otherwise)

FINAL SHA:
<sha>

CURRENT RUNTIME RESTARTED            — PASS

SHARED HEADER PRESENT 4/4            — PASS
NO LOCAL DATE CONTROLS               — PASS
ORDERS "ОБНОВИТЬ" REMOVED            — PASS

REQUESTS PERIOD A/B                   — PASS
ORDERS PERIOD A/B                     — PASS
BOOKINGS PERIOD A/B                   — PASS
PAYMENTS PERIOD A/B                   — PASS

API ↔ UI RECONCILIATION 4/4          — PASS

SELECTED KPI PRESERVED ON PERIOD      — PASS
STATIC KPI OVERVIEW RULE              — PASS
HEADER PERIOD CLEAR                   — PASS
REGISTRY RESET PRESERVES PERIOD       — PASS
TAB SWITCH CARRIES PERIOD ONLY        — PASS
RELOAD                               — PASS
POPSTATE RESTORE                      — PASS
PARTIAL RANGE                         — PASS
INVALID DATE HANDLING                — PASS
ACTIVE-DOMAIN-ONLY FETCH              — PASS
RACE / FINAL-URL AUTHORITY            — PASS

NETWORK SCOPE                         — PASS
NETWORK STORM                         — NONE
ROUTER/REACT/HYDRATION ERRORS         — 0

RESPONSIVE SMOKE                      — PASS
ACCESSIBILITY SMOKE                   — PASS

TARGETED TESTS                        — <actual>
FULL VITEST                           — <actual>
TSC                                   — PASS
BUILD                                 — PASS

FUNCTIONAL SOURCE CHANGES
DURING QUALIFICATION                  — NONE

ALL STAGE ARTIFACTS TRACKED           — PASS
WORKING TREE CLEAN                    — PASS
HEAD == origin/master                 — PASS
FUNCTIONAL REMEDIATION ANCESTRY       — PASS
GIT HARD CLOSURE                      — PASS
```

---

# 29. Acceptance Rule

Only if all mandatory checks are proven:

```text
VERDICT A — UI-C1.2F.1B ACCEPTED
```

Otherwise:

```text
VERDICT B — UI-C1.2F.1B NOT ACCEPTED

BLOCKER:
<exact reproduced defect or missing proof>
```

Do not self-award PASS for cases shown only as “expected”.

---

# 30. STOP

After qualification:

```text
STOP
```

Do not start:
- UI-C1.2F.1E
- UI-C1.2F.1F
- UI-C1.2F.1H
- UI-C1.2F.1I
- UI-C1.2G
- UI-C2
- D8

Wait for independent review.
