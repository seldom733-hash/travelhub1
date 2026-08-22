# PHASE 2 — STEP 2.17B — FINAL RE-QUALIFICATION AGAINST UNCHANGED APPROVED TARGETS

## 0. MODE

**FINAL PERFORMANCE QUALIFICATION · REPOSITORY-FIRST · FROZEN AUTHORITY · PACED LOAD · EXACT 2 APP + 2 WORKER TOPOLOGY · CORRECTNESS-UNDER-LOAD HARD GATE · NO TARGET CHANGES · NO PERFORMANCE TUNING · NO HARNESS REMEDIATION · NO STRICT REVIEW · EVIDENCE/PERSISTENCE REQUIRED · HARD STOP**

Starting evidence supplied by the preceding completed pass:

```text
PHASE 2 STEP 2.17B QUALIFICATION HARNESS/ENVIRONMENT REMEDIATION COMPLETED
verdict: A — READY FOR RE-QUALIFICATION
final qualification executed: NO
Step 2.17B: NOT APPROVED
strict review: NOT STARTED
baseline/final HEAD reported: 9310253
```

Purpose:

> Execute the complete approved Step 2.17B qualification matrix against the unchanged authority and produce a valid system PASS / FAIL / INVALID verdict.

Sequence:

```text
approved quantitative authority
→ invalid first qualification
→ harness remediation
→ FINAL RE-QUALIFICATION
→ persist verdict/evidence
→ HARD STOP
→ Strict Review only in a separate pass if qualification PASSes
```

---

# 1. NON-NEGOTIABLE SEMANTICS

```text
APPROVED TARGET ≠ OBSERVED MEASUREMENT
HARNESS CAPABILITY PASS ≠ SYSTEM PERFORMANCE PASS
VALID LOAD APPLICATION ≠ LATENCY PASS
FAST ≠ CORRECT
SYSTEM FAIL ≠ HARNESS INVALID
QUALIFICATION PASS ≠ STEP 2.17B APPROVAL
LOCAL/ISOLATED RESULT ≠ PRODUCTION CAPACITY CLAIM
TRAVELHUB payment.create ≠ REAL PSP NETWORK PERFORMANCE
```

Never change targets to fit measurements.
Never tune production code in this pass.
Never modify the harness to rescue a failing result.
Never rerun until green.

If the harness/environment is invalid, record verdict C and STOP.
If a frozen system gate genuinely fails under valid evidence, record verdict B and do NOT fix it here.

---

# 2. REPOSITORY-FIRST START

Independently verify:

```text
Step 2.17 = APPROVED
Step 2.17A = APPROVED

Step 2.17B:
- harness IMPLEMENTED
- quantitative authority APPROVED
- first qualification INVALID/INCOMPLETE
- harness remediation COMPLETED
- all frozen profiles executable
- final re-qualification NOT STARTED
- NOT APPROVED
- Strict Review NOT STARTED

2.17C = NOT STARTED
2.18 = NOT STARTED
ADR-0015 = PROPOSED/BLOCKED
2.12B = BLOCKED
PSP subset = DEFERRED
```

Read actual Roadmap, architecture doc, runbook, authority reports, first qualification report, harness-remediation report, `backend/src/perf/**`, qualification manifest, production worker defaults and bootstrap/topology.

Code and persisted authority are authoritative.

---

# 3. PROVENANCE

Before execution:

```bash
git status --short
git branch --show-current
git rev-parse HEAD
git rev-parse --verify @{u} 2>/dev/null || true
git log --oneline --decorate -50
git diff
```

Verify, do not assume, the supplied preceding state:

```text
branch: master
remediation: e2c8231
provenance: 8262468
sync/final baseline: 9310253
HEAD == upstream: 9310253
```

Record actual Node, PostgreSQL, OS, CPU, RAM if measurable, migration count, drift and artifact-checker baseline.

Preserve unrelated untracked prompt files.

