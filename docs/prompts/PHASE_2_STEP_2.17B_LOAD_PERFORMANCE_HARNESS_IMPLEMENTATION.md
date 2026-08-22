# PHASE 2 — STEP 2.17B — LOAD & PERFORMANCE HARNESS IMPLEMENTATION

## 0. MODE

**IMPLEMENTATION · REPOSITORY-FIRST · EXPLORATORY PERFORMANCE PROFILES ONLY · CORRECTNESS-UNDER-LOAD IS A HARD GATE · NO INVENTED SLO · NO PRODUCTION LOAD · NO PSP INVENTION · COMMIT/PUSH/PROVENANCE REQUIRED · HARD STOP**

Implement the **platform load/performance qualification harness** defined by the approved Step 2.17B authority/design reconciliation.

This pass builds and validates the measurement system. It does **not** grant final Step 2.17B approval.

Canonical semantic:

```text
exploratory load profile
≠ approved production SLO
≠ measured production capacity
≠ production capacity guarantee
```

Final Step 2.17B qualification remains blocked on quantitative Business/Product/Operations authority.

---

# 1. REQUIRED PRECONDITION VERIFICATION

Before changing code, verify from repository:

```text
Step 2.17   = APPROVED
Step 2.17A  = APPROVED
Step 2.17B  = PLANNED / NOT APPROVED
2.17B authority/design verdict = A
Step 2.17C  = NOT STARTED
Step 2.18   = NOT STARTED
Step 2.12B  = BLOCKED
ADR-0015    = PROPOSED / BLOCKED
```

Read at minimum:

- canonical Roadmap Step 2.17B;
- `docs/architecture/load-performance-qualification-2.17B.md`;
- `docs/operations/load-performance-qualification-runbook.md`;
- Step 2.17B authority/design reconciliation report;
- Step 2.17 strict-review report;
- Step 2.17A strict-review report;
- current package scripts and test harnesses.

Repository truth wins.

---

# 2. BASELINE / PROVENANCE

Before edits:

```bash
git status --short
git branch --show-current
git rev-parse HEAD
git rev-parse --verify @{u} 2>/dev/null || true
git log --oneline --decorate -40
git diff
```

Record:

- branch;
- base HEAD;
- upstream;
- worktree;
- migration count;
- current artifact-integrity result;
- Node/PostgreSQL versions;
- existing untracked prompts.

Do not absorb unrelated files.

---

# 3. IMPLEMENTATION GOAL

Build a deterministic performance harness capable of:

1. generating controlled synthetic workload;
2. measuring latency and throughput;
3. running concurrency/burst/recovery scenarios;
4. collecting structured results;
5. validating business correctness after load;
6. distinguishing expected 4xx/409/429 from unexpected 5xx;
7. testing EventBus/backlog recovery;
8. exercising external idempotency;
9. exercising multi-instance behavior where feasible;
10. producing reproducible evidence tied to commit/environment.

The harness must be useful later for qualification against authority-approved SLO/load targets without redesign.

---

# 4. TOOL SELECTION — REPOSITORY-FIRST

The design pass found no existing load tool.

Re-evaluate current repository first.

Select the smallest suitable tool based on actual requirements:

- deterministic scenarios;
- concurrency / arrival-rate control;
- p50/p95/p99/max;
- structured output;
- thresholds or machine-readable assertions;
- HTTP headers/cookies;
- `Idempotency-Key`;
- CI/local compatibility;
- Windows developer compatibility;
- no production service dependency.

Candidates may include k6, autocannon, Artillery or another justified tool.

Do not select by habit.

Document:

```text
selected tool
version
why selected
alternatives rejected
dependency/install model
Windows invocation
CI implications
```

If an npm dependency is added, lockfile must be updated intentionally.

---

# 5. NO SLO INVENTION

There are currently no approved quantitative SLO/load numbers unless repository authority has changed.

