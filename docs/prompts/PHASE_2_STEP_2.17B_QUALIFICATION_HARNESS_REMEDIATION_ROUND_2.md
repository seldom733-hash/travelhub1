# PHASE 2 — STEP 2.17B — QUALIFICATION HARNESS REMEDIATION — ROUND 2

## 0. MODE
**HARNESS-ONLY REMEDIATION · REPOSITORY-FIRST · FIX ONLY THE PROVEN INVALIDATING SEED/REPRESENTATIVE-DATASET DEFECT · PRESERVE VALID SYSTEM FAIL EVIDENCE · FROZEN TARGETS · NO PRODUCTION PERFORMANCE TUNING · NO EVENTBUS TUNING · NO FINAL QUALIFICATION · NO STRICT REVIEW · EVIDENCE/PERSISTENCE REQUIRED · HARD STOP**

Starting canonical outcome:

```text
PHASE 2 STEP 2.17B FINAL RE-QUALIFICATION INCOMPLETE —
VALID SYSTEM PERFORMANCE VERDICT NOT AVAILABLE
verdict = C — QUALIFICATION INVALID / INCOMPLETE
```

Two findings must remain separate:

### F-1 — HIGH — HARNESS INVALIDATING DEFECT
`seed.ts drainOutbox()` is bounded at approximately `20 × publishPending(200) = 4,000` events, while REPRESENTATIVE seeding requires at least 5,000 EventBus seed events plus chain-generated events. Result: REPRESENTATIVE never reaches a valid fully-drained state.

### F-2 — HIGH — VALID SYSTEM PERFORMANCE FAIL EVIDENCE
A valid EventBus steady run at 100 ev/s processed 3,000/3,000 events but observed max backlog `178 > approved <=100`; oldest PENDING 1.77s <=10s passed. This is valid system evidence and MUST NOT be tuned away in this pass.

Purpose:
`fix F-1 harness only → live-validate REPRESENTATIVE → preserve F-2 → regression → persist → STOP → separate full re-qualification`.

## 1. REQUIRED STARTING STATE
Verify from repo:
- Step 2.17 APPROVED
- Step 2.17A APPROVED
- Step 2.17B NOT APPROVED, strict review NOT STARTED
- first qualification INVALID/INCOMPLETE
- harness remediation round 1 completed
- F-2 preserved as valid failure evidence
- 2.17C / 2.18 NOT STARTED
- ADR-0015 BLOCKED, 2.12B BLOCKED, PSP subset DEFERRED

Verify supplied provenance, do not trust blindly:
`fadc9a8 → 4e4f519 → 5fd9d63 → 0c28a8d`, with reported `HEAD == upstream == 0c28a8d`.

Read Roadmap, final requalification report, round-1 remediation report, `backend/src/perf/**`, `seed.ts`, `drainOutbox()`, REPRESENTATIVE generator, worker defaults and qualification manifest.

## 2. PROVENANCE BASELINE
Run:
```bash
git status --short
git branch --show-current
git rev-parse HEAD
git rev-parse --verify @{u} 2>/dev/null || true
git log --oneline --decorate -50
git diff
```
Record branch/base/upstream/worktree/migration count/artifact baseline. Preserve unrelated prompts. Never `git add .` / `git add -A`.

## 3. FROZEN TARGETS — HARD GATE
Do not modify:
- EventBus qualification = 100 ev/s
- normal backlog <=100
- oldest PENDING <=10s
- recovery = 5,000 events / 2 workers / <=120s
- REPRESENTATIVE dataset minimums:
  - Users >=1,000
  - Products/service units >=500
  - Customers >=1,000
  - Sales/quotes >=1,000
  - Booking/Order chains >=1,000
  - Payment-capable orders >=500
  - Finance/ledger >=5,000
  - EventBus seed capacity >=5,000

Required:
```text
SLO_TARGETS_CHANGED = 0
DATASET_AUTHORITY_CHANGED = 0
EVENTBUS_BACKLOG_TARGET_CHANGED = 0
```

