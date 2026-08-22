# PHASE 2 — STEP 2.17B — QUANTITATIVE TARGETS AUTHORITY DECISION

## 0. MODE

**BUSINESS / PRODUCT / OPERATIONS AUTHORITY DECISION · V1 LAUNCH TARGETS · QUALIFICATION TARGETS · FUTURE SCALING TARGETS · DOCUMENTATION-ONLY · NO IMPLEMENTATION · NO TUNING · NO FINAL QUALIFICATION · NO STRICT REVIEW · NO PSP INVENTION · COMMIT/PUSH/PROVENANCE REQUIRED · HARD STOP**

This pass resolves the explicit authority blocker recorded by the previous Step 2.17B SLO/Load Authority Decision.

The previous persisted verdict was:

```text
VERDICT B — PARTIAL AUTHORITY
QUANTITATIVE TARGETS TBD
FINAL QUALIFICATION BLOCKED ON EXPLICIT AUTHORITY
```

This pass supplies that missing authority.

The values in this prompt are **explicit owner-approved planning/qualification targets for TravelHub V1**. They are not to be inferred from localhost benchmark results and are not claims about current production capacity.

Canonical semantic rule:

```text
APPROVED BUSINESS TARGET
≠ OBSERVED HARNESS MEASUREMENT
≠ VERIFIED CAPABILITY
≠ PRODUCTION CAPACITY CLAIM
≠ FUTURE SCALING TARGET
```

---

# 1. REPOSITORY-FIRST PRECHECK

Before changing anything, independently verify repository truth.

At minimum inspect:

- canonical Roadmap;
- Step 2.17B design reconciliation;
- Step 2.17B harness implementation report;
- Step 2.17B SLO/Load Authority Decision report;
- `docs/architecture/load-performance-qualification-2.17B.md`;
- `docs/operations/load-performance-qualification-runbook.md`;
- actual `backend/src/perf/`;
- Step 2.17 and Step 2.17A status;
- ADR-0015;
- payment branch status.

Expected state to verify, not blindly trust:

```text
Step 2.17       = APPROVED
Step 2.17A      = APPROVED
Step 2.17B      = HARNESS IMPLEMENTED / VERDICT B / NOT APPROVED
Step 2.17C      = NOT STARTED
Step 2.18       = NOT STARTED

2.12A           = APPROVED
2.12H           = APPROVED
2.12B           = BLOCKED
ADR-0015        = PROPOSED — BLOCKED
2.12I           = DEFERRED
```

If repository truth materially differs, STOP and report the discrepancy instead of silently reconciling it.

---

# 2. BASELINE / PROVENANCE

Run and record before edits:

```bash
git status --short
git branch --show-current
git rev-parse HEAD
git rev-parse --verify @{u} 2>/dev/null || true
git log --oneline --decorate -40
git diff
```

Also record:

- migration count;
- artifact-integrity baseline;
- harness implementation SHA;
- previous authority-decision SHA;
- current Roadmap state;
- unrelated untracked files.

Do not stage unrelated files.

---

# 3. AUTHORITY DECLARATION

For this pass, the following quantitative values are supplied as an explicit **TravelHub V1 Business/Product/Operations authority decision**.

Do not replace them with values derived from current benchmark results.

Do not silently tighten or loosen them.

If an internal contradiction with an already-approved architectural invariant is found, report it and STOP.

---

# 4. V1 LAUNCH PLANNING MODEL

Approve the following initial TravelHub V1 planning envelope.

## 4.1 User/load planning assumptions

```text
Registered users planning envelope:          100,000
Monthly active users planning envelope:       25,000
Daily active users planning envelope:          5,000

Normal concurrent active users:                  100
Expected V1 peak concurrent active users:        250
Qualification peak concurrent users:             500
Short burst concurrency:                       1,000
```

These are **planning/qualification envelopes**, not forecasts guaranteed by analytics.

## 4.2 Traffic mix

Approve:

```text
Read operations:                    80%
Write operations:                   20%

Within total request volume, planning sub-envelope:

Authentication/login:               <= 5%
Booking/Order writes:               <= 5%
Payment initiation:                 <= 2%
Other domain writes:                <= 8%
Reads/public/authenticated:          balance
```

