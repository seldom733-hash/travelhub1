# PHASE 2 — STEP 2.17 — FLAKY E2E & TEST ISOLATION STABILIZATION

## 0. MODE
**NARROW STABILIZATION PASS · REPOSITORY-FIRST · ROOT-CAUSE REQUIRED · NO FEATURE WORK · NO STRICT REVIEW**

This pass runs after `Step 2.17 IMPLEMENTATION COMPLETED — WAITING FOR STRICT REVIEW` and before Step 2.17 Strict Review.

Purpose: investigate and eliminate the known intermittent full-suite e2e failure without masking it.

Known symptom to VERIFY, not assume:
- full serial e2e may intermittently fail in zero-fanout/counter assertions;
- rerun may pass;
- suspected shared test-DB contamination;
- possible interaction with the new `OutboxWorkerService`.

Do not perform Strict Review in this pass.

---

# 1. PRIMARY OBJECTIVE
Determine whether the flake is caused by:
1. test DB cross-contamination;
2. background-worker lifecycle leakage;
3. timer/open-handle leakage;
4. FAILED/PENDING outbox state surviving between suites;
5. counter/fixture collision;
6. nondeterministic asynchronous delivery;
7. an actual production concurrency defect;
8. another repository-backed cause.

Then apply the **smallest correct fix**. A passing rerun is not proof of resolution.

# 2. DO NOT MASK THE FAILURE
Forbidden:
- increasing sleeps/timeouts without root cause;
- weakening exact assertions to `>=`;
- skipping/flaky-tagging tests;
- automatic retry-until-green;
- deleting tests;
- disabling the worker merely to hide the problem;
- arbitrary cleanup that hides a production race;
- forced process exit.

# 3. REPOSITORY BASELINE
Before edits run:
```bash
git status --short
git branch --show-current
git rev-parse HEAD
git rev-parse --verify @{u} 2>/dev/null || true
git log --oneline --decorate -20
```

Verify from repository evidence:
- Step 2.17 = `IMPLEMENTATION COMPLETED — WAITING FOR STRICT REVIEW`;
- implementation is persisted/upstream;
- current migration count;
- canonical e2e command;
- actual failing zero-fanout spec/assertion;
- actual `OutboxWorkerService` lifecycle;
- unrelated untracked prompts remain untouched.

# 4. REPRODUCE BEFORE FIXING
Run the canonical full serial e2e repeatedly on the committed baseline. Record:
```text
run
result
failed suite/test
expected
actual
relevant outbox/event state
duration
open handles if inspected
```
If not reproduced, continue forensic analysis from the known assertion/state transitions. Do not declare the issue fixed.

# 5. ZERO-FANOUT CONTRACT
Locate affected assertions and prove what "zero fanout" means:
- rows/events counted;
- event types;
- causation/correlation scope;
- global vs scenario-local count;
- whether prior suites can contribute;
- whether background workers can process unrelated rows during the assertion.

Do not change assertion scope until intended semantics are proven.

# 6. TEST DB ISOLATION AUDIT
Inspect:
- DB creation/migrations;
- beforeAll/beforeEach/afterEach/afterAll;
- cleanup/reset helpers;
- Prisma lifecycle;
- fixture factories and ID generators;
- suite-level Nest apps;
- shared globals.

Answer:
1. Is one physical DB reused?
2. Are all relevant schemas/tables reset?
3. Can prior rows survive?
4. Can cleanup race with workers?
5. Is app/worker shutdown completed before cleanup?
6. Can another Nest instance remain alive?

# 7. OUTBOX WORKER LIFECYCLE AUDIT
Verify:
- startup mechanism;
- interval/timer;
- shutdown hook;
- timer cancellation;
- whether in-flight work is awaited;
- whether scheduling can continue during shutdown;
- multiple test app instances;
- advisory-lock behavior;
- retry/claim behavior.

Stopping a timer while an async iteration is still running is not complete shutdown.

# 8. OPEN HANDLE AUDIT
Use supported diagnostics such as `--detectOpenHandles` where useful. Inspect timers, DB/Redis/MinIO clients, HTTP servers, worker loops and unresolved promises. Forced exit is forbidden.

# 9. FAILED/PENDING CONTAMINATION
Check whether earlier suites leave `PENDING`, `FAILED`, claimed/processing, retryable or poison/exhausted events that the new worker later processes in another suite. Determine whether this is bad cleanup, lifecycle leakage, bad assertion scoping or a production publisher bug.

