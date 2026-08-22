# PHASE 2 --- STEP 2.17B --- FINAL RE-QUALIFICATION ROUND 3

## DEDICATED QUALIFICATION ENVIRONMENT --- STRICT FROZEN-MATRIX EXECUTION

**Project:** TravelHub\
**Phase:** 2\
**Step:** 2.17B --- Load & Performance Qualification\
**Pass:** Final Re-Qualification --- Round 3\
**Mode:** EXECUTION / QUALIFICATION ONLY\
**Required environment:** CLEAN / DEDICATED QUALIFICATION HOST\
**Targets:** FROZEN --- MUST NOT CHANGE\
**Production tuning:** FORBIDDEN\
**Step approval:** FORBIDDEN in this pass; Strict Review remains
separate\
**Release/deploy:** FORBIDDEN unless separately authorized

------------------------------------------------------------------------

# 0. MISSION

Execute the **full Step 2.17B frozen qualification matrix** on a
clean/dedicated qualification environment after the previous host was
dispositioned as unsuitable for the Booking/Order burst gate.

This is **not** a tuning pass, target-reconciliation pass,
harness-remediation pass, architecture redesign, or strict review.

The purpose is to obtain a valid, reproducible system performance
verdict against the **already approved quantitative targets**.

Allowed terminal verdicts:

-   **VERDICT A --- VALID SYSTEM PASS**
-   **VERDICT B --- VALID SYSTEM FAIL**
-   **VERDICT C --- QUALIFICATION INVALID / INCOMPLETE**

No other terminal verdict is permitted.

# 1. REPOSITORY-FIRST RULE

Do not trust previous reports as proof. Inspect current repository,
actual HEAD/upstream, Roadmap state, current performance harness,
approved target authority, Round 2 re-qualification, performance
remediation, and Booking Burst Disposition. Code/schema/migrations/tests
plus persisted authority and independently reproduced execution are
evidence.

Expected prior reference HEAD: `3ec8629`. Do not assume it is still
HEAD. Inspect intervening commits and classify any relevant semantic
delta before proceeding.

# 2. REQUIRED BASELINE

Expected state: - Step 2.17: APPROVED WITH REVIEW FIXES - Step 2.17A:
APPROVED WITH REVIEW FIXES - Step 2.17B: NOT APPROVED - quantitative
targets: APPROVED / FROZEN - harness remediation Round 2: completed -
performance remediation/disposition: completed - warmup/idempotency
accounting defect: fixed - Strict Review 2.17B: NOT STARTED - 2.17C /
2.18: NOT STARTED - PSP-dependent subset: DEFERRED while ADR-0015 /
2.12B remain blocked

# 3. HARD PROHIBITIONS

Do not change approved SLO/load targets, latency thresholds, Booking
burst 20 chains/s, EventBus thresholds, PostgreSQL tuning, indexes,
queries, Prisma pool, worker interval/batch/retry, production code,
schema/migrations, correctness assertions, auth/RBAC/idempotency
semantics, or use `--warmup=0`. Do not hide failed/invalid runs,
cherry-pick successful runs, execute real PSP traffic, start 2.17C/2.18,
perform Strict Review, mark 2.17B APPROVED, or release/deploy.

If a code/harness/system change becomes necessary, stop this pass and
classify the result. Do not mix remediation into qualification.

# 4. FROZEN AUTHORITY

Verify canonical repository authority still contains these values; do
not overwrite repository authority merely to match this prompt.

## V1 planning

-   registered users 100,000; MAU 25,000; DAU 5,000
-   concurrency normal 100 / peak 250 / qualification 500 / burst 1,000
-   read/write 80/20
-   login ≤5%; booking/order ≤5%; payment ≤2%; other writes ≤8%

## HTTP load

-   normal 25 RPS
-   V1 peak 50 RPS
-   qualification sustained 100 RPS
-   burst 200 RPS
-   headroom 2.0x
-   future scaling 1,000 RPS = planning only, NOT Phase 2 gate

## Latency p95/p99

-   A public reads: 300/750 ms
-   B authenticated reads: 500/1000 ms
-   C ordinary writes: 750/1500 ms
-   D concurrency-sensitive: 1000/2000 ms
-   E payment.create: 1000/2000 ms
-   F login: 750/1500 ms

## Reliability

