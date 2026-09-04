# PHASE 3 — PRE-STEP 3.12 — D6 — FINAL EVIDENCE CLOSURE — ROUND 2

## ROLE — MANDATORY

Ты работаешь как **Staff/Principal Backend Engineer + Security Engineer + QA/Release Engineer**.

Это **финальный узкий closure D6**.

Canonical status:

```text
D5 — ACCEPTED

D6 — NOT ACCEPTED
D7 — NOT STARTED

TRUE NEXT:
D6 FINAL EVIDENCE CLOSURE — ROUND 2
```

Предыдущий remediation уже закрыл основную реализацию D6.

---

# 1. PRESERVE CLOSED D6 GATES

Следующие пункты считаются закрытыми и **не должны переделываться или повторно расширяться**, если этот Round 2 не обнаружит реальный regression:

```text
Booking canonical full-page /app/bookings/{id}
registry → full-page navigation
server-authoritative availableActions
Booking state machine
no-edit mutability contract
mass-assignment protection
invalid transition DB safety
basic immutable BookingHistory
authoritative actor/timestamps
failed business mutation → no false audit
optimistic concurrency / CAS double-transition safety
i18n cleanup
Browser A registry/full-page
Browser B lifecycle mutation
Browser C no-edit contract
Browser D terminal UI lock
Browser E Booking → Order
Browser F cross-context /app/bookings/{sfId} isolation
detail/history/action cross-context isolation
D5 regression
```

Do NOT start D7.

---

# 2. ONLY FOUR OPEN CLOSURE ITEMS

This round is limited to:

```text
C1 — REAL forced audit-failure rollback
C2 — explicit Browser G history proof
C3 — explicit DB == API == UI == Audit reconciliation
C4 — literal Git hard closure with one canonical SHA
```

No broad refactor.

No redesign of Booking Full-Page.

No new lifecycle statuses.

---

# 3. STARTING GIT STATE

Before any work run:

```bash
git branch --show-current
git status --short
git status --porcelain=v1
git rev-parse HEAD
git rev-parse origin/master
git log -5 --oneline
```

Previous report claimed:

```text
HEAD:
5886a2ebc55e143fe4ec6586129987e1272cf523

origin/master:
5886a2ebc55e143fe4ec6586129987e1272cf523
```

but also had an untracked prompt file.

Use the **actual current repository state**, not the previous narrative.

---

# 4. C1 — REAL FORCED AUDIT-FAILURE ROLLBACK

This is the most important remaining technical gate.

Previous evidence:

```text
failed transition → no false audit
forged action → no false audit
mass-assignment failure → no false audit
```

is preserved, but it does **NOT** prove:

```text
business mutation begins/succeeds inside transaction
→ audit write fails
→ entire business mutation rolls back
```

That exact invariant must now be tested.

## Required invariant

```text
BEFORE:
Booking status/version = X
Audit/BookingHistory count = N

ATTEMPT:
valid Booking mutation is executed
audit/history persistence is deliberately forced to fail
after the business mutation path has been entered

EXPECTED:
request/transaction fails
Booking status/version remains X
no successful new history/audit event
history count remains N
```

## Failure injection

Use a deterministic **test-only** mechanism.

Examples:

```text
override/inject audit/history writer and throw
mock repository/service write to throw
controlled DB write failure for history
equivalent test seam
```

Do NOT add a production-accessible failure switch.

Do NOT simulate this with:

```text
invalid transition
forbidden field
validation failure
nonexistent Booking
authorization failure
```

Those happen before the required audit-failure condition and do not count.

## Required evidence

Report:

```text
test file
test name
failure-injection mechanism
valid mutation attempted
Booking DB BEFORE
BookingHistory/Audit BEFORE
thrown exception / HTTP result
Booking DB AFTER
BookingHistory/Audit AFTER
```

PASS only if business mutation is rolled back.

If current implementation cannot roll back because mutation and history/audit are not in the same atomic transaction, this is a real D6 defect:

```text
fix transaction boundary
add test
rerun affected regression
```

Do not waive it.

---

# 5. C2 — EXPLICIT REAL BROWSER G HISTORY PROOF

