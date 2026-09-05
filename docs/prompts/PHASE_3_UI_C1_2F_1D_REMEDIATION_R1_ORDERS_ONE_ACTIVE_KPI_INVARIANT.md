# PHASE 3 — UI-C1.2F.1D — REMEDIATION R1
## Orders One-Active-KPI Invariant + Header Filter State Unification

---

# 0. Цель

Исправить единственный подтверждённый blocker этапа:

```text
UI-C1.2F.1D — Orders Table-Header Filtering + Sorting Alignment
```

Функциональная проблема:

```text
status=CLOSED
paymentStatus=PAID
→ одновременно две KPI-карты pressed=true
```

Это нарушает ранее принятый канонический контракт Orders:

```text
ONE ACTIVE KPI AT A TIME
```

После remediation:

```text
выбран lifecycle KPI / Status filter
→ paymentStatus очищается

выбран payment KPI / Payment filter
→ status очищается
```

KPI card и table-header filter должны быть двумя UI-входами в ОДНО и то же состояние.

---

# 1. Baseline

Текущий synced baseline:

```text
HEAD / origin/master:
1ecee13d18614e2e53469d50c2271bdadf2d883e
```

`UI-C1.2F.1G` уже ACCEPTED и не должен быть затронут.

Текущий статус этапов:

```text
UI-C1.2F.1C — ACCEPTED
UI-C1.2F.1D — NOT ACCEPTED
UI-C1.2F.1G — ACCEPTED
```

---

# 2. Подтверждённый дефект

Ранее runtime evidence для Orders показал:

```text
URL:
?status=CLOSED&paymentStatus=PAID&sortBy=amount&sortOrder=asc

UI:
KPI "Закрыт"   pressed=true
KPI "Оплачен"  pressed=true
```

Это является blocker.

Нельзя закрывать remediation только unit-тестом без browser/runtime proof.

---

# 3. Канонический Orders KPI contract

Orders имеет две KPI dimensions:

```text
Lifecycle:
status

Payment:
paymentStatus
```

Но selection model:

```text
ACTIVE KPI DIMENSION = ONE
```

То есть в любой момент активен максимум один KPI card из:

```text
lifecycle status cards
payment status cards
```

`Total` = none selected.

---

# 4. Required State Semantics

## A. Lifecycle selection

```text
click Status KPI
OR
select Status from table-header filter
```

must produce:

```text
status=<value>
paymentStatus removed
page=1
```

Result:

```text
exactly one lifecycle KPI active
all payment KPIs inactive
Status header filter shows selected value
Payment header filter shows All/default
```

## B. Payment selection

```text
click Payment KPI
OR
select Payment from table-header filter
```

must produce:

```text
paymentStatus=<value>
status removed
page=1
```

Result:

```text
exactly one payment KPI active
all lifecycle KPIs inactive
Payment header filter shows selected value
Status header filter shows All/default
```

## C. Total

```text
click Total
```

must remove:

```text
status
paymentStatus
```

and set:

```text
page=1
```

while preserving global/non-KPI scope.

---

# 5. KPI ↔ Table Header = Same State

Canonical principle:

```text
KPI CARD
and
TABLE HEADER FILTER
are not separate filters

They are two UI entry points into the same URL-authoritative state.
```

Example:

```text
Header Status → CLOSED
→ URL status=CLOSED
→ paymentStatus absent
→ KPI CLOSED pressed=true
```

Reverse:

```text
KPI PAID click
→ URL paymentStatus=PAID
→ status absent
→ Payment header shows PAID
→ Status header reset
```

No duplicate local state.

---

# 6. URL Authority

Orders state must remain URL-authoritative.

Valid examples:

```text
/app/orders?status=CLOSED
```

or:

```text
/app/orders?paymentStatus=PAID
```

Invalid canonical steady-state:

```text
/app/orders?status=CLOSED&paymentStatus=PAID
```

If such a URL is manually entered or restored from old history, define deterministic canonicalization:

```text
preferred remediation:
normalize to exactly one active KPI dimension
```

Choose one deterministic rule and document it.

Recommended:

```text
if both are present on initial URL:
→ keep the last meaningful/explicitly resolved dimension if available
→ otherwise apply a fixed canonical precedence
```

