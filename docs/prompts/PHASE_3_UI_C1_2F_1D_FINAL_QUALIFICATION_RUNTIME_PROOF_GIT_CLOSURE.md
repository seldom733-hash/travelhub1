# PHASE 3 — UI-C1.2F.1D — FINAL QUALIFICATION
## Orders One-Active-KPI Runtime Proof + Git Hard Closure

---

# 0. Цель

Функциональный remediation уже реализован и закоммичен:

```text
IMPLEMENTATION SHA:
e25a4a8ec52db02362dfeb142ca6fec86b340e2c
```

Текущий остаточный scope:

```text
1. FINAL RUNTIME QUALIFICATION
2. GIT HARD CLOSURE
```

Никаких новых функциональных изменений не требуется, если final qualification не обнаружит реальный дефект.

---

# 1. Подтверждённый текущий Git state

Последний фактический state:

```text
HEAD:
e25a4a8ec52db02362dfeb142ca6fec86b340e2c

origin/master:
e25a4a8ec52db02362dfeb142ca6fec86b340e2c
```

Остался один untracked artifact:

```text
?? docs/prompts/PHASE_3_UI_C1_2F_1D_REMEDIATION_R1_ORDERS_ONE_ACTIVE_KPI_INVARIANT.md
```

Поэтому сейчас:

```text
FUNCTIONAL COMMIT EXISTS      — PASS
HEAD == origin/master         — PASS
WORKING TREE CLEAN            — FAIL
GIT HARD CLOSURE              — FAIL
FINAL RUNTIME QUALIFICATION   — INCOMPLETE
```

---

# 2. Strict Scope

Allowed:

```text
runtime qualification only
browser evidence
network evidence if needed
track remaining prompt file
final docs/closure commit
push
literal Git proof
```

Forbidden unless qualification finds a real blocker:

```text
new feature work
business-logic refactor
sorting changes
filter architecture changes
Requests changes
Bookings/Payments work
UI-C1.2G
UI-C2
D8
```

---

# 3. Runtime Must Be Current

Browser evidence MUST be captured against the current code corresponding to:

```text
e25a4a8ec52db02362dfeb142ca6fec86b340e2c
```

Do not use stale bundle evidence.

Before testing, prove runtime freshness by one of:

```text
A. restart dev server from current HEAD
or
B. build/start from current HEAD
or
C. otherwise provide explicit evidence that served bundle/source maps correspond to current HEAD
```

Preferred:

```text
restart current frontend runtime
```

Do not rely on wording like:

```text
old bundle
```

without proof that current source is actually being executed.

---

# 4. Mandatory Browser Qualification — CLOSED → PAID

Start from canonical lifecycle state:

```text
/app/orders?status=CLOSED
```

Verify BEFORE transition:

```text
URL contains status=CLOSED
URL does NOT contain paymentStatus

KPI CLOSED:
aria-pressed=true

all payment KPIs:
aria-pressed=false

Status header:
CLOSED

Payment header:
All/default
```

Then select:

```text
Payment header → PAID
```

or click KPI:

```text
PAID
```

Verify AFTER transition:

```text
URL contains paymentStatus=PAID
URL does NOT contain status

KPI PAID:
aria-pressed=true

KPI CLOSED:
aria-pressed=false

all lifecycle KPIs:
aria-pressed=false

Payment header:
PAID

Status header:
All/default
```

Mandatory invariant:

```text
count(specific KPI cards with aria-pressed=true) == 1
```

---

# 5. Mandatory Browser Qualification — PAID → CLOSED

Start from canonical payment state:

```text
/app/orders?paymentStatus=PAID
```

Verify BEFORE transition:

```text
URL contains paymentStatus=PAID
URL does NOT contain status

KPI PAID:
aria-pressed=true

all lifecycle KPIs:
aria-pressed=false

Payment header:
PAID

Status header:
All/default
```

Then select:

```text
Status header → CLOSED
```

or click KPI:

```text
CLOSED
```

Verify AFTER transition:

```text
URL contains status=CLOSED
URL does NOT contain paymentStatus

KPI CLOSED:
aria-pressed=true

KPI PAID:
aria-pressed=false

all payment KPIs:
aria-pressed=false

Status header:
CLOSED

Payment header:
All/default
```

Mandatory invariant:

```text
count(specific KPI cards with aria-pressed=true) == 1
```

---

# 6. Dual-Filter Deep-Link Qualification

Open manually:

```text
/app/orders?status=CLOSED&paymentStatus=PAID
```

Expected deterministic canonicalization:

```text
status wins
paymentStatus removed
```

Final state:

```text
URL:
?status=CLOSED

CLOSED KPI:
aria-pressed=true

PAID KPI:
aria-pressed=false

specific pressed count:
1
```

This must happen on current runtime.

---

# 7. Total Reset Qualification

From either active state:

```text
status=CLOSED
```

or:

```text
paymentStatus=PAID
```

click:

```text
Total
```

Expected:

```text
status removed
paymentStatus removed

all specific KPI cards:
aria-pressed=false

Total:
aria-pressed=true

Status header:
All/default

Payment header:
All/default
```

---

# 8. Preserve Unrelated URL State

Repeat one dimension switch with:

```text
dateFrom
dateTo
search
sortBy
sortDirection
```

Example:

```text
/app/orders
?dateFrom=2026-09-01
&dateTo=2026-10-01
&search=ORD
&status=CLOSED
&sortBy=amount
&sortDirection=asc
```

Switch to PAID.

Expected:

```text
KEEP:
dateFrom
dateTo
search
sortBy
sortDirection

REMOVE:
status

SET:
paymentStatus=PAID

RESET:
page=1
```

---

# 9. Network Evidence

Capture actual list requests for both transitions.

## CLOSED → PAID

Expected request contains:

```text
paymentStatus=PAID
```

and does NOT contain:

```text
status=
```

## PAID → CLOSED

Expected request contains:

```text
status=CLOSED
```

and does NOT contain:

```text
paymentStatus=
```

If period/search/sort are present, prove they are preserved in the same request.

---

# 10. Back / Forward / Reload

Minimum required:

## Reload

```text
?status=CLOSED
→ reload
→ exactly CLOSED remains active
```

```text
?paymentStatus=PAID
→ reload
→ exactly PAID remains active
```

## Back / Forward

Perform:

```text
CLOSED
→ PAID
→ Back
→ CLOSED

→ Forward
→ PAID
```

At every state:

```text
only one specific KPI active
URL has only one KPI dimension
header filter matches active dimension
```

---

# 11. Evidence Format

Provide exact runtime proof, not narrative only.

Recommended:

```text
CASE 1 — CLOSED → PAID

BEFORE URL:
...

BEFORE:
CLOSED aria-pressed=true
PAID aria-pressed=false

AFTER URL:
...

AFTER:
CLOSED aria-pressed=false
PAID aria-pressed=true

SPECIFIC PRESSED COUNT:
1
```

Repeat for:

```text
PAID → CLOSED
DUAL-FILTER NORMALIZATION
TOTAL RESET
BACK/FORWARD
```

Screenshots are useful but not sufficient without exact URL/state values.

---

# 12. Track Remaining Prompt File

Current untracked artifact:

```text
docs/prompts/PHASE_3_UI_C1_2F_1D_REMEDIATION_R1_ORDERS_ONE_ACTIVE_KPI_INVARIANT.md
```

Add it to Git.

Do NOT delete it merely to obtain clean status.

Example:

```bash
git add docs/prompts/PHASE_3_UI_C1_2F_1D_REMEDIATION_R1_ORDERS_ONE_ACTIVE_KPI_INVARIANT.md
```

If final qualification report/evidence files are created, they also must be tracked.

---

# 13. Commit Final Qualification / Docs Closure

Use a separate docs/closure commit.

Example:

```text
docs: finalize UI-C1.2F.1D remediation qualification
```

Do not amend the already-pushed functional implementation commit unless repository policy explicitly requires it.

Preserve:

```text
IMPLEMENTATION SHA:
e25a4a8ec52db02362dfeb142ca6fec86b340e2c
```

Final repository SHA may be newer.

---

# 14. Push

```bash
git push origin master
```

Then fetch if needed:

```bash
git fetch origin
```

---

# 15. Final Literal Git Proof

Mandatory commands:

```bash
git status --porcelain=v1
git rev-parse HEAD
git rev-parse origin/master
git log -5 --oneline --decorate
git merge-base --is-ancestor e25a4a8ec52db02362dfeb142ca6fec86b340e2c HEAD
```

Required:

```text
git status --porcelain=v1
→ NO OUTPUT

HEAD
→ <FINAL_SHA>

origin/master
→ <SAME_FINAL_SHA>

implementation ancestry
→ exit code 0
```

---

# 16. Acceptance Criteria

PASS only if ALL:

```text
1. CLOSED → PAID runtime transition proven
2. PAID → CLOSED runtime transition proven
3. previous KPI becomes aria-pressed=false
4. new KPI becomes aria-pressed=true
5. specific pressed KPI count == 1
6. URL contains only one KPI dimension
7. header filter reflects active dimension
8. opposite header resets
9. dual-filter deep-link canonicalizes deterministically
10. Total clears both dimensions
11. Reload preserves single-dimension state
12. Back/Forward preserves invariant
13. period/search/sort preserved during switch
14. network requests contain only active dimension
15. current runtime freshness proven
16. remaining prompt file tracked
17. no untracked stage artifacts
18. working tree clean
19. HEAD == origin/master
20. implementation SHA ancestor of final HEAD
```

---

# 17. Required Final Verdict

```text
VERDICT A — UI-C1.2F.1D REMEDIATION R1
FINAL QUALIFICATION — ACCEPTED

IMPLEMENTATION SHA:
e25a4a8ec52db02362dfeb142ca6fec86b340e2c

FINAL SHA:
<actual>

CURRENT RUNTIME PROOF              — PASS
CLOSED → PAID                      — PASS
PAID → CLOSED                      — PASS
ONE ACTIVE KPI                     — PASS
URL SINGLE-DIMENSION               — PASS
HEADER ↔ KPI SYNC                  — PASS
DUAL-FILTER CANONICALIZATION       — PASS
TOTAL RESET                        — PASS
RELOAD                             — PASS
BACK/FORWARD                       — PASS
PERIOD/SEARCH/SORT PRESERVATION    — PASS
NETWORK EVIDENCE                   — PASS

PROMPT TRACKED                     — PASS
NO UNTRACKED STAGE ARTIFACTS       — PASS
WORKING TREE CLEAN                 — PASS
HEAD == origin/master              — PASS
IMPLEMENTATION ANCESTRY            — PASS
GIT HARD CLOSURE                   — PASS

UI-C1.2F.1D — ACCEPTED
```

If any mandatory item fails:

```text
VERDICT B — UI-C1.2F.1D
FINAL QUALIFICATION — FAIL

BLOCKER:
<exact issue>
```

---

# 18. Stop Rule

After final qualification:

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