# 10. APP INSTANCE ISOLATION
Verify every test Nest app closes providers and workers. No worker from App A may continue processing fixtures from App B unless the test explicitly models multi-instance behavior.

# 11. FIXTURE/ID COLLISIONS
Check canonical IDs/numbers/counters. Use canonical ID services/factories. Do not add randomness merely to hide deterministic collisions.

# 12. ROOT-CAUSE CLASSIFICATION
Classify exactly:
- **A — TEST HARNESS ISOLATION BUG**
- **B — BACKGROUND WORKER LIFECYCLE BUG**
- **C — PRODUCTION CONCURRENCY BUG**
- **D — TEST ASSERTION SCOPING BUG**
- **E — MIXED**

Support classification with code/runtime evidence.

# 13. FIX PRINCIPLE
Apply the narrowest evidence-backed fix.

Examples only if proven:
- A: deterministic cleanup and correct shutdown→cleanup ordering;
- B: await in-flight worker shutdown and prevent rescheduling;
- C: narrow claim/retry concurrency correction + regression test;
- D: scenario/event/causation-scoped assertion preserving the real zero-fanout invariant.

No unrelated refactor.

# 14. WORKER TESTABILITY
If test control is needed, use explicit lifecycle/configuration. No hidden test-only correctness path. If worker is disabled in a narrow test, it must retain separate real integration/e2e coverage.

# 15. STABILITY VALIDATION
After fix:
1. repeat previously failing test;
2. repeat containing suite;
3. repeat relevant outbox/event suites;
4. run canonical full serial e2e more than once.

Report actual repetitions and failures. Do not claim mathematical proof of zero flakiness.

# 16. REQUIRED REGRESSION
Run actual repository commands:
- backend typecheck/build/full unit;
- affected targeted e2e;
- outbox durable-worker e2e;
- event/outbox/inbox targeted regression;
- auth-hardening regression if shared harness changed;
- full serial e2e repeatedly;
- frontend tsc/Vitest/build according to canonical policy;
- migrate status/drift 0;
- fresh replay if harness/migration behavior is affected;
- artifact checker regression + real checker.

Report actual counts only.

# 17. ABSOLUTE NON-SCOPE
Do NOT:
- refactor `backend/src/modules/sales/sales.service.ts`;
- start 2.17C;
- start Strict Review;
- start 2.17A/2.17B/2.18;
- implement RLS;
- touch PSP selection/integration, 2.12B, 2.12C or 2.12I.

# 18. DEFERRED ITEMS
Do not implement the reported deferred multi-instance rate limiter or detailed ADMIN SoD decomposition here.

The upcoming Strict Review MUST independently decide whether those deferrals are compatible with the canonical Step 2.17 acceptance contract. Do not pre-approve them.

# 19. DOCUMENTATION
Create:
`docs/prompts/PHASE_2_STEP_2.17_FLAKY_E2E_AND_TEST_ISOLATION_STABILIZATION_REPORT.md`

Update `docs/architecture/platform-hardening-step-2.17.md` only if the fix changes a real platform lifecycle contract.

# 20. REPORT CONTENT
Include:
1. baseline;
2. symptom;
3. reproduction attempts;
4. failing assertion;
5. zero-fanout contract;
6. DB isolation audit;
7. app lifecycle;
8. worker lifecycle;
9. open handles;
10. pending/failed contamination;
11. fixture audit;
12. root-cause classification;
13. evidence;
14. exact fix;
15. why it does not mask failure;
16. production impact;
17. harness impact;
18. regression tests;
19. targeted repetitions;
20. full-suite repetitions;
21. backend regression;
22. frontend regression;
23. DB result;
24. artifact integrity;
25. negative checks;
26. deferred 2.17 items for Strict Review;
27. files changed;
28. persistence;
29. Repository Evidence;
30. release;
31. NEXT.

# 21. ROADMAP
Do NOT mark 2.17 approved. It remains:
`🚧 IMPLEMENTATION COMPLETED — WAITING FOR STRICT REVIEW`

NEXT remains:
`PHASE 2 — STEP 2.17 — STRICT REVIEW`

Only add a stabilization note if genuinely useful; do not imply approval.