Use the actual Booking lifecycle mutation from Browser B, or create one new safe disposable Booking mutation if the old representative is no longer suitable.

Required actual browser interaction:

```text
1. open /app/bookings/{bookingId}
2. perform or identify the mutation made in this closure
3. open/scroll to "История изменений" / canonical Booking history UI
4. visually verify the corresponding event
```

Evidence must state:

```text
Booking id/reference
URL
actor/workspace
mutation
previous state
new state
history event label
actor shown
timestamp shown
from → to or equivalent safe transition evidence
source/context if UI exposes it
PII leakage check
hard refresh result
```

If source/context is intentionally not rendered in UI, say so and verify it at API/DB/audit layer instead.

E2E/API-only proof does NOT replace Browser G.

---

# 6. C3 — EXPLICIT DB == API == UI == AUDIT RECONCILIATION

For the same representative lifecycle mutation used for Browser G, create one explicit reconciliation table.

Required format:

| Layer | Booking ID | State / transition | Actor/source | Evidence |
|---|---|---|---|---|
| DB | | | | |
| API | | | | |
| UI | | | | |
| Audit/BookingHistory | | | | |

Hard requirement:

```text
DB final state == API final state == UI final state
AND
Audit/History represents the same previous → final transition
```

Also prove:

```text
actor is correct
source/context is safe/server-authoritative
timestamps are coherent
no sensitive PII leaked
```

Do not write only:

```text
DB == API == UI
```

Audit/BookingHistory is mandatory in the reconciliation.

---

# 7. C4 — FINAL GIT HARD CLOSURE

Previous report failed because literal output was:

```text
?? docs/prompts/PHASE_3_PRE_STEP_3.12_D6_BOOKING_FULL_PAGE_DETAIL_IMPLEMENTATION.md
```

while the matrix incorrectly called porcelain empty.

This round requires **literal zero output**.

After code/test/evidence/report changes:

```bash
git status --short
git status --porcelain=v1
git rev-parse HEAD
git rev-parse origin/master
```

Commit/push all meaningful tracked artifacts.

For prompt/report files:

```text
either commit them if repository policy stores them
OR remove them from worktree if they are not meant to be tracked
```

No untracked files may remain.

Then execute again:

```bash
git status --short
git status --porcelain=v1
git rev-parse HEAD
git rev-parse origin/master
git log -5 --oneline
```

## Required literal evidence

```text
$ git status --porcelain=v1
<NO OUTPUT>

$ git rev-parse HEAD
<ONE 40-CHAR SHA>

$ git rev-parse origin/master
<SAME 40-CHAR SHA>
```

Required:

```text
HEAD == origin/master: YES
```

No:

```text
clean except...
only untracked...
ignored for verdict...
to be filled...
after push...
```

---

# 8. ONE CANONICAL SHA RULE

There must be exactly one final 40-character SHA used consistently in:

```text
Executive Summary
Acceptance Matrix
Git Hard Closure
Final Verdict
```

No stale short SHA such as previous `4240131`.

Starting SHA and historical SHAs may appear only when clearly labeled as historical/starting state.

---

# 9. TARGETED REGRESSION POLICY

If C1 requires **no production code change** and only adds a test/evidence:

Run:

```text
new forced-audit-failure test
d6-booking-remediation
d6-booking-fullpage
backend tsc
frontend tsc
```

If C1 reveals a real transaction defect and production code changes:

Run at minimum:

```text
forced-audit-failure suite
d6-booking-remediation
d6-booking-fullpage
relevant Booking lifecycle/history/security suites
d5-order-fullpage-audit
backend tsc
backend build
frontend tsc
frontend build
frontend vitest
```

If shared audit infrastructure changes, rerun every affected D3/D4/D5 suite.

Report exact commands/counts/results.

---

# 10. ROUND 2 ACCEPTANCE MATRIX — EXACT

Do not omit any row.

