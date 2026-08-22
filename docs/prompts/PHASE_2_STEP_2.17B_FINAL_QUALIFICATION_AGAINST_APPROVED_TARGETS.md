# PHASE 2 — STEP 2.17B — FINAL QUALIFICATION AGAINST APPROVED TARGETS

## 0. MODE

**FINAL PERFORMANCE QUALIFICATION · REPOSITORY-FIRST · EXECUTE APPROVED HARNESS · MEASURE AGAINST PERSISTED AUTHORITY · NO TARGET CHANGES · NO PERFORMANCE TUNING · NO AUTO-REMEDIATION · NO STRICT REVIEW · NO PSP · EVIDENCE/PERSISTENCE REQUIRED · HARD STOP**

This pass performs the final platform load/performance qualification for Step 2.17B against the quantitative targets already approved and persisted by Business/Product/Operations authority.

This is **not** a target-setting pass.

This is **not** a tuning pass.

This is **not** a remediation pass.

Canonical rule:

```text
TARGETS ARE FROZEN FOR THIS QUALIFICATION.

target
→ execute
→ measure
→ compare
→ PASS / FAIL
→ persist evidence
→ STOP
```

If any required gate fails:

```text
DO NOT tune
DO NOT change indexes
DO NOT change queries
DO NOT change worker settings
DO NOT change pool settings
DO NOT weaken assertions
DO NOT lower load
DO NOT loosen SLOs
DO NOT rerun until green and hide failures

Instead:

QUALIFICATION FAILED
→ preserve evidence
→ classify bottleneck
→ create remediation recommendation
→ STOP
```

A remediation pass requires a separate explicit prompt.

---

# 1. REQUIRED PERSISTED STARTING STATE

Before execution, independently verify repository truth from code and persisted artifacts.

Expected state, to verify rather than trust:

```text
Step 2.17       = APPROVED
Step 2.17A      = APPROVED

Step 2.17B:
- harness = IMPLEMENTED
- quantitative authority = APPROVED
- final qualification = NOT STARTED
- strict review = NOT STARTED
- overall Step 2.17B = NOT APPROVED

Step 2.17C      = NOT STARTED
Step 2.18       = NOT STARTED

2.12A           = APPROVED
2.12H           = APPROVED
2.12B           = BLOCKED
ADR-0015        = PROPOSED — BLOCKED
2.12I           = DEFERRED
```

Read at minimum:

- canonical Roadmap;
- `docs/architecture/load-performance-qualification-2.17B.md`;
- `docs/operations/load-performance-qualification-runbook.md`;
- Step 2.17B design/reconciliation report;
- Step 2.17B harness implementation report;
- Step 2.17B SLO/Load Authority Decision report;
- Step 2.17B Quantitative Targets Authority Decision report;
- actual `backend/src/perf/` implementation;
- package scripts actually used by the harness;
- Step 2.17 strict-review evidence;
- Step 2.17A strict-review evidence;
- ADR-0015.

Repository code and persisted authority are the source of truth.

If persisted targets differ materially from the target matrix in this prompt, use the **persisted approved authority** and explicitly report the discrepancy. Do not silently overwrite either source.

If the discrepancy makes authority ambiguous, STOP before load execution.

---

# 2. PROVENANCE BASELINE

Before changing or executing anything, capture:

```bash
git status --short
git branch --show-current
git rev-parse HEAD
git rev-parse --verify @{u} 2>/dev/null || true
git log --oneline --decorate -50
git diff
```

Record:

```text
repository
branch
qualification_base_sha
upstream_sha
worktree state
migration count
artifact-integrity baseline
harness implementation SHA
quantitative-authority SHA
Roadmap state
```

Preserve unrelated untracked files.

Do not modify them.

---

# 3. FREEZE THE AUTHORITY MATRIX

Before qualification, extract the approved canonical matrix from persisted documentation and create a qualification snapshot in the report.

Expected approved authority:

## V1 planning

```text
registered users planning envelope = 100,000
MAU planning envelope              = 25,000
DAU planning envelope              = 5,000

normal concurrency                 = 100
expected V1 peak concurrency       = 250
qualification concurrency          = 500
burst concurrency                  = 1,000

read/write mix                     = 80/20
```

## Application load

```text
expected normal                    = 25 RPS
expected V1 peak                   = 50 RPS
qualification sustained            = 100 RPS
qualification burst                = 200 RPS
qualification headroom             = 2.0x
```

## HTTP latency p95/p99