---

# 4. FROZEN AUTHORITY — HARD GATE

Reconstruct from persisted authority and prove zero changes.

## HTTP

```text
normal 25 RPS
V1 peak 50 RPS
qualification sustained 100 RPS
burst 200 RPS
headroom 2.0x
```

## Concurrency

```text
normal 100
peak 250
qualification 500
burst 1,000
```

## Latency p95/p99

```text
A public reads             300 / 750 ms
B authenticated reads      500 / 1000 ms
C ordinary writes          750 / 1500 ms
D concurrency-sensitive   1000 / 2000 ms
E payment.create          1000 / 2000 ms
F login                    750 / 1500 ms
```

## Reliability

```text
unexpected 5xx = 0
timeouts = 0
transport failures = 0
```

## Payment

```text
qualification 2 RPS
burst 10 RPS
concurrency 50
duplicate Payment = 0
```

## Booking/Order

```text
qualification 6 RPS
burst 20 RPS
```

## Login

```text
qualification 2 RPS
burst 5 RPS
throttle respected
```

## EventBus

```text
qualification 100 ev/s
burst 1,000 events
backlog <=100
oldest PENDING <=10 s
recovery 5,000 events / 2 workers / <=120 s
at-least-once + Inbox/consumer idempotency
```

## Full sequence

```text
2 app + 2 worker
dedicated isolated environment
warm-up 5 min
steady 15 min @ 50 RPS
peak 15 min @ 100 RPS
burst 60 sec @ 200 RPS
soak 30 min @ 50 RPS / concurrency 250
```

Future-scaling 1,000 RPS / 5,000 concurrent / 20 payment RPS / 500 ev/s is planning-only and MUST NOT be qualified here.

Required:

```text
TARGETS_CHANGED = 0
TARGETS_RELAXED = 0
```

---

# 5. ENVIRONMENT VALIDITY

Provision a fresh safe isolated qualification DB.

Required:

```text
canonical DB untouched
58 canonical migrations
drift 0
REPRESENTATIVE synthetic deterministic dataset
2 real app instances
2 real worker instances
shared PostgreSQL
canonical worker interval/batch
real guards/pipes/RBAC/idempotency/outbox path
real PSP network = 0
```

Qualification is INVALID if topology, DB safety, dataset, worker config, pacing, warm-up, or required evidence is wrong.

Do not accidentally boot four workers because app instances auto-start workers. Prove exact active topology.

---

# 6. PRE-RUN BASELINE REGRESSION

Before long load execution run:

```text
backend tsc
backend build
backend unit
backend full serial e2e
frontend tsc
frontend vitest
frontend production build
migrations
drift
artifact checker regression
```

If baseline is broken, verdict C / BLOCKED. Do not repair unrelated failures here.

---

# 7. REPRESENTATIVE DATASET

Use the canonical `REPRESENTATIVE` profile and record actual counts.

Minimum contract from remediation:

```text
Users >=1,000
Products/service units >=500
Customers/CRM >=1,000
Sales/quotes >=1,000
Booking/Order chains >=1,000
Payment-capable orders >=500
Finance/ledger >=5,000
EventBus seed capacity >=5,000
```

Use actual domain mappings if names differ. Record run prefix, setup duration and cleanup ownership.

---

# 8. TOPOLOGY PROOF

Before measurements:

```text
app1 READY
app2 READY
worker1 READY
worker2 READY
shared isolated DB = YES
canonical worker interval = YES
canonical worker batch = YES
```

Prove both app instances receive HTTP traffic and report per-instance counts.

If exact topology is not achieved:

```text
QUALIFICATION_CONFIG_VALID = FAIL
verdict = C — INVALID
```

---

# 9. LOAD-APPLICATION VALIDITY

For every paced HTTP phase record:

```text
target RPS
scheduled starts
started operations
completed operations
achieved start RPS
completion RPS
scheduler lag
max concurrency
requested/measured duration
```

