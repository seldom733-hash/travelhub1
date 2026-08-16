# Load & Performance Qualification — Step 2.17B (Authority / Design Reconciliation)

> STATUS: HARNESS IMPLEMENTATION COMPLETED (2026-08-16) — EXPLORATORY BASELINE MEASURED.
> Final qualification against approved SLO/load targets still requires authority;
> Step 2.17B remains NOT APPROVED.

## 1. Purpose

Define what Step 2.17B (Load & Performance Qualification) will measure, against which
approved targets, on which environment, with which correctness invariants — so the later
implementation pass builds a harness, datasets, workloads and pass/fail rules instead of
improvising them. This document is the repository-backed contract for that implementation.

## 2. Scope / Non-scope

### In scope (platform baseline — executable now)

- Auth/read/write API baseline: health/session, login, authenticated read/list, Sales reads,
  Booking read/write, Order lifecycle write, Finance reads, public catalog/storefront reads.
- Payment-initiation boundary owned by TravelHub: validation, auth/RBAC, external
  Idempotency-Key handling, `PaymentService` persistence — with the TEST-ONLY fake provider
  where explicitly test-scoped. Never represented as production PSP performance.
- EventBus: outbox PENDING delivery, retryable FAILED backlog, poison isolation, multi-instance
  worker, backlog drain, recovery after downtime.
- External idempotency: unique keys, identical retries, divergent reuse, concurrent identical/
  divergent.
- Concurrency-sensitive writes: last-slot availability guard, checkout reservation, Booking
  transitions, payment create under idempotency.
- Correctness-under-load invariants (hard gate — a fast but incorrect system FAILS).

### Out of scope now

- PSP-dependent performance subset (`STEP 2.17B-PSP`): real acquiring/card authorization
  latency, Apple Pay / Google Pay provider latency, webhook capacity/burst/duplicate storm,
  provider rate limits, settlement latency, provider payout throughput, callback reorder,
  provider outage/degradation — executable only after ADR-0015 ACCEPTED + real provider
  selected + 2.12B runtime + sandbox/contract evidence.
- Production load execution, production tuning, index changes without measured evidence.
- Distributed rate limiting (login throttle stays per-instance in-memory; §20).
- Observability platform (only minimal instrumentation defined; §33).
- Step 2.17C (sales decomposition), Step 2.18 (Phase Exit) — not started.

## 3. Repository inventory (verified 2026-08-16)

- **Load tooling:** 0 third-party — no k6/artillery/autocannon/wrk/vegeta/jmeter/locust/gatling
  in `backend/package.json` or `frontend/package.json`; no third-party load dependency was
  added. The Step 2.17B harness (`backend/src/perf/`) is a **dependency-free Node harness**
  (global fetch, deterministic seeded PRNG, pure percentile math) — no lockfile change.
  Evidence: repo-wide search + `TRAVELHUB_PHASE_2_CRITICAL_PLATFORM_RISKS_AND_PAYMENT_PSP_READINESS_RECONCILIATION_REPORT.md` §10.
- **Metrics/observability:** 0 — no prom-client/OpenTelemetry/Grafana/Prometheus; no
  `/metrics` endpoint; no event-loop-lag or query-duration instrumentation.
- **SLO/SLI numbers:** 0 — no approved quantitative SLO anywhere (see §26 authority table).
- **Route surface (29 controllers, ~280 route handlers):** account 7, auth 6, booking 3,
  capabilities 8, catalog 26, checkout 9, commercial-periods 8, commercial-restrictions 7,
  communication 4, crm 11, finance 52, marketplace-behavioral 1, matching 3, moderation 9,
  order 4, partner-catalog 1, partner-onboarding 9, proposals 10, public-catalog 10,
  rate-plans 7, requests 7, reverse-conversation 5, sales 30, seller-profile 14,
  service-units 7, storefront-behavioral 1, storefront 9, users 5.
- **EventBus worker** (`src/eventbus/outbox-worker.service.ts`): interval default 2000 ms
  (`OUTBOX_WORKER_INTERVAL_MS`), batch default 100 (`OUTBOX_WORKER_BATCH`), pg advisory
  xact-lock multi-instance delivery, at-least-once + authoritative Inbox/consumer idempotency.
- **Login throttle** (`src/shared/login-throttle.service.ts`): sliding window 10 attempts /
  15 min per `username|ip`, in-memory per-instance (bounded eviction per Step 2.17 FIX 3).
