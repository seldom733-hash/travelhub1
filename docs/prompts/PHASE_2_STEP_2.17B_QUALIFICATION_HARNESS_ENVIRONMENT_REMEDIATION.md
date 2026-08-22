# PHASE 2 — STEP 2.17B — QUALIFICATION HARNESS / ENVIRONMENT REMEDIATION

## 0. MODE

**HARNESS-CAPABILITY REMEDIATION · REPOSITORY-FIRST · FIX ONLY PROVEN QUALIFICATION BLOCKERS · FROZEN SLOs · NO PRODUCTION PERFORMANCE TUNING · NO FINAL QUALIFICATION · NO STRICT REVIEW · EVIDENCE/PERSISTENCE REQUIRED · HARD STOP**

Previous canonical outcome:

```text
PHASE 2 STEP 2.17B FINAL QUALIFICATION INCOMPLETE —
VALID PERFORMANCE VERDICT NOT AVAILABLE

verdict = C — QUALIFICATION INVALID / INCOMPLETE
```

Purpose of this pass:

```text
INVALID QUALIFICATION
→ reproduce harness/environment blockers
→ remediate harness/environment only
→ prove frozen qualification matrix is executable
→ full regression
→ persist evidence
→ STOP
→ separate final re-qualification
```

This is NOT a production-performance remediation pass. It MUST NOT tune TravelHub merely to make the approved targets pass.

---

# 1. REQUIRED STARTING STATE

Independently verify from repository code and persisted artifacts:

```text
Step 2.17       = APPROVED
Step 2.17A      = APPROVED

Step 2.17B:
- harness = IMPLEMENTED
- quantitative authority = APPROVED
- first final qualification = INCOMPLETE / INVALID
- valid performance verdict = NOT AVAILABLE
- approved = NO
- strict review = NOT STARTED
- NEXT = QUALIFICATION HARNESS/ENVIRONMENT REMEDIATION

Step 2.17C      = NOT STARTED
Step 2.18       = NOT STARTED

2.12B           = BLOCKED
ADR-0015        = PROPOSED — BLOCKED
PSP subset      = DEFERRED
```

Read at minimum:

- canonical Roadmap;
- `docs/architecture/load-performance-qualification-2.17B.md`;
- `docs/operations/load-performance-qualification-runbook.md`;
- Step 2.17B harness implementation report;
- SLO/load authority decision report;
- quantitative-target authority report;
- `docs/prompts/PHASE_2_STEP_2.17B_FINAL_QUALIFICATION_REPORT.md`;
- actual `backend/src/perf/`;
- relevant package scripts;
- actual production bootstrap and worker configuration.

Code is authority. Do not trust prior summaries without verification.

---

# 2. PROVENANCE BASELINE

Before edits:

```bash
git status --short
git branch --show-current
git rev-parse HEAD
git rev-parse --verify @{u} 2>/dev/null || true
git log --oneline --decorate -50
git diff
```

Record branch, base SHA, upstream SHA, worktree state, migration count, artifact-integrity baseline, first-qualification evidence SHA, and quantitative-authority SHA.

Preserve unrelated untracked files.

Never use:

```bash
git add .
git add -A
```

---

# 3. FREEZE APPROVED TARGETS — HARD GATE

Extract the persisted approved matrix before changing harness code.

At minimum preserve unchanged:

```text
normal                    = 25 RPS
V1 peak                   = 50 RPS
qualification sustained   = 100 RPS
burst                     = 200 RPS
headroom                  = 2.0x

normal concurrency        = 100
peak concurrency          = 250
qualification concurrency = 500
burst concurrency         = 1,000

warm-up                   = 5 min
steady                    = 15 min @ 50 RPS
peak qualification        = 15 min @ 100 RPS
burst                     = 60 sec @ 200 RPS
soak                      = 30 min @ 50 RPS / concurrency 250

payment                   = 2 RPS sustained / 10 burst / concurrency 50
Booking/Order             = 6 RPS sustained / 20 burst
login                     = 2 RPS qualification / 5 burst

EventBus qualification    = 100 events/sec
EventBus burst            = 1,000 events
normal backlog            <=100
oldest PENDING            <=10 sec
recovery                  = 5,000 events / 2 workers / <=120 sec

topology                  = 2 app instances + 2 worker instances
```