Therefore all numeric profiles introduced in this implementation must be explicitly labeled:

```text
EXPLORATORY / HARNESS VALIDATION PROFILE
NOT PRODUCTION SLO
NOT PRODUCTION CAPACITY TARGET
```

Never write:

```text
TravelHub supports X RPS
production p95 is guaranteed below Y
capacity = Z users
```

based on local/test results.

---

# 6. CONFIGURABLE PROFILES

Implement configuration rather than burying numbers in scenario code.

At minimum support configurable:

```text
base URL
scenario
duration
concurrency / virtual users / arrival rate
warm-up
request timeout
dataset size
application instance count metadata
worker instance count metadata
result directory
run identifier
seed
```

Environment variables and/or explicit CLI args are acceptable.

Validate malformed configuration fail-closed.

---

# 7. PROFILE CLASSES

Implement at least these harness profile classes:

```text
SMOKE
BASELINE
STEADY
PEAK
BURST
SOAK
STRESS
RECOVERY
```

Exploratory default numbers may be supplied only for harness validation and must be visibly marked non-authoritative.

Avoid destructive defaults.

`STRESS` must require explicit opt-in.

---

# 8. SAFE TARGET GUARD — CRITICAL

The harness must refuse obvious production targets by default.

At minimum protect against accidental execution against:

- known production host/environment;
- non-local target unless explicit opt-in;
- canonical production-like target configured by repository environment where detectable.

Provide an explicit acknowledgement for non-local/pre-production qualification.

Production execution remains forbidden in this pass.

Guard must run before seed/load actions.

Add adversarial tests.

---

# 9. SYNTHETIC DATA ONLY

Implement deterministic synthetic test-data preparation.

Hard rules:

```text
real PII = forbidden
production credentials = forbidden
real card PAN = forbidden
CVV/CVC = forbidden
production JWT/session = forbidden
real PSP data = forbidden
```

Use synthetic users/entities.

Use a run-specific namespace/prefix so cleanup is deterministic.

---

# 10. DATASET CLASSES

Implement support for:

```text
SMALL
REPRESENTATIVE
STRESS
```

If production volume authority is absent, `REPRESENTATIVE` is a harness dataset label, not a claim that it matches real production.

Document exact generated counts/ratios per run.

Prefer deterministic seed-based generation.

---

# 11. TEST ISOLATION

Performance runs must not rely on dirty shared test state.

Implement a safe isolation strategy based on current repository architecture.

Possible approaches:

- dedicated performance test DB;
- run-specific data namespace;
- deterministic cleanup;
- isolated application process/config.

Never point cleanup at canonical/production DB.

Preserve lessons from prior background-worker/flaky stabilization.

---

# 12. ENVIRONMENT METADATA

Every run must emit machine-readable environment metadata including where available:

```text
run_id
timestamp
git_sha
branch
dirty_worktree
Node version
PostgreSQL version
OS/platform
CPU count/model where safely obtainable
memory
base_url classification
scenario
profile
seed
dataset class/counts
application instance count
worker instance count
tool/version
logging mode
relevant non-secret config
```

Never write secrets/tokens/raw Idempotency-Key values.

---

# 13. RESULT ARTIFACT FORMAT

Create a stable result layout, e.g.:

```text
artifacts/performance/<run-id>/
  summary.json
  environment.json
  correctness.json
  scenario.json
```

or an equally clear repository-approved structure.

Generated bulky run artifacts should be gitignored unless a small curated fixture/baseline is intentionally committed.

The implementation report may record summarized measurements.

---

# 14. LATENCY METRICS

Collect for relevant request groups:

```text
count
p50
p95
p99
max
min if tool provides it
mean may be included but cannot be primary
```

Use client-observed latency.

If server/DB timing is unavailable, state that rather than inventing it.

---

# 15. THROUGHPUT METRICS

Collect where applicable:

```text
requests/sec
successful operations/sec
total requests
successful requests
expected controlled failures
unexpected failures
timeouts
```