- **Prisma pool:** no explicit `connection_limit`/`pool_timeout` override — Prisma default.
- **DB:** PostgreSQL multi-schema (11 schemas, 58 canonical migrations), migrate 58/58, drift 0.

## 4. Platform vs PSP split

```text
A. PLATFORM BASELINE QUALIFICATION — executable now (this Step 2.17B)
B. PSP/WEBHOOK PERFORMANCE SUBSET — deferred until ADR-0015 ACCEPTED + 2.12B runtime
```

Canonical evidence: Roadmap 2.17B — «PSP webhook burst subset — обязателен в 2.12B»;
`TRAVELHUB_PHASE_2_CRITICAL_PLATFORM_RISKS_AND_PAYMENT_PSP_READINESS_RECONCILIATION_REPORT.md`
§10 — «PSP webhook burst subset mandatory inside 2.12B; SLO numbers require authority».

## 5. Workload matrix (routes that exist)

| # | Class | Representative routes (verified) | Notes |
|---|---|---|---|
| 1 | health/session/auth read | `GET /auth/session`, `/api/v1/.../health` equivalents | public probe |
| 2 | login | `POST /auth/login` | throttle-sensitive; see §20 |
| 3 | authenticated read/list | Sales list, CRM list, Finance read, seller/catalog reads | RBAC-gated |
| 4 | public read | `GET /api/v1/public/products`, `/public/categories`, `/public/storefronts/:slug` | anonymous |
| 5 | Sales read | `GET /api/v1/sales/...` (30 routes) | quote/checkout/sale list+detail |
| 6 | Booking read/write | booking controller (3 routes) + lifecycle consumers | date/slot semantics |
| 7 | Order lifecycle write | order controller (4 routes) + `OrderRequested` consumer chain | idempotent inbox |
| 8 | Payment initiation boundary | `POST /api/v1/finance/payments` (`@Idempotent("payment.create")`) | external Idempotency-Key required |
| 9 | Finance reads | finance controller (52 routes) | RBAC per resource |
| 10 | EventBus publication | any mutating op that emits outbox events | worker interval/batch |
| 11 | Durable retry / background worker | `OutboxWorkerService` retryFailed→publishPending | multi-instance |
| 12 | Concurrency-sensitive write | last-slot availability guard, checkout reservation | atomic conditional UPDATE |
| 13 | Reverse marketplace | requests/proposals/matching reads+writes (own-scope) | if included in baseline |

## 6. Dataset strategy

Three logical classes (no fabricated production row counts — numeric scale is
authority-required where production volume is unknown):

```text
SMALL       — developer correctness/perf smoke (tens of rows)
REPRESENTATIVE — qualification dataset (deterministic generators, ratios derived from
                 category/schema structure; absolute counts authority-required)
STRESS      — intentionally beyond expected peak (deterministic generator, bounded)
```

Rules:
- Synthetic/test identities only — NO real PAN, CVV/CVC, credentials, production JWTs, PII.
- Deterministic generators + seeds; every run records seed state in environment metadata.
- Money values in generators must be canonical decimal strings (never float math).

## 7. Metrics

Latency: `p50`, `p95`, `p99`, `max` — per operation class (client-observed; server
processing and DB latency only where the environment exposes trustworthy measurement).
Throughput: requests/ops per second, successful ops/sec, EventBus events/sec, backlog
drain rate, error/conflict rate split by expected vs unexpected class.
Resource: process CPU, RSS/heap, event-loop lag, PostgreSQL active connections, DB size,
outbox backlog, test-client saturation — only what the environment can measure reliably.

## 8. Error classification (no false-green)

```text
expected 4xx          (validation, RBAC 403)
expected controlled 409 (idempotency divergence, last-slot conflict)
429 throttle          (login throttle)
unexpected 5xx        (raw 500 — FAIL)
timeouts / connection failures / DB failures / test-harness failures
```

A test is NOT green merely because «error rate < X%» if duplicate facts or raw 500 occur.

## 9. Correctness-under-load — HARD GATE

Invariants asserted during and after load, where applicable:

- 0 duplicate Payment facts; 0 duplicate Commission/Accrual; 0 duplicate Order.
- No invalid Booking transition; no broken inventory/availability invariant (never negative
  `slotsReserved`/`slotsBooked`; last-slot guard holds under contention).
- No divergent idempotency replay; no lost PENDING events; no unexpected poison amplification.
- No raw 500 from controlled races (P2002/P2025 classified, not rethrown as 5xx).
- Financial Decimal values remain exact (canonical string representation).
- EventBus: at-least-once + Inbox/consumer idempotency — exactly-once NOT claimed.