Preserve all approved p95/p99, reliability, correctness and zero-duplicate gates.

Required:

```text
APPROVED TARGET NUMBERS CHANGED = 0
SLO RELAXATION = 0
```

Harness defaults/configuration may be made capable of expressing authority; authority itself must not be rewritten.

---

# 4. REPRODUCE ALL 11 BLOCKERS FIRST

Build a repository-evidence matrix before fixes:

| ID | Previously proven blocker | Code evidence | Reproduced? | Owner |
|---|---|---|---|---|
| H1 | no arrival-rate pacing; loader is max-effort concurrency | actual code | YES/NO | harness |
| H2 | `--warmup` parsed but not applied; profile warm-up ≤2s | actual code | YES/NO | harness |
| H3 | dataset generator SMALL-only | actual code | YES/NO | harness |
| H4 | no payment.create sustained 2 RPS / burst 10 RPS profile | actual code | YES/NO | harness |
| H5 | no Booking/Order 6/20 RPS profiles | actual code | YES/NO | harness |
| H6 | no login 2/5 RPS profiles | actual code | YES/NO | harness |
| H7 | no EventBus steady 100 ev/s generation scenario | actual code | YES/NO | harness |
| H8 | EventBus burst hardcoded at 250 | actual code | YES/NO | harness |
| H9 | recovery cannot execute 5,000 / 2 workers with canonical worker config | actual code | YES/NO | harness |
| H10 | no real 2-app + 2-worker HTTP topology | actual code | YES/NO | harness/environment |
| H11 | soak duration works but 50-RPS pacing cannot be driven | actual code | YES/NO | harness |

If any reported blocker is no longer present, say so and prove why. Do not fabricate work.

Additional blockers may be fixed only when they are genuinely required to execute the frozen matrix.

---

# 5. H1 — ARRIVAL-RATE PACING

Implement explicit target-arrival-rate pacing. Keep max-effort mode only for exploratory/stress use.

Qualification mode must support:

```text
target RPS
duration
concurrency ceiling
request/route-class mix
warm-up phase
```

Do NOT pace by sleeping after each completed request. Completion-rate pacing conflates latency with arrival rate.

Prefer monotonic scheduling conceptually equivalent to:

```text
scheduled_start(n) = phase_start + n / target_rate
```

Required rates include:

```text
25, 50, 100, 200 RPS
1, 2, 3, 5, 6, 10, 20 scenario RPS
100 events/sec
```

Emit:

```text
targetRps
scheduledOperations
startedOperations
completedOperations
achievedStartRate
achievedCompletionRate
schedulerLag
maxConcurrencyObserved
```

Add a harness-execution validity criterion:

```text
sustained target start-rate = within ±5% of requested RPS
burst scheduled starts      = within ±5% of requested total
```

This ±5% is a harness validity tolerance, NOT a new business SLO.

If load was not actually applied:

```text
LOAD_APPLICATION_VALID = FAIL
```

---

# 6. H2 — REAL WARM-UP

Wire `--warmup` or one canonical equivalent.

Final qualification must be able to request:

```text
warm-up = 5 minutes
```

Warm-up must generate representative traffic, be separately timed/reported, and not silently remain ≤2 seconds.

Automated tests may use short durations.

Prove CLI/config propagation and separation of warm-up from measured windows.

---

# 7. H3 — DETERMINISTIC DATASET PROFILES

Support:

```text
SMALL
REPRESENTATIVE
STRESS
```

`REPRESENTATIVE` must be able to prepare at least the approved qualification dataset:

```text
Users                    >= 1,000
Products/service units   >= 500
Customers/CRM entities   >= 1,000
Sales/quotes             >= 1,000
Booking/Order chains     >= 1,000
Payment-capable orders   >= 500
Finance/ledger records   >= 5,000
EventBus seed capacity   >= 5,000
```

If domain names differ, map them explicitly.

Requirements:

- synthetic only;
- deterministic;
- run-prefixed;
- business invariants preserved;
- dependency-aware cleanup;
- no schema change just to satisfy counts.

Add tests for profile selection, deterministic counts, and cleanup.

---

# 8. H4 — PAYMENT PROFILES

Add explicit TravelHub-owned payment-initiation profiles:

```text
payment-steady:
  2 RPS

payment-burst:
  10 RPS

payment-concurrency:
  concurrency 50
```

Cover:

- unique Idempotency-Key;
- identical retry;
- concurrent identical retry;
- divergent reuse;
- business no-op when active Payment already exists;
- cross-principal isolation where applicable.

Retain independent DB validation:

```text
duplicate committed Payment = 0
wrong replay = 0
raw 500 from controlled race = 0
```

No real PSP network, adapter selection or webhook work.

---

# 9. H5 — BOOKING / ORDER PROFILES

Add:

```text
booking-order-steady = 6 RPS
booking-order-burst  = 20 RPS
```

Use canonical APIs/domain lifecycle. Do not add special production endpoints.

Emit target/achieved RPS, latency, controlled conflicts, unexpected failures, duplicate-fact checks and event-chain convergence.

---

# 10. H6 — LOGIN PROFILES

Add:

```text
login-qualification = 2 RPS
login-burst         = 5 RPS
```

Requirements:

- distinct principals where needed;
- do not bypass `LoginThrottleService`;
- do not disable throttling;
- distinguish expected 429 from unexpected failure;
- no secrets in result artifacts.

---

# 11. H7 — EVENTBUS STEADY GENERATION

Add paced EventBus generation at:

```text
100 events/sec
```

This must be a generation-under-processing scenario, not merely a fixed backlog drain.

Measure separately:

```text
generation rate
processing rate
PENDING backlog
oldest PENDING age
retryable FAILED
poison/exhausted
consumer effects
```

This is required to later judge:

```text
normal backlog <=100
oldest PENDING <=10 sec
```

Do not change worker settings.

---

# 12. H8 — CONFIGURABLE EVENTBUS BURST

Remove the qualification limitation equivalent to:

```text
SEED_COUNT = 250
```

Support profile/CLI configuration such that these are expressible without source edits:

```text
250
1,000
5,000
```

Final EventBus burst requires:

```text
1,000 events
```

Do not make 5,000 a universal default if profile-specific configuration is cleaner.

---

# 13. H9 — 5,000-EVENT RECOVERY WITH CANONICAL WORKER CONFIG

Repository-first determine actual canonical Step 2.17 worker interval/batch.

The previous qualification reported test overrides such as:

```text
OUTBOX_WORKER_INTERVAL_MS=200/500
```

Final qualification mode must NOT use speed overrides.

Required capability:

```text
backlog = 5,000
worker instances = 2
worker interval = canonical
worker batch = canonical
drain time measured
```

Final qualification mode must fail closed if forbidden worker timing overrides are present.

Example:

```text
QUALIFICATION_CONFIG_VALID = false
reason = worker configuration differs from canonical qualification contract
```

Do not change production worker defaults.

---

# 14. H10 — TRUE 2 APP + 2 WORKER TOPOLOGY

Provide qualification topology:

```text
2 real application instances
2 real worker instances
shared PostgreSQL
```

Both application instances must receive HTTP traffic.

Requirements:

- same production code path;
- deterministic startup/readiness;
- deterministic distribution across app instances;
- deterministic shutdown;
- cleanup on partial startup failure;
- per-instance request counts.

A local test load balancer is not required. The harness may distribute deterministically across two ports.

Do not introduce a production LB dependency just for testing.

## Worker-count correctness

Check whether HTTP app bootstrap automatically starts workers. Avoid accidentally turning `2 app + 2 worker` into four workers.

If a minimal boot-role seam is required, it is allowed ONLY when:

1. default production boot behavior is unchanged;
2. the seam changes no performance parameter;
3. it is explicit and fail-closed;
4. it is test/ops controlled;
5. it is covered by tests;
6. it is documented.

Do not silently disable background work.

---