```text
Class A public/light reads          <= 300 / 750 ms
Class B authenticated reads         <= 500 / 1000 ms
Class C ordinary writes             <= 750 / 1500 ms
Class D concurrency-sensitive       <= 1000 / 2000 ms
Class E payment.create              <= 1000 / 2000 ms
Class F login                       <= 750 / 1500 ms
```

## Reliability

```text
unexpected 5xx                     = 0
unexpected timeout                 = 0
unexpected transport failure       = 0
```

## Payment

```text
expected V1 peak                   = 1 RPS
qualification sustained            = 2 RPS
qualification burst                = 10 RPS
qualification concurrency          = 50
duplicate committed Payment        = 0
wrong replay                       = 0
raw 500 controlled race            = 0
```

## Booking / Order

```text
expected V1 peak                   = 3 RPS
qualification sustained            = 6 RPS
qualification burst                = 20 RPS
```

## Login

```text
expected V1 peak                   = 1 RPS
qualification                      = 2 RPS
controlled burst                   = 5 RPS
```

## EventBus

```text
expected steady                    = 25 events/sec
expected peak                      = 50 events/sec
qualification steady               = 100 events/sec
burst                              = 1,000 events

normal PENDING backlog             <= 100
normal oldest PENDING age          <= 10 sec

recovery backlog                   = 5,000 events
recovery worker instances          = 2
maximum drain/convergence          <= 120 sec
```

## Multi-instance

```text
application instances              = 2
worker instances                   = 2
shared PostgreSQL                  = YES
```

## Burst

```text
target                             = 200 RPS
duration                           = 60 sec
concurrency ceiling                = 1,000

Class A/B burst p99                <= 2000 ms
Class C-F burst p99                <= 3000 ms
```

## Soak

```text
duration                           = 30 min
sustained application load         = 50 RPS
concurrency                        = 250
```

## Qualification sequence

```text
warm-up                            = 5 min
steady                             = 15 min @ 50 RPS
qualification peak                 = 15 min @ 100 RPS
burst                              = 60 sec @ 200 RPS
soak                               = 30 min @ 50 RPS / concurrency 250
```

These targets are frozen.

---

# 4. FUTURE TARGETS ARE NOT QUALIFICATION GATES

Persisted future-planning targets such as:

```text
1,000 RPS
5,000 concurrent users/requests
20 payment-initiation RPS
500 EventBus events/sec
```

are **NOT Phase 2 qualification gates**.

Do not fail Step 2.17B for not proving them.

Do not use them to increase qualification load.

Do not claim they are currently supported.

---

# 5. PSP SUBSET REMAINS DEFERRED

Verify:

```text
ADR-0015 = PROPOSED — BLOCKED
2.12B = BLOCKED
```

Therefore the following remain outside this qualification:

- real PSP latency;
- real provider API calls;
- provider webhook burst;
- provider callback convergence;
- provider rate limits;
- Apple Pay provider performance;
- Google Pay provider performance;
- provider settlement/payout performance.

Required status:

```text
PSP PERFORMANCE SUBSET = DEFERRED
```

No real PSP network traffic is allowed.

---

# 6. QUALIFICATION ENVIRONMENT SAFETY — HARD GATE

Use only a dedicated isolated performance environment/database.

Before any destructive preparation or load:

- run the harness safe-target guard;
- prove target is not canonical DB;
- prove target is not production;
- prove target naming satisfies existing guard;
- record PostgreSQL target safely/redacted;
- record migration state;
- record environment metadata.

If safe-target validation fails:

```text
QUALIFICATION ABORTED — SAFE TARGET GUARD FAILED
```

Do not bypass the guard.

Do not weaken the guard.

---

# 7. ENVIRONMENT METADATA

Record before execution:

```text
OS
CPU model
CPU logical/core count where available
RAM
Node version
npm version
PostgreSQL version
database class/name (safe/redacted)
application instance count
worker instance count
worker interval
worker batch
Prisma/runtime configuration relevant to test
git SHA
dataset size
profile
start timestamp
```

Do not expose secrets.

Do not include raw credentials or full connection strings.

---

# 8. PRE-QUALIFICATION REGRESSION

Before load qualification, prove baseline correctness.

Run the canonical repository commands appropriate to the current project.

At minimum require:

## Backend

```text
TypeScript = PASS
build = PASS
unit tests = PASS
full serial e2e = PASS
```

## Frontend

```text
TypeScript = PASS
tests = PASS
production build = PASS
```

## Database

```text
all canonical migrations applied
drift = 0
```

## Artifact integrity

```text
checker regression = PASS
WARN = 0
FAIL = 0
```

Report actual test counts.

If baseline regression is red:

```text
FINAL QUALIFICATION NOT STARTED — BASELINE REGRESSION FAILED
```

