# PHASE 2 — STEP 2.17B — SLO / LOAD AUTHORITY DECISION — REPORT

## 1. Status

**VERDICT B — PARTIAL AUTHORITY.** Correctness-under-load and HTTP-reliability gates are
approved (repository contract invariants, not business demand). Every quantitative V1
load/latency/duration target remains `TBD — BUSINESS/PRODUCT/OPERATIONS AUTHORITY
REQUIRED` with a named owner. Invented values = 0. Step 2.17B remains **NOT APPROVED**.
Final qualification against approved targets is **BLOCKED where material** (all quantitative
rows are material).

## 2. Methodology

Repository-first. Baseline verified via `git status/branch/rev-parse/log`; canonical
Roadmap Step 2.17B line read; Step 2.17A RPO/RTO authority decision inspected (and excluded
from performance SLOs per §23 of the decision prompt); design doc, runbook, harness
implementation report, `backend/src/perf/` and ADR-0015 state verified. Repo-wide searches
performed for approved numbers: `k6/artillery/autocannon/wrk/vegeta/jmeter/locust/gatling/
benchmark/load-test/stress-test/soak/SLO/SLA/Apdex` and `concurrent users/MAU/DAU/requests
per user/expected peak RPS/headroom/soak duration/launch/go-live`. Result: **0 approved
quantitative performance targets anywhere in the repository** (docs/, docs/commercial/,
docs/contracts/, docs/operations/, docs/adr/). Authority therefore cannot be fabricated by
engineering (§4 of decision prompt). Correctness gates are approved because they are
already-established repository contracts (2.10A/2.12H/2.17 e2e + unit evidence), not new
business demand.

## 3. Repository evidence (verified)

- Branch `master`, HEAD == upstream == `2282521` (harness implementation terminal SHA,
  push verified).
- Step 2.17 = APPROVED; Step 2.17A = APPROVED WITH REVIEW FIXES; Step 2.17B = HARNESS
  IMPLEMENTED / NOT APPROVED; Step 2.17C = NOT STARTED; Step 2.18 = NOT STARTED;
  2.12A / 2.12H = APPROVED; 2.12B = BLOCKED (commercial confirmation); ADR-0015 =
  PROPOSED/BLOCKED; 2.12I = DEFERRED.
- Harness implementation SHA `5baa743`; provenance `acdfab1` → terminal `2282521`.
- Migrations 58/58, drift 0 (last verified at harness implementation).
- Untracked prompt files preserved, untouched.

## 4. Harness state

Dependency-free Node harness `backend/src/perf/` (run.ts + 11 lib modules, 31 unit tests)
is IMPLEMENTED and live-validated (SMOKE 367 req/s, BASELINE 235 req/s, PAYCREATE 7 facts/8
orders 0 raw 500, EVENTBUS 250→250 drain 1335 ms, BURST ~1544 req/s, SOAK 30 s ~320 req/s —
all localhost, isolated DB, correctness hard gates PASS). These are **harness evidence only**.

## 5. Authority owners

Authority for quantitative V1 targets belongs to **Business + Product + Operations/Platform**.
Engineering supplies feasibility evidence (harness + exploratory profiles) but must NOT
invent business demand. Each TBD row below names its owner. No owner confirmed any number in
this pass; therefore no number is approved.

## 6. Semantic model (four distinct concepts)

```text
1. V1 LAUNCH TARGET      = TBD — BUSINESS AUTHORITY REQUIRED
2. QUALIFICATION TARGET  = TBD — BUSINESS/PRODUCT AUTHORITY REQUIRED (includes headroom)
3. FUTURE SCALING TARGET = planning-only, non-blocking (§23 of report)
4. OBSERVED MEASUREMENT  = harness evidence only (localhost exploratory)
```

`exploratory localhost measurement ≠ approved SLO ≠ production capacity ≠ V1 launch
requirement ≠ future scaling target` — preserved.

## 7. V1 assumptions (business load model)

All TBD — BUSINESS/PRODUCT AUTHORITY REQUIRED (no repository evidence exists):

- registered users at launch; MAU/DAU;
- normal and peak concurrent active users;
- requests per active user per minute; read/write mix;
- booking/order creation rate; payment-initiation rate; login/auth rate;
- operational/admin traffic; EventBus amplification;
- geographic assumptions (RU/AZ/EN); launch growth horizon.

Not inferred from benchmark throughput (§4 of decision prompt).