## 10. Environment contract

Every result artifact MUST record: Node version, PostgreSQL version, application instance
count, worker instance count, DB isolation (dedicated DB, not shared dirty state), frontend
relevance, test machine characteristics, env vars, debug/logging mode (log level recorded —
see §34), seed state, MinIO/object dependencies if exercised, git commit SHA, timestamps.

## 11. Tooling decision (DECIDED 2026-08-16)

**Dependency-free Node harness** (`backend/src/perf/`, Node global `fetch`) was selected over
k6 / autocannon / Artillery.

Why: (1) zero new dependency — no lockfile change, no binary download, deterministic and
Windows-native; (2) full control over auth bootstrap, `Idempotency-Key` handling, outcome
classification and post-run correctness validation in one process; (3) the repository already
favours dependency-free operational scripts (`dr-backup.mjs` / `dr-restore-drill.mjs`);
(4) scenario modelling (warm-up, concurrency, duration, per-request closures) is native code.

Rejected: k6 (Go binary dependency, richer but heavier than needed for exploratory
platform baseline), autocannon (needs an orchestrator anyway for auth/idempotency scenarios),
Artillery (dependency + scenario DSL; same orchestrator need).

Selection criteria (from the authority/design pass) are all met: scriptable, deterministic
(seeded PRNG), concurrency control, p50/p95/p99/max, structured JSON artifacts, auth
headers/cookies + `Idempotency-Key`, CI-safe smoke, Windows-compatible.

## 12. EventBus scenarios (measurable, semantic preserved)

- steady PENDING delivery; burst PENDING delivery;
- retryable FAILED backlog drain; poison/exhausted isolation (non-retryable);
- two worker instances (duplicate delivery attempts, advisory-lock contention, drain rate);
- nested consumer chains (e.g., OrderRequested → Order → CommissionAccrual);
- recovery after worker downtime (PENDING accumulates → restart → drain);
- backlog drain rate and latency normalization.

## 13. External idempotency scenarios

- unique keys; identical retries (DB-backed replay); divergent reuse (409);
- concurrent identical; concurrent divergent; stale IN_PROGRESS recovery (CAS takeover).
- Correctness: 0 duplicate committed Payment facts, 0 wrong replay, 0 raw 500 from
  expected contention. Throughput never trumps correctness.

## 14. Database measurement

- active connections; pool saturation/timeouts; query latency where measurable;
- transaction latency; lock contention; deadlocks; P2002/P2025/serialization-like
  contention; DB CPU/memory only when trustworthy.
- No index changes during authority/design. Implementation may propose narrow
  evidence-backed index fixes, each justified by measured bottleneck + regression-tested.

## 15. Multi-instance scenarios

Measure (do not assume): duplicate delivery attempts, advisory-lock contention, backlog
drain rate, DB contention, latency degradation. Horizontal scalability is NOT claimed from
correctness surviving two instances.

## 16. Soak / Stress / Recovery

- **Soak:** memory growth, handle/connection leaks, backlog growth, retry accumulation,
  rate-limiter Map behavior, event-loop degradation. Duration authority/evidence-driven.
- **Stress/breakpoint:** controlled ramp, saturation indicators, safe termination, recovery
  verification, post-test data integrity. Stress discovers failure behavior; it does not
  create an SLO by itself.
- **Recovery:** app/worker paused while backlog accumulates → restart → drain →
  latency normalization → 0 duplicate effects.

## 17. Result artifacts

Per-run results directory under `docs/performance/results/` (run-id per run), containing
`summary.json` (env metadata, scenario, thresholds, pass/fail, SHA, timestamps) and optional
CSV files (not committed by default).

No huge raw datasets committed by default. No sensitive data.

## 18. Baseline / regression model

- Correctness hard gates (always).
- Catastrophic regression guard (order-of-magnitude) in CI.
- Relative baseline for stable controlled environment.
- Production-like qualification separately (pre-go-live).
- Exact tolerance requires authority or evidence.

## 19. Local / CI / pre-production semantics

- **Local:** harness correctness + relative comparisons.
- **CI:** deterministic smoke/regression gates; shared runners NOT absolute-latency SLO proof.
- **Pre-production/production-like:** required for credible capacity qualification before
  go-live. GitHub Actions latency is NOT production capacity evidence.

## 20. Login throttle boundary

Measurable, but MUST NOT be reinterpreted as distributed abuse protection (in-memory,
per-instance by contract). Load tests on login must respect 10/15min per key and use
distinct synthetic users. If load reveals correctness/security defects → report separately;
do not expand this step into Redis/distributed rate limiting.