## 4. F-1 — REPRODUCE BEFORE FIX
Prove exact current code-level drain bound. If actual implementation differs from `20 × 200`, calculate the real bound. Prove why REPRESENTATIVE + chain events can exceed it. Record code evidence before modifying.

## 5. REMEDIATION DESIGN — NO MAGIC CONSTANT PATCH
Do not merely change `20 → 50` without a contract.

Implement a bounded, state-driven drain:
```text
loop until:
  no drainable PENDING/retryable work remains
OR
  explicit safety timeout/max-iterations bound is reached
```
Allow explicit controls such as `maxDurationMs`, `maxIterations`, `batchSize`, `idleRoundsRequired`, but no unbounded loop.

## 6. COMPLETION SEMANTICS
Completion must be based on actual EventBus state, not just loop count. Distinguish:
- healthy PENDING drained
- retryable FAILED handled according to current harness contract
- nested emitted PENDING drained
- poison/exhausted retained but isolated

Do not delete outbox/inbox history to force completion.

## 7. NESTED EVENTS
Prove drain continues when consumers emit new PENDING events. Do not stop because a single `publishPending()` returns less than batch size.

## 8. FAIL-CLOSED SAFETY
If convergence fails within bound, seed must FAIL and dataset must not be marked ready.

Diagnostics should safely include:
- remaining PENDING
- retryable FAILED
- iterations
- elapsed time
- batch size

No secrets/PII.

## 9. REPRESENTATIVE LIVE VALIDATION — MANDATORY
Round 1's key process gap was structural implementation without live validation. This pass MUST perform a full live REPRESENTATIVE seed.

Prove actual counts satisfy authority. Record:
- start/end
- duration
- counts
- outbox before drain
- drain iterations/duration
- PENDING after drain
- retryable FAILED after drain
- expected poison/exhausted
- Inbox counts
- cleanup result

The dataset gate passes only on live evidence.

## 10. SEED DURATION IS NOT A PRODUCT SLO
Do not optimize production runtime merely because invalid seeding previously took ~12.3 min. Harness batching/orchestration may be improved if production semantics stay unchanged. No indexes/query/pool tuning.

## 11. F-2 MUST BE PRESERVED
Preserve as valid system evidence:
```text
EventBus steady = 100 ev/s
processed = 3,000/3,000
max backlog = 178
target = <=100
oldest PENDING = 1.77s <=10s
verdict = FAIL for backlog gate
```
Do NOT:
- change worker interval/batch
- add workers beyond authority
- lower event rate
- relax target
- replace max backlog with average
- alter measurement window to hide spike

## 12. OVERALL VERDICT SEMANTICS
This remediation pass does not produce overall system PASS/FAIL. Full re-qualification is still required for blocked dataset-dependent gates.

A later fresh EventBus steady run may be performed during full re-qualification, but historical valid F-2 evidence must remain visible.

If fresh valid re-qualification again gives backlog >100, overall Step 2.17B qualification must FAIL and route to separate Performance Remediation.

## 13. REQUIRED TESTS
Add executable tests for:
1. drain <1 batch
2. exactly one batch
3. >20×batch volume
4. 5,000+ events
5. nested emitted events
6. no premature stop on partial batch
7. exits when healthy work empty
8. poison/exhausted retained but not treated as healthy pending
9. non-converging retryable work hits safety bound
10. diagnostics include remaining counts
11. no unbounded loop
12. cleanup after seed failure

Also add a qualification-profile contract test proving the REPRESENTATIVE >=5,000 requirement is supported.

## 14. NO PRODUCTION EVENTBUS CHANGE
Expected production EventBus runtime changes = 0.
Do not change `OutboxWorkerService`, production `publishPending`/`retryFailed`, worker defaults, Inbox semantics or delivery semantics.

If REPRESENTATIVE cannot be supported without production redesign, return architecture blocker instead of changing production.

## 15. NO SALES/BOOKING PERFORMANCE FIX
Do not touch `sales.service.ts`, Sales/Booking queries, indexes, Prisma pool, PostgreSQL config or HTTP timeout. Preserve observations; do not remediate them here.

