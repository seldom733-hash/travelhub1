# PHASE 3 — UI-C1.2F.1D — FINAL QUALIFICATION ONLY
## Orders R2 Current-Runtime Proof + Git Hard Closure

---

# 0. Purpose

`UI-C1.2F.1D Remediation R2` code is considered implemented.

This task is **QUALIFICATION ONLY**.

Do NOT change functional code unless a real runtime defect is reproduced during qualification.

Current unresolved points:

```text
CURRENT R2 RUNTIME PROOF          — NOT PROVEN
CLOSED → PAID ACTUAL PROOF        — NOT PROVEN
PAID → CLOSED ACTUAL PROOF        — NOT PROVEN
BACK/FORWARD ACTUAL PROOF         — NOT PROVEN
NETWORK ACTUAL PROOF              — NOT PROVEN
GIT HARD CLOSURE                  — NOT PROVEN
```

---

# 1. Strict Scope

Allowed:

```text
restart frontend on current HEAD
run browser qualification
capture URL / DOM / console / network evidence
run required regression tests
track stage prompt/report/evidence files
commit docs/evidence closure
push
provide literal Git proof
```

Forbidden unless an actual defect is reproduced:

```text
change Orders business logic
refactor Orders state model
change KPI semantics
change sorting/filter architecture
touch Requests behavior
start UI-C1.2F.1E
start UI-C1.2F.1F
start UI-C1.2G
start UI-C2
start D8
```

If a real runtime defect appears:

```text
STOP
REPORT VERDICT B
DO NOT silently fix it inside this qualification task
```

---

# 2. Prove Current Runtime

This is mandatory.

The previous report explicitly stated that an old dev bundle/server state was involved. That evidence is not sufficient.

Restart frontend from the current repository state.

Example:

```bash
git rev-parse HEAD
```

Record:

```text
QUALIFICATION HEAD:
<sha>
```

Then restart the frontend dev server from that exact working tree.

Example:

```bash
cd frontend
npm run dev
```

or the project’s canonical frontend startup command.

After restart, prove the browser session is using the restarted runtime.

Do NOT qualify against a stale tab/bundle.

---

# 3. Pre-Qualification Console State

Open browser DevTools.

Clear:

```text
Console
Network
```

Then open:

```text
/app/orders
```

Required baseline:

```text
no uncaught exceptions
no React render warning
no hydration error
```

Specifically:

```text
0 occurrences of:

Cannot update a component (`Router`) while rendering
a different component (`OrdersWithParams`)
```

---

# 4. CASE A — Invalid Dual-Filter Deep-Link

Open directly:

```text
/app/orders?status=CLOSED&paymentStatus=PAID
```

Capture ACTUAL result.

Required initial UI state:

```text
CLOSED aria-pressed=true
PAID aria-pressed=false
specific KPI pressed count=1
```

Required canonical URL after normalization:

```text
status=CLOSED
paymentStatus absent
```

Required headers:

```text
Status header = CLOSED
Payment header = All/default
```

Required console:

```text
no Router render warning
no React warning
no hydration mismatch
no uncaught exception
```

Required effect behavior:

```text
router normalization occurs once
no replace loop
no repeated history spam
```

Report actual values, not “expected”.

---

# 5. CASE B — CLOSED → PAID

Start from:

```text
/app/orders?status=CLOSED
```

Record BEFORE:

```text
URL:
...

CLOSED aria-pressed:
...

PAID aria-pressed:
...

specific pressed KPI count:
...

Status header:
...

Payment header:
...
```

Now select:

```text
Payment = PAID
```

via the table-header filter or KPI entry point.

Record AFTER:

```text
URL:
...

CLOSED aria-pressed:
...

PAID aria-pressed:
...

specific pressed KPI count:
...

Status header:
...

Payment header:
...
```

Required final state:

```text
paymentStatus=PAID
status absent

CLOSED aria-pressed=false
PAID aria-pressed=true
specific pressed KPI count=1

Status header = All/default
Payment header = PAID
```