-   unexpected 5xx = 0
-   timeout = 0
-   transport failure = 0

## Payment

-   peak 1 RPS / qualification 2 / burst 10
-   concurrency 50
-   duplicate committed Payment = 0

## Booking/Order

-   peak 3 chains/s
-   qualification 6 chains/s
-   burst 20 chains/s

## Login

-   peak 1 / qualification 2 / burst 5 RPS

## EventBus

-   steady 25 / peak 50 / qualification 100 ev/s
-   burst 1,000 events
-   backlog ≤100
-   oldest PENDING ≤10 s
-   recovery 5,000 events / 2 workers / drain ≤120 s
-   semantics: at-least-once + authoritative Inbox/consumer idempotency;
    never claim exactly-once

## Qualification sequence

-   dedicated isolated environment
-   2 app + 2 worker where required
-   warm-up 5 min
-   steady 15 min @50 RPS
-   peak 15 min @100 RPS
-   burst 60 s @200 RPS
-   soak 30 min @50 RPS / concurrency 250

# 5. DEDICATED ENVIRONMENT HARD PRECONDITION

Do NOT use the previously dispositioned shared Windows host as the final
qualification environment.

Preferred: dedicated Linux x86_64 host/VM, no unrelated workloads,
dedicated/local PostgreSQL, stable CPU/RAM/network, no power-saving
throttling or competing DB clients, isolated from production.

A non-Linux host is not automatically invalid, but if it resembles the
previous host/client path, the burden of proof is higher.

# 6. ENVIRONMENT ADMISSION --- FAIL CLOSED

Persist: UTC timestamp, SHA/branch/upstream/worktree, OS/kernel/arch,
CPU/model/count/allocation, RAM, Node/npm, PostgreSQL client/server,
Prisma, DB/app/worker/load-generator topology, redacted relevant env,
effective DATABASE_POOL_SIZE, EventBus config, DB name, local/remote
topology, process counts and competing workload state.

Never expose credentials, JWTs, cookies, tokens, raw idempotency keys or
DB passwords.

# 7. PRE-FLIGHT DIFFERENTIAL PROBES

Before the long run, execute a short admission suite.

## L1 raw PostgreSQL

Reproduce relevant autocommit vs explicit-transaction probe at
controlled concurrency, including levels comparable to prior
disposition. Where safely available, correlate server-side statement
timing.

## L2 trivial no-DB load-client

Prove the generator can emit at least the equivalent of 20 chains/s with
no pacing collapse or transport instability.

## L3 app/client differential

Where existing diagnostics permit, compare handler-observed duration,
client-observed duration and DB activity/locks/waits. Do not add
invasive production instrumentation.

If the new host reproduces a material host/client-path pathology that
invalidates Booking burst attribution, STOP with **VERDICT C**. Do not
spend hours on a known-invalid environment.

# 8. DATABASE ISOLATION

Create a fresh isolated qualification DB, apply all canonical
migrations, verify migration state and drift=0, use synthetic
deterministic data only, and drop the DB after evidence is safely
persisted. Safe-target guard must fail closed.

# 9. REPRESENTATIVE DATASET

Use REPRESENTATIVE, not SMALL. Verify live authority minimums: - users
1,000 - products 500 - customers 1,000 - quotes 1,000 - booking/order
chains 1,000 - payment orders 1,000 - ledger 5,000 - EventBus seed 5,000

Verify state-driven `drainOutbox()` still terminates on PENDING=0 and
retryable FAILED=0 with bounded fail-closed protection and poison
retained. Record iterations, published count, duration, final states.

# 10. WARMUP

Run the real 5-minute paced warm-up. No `--warmup=0`. Warmup must be
excluded from measurement while run-scoped identities remain monotonic.
Re-verify payment warmup and measurement Idempotency-Key identities do
not collide and slot accounting is exact.

# 11. LOAD APPLICATION VALIDITY

For paced scenarios record target RPS, achieved RPS, expected/actual
count, deviation, `LOAD_APPLICATION_VALID`, unexpected failures and
latency. Use the canonical tolerance (expected ±5% if unchanged in
repository). Under-applied load is never PASS.

# 12. FULL FROZEN MATRIX

Execute all independent gates even if one valid system failure is found,
unless continuing would invalidate evidence.

## Q1 Steady

