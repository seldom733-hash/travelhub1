# PHASE 2 — STEP 2.17B — QUANTITATIVE TARGETS AUTHORITY DECISION — REPORT

## 1. Mode

**BUSINESS / PRODUCT / OPERATIONS AUTHORITY DECISION · DOCUMENTATION-ONLY · NO
IMPLEMENTATION · NO TUNING · NO FINAL QUALIFICATION · NO STRICT REVIEW · NO PSP INVENTION ·
COMMIT/PUSH/PROVENANCE REQUIRED · HARD STOP.**

This pass supplies the quantitative authority previously recorded as missing (prior Verdict
B — PARTIAL AUTHORITY, Step 2.17B SLO/Load Authority Decision).

## 2. Repository truth (independently verified)

- Branch `master`, HEAD == upstream == `63bd376` (previous authority-decision terminal SHA,
  push verified).
- Step 2.17 = APPROVED; Step 2.17A = APPROVED WITH REVIEW FIXES; Step 2.17B = HARNESS
  IMPLEMENTED / prior VERDICT B / NOT APPROVED; Step 2.17C = NOT STARTED; Step 2.18 =
  NOT STARTED.
- 2.12A / 2.12H = APPROVED; 2.12B = BLOCKED (commercial confirmation); ADR-0015 =
  PROPOSED/BLOCKED; 2.12I = DEFERRED.
- Harness implementation SHA `5baa743`; prior SLO/load authority decision SHA `c51f080`
  (provenance `1aafcda`, terminal `63bd376`).
- Migrations 58/58, drift 0 (verified at harness implementation). Untracked prompt files
  preserved, untouched.
- No material discrepancy found with the expected state in the decision prompt §1.

## 3. Provenance baseline

See the evidence footer at the end of this report (real SHAs/counts only).

## 4. Prior Verdict B (blocker)

The previous pass (report
`docs/prompts/PHASE_2_STEP_2.17B_SLO_LOAD_AUTHORITY_DECISION_REPORT.md`) recorded
VERDICT B — PARTIAL AUTHORITY: contract-level correctness/reliability gates approved,
every quantitative target `TBD — BUSINESS/PRODUCT/OPERATIONS AUTHORITY REQUIRED`, final
qualification blocked where material, 0 numbers invented by engineering. This pass resolves
that blocker with explicit owner-approved values.

## 5. Authority source

The quantitative values in this report are supplied as an explicit **TravelHub V1
Business/Product/Operations authority decision** (decision prompt
`PHASE_2_STEP_2.17B_QUANTITATIVE_TARGETS_AUTHORITY_DECISION.md`). They are planning and
qualification targets, not derived from localhost benchmark results, not claims about
current production capacity, and not to be silently tightened or loosened.

## 6. Semantic separation

```text
APPROVED BUSINESS TARGET ≠ OBSERVED HARNESS MEASUREMENT ≠ VERIFIED CAPABILITY
≠ PRODUCTION CAPACITY CLAIM ≠ FUTURE SCALING TARGET
```

Observed harness evidence (SMOKE ~367 req/s, BASELINE ~235 req/s, BURST ~1544 req/s,
SOAK ~320 req/s, EventBus ~187 ev/s — localhost, isolated DB) remains evidence only and
was NOT used to derive authority values.

## 7. V1 user / load planning envelope

| Metric | Value |
|---|---|
| Registered users planning envelope | 100,000 |
| MAU planning envelope | 25,000 |
| DAU planning envelope | 5,000 |
| Normal concurrent active users | 100 |
| Expected V1 peak concurrent users | 250 |
| Qualification peak concurrent users | 500 |
| Short burst concurrency | 1,000 |

Planning/qualification envelopes, not analytics-guaranteed forecasts.

## 8. Request-rate targets

| Metric | Value | Kind |
|---|---|---|
| Expected normal application load | 25 RPS | V1 planning |
| Expected V1 peak application load | 50 RPS | V1 planning |
| Qualification sustained target | 100 RPS | Phase 2 qualification |
| Qualification short-burst target | 200 RPS | Phase 2 qualification |
| Future scaling planning target | 1,000 RPS | planning only — NOT a Phase 2 gate |