Use the already-remediated validity rule:

```text
sustained achieved start rate within ±5%
burst scheduled starts within ±5% of requested total
```

Failure of this criterion invalidates the phase; it is not automatically a system performance FAIL.

---

# 10. EXECUTION ORDER

Execute the full canonical sequence without shortening required durations.

## 10.1 Warm-up

```text
5 minutes
paced representative traffic
2 app + 2 worker
```

Warm-up must be separately reported and excluded from measurement windows according to the canonical harness contract.

## 10.2 Steady

```text
15 minutes @ 50 RPS
```

## 10.3 Peak qualification

```text
15 minutes @ 100 RPS
```

## 10.4 Burst

```text
60 seconds @ 200 RPS
```

## 10.5 Domain-specific gates

Run payment, Booking/Order, login and EventBus gates below.

## 10.6 Soak

```text
30 minutes @ 50 RPS
concurrency ceiling 250
```

Do not substitute max-effort runs.

---

# 11. HTTP EVIDENCE PER PHASE

For steady, peak, burst and soak record:

```text
load validity
request count
route-class counts
p50/p95/p99/max per Class A–F
unexpected 5xx
timeouts
transport failures
expected controlled statuses
scheduler lag
max concurrency
per-app distribution
EventBus backlog/age
correctness result
```

Do not average away a failing route class.

---

# 12. OBS-1 / CLASS B — FINAL JUDGMENT

Previous invalid max-effort qualification observed `sales.list` degradation, approximately:

```text
p95 428 ms @ ~250 RPS
p95 1533 ms @ ~367 RPS
p95 2427 ms @ ~310 RPS / concurrency 250
```

Root cause remains:

```text
NOT YET PROVEN
```

No tuning is allowed.

At valid paced qualification load:

```text
Class B p95 <=500 ms
Class B p99 <=1000 ms
```

Outcomes:

```text
within target → PASS
above target under valid evidence → genuine FAIL
invalid load/environment → no system judgment
```

Do not convert the prior observation into a pre-decided result.

---

# 13. PAYMENT.CREATE

Execute:

```text
2 RPS sustained
10 RPS burst
concurrency 50
```

Cover canonical:

```text
unique keys
identical retry
concurrent identical
divergent reuse
business no-op for existing active Payment
cross-principal isolation where applicable
```

Hard gates:

```text
duplicate Payment = 0
wrong/divergent replay = 0
raw 500 controlled race = 0
invalid terminal transition = 0
Decimal corruption = 0
```

Latency Class E:

```text
p95 <=1000 ms
p99 <=2000 ms
```

No real PSP network.

---

# 14. BOOKING / ORDER

Execute:

```text
6 chains/sec sustained
20 chains/sec burst
```

Hard gates:

```text
duplicate Booking/Order facts = 0 where uniqueness applies
invalid lifecycle transition = 0
lost committed PENDING = 0
consumer convergence = PASS
raw 500 controlled race = 0
```

Record chain completions, aborted chains, timeouts and event convergence.

Important prior remediation observation:

```text
single-instance 20 chains/s:
15 s/call timeout observed
11 Orders
1:1 convergence
0 duplicates
```

This is NOT inherited as a failure.

Judge the final burst only under required 2-app + 2-worker topology. If it validly fails, record FAIL and do not remediate.

---

# 15. LOGIN

Execute:

```text
2 RPS qualification
5 RPS burst
```

Use distinct principals as designed. Respect, never bypass, the per-instance throttle.

Classify expected 429 separately.

Class F:

```text
p95 <=750 ms
p99 <=1500 ms
```

Reliability:

```text
unexpected 5xx = 0
timeout = 0
transport failure = 0
```

No credential leakage in artifacts.

---

# 16. EVENTBUS STEADY — 100 EV/S

Execute fresh paced generation:

```text
100 events/sec
2 workers
canonical worker config
```

Measure:

```text
generation rate
processing rate
PENDING backlog time series
max backlog
oldest PENDING
retryable FAILED
poison/exhausted
consumer effects
duplicates
loss
```

Approved gates:

```text
max backlog <=100
oldest PENDING <=10 sec
```

Critical prior remediation evidence:

```text
short capability validation at 100 ev/s:
max backlog = 172
oldest PENDING ≈1.7 s
```

That was NOT final qualification evidence.

If the fresh valid final run again produces `max backlog >100`, the backlog gate FAILS. Do not reinterpret or tune the worker.

---

# 17. EVENTBUS BURST — 1,000

Execute fresh:

```text
1,000 events
2 workers
canonical config
```

Record seed, processed, drain time, duplicates, loss, poison isolation and consumer convergence.

Do not reuse the remediation ~11.3 s result as final evidence.

---

# 18. EVENTBUS RECOVERY — 5,000

Execute fresh:

```text
5,000 events
2 workers
canonical interval/batch
```

Gate:

```text
drain <=120 sec
```

Hard correctness:

```text
recoverable events converge
duplicate business effects = 0
lost events = 0
poison does not block healthy events
Inbox idempotency preserved
```

Do not reuse remediation ~51.3 s as final evidence.

---

# 19. FULL SOAK

Execute:

```text
30 min
50 RPS
concurrency ceiling 250
2 app + 2 worker
REPRESENTATIVE dataset
```

Record interval/time-series evidence sufficient to detect degradation:

```text
achieved RPS
p50/p95/p99/max per class
5xx/timeouts/transport
scheduler lag
concurrency
EventBus backlog/age
correctness
memory if reliably available
```

No approved memory SLO exists. Do not claim a memory leak from RSS movement alone.

---

# 20. GLOBAL CORRECTNESS-UNDER-LOAD HARD GATE

Independently validate authoritative DB state after mutation-heavy scenarios and at end.

Required:

```text
duplicate Payment = 0
duplicate Order = 0
duplicate Commission = 0
duplicate CommissionAccrual = 0
wrong/divergent idempotency replay = 0
lost committed PENDING = 0
poison-blocking = 0
raw 500 controlled race = 0
invalid terminal transition = 0
Decimal corruption = 0
Inbox/consumer dedup preserved
at-least-once semantics preserved
```

Fast-but-wrong = FAIL.

---

# 21. GLOBAL RELIABILITY HARD GATE

Across valid qualification measurement windows:

```text
unexpected 5xx = 0
timeouts = 0
transport failures = 0
```

Expected controlled conflicts/throttle responses must be classified separately.

Never hide them by rewriting assertions.

---

# 22. LATENCY EVALUATION

For each applicable class report:

```text
sample count
p50
p95
p99
max
target
verdict
```

Forbidden:

- aggregate-only comparison when class targets exist;
- dropping slow requests;
- excluding failures to improve percentiles;
- replacing p99 with average;
- cherry-picking a green repetition.

If sample size is insufficient for a required gate, classify that gate INVALID/INCOMPLETE.

---

# 23. RERUN / FAILURE POLICY

Allowed reruns only for:

```text
environment interruption
orchestration failure
corrupted result artifact
load-application invalidity
explicit reproduction of surprising evidence without any system/config change
```

Forbidden:

```text
rerun until green
target reduction
duration reduction
concurrency reduction
DB/app/worker tuning
dataset reduction
failed-run hiding
```

List every invalidated/repeated run and reason.

If a valid gate fails, preserve evidence and continue independent gates when safe/useful. Do not fix it.

---

# 24. VERDICT MODEL

## A — QUALIFICATION PASS

Only if all required scenarios are validly executed and every applicable frozen performance, reliability and correctness gate passes.

State:

```text
FINAL RE-QUALIFICATION = PASS
Step 2.17B = QUALIFICATION COMPLETED — WAITING FOR STRICT REVIEW
Step 2.17B approved = NO
Strict Review = NOT STARTED
```