Do not proceed to performance qualification.

---

# 9. DATASET PREPARATION

Create/use deterministic synthetic data according to approved authority.

Minimum target dataset:

```text
Users                    >= 1,000
Products/service units   >= 500 representative records
Customers/CRM entities   >= 1,000
Sales/quotes             >= 1,000
Booking/Order chains     >= 1,000
Payment-capable orders   >= 500
Finance/ledger records   >= 5,000
EventBus seed capacity   >= 5,000
```

If domain naming differs, map to canonical entities and document the mapping.

Do not add schema concepts to satisfy dataset counts.

Track generated records by run prefix or existing deterministic mechanism.

Cleanup must be dependency-aware and verifiable.

---

# 10. SMOKE

Run the canonical SMOKE profile first.

Required:

```text
safe target = PASS
app boot = PASS
DB connectivity = PASS
required routes reachable = PASS
authentication setup = PASS
correctness validator = PASS
cleanup model = PASS
```

Unexpected statuses must fail the smoke.

Do not proceed if smoke fails.

---

# 11. WARM-UP

Run:

```text
5 minutes
```

Warm-up results are informational and excluded from primary SLO verdict unless the persisted harness contract says otherwise.

Record:

- requests;
- RPS;
- errors;
- p50/p95/p99;
- EventBus backlog;
- process/environment observations already supported by harness.

No tuning after warm-up.

---

# 12. STEADY V1 PROFILE

Run:

```text
15 minutes @ 50 RPS
```

Use representative 80/20 read/write mix.

Measure per route class:

```text
count
achieved RPS
p50
p95
p99
max
unexpected 5xx
timeouts
transport failures
expected controlled statuses
unexpected controlled statuses
```

Required latency gates:

```text
A <= 300/750 ms
B <= 500/1000 ms
C <= 750/1500 ms
D <= 1000/2000 ms
E <= 1000/2000 ms
F <= 750/1500 ms
```

Reliability:

```text
unexpected 5xx = 0
timeout = 0
transport failure = 0
```

Correctness hard gates remain active.

---

# 13. QUALIFICATION PEAK PROFILE

Run:

```text
15 minutes @ 100 RPS
qualification concurrency up to 500
```

Do not lower RPS because the system struggles.

If the harness cannot actually sustain the target, record:

```text
TARGET LOAD NOT ACHIEVED
```

and FAIL the throughput/load gate.

Measure the same latency/reliability/correctness matrix as steady.

Approved normal latency SLOs still apply unless persisted authority explicitly says otherwise.

---

# 14. BURST PROFILE

Run:

```text
60 seconds @ 200 RPS
concurrency ceiling = 1,000
```

Required:

```text
unexpected 5xx = 0
timeout = 0
transport failure = 0
correctness violation = 0
```

Burst p99 gates:

```text
Class A/B <= 2000 ms
Class C-F <= 3000 ms
```

After the burst, verify:

- backlog converges;
- latency returns toward steady behavior;
- retryable work is not stranded;
- no manual DB cleanup is needed to restore correctness.

Record post-burst convergence time.

---

# 15. PAYMENT.CREATE QUALIFICATION

No real PSP.

Exercise TravelHub-owned payment initiation with:

```text
sustained = 2 RPS
burst = 10 RPS
concurrency = 50
```

Required scenario coverage:

1. unique Idempotency-Key;
2. identical retry;
3. concurrent identical retry;
4. divergent reuse;
5. cross-principal isolation;
6. business one-active-payment invariant;
7. stale/recovery semantics already supported by harness.

Required latency:

```text
p95 <= 1000 ms
p99 <= 2000 ms
```

Hard correctness:

```text
duplicate committed Payment = 0
wrong replay = 0
silent divergent replay = 0
cross-principal effect = 0
raw 500 controlled race = 0
```

Query authoritative DB state after load.

Do not trust HTTP counts alone.

---

# 16. BOOKING / ORDER QUALIFICATION

Run canonical workload at:

```text
sustained = 6 RPS
burst = 20 RPS
```

Verify:

- valid lifecycle transitions;
- terminal guards;
- concurrency behavior;
- duplicate business facts = 0;
- event chain convergence;
- committed event loss = 0;
- controlled conflict behavior;
- no raw 500 from controlled race.

Use authoritative DB validation.

---

# 17. LOGIN / AUTH QUALIFICATION

Run:

```text
qualification = 2 RPS
controlled burst = 5 RPS
```

Use distinct users/principals as required by the approved workload.

Do not bypass the per-instance login throttle.

Verify:

- valid login;
- invalid login;
- expected throttle behavior;
- no raw 500;
- session behavior;
- tokenVersion/logout semantics;
- fail-safe authorization behavior.