These percentages are workload-design authority, not a statement that every run must produce exactly this distribution.

---

# 5. V1 REQUEST-RATE AUTHORITY

Approve:

```text
Expected normal application load:          25 RPS
Expected V1 peak application load:         50 RPS
Qualification sustained target:           100 RPS
Qualification short-burst target:         200 RPS
Future scaling planning target:          1000 RPS
```

Semantics:

- **50 RPS** = expected V1 peak planning target;
- **100 RPS** = Phase 2 qualification sustained target;
- **200 RPS** = short-burst qualification target;
- **1000 RPS** = future scaling planning target only.

Therefore:

```text
qualification headroom over expected V1 peak = 2.0x
```

Do not make 1000 RPS a Phase 2 approval gate.

---

# 6. CONCURRENCY AUTHORITY

Approve:

```text
Normal concurrency:                 100
Expected V1 peak concurrency:       250
Qualification concurrency:          500
Short-burst concurrency:          1,000
```

Qualification does not require linear throughput scaling with concurrency.

Correctness and bounded degradation are mandatory.

---

# 7. HTTP LATENCY SLO — ROUTE CLASSES

All latency targets below apply to TravelHub-controlled processing and the approved qualification environment.

External PSP/network latency is excluded.

## Class A — Public/light reads

Examples:

- public products;
- categories;
- lightweight public lookup endpoints;
- session probe where applicable.

Approve:

```text
p95 <= 300 ms
p99 <= 750 ms
```

## Class B — Authenticated reads

Examples:

- Sales lists;
- CRM customer reads;
- Finance reads;
- ordinary authenticated dashboard/API reads.

Approve:

```text
p95 <= 500 ms
p99 <= 1000 ms
```

## Class C — Ordinary domain writes

Approve:

```text
p95 <= 750 ms
p99 <= 1500 ms
```

## Class D — Concurrency-sensitive domain writes

Includes operations involving transactional guards, lifecycle checks, race protection or equivalent server-side coordination.

Approve:

```text
p95 <= 1000 ms
p99 <= 2000 ms
```

## Class E — `payment.create`

This target measures **TravelHub internal processing only** while the real PSP branch remains blocked.

Approve:

```text
p95 <= 1000 ms
p99 <= 2000 ms
```

Correctness remains more important than latency.

## Class F — Authentication/login

Approve:

```text
p95 <= 750 ms
p99 <= 1500 ms
```

Expected controlled throttle responses are not latency failures.

---

# 8. HTTP RELIABILITY AUTHORITY

Approve the following Phase 2 qualification gates:

```text
Unexpected HTTP 5xx:               0
Unexpected transport failures:     0
Unexpected request timeouts:       0
```

This is a **qualification-run correctness/reliability gate**, not a future production availability percentage/SLA.

Expected scenario-specific responses such as:

```text
400
401
403
404
409
429
```

are not failures when explicitly required by the contract/scenario.

An unexpected controlled status remains a failure.

---

# 9. CORRECTNESS-UNDER-LOAD — ABSOLUTE HARD GATE

Preserve and approve:

```text
duplicate committed Payment facts                = 0
wrong idempotent replay                          = 0
silent divergent replay                          = 0
cross-principal idempotency effect                = 0
duplicate Order/business fact                    = 0
duplicate Commission business fact               = 0
duplicate CommissionAccrual business fact        = 0
lost committed PENDING event                     = 0
poison event blocking unrelated progress         = 0
raw 500 from controlled concurrency/race         = 0
Decimal/money corruption                         = 0
invalid terminal lifecycle transition            = 0
```

Canonical rule:

```text
FAST BUT WRONG = FAIL
```

No latency/throughput result can compensate for a correctness failure.

---

# 10. PAYMENT.CREATE LOAD AUTHORITY

While ADR-0015 / 2.12B remain blocked, qualify only TravelHub-owned payment-initiation processing.

Approve workload envelope:

```text
Expected V1 payment.create peak:          1 RPS
Qualification sustained target:           2 RPS
Qualification burst target:              10 RPS
Qualification concurrent requests:       50
```

Required scenarios:

- unique Idempotency-Key;
- identical retry;
- concurrent identical retry;
- divergent reuse;
- cross-principal isolation;
- stale/recovery behavior where supported by existing harness;
- business-level one-active-payment invariant.

Latency:

```text
p95 <= 1000 ms
p99 <= 2000 ms
```

Correctness:

```text
duplicate committed Payment = 0
wrong replay = 0
raw 500 from controlled race = 0
```

No real PSP call is permitted in this qualification.

---

# 11. BOOKING / ORDER WRITE AUTHORITY

Approve:

```text
Expected combined V1 peak:            3 RPS
Qualification sustained target:       6 RPS
Qualification burst target:          20 RPS
```

Required:

- lifecycle correctness;
- terminal-state protection;
- no duplicate business facts;
- event-chain convergence;
- no lost committed events;
- controlled conflict semantics.

Latency follows Class C/D depending on route semantics.

---

# 12. AUTH / LOGIN AUTHORITY

Approve:

```text
Expected V1 peak login rate:          1 RPS
Qualification login rate:            2 RPS
Short controlled burst:              5 RPS
```

The harness must respect the approved login-throttle contract.

Do not bypass or disable throttling to improve performance numbers.

Required:

- successful auth behavior remains correct;
- invalid auth remains controlled;
- tokenVersion/logout semantics remain correct;
- no raw 500;
- throttle remains fail-safe according to current Step 2.17 contract.

---

# 13. EVENTBUS LOAD AUTHORITY

Approve the following V1 platform qualification targets.

## 13.1 Event generation

```text
Expected steady event generation:       25 events/sec
Expected V1 peak event generation:      50 events/sec
Qualification steady target:           100 events/sec
Qualification burst:                 1,000 events
```

## 13.2 Normal backlog

Approve:

```text
Normal steady-state PENDING backlog:     <= 100 events
Normal oldest PENDING age:               <= 10 sec
```

Short transient backlog above 100 is allowed during an explicit burst/recovery scenario.

## 13.3 Recovery qualification

Seed or create:

```text
Recovery backlog:                     5,000 events
Worker instances:                         2
```

Approve:

```text
Maximum full backlog drain/convergence: <= 120 sec
```

After convergence:

```text
lost committed events = 0
duplicate business effects = 0
poison blocks unrelated events = 0
unexpected retryable residue = 0
```

Known deliberately poisoned/exhausted records may remain only when the scenario explicitly expects them and they are isolated/auditable.

## 13.4 Semantics

Preserve:

```text
at-least-once delivery
+
Inbox / consumer idempotency
```

Never claim exactly-once delivery.

---

# 14. MULTI-INSTANCE QUALIFICATION AUTHORITY

Minimum Phase 2 qualification topology:

```text
Application instances:       2
Outbox worker instances:     2
Shared PostgreSQL:           YES
```

Qualification must exercise, where harness supports it:

- concurrent HTTP traffic;
- concurrent payment.create;
- EventBus worker competition;
- retryable FAILED recovery;
- PENDING delivery;
- Inbox deduplication;
- logout/tokenVersion behavior.

The existing per-instance login-throttle limitation is not to be silently redesigned in this step.

Do not claim linear horizontal scaling.

---

# 15. BURST AUTHORITY

Approve:

```text
HTTP burst target:             200 RPS
Burst duration:                 60 sec
Burst concurrency ceiling:    1,000
```

During burst:

- correctness hard gates remain absolute;
- unexpected 5xx = 0;
- transport failure = 0;
- unexpected timeout = 0.

Latency may degrade relative to steady-state targets, but approve the burst ceilings:

```text
Class A/B burst p99 <= 2000 ms
Class C–F burst p99 <= 3000 ms
```

After burst, backlog and latency must converge without manual cleanup.

---

# 16. SOAK AUTHORITY

The previous 30-second run is harness validation only.

Approve final Phase 2 soak:

```text
Duration:                       30 minutes
Sustained application load:     50 RPS
Concurrency:                    250
```

Required during/after soak:

- unexpected 5xx = 0;
- unexpected timeout/transport failure = 0;
- correctness violations = 0;
- no continuously growing EventBus backlog;
- no unrecovered retryable FAILED accumulation;
- no obvious unbounded memory-growth pattern;
- no database corruption;
- cleanup succeeds.

Because full production observability/APM is not yet established, do not make unsupported claims about leak absence. Report process memory start/peak/end if harness can already obtain it without adding runtime dependencies; otherwise record this metric as `NOT MEASURED — OBSERVABILITY LIMITATION`.

Do not modify production code merely to obtain it in this pass.

---

# 17. STRESS AUTHORITY

Stress remains **characterization, not Phase 2 approval gate**.

Permitted exploratory ceiling:

```text
up to 500 RPS
and/or
up to 2,000 concurrent requests
```

provided the isolated environment remains safe.

Stress must stop on:

- correctness violation;
- DB safety concern;
- uncontrolled failure cascade;
- inability to clean up;
- target/environment guard failure.

No requirement exists to reach 500 RPS.

No production-capacity claim may be made from stress results.

---

# 18. QUALIFICATION ENVIRONMENT AUTHORITY

For Phase 2 final qualification approve:

```text
Environment class:
DEDICATED ISOLATED PERFORMANCE ENVIRONMENT
```

Acceptable implementation:

- dedicated local/perf host or dedicated CI/perf runner;
- isolated PostgreSQL database;
- canonical migrations;
- production Nest path;
- no production customer data;
- deterministic synthetic dataset;
- no canonical/prod DB target;
- environment metadata captured.

The final report must record at minimum:

- OS;
- CPU model/count where available;
- RAM;
- Node version;
- PostgreSQL version;
- database name class/redacted safe identifier;
- application instance count;
- worker instance count;
- relevant worker interval/batch;
- dataset size;
- run profile;
- commit SHA.

This environment is sufficient for **Phase 2 platform qualification**, but is **not production capacity certification**.

Future pre-launch staging/prod-like qualification may be required separately.

---

# 19. DATASET AUTHORITY

Approve a deterministic synthetic representative dataset with at least:

```text
Users:                    >= 1,000
Products/service units:   >= 500 total representative records
Customers/CRM entities:   >= 1,000
Sales/quotes records:     >= 1,000
Booking/Order chains:     >= 1,000
Payment-capable orders:   >= 500
Finance/ledger records:   >= 5,000
EventBus seed capability: >= 5,000 events
```

If the domain model does not map one-to-one to a named row above, use the nearest canonical domain entity and document the mapping.

Do not create fake production schema concepts just to satisfy a count.

---

# 20. QUALIFICATION PROFILE AUTHORITY

Approve the following final sequence:

```text
1. SAFE-TARGET / ENVIRONMENT VALIDATION
2. DATASET PREPARATION
3. SMOKE
4. WARM-UP — 5 min
5. STEADY — 15 min @ 50 RPS
6. QUALIFICATION PEAK — 15 min @ 100 RPS
7. BURST — 60 sec @ 200 RPS
8. PAYMENT.CREATE CONCURRENCY/IDEMPOTENCY
9. BOOKING/ORDER WRITE PROFILE
10. EVENTBUS STEADY/PEAK/BURST
11. EVENTBUS RECOVERY — 5,000 backlog / 2 workers
12. MULTI-INSTANCE PROFILE
13. SOAK — 30 min @ 50 RPS
14. POST-RUN CORRECTNESS VALIDATION
15. CLEANUP VALIDATION
```

Stress characterization may run separately and must not replace qualification.

---

# 21. RELEASE REGRESSION TOLERANCE

Approve for repeated qualification on materially comparable environments:

```text
p95 regression > 20%       = investigate / qualification warning
p99 regression > 25%       = investigate / qualification warning
throughput regression >20% = investigate / qualification warning
```

These are **regression investigation thresholds**, not automatic product SLO failure if absolute approved SLOs still pass.

Any correctness regression remains immediate FAIL regardless of percentage.