## 21. Warm-up / cache effects

Define warm-up and cold-start handling: cold start, warm steady state, DB cache effects,
first Prisma connection, worker startup. No cherry-picked fastest interval.

## 22. Logging under load

Assess whether current logging dominates load tests. Test modes must NOT disable required
audit/security logs. If log level differs, record it in environment metadata. Do not
benchmark one logging mode and imply another.

## 23. Workload classes

```text
SMOKE      — harness correctness, tiny load, fast
BASELINE   — representative single-scenario reference
STEADY     — sustained mixed workload
PEAK       — expected peak mix
BURST      — short high-intensity spike (EventBus burst, payment burst)
SOAK       — long-duration stability
STRESS/BREAKPOINT — ramp to saturation (failure-behavior discovery)
RECOVERY   — downtime → restart → drain
```

Each class needs: purpose, duration, concurrency/arrival model, dataset, metrics,
correctness assertions, pass/fail semantics. No one-number «load test».

## 24. Step 2.18 handoff

Phase Exit (2.18) must later verify from 2.17B: performance qualification evidence exists;
approved targets vs measured results are distinguishable; unresolved PSP-dependent subset
is visible; no false production-capacity claim; known capacity/performance gaps have owners.

## 25. Security / PII / card negative boundary

Load datasets contain NO real PAN, CVV/CVC, credentials, production JWTs, PII.
Synthetic/test identities only. No PCI-scope expansion. Idempotency-Key raw values never
logged; auth tokens never logged; PSP secrets never present.

## 26. SLO / load authority table

| Metric | Existing approved value? | Repository evidence | Authority required? | Proposed owner |
|---|---|---|---|---|
| API availability / error objective | NO | 0 SLO anywhere | YES | Business/Product |
| p95 read latency | NO | 0 SLO anywhere | YES | Business/Product |
| p99 read latency | NO | 0 SLO anywhere | YES | Business/Product |
| p95/p99 write latency | NO | 0 SLO anywhere | YES | Business/Product |
| payment-initiation boundary latency | NO | 0 SLO anywhere | YES | Business/Product |
| EventBus backlog drain | NO | 0 SLO anywhere | YES | Operations/Engineering |
| expected peak RPS / concurrency | NO | 0 SLO anywhere | YES | Business/Product |
| expected concurrent users | NO | 0 SLO anywhere | YES | Business/Product |
| soak duration | NO | 0 SLO anywhere | YES | Operations |
| release regression tolerance | NO | 0 SLO anywhere | YES | Engineering/Operations |

**Authority decision (2026-08-16) — QUANTITATIVE AUTHORITY SUPPLIED — VERDICT A (see §33):**
the Business/Product/Operations quantitative authority previously missing was supplied by a
dedicated authority pass (report:
`docs/prompts/PHASE_2_STEP_2.17B_QUANTITATIVE_TARGETS_AUTHORITY_DECISION_REPORT.md`).
The canonical authority matrix with APPROVED values is in §33. The correctness/reliability
gates below remain approved repository contract invariants:

| Approved (contract-level) | Value | Evidence |
|---|---|---|
| duplicate committed Payment | 0 | 2.12H digest slots + PaymentService idempotent retry + e2e |
| wrong / silent divergent idempotent replay | 0 | 2.12H slotKey = sha256(scope, op, key) |
| duplicate Order / business fact from race or retry | 0 | Order consumer + Inbox dedup authoritative |
| duplicate Commission / CommissionAccrual fact | 0 | 2.10B idempotency + unique constraints |
| lost committed PENDING event | 0 | durable outbox + worker (2.17) |
| poison blocking unrelated progress | 0 | exhausted poison isolation (2.17) |
| raw 500 from controlled race | 0 | every e2e asserts 0 unexpected 5xx |
| Decimal corruption | 0 | decimal.js + DECIMAL(12,2) guards |
| invalid terminal lifecycle transition | 0 | CAS + status gates |
| unexpected 5xx / timeout / transport (HTTP reliability) | 0 | established repo-wide gate |

Fast-but-wrong FAILS: correctness is absolute and never weakened by load results.

## 27. Observability gaps

Current app lacks metrics for meaningful production performance analysis. Minimum
instrumentation for qualification (implementation phase, narrow):
- request latency histogram per route class (p50/p95/p99/max);
- event-loop lag; Prisma query duration (where feasible);
- outbox backlog count; connection pool saturation;
- structured logs WITHOUT PII/tokens/Idempotency-Key raw values/PSP secrets/card data.

