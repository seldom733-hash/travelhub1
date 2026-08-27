# PHASE 3 — PLATFORM CRM
## STEP 3.5 — OPERATIONAL NOTES IMPLEMENTATION
## ROUND 2A.1 — BACKEND REGRESSION EVIDENCE CLOSURE

### PURPOSE
Round 2A (`e0fe7bb`) reported Backend Tests **1083/1085**, with 2 failures classified as “flaky perf unrelated”. This round is evidence/remediation only. Do **not** start Round 2B.

Goal: classify both failures as `ROUND_2A_REGRESSION`, `PRE_EXISTING_FLAKY`, `PERFORMANCE_THRESHOLD_FLAKY`, `TEST_INFRASTRUCTURE_DEFECT`, `ENVIRONMENT_SPECIFIC`, `REAL_SYSTEM_DEFECT_UNRELATED`, or `UNKNOWN`. `UNKNOWN` = VERDICT B.

### PRECONDITION
Preserve:
- Shared Table Controls: `ec2e65c`
- Operational Notes Architecture V2: `240fbe8`
- Operational Notes Round 2A: `e0fe7bb`

Starting SHA: `e0fe7bb` or explained descendant.

### SCOPE
Allowed: identify failures, reproduce, baseline-compare, inspect performance/isolation/environment, fix proven regression or narrow test-infrastructure defect, rerun gates, produce report.

Forbidden: Notes API/RBAC/UI/create-form integration, new audit/edit/delete functionality, Storefront/Marketplace CRM, unrelated refactoring.

### 1. IDENTIFY BOTH FAILURES
For each report exact:
- file
- describe/test name
- error/stack
- expected vs actual
- duration
- timeout/performance threshold

“2 flaky perf tests” is insufficient.

### 2. REPEATABILITY
Run each suspect test individually **10 consecutive times** (or largest practical sample with justification).

Report runs, passes/failures, failure rate, min/median/p95/max timing where meaningful.

Then run both suspect tests together repeatedly to detect shared-state, worker, DB, ordering or contention effects.

### 3. FULL SUITE
Rerun full backend suite on current Round 2A HEAD. Report exact suites/tests/pass/fail/duration and identities of failures. If failure identities change, state it.

### 4. PRE-ROUND-2A BASELINE
Using a safe detached worktree/checkout, run the same suspect tests on **`240fbe8`**, the architecture-only baseline immediately before Round 2A.

Do not reset/rewrite master.

Required question: **did these exact failures exist before `e0fe7bb`?**

| Test | 240fbe8 Individual | 240fbe8 Repeated | e0fe7bb Individual | e0fe7bb Repeated | Classification |
|---|---|---|---|---|---|
| #1 | | | | | |
| #2 | | | | | |

No blanks.

### 5. ROUND 2A IMPACT ANALYSIS
For each failure inspect whether Round 2A can affect it through:
- Prisma schema/client generation
- `20260826173146_add_operational_notes`
- indexes / DB bootstrap / planner
- OperationalNotesModule / AppModule initialization
- dependency graph / Prisma connections / memory
- `createEntityWithInitialNote()`
- transactions
- EventBus/audit infrastructure
- Jest workers / DB isolation / resource contention

Do not call a test unrelated merely because its filename does not mention Operational Notes.

### 6. PERFORMANCE TEST RULE
If performance-sensitive, report metric, canonical threshold, failing value, passing range, runtime conditions, wall-clock sensitivity, warm-up, DB/cache dependence and worker contention.

Forbidden merely to obtain green:
- raising timeout/p95 threshold
- reducing workload/iterations
- skipping/disabling test
- blind retries
- forcing `--runInBand`

A threshold change requires root cause + before/after measurements + canonical SLO justification.

### 7. TEST ISOLATION
Audit suspect tests for shared DB leakage, global singleton/EventBus leakage, fake timers, unclosed handles, Redis/filesystem/port state, seed collisions and worker contention. Preserve prior process/DB isolation guarantees.

### 8. FIX POLICY
If `ROUND_2A_REGRESSION`: fix now and rerun suspect tests, relevant suite, full backend suite and frontend regression.

If pre-existing flaky/perf: prove on `240fbe8`; preferably fix narrowly. A waiver requires strong evidence.

If test-infrastructure defect: fix narrowly while preserving test intent.

If real unrelated system defect: document honestly; do not relabel flaky.

If `UNKNOWN`: VERDICT B.

### 9. PREFERRED CLOSURE
Preferred final state:

`Backend Tests: 1085/1085 PASS`

(or new exact total if legitimate tests are added).

### 10. EXCEPTIONAL WAIVER
A still-failing test may coexist with VERDICT A only if ALL are proven:
1. same failure reproducible on `240fbe8`;
2. impact analysis proves no Operational Notes causality;
3. failure frequency/severity did not regress after `e0fe7bb`;
4. product behavior remains correct;
5. defect is test/performance-infrastructure specific;
6. defect is explicitly documented;
7. no test skipped/disabled;
8. no threshold weakened without SLO evidence;
9. no P0/P1 correctness/security/data-integrity defect remains.