## 9. Concurrency targets

Normal 100 / expected V1 peak 250 / qualification 500 / short-burst 1,000. Qualification
does not require linear throughput scaling with concurrency; correctness and bounded
degradation are mandatory.

## 10. Traffic mix

Reads 80% / writes 20%. Within total volume: auth/login <= 5%, booking/order writes <= 5%,
payment initiation <= 2%, other domain writes <= 8%, reads (public/authenticated) = balance.
Workload-design authority, not a per-run exact distribution requirement.

## 11. Qualification headroom

`expected V1 peak 50 RPS × 2.0x headroom = qualification sustained 100 RPS`. Headroom is
approved independently of measured localhost spare capacity. (2.0x is internally consistent:
100/50.)

## 12. Latency SLO per route class (TravelHub-controlled; PSP latency excluded)

| Class | p95 | p99 |
|---|---|---|
| A — public/light reads | <= 300 ms | <= 750 ms |
| B — authenticated reads | <= 500 ms | <= 1000 ms |
| C — ordinary domain writes | <= 750 ms | <= 1500 ms |
| D — concurrency-sensitive writes | <= 1000 ms | <= 2000 ms |
| E — payment.create (internal processing) | <= 1000 ms | <= 2000 ms |
| F — auth/login | <= 750 ms | <= 1500 ms |

p50 informational; max diagnostic. Correctness more important than latency (Class E).

## 13. Reliability gates

Unexpected HTTP 5xx = 0; unexpected transport failures = 0; unexpected request timeouts =
0. Qualification-run correctness/reliability gates, NOT a future production availability
SLA. Expected scenario-specific 400/401/403/404/409/429 are not failures when explicitly
required by contract; an unexpected controlled status remains a failure.

## 14. Correctness-under-load — absolute hard gate

duplicate committed Payment facts = 0; wrong idempotent replay = 0; silent divergent
replay = 0; cross-principal idempotency effect = 0; duplicate Order/business fact = 0;
duplicate Commission business fact = 0; duplicate CommissionAccrual business fact = 0;
lost committed PENDING event = 0; poison event blocking unrelated progress = 0; raw 500
from controlled concurrency/race = 0; Decimal/money corruption = 0; invalid terminal
lifecycle transition = 0. **FAST BUT WRONG = FAIL.**

## 15. payment.create targets

While ADR-0015 / 2.12B remain blocked, qualify only TravelHub-owned processing: expected
V1 peak 1 RPS; qualification sustained 2 RPS; qualification burst 10 RPS; qualification
concurrent requests 50. Required scenarios: unique Idempotency-Key, identical retry,
concurrent identical retry, divergent reuse, cross-principal isolation, stale/recovery
behavior where supported, business one-active-payment invariant. Latency p95 <= 1000 ms /
p99 <= 2000 ms. Correctness: duplicate committed Payment = 0, wrong replay = 0, raw 500
from controlled race = 0. No real PSP call permitted in this qualification.

## 16. Booking / Order targets

Expected combined V1 peak 3 RPS; qualification sustained 6 RPS; qualification burst
20 RPS. Required: lifecycle correctness, terminal-state protection, no duplicate business
facts, event-chain convergence, no lost committed events, controlled conflict semantics.
Latency per Class C/D.

## 17. Auth / login targets

Expected V1 peak 1 RPS; qualification 2 RPS; short controlled burst 5 RPS. The harness
respects the approved per-instance in-memory login-throttle contract (10/15 min, Step 2.17)
using distinct synthetic users; the throttle is NOT bypassed or disabled to improve
numbers. Required: successful auth correct, invalid auth controlled, tokenVersion/logout
semantics correct, no raw 500, throttle fail-safe per Step 2.17 contract.

## 18. EventBus targets

Expected steady generation 25 ev/s; expected V1 peak 50 ev/s; qualification steady
100 ev/s; qualification burst 1,000 events. Semantics preserved: at-least-once delivery +
Inbox/consumer idempotency; exactly-once NEVER claimed.

## 19. Backlog / age targets

Normal steady-state PENDING backlog <= 100 events; normal oldest PENDING age <= 10 s.
Short transient backlog above 100 allowed only during an explicit burst/recovery scenario.