Latency:

```text
p95 <= 750 ms
p99 <= 1500 ms
```

Expected 429 under explicitly designed throttle scenarios is not an unexpected reliability failure.

---

# 18. EVENTBUS STEADY QUALIFICATION

Qualify:

```text
100 events/sec
```

Measure:

```text
generated
published/delivered
processed
PENDING backlog
oldest PENDING age
FAILED retryable
poison/exhausted
drain rate
duplicate consumer effects
lost committed events
```

Normal authority:

```text
PENDING backlog <= 100
oldest PENDING <= 10 sec
```

Correctness:

```text
lost committed event = 0
duplicate business effect = 0
poison blocks unrelated progress = 0
```

Preserve:

```text
at-least-once + Inbox/consumer idempotency
```

---

# 19. EVENTBUS BURST

Inject:

```text
1,000 events
```

Measure:

- enqueue duration;
- processing rate;
- max backlog;
- oldest age;
- drain/convergence;
- retry state;
- poison isolation;
- duplicate effects.

A transient backlog >100 is allowed for this explicit burst scenario.

It must converge afterward.

---

# 20. EVENTBUS RECOVERY — CRITICAL GATE

Create:

```text
5,000 event recovery backlog
2 worker instances
```

Use the canonical worker implementation and persisted configuration.

Do not tune batch/interval.

Required:

```text
full convergence <= 120 sec
```

After convergence:

```text
lost committed events = 0
duplicate business effects = 0
poison blocking = 0
unexpected retryable residue = 0
```

Known deliberately poisoned/exhausted records may remain only when explicitly seeded/expected and isolated.

Record:

```text
initial backlog
worker count
start time
end time
drain duration
effective events/sec
final PENDING
final retryable FAILED
expected poison
Inbox counts
business-effect counts
```

If 120 sec is exceeded:

```text
EVENTBUS RECOVERY = FAIL
```

Do not change worker configuration.

---

# 21. MULTI-INSTANCE QUALIFICATION

Run minimum topology:

```text
2 application instances
2 worker instances
shared PostgreSQL
```

Exercise:

- concurrent HTTP traffic;
- payment.create concurrency;
- EventBus processing competition;
- retryable FAILED recovery;
- PENDING processing;
- Inbox dedup;
- logout/tokenVersion behavior where applicable.

Required:

```text
duplicate business effect = 0
lost event = 0
raw 500 controlled race = 0
```

Do not claim linear scaling.

---

# 22. SOAK — REQUIRED FULL DURATION

Run the complete approved soak:

```text
30 minutes
50 RPS
concurrency = 250
```

Do not substitute the previous 30-second exploratory run.

Required throughout and after:

```text
unexpected 5xx = 0
unexpected timeout = 0
transport failure = 0
correctness violation = 0
continuously growing EventBus backlog = NO
unrecovered retryable FAILED accumulation = NO
database corruption = 0
cleanup failure = 0
```

Record:

- total requests;
- achieved RPS;
- p50/p95/p99 by route class;
- error counts;
- backlog samples over time;
- FAILED samples over time;
- DB connection/runtime observations available from existing tooling;
- process memory start/peak/end if already obtainable without modifying production runtime.

If memory is not measurable with current harness:

```text
MEMORY TREND = NOT MEASURED — OBSERVABILITY LIMITATION
```

Do not add a production dependency during qualification.

---

# 23. STRESS CHARACTERIZATION — OPTIONAL / NON-GATING

Stress may run separately if safe.

Permitted exploratory ceiling:

```text
up to 500 RPS
and/or
up to 2,000 concurrent requests
```

It is not required for Step 2.17B PASS.

If run, stop on:

- correctness violation;
- DB safety concern;
- uncontrolled failure cascade;
- cleanup failure;
- safe-target concern.

Label all stress results:

```text
CHARACTERIZATION ONLY — NOT PHASE 2 GATE
```

---

# 24. CORRECTNESS VALIDATION MUST BE INDEPENDENT

After each critical profile and at final completion, validate authoritative database state independently from load-generator success counters.

At minimum verify applicable invariants:

```text
duplicate Payment = 0
wrong idempotency replay = 0
cross-principal effect = 0
duplicate Order = 0
duplicate Commission = 0
duplicate CommissionAccrual = 0
lost committed PENDING event = 0
unexpected retryable FAILED residue = 0
poison isolation = PASS
Decimal exactness = PASS
terminal lifecycle correctness = PASS
```

The generator cannot grade itself as the sole source of truth.

---

# 25. NO CHERRY-PICKING / RERUN POLICY

