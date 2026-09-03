# PHASE 3 — PRE-STEP 3.12 — D5 — FINAL CLOSURE ROUND 2

## ROLE — MANDATORY

Ты работаешь как **Senior/Staff Software Engineer + Software Architect + Backend/Frontend/Database/Security/QA Engineer**.

Выполнить **ТОЛЬКО D5 Final Closure Round 2**.

Canonical starting status:

```text
D5 — NOT ACCEPTED
D6 — NOT STARTED
TRUE NEXT: D5 FINAL CLOSURE ROUND 2
```

Предыдущий D5 Final Remediation Continuation Report существенно продвинул D5, но его `VERDICT A` не принят независимой re-qualification.

**D6 НЕ НАЧИНАТЬ.**

---

# 1. STRICT SCOPE

Не повторять уже закрытые работы без regression. Round 2 закрывает только:

```text
R2-1 — traveler-edit ↔ final-confirm real TOCTOU defect
R2-2 — OperationalNote mutation + audit true atomicity
R2-3 — missing mandatory browser/runtime flows
R2-4 — complete Final Acceptance Matrix restoration
R2-5 — true Git hard closure + explicit final SHA
```

Запрещено переводить blocker в `DEFERRED / FUTURE / D7 / NON-BLOCKING / INFO / P3` только для получения `VERDICT A`.

---

# 2. STARTING GIT STATE

До изменений:

```bash
git branch --show-current
git status --short
git status --porcelain=v1
git rev-parse HEAD
git rev-parse origin/master
git log -10 --oneline
```

Зафиксировать branch, starting SHA, origin SHA, HEAD==origin, modified/untracked files.

Финальный hard requirement:

```text
git status --porcelain=v1 → EXACTLY EMPTY
```

`only untracked prompts` не является empty worktree.

---

# 3. R2-1 — FIX REAL TRAVELER / FINAL-CONFIRM TOCTOU

Предыдущий настоящий race:

```text
Promise.all([travelerEdit, finalConfirm])
```

показал, что **both traveler edit AND final-confirm can succeed**. Это не PASS и не D7 concern. Это D5 acceptance blocker.

## Canonical invariant

После успешного `final-confirm` traveler data frozen.

Корректные serializable outcomes:

```text
A:
traveler mutation commits first
→ final-confirm reads committed traveler state
→ validates
→ succeeds
→ travelers frozen

B:
final-confirm locks/commits first
→ traveler mutation re-checks authoritative state
→ mutation rejected
```

Недопустимо:

```text
final-confirm succeeds
AND
traveler mutation commits using stale pre-final authorization/state
after final state became authoritative
```

## Root-cause analysis

Проверить actual:

```text
transaction boundaries
SELECT FOR UPDATE / equivalent
lock acquisition order
finalConfirmedAt/status checks
traveler mutation read/write sequence
whether validation is inside the same transaction/lock
whether both paths lock the same authoritative Order row
```

Не исправлять race sleeps/process-local mutex.

Fix должен работать при multiple processes/containers/instances.

## Mandatory deterministic concurrency tests

```text
Race A — traveler mutation begins first; final-confirm races
Race B — final-confirm locks first; traveler mutation races
Race C — repeated race; forbidden outcome never occurs
Sequential post-final edit → controlled denial
Double final-confirm → idempotency preserved
```

Использовать barriers/hooks/controlled transaction interleaving where possible. `Promise.all()` без доказательства interleaving недостаточно.

Report: exact file, test names, command, interleaving method, API outcomes, DB Order/traveler state, audit events, absence of illegal FIELD_CHANGE.

---

# 4. R2-2 — OPERATIONALNOTE TRUE ATOMICITY

Предыдущий claim:

```text
Note mutation + audit atomic = PASS
"$transaction not used (append-only safe)"
```

недействителен.

Append-only AuditLog ≠ atomicity business mutation + audit.

Hard invariant:

```text
OperationalNote mutation
+
immutable AuditLog/revision
=
ONE atomic unit
```

Проверить actual storage/Prisma/schema/transaction architecture.

Для CREATE/UPDATE/DELETE обеспечить настоящую DB transaction, если обе записи находятся в одной PostgreSQL DB.

Если архитектура объективно не позволяет atomic guarantee — это blocker; не ставить PASS.

## Mandatory failure-injection tests

```text
CREATE: force audit failure → note MUST NOT exist
UPDATE: force audit failure → previous note value MUST remain
DELETE: force audit failure → note MUST remain undeleted/active
business mutation failure → no successful audit event
```

Report обязан показать final DB state.

---

# 5. R2-3 — COMPLETE BROWSER/RUNTIME EVIDENCE

API-only evidence не заменяет browser evidence.