Do not turn this step into a full observability platform.

## 28. Implementation gates

1. Authority-approved SLO/load targets (or explicit exploratory-profile mode recorded);
2. tool selected by §11 criteria and installed as dev-dependency;
3. harness + datasets + workload classes implemented;
4. correctness-under-load hard gates pass;
5. environment contract recorded in every artifact;
6. regression gates defined (correctness always; catastrophic guard in CI).

## 29. Final approval gates

Step 2.17B NOT APPROVED until: (1) quantitative qualification targets approved;
(2) platform baseline measured; (3) correctness-under-load hard gates pass;
(4) production-like qualification requirement explicitly dispositioned;
(5) PSP-dependent subset separately deferred while PSP unavailable.

## 30. Decision record — Option A (selected)

**Verdict A — harness/design MAY PROCEED; FINAL QUALIFICATION REQUIRES SLO/LOAD AUTHORITY.**

Rationale (canonical Roadmap wording, not convenience): Roadmap 2.17B requires authority
for SLO/SLI numbers («SLO/SLI числа требуют authority (не выдумывать; сейчас SLO нет)»)
but does NOT block harness construction; prior reconciliation classifies 2.17B as
«PARTIAL / system baseline possible». Exploratory (non-authoritative) profiles may drive
harness implementation; final qualification against approved targets requires the authority
decision. Final Step 2.17B APPROVED status is forbidden before authority + measurement.

## 31. Harness implementation status (2026-08-16)

Implemented in `backend/src/perf/` (dependency-free, Node 24 global fetch):

- `run.ts` — CLI orchestrator: config parse (fail-closed) → safe-target guard → boots the
  real Nest application in-process against an isolated DB → deterministic synthetic seed →
  profile execution → post-run correctness validator → structured artifacts → cleanup.
- `lib/guard.ts` — safe-target guard (fail-closed): NODE_ENV=production refuse; canonical/
  production-like DB names refuse (`travelhub1`, `*_prod*`, `postgres`, `template*`);
  non-local DB/base URL require `--allow-non-local`; `stress` requires `--stress`.
- `lib/loader.ts` — concurrent fetch pool: warm-up excluded from measurement, per-label
  p50/p95/p99/max, outcome classification, throughput.
- `lib/classify.ts` — expected vs unexpected 4xx/409/429/5xx/timeout/transport.
- `lib/seed.ts` + `lib/correctness.ts` — deterministic synthetic datasets (run-prefixed,
  tracked, deleted in dependency order) + authoritative DB-state validator.
- `lib/config.ts` — profiles SMOKE/BASELINE/STEADY/PEAK/BURST/SOAK/STRESS (exploratory
  numbers, visibly non-authoritative) + special profiles `paycreate` (external idempotency
  concurrency) and `eventbus-recovery` (burst PENDING → drain, poison isolation,
  multi-instance).
- `perf-harness.spec.ts` — 31 unit/integration tests (guard, classification, percentiles,
  redaction, config fail-closed, loader end-to-end against a local HTTP server).

Live exploratory validation (isolated `travelhub_perf_*` DB, localhost, 2026-08-16):

| Profile | Result | Notes |
|---|---|---|
| SMOKE | 3669 req, 367 req/s, 0 unexpected | 4 route classes |
| BASELINE | 2351 req, 235 req/s, 0 unexpected | 6 route classes incl. crm/customers |
| PAYCREATE | 7 facts / 8 orders, 0 raw 500 | 10 unique keys → 5 facts + 5 business no-ops; concurrent identical 4×201 → 1 fact; divergent 1×201+1×409; slots=12=7+5 |
| EVENTBUS | 250 seeded → 250 published, drain 1335 ms, 187 ev/s | poison isolated; multi-instance 100/100 |
| BURST | 7720 req (~1544 req/s), 0 unexpected | concurrency 40 |
| SOAK (30 s) | 9591 req (~320 req/s), 0 unexpected | short exploratory |

All measurements are EXPLORATORY / HARNESS VALIDATION — NOT production SLOs, NOT
capacity targets. Artifacts: `backend/artifacts/performance/<run-id>/*.json` (gitignored).

## 32. Related steps