### REQUIRED FAILURE MATRIX
| Test | Exact Error | Threshold/Expectation | Current Repro | Baseline Repro | Round 2A Impact | Classification | Fix/Waiver |
|---|---|---|---|---|---|---|---|
| #1 | | | | | | | |
| #2 | | | | | | | |

### REQUIRED REPEATABILITY MATRIX
| Test | Baseline Runs | Baseline Pass/Fail | Current Runs | Current Pass/Fail | Failure Rate Change | Timing Evidence |
|---|---:|---|---:|---|---|---|
| #1 | | | | | | |
| #2 | | | | | | |

### REQUIRED IMPACT MATRIX
| Round 2A Change | Can Affect Tests? | Evidence | Conclusion |
|---|---|---|---|
| Prisma schema | | | |
| Migration | | | |
| OperationalNotesModule | | | |
| AppModule import | | | |
| Parent resolver | | | |
| Transaction primitive | | | |
| New indexes | | | |
| DB bootstrap | | | |
| Test isolation | | | |

### OPERATIONAL NOTES SANITY
Re-prove critical Round 2A behavior:
- model works
- parent validation
- server-authoritative author
- INTERNAL default
- 5000-char validation
- atomic entity + initial note
- rollback
- notes do not mutate business status/dates

Migration status must remain clean; no destructive DB reset as acceptance proof.

### REQUIRED REGRESSION MATRIX
| Gate | Baseline/Evidence | Current Final | PASS |
|---|---|---|---|
| Suspect #1 repeated | | | |
| Suspect #2 repeated | | | |
| Suspects combined | | | |
| Relevant backend suites | | | |
| Full backend suite | | | |
| Backend TSC | | | |
| Backend build | | | |
| Frontend TSC | | | |
| Frontend tests | | | |
| Frontend build | | | |

### ENVIRONMENT EVIDENCE
Capture relevant Node/npm, PostgreSQL/database, Jest worker mode, OS/CPU/RAM where material, and CI-vs-local differences.

### PRODUCTION CHANGE POLICY
Ideal: evidence-only closure, no production code changes. If a proven defect requires a change, keep it strictly root-cause scoped. Unrelated production changes = 0.

### ACCEPTANCE CRITERIA
VERDICT A requires:
1. both failures exactly identified;
2. exact errors/expectations/thresholds captured;
3. repeated individual and combined execution;
4. full backend suite rerun;
5. safe `240fbe8` baseline comparison;
6. baseline/current failure rates and timing compared;
7. schema/migration/module/transaction/DB/test-isolation impact analyzed;
8. each failure receives non-UNKNOWN classification;
9. any Round 2A regression fixed;
10. no test skipped/disabled/blind-retried;
11. no threshold/workload weakening without canonical justification;
12. critical Operational Notes sanity passes;
13. migration sanity passes;
14. Backend TSC/build pass;
15. backend final exact test count reported;
16. Frontend TSC/tests/build pass;
17. all required matrices complete with no blanks;
18. unrelated production changes = 0;
19. report created;
20. any fix committed/pushed;
21. HEAD == origin/master;
22. no unresolved Round 2A regression or P0/P1 Operational Notes defect.

### REQUIRED REPORT
Create:

`docs/prompts/PHASE_3_STEP_3.5_PLATFORM_CRM_OPERATIONAL_NOTES_ROUND_2A_1_BACKEND_REGRESSION_EVIDENCE_CLOSURE_REPORT.md`

### VERDICT
Preferred:

`VERDICT A — PHASE 3 STEP 3.5 PLATFORM CRM / OPERATIONAL NOTES ROUND 2A.1 / BACKEND REGRESSION EVIDENCE CLOSURE / FULL BACKEND SUITE GREEN — ROUND 2A FINAL CLOSED`

Exceptional evidence-based:

`VERDICT A — PHASE 3 STEP 3.5 PLATFORM CRM / OPERATIONAL NOTES ROUND 2A.1 / PRE-EXISTING FLAKY/PERFORMANCE DEFECT PROVEN / NO ROUND 2A REGRESSION — ROUND 2A FINAL CLOSED WITH DOCUMENTED PRE-EXISTING DEFECT`

Failure:

`VERDICT B — OPERATIONAL NOTES ROUND 2A REGRESSION CLOSURE INCOMPLETE`

No conditional VERDICT A.

### FINAL RESPONSE FORMAT
Return:
- VERDICT
- repository/branch/starting SHA and preservation of `ec2e65c`, `240fbe8`, `e0fe7bb`
- exact original failures
- Failure Matrix
- Repeatability Matrix
- baseline comparison
- Round 2A Impact Matrix
- root cause and classification per failure
- fixes / threshold changes / skipped tests
- Operational Notes sanity
- migration sanity
- Regression Matrix
- exact final backend/frontend gates
- runtime/environment evidence
- files changed / unrelated files
- report path
- commit / HEAD / origin parity
- remaining P0/P1/P2 and known pre-existing defect
- Round 2A final status
- next canonical round

### NEXT CANONICAL ROUND
Only after final Round 2A closure:

`PHASE 3 — STEP 3.5 — OPERATIONAL NOTES IMPLEMENTATION — ROUND 2B — NOTES API + RBAC + AUDIT / EDIT / DELETE AUTHORITY`

Do NOT implement Round 2B here.

### STOP
After report and verdict: **STOP**.