# 15. H11 — PACED SOAK CAPABILITY

After H1, make the harness able to express:

```text
30 minutes
50 RPS
concurrency ceiling 250
```

The prior 30-minute max-effort ~310 RPS run does not satisfy this gate.

During this remediation pass, do NOT run the full final soak. Prove the pacing/configuration path with a short validation window, e.g. 30–60 seconds.

Label:

```text
HARNESS CAPABILITY VALIDATION ONLY
NOT FINAL QUALIFICATION
```

---

# 16. CANONICAL QUALIFICATION PROFILE MANIFEST

Create one central machine-readable profile source or equivalent configuration for the approved matrix so commands do not drift.

It must resolve at least:

```text
warmup: 300s

steady:
  50 RPS
  900s

peak:
  100 RPS
  900s
  concurrency <=500

burst:
  200 RPS
  60s
  concurrency <=1000

soak:
  50 RPS
  1800s
  concurrency <=250
```

Also include payment, Booking/Order, login and EventBus profiles.

Prefer one canonical source of qualification profile values and emit the resolved profile into result metadata.

Do not rewrite approved authority merely to create this manifest.

---

# 17. FAIL-CLOSED PROFILE VALIDATION

Before a final-mode run validate:

```text
targetRps > 0
duration > 0
concurrency > 0
dataset profile valid
app count = required count
worker count = required count
safe isolated DB target
canonical worker settings
PSP network disabled
```

Reject contradictory or incomplete configs.

Examples:

```text
--rps 100 --duration 0 → fail
--apps 1 in final mode → fail
--workers 1 in final mode → fail
canonical DB target → fail
worker speed override in final mode → fail
```

Add tests.

---

# 18. STRUCTURED RESULT CONTRACT

Result artifacts must include at least:

```text
runId
mode
profile
gitSha
targetRps
achievedStartRps
achievedCompletionRps
durationRequested
durationMeasured
concurrencyCeiling
maxConcurrencyObserved
scheduledOperations
startedOperations
completedOperations
schedulerLag
routeClassMetrics
expectedStatuses
unexpectedStatuses
5xx
timeouts
transportFailures
datasetProfile
datasetCounts
appInstances
workerInstances
perAppRequestCounts
workerInterval
workerBatch
EventBus metrics
correctness result
cleanup result
qualificationConfigValid
```

Secrets must remain scrubbed.

Do not commit huge raw logs blindly.

---

# 19. ROUTE-CLASS METRICS

Emit p50/p95/p99/max separately for the approved classes:

```text
A — public/light reads
B — authenticated reads
C — ordinary writes
D — concurrency-sensitive
E — payment.create
F — login
```

Add attribution tests.

Aggregate-only latency is insufficient for final re-qualification.

---

# 20. OBS-1 — SALES.LIST MUST NOT BE TUNED HERE

Preserve the prior observation:

```text
sales.list / Class B:
p95 ~428 ms @ ~250 RPS
p95 ~1533 ms @ ~367 RPS
p95 ~2427 ms @ ~310 RPS / concurrency 250
```

Canonical status:

```text
classification hypothesis = DATABASE QUERY / CONNECTION POOL CONTENTION
ROOT CAUSE = NOT YET PROVEN
production remediation = NOT STARTED
```

Forbidden in this pass:

- `sales.service.ts` optimization;
- query rewrite;
- new index;
- Prisma pool change;
- cache;
- production performance fix.

The separate paced final re-qualification decides whether Class B actually fails at the approved load.

---

# 21. OBS-2 — 24 PUBLISHED EVENT ROWS

Determine whether the previously observed 24 PUBLISHED rows are:

```text
A. canonical retained EventBus history
or
B. harness-owned residue
```

Do not delete canonical event history just to make cleanup counters zero.

If canonical:

```text
cleanup = PASS
retained canonical history = expected
```

Make the validator distinguish canonical persistent history from orphan harness residue.

If genuine harness residue, fix cleanup ownership without changing production retention semantics.

---

# 22. OBS-3 — WORKER OVERRIDE

Remove or fail-close the qualification path using noncanonical worker timing.

