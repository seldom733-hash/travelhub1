# PHASE 2 — STEP 2.17B — FINAL RE-QUALIFICATION — ROUND 2

## 0. MODE

**FINAL PERFORMANCE QUALIFICATION · REPOSITORY-FIRST · COMPLETE FROZEN QUALIFICATION MATRIX · NO TARGET CHANGES · NO PRODUCTION TUNING · NO HARNESS REMEDIATION INSIDE THIS PASS · VALID PASS/FAIL REQUIRED · CORRECTNESS-UNDER-LOAD HARD GATE · PRESERVE PRIOR EVIDENCE · PSP SUBSET DEFERRED · COMMIT + PUSH · HARD STOP**

Starting state:

```text
PHASE 2 STEP 2.17B QUALIFICATION HARNESS REMEDIATION ROUND 2 COMPLETED —
REPRESENTATIVE DATASET LIVE-VALIDATED —
READY FOR FINAL RE-QUALIFICATION

HARNESS REMEDIATION ROUND 2 = PASS
FINAL RE-QUALIFICATION = NOT RUN
Step 2.17B = NOT APPROVED
Strict Review = NOT STARTED
```

This is not another harness-remediation pass. Execute the complete approved/frozen Step 2.17B qualification matrix and produce a valid system verdict.

A valid measured failure is a **SYSTEM FAIL**, not `VERDICT C`.

---

## 1. VERIFY CANONICAL STARTING STATE

Verify from repository truth:

- Step 2.17 = APPROVED WITH REVIEW FIXES.
- Step 2.17A = APPROVED after strict review.
- Step 2.17B = NOT APPROVED.
- quantitative SLO/load targets = APPROVED and frozen.
- first final qualification = VERDICT C / INVALID-INCOMPLETE.
- harness remediation rounds 1 and 2 = completed.
- REPRESENTATIVE live validation = PASS.
- F-1 drain defect = fixed.
- F-2 historical valid evidence remains visible:
  - 100 ev/s;
  - 3,000/3,000 processed;
  - max backlog 178;
  - target <=100;
  - historical gate verdict FAIL.
- Step 2.17C and 2.18 = NOT STARTED.
- ADR-0015 and 2.12B remain BLOCKED.
- PSP performance subset remains DEFERRED.

Verify reported provenance rather than trusting it:

```text
remediation commit: fc8c7ef
footer/sync chain: e6c2afc → fb2dd6a → d9f25bb
reported HEAD/upstream: d9f25bb
```

Repository truth wins if different.

---

## 2. PROVENANCE BASELINE

Run:

```bash
git status --short
git branch --show-current
git rev-parse HEAD
git rev-parse --verify @{u} 2>/dev/null || true
git log --oneline --decorate -60
git diff
git diff --check
```

Record branch, base SHA, upstream SHA, worktree state, migration count and artifact-integrity baseline.

Never use `git add .` or `git add -A`. Preserve unrelated prompts.

---

## 3. SOURCE REVIEW

Inspect actual current code and canonical docs before execution:

- Roadmap v3 / Step 2.17B;
- load/performance architecture document;
- qualification runbook;
- quantitative-target authority report;
- prior final requalification report;
- remediation round 1 report;
- remediation round 2 report;
- `backend/src/perf/**`;
- `seed.ts`, `run.ts`;
- production EventBus/outbox worker;
- external idempotency implementation;
- PaymentService;
- Booking/Order paths used by scenarios;
- login throttle.

Reports are context, not authority over code.

---

## 4. FROZEN TARGETS — HARD GATE

Do not change any approved value.

### Planning/load

```text
registered users: 100,000
MAU: 25,000
DAU: 5,000

concurrency:
normal 100
peak 250
qualification 500
burst 1,000

read/write mix: 80/20
login <=5%
booking/order <=5%
payment <=2%
other writes <=8%

normal: 25 RPS
V1 peak: 50 RPS
qualification sustained: 100 RPS
burst: 200 RPS
headroom: 2.0x
```

### Latency p95/p99

```text
Class A public reads:          300 / 750 ms
Class B authenticated reads:   500 / 1000 ms
Class C ordinary writes:       750 / 1500 ms
Class D concurrency-sensitive: 1000 / 2000 ms
Class E payment.create:         1000 / 2000 ms
Class F login:                  750 / 1500 ms
```