For EventBus scenarios additionally:

```text
events created
events processed
events/sec
initial backlog
remaining backlog
backlog drain duration/rate
FAILED count
poison/exhausted count
```

---

# 16. HTTP OUTCOME CLASSIFICATION

Do not collapse all non-2xx into one error percentage.

Classify:

```text
expected 4xx
expected 409
expected 429
unexpected 4xx
unexpected 409
unexpected 429
unexpected 5xx
timeout
transport failure
```

Scenario definitions must state which outcomes are expected.

Any unexpected raw 500 from controlled races is a correctness failure.

---

# 17. ROUTE / WORKLOAD MATRIX

Use actual routes from repository.

Implement a representative platform subset, not all ~280 routes.

At minimum cover actual available equivalents of:

1. lightweight public/read path;
2. authenticated read path;
3. login/auth path;
4. Sales or CRM read path;
5. Booking/Order write or lifecycle path;
6. Finance read path;
7. `POST /api/v1/finance/payments` / `payment.create`;
8. one concurrency-sensitive domain write;
9. EventBus/background processing.

Explain why each was selected.

Do not invent endpoints.

---

# 18. AUTHENTICATION HANDLING

Support current canonical authentication contract.

Do not restore insecure localStorage token behavior.

For load identities:

- use synthetic users;
- obtain session/token through supported test setup;
- do not print credentials;
- do not persist production-like secrets in result artifacts.

Login load must respect the fact that the throttle is per-instance/in-memory unless repository truth changed.

---

# 19. PAYMENT.CREATE PERFORMANCE

Exercise the current TravelHub-owned boundary only.

Test at least:

- unique Idempotency-Key;
- identical replay;
- concurrent identical;
- divergent reuse;
- concurrent divergent.

Correctness hard gates:

```text
duplicate committed Payment = 0
wrong replay = 0
unexpected raw 500 = 0
stored idempotency identity corruption = 0
```

Do not measure or simulate a fake provider as if it were real PSP latency.

---

# 20. IDEMPOTENCY KEY HYGIENE

Generate server/client test keys without exposing them in logs/results.

Store only safe aggregate identifiers if needed.

No raw production key persistence.

Preserve Step 2.12H contract.

---

# 21. BOOKING / ORDER CORRECTNESS UNDER LOAD

For selected concurrency-sensitive Booking/Order scenarios, verify actual canonical invariants.

Examples only if applicable to current code:

- valid lifecycle transitions;
- no duplicate Order;
- no double finalization;
- no invalid terminal-state transition;
- availability/last-slot invariant;
- no silent divergent state.

Use repository truth.

---

# 22. FINANCE CORRECTNESS UNDER LOAD

Where selected scenarios touch Finance:

- Decimal values remain exact;
- no duplicate Commission/CommissionAccrual;
- no duplicate ProviderFee/Settlement/Payout facts from load;
- no mutable-policy regeneration of frozen historical facts;
- expected conflicts remain controlled.

Do not expand Finance scope.

---

# 23. EVENTBUS LOAD HARNESS

Implement scenarios for current EventBus:

### A. Steady PENDING
Create/process a controlled steady stream.

### B. Burst PENDING
Create a burst exceeding one worker batch.

### C. Retryable FAILED backlog
Seed/produce retryable FAILED events through a safe test path.

### D. Poison/exhausted isolation
Prove poison does not prevent unrelated progress.

### E. Worker downtime/recovery
Accumulate backlog while worker is stopped/disabled in isolated environment, then resume and measure drain.

### F. Nested consumer chain
Exercise a real nested chain if current code supports it.

Preserve actual semantics:

```text
at-least-once delivery
Inbox/consumer idempotency authoritative
exactly-once NOT claimed
```

---

# 24. MULTI-INSTANCE EVENTBUS

Where feasible, run at least two worker/application instances against the isolated performance DB.