- Step 2.17 (hardening) — APPROVED; worker/CI/auth foundations this step builds on.
- Step 2.17A (Backup/DR) — APPROVED WITH REVIEW FIXES; independent gate.
- Step 2.17C (sales decomposition) — PLANNED, NOT STARTED; behavior-preserving.
- Step 2.12A / 2.12H — APPROVED; payment boundary + external idempotency (measured here).
- Step 2.12B — BLOCKED (PSP/aggregator commercial confirmation); owns PSP webhook burst
  subset (`STEP 2.17B-PSP` deferred until ADR-0015 ACCEPTED + 2.12B runtime + provider sandbox).
- ADR-0015 — PROPOSED/BLOCKED; PSP selection prerequisite.
- Step 2.18 — Phase Exit; consumes 2.17B evidence per §24.

## 33. Quantitative SLO/load authority (2026-08-16) — VERDICT A (APPROVED)

Authority pass:
`docs/prompts/PHASE_2_STEP_2.17B_QUANTITATIVE_TARGETS_AUTHORITY_DECISION_REPORT.md`.
Preceding Verdict B (partial) recorded in
`docs/prompts/PHASE_2_STEP_2.17B_SLO_LOAD_AUTHORITY_DECISION_REPORT.md`.

**Verdict A — QUANTITATIVE AUTHORITY APPROVED.** Business/Product/Operations supplied the
V1 planning/qualification envelope below as explicit owner-approved targets. They are NOT
derived from localhost measurements and NOT production capacity claims.

Canonical semantic preserved:

```text
APPROVED BUSINESS TARGET ≠ OBSERVED HARNESS MEASUREMENT ≠ VERIFIED CAPABILITY
≠ PRODUCTION CAPACITY CLAIM ≠ FUTURE SCALING TARGET
```

### 33.1 V1 user / load planning envelope (Business/Product)

| Metric | Value |
|---|---|
| Registered users planning envelope | 100,000 |
| MAU planning envelope | 25,000 |
| DAU planning envelope | 5,000 |
| Normal concurrent active users | 100 |
| Expected V1 peak concurrent users | 250 |
| Qualification peak concurrent users | 500 |
| Short burst concurrency | 1,000 |

### 33.2 Traffic mix (Business/Product)

| Class | Share |
|---|---|
| Reads | 80% |
| Writes | 20% |
| — of total: auth/login | <= 5% |
| — booking/order writes | <= 5% |
| — payment initiation | <= 2% |
| — other domain writes | <= 8% |
| — reads (public/authenticated) | balance |

Workload-design authority, not a requirement that every run matches this exact distribution.

### 33.3 Request-rate authority

| Metric | Value | Kind |
|---|---|---|
| Expected normal application load | 25 RPS | V1 planning |
| Expected V1 peak application load | 50 RPS | V1 planning |
| Qualification sustained target | 100 RPS | Phase 2 qualification |
| Qualification short-burst target | 200 RPS | Phase 2 qualification |
| Future scaling planning target | 1,000 RPS | planning only — NOT a Phase 2 gate |
| Qualification headroom over expected V1 peak | 2.0x | Business/Product + Operations |

### 33.4 Latency SLO per route class (TravelHub-controlled only; PSP latency excluded)

| Class | p95 | p99 |
|---|---|---|
| A — public/light reads | <= 300 ms | <= 750 ms |
| B — authenticated reads | <= 500 ms | <= 1000 ms |
| C — ordinary domain writes | <= 750 ms | <= 1500 ms |
| D — concurrency-sensitive writes | <= 1000 ms | <= 2000 ms |
| E — payment.create (internal processing) | <= 1000 ms | <= 2000 ms |
| F — auth/login | <= 750 ms | <= 1500 ms |

p50 informational; max diagnostic. Correctness more important than latency (Class E).

### 33.5 Reliability / correctness gates (unchanged, absolute)

Unexpected HTTP 5xx = 0; unexpected transport failures = 0; unexpected timeouts = 0
(qualification-run gates, NOT a production availability SLA). Expected scenario-specific
400/401/403/404/409/429 are not failures when the contract requires them. Correctness-under-
load gates (§26 table) remain absolute; fast-but-wrong FAILS.

### 33.6 Domain-rate authority

- **payment.create** (TravelHub-owned only, ADR-0015/2.12B blocked): expected peak 1 RPS,
  qualification 2 RPS, burst 10 RPS, concurrent 50; latency per Class E; correctness:
  duplicate committed Payment = 0, wrong replay = 0, raw 500 from controlled race = 0;
  no real PSP call in qualification.
- **Booking/Order**: expected combined V1 peak 3 RPS, qualification 6 RPS, burst 20 RPS;
  lifecycle correctness, terminal-state protection, 0 duplicate facts, event-chain
  convergence, 0 lost committed events, controlled conflicts; latency per Class C/D.