## 16. SHORT POST-FIX VALIDATION
After F-1 fix:
A. full REPRESENTATIVE seed — mandatory
B. full outbox drain proof — mandatory
C. short app/smoke from REPRESENTATIVE — enough to prove dataset is usable
D. cleanup — mandatory

Do NOT run full:
- 15m steady
- 15m peak
- 60s burst
- 30m soak

Optional EventBus sanity checks must be labeled `HARNESS SANITY ONLY — NOT QUALIFICATION EVIDENCE REPLACEMENT`. Do not rerun F-2 just to seek green.

## 17. CLEANUP
Verify:
- harness-owned rows cleaned
- canonical retained EventBus history correctly classified
- isolated perf DB dropped
- orphan processes = 0
- orphan DB = 0

## 18. FULL REGRESSION
Run:
- backend tsc/build/unit/full serial e2e
- frontend tsc/vitest/build
- migrate current + drift 0
- checker regression + Roadmap checker, WARN=0 FAIL=0

Report actual counts.

## 19. REQUIRED REPORT
Create:
`docs/prompts/PHASE_2_STEP_2.17B_QUALIFICATION_HARNESS_REMEDIATION_ROUND_2_REPORT.md`

Include: mode, verdict, repo truth, provenance, frozen targets, prior verdict C, F-1 reproduction, original bound, capacity calculation, remediation design, completion semantics, safety bounds, nested events, poison semantics, tests, REPRESENTATIVE live seed, dataset counts, drain metrics, smoke, cleanup, F-2 preserved evidence, F-2 non-remediation proof, Sales/Booking observations preserved, production EventBus negative diff, production tuning negative proof, regressions, DB/drift, artifact integrity, negative checks, Roadmap update, files changed, persistence, Repository Evidence, release, NEXT, HARD STOP.

## 20. VERDICT MODEL
### A — ROUND 2 PASS
Only if:
- F-1 fixed
- REPRESENTATIVE live seed completes
- counts reached
- outbox drain converges
- cleanup succeeds
- production runtime unchanged
- F-2 preserved

State:
```text
HARNESS REMEDIATION ROUND 2 = PASS
FINAL RE-QUALIFICATION = NOT RUN
Step 2.17B = NOT APPROVED
Strict Review = NOT STARTED
NEXT = FINAL RE-QUALIFICATION AGAINST UNCHANGED APPROVED TARGETS
```

### B — INCOMPLETE
If REPRESENTATIVE still cannot seed/drain validly.

### C — ARCHITECTURE BLOCKER
If material production redesign is required. Do not redesign here.

## 21. ROADMAP UPDATE
If A, truthful equivalent:
```text
🚧 QUALIFICATION HARNESS REMEDIATION ROUND 2 COMPLETED —
REPRESENTATIVE DATASET LIVE-VALIDATED —
READY FOR FINAL RE-QUALIFICATION —
PREVIOUS VALID EVENTBUS BACKLOG FAIL EVIDENCE PRESERVED —
NOT APPROVED
```
Do not rewrite history or remove F-2.

## 22. NEGATIVE CHECKS
Report:
```text
approved targets changed = 0
EventBus backlog target changed = 0
EventBus rate reduced = 0
worker interval/batch changed = 0
worker authority changed = 0
production EventBus code changed = 0
sales.service.ts changed = 0
Booking/Order production code changed = 0
query/index/pool/PostgreSQL tuning = 0
HTTP timeout raised = 0
cache added = 0
SLO relaxed = 0
failed EventBus evidence deleted = 0
failed EventBus evidence reclassified invalid = 0
full final qualification executed = 0
Step 2.17B approved = 0
Strict Review started = 0
2.17C/2.18/RLS/PSP/2.12B/2.12I started = 0
release/deployment = 0
```

## 23. ARTIFACT INTEGRITY
Run checker regression + canonical Roadmap checker. Required WARN=0, FAIL=0.