Tests must prove final qualification mode cannot silently override canonical worker interval/batch.

Production defaults remain unchanged.

---

# 23. OBS-4 — ORCHESTRATION / SESSION BOUNDARIES

Use persisted evidence from the two previously invalidated runs to identify the exact lifecycle issue.

Remediate harness/environment lifecycle only:

```text
start
readiness
run
collect
shutdown
cleanup
```

Required:

- no orphan app;
- no orphan worker;
- no orphan DB;
- result artifact finalized on controlled failure;
- cleanup attempted on failure;
- original failure exit code preserved;
- no `--forceExit` masking.

Add adversarial lifecycle tests where practical.

---

# 24. MEMORY OBSERVABILITY — OPTIONAL HARNESS-LEVEL IMPROVEMENT

If feasible without production dependencies, collect lightweight process memory:

```text
RSS
heapUsed
heapTotal
start
periodic samples
peak
end
```

No memory SLO exists.

Do NOT add production telemetry dependencies.

If reliable collection is not feasible, retain:

```text
MEMORY TREND = NOT MEASURED — OBSERVABILITY LIMITATION
```

This alone does not block remediation readiness.

---

# 25. TEST REQUIREMENTS

Add focused tests for:

### Pacing
- target-start scheduling;
- no completion-rate pacing;
- concurrency ceiling;
- end-of-duration/cancellation;
- ±5% validity classification;
- scheduler lag.

### Warm-up
- CLI/config propagation;
- separation from measurement;
- short automated duration.

### Dataset
- SMALL;
- REPRESENTATIVE;
- STRESS;
- deterministic counts;
- cleanup.

### Payment
- 2 RPS;
- 10 RPS;
- concurrency 50;
- operation mix.

### Booking/Order
- 6 RPS;
- 20 RPS.

### Login
- 2 RPS;
- 5 RPS;
- expected 429.

### EventBus
- 100 ev/s;
- 1,000 burst;
- 5,000 recovery;
- two-worker topology;
- canonical config guard.

### Multi-instance
- two app instances;
- request distribution;
- two worker instances;
- readiness;
- shutdown;
- partial-start failure cleanup.

### Results
- target vs achieved;
- route classes;
- per-app counts;
- secret scrubbing.

Do not weaken existing assertions or skip tests.

---

# 26. SHORT CAPABILITY VALIDATION — NOT FINAL QUALIFICATION

After implementation, run short validations sufficient to prove the harness can express the frozen matrix.

At minimum exercise:

```text
50 RPS     for 30–60 sec
100 RPS    for 30–60 sec
200 RPS    for 15–30 sec

payment steady 2 RPS
payment burst 10 RPS
payment concurrency 50

Booking/Order 6 RPS
Booking/Order burst 20 RPS

login 2 RPS
login burst 5 RPS

EventBus steady 100 ev/s
EventBus burst 1,000
EventBus recovery seed 5,000 / 2 workers / canonical config

2 app + 2 worker HTTP topology

soak configuration:
50 RPS / concurrency 250
using short validation duration
```

Every result must say:

```text
HARNESS CAPABILITY VALIDATION ONLY
NOT FINAL QUALIFICATION
NOT SLO VERDICT
```

Do not use these short runs to declare Step 2.17B PASS or FAIL.

If `sales.list` looks slow or fast, record it only as observation.

---

# 27. FULL REGRESSION AFTER REMEDIATION

Required:

## Backend

```text
tsc = PASS
build = PASS
unit = PASS
full serial e2e = PASS
```

## Frontend

```text
tsc = PASS
vitest = PASS
production build = PASS
```

## DB

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

Report actual counts.

---

# 28. PRODUCTION-TUNING HARD NEGATIVE GATE

Forbidden:

```text
sales.service.ts optimization
query optimization
new/changed DB indexes
schema performance changes
PostgreSQL tuning
Prisma pool tuning
cache introduction
worker interval tuning
worker batch tuning
retry tuning
login throttle tuning
PaymentService semantic changes
idempotency semantic changes
EventBus delivery semantic changes
auth/RBAC semantic changes
```