NEXT:

```text
PHASE 2 — STEP 2.17B — STRICT REVIEW
```

## B — QUALIFICATION FAIL

Use when at least one frozen system gate genuinely fails under valid evidence.

State:

```text
FINAL RE-QUALIFICATION = FAIL
Step 2.17B = QUALIFICATION FAILED — PERFORMANCE REMEDIATION REQUIRED
Step 2.17B approved = NO
Strict Review = NOT STARTED
```

NEXT:

```text
PHASE 2 — STEP 2.17B — PERFORMANCE REMEDIATION
```

No remediation in this pass.

## C — INVALID / INCOMPLETE

Use when a required system gate cannot be validly judged due to harness/environment/baseline/evidence failure.

State:

```text
System PASS claimed = NO
System FAIL claimed = NO
Step 2.17B = NOT APPROVED
Strict Review = NOT STARTED
```

Route only the proven blocker to a separate pass.

---

# 25. PSP / FUTURE-SCALING BOUNDARY

Remain excluded:

```text
real PSP network = 0
provider latency = deferred
provider webhook burst = deferred
provider callback convergence = deferred
ADR-0015 = BLOCKED
2.12B = BLOCKED
```

Do NOT test future-scaling planning targets:

```text
1,000 RPS
5,000 concurrent
20 payment RPS
500 ev/s
```

No production-capacity claim.

---

# 26. CLEANUP

After qualification:

```text
stop app1/app2
stop worker1/worker2
finalize evidence
run correctness validator
remove harness-owned data according to contract
preserve canonical retained EventBus history semantics
drop isolated qualification DB
verify orphan processes = 0
verify orphan qualification DB = 0
```

Record cleanup verdict.

---

# 27. POST-RUN REGRESSION

Run again:

```text
backend tsc/build/unit/full serial e2e
frontend tsc/vitest/production build
migrations
drift
artifact checker regression
```

Report actual counts.

Expected code changes from qualification itself:

```text
production code = 0
harness code = 0
schema = 0
migrations = 0
CI = 0
```

If a harness defect is discovered, verdict C; do not fix it.
If a production performance defect is discovered, verdict B; do not fix it.

---

# 28. REQUIRED GATE MATRIX

Create an explicit table with at least:

| Gate | Target | Observed | Evidence valid? | Verdict |
|---|---:|---:|---|---|
| steady load | 50 RPS ±5% | actual | YES/NO | PASS/INVALID |
| peak load | 100 RPS ±5% | actual | YES/NO | PASS/INVALID |
| burst load | 200 RPS ±5% | actual | YES/NO | PASS/INVALID |
| Class A p95/p99 | 300/750 ms | actual | YES/NO | PASS/FAIL |
| Class B p95/p99 | 500/1000 ms | actual | YES/NO | PASS/FAIL |
| Class C p95/p99 | 750/1500 ms | actual | YES/NO | PASS/FAIL |
| Class D p95/p99 | 1000/2000 ms | actual | YES/NO | PASS/FAIL |
| Class E p95/p99 | 1000/2000 ms | actual | YES/NO | PASS/FAIL |
| Class F p95/p99 | 750/1500 ms | actual | YES/NO | PASS/FAIL |
| unexpected 5xx | 0 | actual | YES/NO | PASS/FAIL |
| timeout | 0 | actual | YES/NO | PASS/FAIL |
| transport | 0 | actual | YES/NO | PASS/FAIL |
| duplicate facts | 0 | actual | YES/NO | PASS/FAIL |
| EventBus backlog | <=100 | actual | YES/NO | PASS/FAIL |
| oldest PENDING | <=10 s | actual | YES/NO | PASS/FAIL |
| EventBus recovery | 5k/2 workers/<=120s | actual | YES/NO | PASS/FAIL |
| payment correctness | zero duplicate/wrong replay | actual | YES/NO | PASS/FAIL |
| Booking/Order correctness | zero duplicate/invalid transition | actual | YES/NO | PASS/FAIL |
| soak | 30m @50 RPS/250 | actual | YES/NO | PASS/FAIL/INVALID |

