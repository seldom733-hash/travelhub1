# PHASE 2 — STEP 2.17B — SLO / LOAD AUTHORITY DECISION

## 0. MODE

**AUTHORITY DECISION · REPOSITORY-FIRST · BUSINESS/PRODUCT/OPERATIONS TARGETS · NO IMPLEMENTATION · NO PERFORMANCE TUNING · NO FINAL QUALIFICATION · NO STRICT REVIEW · NO PSP INVENTION · COMMIT/PUSH/PROVENANCE REQUIRED · HARD STOP**

This pass establishes quantitative platform performance authority before final qualification of Step 2.17B.

Canonical rule:

```text
exploratory localhost measurement
≠ approved SLO
≠ production capacity
≠ V1 launch requirement
≠ future scaling target
```

The existing exploratory results (~367 req/s SMOKE, ~235 req/s BASELINE, ~1544 req/s BURST, ~320 req/s SOAK, ~187 EventBus ev/s) are **HARNESS EVIDENCE ONLY**. Never derive authority mechanically from them.

## 1. VERIFY REPOSITORY TRUTH

Independently verify persisted state before edits:

- Step 2.17 = APPROVED
- Step 2.17A = APPROVED
- Step 2.17B = HARNESS IMPLEMENTED / NOT APPROVED
- Step 2.17C = NOT STARTED
- Step 2.18 = NOT STARTED
- 2.12A / 2.12H = APPROVED
- 2.12B = BLOCKED
- ADR-0015 = PROPOSED/BLOCKED
- 2.12I = DEFERRED

Read Roadmap, `docs/architecture/load-performance-qualification-2.17B.md`,
`docs/operations/load-performance-qualification-runbook.md`, the 2.17B design reconciliation and harness implementation reports, actual `backend/src/perf/`, Step 2.17/2.17A strict-review reports, and ADR-0015 state.

Repository code/artifacts are authority; do not trust summaries blindly.

## 2. BASELINE / PROVENANCE

Run and record:

```bash
git status --short
git branch --show-current
git rev-parse HEAD
git rev-parse --verify @{u} 2>/dev/null || true
git log --oneline --decorate -40
git diff
```

Record branch, base HEAD, upstream, worktree, migration count, artifact-integrity baseline, harness implementation SHA. Preserve unrelated untracked prompts.

## 3. FOUR DISTINCT CONCEPTS — HARD RULE

Keep separate:

1. **V1 LAUNCH TARGET** — minimum approved performance for initial launch.
2. **QUALIFICATION TARGET** — concrete workload used to qualify V1, normally including explicit headroom.
3. **FUTURE SCALING TARGET** — planning target, not a Phase 2 blocker unless explicitly promoted.
4. **OBSERVED MEASUREMENT** — evidence from a specific run/environment, never authority by itself.

## 4. AUTHORITY OWNERS

Authority belongs to Business + Product + Operations/Platform. Engineering supplies feasibility evidence but must not invent business demand.

If required assumptions cannot responsibly be decided, mark each:
`TBD — BUSINESS/PRODUCT/OPERATIONS AUTHORITY REQUIRED`
and return Verdict B/C. Do not invent numbers merely to unblock Roadmap.

## 5. REQUIRED V1 BUSINESS LOAD MODEL

Approve or explicitly leave TBD:

- registered users at launch;
- MAU / DAU;
- normal and peak concurrent active users;
- requests per active user/minute;
- read/write mix;
- booking/order creation rate;
- payment-initiation rate;
- login/auth rate;
- operational/admin traffic;
- EventBus amplification;
- geographic assumptions;
- launch growth horizon.

Do not infer these from benchmark throughput.

## 6. FORMULAS

Document formulas translating business demand into:

```text
average_rps
peak_rps
burst_rps
normal_concurrency
peak_concurrency
read_rps
write_rps
payment_create_rps
order_write_rps
event_generation_rate
```

Example structure only, not authority:

`peak_rps = peak_concurrent_users × requests_per_active_user_per_minute / 60 × peak_factor`

## 7. QUALIFICATION HEADROOM

Approve an explicit headroom factor:

`expected V1 peak × approved headroom = qualification target`

Justify it independently of measured localhost spare capacity.

## 8. SLI CATALOG

Decide authoritative V1 SLIs:

- HTTP latency;
- throughput/load;
- unexpected 5xx;
- timeout/transport failure;
- correctness under controlled conflicts;
- auth/login behavior;
- payment.create + external idempotency;
- Booking/Order correctness;
- Finance correctness;
- EventBus backlog/age/drain;
- FAILED/poison behavior;
- multi-instance safety;
- soak stability;
- worker interruption/recovery.