## 8. Formulas (structure only — no numbers)

```text
average_rps       = daily_active_users × requests_per_user_per_minute / 60
peak_rps          = peak_concurrent_users × requests_per_active_user_per_minute / 60 × peak_factor
burst_rps         = peak_rps × burst_factor
normal_concurrency = average active sessions
peak_concurrency   = approved peak concurrent users
read_rps / write_rps = peak_rps × read_mix / peak_rps × write_mix
payment_create_rps / order_write_rps = per-formula demand from launch model
event_generation_rate = derived from write-rate × amplification
```

Structure only. Every variable is TBD until authority supplies the business inputs.

## 9. Headroom

`expected V1 peak × approved headroom = qualification target`. Headroom factor is
`TBD — BUSINESS/PRODUCT + OPERATIONS AUTHORITY REQUIRED`; it must be justified
independently of measured localhost spare capacity (not derived from ~1544 req/s BURST).

## 10. SLI catalog (authoritative V1 SLIs to be decided)

HTTP latency; throughput/load; unexpected 5xx; timeout/transport failure; correctness
under controlled conflicts; auth/login behavior; payment.create + external idempotency;
Booking/Order correctness; Finance correctness; EventBus backlog/age/drain; FAILED/poison
behavior; multi-instance safety; soak stability; worker interruption/recovery.
Status: catalog adopted; numeric targets TBD per row below.

## 11. Route latency classes

A. public/light reads — p95/p99 TBD (Business/Product)
B. authenticated reads — p95/p99 TBD (Business/Product)
C. ordinary domain writes — p95/p99 TBD (Business/Product)
D. concurrency-sensitive writes — p95/p99 TBD (Business/Product)
E. payment.create — p95/p99 TBD (Business/Product; PSP latency excluded)
F. auth/login — p95/p99 TBD (Business/Product)
G. background convergence (non-HTTP) — TBD (Operations/Engineering)

p50 informational; max diagnostic unless made authoritative. p95/p99 approved? **NO.**

## 12. Reliability targets

Approved as contract gate (repository-established, not business demand):

- unexpected 5xx = 0 (qualification failure on any unexplained 5xx)
- timeout / transport failure = 0 in qualification scenarios
- expected 400/401/403/404/409/429 are NOT reliability failures when scenario semantics
  expect them; unexpected controlled statuses remain failures.

## 13. Correctness — ABSOLUTE (approved)

Zero-tolerance gates, already repository contracts (2.10A/2.12H/2.17 e2e + unit evidence):

- duplicate committed Payment = 0; wrong idempotent replay = 0; silent divergent replay = 0;
  cross-principal effect = 0; duplicate Order/business fact from race or retry = 0;
  duplicate Commission/CommissionAccrual fact = 0; lost committed PENDING event = 0;
  poison blocking unrelated progress = 0; raw 500 from controlled race = 0;
  Decimal corruption = 0; invalid terminal lifecycle transition = 0.

Fast-but-wrong = FAIL. Load results can never weaken correctness.

## 14. Payment.create authority

TravelHub-owned boundary only: expected V1 peak initiation rate = TBD (Business/Product);
qualification rate/concurrency = TBD; identical retry profile = TBD; divergent reuse
profile = TBD; p95/p99 = TBD; unexpected 5xx = 0 (contract); duplicate Payment = 0
(contract); wrong replay = 0 (contract). Real PSP latency excluded.

## 15. PSP performance — HARD DEFERRED

`ADR-0015 BLOCKED + 2.12B BLOCKED`. No provider API/webhook/callback/rate-limit/Apple
Pay/Google Pay/settlement/payout targets invented. Canonical:
`PSP PERFORMANCE SUBSET = DEFERRED UNTIL ADR-0015 ACCEPTED + 2.12B RUNTIME + PROVIDER
SANDBOX/CONTRACT EVIDENCE`.

## 16. Booking / Order authority

Booking/Order correctness gates approved as contract (CAS lifecycle, 0 duplicate Order,
0 invalid terminal transition). Quantitative creation-rate targets = TBD (Business/Product).

## 17. Finance authority

Finance correctness gates approved as contract (Decimal exact, 0 duplicate Commission/
Accrual, frozen historical facts not regenerated by mutable policy). Quantitative finance
read/write rates = TBD (Business/Product).

## 18. EventBus authority