### Reliability

```text
unexpected 5xx = 0
timeout = 0
transport failure = 0
```

### Payment

```text
peak 1 RPS
qualification 2 RPS
burst 10 RPS
concurrency 50
duplicate Payment = 0
wrong replay = 0
raw 500 from controlled races = 0
```

### Booking/Order

```text
peak 3 chains/s
qualification 6 chains/s
burst 20 chains/s
```

### Login

```text
peak 1 RPS
qualification 2 RPS
burst 5 RPS
```

Respect the real per-instance throttle. Never disable/bypass it.

### EventBus

```text
steady 25 ev/s
peak 50 ev/s
qualification 100 ev/s
burst 1,000 events

max backlog <=100
oldest PENDING <=10 s

recovery:
5,000 events
2 workers
drain <=120 s

semantics:
at-least-once + Inbox/consumer idempotency
```

Exactly-once MUST NOT be claimed.

### Canonical qualification sequence

```text
warm-up: 5 min
steady: 15 min @ 50 RPS
peak: 15 min @ 100 RPS
burst: 60 s @ 200 RPS
domain/EventBus gates
soak: 30 min @ 50 RPS / concurrency 250
```

Required topology where applicable:

```text
2 application instances
2 worker instances
dedicated isolated environment
```

---

## 5. TARGET FREEZE PROOF

Before execution record:

```text
approved_targets_changed = 0
latency_targets_changed = 0
load_targets_changed = 0
eventbus_backlog_target_changed = 0
eventbus_rate_changed = 0
recovery_target_changed = 0
qualification_duration_changed = 0
dataset_authority_changed = 0
```

If authority drift exists, STOP and report it. Do not silently reconcile.

---

## 6. HARNESS PRE-FLIGHT — VALIDITY ONLY

Verify without modifying:

- arrival-rate pacing;
- load-application validity;
- 5-minute warm-up support;
- REPRESENTATIVE dataset;
- state-driven bounded outbox drain;
- payment 2/10 RPS + concurrency 50;
- Booking/Order 6/20 chains/s;
- login 2/5 RPS;
- EventBus 100 ev/s;
- EventBus burst 1,000;
- recovery 5,000 / 2 workers;
- 2 app + 2 worker topology;
- soak 50 RPS / concurrency 250;
- authoritative DB correctness validator;
- structured results;
- safe-target fail-closed guard.

If a new genuine harness/environment defect prevents a mandatory gate, STOP with VERDICT C. Do not repair it in this pass.

---

## 7. QUALIFICATION ENVIRONMENT

Use an isolated qualification DB/environment.

Record:

```text
OS
CPU/vCPU
RAM
Node version
PostgreSQL version
git SHA
DB name
app instance count
worker instance count
canonical worker configuration
Prisma/pool configuration
relevant performance env metadata
start/end timestamps
```

Redact secrets. Never target production/canonical DB.

---

## 8. REPRESENTATIVE DATASET

Required minimums:

```text
users >=1,000
products/service units >=500
customers >=1,000
quotes/sales >=1,000
Booking/Order chains >=1,000
payment-capable orders >=500
finance/ledger >=5,000
EventBus seed capacity >=5,000
```

Record actual counts.

Before timed qualification prove:

```text
healthy PENDING = 0
retryable FAILED requiring recovery = 0
poison/exhausted = explicitly classified
```

Dataset construction failure => VERDICT C.

---

## 9. WARM-UP

Run real traffic for 5 minutes using intended topology. Do not count warm-up as steady measurement.

Record actual RPS and load validity.

---

## 10. STEADY

Execute:

```text
15 min @ 50 RPS
```

Measure per route class:

- requests;
- actual RPS/deviation;
- p50/p95/p99/max;
- unexpected 5xx;
- timeouts;
- transport failures;
- correctness;
- EventBus backlog and oldest PENDING.

Do not hide a route-class failure behind aggregate latency.

---

## 11. PEAK

Execute:

```text
15 min @ 100 RPS
```

Explicitly measure Class B / `sales.list`.

Prior non-final observation:

```text
sales.list p95: 428 → 1533 → 2427 ms under earlier max-effort loads
```

At valid qualification load:

```text
Class B p95 >500 ms => VALID FAIL
Class B p99 >1000 ms => VALID FAIL
```

No query/index/pool tuning in this pass.

---

## 12. BURST

Execute:

```text
60 s @ 200 RPS
```

Record rate validity, route-class latency, reliability, backlog, correctness and recovery.

---

## 13. PAYMENT GATE

Execute:

```text
qualification 2 RPS
burst 10 RPS
concurrency 50
```

Cover unique keys, identical retry, concurrent identical, divergent reuse, business idempotency per order and external Idempotency-Key.

Hard invariants:

```text
duplicate Payment = 0
wrong replay = 0
raw 500 from controlled race = 0
wrong lifecycle transition = 0
provider-operation identity remains server-derived
```

Validate authoritative DB state.

No real PSP network.

---

## 14. BOOKING / ORDER GATE

Execute:

```text
qualification 6 chains/s
burst 20 chains/s
```

Validate:

```text
facts converge
duplicate Order = 0
invalid terminal transition = 0
lost committed state = 0
uncontrolled raw 500 = 0
consumer chain converges
```

Prior single-instance 20 chains/s timeout observation is not a license to change timeout. Use approved topology.

A valid failure => VERDICT B, not C.

---

## 15. LOGIN GATE

Execute:

```text
qualification 2 RPS
burst 5 RPS
```

Use a workload that respects the real throttle contract.

Class F:

```text
p95 <=750 ms
p99 <=1500 ms
```

Unexpected 5xx/timeout/transport = 0. Expected controlled 429, if part of scenario contract, must be reported separately.

---

## 16. EVENTBUS STEADY — CRITICAL RE-TEST

Execute a fresh valid:

```text
100 events/sec
```

Canonical production worker configuration only.

Do not change worker interval, batch size, retry semantics, claim semantics, pool, worker authority, rate or target.

Measure:

```text
generated/processed
actual generation rate
max backlog
backlog distribution if available
max oldest-PENDING age
post-generation drain
lost events
duplicate consumer effects
poison isolation
```

Approved:

```text
max backlog <=100
oldest PENDING <=10s
```

Historical valid evidence:

```text
max backlog = 178 => FAIL
oldest PENDING = 1.77s => PASS
```

If fresh max backlog >100:

```text
EVENTBUS_BACKLOG_GATE = VALID FAIL
SYSTEM PERFORMANCE QUALIFICATION = FAIL
VERDICT = B
```

Do not return C and do not tune EventBus.

If fresh run passes, preserve historical 178 evidence and explain variance only if evidence supports it.

---

## 17. EVENTBUS BURST

Execute 1,000-event burst.

Required:

```text
all healthy work drains
lost committed PENDING = 0
poison isolated
duplicate domain facts = 0
raw 500 from controlled recovery = 0
```

Record drain duration.

---

## 18. EVENTBUS RECOVERY

Execute:

```text
5,000 events
2 workers
canonical configuration
```

Required:

```text
drain <=120 s
```

Record start/max backlog, oldest age, drain time, final PENDING, retryable FAILED, poison/exhausted and duplicate effects.

No worker interval override.

---

## 19. MULTI-INSTANCE

Execute:

```text
2 app instances
2 worker instances
```

Prove:

- HTTP distribution;
- worker concurrency;
- EventBus convergence;
- external idempotency;
- duplicate Payment = 0;
- duplicate Order = 0;
- duplicate Commission/Accrual = 0;
- lost PENDING = 0.

Do not infer multi-instance safety from one process.

---

## 20. SOAK

Execute full:

```text
30 min @ 50 RPS / concurrency 250
```

Measure latency over time, reliability, backlog, oldest PENDING, correctness and memory if available.

If memory is unavailable:

```text
MEMORY = NOT MEASURED — OBSERVABILITY LIMITATION
```

Compare early/middle/late windows for degradation.

---

## 21. CORRECTNESS-UNDER-LOAD — HARD GATE

Any of the following => VALID SYSTEM FAIL:

```text
duplicate Payment >0
duplicate Order >0
duplicate Commission >0
duplicate Accrual >0
wrong/divergent replay >0
lost committed PENDING >0
poison blocks healthy work
raw 500 from controlled race >0
Decimal corruption
invalid terminal transition
unauthorized cross-domain writer behavior
```