Do not omit red rows.

---

# 29. REQUIRED REPORT

Create:

```text
docs/prompts/PHASE_2_STEP_2.17B_FINAL_REQUALIFICATION_REPORT.md
```

Include at minimum:

1. mode/verdict;
2. repository truth;
3. provenance;
4. frozen authority;
5. target-change proof;
6. environment;
7. DB safety;
8. migrations/drift;
9. dataset;
10. topology;
11. worker config;
12. baseline regression;
13. warm-up;
14. steady 50;
15. peak 100;
16. burst 200;
17. Classes A–F;
18. payment 2/10/concurrency;
19. Booking/Order 6/20;
20. login 2/5;
21. EventBus 100 ev/s;
22. EventBus burst 1,000;
23. EventBus recovery 5,000;
24. soak;
25. load validity;
26. reliability;
27. correctness;
28. idempotency;
29. OBS-1 final judgment;
30. Booking/Order prior-observation final judgment;
31. memory observation;
32. invalid/rerun history;
33. PSP deferral;
34. cleanup;
35. post-run regression;
36. artifact integrity;
37. negative checks;
38. findings/severity;
39. complete gate matrix;
40. overall verdict;
41. Roadmap update;
42. persistence;
43. Repository Evidence footer;
44. RELEASE;
45. NEXT;
46. HARD STOP.

---

# 30. FINDING SEVERITY

Classify valid findings:

```text
CRITICAL / HIGH / MEDIUM / LOW / OBSERVATION
```

Examples:

```text
duplicate Payment → CRITICAL
financial/state corruption → CRITICAL/HIGH
persistent unexpected 500 under approved load → HIGH
route-class SLO miss → HIGH/MEDIUM based on scope
EventBus recovery >120s → formal FAIL; severity separately assessed
EventBus backlog >100 → formal FAIL even if later drains
memory trend without approved limit → OBSERVATION unless actual failure exists
```

Do not remediate.

---

# 31. ROADMAP UPDATE

If PASS:

```text
Step 2.17B:
🚧 FINAL QUALIFICATION COMPLETED — PASS —
WAITING FOR STRICT REVIEW —
NOT YET APPROVED
```

If FAIL:

```text
Step 2.17B:
❌ FINAL QUALIFICATION COMPLETED — FAIL —
PERFORMANCE REMEDIATION REQUIRED —
NOT APPROVED
```

If INVALID:

```text
Step 2.17B:
🚧 FINAL RE-QUALIFICATION INVALID / INCOMPLETE —
<exact blocker> —
NOT APPROVED
```

Never mark Step 2.17B APPROVED in this pass.

---

# 32. ARTIFACT INTEGRITY

Run canonical artifact checker + checker regression.

Required:

```text
WARN = 0
FAIL = 0
```

Report actual PASS count.

Do not repair unrelated historical artifacts silently.

---

# 33. NEGATIVE CHECKS

Explicitly report:

```text
approved SLO changed = 0
approved load target changed = 0
SLO relaxed = 0
qualification duration reduced = 0
qualification RPS reduced = 0
production performance tuning = 0
harness remediation = 0
sales.service.ts changed = 0
query optimization = 0
index added/changed = 0
schema changed = 0
migration added = 0
Prisma pool tuned = 0
PostgreSQL tuned = 0
cache added = 0
worker interval/batch changed = 0
retry semantics changed = 0
Payment semantics changed = 0
idempotency semantics changed = 0
auth semantics changed = 0
login throttle bypassed = 0
test assertion weakened = 0
test skipped = 0
failed run hidden = 0
failed gate omitted = 0
percentile cherry-picking = 0
production capacity claim = 0
future-scaling qualification = 0
real PSP network = 0
PSP selected = 0
Step 2.17B approved = 0
strict review started = 0
2.17C started = 0
2.18 started = 0
RLS implemented = 0
2.12B/2.12I started = 0
release/deployment = 0
```