## 20. Recovery target

Seed/create recovery backlog 5,000 events; worker instances 2; maximum full backlog
drain/convergence <= 120 s. Post-convergence: lost committed events = 0, duplicate business
effects = 0, poison blocks unrelated events = 0, unexpected retryable residue = 0.
Deliberately poisoned/exhausted records may remain only when the scenario explicitly
expects them and they are isolated/auditable.

Feasibility note (not authority): worker batch 100 / interval 2 s per instance × 2
instances ≈ 100 ev/s combined → 5,000 / 100 ≈ 50 s < 120 s; measured evidence (250 events
→ 1,335 ms drain, ~187 ev/s) is consistent. Target stands as supplied.

## 21. Multi-instance topology

Minimum Phase 2 qualification: application instances 2, outbox worker instances 2, shared
PostgreSQL YES. Exercise (where harness supports): concurrent HTTP traffic, concurrent
payment.create, EventBus worker competition, retryable FAILED recovery, PENDING delivery,
Inbox deduplication, logout/tokenVersion. Existing per-instance login-throttle limitation
is NOT silently redesigned in this step. Linear horizontal scaling is NOT claimed.

## 22. Burst target

HTTP burst target 200 RPS; duration 60 s; concurrency ceiling 1,000. During burst:
correctness hard gates absolute, unexpected 5xx = 0, transport failure = 0, unexpected
timeout = 0. Latency may degrade: Class A/B burst p99 <= 2000 ms; Class C–F burst p99 <=
3000 ms. After burst, backlog and latency converge without manual cleanup.

## 23. Soak target

Final Phase 2 soak: duration 30 minutes, sustained application load 50 RPS, concurrency
250. (Prior 30-second run = harness validation only.) Required during/after: unexpected
5xx = 0, unexpected timeout/transport failure = 0, correctness violations = 0, no
continuously growing EventBus backlog, no unrecovered retryable FAILED accumulation, no
obvious unbounded memory-growth pattern, no DB corruption, cleanup succeeds. Process memory
start/peak/end reported if the harness can obtain it without new runtime dependencies;
otherwise `NOT MEASURED — OBSERVABILITY LIMITATION` (no production-code change for this
pass). Full production observability/APM is not yet established — no unsupported leak-absence
claims.

## 24. Stress characterization

Stress remains characterization, NOT a Phase 2 approval gate. Permitted exploratory ceiling:
up to 500 RPS and/or up to 2,000 concurrent requests, provided the isolated environment
remains safe. Stop on: correctness violation, DB safety concern, uncontrolled failure
cascade, inability to clean up, target/environment guard failure. No requirement to reach
500 RPS; no production-capacity claim from stress results.

## 25. Environment authority

Dedicated isolated performance environment (dedicated local/perf host or dedicated CI/perf
runner), isolated PostgreSQL, canonical migrations, production Nest path, no production
customer data, deterministic synthetic dataset, no canonical/prod DB target, environment
metadata captured (OS, CPU model/count, RAM, Node version, PostgreSQL version, DB name
class/redacted identifier, app instance count, worker instance count, worker
interval/batch, dataset size, run profile, commit SHA). Sufficient for Phase 2 platform
qualification; NOT production capacity certification; future pre-launch staging/prod-like
qualification may be required separately.

## 26. Dataset authority

Deterministic synthetic representative dataset: Users >= 1,000; Products/service units >=
500; Customers/CRM >= 1,000; Sales/quotes >= 1,000; Booking/Order chains >= 1,000;
Payment-capable orders >= 500; Finance/ledger records >= 5,000; EventBus seed capability
>= 5,000 events. Nearest canonical domain entity mapping documented per run; no fake
production schema concepts created to satisfy counts.

## 27. Qualification sequence

1. safe-target / environment validation
2. dataset preparation
3. SMOKE
4. warm-up — 5 min
5. steady — 15 min @ 50 RPS
6. qualification peak — 15 min @ 100 RPS
7. burst — 60 s @ 200 RPS
8. payment.create concurrency/idempotency
9. booking/order write profile
10. EventBus steady/peak/burst
11. EventBus recovery — 5,000 backlog / 2 workers
12. multi-instance profile
13. soak — 30 min @ 50 RPS
14. post-run correctness validation
15. cleanup validation