Fast-but-wrong = FAIL.

Validate through authoritative DB state.

---

## 22. PSP SUBSET

Keep deferred:

```text
real PSP latency
provider rate limits
real webhook burst
provider callback convergence
provider sandbox behavior
```

Reason: ADR-0015/2.12B remain blocked.

No real PSP network.

---

## 23. NO REMEDIATION INSIDE QUALIFICATION

On a valid system failure DO NOT change:

```text
sales.service.ts
Booking/Order production code
queries/indexes
schema/migrations
Prisma pool
PostgreSQL settings
worker interval/batch
retry policy
HTTP timeout
cache
SLO values
load rates
durations
```

Record and route to a separate performance-remediation pass.

---

## 24. VALIDITY CLASSIFICATION

Every mandatory gate must be one of:

```text
VALID PASS
VALID FAIL
INVALID / NOT EXECUTABLE
DEFERRED BY APPROVED EXTERNAL DEPENDENCY
```

Rules:

- any mandatory platform gate INVALID => VERDICT C;
- all mandatory platform gates valid, but >=1 FAIL => VERDICT B;
- all mandatory platform gates PASS, only approved PSP subset deferred => VERDICT A.

---

## 25. VERDICT MODEL

### A — VALID SYSTEM PASS

```text
PHASE 2 STEP 2.17B FINAL RE-QUALIFICATION ROUND 2 COMPLETED —
VALID SYSTEM PERFORMANCE VERDICT AVAILABLE —
PLATFORM QUALIFICATION PASS —
READY FOR STRICT REVIEW
```

Step 2.17B is still not finally APPROVED until strict review.

NEXT: Step 2.17B Strict Review.

### B — VALID SYSTEM FAIL

```text
PHASE 2 STEP 2.17B FINAL RE-QUALIFICATION ROUND 2 COMPLETED —
VALID SYSTEM PERFORMANCE VERDICT AVAILABLE —
PLATFORM QUALIFICATION FAIL —
PERFORMANCE REMEDIATION REQUIRED
```

Do not remediate now.

NEXT: dedicated Step 2.17B Performance Remediation.

### C — INVALID / INCOMPLETE

Only for a genuine mandatory harness/environment/orchestration blocker.

Do not use C to avoid reporting a valid failure.

---

## 26. FAILURE TRIAGE — CLASSIFY, DO NOT FIX

For each valid failure classify only with evidence:

```text
DATABASE QUERY
CONNECTION POOL
APPLICATION CPU
EVENTBUS CAPACITY
LOCK CONTENTION
TRANSACTION BOUNDARY
ENVIRONMENT
UNKNOWN — ROOT CAUSE NOT YET PROVEN
```

For F-2, if reproduced, do not invent a root cause.

---

## 27. FINAL GATE MATRIX

The report MUST contain a table with at least:

| Gate | Approved target | Measured | Validity | Verdict |
|---|---:|---:|---|---|
| Warm-up | 5 min | actual | | |
| Steady | 15 min @50 RPS | actual | | |
| Peak | 15 min @100 RPS | actual | | |
| Burst | 60 s @200 RPS | actual | | |
| Class A | p95/p99 300/750 ms | actual | | |
| Class B | 500/1000 ms | actual | | |
| Class C | 750/1500 ms | actual | | |
| Class D | 1000/2000 ms | actual | | |
| Payment | 1000/2000 ms | actual | | |
| Login | 750/1500 ms | actual | | |
| Unexpected 5xx | 0 | actual | | |
| Timeout | 0 | actual | | |
| Transport failure | 0 | actual | | |
| Payment qualification | 2 RPS | actual | | |
| Payment burst | 10 RPS | actual | | |
| Payment concurrency | 50 | actual | | |
| Booking/Order | 6 chains/s | actual | | |
| Booking/Order burst | 20 chains/s | actual | | |
| Login | 2 RPS | actual | | |
| Login burst | 5 RPS | actual | | |
| EventBus steady | 100 ev/s | actual | | |
| EventBus backlog | <=100 | actual max | | |
| Oldest PENDING | <=10s | actual | | |
| EventBus burst | 1,000 | actual | | |
| Recovery | 5,000 / 2 workers / <=120s | actual | | |
| Multi-instance | 2 app + 2 worker | actual | | |
| Soak | 30m @50 RPS / 250 | actual | | |
| Correctness | zero violations | actual | | |
| PSP subset | deferred | N/A | DEFERRED | N/A |