- **Login**: expected V1 peak 1 RPS, qualification 2 RPS, burst 5 RPS; harness respects the
  in-memory per-instance throttle (10/15 min, Step 2.17 contract) — distinct synthetic
  users, throttle NOT bypassed/disabled; tokenVersion/logout semantics preserved.

### 33.7 EventBus authority (at-least-once + Inbox/consumer idempotency preserved)

| Metric | Value |
|---|---|
| Expected steady event generation | 25 ev/s |
| Expected V1 peak event generation | 50 ev/s |
| Qualification steady target | 100 ev/s |
| Qualification burst | 1,000 events |
| Normal steady-state PENDING backlog | <= 100 |
| Normal oldest PENDING age | <= 10 s |
| Recovery backlog | 5,000 events |
| Recovery worker instances | 2 |
| Max full backlog drain / convergence | <= 120 s |

Post-convergence: lost committed events = 0, duplicate business effects = 0, poison blocks
unrelated events = 0, unexpected retryable residue = 0 (deliberately poisoned/exhausted
records allowed only when the scenario expects them, isolated/auditable). exactly-once is
NEVER claimed.

### 33.8 Qualification topology / sequence / durations

Topology: **2 app instances + 2 worker instances + shared PostgreSQL** (dedicated isolated
performance environment). No linear-scaling claim.

Sequence: safe-target/env validation → dataset preparation → SMOKE → warm-up 5 min →
steady 15 min @ 50 RPS → qualification peak 15 min @ 100 RPS → burst 60 s @ 200 RPS →
payment.create concurrency/idempotency → booking/order write profile → EventBus
steady/peak/burst → EventBus recovery (5,000 / 2 workers) → multi-instance profile →
soak 30 min @ 50 RPS / concurrency 250 → post-run correctness validation → cleanup
validation. Stress characterization may run separately and must not replace qualification.

Burst ceilings: Class A/B burst p99 <= 2000 ms; Class C–F burst p99 <= 3000 ms; correctness
absolute during burst; backlog/latency converge after burst without manual cleanup.

Soak (30 min @ 50 RPS / concurrency 250): 0 unexpected 5xx/timeout/transport, 0 correctness
violations, no continuously growing EventBus backlog, no unrecovered retryable FAILED
accumulation, no obvious unbounded memory-growth pattern, no DB corruption, cleanup
succeeds. Process memory start/peak/end reported if the harness can obtain it without new
runtime deps; otherwise `NOT MEASURED — OBSERVABILITY LIMITATION` (no production-code change
for this pass).

Stress: characterization only, NOT a Phase 2 approval gate; permitted exploratory ceiling
up to 500 RPS and/or 2,000 concurrent requests (isolated environment safe); abort on
correctness violation / DB safety concern / uncontrolled failure cascade / inability to
clean up / guard failure; no requirement to reach 500 RPS; no production-capacity claim.

### 33.9 Release regression tolerance (Engineering/Operations)

p95 regression > 20%, p99 regression > 25%, throughput regression > 20% on materially
comparable environments → investigate / qualification warning (NOT automatic SLO failure
if absolute approved SLOs still pass). Any correctness regression = immediate FAIL.

### 33.10 Future scaling — planning only, non-blocking

Future planning: 1,000 RPS / 5,000 concurrency / 20 payment-initiation RPS /
500 EventBus ev/s. NOT Phase 2 blockers, NOT capacity claims, harness NOT required to pass
them; prevents V1-load-as-permanent-ceiling assumptions. (Also §34.)

### 33.11 Dataset authority

Deterministic synthetic representative dataset: Users >= 1,000; Products/service units
>= 500; Customers/CRM >= 1,000; Sales/quotes >= 1,000; Booking/Order chains >= 1,000;
Payment-capable orders >= 500; Finance/ledger >= 5,000; EventBus seed capability >= 5,000.
Nearest canonical domain entity mapping documented per run; no fake schema concepts.

### 33.12 Environment authority

Dedicated isolated performance environment (local/perf host or dedicated CI/perf runner),
isolated PostgreSQL, canonical migrations, production Nest path, deterministic synthetic
data only, never canonical/prod DB, full environment metadata (OS, CPU, RAM, Node, PG,
DB class, app/worker counts, worker interval/batch, dataset size, profile, commit SHA).
Sufficient for Phase 2 platform qualification; NOT production capacity certification;
future pre-launch staging/prod-like qualification may be required separately.

### 33.13 PSP / step separation (unchanged)