---

# 22. FUTURE SCALING TARGET — PLANNING ONLY

Record separately:

```text
Future planning throughput:           1,000 RPS
Future planning concurrency:          5,000
Future payment-initiation planning:      20 RPS
Future EventBus planning:               500 events/sec
```

These values:

- are not Phase 2 blockers;
- are not current capacity claims;
- do not require Step 2.17B harness to pass them;
- exist to prevent architecture decisions from assuming V1 load is the permanent ceiling.

Future scaling work may include:

- distributed rate limiting;
- PostgreSQL pool/capacity work;
- read replicas where justified;
- caching where justified;
- worker partitioning/scaling;
- observability/APM;
- provider/webhook scaling;
- infrastructure autoscaling.

Do not implement these now.

---

# 23. PSP PERFORMANCE SUBSET — REMAINS DEFERRED

Hard preserve:

```text
ADR-0015 = PROPOSED — BLOCKED
2.12B = BLOCKED
```

Therefore:

```text
real PSP API latency target          = DEFERRED
PSP webhook burst target             = DEFERRED
provider callback convergence        = DEFERRED
provider rate-limit qualification    = DEFERRED
Apple Pay provider performance       = DEFERRED
Google Pay provider performance      = DEFERRED
provider settlement performance      = DEFERRED
provider payout performance          = DEFERRED
```

Unlock only after:

```text
ADR-0015 ACCEPTED
+
provider/aggregator commercial agreement
+
2.12B runtime
+
sandbox/contract evidence
```

Do not select or simulate a production PSP.

---

# 24. STEP 2.17A SEPARATION

Do not merge performance authority with DR authority.

Preserve separately:

```text
PostgreSQL RPO <= 1h
PostgreSQL RTO <= 4h
Media RPO <= 24h
Media RTO <= 8h
```

Those are Step 2.17A targets and are not performance latency SLOs.

---

# 25. STEP 2.17C SEPARATION

`sales.service.ts` structural debt remains owned by Step 2.17C.

This pass must not:

- refactor Sales;
- split service classes;
- change transaction boundaries;
- optimize Sales queries;
- introduce caches;
- add indexes solely for performance.

If final qualification later exposes a Sales bottleneck, record measured evidence and route it to the proper owner.

---

# 26. STEP 2.18 / RLS SEPARATION

Do not start:

- RLS;
- ADR-0014 implementation;
- Phase 2 exit verification;
- Step 2.18.

This pass is authority/documentation only.

---

# 27. CANONICAL AUTHORITY MATRIX

Update the canonical matrix so it contains at least the following approved values:

| Metric | Authority |
|---|---:|
| Registered-user planning envelope | 100,000 |
| MAU planning envelope | 25,000 |
| DAU planning envelope | 5,000 |
| Normal concurrency | 100 |
| Expected V1 peak concurrency | 250 |
| Qualification concurrency | 500 |
| Burst concurrency | 1,000 |
| Expected normal RPS | 25 |
| Expected V1 peak RPS | 50 |
| Qualification sustained RPS | 100 |
| Qualification burst RPS | 200 |
| Qualification headroom | 2.0x |
| Future scaling RPS | 1,000 |
| Read/write mix | 80/20 |
| Public/light read p95/p99 | 300/750 ms |
| Authenticated read p95/p99 | 500/1000 ms |
| Ordinary write p95/p99 | 750/1500 ms |
| Concurrency-sensitive write p95/p99 | 1000/2000 ms |
| payment.create p95/p99 | 1000/2000 ms |
| Login p95/p99 | 750/1500 ms |
| Unexpected 5xx | 0 |
| Unexpected timeout | 0 |
| Unexpected transport failure | 0 |
| payment.create expected peak | 1 RPS |
| payment.create qualification | 2 RPS |
| payment.create burst | 10 RPS |
| payment.create concurrency | 50 |
| Booking/Order expected peak | 3 RPS |
| Booking/Order qualification | 6 RPS |
| Booking/Order burst | 20 RPS |
| Login expected peak | 1 RPS |
| Login qualification | 2 RPS |
| Login burst | 5 RPS |
| EventBus expected steady | 25 ev/s |
| EventBus expected peak | 50 ev/s |
| EventBus qualification steady | 100 ev/s |
| EventBus burst | 1,000 events |
| Normal PENDING backlog | <=100 |
| Normal oldest PENDING age | <=10 sec |
| Recovery backlog | 5,000 events |
| Recovery workers | 2 |
| Recovery max drain | <=120 sec |
| App instances | 2 |
| Worker instances | 2 |
| HTTP burst duration | 60 sec |
| Soak | 30 min @ 50 RPS / concurrency 250 |
| Peak qualification duration | 15 min @ 100 RPS |
| Steady qualification duration | 15 min @ 50 RPS |
| Warm-up | 5 min |
| Future scaling concurrency | 5,000 |
| Future payment planning | 20 RPS |
| Future EventBus planning | 500 ev/s |
| PSP performance subset | DEFERRED |