---

# 6. CASE C — PAID → CLOSED

Start from:

```text
/app/orders?paymentStatus=PAID
```

Record BEFORE.

Then select:

```text
Status = CLOSED
```

Record AFTER.

Required final state:

```text
status=CLOSED
paymentStatus absent

PAID aria-pressed=false
CLOSED aria-pressed=true
specific pressed KPI count=1

Payment header = All/default
Status header = CLOSED
```

Again: actual evidence only.

---

# 7. CASE D — Total Reset

From:

```text
status=CLOSED
```

click:

```text
Total
```

Required:

```text
status absent
paymentStatus absent

all specific KPI cards aria-pressed=false
Total aria-pressed=true

Status header = All/default
Payment header = All/default
```

Repeat once from:

```text
paymentStatus=PAID
```

Required result is the same.

---

# 8. CASE E — Preserve Period / Search / Sort

Open:

```text
/app/orders?dateFrom=2026-09-01&dateTo=2026-10-01&search=ORD&status=CLOSED&sortBy=amount&sortDirection=asc
```

Switch from:

```text
CLOSED → PAID
```

Required final URL preserves:

```text
dateFrom=2026-09-01
dateTo=2026-10-01
search=ORD
sortBy=amount
sortDirection=asc
```

Required final URL removes:

```text
status
```

and sets:

```text
paymentStatus=PAID
```

If `page` was present before the switch:

```text
page must reset to 1 / disappear according to canonical URL behavior
```

---

# 9. CASE F — Reload

Verify:

```text
/app/orders?status=CLOSED
```

Reload.

Required:

```text
CLOSED remains active
PAID inactive
specific pressed count=1
URL still single-dimension
```

Then:

```text
/app/orders?paymentStatus=PAID
```

Reload.

Required:

```text
PAID remains active
CLOSED inactive
specific pressed count=1
URL still single-dimension
```

Then reload invalid deep-link:

```text
/app/orders?status=CLOSED&paymentStatus=PAID
```

Required:

```text
canonicalizes to status=CLOSED only
no console warning
```

---

# 10. CASE G — Back / Forward

Perform exactly:

```text
CLOSED
→ PAID
→ Back
→ CLOSED
→ Forward
→ PAID
```

At EACH step record:

```text
URL
CLOSED aria-pressed
PAID aria-pressed
specific pressed KPI count
Status header
Payment header
```

Mandatory invariant:

```text
specific pressed KPI count <= 1
```

Canonical expected count for specific selection states:

```text
1
```

---

# 11. Network Proof

Clear Network before each transition.

## CLOSED → PAID

Capture the actual `/orders` request.

Required:

```text
contains paymentStatus=PAID
does NOT contain status=CLOSED
```

## PAID → CLOSED

Required:

```text
contains status=CLOSED
does NOT contain paymentStatus=PAID
```

## Preserve-scope case

If period/search/sort are active, request must preserve applicable server-side query params.

Also inspect request count around invalid deep-link normalization.

Required:

```text
no request storm
no infinite loop
no repeated normalization requests
```

Provide actual request URLs or query strings.

---

# 12. Console Proof

After ALL browser scenarios, report:

```text
Router render warning count:
0

React warnings introduced by this stage:
0

Hydration mismatch count:
0

Uncaught exception count:
0
```

Do not write PASS without actual console inspection.

---

# 13. Regression Tests

Run at minimum:

```bash
cd frontend

npx tsc --noEmit

npx vitest run lib/orders-registry.spec.tsx

npx vitest run
```

Run the existing canonical build command:

```bash
npx next build
```

Also run targeted shared/Requests tests if they exist as separate commands in the repository:

```text
operations-center-shell
table-header-filter
registry-url-state
requests-registry
```

Record exact counts and exit codes.

A known pre-existing unrelated failure may be reported separately, but do not relabel a new failure as pre-existing without evidence.

---

# 14. No Functional Code Changes Rule

Before Git closure inspect:

```bash
git status --porcelain=v1
git diff --stat
git diff --check
```