Stress characterization may run separately and must not replace qualification.

## 28. Regression tolerance

Repeated qualification on materially comparable environments: p95 regression > 20% =
investigate / warning; p99 regression > 25% = investigate / warning; throughput regression
> 20% = investigate / warning. Investigation thresholds, NOT automatic product SLO failure
when absolute approved SLOs still pass. Any correctness regression = immediate FAIL
regardless of percentage.

## 29. Future scaling (planning only)

Future planning: 1,000 RPS throughput, 5,000 concurrency, 20 payment-initiation RPS,
500 EventBus ev/s. Not Phase 2 blockers, not current capacity claims, harness not required
to pass them. Candidate future work (NOT implemented now): distributed rate limiting,
PostgreSQL pool/capacity, read replicas where justified, caching where justified, worker
partitioning/scaling, observability/APM, provider/webhook scaling, infrastructure
autoscaling.

## 30. PSP deferral

Hard preserved: ADR-0015 = PROPOSED/BLOCKED, 2.12B = BLOCKED. Deferred: real PSP API
latency, PSP webhook burst, provider callback convergence, provider rate-limit
qualification, Apple Pay / Google Pay provider performance, provider settlement
performance, provider payout performance. Unlock only after ADR-0015 ACCEPTED + provider/
aggregator commercial agreement + 2.12B runtime + sandbox/contract evidence. No PSP
selected or simulated.

## 31. Step 2.17A separation

Not merged: PostgreSQL RPO <= 1h, PostgreSQL RTO <= 4h, Media RPO <= 24h, Media RTO <= 8h
— Step 2.17A DR targets, not performance latency SLOs.

## 32. Step 2.17C separation

`sales.service.ts` structural debt remains owned by Step 2.17C. This pass does NOT refactor
Sales, split service classes, change transaction boundaries, optimize Sales queries,
introduce caches, or add indexes solely for performance. If final qualification later
exposes a Sales bottleneck, measured evidence is routed to the proper owner.

## 33. Step 2.18 / RLS separation

RLS, ADR-0014 implementation, Phase 2 exit verification, Step 2.18 — NOT started. This pass
is authority/documentation only.

## 34. Canonical authority matrix

Canonical location: `docs/architecture/load-performance-qualification-2.17B.md` §33.
All rows below are APPROVED (unless marked DEFERRED). Owner and measurement per §35/§28.

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
| Future scaling RPS | 1,000 (planning only) |
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
| Normal PENDING backlog | <= 100 |
| Normal oldest PENDING age | <= 10 s |
| Recovery backlog | 5,000 events |
| Recovery workers | 2 |
| Recovery max drain | <= 120 s |
| App instances | 2 |
| Worker instances | 2 |
| HTTP burst duration | 60 s |
| Soak | 30 min @ 50 RPS / concurrency 250 |
| Peak qualification duration | 15 min @ 100 RPS |
| Steady qualification duration | 15 min @ 50 RPS |
| Warm-up | 5 min |
| Future scaling concurrency | 5,000 (planning only) |
| Future payment planning | 20 RPS (planning only) |
| Future EventBus planning | 500 ev/s (planning only) |
| PSP performance subset | DEFERRED |

## 35. Authority ownership

Business/Product: V1 user envelope, traffic demand, concurrency, route latency
expectations, payment/order/login demand. Business/Product + Operations: qualification
headroom, burst envelope. Operations/Engineering: EventBus operational targets, recovery
target, qualification environment, instance topology, soak profile. Engineering/Operations:
release regression tolerance, measurement method, correctness verification.
Provider/Commercial + Engineering: PSP subset — DEFERRED.

## 36. Contradictions / findings

Reconciliation against approved architectural invariants found **no contradiction**:

- login throttle (per-instance in-memory 10/15 min, Step 2.17 contract) vs login targets
  1/2/5 RPS — compatible; harness uses distinct synthetic users and does not bypass/disable
  the throttle;