## 9. ROUTE LATENCY CLASSES

Do not use one SLO for all routes. Define at least:

A. public/light reads  
B. authenticated reads  
C. ordinary domain writes  
D. concurrency-sensitive writes  
E. `payment.create`  
F. auth/login  
G. background convergence (non-HTTP)

For HTTP classes approve p95 and p99. p50 may be informational; max is diagnostic unless explicitly made authoritative.

Create a canonical table with target, load profile, authority owner and decision status.

## 10. RELIABILITY TARGETS

Approve separately:

- unexpected 5xx rate;
- timeout rate;
- transport failure rate.

Expected 400/401/403/404/409/429 are not server reliability failures when scenario semantics expect them. Unexpected controlled statuses remain failures.

## 11. CORRECTNESS IS ABSOLUTE

Performance must never weaken correctness. Preserve zero-tolerance gates where repository contracts support them:

- duplicate committed Payment = 0;
- wrong idempotent replay = 0;
- silent divergent replay = 0;
- cross-principal effect = 0;
- duplicate Order/business fact from race/retry = 0;
- duplicate Commission/CommissionAccrual business fact = 0;
- lost committed PENDING event = 0;
- poison blocking unrelated progress = 0;
- raw 500 from controlled race = 0;
- Decimal corruption = 0;
- invalid terminal lifecycle transition = 0.

Fast-but-wrong = FAIL.

## 12. PAYMENT.CREATE AUTHORITY

Approve TravelHub-owned processing targets only:

- expected V1 peak initiation rate;
- qualification rate/concurrency;
- identical retry profile;
- divergent reuse profile;
- p95/p99;
- unexpected 5xx;
- duplicate Payment = 0;
- wrong replay = 0.

Real PSP latency is excluded.

## 13. PSP PERFORMANCE — HARD DEFERRED

Preserve:

`ADR-0015 BLOCKED + 2.12B BLOCKED`.

Do not invent targets for provider API/webhook/callback/rate limits/Apple Pay/Google Pay/settlement/payout.

Canonical status:

`PSP PERFORMANCE SUBSET = DEFERRED UNTIL ADR-0015 ACCEPTED + 2.12B RUNTIME + PROVIDER SANDBOX/CONTRACT EVIDENCE`

## 14. EVENTBUS AUTHORITY

Approve:

- steady event rate;
- peak event rate;
- burst size;
- acceptable normal PENDING backlog;
- acceptable normal backlog age;
- recovery backlog scenario;
- maximum drain/convergence time;
- retryable FAILED expectations;
- poison isolation;
- multi-instance worker profile.

Preserve `at-least-once + Inbox/consumer idempotency`; never claim exactly-once.

Correctness: lost committed event = 0; duplicate business effect = 0; poison blocking unrelated progress = 0.

## 15. RECOVERY PROFILE

Approve concrete scenario:

- worker outage duration and/or seeded backlog;
- backlog at resume;
- worker instance count;
- canonical worker batch/interval (no silent tuning);
- max convergence time;
- acceptable FAILED residue;
- post-drain correctness.

## 16. MULTI-INSTANCE

Approve minimum qualification, considering at least:

- 2 app instances;
- 2 worker instances;
- shared PostgreSQL;
- concurrent payment.create;
- concurrent EventBus processing;
- logout/tokenVersion;
- current per-instance login-throttle limitation.

Do not claim linear scaling.

## 17. BURST / SOAK / STRESS

Approve burst demand, duration, allowed latency degradation, reliability and recovery.

Approve a real Phase-2 soak duration/load and distinguish it from the prior 30s harness validation. Define memory/backlog/DB stability and post-soak correctness.

Stress is characterization unless explicitly promoted to launch gate. Define safe ceiling, abort conditions and required recovery; do not require destructive failure.

## 18. QUALIFICATION ENVIRONMENT

Choose and document acceptable final qualification environment:

A. local isolated  
B. dedicated CI/perf runner  
C. staging/pre-production  
D. production-like

Record limitations. Never present localhost as production proof.

Specify PostgreSQL version/isolation, migrations, dataset, pool/config metadata, app/worker counts and machine metadata.

## 19. DATASET / MIX / DURATIONS

Approve synthetic dataset requirements for relevant users/products/customers/quotes/bookings/orders/payments/finance/outbox/inbox.

Approve read/write/auth/payment/EventBus mix.

Approve:

- warm-up;
- steady measurement;
- peak;
- burst;
- recovery;
- soak.