| Gate | Result | Exact Evidence |
|---|---|---|
| Starting Git state verified | | |
| Previously closed D6 implementation preserved | | |
| C1 uses valid Booking mutation | | |
| C1 deliberately forces audit/history write failure | | |
| C1 failure occurs inside required mutation/audit path | | |
| C1 Booking DB BEFORE captured | | |
| C1 Audit/History BEFORE captured | | |
| C1 request/transaction fails | | |
| C1 Booking mutation rolled back | | |
| C1 status/version unchanged AFTER | | |
| C1 no successful new audit/history AFTER | | |
| Failed business mutation → no false audit preserved | | |
| Browser G uses actual `/app/bookings/{id}` | | |
| Browser G actual history UI opened | | |
| Browser G actual mutation event visible | | |
| Browser G actor correct | | |
| Browser G timestamp visible/coherent | | |
| Browser G transition/diff correct | | |
| Browser G no PII leakage | | |
| Browser G hard refresh preserves history | | |
| DB final state captured | | |
| API final state captured | | |
| UI final state captured | | |
| Audit/History transition captured | | |
| DB == API == UI final state | | |
| Audit transition matches same mutation | | |
| Actor/source server-authoritative | | |
| Required targeted regressions PASS | | |
| Backend TSC PASS | | |
| Frontend TSC PASS | | |
| No unresolved P0/P1 | | |
| No unresolved acceptance-blocking P2 | | |
| D7 NOT STARTED | | |
| Final `git status --porcelain=v1` literally no output | | |
| Final HEAD == origin/master | | |
| One canonical 40-char Final SHA | | |

Any:

```text
FAIL
NOT RUN
NOT PROVEN
acceptance-blocking PARTIAL
```

→ `VERDICT B`.

---

# 11. REQUIRED REPORT

Create:

```text
docs/reports/PHASE_3_PRE_STEP_3.12_D6_FINAL_EVIDENCE_CLOSURE_ROUND_2_REPORT.md
```

Predominantly Russian.

Required sections:

1. Executive Summary
2. Starting Git State
3. Preserved D6 Gates
4. C1 Atomicity Architecture
5. C1 Failure Injection Mechanism
6. C1 DB/Audit BEFORE
7. C1 Forced Failure Execution
8. C1 DB/Audit AFTER
9. C1 Atomic Rollback Verdict
10. Browser G Environment
11. Browser G History Proof
12. Browser G Hard Refresh
13. DB→API→UI→Audit Reconciliation
14. Targeted Regression Matrix
15. Security Re-qualification
16. Round 2 Acceptance Matrix
17. Git Hard Closure — Literal Output
18. Findings
19. Final Verdict
20. TRUE NEXT

---

# 12. SECURITY RE-QUALIFICATION

Do not reopen already closed security work without cause.

Confirm preserved:

```text
cross-context detail isolation
history isolation
action isolation
RBAC
mass assignment protection
terminal immutability
optimistic concurrency
i18n cleanup
```

New focus:

```text
audit atomicity
false-audit prevention
history integrity
actor/source authority
PII-safe history
```

---

# 13. VERDICT A

Only if **every Round 2 gate** passes:

```text
VERDICT A — PHASE 3 PRE-STEP 3.12 D6 FINAL EVIDENCE CLOSURE ROUND 2 PASSED

D6 — ACCEPTED

FINAL SHA:
<one canonical 40-char SHA>

TRUE NEXT:
D7 — PAYMENT/REFUND SEMANTICS + FINANCIAL PRESENTATION

D7 IMPLEMENTATION — NOT STARTED
```

Then **STOP**.

---

# 14. VERDICT B

If any gate remains:

```text
VERDICT B — PHASE 3 PRE-STEP 3.12 D6 FINAL EVIDENCE CLOSURE ROUND 2 FAILED

D6 — NOT ACCEPTED
D7 — NOT STARTED

TRUE NEXT:
D6 EVIDENCE CLOSURE CONTINUATION
```

List exact blockers.

---

# 15. HARD STOP

This round authorizes only:

```text
forced audit-failure rollback proof/fix
+
Browser G history proof
+
DB→API→UI→Audit reconciliation
+
Git hard closure
```

Do not implement D7.

At completion:

```text
report
verdict
one final SHA
TRUE NEXT
STOP
```