---

# 34. GIT / PERSISTENCE

Before staging:

```bash
git status --short
git diff --stat
git diff
git diff --check
```

Normally only evidence/docs/Roadmap should change.

Stage exact files only. Never `git add .` or `git add -A`.

Inspect staged diff.

Commit by verdict, e.g.:

PASS:
```bash
git commit -m "test(perf): qualify phase 2.17B against approved targets"
```

FAIL:
```bash
git commit -m "test(perf): record phase 2.17B qualification failures"
```

INVALID:
```bash
git commit -m "test(perf): record invalid phase 2.17B requalification"
```

Populate real provenance; use a footer-only commit if needed.

Push and verify final HEAD == upstream before claiming PUSHED.

---

# 35. REPOSITORY EVIDENCE FOOTER

Populate actual values only:

```text
REPOSITORY EVIDENCE

repository:
branch:
base_sha:
upstream_before:
harness_remediation_sha:
qualification_commit_sha:
provenance_footer_commit_sha:
final_head_sha:
upstream_sha:
push_status:
worktree_clean:

node_version:
postgres_version:
os_platform:
cpu:
memory:
qualification_db:
migration_count:
database_drift:

dataset_profile:
dataset_counts:
app_instances:
worker_instances:
worker_interval:
worker_batch:
topology_valid:

warmup:
steady_50:
peak_100:
burst_200:
soak_50:

class_a_p50_p95_p99_max:
class_b_p50_p95_p99_max:
class_c_p50_p95_p99_max:
class_d_p50_p95_p99_max:
class_e_p50_p95_p99_max:
class_f_p50_p95_p99_max:

unexpected_5xx:
timeouts:
transport_failures:

payment_2rps:
payment_10rps:
payment_concurrency_50:
payment_duplicates:
payment_wrong_replays:

booking_order_6rps:
booking_order_20rps:
booking_order_duplicates:
booking_order_invalid_transitions:

login_2rps:
login_5rps:
login_throttle_semantics:

eventbus_100eps:
eventbus_max_backlog:
eventbus_oldest_pending:
eventbus_burst_1000:
eventbus_recovery_5000:
eventbus_recovery_workers:
eventbus_recovery_drain:
eventbus_duplicates:
eventbus_lost_events:
poison_isolation:

correctness_gate:
load_application_gate:
latency_gate:
reliability_gate:
eventbus_gate:
soak_gate:

obs_1_sales_list:
booking_order_burst_observation:
memory_observation:
invalid_run_history:

backend_regression:
frontend_regression:
artifact_integrity:
checker_regression:

targets_changed:
production_tuning:
harness_changed:
psp_subset:
production_capacity_claim:

final_qualification_verdict:
step_2_17b_state:
strict_review_state:
step_2_17c_state:
step_2_18_state:
release_status:
persistence_status:
```

No fabricated SHAs/counts.

---

# 36. SUCCESS OUTPUT

If PASS:

```text
PHASE 2 STEP 2.17B FINAL RE-QUALIFICATION COMPLETED —
PASS AGAINST UNCHANGED APPROVED TARGETS —
READY FOR STRICT REVIEW

Decision:
- verdict: A — QUALIFICATION PASS
- approved targets changed: 0
- production tuning: 0
- harness changes: 0
- Step 2.17B: QUALIFICATION COMPLETED — WAITING FOR STRICT REVIEW
- Step 2.17B approved: NO
- strict review: NOT STARTED

Environment:
- topology: 2 app + 2 worker
- dataset: REPRESENTATIVE
- worker config: canonical
- DB: isolated
- load application validity: PASS

HTTP:
- warm-up 5m: PASS
- steady 15m @ 50 RPS: PASS
- peak 15m @ 100 RPS: PASS
- burst 60s @ 200 RPS: PASS
- soak 30m @ 50 RPS / 250: PASS

Latency:
- Class A p95/p99: <actual> — PASS
- Class B p95/p99: <actual> — PASS
- Class C p95/p99: <actual> — PASS
- Class D p95/p99: <actual> — PASS
- Class E p95/p99: <actual> — PASS
- Class F p95/p99: <actual> — PASS

Reliability:
- unexpected 5xx: 0
- timeouts: 0
- transport failures: 0

Payment/Booking/Login: PASS
EventBus steady/burst/recovery: PASS
Correctness-under-load: PASS

Regression:
- backend: <actual>
- frontend: <actual>
- DB: <actual>
- artifact integrity: PASS=<actual> WARN=0 FAIL=0

PSP:
- provider subset: DEFERRED
- real PSP network: 0

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

# 37. FAIL OUTPUT

If valid evidence fails one or more gates:

```text
PHASE 2 STEP 2.17B FINAL RE-QUALIFICATION COMPLETED —
FAIL AGAINST UNCHANGED APPROVED TARGETS —
PERFORMANCE REMEDIATION REQUIRED

Decision:
- verdict: B — QUALIFICATION FAIL
- qualification evidence: VALID
- targets changed: 0
- production tuning: 0
- Step 2.17B: NOT APPROVED
- strict review: NOT STARTED

Passed gates:
- ...

Failed gates:
- <gate>: target <x>, observed <y>
- ...

Correctness:
- <actual>

RELEASE: NOT PERFORMED
NEXT: PHASE 2 — STEP 2.17B — PERFORMANCE REMEDIATION
(separate finding-driven prompt)
```

---

# 38. INVALID OUTPUT

If required evidence is invalid/incomplete:

```text
PHASE 2 STEP 2.17B FINAL RE-QUALIFICATION INCOMPLETE —
VALID SYSTEM PERFORMANCE VERDICT NOT AVAILABLE

Decision:
- verdict: C — QUALIFICATION INVALID / INCOMPLETE
- System PASS claimed: NO
- System FAIL claimed: NO
- targets changed: 0
- production tuning: 0
- Step 2.17B: NOT APPROVED
- strict review: NOT STARTED

Invalidating blocker:
- ...

Valid completed evidence:
- ...

Invalid/incomplete evidence:
- ...

RELEASE: NOT PERFORMED
NEXT: <separate remediation/decision for proven blocker>
```

---

# 39. HARD STOP

After:

1. repository verification;
2. frozen-authority reconstruction;
3. environment/topology validation;
4. baseline regression;
5. REPRESENTATIVE dataset;
6. warm-up 5 min;
7. steady 15 min @50;
8. peak 15 min @100;
9. burst 60 sec @200;
10. payment gates;
11. Booking/Order gates;
12. login gates;
13. EventBus 100 ev/s;
14. EventBus burst 1,000;
15. EventBus recovery 5,000/2 workers;
16. soak 30 min @50/250;
17. correctness validation;
18. complete gate matrix;
19. OBS-1 final judgment;
20. Booking/Order burst final judgment;
21. cleanup;
22. post-run regression;
23. artifact integrity;
24. report/Roadmap;
25. exact-file staging;
26. commit/provenance;
27. push;
28. HEAD/upstream verification;

**STOP.**

Do not fix failing performance.
Do not modify harness.
Do not change targets.
Do not start Strict Review in this same pass.
Do not start 2.17C, 2.18, RLS or PSP.

If A:
```text
NEXT: PHASE 2 — STEP 2.17B — STRICT REVIEW
```

If B:
```text
NEXT: PHASE 2 — STEP 2.17B — PERFORMANCE REMEDIATION
```

If C:
```text
NEXT: separate remediation/decision for the proven invalidating blocker
```