15 min @50 RPS after warmup. Record p50/p95/p99/max per class,
reliability, correctness and relevant EventBus state.

## Q2 Peak

15 min @100 RPS. Same evidence.

## Q3 Burst

60 s @200 RPS. Same evidence plus post-burst recovery.

## Q4 Soak

30 min @50 RPS / concurrency 250. Record latency progression,
reliability, correctness, DB behavior, EventBus state and memory/process
trend where observable. Missing memory observability must be explicit.

## Q5 Payment 2 RPS

Correctness: 0 duplicate Payment, 0 wrong replay, divergent reuse
controlled, 0 raw controlled-race 500, PaymentService authority
preserved, exact slot accounting, Decimal exact. Class E p95≤1000 /
p99≤2000 ms.

## Q6 Payment 10 RPS

Same gates.

## Q7 Payment concurrency 50

Independently measure. Historical \~544--601ms p95 / \~1642ms p99 is not
authority. If valid host exceeds Class E frozen targets, this is system
FAIL unless environment invalidity is independently proven.

## Q8 Booking/Order 6 chains/s

Record target/started/completed/achieved, load validity, chain
p50/p95/p99/max, failures, duplicates, 1:1 convergence, terminal-state
correctness and EventBus convergence.

## Q9 Booking/Order 20 chains/s --- CRITICAL

Do not weaken this gate. Record duration,
target/expected/started/completed chains, achieved chains/s, load
deviation, chain latency, per-step timings if supported, handler vs
client timing if available, DB connections/locks/waits,
failures/timeouts/transport, duplicate facts and convergence.

PASS requires valid load application, correctness PASS, reliability PASS
and applicable latency gates PASS.

If TravelHub saturates on an admitted dedicated environment, return
VALID SYSTEM FAIL. Do not reuse the prior environment excuse
automatically.

## Q10 Login 2 RPS

Distinct users, real auth, throttle respected. Class F p95≤750 /
p99≤1500ms.

## Q11 Login 5 RPS

Same rules.

## Q12 EventBus steady 100 ev/s

Canonical production worker config. Hard targets: backlog≤100, oldest
PENDING≤10s, 0 lost committed PENDING, poison isolation, 0 duplicate
effects.

Historical failures 171/178 and remediation observations 16--19 are
evidence only; Round 3 must independently judge.

## Q13 EventBus burst 1,000

All healthy events converge, poison isolated, no lost PENDING or
duplicate effects, final drain recorded.

## Q14 EventBus recovery 5,000 / 2 workers

Canonical config, drain≤120s, no test-only interval override.

## Q15 Multi-instance 2 app + 2 worker

Prove both app instances receive traffic and workers converge with no
duplicate/lost facts and no raw controlled-race 500. At-least-once only.

# 13. GLOBAL CORRECTNESS HARD GATE

Across qualification require zero: - duplicate Payment - duplicate
Order - duplicate Commission - duplicate Accrual - wrong divergent
replay - lost committed PENDING - poison blocking healthy events - raw
500 from controlled races - invalid terminal transition - Decimal
corruption

Verify required 1:1 convergence, external idempotency semantics, Payment
lifecycle authority and Inbox/consumer idempotency.

Any valid correctness failure =\> VERDICT B.

# 14. LATENCY MATRIX

Report p50/p95/p99/max separately for classes A--F. Aggregate latency
cannot hide a failing class. Report `sales.list` separately if it
participates; Class B target remains 500/1000ms.

# 15. FAILURE CLASSIFICATION

Classify material findings as: - SYSTEM/APPLICATION - DATABASE/QUERY -
CONNECTION POOL - EVENTBUS/WORKER - HARNESS - QUALIFICATION
ENVIRONMENT - LOAD GENERATOR - ORCHESTRATION - OBSERVABILITY
LIMITATION - UNKNOWN --- ROOT CAUSE NOT PROVEN

Do not overclaim OS-level causality. The prior evidence proves the prior
host/client DB path was unsuitable; it does not prove Windows
universally causes the problem.

# 16. HARNESS DEFECT POLICY

If a new harness defect invalidates essential gates: preserve evidence,
identify affected gates, do not modify code, and return VERDICT C.
Operator/orchestration mistakes may be corrected without code changes,
but invalid runs must remain in the ledger.

# 17. SYSTEM FAILURE POLICY