Add any additional canonical approved gates found in repo.

---

## 28. PRIOR EVIDENCE RECONCILIATION

Explicitly reconcile:

### F-1

```text
previous: invalidating harness drain defect
current: fixed in round 2; REPRESENTATIVE live-validated
```

### F-2

```text
historical valid max backlog = 178
target = <=100
historical verdict = FAIL
fresh measurement = <actual>
fresh verdict = <PASS/FAIL>
```

Never delete or reclassify historical valid evidence.

---

## 29. FULL REGRESSION

After qualification run:

Backend:

```text
tsc
build
unit
full serial e2e
```

Frontend:

```text
tsc
vitest
production build
```

DB:

```text
migrations current
drift = 0
```

Artifact integrity:

```text
checker regression
canonical Roadmap checker
WARN = 0
FAIL = 0
```

Use actual counts.

---

## 30. CLEANUP

Verify:

```text
harness app instances stopped
harness worker instances stopped
orphan processes = 0
harness-owned data cleaned
qualification DB dropped where required
orphan qualification DB = 0
```

Preserve structured evidence according to repo policy. Do not commit large raw artifacts unless policy requires it.

---

## 31. REQUIRED REPORT

Create:

```text
docs/prompts/PHASE_2_STEP_2.17B_FINAL_REQUALIFICATION_ROUND_2_REPORT.md
```

Required content:

1. mode;
2. verdict;
3. repository truth;
4. provenance;
5. frozen authority;
6. target-freeze proof;
7. pre-flight;
8. environment/topology;
9. REPRESENTATIVE dataset;
10. seed/drain;
11. warm-up;
12. steady;
13. peak;
14. burst;
15. latency A–F;
16. reliability;
17. payment;
18. external idempotency;
19. Booking/Order;
20. login;
21. EventBus steady;
22. EventBus backlog;
23. oldest PENDING;
24. EventBus burst;
25. recovery;
26. multi-instance;
27. soak;
28. correctness;
29. F-1 reconciliation;
30. F-2 reconciliation;
31. Sales observation;
32. Booking/Order observation;
33. valid failures;
34. invalid runs;
35. PSP deferred subset;
36. no-remediation proof;
37. final gate matrix;
38. regression;
39. DB/drift;
40. cleanup;
41. artifact integrity;
42. negative checks;
43. Roadmap update;
44. changed files;
45. commit/push;
46. REPOSITORY EVIDENCE;
47. release;
48. NEXT;
49. HARD STOP.

---

## 32. ROADMAP UPDATE

### VERDICT A

Equivalent state:

```text
🚧 FINAL RE-QUALIFICATION COMPLETED —
PLATFORM QUALIFICATION PASS —
WAITING FOR STRICT REVIEW
```

NEXT = Step 2.17B Strict Review.

Do not mark APPROVED.

### VERDICT B

Equivalent:

```text
🚧 FINAL RE-QUALIFICATION COMPLETED —
VALID PLATFORM PERFORMANCE FAIL —
PERFORMANCE REMEDIATION REQUIRED —
NOT APPROVED
```

NEXT = Step 2.17B Performance Remediation.

### VERDICT C

Equivalent:

```text
🚧 FINAL RE-QUALIFICATION ROUND 2 INCOMPLETE —
QUALIFICATION INVALID —
NOT APPROVED
```

NEXT must identify the exact blocker.

Never rewrite historical entries.

---

## 33. NEGATIVE CHECKS

Report explicitly:

```text
approved targets changed = 0
latency SLO changed = 0
EventBus backlog target changed = 0
EventBus rate reduced = 0
qualification duration reduced = 0
dataset authority reduced = 0

production tuning = 0
sales.service.ts tuning = 0
Booking/Order tuning = 0
query tuning = 0
index tuning = 0
schema changes = 0
migration changes = 0
Prisma pool tuning = 0
PostgreSQL tuning = 0
worker interval tuning = 0
worker batch tuning = 0
retry-policy tuning = 0
HTTP timeout increase = 0
cache added = 0

failed evidence hidden = 0
F-2 deleted = 0
F-2 reclassified invalid = 0
tests skipped = 0
assertions weakened = 0
retry masking = 0
forced-exit masking = 0

real PSP network = 0
2.12B started = 0
2.12I started = 0
2.17C started = 0
2.18 started = 0
RLS implementation = 0

Strict Review started = 0
release/deployment = 0
```