- EventBus worker batch 100 / interval 2 s per instance vs recovery 5,000 events / 2
  workers / <= 120 s — feasible (≈ 100 ev/s combined; measured drain evidence consistent);
- payment.create per-order business idempotency + P2002→409 vs concurrency 50 — compatible;
- headroom 2.0x internally consistent (100/50);
- soak/warm-up durations are harness-configurable — no runtime change needed.

Findings: none blocking. Observability limitation (process memory metrics) recorded as
`NOT MEASURED — OBSERVABILITY LIMITATION` unless the existing harness can provide it
without new runtime dependencies.

## 37. Roadmap update

Step 2.17B updated to truthful state:
`🚧 HARNESS IMPLEMENTED — QUANTITATIVE SLO/LOAD AUTHORITY APPROVED — WAITING FOR FINAL
QUALIFICATION — NOT APPROVED`. Step 2.17B APPROVED = NO; final qualification = NOT STARTED;
strict review = NOT STARTED; PSP subset DEFERRED; 2.17C/2.18/RLS untouched.

## 38. Negative checks

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

## 39. Artifact integrity

Checker regression 13/13; real Roadmap checker: PASS=… WARN=0 FAIL=0 (see footer).

## 40. Persistence

See evidence footer at the end of this report.

## 41. Evidence footer

See evidence footer at the end of this report.

## 42. Release

`RELEASE: NOT APPLICABLE — QUANTITATIVE AUTHORITY DECISION`. No deployment.

## 43. NEXT

`PHASE 2 — STEP 2.17B — FINAL QUALIFICATION AGAINST APPROVED TARGETS` (only valid
successful next step). Final qualification NOT STARTED in this pass; Step 2.17B remains
NOT APPROVED.

## 44. HARD STOP confirmation

Repository verification, authority reconciliation, canonical matrix update, architecture/
runbook/Roadmap updates, decision report, artifact checker, negative checks, exact-file
staging, commit, provenance footer, push, HEAD/upstream verification — completed. Final
qualification, tuning, harness modification, indexes, worker/pool changes, Sales refactor,
2.17C, 2.18/RLS, PSP selection, 2.12B/2.12I, real PSP/network tests, strict review, Step
2.17B approval, deployment — NOT performed. **STOP.**

---

REPOSITORY EVIDENCE

repository: travelhub_v1
branch: master
head: 63bd376
origin: 63bd376
worktree_clean: true (of my changes)
migration_count: 58
reviewed_state: AUTHORITY DECISION
reviewed_diff_base: 63bd376
reviewed_diff_head: 60ead9a
persistence_status: PERSISTED
persistence_sha: 60ead9a
authority_base_sha: 63bd376
previous_authority_decision_sha: c51f080
harness_implementation_sha: 5baa743
quantitative_authority_commit_sha: 60ead9a
provenance_footer_commit_sha: 4d2c3c6
final_head_sha: 4d2c3c6
upstream_sha: 4d2c3c6
push_status: PUSHED
step_2_17_state: APPROVED
step_2_17a_state: APPROVED WITH REVIEW FIXES
step_2_17b_state: HARNESS IMPLEMENTED — QUANTITATIVE AUTHORITY APPROVED — NOT APPROVED
step_2_17c_state: PLANNED — NOT STARTED
step_2_18_state: PLANNED — NOT STARTED
payment_branch_state: 2.12A/2.12H APPROVED; 2.12B BLOCKED; 2.12I DEFERRED
adr_0015_state: PROPOSED — BLOCKED
v1_launch_target_state: APPROVED (envelope 100k/25k/5k; peak 250 concurrent; 50 RPS)
qualification_target_state: APPROVED (100 RPS sustained, 200 RPS burst, 500 concurrent, 2.0x headroom)
future_scaling_target_state: PLANNING ONLY — NON-BLOCKING (1,000 RPS / 5,000 concurrent / 20 pay RPS / 500 ev/s)
psp_performance_subset: DEFERRED until ADR-0015 ACCEPTED + 2.12B runtime + provider sandbox
final_qualification_state: NOT STARTED — UNBLOCKED
strict_review_state: NOT STARTED
release_status: NOT APPLICABLE