## 24. GIT DISCIPLINE
Before staging:
```bash
git status --short
git branch --show-current
git rev-parse HEAD
git rev-parse --verify @{u} 2>/dev/null || true
git diff --stat
git diff
git diff --check
```
Stage exact files only. Never `git add .` / `-A`. Inspect cached diff.

## 25. COMMIT / PUSH
If A:
`git commit -m "test(perf): fix representative qualification seeding"`

If B:
`git commit -m "test(perf): record remaining representative seed blocker"`

If C:
`git commit -m "test(perf): record qualification architecture blocker"`

Then populate real provenance, use footer-only commit if required, push, and verify final HEAD == upstream before claiming PUSHED.

## 26. REPOSITORY EVIDENCE FOOTER
Populate actual values:
```text
repository:
branch:
base_sha:
previous_qualification_sha:
remediation_round2_commit_sha:
provenance_footer_commit_sha:
final_head_sha:
upstream_sha:
push_status:
worktree_clean:
migration_count:
database_drift:
artifact_integrity:
checker_regression:
f1_reproduced:
f1_original_bound:
f1_new_completion_contract:
f1_safety_bound:
nested_event_test:
poison_semantics:
representative_live_seed:
representative_seed_duration:
representative_dataset_counts:
outbox_before_drain:
outbox_after_drain:
drain_iterations:
drain_duration:
retryable_failed_after_drain:
expected_poison_after_drain:
cleanup_state:
f2_preserved:
f2_target_backlog:
f2_observed_backlog:
f2_verdict:
f2_production_tuning:
sales_observation_state:
booking_order_observation_state:
backend_regression:
frontend_regression:
full_final_qualification_run:
targets_changed:
production_tuning:
psp_subset:
remediation_verdict:
step_2_17b_state:
strict_review_state:
step_2_17c_state:
step_2_18_state:
release_status:
persistence_status:
```

## 27. SUCCESS OUTPUT
If A:
```text
PHASE 2 STEP 2.17B QUALIFICATION HARNESS REMEDIATION ROUND 2 COMPLETED —
REPRESENTATIVE DATASET LIVE-VALIDATED —
READY FOR FINAL RE-QUALIFICATION

Decision:
- verdict: A — HARNESS REMEDIATION PASS
- approved targets changed: 0
- production performance tuning: 0
- full final qualification executed: NO
- Step 2.17B: NOT APPROVED
- Strict Review: NOT STARTED

F-1:
- original drain bound: <actual>
- root cause: CONFIRMED
- remediation: bounded state-driven drain
- nested events: PASS
- safety bound: PASS
- REPRESENTATIVE live seed: PASS
- dataset counts: <actual>
- PENDING after drain: <actual>
- retryable FAILED after drain: <actual>
- cleanup: PASS

F-2 preserved:
- target backlog <=100
- previous valid max backlog = 178
- verdict evidence = FAIL
- production EventBus tuning = 0
- target changed = 0
- fresh final judgment = DEFERRED TO NEXT FULL RE-QUALIFICATION

Regression:
- backend: <actual>
- frontend: <actual>
- DB: <actual>
- artifact integrity: PASS=<actual> WARN=0 FAIL=0

Persistence:
- branch: <actual>
- remediation commit: <sha>
- provenance/footer: <sha>
- final HEAD/upstream: <sha>
- push_status: PUSHED

RELEASE: NOT PERFORMED
NEXT: PHASE 2 — STEP 2.17B —
FINAL RE-QUALIFICATION AGAINST UNCHANGED APPROVED TARGETS
```

## 28. HARD STOP
After repository verification, F-1 reproduction, state-driven bounded drain fix, tests, full live REPRESENTATIVE seed, cleanup, F-2 preservation, full regression, artifact checker, docs/Roadmap/report, exact staging, commit, provenance and push — STOP.

Do not run full qualification.
Do not tune EventBus.
Do not optimize Sales/Booking.
Do not start Strict Review.
Do not start 2.17C, 2.18, RLS or PSP work.

If verdict A, only NEXT:
`PHASE 2 — STEP 2.17B — FINAL RE-QUALIFICATION AGAINST UNCHANGED APPROVED TARGETS`