---

## 34. GIT DISCIPLINE

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

Stage exact files only.

Inspect:

```bash
git diff --cached --stat
git diff --cached
```

Never use `git add .` / `git add -A`.

---

## 35. COMMIT COMMANDS

### VERDICT A

```bash
git commit -m "test(perf): qualify Phase 2 platform load targets"
```

### VERDICT B

```bash
git commit -m "test(perf): record Phase 2 performance qualification failures"
```

### VERDICT C

```bash
git commit -m "test(perf): record incomplete final requalification"
```

If the repository evidence footer requires a second commit after the real SHA is known:

```bash
git add docs/prompts/PHASE_2_STEP_2.17B_FINAL_REQUALIFICATION_ROUND_2_REPORT.md
git commit -m "docs: populate Step 2.17B requalification repository evidence"
```

---

## 36. PUSH + PERSISTENCE

Push:

```bash
git push origin HEAD
```

Then verify:

```bash
git rev-parse HEAD
git rev-parse --verify @{u}
git status --short
```

Only claim:

```text
push_status = PUSHED
```

when final `HEAD == upstream`.

If push fails, report `FAILED`.

---

## 37. RELEASE

```text
RELEASE: NOT PERFORMED
```

Do not deploy/tag/release automatically.

---

## 38. REPOSITORY EVIDENCE FOOTER

Populate actual values:

```text
REPOSITORY EVIDENCE

repository:
branch:
base_sha:
round2_harness_remediation_sha:
qualification_commit_sha:
provenance_footer_commit_sha:
final_head_sha:
upstream_sha:
push_status:
worktree_clean:

migration_count:
database_drift:
artifact_integrity:
checker_regression:

targets_frozen:
targets_changed:

qualification_environment:
node_version:
postgres_version:
cpu:
memory:
app_instances:
worker_instances:

representative_dataset:
seed_duration:
seed_drain_iterations:
seed_drain_duration:
pending_after_seed:
retryable_failed_after_seed:

warmup:
steady:
peak:
burst:
soak:

class_a_p95:
class_a_p99:
class_b_p95:
class_b_p99:
class_c_p95:
class_c_p99:
class_d_p95:
class_d_p99:
payment_p95:
payment_p99:
login_p95:
login_p99:

unexpected_5xx:
timeouts:
transport_failures:

payment_qualification:
booking_order_qualification:
login_qualification:

eventbus_steady_rate:
eventbus_max_backlog:
eventbus_backlog_target:
eventbus_oldest_pending:
eventbus_burst:
eventbus_recovery:
multi_instance:

duplicate_payment:
duplicate_order:
duplicate_commission:
duplicate_accrual:
wrong_replay:
lost_pending:
poison_blocking:
raw_500_controlled_races:
decimal_integrity:
invalid_terminal_transition:

f1_state:
historical_f2_backlog:
historical_f2_verdict:
fresh_f2_backlog:
fresh_f2_verdict:

sales_observation:
booking_order_observation:

psp_subset:
production_tuning:
harness_changes_during_qualification:

backend_regression:
frontend_regression:

qualification_verdict:
step_2_17b_state:
strict_review_state:
step_2_17c_state:
step_2_18_state:

release_status:
persistence_status:
```

---

## 39. REQUIRED OUTPUT — VERDICT A