Clarify cold-start scope.

## 20. FINAL QUALIFICATION VERDICT MODEL

Define:

```text
CORRECTNESS = PASS/FAIL
HTTP_LATENCY = PASS/FAIL
HTTP_RELIABILITY = PASS/FAIL
THROUGHPUT_LOAD = PASS/FAIL
EVENTBUS = PASS/FAIL
RECOVERY = PASS/FAIL
MULTI_INSTANCE = PASS/FAIL
SOAK = PASS/FAIL
PSP_SUBSET = DEFERRED
```

Overall platform qualification passes only if every required non-deferred gate passes.

## 21. REQUIRED CANONICAL AUTHORITY TABLE

At minimum include rows for:

- expected V1 peak RPS;
- qualification peak RPS;
- qualification headroom;
- normal/peak/burst concurrency;
- read/write mix;
- public read p95/p99;
- authenticated read p95/p99;
- ordinary write p95/p99;
- concurrency-sensitive write p95/p99;
- payment.create p95/p99;
- login p95/p99;
- unexpected 5xx;
- timeout/transport failure;
- burst duration;
- soak duration;
- EventBus steady/peak rate;
- EventBus burst;
- max normal backlog;
- max backlog age;
- recovery backlog;
- max recovery drain time;
- app/worker instance count;
- dataset size/class;
- qualification environment.

Every row: `APPROVED | TBD | DEFERRED | NOT APPLICABLE`, authority owner, rationale, measurement method.

## 22. FUTURE SCALING — NON-BLOCKING

Create a distinct planning section for later growth: 12-month traffic, horizontal scaling, worker scaling, DB scaling/read replicas, caching, distributed rate limiting, observability/APM, PSP/webhook scaling.

Do not turn these into Phase 2 gates unless explicitly approved.

## 23. SEPARATION FROM OTHER STEPS

Do not absorb:

- Step 2.17A RPO/RTO into performance SLOs;
- ADR-0014/RLS work (Step 2.18);
- Step 2.17C Sales decomposition;
- PSP selection/integration.

If later qualification exposes Sales slowness, record evidence; do not silently start 2.17C.

## 24. NO IMPLEMENTATION / TUNING

This is docs/authority only. Do not change backend/frontend/schema/migrations/CI/harness/indexes/query shapes/pools/worker config/rate limiter.

Forbidden: reverse-engineering targets around current implementation, adding indexes, increasing pools, changing worker batch/interval, caching, weakening validation.

## 25. DECISION VERDICTS

**A — AUTHORITY APPROVED:** all material V1 platform quantitative targets approved. NEXT = Final Qualification.

**B — PARTIAL AUTHORITY:** some targets approved, material TBDs remain with named authority owners. Final qualification blocked where material.

**C — AUTHORITY NOT AVAILABLE:** responsible quantitative authority cannot be established. Invented values = 0.

## 26. REQUIRED DOC UPDATES

Update:

- `docs/architecture/load-performance-qualification-2.17B.md`
- `docs/operations/load-performance-qualification-runbook.md`
- canonical Roadmap

Create:

`docs/prompts/PHASE_2_STEP_2.17B_SLO_LOAD_AUTHORITY_DECISION_REPORT.md`

Report must contain at least: status; repository evidence; harness state; authority owners; semantic model; V1 assumptions; formulas; headroom; SLI catalog; latency/reliability targets; correctness; payment; Booking/Order; Finance; EventBus; recovery; multi-instance; burst/soak/stress; dataset/mix/durations; environment; capacity semantics; future scaling; PSP deferral; separations; canonical authority table; rationale per number; TBDs; verdict; Roadmap update; negative checks; artifact integrity; persistence; Repository Evidence; release; NEXT.

## 27. ROADMAP STATE

If Verdict A, use truthful equivalent:

`🚧 HARNESS IMPLEMENTED — SLO/LOAD AUTHORITY APPROVED — WAITING FOR FINAL QUALIFICATION`

Do **not** mark Step 2.17B APPROVED.

If B/C, record exact blocker/authority owner.

## 28. ARTIFACT INTEGRITY

Run checker regression and real Roadmap checker. Required:

`WARN=0, FAIL=0`

Report actual PASS count. Do not silently repair unrelated gaps.

## 29. NEGATIVE CHECKS

Explicitly report:

```text
production code changed = 0
frontend changed = 0
schema/migrations changed = 0
CI changed = 0
performance harness changed = 0
production load executed = 0
final qualification executed = 0
performance tuning = 0
index/worker tuning = 0
SLO mechanically derived from localhost = 0
production capacity claim = 0
PSP selected = 0
real PSP network = 0
provider targets invented = 0
Step 2.17B marked APPROVED = 0
Step 2.17C started = 0
Step 2.18 started = 0
RLS implemented = 0
sales.service refactor started = 0
```

## 30. GIT / COMMIT / PUSH

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

Never `git add .` or `git add -A`. Stage exact docs only; inspect cached diff.

For Verdict A suggested commit:

`git commit -m "docs(perf): approve phase 2.17B SLO and load authority"`

For B/C use truthful non-approval message.

Push and verify:

```bash
git push
git rev-parse HEAD
git rev-parse --verify @{u}
git status --short
```

Claim PUSHED only if final HEAD == upstream.

## 31. REPOSITORY EVIDENCE FOOTER

Populate real values:

```text
repository:
branch:
authority_base_sha:
authority_decision_commit_sha:
provenance_footer_commit_sha:
final_head_sha:
upstream_sha:
push_status:
worktree_clean:
migration_count:
artifact_integrity:
harness_state:
harness_implementation_sha:
slo_authority_verdict:
v1_launch_target_state:
qualification_target_state:
future_scaling_target_state:
psp_performance_subset:
step_2_17b_state:
step_2_17c_state:
step_2_18_state:
reviewed_state:
persistence_status:
release_status:
```

Never fabricate SHA/counts.

## 32. RELEASE

`RELEASE: NOT APPLICABLE — AUTHORITY / DOCUMENTATION DECISION`

No deployment.

## 33. SUCCESS OUTPUT — VERDICT A

```text
TRAVELHUB STEP 2.17B SLO/LOAD AUTHORITY DECISION COMPLETED —
V1 PLATFORM PERFORMANCE TARGETS APPROVED —
FINAL QUALIFICATION REQUIRED

Decision:
- verdict: A — AUTHORITY APPROVED
- Step 2.17B: NOT APPROVED
- harness: IMPLEMENTED
- final qualification: NOT STARTED
- strict review: NOT STARTED

V1 load authority:
- expected peak RPS: <approved>
- qualification peak RPS: <approved>
- normal/peak/burst concurrency: <approved>
- read/write mix: <approved>
- qualification headroom: <approved>

Latency:
- public/read p95/p99: <approved>
- authenticated read p95/p99: <approved>
- ordinary write p95/p99: <approved>
- concurrency-sensitive write p95/p99: <approved>
- payment.create p95/p99: <approved>
- login p95/p99: <approved>

Reliability:
- unexpected 5xx: <approved>
- timeout/transport: <approved>

EventBus:
- steady/peak/burst: <approved>
- backlog/age: <approved>
- recovery backlog/max drain: <approved>
- semantic: at-least-once + Inbox idempotency

Correctness:
- duplicate Payment = 0
- wrong replay = 0
- duplicate Order/business effect = 0
- lost committed event = 0
- raw 500 from controlled race = 0
- Decimal corruption = 0

Qualification:
- environment/dataset/durations: <approved>
- app/worker instances: <approved>

PSP:
- provider-dependent subset: DEFERRED
- real PSP network: 0

Artifact integrity:
- PASS=<actual> WARN=0 FAIL=0

Persistence:
- branch: <actual>
- decision commit: <sha>
- provenance/footer commit: <sha>
- final HEAD/upstream: <sha>
- push_status: PUSHED

RELEASE: NOT APPLICABLE
NEXT: PHASE 2 — STEP 2.17B — FINAL QUALIFICATION AGAINST APPROVED TARGETS
```

## 34. PARTIAL/BLOCKED OUTPUT

```text
TRAVELHUB STEP 2.17B SLO/LOAD AUTHORITY DECISION INCOMPLETE —
FINAL QUALIFICATION BLOCKED ON EXPLICIT AUTHORITY

Decision:
- verdict: B/C
- approved targets: <actual>
- unresolved targets: <actual>
- authority owner for each: <actual>
- invented values: 0
- Step 2.17B: NOT APPROVED
- final qualification: NOT STARTED

NEXT: BUSINESS/PRODUCT/OPERATIONS AUTHORITY DECISION
```

## 35. HARD STOP

After repository verification, authority decision, V1/qualification/future separation, PSP deferral, docs/report/Roadmap update, artifact check, exact staging, commit, push and provenance verification — **STOP**.

Do not run final qualification, tune code/DB/worker, approve 2.17B, start Strict Review, start 2.17C/2.18/RLS, select PSP, implement PSP/webhook performance, or deploy.