Qualification should not introduce functional source changes.

Expected new changes may be limited to:

```text
docs/prompts/...
docs/reports/...
docs/evidence/...
```

If source files changed during this qualification:

```text
STOP
explain exactly why
VERDICT B unless change was strictly necessary to fix a newly reproduced defect
```

Do not fold a new remediation into this qualification task.

---

# 15. Track All Stage Artifacts

All stage artifacts must be tracked.

This includes, where present:

```text
R1 remediation prompt
R2 remediation prompt
final qualification prompt
R1 report
R2 report
final qualification report
runtime evidence
screenshots
network evidence
```

Do not delete valid stage artifacts merely to get a clean tree.

---

# 16. Commit + Push

Use a docs/evidence closure commit.

Example:

```text
docs: finalize UI-C1.2F.1D R2 qualification
```

Then:

```bash
git push origin master
git fetch origin
```

---

# 17. Literal Git Hard Closure Proof

Provide exact output of:

```bash
git status --porcelain=v1
git rev-parse HEAD
git rev-parse origin/master
git log -5 --oneline --decorate
git merge-base --is-ancestor <R2_IMPLEMENTATION_SHA> HEAD
```

Required:

```text
git status --porcelain=v1
<NO OUTPUT>

HEAD:
<FINAL_SHA>

origin/master:
<SAME_FINAL_SHA>

R2 implementation ancestry:
PASS / exit 0
```

If R2 implementation SHA was never separately recorded, identify the commit that contains the R2 source fix and prove that commit is an ancestor of final HEAD.

---

# 18. Required Final Qualification Report

Use this structure with ACTUAL values:

```text
UI-C1.2F.1D — R2 FINAL QUALIFICATION

QUALIFICATION HEAD BEFORE TEST:
<sha>

R2 IMPLEMENTATION SHA:
<sha>

FINAL SHA:
<sha>

CURRENT RUNTIME RESTARTED            — PASS

CASE A DUAL-FILTER DEEP-LINK          — PASS
  actual URL:
  CLOSED aria-pressed:
  PAID aria-pressed:
  specific pressed count:

CASE B CLOSED → PAID                  — PASS
  before URL:
  after URL:
  CLOSED aria-pressed:
  PAID aria-pressed:
  specific pressed count:

CASE C PAID → CLOSED                  — PASS
  before URL:
  after URL:
  CLOSED aria-pressed:
  PAID aria-pressed:
  specific pressed count:

CASE D TOTAL RESET                    — PASS

CASE E PERIOD/SEARCH/SORT PRESERVED   — PASS

CASE F RELOAD                         — PASS

CASE G BACK/FORWARD                   — PASS

NETWORK CLOSED → PAID:
<actual request>

NETWORK PAID → CLOSED:
<actual request>

NETWORK STORM                         — NONE

ROUTER RENDER WARNING                 — 0
NEW REACT WARNINGS                    — 0
HYDRATION ERRORS                      — 0
UNCAUGHT EXCEPTIONS                   — 0

ORDERS TESTS                          — <actual>
FULL VITEST                           — <actual>
TSC                                   — PASS
BUILD                                 — PASS

FUNCTIONAL SOURCE CHANGES IN
QUALIFICATION TASK                    — NONE

ALL STAGE ARTIFACTS TRACKED           — PASS
WORKING TREE CLEAN                    — PASS
HEAD == origin/master                 — PASS
R2 IMPLEMENTATION ANCESTRY            — PASS
GIT HARD CLOSURE                      — PASS
```

---

# 19. Acceptance Rule

Only if every mandatory item above is proven:

```text
VERDICT A — UI-C1.2F.1D ACCEPTED
```

Otherwise:

```text
VERDICT B — UI-C1.2F.1D NOT ACCEPTED

BLOCKER:
<exact reproduced failure or missing proof>
```

Do not self-award PASS for items shown only as expected behavior.

---

# 20. STOP

After qualification:

```text
STOP
```

Do not start any next stage.

Wait for independent review.