На актуальном frontend/backend выполнить ВСЕ flows.

## A — Lifecycle
Orders registry → canonical full-page → Принять в работу → NEW→IN_PROCESSING.

Verify UI/API/DB/history/source/hard refresh/availableActions.

## B — Traveler edit
Safe pre-final D3 Order → edit allowed traveler field → save.

Verify UI/API/DB/history FIELD_CHANGE/safe old-new diff/PII masking/source/history refresh/hard refresh.

## C — Post-final traveler lock
Final-confirmed Order → attempt traveler edit.

Verify UI block or controlled server denial; DB unchanged; no successful FIELD_CHANGE.

## D — Representative C1
`READY_FOR_BOOKING`: displayed status, availableActions, forbidden actions, state-machine consistency. Do not destroy permanent evidence case.

## E — Representative C6
`CANCELLED / financial chain`: status, financial/lifecycle representation, actions, forbidden actions, history consistency. Do not destroy permanent evidence case.

## F — Storefront direct-ID isolation
Platform actor direct navigation:

```text
/app/orders/{storefrontOrderUuid}
```

Expected 404/controlled not-found/no existence leakage.

Also history endpoint for same Storefront Order → 404/denied.

Old D1A/query `total=0` does NOT replace this test.

## G — OperationalNote history
Through UI: create → edit → delete/soft-delete → inspect history/revision behavior.

Verify CREATE/UPDATE/DELETE accountability and no silent loss. If canonical UI intentionally does not expose history, prove that UX contract and provide browser-visible behavior + API/history evidence.

---

# 6. R2-4 — COMPLETE FINAL ACCEPTANCE MATRIX

Do NOT shorten or omit gates. Reused evidence must be marked `RE-VERIFIED` or `PRESERVED — exact evidence`.

| Gate | Result | Exact Evidence |
|---|---|---|
| Starting Git state classified | | |
| OperationalNote canonical audit policy implemented | | |
| Note CREATE immutable history preserved | | |
| Note UPDATE previous value/history preserved | | |
| Note DELETE does not erase accountability | | |
| Note mutation + audit/revision atomic | | |
| Note CREATE audit-failure rollback verified | | |
| Note UPDATE audit-failure rollback verified | | |
| Note DELETE audit-failure rollback verified | | |
| Note failed business mutation creates no false success audit | | |
| Note authorization preserved | | |
| Note tenant/workspace isolation preserved | | |
| Note sensitive-text policy verified | | |
| Real D4 concurrency/TOCTOU fixed | | |
| Race A controlled interleaving PASS | | |
| Race B controlled interleaving PASS | | |
| Repeated race has no forbidden outcome | | |
| Concurrency DB final state verified | | |
| Concurrency audit final state verified | | |
| Sequential post-final lock PASS | | |
| Double final-confirm idempotency PASS | | |
| D3 request-flow regression PASS | | |
| D3 traveler collection regression PASS | | |
| D4 traveler security PASS | | |
| D4 representative chain PASS | | |
| D4 remediation closure PASS | | |
| D5 order full-page audit regression PASS | | |
| Backend TSC PASS | | |
| Frontend TSC PASS | | |
| Backend build PASS | | |
| Frontend build PASS | | |
| Frontend vitest honestly classified | | |
| Browser lifecycle mutation PASS | | |
| Browser traveler edit PASS | | |
| Browser post-final lock PASS | | |
| Browser C1 PASS | | |
| Browser C6 PASS | | |
| Browser Storefront direct-ID isolation PASS | | |
| Storefront history endpoint isolation PASS | | |
| Browser OperationalNote revision/audit PASS | | |
| DB==API==UI==Audit lifecycle | | |
| DB==API==UI==Audit traveler | | |
| OperationalNote current+history reconcile | | |
| Legacy source semantics honest | | |
| Legacy history preserved/readable | | |
| New structured source persisted | | |
| Source spoofing protected | | |
| Audit pagination stable | | |
| Drawer/full-page action parity preserved | | |
| Cross-cutting audit framework unified | | |
| PII/secrets safe | | |
| Architecture doc synchronized | | |
| Roadmap synchronized | | |
| D6 NOT STARTED | | |
| No unresolved P0/P1 | | |
| No unresolved acceptance-blocking P2 | | |
| Report predominantly Russian | | |
| Final worktree EXACTLY EMPTY | | |
| HEAD == origin/master | | |
| Final SHA explicitly recorded | | |

Любой FAIL/NOT RUN/NOT PROVEN/acceptance-blocking PARTIAL → `VERDICT B`.

---

# 7. R2-5 — TRUE GIT HARD CLOSURE

После всех changes/tests/browser evidence/docs/report:

```bash
git status --short
git status --porcelain=v1
git rev-parse HEAD
git rev-parse origin/master
git log -5 --oneline
```

Hard requirement:

```text
git status --porcelain=v1 → NO OUTPUT
HEAD = origin/master
```

Не допускается `clean except ...`, `only prompts`, `only evidence`.

Не удалять user data без понимания происхождения. Meaningful project artifacts commit+push.

Final report:

```text
Final SHA: <full SHA>
origin/master: <same full SHA>
HEAD == origin/master: YES
git status --porcelain=v1: EMPTY
```

---

# 8. REQUIRED REGRESSION AFTER FIXES

Повторить:

```text
d3-request-flow
d3-traveler-collection
d4-traveler-security
d4-representative-chain
d4-remediation-closure
d5-order-fullpage-audit
d5-operational-note-audit
new controlled concurrency tests
new OperationalNote failure-injection tests
backend tsc
frontend tsc
backend build
frontend build
frontend vitest
```

Exact commands + exact counts. Known pre-existing frontend failure classify honestly.

---

# 9. SECURITY RE-QUALIFICATION

Re-check:

```text
traveler/final-confirm TOCTOU
post-final immutability
OperationalNote atomic accountability
OperationalNote authorization
OperationalNote tenant/workspace isolation
OperationalNote arbitrary-text/PII policy
Storefront direct-ID Order isolation
Storefront history isolation
source spoofing
mass assignment
failed mutation false-audit prevention
```

Confirmed invariant violation cannot be downgraded merely to get acceptance.

---

# 10. ARCHITECTURE / ROADMAP SYNC

If semantics changed, synchronize:

```text
docs/architecture/ENTITY_CHANGE_AUDIT_FRAMEWORK.md
docs/prompts/TravelHub_CANONICAL_IMPLEMENTATION_ROADMAP_v3.md
```

Framework must reflect real OperationalNote transactionality. Document canonical locking/concurrency invariant where architecturally appropriate.

Roadmap marks D5 ACCEPTED only after all hard gates + Git closure.

---

# 11. REQUIRED REPORT

Create:

```text
docs/reports/PHASE_3_PRE_STEP_3.12_D5_FINAL_CLOSURE_ROUND_2_REPORT.md
```

Predominantly Russian.

Structure:

1. Executive Summary
2. Starting Git State
3. Round 2 Root Cause Matrix
4. R2-1 TOCTOU Root Cause
5. R2-1 Implementation Fix
6. Controlled Concurrency Evidence
7. R2-2 OperationalNote Atomicity Root Cause
8. R2-2 Atomic Transaction Fix
9. OperationalNote Failure-Injection Evidence
10. Complete Regression Matrix
11. Complete Browser/Runtime Matrix
12. DB→API→UI→Audit Reconciliation
13. Security Re-qualification
14. Architecture/Roadmap Sync
15. Complete Final Acceptance Matrix
16. Git Hard Closure
17. Findings
18. Final Verdict
19. TRUE NEXT

---

# 12. VERDICT RULE

`VERDICT A` only if ALL hard gates PASS, 0 unresolved P0/P1/acceptance-blocking P2, real TOCTOU fixed, OperationalNote atomicity proven, all mandatory browser flows proven, worktree exactly empty, HEAD==origin/master, final SHA explicitly shown.

If PASS:

```text
VERDICT A — D5 FINAL CLOSURE ROUND 2 PASSED

D5 — ACCEPTED

TRUE NEXT:
D6 — BOOKING FULL-PAGE DETAIL
     + NAVIGATION CONSISTENCY
     + ACTION / STATE-MACHINE CONSISTENCY
     + EDITING / MUTABILITY CONTRACT
     + IMMUTABLE CHANGE HISTORY
     + ENTITY CHANGE AUDIT FRAMEWORK INTEGRATION

D6 IMPLEMENTATION — NOT STARTED
```

If any hard gate missing/fails:

```text
VERDICT B — D5 FINAL CLOSURE ROUND 2 FAILED

D5 — NOT ACCEPTED
D6 — NOT STARTED

TRUE NEXT:
D5 FINAL CLOSURE CONTINUATION
```

List exact blocker + evidence.

---

# 13. HARD STOP — NO D6

Do not implement Booking full-page/UI/audit/navigation/state-machine.

After:

```text
TOCTOU fix
→ OperationalNote atomicity
→ deterministic concurrency tests
→ failure-injection tests
→ regressions
→ complete browser matrix
→ security re-qualification
→ architecture/roadmap sync
→ complete acceptance matrix
→ exact-empty Git closure
→ final verdict
```

**STOP.**

Even with `VERDICT A`, D6 begins only under a separate prompt.