Semantics preserved: `at-least-once + Inbox/consumer idempotency` (never exactly-once).
Correctness gates approved (lost committed event = 0; duplicate business effect = 0; poison
blocking unrelated progress = 0). Quantitative: steady rate TBD, peak rate TBD, burst size
TBD, normal PENDING backlog TBD, backlog age TBD, recovery backlog TBD, max drain/convergence
time TBD, retryable FAILED expectations TBD, multi-instance profile TBD — all
Operations/Engineering + Business.

## 19. Recovery profile

Worker outage duration / seeded backlog / instance count / max convergence time / FAILED
residue / post-drain correctness — all TBD (Operations). Canonical worker batch/interval
(2000 ms / 100) preserved; no silent tuning.

## 20. Multi-instance

Minimum qualification (2 app + 2 worker instances, shared PostgreSQL, concurrent
payment.create, concurrent EventBus, logout/tokenVersion, per-instance login-throttle
limitation) adopted as required scenario matrix. Instance counts for final qualification =
TBD (Operations). Linear scaling NOT claimed.

## 21. Burst / soak / stress

Burst demand/duration/latency-degradation/recovery = TBD. Soak: prior 30 s run = harness
validation only; real Phase-2 soak duration = TBD (Operations) with memory/backlog/DB
stability + post-soak correctness. Stress = characterization unless explicitly promoted;
safe ceiling/abort/recovery required, destructive failure not required.

## 22. Dataset / mix / durations

Synthetic dataset requirements (users/products/customers/quotes/bookings/orders/payments/
finance/outbox/inbox) adopted; read/write/auth/payment/EventBus mix = TBD (Business/Product);
warm-up/steady/peak/burst/recovery/soak durations = TBD (Operations); cold-start scope = TBD.

## 23. Capacity semantics / future scaling (non-blocking)

Planning-only: 12-month traffic growth, horizontal scaling, worker scaling, DB read
replicas, caching, distributed rate limiting, observability/APM, PSP/webhook scaling.
None are Phase 2 gates unless separately approved.

## 24. Qualification environment

Local isolated DB is the only environment used so far (harness validation). Final
qualification environment (local isolated | dedicated CI/perf runner | staging/pre-prod |
production-like) = TBD — OPERATIONS AUTHORITY REQUIRED. Localhost is never production proof.

## 25. PSP deferral (explicit)

`STEP 2.17B-PSP` remains deferred; dependency = ADR-0015 ACCEPTED + 2.12B runtime +
provider sandbox. 0 provider performance work implemented.

## 26. Separations

Not absorbed: 2.17A RPO/RTO (backup domain — separate authority, APPROVED there); ADR-0014/
RLS (2.18); 2.17C Sales decomposition (evidence may be recorded if qualification exposes
slowness, but 2.17C NOT started); PSP selection/integration (2.12B).

## 27. Canonical authority table

| # | Metric | Decision | Owner | Rationale / measurement |
|---|---|---|---|---|
| 1 | expected V1 peak RPS | TBD | Business/Product | no demand model in repo; load harness |
| 2 | qualification peak RPS | TBD | Business/Product + Operations | headroom × #1; harness |
| 3 | qualification headroom | TBD | Business/Product + Operations | independent of localhost spare |
| 4 | normal/peak/burst concurrency | TBD | Business/Product | harness concurrency |
| 5 | read/write mix | TBD | Business/Product | harness route matrix |
| 6 | public read p95/p99 | TBD | Business/Product | harness latency percentiles |
| 7 | authenticated read p95/p99 | TBD | Business/Product | harness latency percentiles |
| 8 | ordinary write p95/p99 | TBD | Business/Product | harness latency percentiles |
| 9 | concurrency-sensitive write p95/p99 | TBD | Business/Product | harness latency percentiles |
| 10 | payment.create p95/p99 | TBD | Business/Product | harness paycreate scenario |
| 11 | login p95/p99 | TBD | Business/Product | harness login probe |
| 12 | unexpected 5xx | APPROVED = 0 | Engineering (contract) | repo-wide e2e gate |
| 13 | timeout/transport failure | APPROVED = 0 | Engineering (contract) | repo-wide e2e gate |
| 14 | burst duration | TBD | Business/Product | harness burst profile |
| 15 | soak duration | TBD | Operations | 30 s validation ≠ endurance |
| 16 | EventBus steady/peak rate | TBD | Operations/Engineering | eventbus-recovery scenario |
| 17 | EventBus burst | TBD | Operations/Engineering | burst PENDING seeding |
| 18 | max normal backlog | TBD | Operations/Engineering | backlog observation |
| 19 | max backlog age | TBD | Operations/Engineering | backlog age metric |
| 20 | recovery backlog | TBD | Operations/Engineering | recovery scenario |
| 21 | max recovery drain time | TBD | Operations/Engineering | drain timing (1335 ms = evidence only) |
| 22 | app/worker instance count | TBD | Operations | multi-instance scenario |
| 23 | dataset size/class | TBD | Business/Product | SMALL/REPRESENTATIVE/STRESS labels |
| 24 | qualification environment | TBD | Operations | local-only so far |
| 25 | release regression tolerance | TBD | Engineering/Operations | baseline/regression model |