PSP performance subset DEFERRED until ADR-0015 ACCEPTED + 2.12B runtime + provider
sandbox/contract evidence. Step 2.17A RPO/RTO (1h/4h/24h/8h) are DR targets, NOT latency
SLOs. 2.17C Sales debt, 2.18, RLS (ADR-0014) — NOT started. This pass changes no code.

## 34. Future scaling — non-blocking planning

12-month traffic growth, horizontal app/worker scaling, DB read replicas, caching,
distributed rate limiting, observability/APM, PSP/webhook scaling — planning-only section.
None of these are Phase 2 gates unless separately approved.

## 35. Step 2.17B current state (2026-08-16)

- harness: IMPLEMENTED (dependency-free `backend/src/perf/`, 31 unit/integration tests);
- exploratory baseline: MEASURED (localhost, isolated DB — NOT authority);
- quantitative SLO/load authority: VERDICT A — APPROVED (2026-08-16, §33);
- correctness-under-load: HARD GATE PASS on all executed scenarios;
- final qualification: EXECUTED → **VERDICT C — INVALID/INCOMPLETE** (see §36);
- Step 2.17B: NOT APPROVED; strict review: NOT STARTED; PSP subset: DEFERRED (ADR-0015 + 2.12B).

## 36. Final qualification result (2026-08-16) — VERDICT C (INVALID/INCOMPLETE)

Qualification pass: `docs/prompts/PHASE_2_STEP_2.17B_FINAL_QUALIFICATION_REPORT.md`.

Executed honestly against the frozen authority matrix on a dedicated isolated perf DB
(localhost, PG 18.4, Node v24.18.0, 12 vCPU):

| Executed subset | Result |
|---|---|
| Steady 15 min (max-effort) | 225,270 req, 250 req/s, 0 unexpected, correctness PASS |
| Peak 15 min (max-effort) | 330,656 req, 367 req/s, 0 unexpected, correctness PASS |
| Burst 60 s (max-effort) | 51,766 req, 863 req/s, 0 unexpected, correctness PASS |
| Soak 30 min (max-effort, conc 250) | 558,609 req, 310 req/s, 0 unexpected, correctness PASS |
| payment.create (one-shot) | 7 facts + 5 business no-ops, 0 duplicate, 0 raw 500, nested chain inbox 8/8 |
| EventBus recovery (as harness supports) | 250→250, drain 1.3 s, poison isolated, 2-instance 100/100 |

**Verdict C — INVALID/INCOMPLETE.** A valid verdict against the approved matrix is NOT
available because the current harness cannot execute required gates (proven gaps, NOT
system failures; harness NOT modified per qualification rules):

1. no arrival-rate pacing — the loader is a max-effort concurrency pool (gates "@ 50/100/200
   RPS" cannot be driven);
2. `--warmup` flag parsed but never applied; warm-up profile-fixed ≤ 2 s (5-min warm-up
   not requestable);
3. dataset generator only SMALL per-run scale (authority dataset >= 1,000 users etc. not
   supported);
4. payment.create sustained 2/10 RPS — one-shot scenario only;
5. Booking/Order sustained 6/20 RPS — no write profile;
6. login sustained 2/5 RPS — 5 one-shot probes only;
7. EventBus steady 100 ev/s — no generation scenario;
8. EventBus burst 1,000 — `SEED_COUNT = 250` hardcoded;
9. EventBus recovery 5,000 / 2 workers / canonical config — 250 seed + hardcoded
   `OUTBOX_WORKER_INTERVAL_MS=200/500` override (violates canonical-config rule);
10. multi-instance 2 app + 2 worker with HTTP — only 2 worker instances in eventbus phase;
11. soak 30 min @ 50 RPS — duration/concurrency executed, 50 RPS pacing not emitted.

Observations (no fix in this pass): **OBS-1** Class B (sales.list) p95 degrades with load
(428 ms @ 250 req/s → 1,533 ms @ 367 req/s → 2,427 ms @ 310 req/s / conc 250) —
classification `DATABASE QUERY / CONNECTION POOL CONTENTION`, root cause NOT yet proven,
routed to remediation; **OBS-2** paycreate cleanup leaves 24 PUBLISHED event rows (registry
scope); **OBS-3** worker-interval override must be made canonical-config; **OBS-4** two
runs invalidated by orchestration/session boundaries (recorded, not hidden).

Step 2.17B remains NOT APPROVED. NEXT = QUALIFICATION HARNESS/ENVIRONMENT REMEDIATION
(separate prompt), then re-execution against the unchanged frozen targets.