A minimal boot-role seam for exact topology is the only potentially acceptable production-source change, subject to the constraints in §14.

---

# 29. PSP AND OTHER PHASE BOUNDARIES

Must remain:

```text
real PSP network = 0
production PSP adapter added = 0
webhook route added = 0
provider selected = NO
ADR-0015 = BLOCKED
2.12B = BLOCKED
PSP performance subset = DEFERRED
```

Do not start:

```text
2.12B
2.12C
2.12I
2.17C Sales decomposition
2.18
RLS
production Backup/DR infrastructure
release/deployment
```

---

# 30. REQUIRED REMEDIATION REPORT

Create:

```text
docs/prompts/PHASE_2_STEP_2.17B_QUALIFICATION_HARNESS_ENVIRONMENT_REMEDIATION_REPORT.md
```

Minimum sections:

1. mode;
2. verdict;
3. repository truth;
4. provenance;
5. frozen targets;
6. prior invalid qualification;
7. H1 reproduction/fix;
8. H2 reproduction/fix;
9. H3 reproduction/fix;
10. H4 reproduction/fix;
11. H5 reproduction/fix;
12. H6 reproduction/fix;
13. H7 reproduction/fix;
14. H8 reproduction/fix;
15. H9 reproduction/fix;
16. H10 reproduction/fix;
17. H11 reproduction/fix;
18. pacing design;
19. load-validity rule;
20. warm-up;
21. datasets;
22. payment;
23. Booking/Order;
24. login;
25. EventBus steady;
26. EventBus burst;
27. EventBus recovery;
28. multi-instance topology;
29. canonical worker-config proof;
30. route-class metrics;
31. result schema;
32. orchestration/lifecycle;
33. cleanup semantics;
34. OBS-1 preservation;
35. OBS-2 classification;
36. OBS-3 resolution;
37. OBS-4 resolution;
38. memory observability;
39. tests;
40. short capability validation;
41. full regression;
42. DB/migration/drift;
43. artifact integrity;
44. negative checks;
45. Roadmap update;
46. persistence;
47. Repository Evidence footer;
48. release;
49. NEXT;
50. HARD STOP.

---

# 31. VERDICT MODEL

## A — READY FOR RE-QUALIFICATION

Only if all frozen qualification scenarios are now expressible and short capability validation passes.

```text
HARNESS REMEDIATION = PASS
FINAL QUALIFICATION = NOT RUN
Step 2.17B = HARNESS REMEDIATION COMPLETED — READY FOR RE-QUALIFICATION
```

## B — REMEDIATION INCOMPLETE

If harness/environment blockers remain:

```text
HARNESS REMEDIATION = INCOMPLETE
FINAL QUALIFICATION = NOT RUN
Step 2.17B = HARNESS REMEDIATION INCOMPLETE
```

## C — PRODUCTION ARCHITECTURE BLOCKER DISCOVERED

Use only if valid qualification cannot be enabled without a material production architecture change.

Do not implement that architecture change in this pass.

---

# 32. ROADMAP UPDATE

If A:

```text
Step 2.17B:
🚧 HARNESS/ENVIRONMENT REMEDIATION COMPLETED —
READY FOR FINAL RE-QUALIFICATION —
NOT APPROVED
```

Preserve:

```text
quantitative targets = APPROVED / UNCHANGED
previous qualification = INVALID / INCOMPLETE
strict review = NOT STARTED
```

NEXT:

```text
PHASE 2 — STEP 2.17B —
FINAL RE-QUALIFICATION AGAINST UNCHANGED APPROVED TARGETS
```

If B, record remaining blockers.

If C, record exact architecture decision required.

Never mark Step 2.17B approved here.

---

# 33. ARTIFACT INTEGRITY

Run checker regression and canonical Roadmap checker.

Required:

```text
WARN = 0
FAIL = 0
```

Report actual PASS count.

Do not silently repair unrelated historical issues.

---

# 34. REQUIRED NEGATIVE CHECKS

Explicitly report:

```text
approved SLO changed = 0
approved load target changed = 0
SLO relaxed = 0
production performance tuning = 0
sales.service.ts performance refactor = 0
query optimization = 0
index added = 0
index changed = 0
schema changed = 0
migration added = 0
Prisma pool tuned = 0
PostgreSQL tuned = 0
cache added = 0
worker interval production default changed = 0
worker batch production default changed = 0
retry semantics changed = 0
Payment lifecycle semantics changed = 0
idempotency semantics changed = 0
auth semantics changed = 0
login throttle weakened = 0
test assertion weakened = 0
test skipped = 0
failed validation hidden = 0
full final qualification executed = 0
Step 2.17B approved = 0
strict review started = 0
2.17C started = 0
2.18 started = 0
RLS implemented = 0
PSP selected = 0
real PSP network = 0
2.12B started = 0
2.12I started = 0
release/deployment = 0
```

If a minimal boot-role seam was necessary, report it separately and prove default production behavior is unchanged.

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

Stage exact files only.

Likely scope:

```text
backend/src/perf/**
backend/package.json
docs/architecture/load-performance-qualification-2.17B.md
docs/operations/load-performance-qualification-runbook.md
docs/prompts/PHASE_2_STEP_2.17B_QUALIFICATION_HARNESS_ENVIRONMENT_REMEDIATION_REPORT.md
canonical Roadmap
```

Use actual paths.

Never:

```bash
git add .
git add -A
```

Inspect:

```bash
git diff --cached --stat
git diff --cached
git diff --cached --check
```

---

# 36. COMMIT AND PUSH

If verdict A:

```bash
git commit -m "test(perf): remediate phase 2.17B qualification harness"
```

If B:

```bash
git commit -m "test(perf): record remaining phase 2.17B harness blockers"
```

If C:

```bash
git commit -m "test(perf): record phase 2.17B architecture blocker"
```

Populate real provenance after commit.

If a footer-only second commit is needed:

```bash
git add <exact-report-path>
git commit -m "docs(perf): record phase 2.17B harness remediation provenance"
```

Push:

```bash
git push
```

Verify:

```bash
git rev-parse HEAD
git rev-parse --verify @{u}
git status --short
```

Only claim `PUSHED` if final HEAD equals upstream.

---

# 37. REPOSITORY EVIDENCE FOOTER

Populate actual values only:

```text
REPOSITORY EVIDENCE

repository:
branch:
base_sha:
upstream_before:
first_qualification_sha:
quantitative_authority_sha:
remediation_commit_sha:
provenance_footer_commit_sha:
final_head_sha:
upstream_sha:
push_status:
worktree_clean:

migration_count:
database_drift:
artifact_integrity:
checker_regression:

h1_arrival_rate:
h2_warmup:
h3_dataset:
h4_payment_profiles:
h5_booking_order_profiles:
h6_login_profiles:
h7_eventbus_steady:
h8_eventbus_burst:
h9_eventbus_recovery:
h10_multi_instance:
h11_soak_pacing:

canonical_worker_config:
qualification_profile_manifest:
load_validity_check:
route_class_metrics:
structured_results:
lifecycle_cleanup:
memory_observability:

backend_regression:
frontend_regression:
short_capability_validation:
full_final_qualification_run:
targets_changed:
production_tuning:
psp_subset:

harness_remediation_verdict:
step_2_17b_state:
strict_review_state:
step_2_17c_state:
step_2_18_state:
release_status:
persistence_status:
```

Never fabricate SHAs, counts or statuses.

---

# 38. SUCCESS OUTPUT

If verdict A, output equivalent to:

```text
PHASE 2 STEP 2.17B QUALIFICATION HARNESS/ENVIRONMENT REMEDIATION COMPLETED —
ALL FROZEN QUALIFICATION PROFILES NOW EXECUTABLE —
READY FOR FINAL RE-QUALIFICATION

Decision:
- verdict: A — READY FOR RE-QUALIFICATION
- approved targets changed: 0
- production performance tuning: 0
- final qualification executed: NO
- Step 2.17B: NOT APPROVED
- strict review: NOT STARTED

Harness remediation:
- H1 arrival-rate pacing: PASS
- H2 real 5-min warm-up capability: PASS
- H3 REPRESENTATIVE dataset: PASS
- H4 payment 2/10 RPS + concurrency 50: PASS
- H5 Booking/Order 6/20 RPS: PASS
- H6 login 2/5 RPS: PASS
- H7 EventBus steady 100 ev/s: PASS
- H8 EventBus burst 1,000 configurable: PASS
- H9 recovery 5,000 / 2 workers / canonical config: PASS
- H10 2 app + 2 worker HTTP topology: PASS
- H11 soak 50-RPS pacing: PASS

Load control:
- arrival-rate scheduler: <actual>
- validity tolerance: ±5%
- route classes A–F: emitted
- target/achieved start rate: emitted
- scheduler lag: emitted

Dataset:
- SMALL: PASS
- REPRESENTATIVE: PASS
- STRESS: PASS
- representative counts: <actual>

Topology:
- app instances: 2
- worker instances: 2
- shared PostgreSQL: YES
- canonical worker interval/batch: PRESERVED

Short capability validation:
- 50 RPS: PASS
- 100 RPS: PASS
- 200 RPS: PASS
- payment: PASS
- Booking/Order: PASS
- login: PASS
- EventBus steady: PASS
- EventBus burst 1,000: PASS
- EventBus recovery 5,000 / 2 workers: PASS
- multi-instance: PASS
- soak config: PASS
- label: NOT FINAL QUALIFICATION

OBS-1 sales.list:
- production tuning: 0
- root cause: NOT YET PROVEN
- final gate judgment: DEFERRED TO RE-QUALIFICATION

PSP:
- subset: DEFERRED
- real PSP network: 0

Regression:
- backend: <actual>
- frontend: <actual>
- DB: <actual>
- artifact integrity: PASS=<actual> WARN=0 FAIL=0

Persistence:
- branch: <actual>
- remediation commit: <sha>
- provenance/footer commit: <sha>
- final HEAD/upstream: <sha>
- push_status: PUSHED

RELEASE: NOT PERFORMED
NEXT: PHASE 2 — STEP 2.17B —
FINAL RE-QUALIFICATION AGAINST UNCHANGED APPROVED TARGETS
```

---

# 39. INCOMPLETE OUTPUT

If blockers remain:

```text
PHASE 2 STEP 2.17B QUALIFICATION HARNESS/ENVIRONMENT REMEDIATION INCOMPLETE —
RE-QUALIFICATION NOT YET VALID

Resolved:
- ...

Remaining blockers:
- ...

Approved targets changed: 0
Production tuning performed: 0
Final qualification executed: NO
Step 2.17B approved: NO
Strict review started: NO

RELEASE: NOT PERFORMED
NEXT: separate remediation/architecture decision for remaining blocker(s)
```

---

# 40. HARD STOP

After:

1. repository-first verification;
2. frozen-target snapshot;
3. H1–H11 reproduction;
4. arrival-rate pacing;
5. warm-up wiring;
6. dataset profiles;
7. payment profiles;
8. Booking/Order profiles;
9. login profiles;
10. EventBus steady generation;
11. configurable EventBus burst;
12. canonical-config 5,000-event recovery;
13. true 2-app + 2-worker topology;
14. paced soak capability;
15. profile validation/manifest;
16. structured results;
17. route-class metrics;
18. lifecycle cleanup;
19. OBS-1 preserved without tuning;
20. OBS-2 classified;
21. OBS-3 resolved;
22. OBS-4 resolved;
23. focused tests;
24. short capability validation only;
25. full regression;
26. artifact-integrity check;
27. Roadmap/docs/report update;
28. exact-file staging;
29. commit;
30. provenance footer;
31. push;
32. HEAD/upstream verification;

**STOP.**

Do NOT run the full final qualification in this pass.

Do NOT start Strict Review.

Do NOT optimize `sales.list`.

Do NOT start Step 2.17C, Step 2.18, RLS or PSP work.

The intended NEXT after verdict A is exactly:

```text
PHASE 2 — STEP 2.17B —
FINAL RE-QUALIFICATION AGAINST UNCHANGED APPROVED TARGETS
```