For each row also record:

- status = `APPROVED` / `DEFERRED`;
- authority owner;
- rationale;
- measurement method;
- whether it is V1 launch / qualification / future planning.

---

# 28. AUTHORITY OWNERS

Use the following ownership:

```text
Business/Product:
- V1 user envelope
- traffic demand
- concurrency
- route latency expectations
- payment/order/login demand

Business/Product + Operations:
- qualification headroom
- burst envelope

Operations/Engineering:
- EventBus operational targets
- recovery target
- qualification environment
- instance topology
- soak profile

Engineering/Operations:
- release regression tolerance
- measurement method
- correctness verification

Provider/Commercial + Engineering:
- PSP subset — DEFERRED
```

---

# 29. REQUIRED DOCUMENTATION CHANGES

Update only documentation/provenance artifacts required by this authority decision.

At minimum:

```text
docs/architecture/load-performance-qualification-2.17B.md
docs/operations/load-performance-qualification-runbook.md
docs/prompts/TravelHub_CANONICAL_IMPLEMENTATION_ROADMAP_v3.md
```

Create:

```text
docs/prompts/PHASE_2_STEP_2.17B_QUANTITATIVE_TARGETS_AUTHORITY_DECISION_REPORT.md
```

If the canonical Roadmap filename/path differs, use repository truth.

Do not duplicate canonical docs unnecessarily.

---

# 30. ROADMAP STATUS AFTER SUCCESSFUL AUTHORITY PASS

If all supplied values can be reconciled without architectural contradiction, update Step 2.17B truthfully to an equivalent of:

```text
🚧 HARNESS IMPLEMENTED —
QUANTITATIVE SLO/LOAD AUTHORITY APPROVED —
WAITING FOR FINAL QUALIFICATION
```

Also record:

```text
Step 2.17B APPROVED = NO
Final qualification = NOT STARTED
Strict Review = NOT STARTED
```

Do not mark the step completed/approved merely because targets now exist.

---

# 31. REQUIRED DECISION REPORT

The report must contain, at minimum:

1. mode;
2. repository truth;
3. provenance baseline;
4. prior Verdict B;
5. authority source;
6. semantic separation;
7. V1 user/load envelope;
8. request-rate targets;
9. concurrency targets;
10. traffic mix;
11. qualification headroom;
12. latency classes;
13. reliability gates;
14. correctness gates;
15. payment.create targets;
16. Booking/Order targets;
17. auth/login targets;
18. EventBus targets;
19. backlog/age targets;
20. recovery target;
21. multi-instance topology;
22. burst target;
23. soak target;
24. stress characterization;
25. environment authority;
26. dataset authority;
27. qualification sequence;
28. regression tolerance;
29. future scaling;
30. PSP deferral;
31. Step 2.17A separation;
32. Step 2.17C separation;
33. Step 2.18/RLS separation;
34. canonical authority matrix;
35. authority ownership;
36. contradictions/findings;
37. Roadmap update;
38. negative checks;
39. artifact integrity;
40. persistence;
41. Repository Evidence footer;
42. release;
43. NEXT;
44. HARD STOP confirmation.

---