Every qualification attempt must be recorded.

If a run fails because of a genuine application/system performance or correctness issue:

- preserve it;
- FAIL the relevant gate;
- do not rerun merely to replace the result.

A rerun is permitted only for a demonstrated **environment/harness execution invalidation**, such as:

- machine interruption;
- unrelated process saturation;
- invalid test setup;
- corrupted synthetic dataset;
- harness orchestration defect.

If rerun occurs:

1. preserve the original result;
2. classify why it was invalid;
3. provide evidence;
4. do not modify production runtime;
5. record both attempts.

Never hide the first run.

---

# 26. NO AUTO-REMEDIATION — CRITICAL

During this pass, the following are forbidden:

```text
production code tuning
query optimization
new indexes
index changes
Prisma pool changes
PostgreSQL tuning
worker interval changes
worker batch changes
retry-policy changes
cache introduction
rate-limit changes
HTTP contract changes
test assertion weakening
load reduction
SLO relaxation
dataset reduction to force PASS
```

If a bottleneck is found, diagnose only to the level necessary to classify it.

Allowed classification examples:

```text
APPLICATION CPU
DATABASE QUERY
DATABASE LOCK/CONTENTION
CONNECTION POOL
EVENTBUS WORKER THROUGHPUT
SERIALIZATION
AUTH/CRYPTO
HARNESS LIMIT
ENVIRONMENT LIMIT
UNKNOWN — REQUIRES REMEDIATION INVESTIGATION
```

No fix in this pass.

---

# 27. REQUIRED TARGET → MEASURED → VERDICT MATRIX

Create a canonical final table containing at least:

| Gate | Approved target | Measured | Verdict |
|---|---|---|---|
| Steady achieved load | 50 RPS / 15 min | actual | PASS/FAIL |
| Peak achieved load | 100 RPS / 15 min | actual | PASS/FAIL |
| Burst achieved load | 200 RPS / 60 sec | actual | PASS/FAIL |
| Class A p95/p99 | 300/750 ms | actual | PASS/FAIL |
| Class B p95/p99 | 500/1000 ms | actual | PASS/FAIL |
| Class C p95/p99 | 750/1500 ms | actual | PASS/FAIL |
| Class D p95/p99 | 1000/2000 ms | actual | PASS/FAIL |
| payment.create p95/p99 | 1000/2000 ms | actual | PASS/FAIL |
| login p95/p99 | 750/1500 ms | actual | PASS/FAIL |
| unexpected 5xx | 0 | actual | PASS/FAIL |
| timeout | 0 | actual | PASS/FAIL |
| transport failure | 0 | actual | PASS/FAIL |
| Payment sustained | 2 RPS | actual | PASS/FAIL |
| Payment burst | 10 RPS | actual | PASS/FAIL |
| Payment concurrency | 50 | actual | PASS/FAIL |
| duplicate Payment | 0 | actual | PASS/FAIL |
| Booking/Order sustained | 6 RPS | actual | PASS/FAIL |
| Booking/Order burst | 20 RPS | actual | PASS/FAIL |
| EventBus steady | 100 ev/s | actual | PASS/FAIL |
| EventBus burst | 1,000 events | actual | PASS/FAIL |
| Normal backlog | <=100 | actual | PASS/FAIL |
| Oldest PENDING | <=10 sec | actual | PASS/FAIL |
| Recovery backlog | 5,000 | actual | PASS/FAIL |
| Recovery workers | 2 | actual | PASS/FAIL |
| Recovery drain | <=120 sec | actual | PASS/FAIL |
| Multi-instance apps | 2 | actual | PASS/FAIL |
| Multi-instance workers | 2 | actual | PASS/FAIL |
| Soak | 30 min @ 50 RPS / 250 | actual | PASS/FAIL |
| Correctness hard gates | zero violations | actual | PASS/FAIL |
| Cleanup | complete | actual | PASS/FAIL |
| PSP subset | DEFERRED | DEFERRED | N/A |

Do not omit failed rows.

Do not replace measured values with qualitative words where quantitative evidence exists.

---

# 28. FINAL VERDICT MODEL

Compute:

```text
BASELINE_REGRESSION
SAFE_TARGET
DATASET
SMOKE
STEADY
PEAK
BURST
HTTP_LATENCY
HTTP_RELIABILITY
PAYMENT
BOOKING_ORDER
AUTH_LOGIN
EVENTBUS_STEADY
EVENTBUS_BURST
EVENTBUS_RECOVERY
MULTI_INSTANCE
SOAK
CORRECTNESS
CLEANUP
PSP_SUBSET
```

Possible verdicts:

## A — QUALIFICATION PASS

Only if every required non-deferred gate passes.

```text
FINAL QUALIFICATION = PASS
Step 2.17B = QUALIFICATION COMPLETED — WAITING FOR STRICT REVIEW
```

Do **not** mark Step 2.17B APPROVED.

## B — QUALIFICATION FAIL

Any required gate fails.

```text
FINAL QUALIFICATION = FAIL
Step 2.17B = QUALIFICATION FAILED — REMEDIATION REQUIRED
```

Record exact failed gates and evidence.

## C — QUALIFICATION INVALID / INCOMPLETE

Use only when execution cannot produce valid qualification evidence because of a proven environment/harness/setup blocker.

Do not use C to hide real system failure.

---

# 29. BOTTLENECK CLASSIFICATION ON FAIL

For every failed gate provide:

```text
gate
target
measured
first failing run
reproducibility
likely layer
evidence
confidence
correctness impact
recommended remediation scope
owner
```

Do not implement the recommendation.

If root cause is unknown:

```text
ROOT CAUSE = NOT YET PROVEN
```

Do not invent one.

---

# 30. ROADMAP UPDATE

## If PASS

Update Step 2.17B truthfully to equivalent:

```text
🚧 FINAL QUALIFICATION COMPLETED — PASS —
WAITING FOR STRICT REVIEW
```

Preserve:

```text
Step 2.17B APPROVED = NO
Strict Review = NOT STARTED
```

NEXT:

```text
PHASE 2 — STEP 2.17B — STRICT REVIEW
```

## If FAIL

Use equivalent:

```text
⛔ FINAL QUALIFICATION FAILED —
REMEDIATION REQUIRED —
STRICT REVIEW NOT STARTED
```

NEXT:

```text
PHASE 2 — STEP 2.17B — PERFORMANCE REMEDIATION
```

through a separate prompt.

## If INVALID/INCOMPLETE

Record exact blocker without claiming system PASS or FAIL.

---

# 31. REQUIRED EVIDENCE ARTIFACTS

Persist qualification evidence in the repository only if it is safe and reasonably sized.

Do not commit huge raw logs blindly.

At minimum create a human-reviewable canonical report:

```text
docs/prompts/PHASE_2_STEP_2.17B_FINAL_QUALIFICATION_REPORT.md
```

Update:

```text
docs/architecture/load-performance-qualification-2.17B.md
docs/operations/load-performance-qualification-runbook.md
canonical Roadmap
```

For raw harness results:

- preserve structured summaries required to reproduce the verdict;
- respect existing gitignore policy;
- if raw result directories are intentionally gitignored, summarize their hashes/paths/metrics in the report rather than force-adding them;
- never commit secrets.

Do not invent evidence files that the harness did not generate.

---

# 32. REPORT STRUCTURE

The final report must contain at least:

1. mode;
2. verdict;
3. repository truth;
4. baseline provenance;
5. frozen authority snapshot;
6. semantic boundaries;
7. environment metadata;
8. safe-target evidence;
9. regression evidence;
10. migration/drift evidence;
11. artifact-integrity evidence;
12. dataset;
13. smoke;
14. warm-up;
15. steady;
16. peak;
17. burst;
18. route-class latency;
19. reliability;
20. payment.create;
21. idempotency;
22. Booking/Order;
23. auth/login;
24. EventBus steady;
25. EventBus burst;
26. EventBus recovery;
27. multi-instance;
28. soak;
29. memory/observability note;
30. correctness-under-load;
31. cleanup;
32. rerun history;
33. target→measured→verdict matrix;
34. failed gates, if any;
35. bottleneck classification, if any;
36. PSP deferral;
37. future-scaling non-gate statement;
38. Step 2.17A separation;
39. Step 2.17C separation;
40. Step 2.18/RLS separation;
41. negative checks;
42. Roadmap update;
43. artifact integrity;
44. persistence;
45. Repository Evidence footer;
46. release;
47. NEXT;
48. HARD STOP confirmation.

---

# 33. ARTIFACT INTEGRITY

After documentation update, run:

- checker regression;
- canonical Roadmap artifact checker.

Required:

```text
WARN = 0
FAIL = 0
```

Report actual PASS count.

Do not silently fix unrelated gaps.

---

# 34. NEGATIVE CHECKS

Explicitly report:

```text
SLO targets changed = 0
SLO relaxed after failure = 0
production backend tuning = 0
frontend tuning = 0
schema changed = 0
migration added = 0
index added/changed = 0
query optimized = 0
Prisma pool changed = 0
PostgreSQL tuned = 0
worker interval changed = 0
worker batch changed = 0
retry policy changed = 0
cache added = 0
rate limiter changed = 0
harness assertions weakened = 0
load reduced after failure = 0
failed run hidden = 0
test skipped = 0
forced process exit masking = 0
real PSP network = 0
PSP selected = 0
2.12B started = 0
2.12I started = 0
sales.service refactor started = 0
2.17C started = 0
2.18 started = 0
RLS implemented = 0
deployment/release = 0
```

Documentation/report/Roadmap changes are allowed.

A genuine harness **execution defect** discovered during qualification must not be silently fixed in this pass. Classify the qualification as INVALID/INCOMPLETE and require a separate harness-remediation pass unless the persisted authority explicitly permits a documentation-only correction.

---

# 35. GIT DISCIPLINE

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

Never:

```bash
git add .
git add -A
```

Stage exact qualification documentation/evidence files only.

Example:

```bash
git add docs/prompts/PHASE_2_STEP_2.17B_FINAL_QUALIFICATION_REPORT.md
git add docs/architecture/load-performance-qualification-2.17B.md
git add docs/operations/load-performance-qualification-runbook.md
git add docs/prompts/TravelHub_CANONICAL_IMPLEMENTATION_ROADMAP_v3.md
```

Use actual repository paths.

Inspect:

```bash
git diff --cached --stat
git diff --cached
git diff --cached --check
```

---

# 36. COMMIT

If PASS:

```bash
git commit -m "test(perf): qualify phase 2.17B against approved targets"
```

If FAIL:

```bash
git commit -m "test(perf): record phase 2.17B qualification failure"
```

If INVALID/INCOMPLETE:

```bash
git commit -m "test(perf): record phase 2.17B qualification blocker"
```

Then populate provenance with real SHA.

If a second documentation-only footer commit is required:

```bash
git add <exact-report-path>
git commit -m "docs(perf): record phase 2.17B qualification provenance"
```

Do not fabricate the final SHA in advance.

---

# 37. PUSH

Push the qualification evidence:

```bash
git push
```

Verify:

```bash
git rev-parse HEAD
git rev-parse --verify @{u}
git status --short
```

Only report:

```text
push_status: PUSHED
```

when:

```text
final HEAD == upstream
```

---

# 38. REPOSITORY EVIDENCE FOOTER

Populate actual values only:

```text
REPOSITORY EVIDENCE

repository:
branch:
qualification_base_sha:
quantitative_authority_sha:
harness_implementation_sha:
qualification_evidence_commit_sha:
provenance_footer_commit_sha:
final_head_sha:
upstream_sha:
push_status:
worktree_clean:
migration_count:
artifact_integrity:
checker_regression:
backend_regression:
frontend_regression:
database_drift:
qualification_environment:
dataset_state:
steady_state:
peak_state:
burst_state:
payment_state:
booking_order_state:
auth_login_state:
eventbus_steady_state:
eventbus_burst_state:
eventbus_recovery_state:
multi_instance_state:
soak_state:
correctness_state:
cleanup_state:
psp_subset:
final_qualification_verdict:
step_2_17b_state:
strict_review_state:
step_2_17c_state:
step_2_18_state:
persistence_status:
release_status:
```

Never fabricate values.

---

# 39. RELEASE

No deployment.

Required:

```text
RELEASE: NOT PERFORMED — STRICT REVIEW REQUIRED
```

for PASS.

For FAIL:

```text
RELEASE: NOT PERFORMED — QUALIFICATION FAILED
```

---

# 40. SUCCESS OUTPUT — PASS

If all required gates pass, output equivalent to:

```text
PHASE 2 STEP 2.17B FINAL QUALIFICATION COMPLETED —
ALL APPROVED V1 PLATFORM PERFORMANCE TARGETS PASS —
WAITING FOR STRICT REVIEW

Authority:
- targets changed: 0
- V1 peak: 50 RPS
- qualification sustained: 100 RPS
- burst: 200 RPS
- headroom: 2.0x

Environment:
- class: dedicated isolated performance environment
- app instances: 2
- worker instances: 2
- PostgreSQL: <actual>
- dataset: <actual>

Qualification:
- steady 15m @ 50 RPS: PASS — <measured>
- peak 15m @ 100 RPS: PASS — <measured>
- burst 60s @ 200 RPS: PASS — <measured>
- soak 30m @ 50 RPS / 250 concurrency: PASS — <measured>

Latency:
- Class A target 300/750 ms: <measured> — PASS
- Class B target 500/1000 ms: <measured> — PASS
- Class C target 750/1500 ms: <measured> — PASS
- Class D target 1000/2000 ms: <measured> — PASS
- payment.create target 1000/2000 ms: <measured> — PASS
- login target 750/1500 ms: <measured> — PASS

Reliability:
- unexpected 5xx: 0 — PASS
- timeout: 0 — PASS
- transport failure: 0 — PASS

Payment:
- 2 RPS / burst 10 / concurrency 50: PASS
- duplicate Payment: 0
- wrong replay: 0
- raw controlled-race 500: 0

Booking/Order:
- 6 RPS / burst 20: PASS
- duplicate business facts: 0

EventBus:
- 100 ev/s: PASS
- burst 1,000: PASS
- normal backlog <=100: <actual> — PASS
- oldest PENDING <=10s: <actual> — PASS
- recovery 5,000 / 2 workers / <=120s: <actual> — PASS
- lost committed events: 0
- duplicate business effects: 0
- semantics: at-least-once + Inbox/consumer idempotency

Multi-instance:
- 2 app + 2 worker: PASS

Correctness:
- all zero-tolerance gates: PASS

PSP:
- subset: DEFERRED
- real PSP network: 0

Artifact integrity:
- PASS=<actual> WARN=0 FAIL=0

Persistence:
- branch: <actual>
- qualification commit: <sha>
- provenance/footer commit: <sha>
- final HEAD/upstream: <sha>
- push_status: PUSHED

Step 2.17B:
- final qualification: PASS
- overall approval: NOT YET
- strict review: NOT STARTED

RELEASE: NOT PERFORMED — STRICT REVIEW REQUIRED
NEXT: PHASE 2 — STEP 2.17B — STRICT REVIEW
```

---

# 41. FAILURE OUTPUT

If any required gate genuinely fails:

```text
PHASE 2 STEP 2.17B FINAL QUALIFICATION FAILED —
APPROVED TARGETS NOT MET —
REMEDIATION REQUIRED

Targets changed: 0
tuning performed: 0
failed runs hidden: 0

Failed gates:
- <gate>: target=<...>, measured=<...>
- ...

Correctness:
- <PASS/FAIL>

Likely bottleneck classification:
- <classification or NOT YET PROVEN>

Evidence:
- <persisted evidence>

Step 2.17B:
- final qualification: FAIL
- approved: NO
- strict review: NOT STARTED

RELEASE: NOT PERFORMED — QUALIFICATION FAILED
NEXT: PHASE 2 — STEP 2.17B — PERFORMANCE REMEDIATION
```

Do not append an implementation fix.

---

# 42. INVALID / INCOMPLETE OUTPUT

If qualification evidence is invalid because of environment/harness/setup failure:

```text
PHASE 2 STEP 2.17B FINAL QUALIFICATION INCOMPLETE —
VALID PERFORMANCE VERDICT NOT AVAILABLE

System PASS claimed: NO
System FAIL claimed: NO

Invalidating blocker:
- <exact evidence>

Production tuning performed: 0
Targets changed: 0

NEXT:
PHASE 2 — STEP 2.17B —
QUALIFICATION HARNESS/ENVIRONMENT REMEDIATION
```

Use this only when justified.

---

# 43. HARD STOP

After:

1. repository verification;
2. authority freeze;
3. environment safety validation;
4. baseline regression;
5. deterministic dataset;
6. smoke;
7. warm-up;
8. 15-minute steady;
9. 15-minute 100-RPS peak;
10. 60-second 200-RPS burst;
11. payment qualification;
12. Booking/Order qualification;
13. auth/login qualification;
14. EventBus steady;
15. EventBus burst;
16. EventBus 5,000-event / 2-worker recovery;
17. 2-app / 2-worker multi-instance;
18. full 30-minute soak;
19. independent correctness validation;
20. cleanup;
21. target→measured→verdict matrix;
22. PASS/FAIL/INVALID classification;
23. report + Roadmap/docs update;
24. artifact-integrity check;
25. exact-file staging;
26. commit;
27. provenance footer;
28. push;
29. final HEAD/upstream verification;

**STOP.**

If PASS, do not start Strict Review in the same pass.

If FAIL, do not remediate in the same pass.

If INVALID, do not fix the harness/environment in the same pass.

Do not start:

- Step 2.17C;
- Step 2.18;
- RLS;
- PSP selection;
- 2.12B;
- 2.12I;
- deployment/release.

The only valid NEXT values are:

```text
PASS    → PHASE 2 — STEP 2.17B — STRICT REVIEW
FAIL    → PHASE 2 — STEP 2.17B — PERFORMANCE REMEDIATION
INVALID → PHASE 2 — STEP 2.17B — QUALIFICATION HARNESS/ENVIRONMENT REMEDIATION
```