If a valid host exposes a genuine system failure: do not tune, change
targets, pool, workers, indexes, queries or scenarios. Finish
independent gates where safe and return VERDICT B with exact failed
gates.

# 18. ANTI-CHERRY-PICKING

Retain all runs. Separate invalid orchestration attempts from valid
failures. If a critical gate is repeated, report the complete valid
sequence. Material oscillation is itself a finding.

# 19. REGRESSION

Reproduce canonical backend tsc/build/unit/full serial e2e; frontend
tsc/vitest/production build; migrations and drift=0; artifact checker
with WARN=0/FAIL=0 and checker regression green. Report actual counts.
No skipped/weakened tests, forced exit or retry masking.

# 20. NEGATIVE CHECKS

Explicitly report zero changes for: - approved targets - production
tuning - schema/migrations/indexes/queries - pool/worker tuning -
auth/idempotency weakening - correctness weakening - skipped tests -
hidden failed runs - real PSP network - 2.17C / 2.18 / RLS
implementation - release/deploy

# 21. PSP SUBSET

Unless repository authority has legitimately changed and ADR-0015 +
2.12B prerequisites are satisfied, provider-dependent PSP/webhook
performance remains deferred. Do not fabricate provider latency or
contact a real PSP.

# 22. RESULT ARTIFACTS

Persist structured environment, scenario, latency, correctness,
load-validity, EventBus, multi-instance, Booking burst, payment
warmup/slot accounting and invalid-run evidence under the existing
gitignored convention. Do not commit large transient perf artifacts if
policy excludes them.

# 23. FINAL VERDICT

## A --- VALID SYSTEM PASS

Only if environment admission, REPRESENTATIVE dataset, full frozen
matrix, load validity, all latency/reliability/correctness gates,
Booking burst, EventBus backlog/age/recovery, payment/login and
multi-instance all PASS with no invalidating defect.

Step 2.17B remains NOT APPROVED. NEXT: **STEP 2.17B STRICT REVIEW**.

## B --- VALID SYSTEM FAIL

Use when environment/test are valid and at least one frozen system gate
fails. Step remains NOT APPROVED. NEXT: **PERFORMANCE REMEDIATION** with
exact failed gates.

## C --- QUALIFICATION INVALID / INCOMPLETE

Use when host, harness, dataset, load generator, orchestration or
another essential condition prevents a valid system judgment. Do not
claim system PASS/FAIL. NEXT must name the exact remediation.

# 24. ROADMAP

Update minimally and preserve history.

For A:
`FINAL RE-QUALIFICATION ROUND 3 COMPLETED — VALID SYSTEM PASS — WAITING FOR STRICT REVIEW`

For B:
`FINAL RE-QUALIFICATION ROUND 3 COMPLETED — VALID SYSTEM FAIL — PERFORMANCE REMEDIATION REQUIRED`

For C:
`FINAL RE-QUALIFICATION ROUND 3 INCOMPLETE — QUALIFICATION INVALID — NOT APPROVED`

Never mark APPROVED in this pass.

# 25. CANONICAL REPORT

Create:

`docs/prompts/PHASE_2_STEP_2.17B_FINAL_REQUALIFICATION_ROUND_3_DEDICATED_ENVIRONMENT_REPORT.md`

Include at least: Executive Summary, Verdict, Repository Baseline, Prior
Disposition, Dedicated Environment, Admission, Differential Probes, DB
Isolation, Migration/Drift, Representative Dataset, Seed Drain, Warmup,
Load Validity, every Q1--Q15 gate, Latency Matrix, Reliability Matrix,
Correctness Matrix, sales.list, Environment Comparison, Invalid/Repeated
Run Ledger, Findings, Regression, Negative Checks, PSP Deferral,
Artifact Integrity, Roadmap, Persistence, Release, Verdict Derivation,
Next Step, Repository Evidence Footer.