# 32. ARTIFACT-INTEGRITY CHECK

Run:

- checker regression;
- actual canonical Roadmap artifact checker.

Required:

```text
WARN = 0
FAIL = 0
```

Report actual PASS count.

Do not silently repair unrelated gaps.

If a new unrelated integrity gap is found, leave it visible and report it separately.

---

# 33. NEGATIVE CHECKS

Explicitly verify and report:

```text
production backend code changed = 0
frontend changed = 0
schema changed = 0
migrations changed = 0
CI changed = 0
performance harness changed = 0
performance tuning performed = 0
indexes added/changed = 0
worker interval/batch changed = 0
Prisma pool tuning = 0
cache added = 0
production load executed = 0
final qualification executed = 0
strict review started = 0
SLO derived from localhost measurements = 0
production capacity claim = 0
PSP selected = 0
real PSP network = 0
PSP performance target invented = 0
2.12B started = 0
2.12I started = 0
2.17C started = 0
sales.service refactor started = 0
2.18 started = 0
RLS implemented = 0
deployment/release performed = 0
```

---

# 34. GIT DISCIPLINE

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

Never use:

```bash
git add .
git add -A
```

Stage only exact files belonging to this pass.

Example:

```bash
git add docs/architecture/load-performance-qualification-2.17B.md
git add docs/operations/load-performance-qualification-runbook.md
git add docs/prompts/TravelHub_CANONICAL_IMPLEMENTATION_ROADMAP_v3.md
git add docs/prompts/PHASE_2_STEP_2.17B_QUANTITATIVE_TARGETS_AUTHORITY_DECISION_REPORT.md
```

Use actual canonical paths if they differ.

Inspect:

```bash
git diff --cached --stat
git diff --cached
git diff --cached --check
```

---

# 35. COMMIT

Suggested decision commit:

```bash
git commit -m "docs(perf): approve phase 2.17B quantitative targets"
```

After commit, populate the Repository Evidence footer with real values.

If that requires a second docs-only commit:

```bash
git add docs/prompts/PHASE_2_STEP_2.17B_QUANTITATIVE_TARGETS_AUTHORITY_DECISION_REPORT.md
git commit -m "docs(perf): record phase 2.17B authority provenance"
```

Do not fabricate final SHA inside the first commit.

---

# 36. PUSH

Push:

```bash
git push
```

Then verify:

```bash
git rev-parse HEAD
git rev-parse --verify @{u}
git status --short
```

`push_status: PUSHED` is allowed only if:

```text
final HEAD == upstream
```

Otherwise report the exact truth.

---

# 37. REPOSITORY EVIDENCE FOOTER

Populate with actual values only:

```text
REPOSITORY EVIDENCE

repository:
branch:
authority_base_sha:
previous_authority_decision_sha:
harness_implementation_sha:
quantitative_authority_commit_sha:
provenance_footer_commit_sha:
final_head_sha:
upstream_sha:
push_status:
worktree_clean:
migration_count:
artifact_integrity:
checker_regression:
step_2_17_state:
step_2_17a_state:
step_2_17b_state:
step_2_17c_state:
step_2_18_state:
payment_branch_state:
adr_0015_state:
v1_launch_target_state:
qualification_target_state:
future_scaling_target_state:
psp_performance_subset:
final_qualification_state:
strict_review_state:
reviewed_state:
persistence_status:
release_status:
```

Never invent SHA/counts/status.

---

# 38. RELEASE

This pass is documentation/authority only.

Required:

```text
RELEASE: NOT APPLICABLE — QUANTITATIVE AUTHORITY DECISION
```

Do not deploy.

---

# 39. SUCCESS VERDICT

If repository reconciliation succeeds, final output should truthfully resemble:

```text
TRAVELHUB STEP 2.17B QUANTITATIVE TARGETS AUTHORITY DECISION COMPLETED —
VERDICT A — V1 PLATFORM SLO/LOAD TARGETS APPROVED —
FINAL QUALIFICATION UNBLOCKED

Decision:
- verdict: A — QUANTITATIVE AUTHORITY APPROVED
- Step 2.17B: NOT APPROVED
- harness: IMPLEMENTED
- quantitative authority: APPROVED
- final qualification: NOT STARTED
- strict review: NOT STARTED

V1 planning:
- registered users: 100,000
- MAU: 25,000
- DAU: 5,000
- normal concurrency: 100
- expected peak concurrency: 250
- qualification concurrency: 500
- burst concurrency: 1,000
- read/write mix: 80/20

Load:
- expected normal: 25 RPS
- expected V1 peak: 50 RPS
- qualification sustained: 100 RPS
- qualification burst: 200 RPS
- headroom: 2.0x
- future scaling planning: 1,000 RPS

Latency:
- public/light reads p95/p99: 300/750 ms
- authenticated reads: 500/1000 ms
- ordinary writes: 750/1500 ms
- concurrency-sensitive writes: 1000/2000 ms
- payment.create: 1000/2000 ms
- login: 750/1500 ms

Reliability:
- unexpected 5xx: 0
- unexpected timeout: 0
- unexpected transport failure: 0

Payment:
- expected peak: 1 RPS
- qualification: 2 RPS
- burst: 10 RPS
- concurrency: 50
- duplicate committed Payment: 0

EventBus:
- expected steady/peak: 25/50 ev/s
- qualification steady: 100 ev/s
- burst: 1,000 events
- normal backlog: <=100
- oldest normal PENDING: <=10 sec
- recovery backlog: 5,000
- recovery workers: 2
- max drain: <=120 sec
- semantics: at-least-once + Inbox/consumer idempotency

Qualification:
- app instances: 2
- worker instances: 2
- warm-up: 5 min
- steady: 15 min @ 50 RPS
- peak: 15 min @ 100 RPS
- burst: 60 sec @ 200 RPS
- soak: 30 min @ 50 RPS / concurrency 250
- environment: dedicated isolated performance environment

Future scaling:
- 1,000 RPS / 5,000 concurrency
- planning only — not Phase 2 gate

PSP:
- provider-dependent subset: DEFERRED
- ADR-0015: BLOCKED
- real PSP network: 0

Artifact integrity:
- PASS=<actual>
- WARN=0
- FAIL=0

Persistence:
- branch: <actual>
- authority commit: <sha>
- provenance/footer commit: <sha>
- final HEAD/upstream: <sha>
- push_status: PUSHED

RELEASE: NOT APPLICABLE — QUANTITATIVE AUTHORITY DECISION

NEXT:
PHASE 2 — STEP 2.17B —
FINAL QUALIFICATION AGAINST APPROVED TARGETS
```

---

# 40. CONTRADICTION VERDICT

If any supplied target contradicts an already-approved architectural invariant or cannot be represented without changing runtime behavior, do not silently modify the target or code.

Return:

```text
TRAVELHUB STEP 2.17B QUANTITATIVE TARGETS AUTHORITY DECISION BLOCKED —
ARCHITECTURAL CONTRADICTION FOUND

- conflicting target:
- conflicting persisted invariant:
- evidence:
- code changes performed: 0
- authority values silently changed: 0

NEXT: EXPLICIT AUTHORITY / ARCHITECTURE RECONCILIATION
```

---

# 41. HARD STOP

After:

1. repository verification;
2. authority reconciliation;
3. canonical matrix update;
4. architecture/runbook/Roadmap update;
5. decision report;
6. artifact checker;
7. negative checks;
8. exact-file staging;
9. commit;
10. provenance footer;
11. push;
12. final HEAD/upstream verification;

**STOP.**

Do NOT:

- run final performance qualification;
- tune production code;
- modify the harness;
- add indexes;
- change worker configuration;
- change Prisma pooling;
- refactor Sales;
- start 2.17C;
- start 2.18/RLS;
- select a PSP;
- implement 2.12B;
- implement 2.12I;
- perform real PSP/network tests;
- start Strict Review;
- mark Step 2.17B APPROVED;
- deploy/release.

The only valid successful NEXT is:

```text
PHASE 2 — STEP 2.17B —
FINAL QUALIFICATION AGAINST APPROVED TARGETS
```