## 28. Rationale per approved number

Only the `0` values are approved: they are existing repository contracts (every e2e suite
asserts 0 unexpected 5xx; correctness invariants enforced by DB unique constraints + CAS +
digest idempotency slots), not newly chosen business targets. No other number is approved.

## 29. TBDs with named owners

Rows 1–11, 14–25 in §27: each names an owner. Final qualification is blocked where these
are material — which is all quantitative rows. No blocker waived.

## 30. Verdict

**B — PARTIAL AUTHORITY.** Approved: correctness-under-load + reliability contract gates.
TBD: all material quantitative V1 targets, with named authority owners. Invented values = 0.
Final qualification blocked on explicit authority. Step 2.17B NOT APPROVED.

## 31. Roadmap update

Step 2.17B line updated to truthful state:
`🚧 SLO/LOAD AUTHORITY DECISION — VERDICT B (PARTIAL) — QUANTITATIVE TARGETS TBD
(BUSINESS/PRODUCT/OPERATIONS) — FINAL QUALIFICATION BLOCKED ON AUTHORITY`.
NOT APPROVED; PSP subset deferred; 2.17C/2.18 untouched.

## 32. Negative checks

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

## 33. Artifact integrity

Checker regression + real Roadmap checker: see §37 footer value (PASS=… WARN=0 FAIL=0).

## 34. Persistence

See the evidence footer at the end of this report.

## 35. Repository Evidence

See the evidence footer at the end of this report.

## 36. Release

`RELEASE: NOT APPLICABLE — AUTHORITY / DOCUMENTATION DECISION`. No deployment.

## 37. NEXT

`PHASE 2 — STEP 2.17B — FINAL QUALIFICATION AGAINST APPROVED TARGETS` after
Business/Product/Operations authority approves the quantitative matrix in §27. Until then
final qualification remains blocked and Step 2.17B stays NOT APPROVED.

## 38. Final statement

Verdict B is the honest outcome: engineering verified (repo-wide) that no quantitative
authority exists, recorded every target as TBD with a named owner, approved only the
contract-level correctness/reliability gates, and invented zero numbers. The canonical
four-concept semantic (V1 launch ≠ qualification ≠ future scaling ≠ observed measurement)
is preserved. No production claim, no tuning, no PSP work, no next-step execution.

---

REPOSITORY EVIDENCE

repository: travelhub_v1
branch: master
head: 2282521
origin: 2282521
worktree_clean: true (of my changes)
migration_count: 58
reviewed_state: AUTHORITY DECISION
reviewed_diff_base: 2282521
reviewed_diff_head: c51f080
persistence_status: PERSISTED
persistence_sha: c51f080
authority_base_sha: 2282521
authority_decision_commit_sha: c51f080
provenance_footer_commit_sha: 1aafcda
final_head_sha: 1aafcda
upstream_sha: 1aafcda
push_status: PUSHED
harness_state: IMPLEMENTED (backend/src/perf/, 31 unit tests)
harness_implementation_sha: 5baa743
slo_authority_verdict: B — PARTIAL AUTHORITY
v1_launch_target_state: TBD — BUSINESS AUTHORITY REQUIRED
qualification_target_state: TBD — BUSINESS/PRODUCT AUTHORITY REQUIRED
future_scaling_target_state: PLANNING ONLY — NON-BLOCKING
psp_performance_subset: DEFERRED until ADR-0015 ACCEPTED + 2.12B runtime + provider sandbox
step_2_17b_state: SLO/LOAD AUTHORITY DECISION — VERDICT B — NOT APPROVED
step_2_17c_state: PLANNED — NOT STARTED
step_2_18_state: PLANNED — NOT STARTED
release_status: NOT APPLICABLE