# 26. REQUIRED FINAL GATE TABLE

  ----------------------------------------------------------------------------------
  Gate                     Target         Actual Load valid Correctness   Verdict
  ---------------- -------------- -------------- ---------- ------------- ----------
  Steady              15m @50 RPS            ... ...        ...           ...

  Peak               15m @100 RPS            ... ...        ...           ...

  Burst              60s @200 RPS            ... ...        ...           ...

  Soak              30m @50 RPS /            ... ...        ...           ...
                              250                                         

  Payment                   2 RPS            ... ...        ...           ...

  Payment burst            10 RPS            ... ...        ...           ...

  Payment conc                 50            ... n/a        ...           ...

  Booking              6 chains/s            ... ...        ...           ...

  Booking burst       20 chains/s            ... ...        ...           ...

  Login                     2 RPS            ... ...        ...           ...

  Login burst               5 RPS            ... ...        ...           ...

  EventBus steady       100 ev/s,            ... ...        ...           ...
                     backlog≤100,                                         
                          age≤10s                                         

  EventBus burst            1,000            ... n/a        ...           ...

  Recovery            5,000 / 2 /            ... n/a        ...           ...
                            ≤120s                                         

  Multi-instance        2 app + 2            ... ...        ...           ...
                           worker                                         
  ----------------------------------------------------------------------------------

Never omit failed rows.

# 27. FINDINGS

Classify CRITICAL/HIGH/MEDIUM/LOW/OBSERVATION and separately state
whether each is a production correctness defect, production performance
defect, harness defect, environment defect, or observability limitation.

# 28. PERSISTENCE

Stage only intended documentation files; no `git add .` / `git add -A`.
Inspect staged diff, commit intentionally, add provenance/footer per
repository convention, push, verify HEAD==upstream, and report unrelated
untracked files without touching them.

If code changes become necessary, STOP instead of mixing remediation
into Round 3.

# 29. REQUIRED TERMINAL OUTPUT

``` text
PHASE 2 STEP 2.17B FINAL RE-QUALIFICATION ROUND 3 COMPLETED —
<VALID SYSTEM PASS | VALID SYSTEM FAIL | QUALIFICATION INVALID / INCOMPLETE>

Decision:
- verdict: <A|B|C> — <meaning>
- qualification environment: <VALID|INVALID>
- repository SHA: <sha>
- targets changed: 0
- production tuning: 0
- Step 2.17B: NOT APPROVED
- Strict Review: NOT STARTED

Environment:
- host/OS: <...>
- CPU/RAM: <...>
- Node/PostgreSQL: <...>
- topology: <...>
- isolated DB: <...>
- REPRESENTATIVE dataset: <PASS/FAIL>

Frozen matrix:
- steady 15m @50 RPS: <...>
- peak 15m @100 RPS: <...>
- burst 60s @200 RPS: <...>
- soak 30m @50 RPS/250: <...>
- payment 2 RPS: <...>
- payment 10 RPS: <...>
- payment concurrency 50: <...>
- booking/order 6 chains/s: <...>
- booking/order 20 chains/s: <...>
- login 2 RPS: <...>
- login 5 RPS: <...>
- EventBus steady 100 ev/s: <...>
- EventBus burst 1,000: <...>
- EventBus recovery 5,000/2: <...>
- multi-instance 2+2: <...>

Correctness:
- duplicate Payment: <n>
- duplicate Order: <n>
- duplicate Commission/Accrual: <n>
- wrong replay: <n>
- lost committed PENDING: <n>
- poison blocking: <n>
- raw controlled-race 500: <n>
- invalid terminal transition: <n>
- Decimal corruption: <n>

Regression:
- backend: <actual>
- frontend: <actual>
- DB: <actual>
- artifact integrity: <actual>

Persistence:
- branch: <...>
- report/docs commit: <...>
- provenance/footer: <...>
- final HEAD/upstream: <...>
- push_status: <...>
- worktree_clean: <...>

RELEASE: NOT PERFORMED

NEXT:
- A → PHASE 2 — STEP 2.17B — STRICT REVIEW
- B → PHASE 2 — STEP 2.17B — PERFORMANCE REMEDIATION (<failed gates>)
- C → PHASE 2 — STEP 2.17B — <exact remediation>
```

# 30. FINAL HARD STOP

End after repository verification, environment admission, Round 3
qualification, regression, report/Roadmap persistence, push verification
and terminal verdict.

Do not begin Strict Review, remediation, target reconciliation, 2.17C,
2.18, RLS, PSP integration or release.

**Success is not "make it pass." Success is a valid, independently
evidenced, non-manipulated verdict against unchanged frozen targets on
an admitted dedicated environment. A valid FAIL is preferable to an
invalid PASS.**