# 22. NEGATIVE CHECKS
Explicitly report:
```text
business feature expansion = 0
sales.service structural refactor = 0
2.17C implementation = 0
PSP/payment work = 0
RLS = 0
Backup/DR = 0
load qualification = 0
Strict Review = NOT STARTED
assertions weakened = 0
tests skipped = 0
automatic flaky retry masking = 0
forced process exit = 0
```

# 23. ARTIFACT INTEGRITY
Run checker regression and real Roadmap checker.
Required: `FAIL = 0`
Prefer: `WARN = 0`
Report actual PASS count.

# 24. GIT DISCIPLINE
Before staging:
```bash
git status --short
git branch --show-current
git rev-parse HEAD
git rev-parse --verify @{u} 2>/dev/null || true
git diff --stat
git diff
```
Never use `git add .` or `git add -A`. Stage only exact stabilization files. Review cached diff before commit.

# 25. COMMIT / PUSH
After all checks pass:
```bash
git commit -m "test: stabilize phase 2.17 e2e isolation"
git push
```
If production worker lifecycle changes, use an accurate message such as:
```bash
git commit -m "fix(platform): stabilize outbox worker lifecycle"
```
Follow established provenance/footer convention. Verify final HEAD == upstream before claiming `PUSHED`.

# 26. REPOSITORY EVIDENCE
Use the established footer:
```text
REPOSITORY EVIDENCE
repository:
branch:
reviewed_base_sha:
stabilization_commit_sha:
provenance_footer_commit_sha:
final_head_sha:
upstream_sha:
push_status:
worktree_clean:
migration_count:
artifact_integrity:
persistence_status:
release_status:
```

# 27. RELEASE
`RELEASE: NOT PERFORMED — STRICT REVIEW REQUIRED`

No deployment/tag/release.

# 28. BLOCKED VERDICTS
If root cause is not proven:
`PHASE 2 STEP 2.17 E2E STABILIZATION INCOMPLETE — ROOT CAUSE NOT PROVEN`

If a real production correctness defect cannot be narrowly fixed:
`PHASE 2 STEP 2.17 E2E STABILIZATION BLOCKED — PRODUCTION CORRECTNESS DEFECT REQUIRES REMEDIATION`

Do not start Strict Review in either case.

# 29. SUCCESS RESPONSE FORMAT
```text
PHASE 2 STEP 2.17 FLAKY E2E & TEST ISOLATION STABILIZATION COMPLETED — READY FOR STRICT REVIEW

Root cause:
- classification: <A/B/C/D/E>
- exact cause: <actual>
- production correctness defect: YES/NO
- test-harness defect: YES/NO
- worker lifecycle defect: YES/NO

Fix:
- <actual>
- assertions weakened: NO
- tests skipped: NO
- retry masking: NO

Stability evidence:
- targeted repetitions: <actual>
- affected suite repetitions: <actual>
- outbox/event repetitions: <actual>
- full serial e2e repetitions: <actual>
- failures after fix: <actual>

Regression:
- backend: <actual>
- frontend: <actual>
- DB: <actual>
- artifact integrity: PASS=<actual> WARN=<actual> FAIL=0

Step 2.17:
- status: IMPLEMENTATION COMPLETED — WAITING FOR STRICT REVIEW
- Strict Review started: NO
- multi-instance rate limiter deferral: TO BE JUDGED BY STRICT REVIEW
- ADMIN SoD deferral: TO BE JUDGED BY STRICT REVIEW

Negative checks:
- sales.service refactor: 0
- 2.17C: NOT STARTED
- payment branch: unchanged
- RLS: 0
- Backup/DR: 0
- load qualification: 0

Persistence:
- branch: <actual>
- stabilization commit: <sha>
- provenance/footer commit: <sha or N/A>
- final HEAD: <sha>
- upstream: <sha>
- push_status: PUSHED
- worktree_clean: true|false

RELEASE: NOT PERFORMED — STRICT REVIEW REQUIRED
NEXT: PHASE 2 — STEP 2.17 — STRICT REVIEW
```

# 30. HARD STOP
After root-cause investigation, narrow fix, repetition validation, regression, report, artifact checks, explicit staging, commit, push and upstream verification: **STOP**.

Do not perform Strict Review in this pass.

The only valid NEXT after successful stabilization is:
`PHASE 2 — STEP 2.17 — STRICT REVIEW`