```text
PHASE 2 STEP 2.17B FINAL RE-QUALIFICATION ROUND 2 COMPLETED —
VALID SYSTEM PERFORMANCE VERDICT AVAILABLE —
PLATFORM QUALIFICATION PASS —
READY FOR STRICT REVIEW

Decision:
- verdict: A — VALID SYSTEM PASS
- approved targets changed: 0
- production tuning: 0
- harness changes during qualification: 0
- Step 2.17B: QUALIFICATION COMPLETED — WAITING FOR STRICT REVIEW
- Strict Review: NOT STARTED

Qualification:
- warm-up: PASS
- steady 15m @50 RPS: PASS
- peak 15m @100 RPS: PASS
- burst 60s @200 RPS: PASS
- soak 30m @50 RPS / 250: PASS
- latency A–F: PASS
- reliability: PASS
- payment: PASS
- Booking/Order: PASS
- login: PASS
- EventBus steady/backlog: PASS
- EventBus burst: PASS
- EventBus recovery: PASS
- multi-instance: PASS
- correctness-under-load: PASS

F-2:
- historical backlog: 178 >100 — preserved
- fresh backlog: <actual>
- fresh verdict: PASS

Regression:
- backend: <actual>
- frontend: <actual>
- DB: <actual>
- artifact integrity: PASS=<actual> WARN=0 FAIL=0

Persistence:
- branch: <actual>
- qualification commit: <sha>
- provenance/footer: <sha>
- final HEAD/upstream: <sha>
- push_status: PUSHED

RELEASE: NOT PERFORMED
NEXT: PHASE 2 — STEP 2.17B — STRICT REVIEW
```

---

## 40. REQUIRED OUTPUT — VERDICT B

```text
PHASE 2 STEP 2.17B FINAL RE-QUALIFICATION ROUND 2 COMPLETED —
VALID SYSTEM PERFORMANCE VERDICT AVAILABLE —
PLATFORM QUALIFICATION FAIL —
PERFORMANCE REMEDIATION REQUIRED

Decision:
- verdict: B — VALID SYSTEM FAIL
- qualification validity: PASS
- approved targets changed: 0
- production tuning: 0
- harness changes during qualification: 0
- Step 2.17B: NOT APPROVED
- Strict Review: NOT STARTED

Failed gates:
- <gate>: target <x> / measured <y> / VALID FAIL

Passed gates:
- <actual>

F-2:
- historical backlog: 178 >100 — preserved
- fresh backlog: <actual>
- fresh verdict: <PASS/FAIL>

Correctness-under-load:
- <PASS/FAIL>

Root-cause status:
- <evidence-backed classification or UNKNOWN — ROOT CAUSE NOT YET PROVEN>

Regression:
- backend: <actual>
- frontend: <actual>
- DB: <actual>
- artifact integrity: PASS=<actual> WARN=0 FAIL=0

Persistence:
- branch: <actual>
- qualification commit: <sha>
- provenance/footer: <sha>
- final HEAD/upstream: <sha>
- push_status: PUSHED

RELEASE: NOT PERFORMED
NEXT: PHASE 2 — STEP 2.17B — PERFORMANCE REMEDIATION
      (separate dedicated prompt; frozen targets unchanged)
```

---

## 41. REQUIRED OUTPUT — VERDICT C

```text
PHASE 2 STEP 2.17B FINAL RE-QUALIFICATION ROUND 2 INCOMPLETE —
VALID SYSTEM PERFORMANCE VERDICT NOT AVAILABLE

Decision:
- verdict: C — QUALIFICATION INVALID / INCOMPLETE
- System PASS claimed: NO
- System FAIL claimed: NO
- exact invalidating blocker: <evidence>
- valid system failures observed separately: <preserve>
- targets changed: 0
- production tuning: 0
- Step 2.17B: NOT APPROVED
- Strict Review: NOT STARTED

RELEASE: NOT PERFORMED
NEXT: <dedicated remediation for exact blocker>
```

---

## 42. HARD STOP

After repository verification, target freeze, pre-flight, isolated environment, REPRESENTATIVE seed, full warm-up/steady/peak/burst/domain/EventBus/multi-instance/soak matrix, correctness validation, gate matrix, regression, cleanup, artifact integrity, report, Roadmap update, exact staging, commit, provenance/footer, push and final `HEAD == upstream` verification — **STOP**.

Do not remediate a valid performance failure.
Do not change frozen targets.
Do not tune production.
Do not automatically start Strict Review.
Do not start 2.17C, 2.18, RLS, PSP, 2.12B or 2.12I.
Do not deploy/release.

Canonical NEXT:

```text
VERDICT A → STEP 2.17B STRICT REVIEW
VERDICT B → STEP 2.17B PERFORMANCE REMEDIATION
VERDICT C → DEDICATED REMEDIATION OF EXACT INVALIDATING BLOCKER
```