Measure:

- duplicate attempts;
- successful effects;
- advisory-lock contention indicators available to harness;
- drain rate;
- errors.

Correctness:

```text
duplicate business effect = 0
lost event = 0
unexpected raw 500 = 0
```

Do not claim linear horizontal scaling.

---

# 25. WORKER CONFIGURATION METADATA

Current worker defaults were previously observed around interval/batch values.

Read actual code.

Capture effective:

```text
OUTBOX_WORKER_INTERVAL_MS
OUTBOX_WORKER_BATCH
```

or current equivalents in environment metadata.

Do not silently tune them during baseline.

If exploratory variants are tested, record each variant separately.

---

# 26. RECOVERY SCENARIO

Implement:

1. establish clean baseline;
2. pause/disable worker safely;
3. generate controlled backlog;
4. record backlog size;
5. resume worker;
6. measure drain;
7. verify final business correctness;
8. verify no unexpected residual retryable FAILED;
9. record normalization time.

Do not use arbitrary sleep as the correctness oracle.

Poll explicit state with bounded timeout.

---

# 27. SOAK HARNESS

Implement a soak-capable scenario.

Measure over time where feasible:

- process RSS/heap;
- event-loop lag if instrumented safely;
- active handles if useful;
- DB connections if observable;
- EventBus backlog;
- error rates.

The default validation soak may be short and exploratory.

Do not call it a production endurance qualification.

---

# 28. STRESS / BREAKPOINT SAFETY

Implement stress mode with:

- explicit opt-in;
- controlled ramp;
- maximum configured ceiling;
- abort thresholds for harness/environment safety;
- post-run correctness validation;
- cleanup.

Do not run destructive/unbounded stress.

Do not run against production.

---

# 29. MINIMUM OBSERVABILITY

Add only the minimum instrumentation needed for qualification if current application lacks it.

Prefer harness-side/process-side measurement before introducing a full telemetry platform.

If application instrumentation is added:

- no PII;
- no auth token;
- no raw Idempotency-Key;
- no card data;
- no PSP secrets;
- no uncontrolled high-cardinality identifiers.

Do not turn this into an observability redesign.

---

# 30. EVENT LOOP / PROCESS METRICS

If practical without architectural expansion, capture:

```text
RSS
heap used
event-loop delay/lag
process uptime
```

Document measurement limitations.

No unsupported inference about container/cloud resource utilization.

---

# 31. DATABASE METRICS

Capture what can be reliably obtained from PostgreSQL/test environment:

- connection count;
- long-running/active queries if safe;
- lock/deadlock evidence;
- relevant query/transaction failures;
- DB version.

Do not require superuser-only metrics if canonical environment does not provide them.

Do not add indexes in this pass solely to improve numbers.

---

# 32. NO PERFORMANCE TUNING BEFORE BASELINE

First establish reproducible measurements.

Do not modify:

- indexes;
- pool settings;
- worker defaults;
- query shapes;
- caching;
- transaction boundaries;

just to improve the first result.

If a correctness or catastrophic harness-blocking defect is found, a narrow fix is allowed only with evidence and full regression.

Performance optimization findings must otherwise be documented for a separate pass/review.

---

# 33. WARM-UP

Implement explicit warm-up.

Do not mix warm-up samples into steady-state metrics unless scenario says so.

Record:

- warm-up duration/count;
- whether DB/app connection initialization occurred;
- measurement window.

---

# 34. REPRODUCIBILITY

Same:

```text
git SHA
seed
dataset
scenario
profile
environment
```

should produce structurally comparable results.

Do not require identical latency values.

The harness must produce stable schema/result semantics.

---

# 35. CORRECTNESS VALIDATOR

Implement a post-run validator independent of the load generator.

It must query authoritative DB/application state and emit `correctness.json`.

At minimum include scenario-relevant counts/invariants.

Performance tool success alone cannot make a run PASS.