If code cannot know "last", use a fixed documented precedence and normalize URL.

Do NOT allow UI to render two active KPI cards.

---

# 7. Preserve Existing Sorting

This remediation must NOT regress accepted sorting work.

Keep current server-side sorting behavior and URL params.

Do not refactor sorting unless required for state preservation.

Verify combinations:

```text
status + sort
paymentStatus + sort
```

Sorting must survive filter switching where compatible.

---

# 8. Period Scope

Shared Header Period remains GLOBAL:

```text
dateFrom/dateTo
→ affects KPI overview
→ affects table
```

KPI/header status/payment filters remain TABLE-ONLY:

```text
status/paymentStatus
→ table changes
→ KPI overview counts remain static
```

Switching KPI dimension must not clear:

```text
dateFrom
dateTo
search
sort
```

except page resets to 1.

---

# 9. Search Coexistence

Verify:

```text
search + status
search + paymentStatus
search + status + sort
search + paymentStatus + sort
period + search + status + sort
period + search + paymentStatus + sort
```

Switching lifecycle ↔ payment must only replace the KPI dimension.

---

# 10. Reset Semantics

Orders Reset:

```text
CLEAR:
search
status
paymentStatus
sortBy
sortOrder/sortDirection
page → 1

KEEP:
dateFrom
dateTo
workspace/tenant/global scope
```

Do not change shared Header Period reset behavior.

---

# 11. Header Filter Behavior

Status header filter:

```text
select value
→ clear paymentStatus
→ set status
→ page=1
```

Payment header filter:

```text
select value
→ clear status
→ set paymentStatus
→ page=1
```

Choosing `All` in active dimension:

```text
remove that dimension
→ no KPI active
→ Total active
```

---

# 12. KPI Card Behavior

Lifecycle KPI click:

```text
set status
clear paymentStatus
page=1
```

Payment KPI click:

```text
set paymentStatus
clear status
page=1
```

Clicking already-active KPI may follow existing accepted Orders behavior:

```text
either remain selected
or reset to Total
```

Do not invent a new toggle rule if current accepted behavior already defines it.

Preserve current contract.

---

# 13. Browser / Runtime Evidence — Mandatory

Provide real browser evidence for all cases.

## A. Lifecycle → Payment

```text
start:
status=CLOSED

then select/click:
paymentStatus=PAID

expected:
status removed
paymentStatus=PAID
only PAID KPI pressed=true
CLOSED KPI pressed=false
```

## B. Payment → Lifecycle

```text
start:
paymentStatus=PAID

then select/click:
status=CLOSED

expected:
paymentStatus removed
status=CLOSED
only CLOSED KPI pressed=true
PAID KPI pressed=false
```

## C. Header → KPI sync

```text
Status header CLOSED
→ CLOSED KPI selected

Payment header PAID
→ PAID KPI selected
→ CLOSED deselected
```

## D. KPI → Header sync

```text
Lifecycle KPI
→ Status header reflects it

Payment KPI
→ Payment header reflects it
→ Status header resets
```

## E. Total

```text
click Total
→ status absent
→ paymentStatus absent
→ both header filters All
→ all specific KPIs inactive
```

## F. Reload

Reload representative URLs and prove canonical state.

## G. Back / Forward

Switch between lifecycle/payment and prove history restores a single active KPI state.

---

# 14. Network Evidence — Mandatory

Show actual list requests.

Lifecycle:

```text
GET /orders?...&status=CLOSED
```

must NOT include paymentStatus.

Payment:

```text
GET /orders?...&paymentStatus=PAID
```

must NOT include status.

With period/search/sort, prove unrelated params are preserved.

---

# 15. Tests — Required

Add/update Orders tests for the invariant.

Minimum:

```text
lifecycle KPI clears paymentStatus
payment KPI clears status

Status header clears paymentStatus
Payment header clears status

only one KPI aria-pressed=true

Header Status → KPI sync
Header Payment → KPI sync
KPI Status → Header sync
KPI Payment → Header sync

Total clears both dimensions

filter switch → page=1
period preserved
search preserved
sort preserved

reload with status
reload with paymentStatus

manual URL with both dimensions
→ deterministic canonicalization
→ never two pressed KPI cards
```

Important:

The previous test suite passed while browser runtime still showed two active KPI cards.

Therefore the new tests MUST specifically assert:

```text
count(aria-pressed="true" among specific KPI cards) <= 1
```

and ideally:

```text
URL never retains both status and paymentStatus after interaction
```

---

# 16. Regression

Run at minimum:

```text
orders-registry
operations-center-shell
table-header-filter
registry-url-state
frontend TSC
frontend build
```

If backend unchanged, no backend logic change should be introduced.

If backend files are touched, justify why and run targeted backend tests.

Also run Requests registry regression because `UI-C1.2F.1G` is already accepted and shared URL/filter helpers may be involved.

---

# 17. Security / Scope

Do not weaken:

```text
RBAC
workspace/tenant isolation
404-like cross-context behavior
server-side filtering
server-side sorting
```

No frontend-only authorization logic.

---

# 18. Files Changed

Final report must list every changed file and why.

Expected remediation should be small.

If many unrelated files change:

```text
STOP
```

and explain.

---

# 19. Git Hard Closure

Before commit:

```bash
git status --porcelain=v1
git diff --check
git diff --stat
```

After implementation:

```bash
git add <stage-owned-files>
git diff --cached --check
git commit -m "fix(orders): enforce one active KPI filter"
git push origin master
```

Then literal proof:

```bash
git status --porcelain=v1
git rev-parse HEAD
git rev-parse origin/master
git log -5 --oneline --decorate
```

Required:

```text
status → NO OUTPUT
HEAD == origin/master
```

No untracked stage prompt/report/evidence files.

---

# 20. Acceptance Criteria

PASS only if ALL:

```text
1. lifecycle selection clears paymentStatus
2. payment selection clears status
3. Status header follows same rule
4. Payment header follows same rule
5. exactly one specific KPI active at a time
6. Total clears both KPI dimensions
7. KPI ↔ Header synchronization works both ways
8. URL never settles with both filters after UI interaction
9. manual dual-filter URL handled deterministically
10. static KPI overview preserved
11. period preserved
12. search preserved
13. sorting preserved
14. page resets to 1 on KPI dimension switch
15. reload works
16. Back/Forward works
17. network evidence proves single-dimension requests
18. Orders tests explicitly protect one-active invariant
19. Requests regression passes
20. TSC/build passes
21. working tree clean
22. HEAD == origin/master
```

---

# 21. Required Final Verdict Format

```text
VERDICT A — UI-C1.2F.1D REMEDIATION R1
ORDERS ONE-ACTIVE-KPI INVARIANT
— ACCEPTED

FINAL SHA:
<actual>

LIFECYCLE → PAYMENT EXCLUSIVITY  — PASS
PAYMENT → LIFECYCLE EXCLUSIVITY  — PASS
STATUS HEADER EXCLUSIVITY        — PASS
PAYMENT HEADER EXCLUSIVITY       — PASS
ONE ACTIVE KPI                   — PASS
TOTAL RESET                      — PASS

KPI ↔ HEADER SAME STATE          — PASS
URL AUTHORITY                    — PASS
DUAL-FILTER URL NORMALIZATION    — PASS
STATIC KPI OVERVIEW              — PASS

PERIOD PRESERVATION              — PASS
SEARCH PRESERVATION              — PASS
SORT PRESERVATION                — PASS
PAGE RESET                       — PASS

RELOAD/BACK/FORWARD              — PASS
NETWORK EVIDENCE                 — PASS
ORDERS REGRESSION                — PASS
REQUESTS REGRESSION              — PASS
TSC/BUILD                        — PASS

WORKING TREE CLEAN               — PASS
HEAD == origin/master            — PASS
GIT HARD CLOSURE                 — PASS

UI-C1.2F.1D — ACCEPTED
```

If blocker remains:

```text
VERDICT B — UI-C1.2F.1D REMEDIATION R1
— NOT ACCEPTED

BLOCKER:
<exact runtime invariant violation>
```

---

# 22. Stop Rule

After this remediation:

```text
STOP
```

Do not automatically start:
- UI-C1.2F.1E
- UI-C1.2F.1F
- UI-C1.2F.1H
- UI-C1.2F.1I
- UI-C1.2G
- UI-C2
- D8

Wait for independent review.