---

# 36. RUN VERDICT MODEL

Because SLO authority is missing, run verdict must separate:

```text
HARNESS_EXECUTION = PASS/FAIL
CORRECTNESS = PASS/FAIL
MEASUREMENT = RECORDED
SLO_QUALIFICATION = NOT EVALUATED — AUTHORITY REQUIRED
```

Never emit final production SLO PASS.

---

# 37. ABORT CONDITIONS

Fail/abort a run on at least:

- unsafe target;
- seed failure;
- auth bootstrap failure;
- uncontrolled unexpected 5xx;
- correctness invariant breach;
- DB connectivity loss;
- result serialization failure;
- cleanup safety violation.

A stress scenario may intentionally reach saturation, but correctness/cleanup must still be evaluated.

---

# 38. CLEANUP

Implement deterministic cleanup for run-owned synthetic data.

Never broad-delete unrelated test data.

Use run IDs/prefixes/known IDs.

Cleanup failure must be visible.

Do not hide cleanup errors to preserve a green benchmark.

---

# 39. WINDOWS SUPPORT

Document and validate Windows-compatible developer invocation where practical.

Avoid a Bash-only implementation unless the project already mandates Bash for this workflow.

Node-based orchestration is preferred if consistent with repository.

---

# 40. PACKAGE SCRIPTS

Add clear scripts only if justified, e.g. actual naming based on repository conventions:

```text
perf:smoke
perf:baseline
perf:scenario
perf:validate
```

Do not add a script that accidentally targets production by default.

---

# 41. CI BOUNDARY

Do not add expensive absolute performance qualification to normal CI in this pass unless design explicitly requires a small deterministic smoke check.

Permitted CI-like validation:

- harness unit tests;
- configuration/guard tests;
- result schema tests;
- very small performance smoke in isolated test environment if stable.

Do not make shared-runner latency an SLO gate.

---

# 42. PSP SUBSET — HARD DEFERRED

Do not implement:

- real PSP adapter;
- provider sandbox calls;
- webhook load;
- signature verification benchmark;
- Apple Pay/Google Pay provider flow;
- provider rate-limit simulation presented as evidence;
- settlement/payout provider performance.

Record:

```text
STEP 2.17B PSP SUBSET = DEFERRED
dependency = ADR-0015 ACCEPTED + Step 2.12B runtime/provider sandbox
```

---

# 43. PERFORMANCE SECURITY

Ensure the harness cannot leak:

- passwords;
- JWTs;
- cookies;
- raw Idempotency-Key;
- DB URL credentials;
- PSP secrets;
- PAN/CVV.

Add redaction tests if result/logging code handles these fields.

---

# 44. TESTS FOR THE HARNESS

Add unit/integration tests for at least:

1. production/non-local target guard;
2. explicit opt-in semantics;
3. malformed profile/config rejection;
4. deterministic seed/run ID behavior where intended;
5. percentile/result parsing;
6. expected-vs-unexpected HTTP classification;
7. secret/header redaction;
8. result schema;
9. correctness validator failure;
10. cleanup scoping;
11. PSP scenario unavailable/deferred;
12. stress explicit opt-in.

Add more where actual implementation needs them.

---

# 45. REQUIRED LIVE HARNESS VALIDATION

Run against an isolated local/test environment.

At minimum execute:

```text
SMOKE
BASELINE
one concurrency/idempotency scenario
one EventBus backlog/recovery scenario
```

If feasible, also run a short exploratory:

```text
BURST
SOAK
```

Record actual results.

These are harness validation measurements only.

---

# 46. NO CHERRY-PICKING

Report failed/unstable runs encountered during implementation.

If a harness or production defect is found:

- classify root cause;
- fix narrowly if in scope;
- rerun;
- preserve evidence in implementation report.

Do not report only the fastest successful run.

---

# 47. REGRESSION

After implementation run repository-standard regression.

At minimum:

## Backend
```text
typecheck
build
unit
new performance-harness tests
relevant targeted e2e
full serial e2e
```

## Frontend
Use established repository baseline:

```text
typecheck
vitest
production build
```

unless repository truth has changed.

## DB
```text
all migrations applied
drift = 0
```

## Artifact integrity
```text
checker regression
real Roadmap checker
WARN=0
FAIL=0
```

Report actual counts only.

---

# 48. IMPLEMENTATION REPORT

Create:

`docs/prompts/PHASE_2_STEP_2.17B_LOAD_PERFORMANCE_HARNESS_IMPLEMENTATION_REPORT.md`

Required sections:

1. Status
2. Methodology
3. Repository baseline
4. Reviewed design authority
5. Tool selection
6. Dependency changes
7. Harness architecture
8. Safe-target guard
9. Configuration
10. Profiles
11. Dataset generator
12. Isolation
13. Environment metadata
14. Result format
15. Route/workload matrix
16. Authentication
17. Payment/idempotency
18. Booking/Order
19. Finance correctness
20. EventBus scenarios
21. Multi-instance
22. Recovery
23. Soak
24. Stress safety
25. Metrics
26. DB/process observability
27. Correctness validator
28. Cleanup
29. Security/redaction
30. Windows support
31. CI boundary
32. PSP deferred subset
33. Live validation runs
34. Failures/findings
35. Fixes
36. Regression
37. Artifact integrity
38. Negative checks
39. Files changed
40. Roadmap update
41. Remaining SLO authority gap
42. Persistence
43. Repository Evidence
44. Release
45. NEXT
46. Final statement

---

# 49. ROADMAP UPDATE

After successful harness implementation, Step 2.17B must remain **NOT APPROVED**.

Use truthful state equivalent to:

```text
🚧 HARNESS IMPLEMENTATION COMPLETED — EXPLORATORY BASELINE MEASURED —
FINAL SLO/LOAD AUTHORITY + QUALIFICATION + STRICT REVIEW REQUIRED
```

Preserve PSP subset deferred.

Do not mark `APPROVED`.

---

# 50. NEXT-STEP DECISION

After implementation, determine exact next gate from canonical state.

Expected:

```text
STEP 2.17B — SLO/LOAD AUTHORITY DECISION
```

followed later by:

```text
FINAL QUALIFICATION AGAINST APPROVED TARGETS
STRICT REVIEW
```

If repository evidence requires a different ordering, document why.

Do not execute next gate now.

---

# 51. NEGATIVE CHECKS

Report explicitly:

```text
production load executed = 0
production capacity claimed = 0
approved SLO invented = 0
PSP selected = 0
PSP adapter added = 0
real PSP network = 0
webhook performance implemented = 0
provider latency invented = 0
raw PAN/CVV = 0
production credentials in harness = 0
RLS = 0
Step 2.17C started = 0
Step 2.18 started = 0
sales.service refactor = 0
performance tuning before baseline = 0
unjustified indexes = 0
tests skipped for green = 0
assertions weakened = 0
forced process exit masking leaks = 0
unbounded stress = 0
```

---

# 52. GIT DISCIPLINE

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

Stage exact files only.

Inspect:

```bash
git diff --cached --stat
git diff --cached
```

Preserve unrelated untracked prompts.

---

# 53. COMMIT / PUSH

Suggested implementation commit:

```bash
git commit -m "feat(perf): implement phase 2.17B load harness"
```

If narrow correctness fixes are necessary, include them intentionally and explain them.

Push:

```bash
git push
git rev-parse HEAD
git rev-parse --verify @{u}
git status --short
```

Follow established provenance/footer convention.

Claim PUSHED only when final HEAD == upstream.

---

# 54. REPOSITORY EVIDENCE FOOTER

Populate with actual values:

```text
REPOSITORY EVIDENCE

repository:
branch:
implementation_base_sha:
implementation_commit_sha:
provenance_footer_commit_sha:
final_head_sha:
upstream_sha:
push_status:
worktree_clean:
migration_count:
artifact_integrity:
load_tool:
load_tool_version:
harness_profiles:
live_validation_profiles:
slo_authority_state:
production_slo_qualification:
psp_performance_subset:
step_2_17b_state:
step_2_17c_state:
step_2_18_state:
reviewed_state:
persistence_status:
release_status:
```

Never fabricate SHAs/counts.

---

# 55. RELEASE

`RELEASE: NOT PERFORMED — PERFORMANCE HARNESS ONLY`

No deployment.

---

# 56. SUCCESS OUTPUT

```text
PHASE 2 STEP 2.17B LOAD/PERFORMANCE HARNESS IMPLEMENTATION COMPLETED —
EXPLORATORY BASELINE RECORDED — SLO/LOAD AUTHORITY REQUIRED

Harness:
- tool: <actual>
- profiles: SMOKE / BASELINE / STEADY / PEAK / BURST / SOAK / STRESS / RECOVERY
- safe-target guard: PASS
- synthetic deterministic data: PASS
- isolated cleanup: PASS
- environment metadata: PASS
- structured results: PASS
- correctness validator: PASS

Coverage:
- public/read: <actual>
- authenticated read: <actual>
- auth/login: <actual>
- Booking/Order: <actual>
- Finance/payment.create: <actual>
- external idempotency: PASS
- EventBus steady/burst/recovery: PASS
- multi-instance: <actual>

Exploratory measurements:
- SMOKE: <actual>
- BASELINE: <actual>
- concurrency/idempotency: <actual>
- EventBus recovery: <actual>
- BURST: <actual/N/A>
- SOAK: <actual/N/A>

Semantics:
- HARNESS_EXECUTION: PASS
- CORRECTNESS: PASS
- MEASUREMENT: RECORDED
- SLO_QUALIFICATION: NOT EVALUATED — AUTHORITY REQUIRED
- production capacity claim: NONE

PSP:
- provider-dependent performance subset: DEFERRED
- real PSP network: 0

Regression:
- backend: <actual>
- frontend: <actual>
- DB: <actual>
- artifact integrity: PASS=<actual> WARN=0 FAIL=0

Persistence:
- branch: <actual>
- implementation commit: <sha>
- provenance/footer commit: <sha>
- final HEAD/upstream: <sha>
- push_status: PUSHED
- worktree_clean: <actual>

RELEASE: NOT PERFORMED
NEXT: PHASE 2 — STEP 2.17B — SLO/LOAD AUTHORITY DECISION
```

---

# 57. BLOCKED OUTPUT

If implementation cannot safely complete:

```text
PHASE 2 STEP 2.17B LOAD/PERFORMANCE HARNESS IMPLEMENTATION BLOCKED

Blocker:
- <exact blocker>
- severity: <actual>
- repository evidence: <actual>
- affected harness capability: <actual>
- required remediation/authority: <actual>

Step 2.17B remains NOT APPROVED.
No production SLO/capacity claim made.

RELEASE: NOT PERFORMED
NEXT: STEP 2.17B REMEDIATION
```

---

# 58. HARD STOP

After:

- repository verification;
- tool selection;
- harness implementation;
- deterministic datasets/isolation;
- safe-target guard;
- metrics/result artifacts;
- correctness-under-load validation;
- required exploratory local runs;
- regression;
- Roadmap update;
- implementation report;
- artifact integrity;
- exact staging;
- commit;
- push;
- provenance verification;

**STOP.**

Do not:

- approve Step 2.17B;
- invent SLO/load authority;
- execute final qualification;
- start Step 2.17B Strict Review;
- run production load;
- tune production merely to improve benchmark numbers;
- implement PSP/webhook performance;
- start Step 2.17C;
- start Step 2.18;
- start RLS work;
- select or implement a PSP.
