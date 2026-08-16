# Load & Performance Qualification — Step 2.17B (Authority / Design Reconciliation)

> STATUS: AUTHORITY/DESIGN RECONCILIATION (2026-08-16) — harness implementation NOT started.
> Verdict A: harness/design MAY PROCEED with non-authoritative exploratory profiles; FINAL
> qualification against approved SLO/load targets requires authority.

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

- **Load tooling:** 0 — no k6/artillery/autocannon/wrk/vegeta/jmeter/locust/gatling in
  `backend/package.json` or `frontend/package.json`; no `benchmark`/`load-test` scripts; no
  perf docs prior to this file. Evidence: repo-wide search + `TRAVELHUB_PHASE_2_CRITICAL_PLATFORM_RISKS_AND_PAYMENT_PSP_READINESS_RECONCILIATION_REPORT.md` §10.
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

## 11. Tooling decision criteria

Candidate families (k6 / autocannon / Artillery / Node-native harness). Selection at
implementation time, NOT in this pass, by criteria:
- scriptable, deterministic, concurrency + arrival-rate modelling;
- latency percentiles + thresholds + JSON/structured output;
- CI-friendly for smoke gates; can send auth cookies/headers and `Idempotency-Key`;
- scenario modelling (ramp/burst/soak);
- no new dependency installed in this pass.

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

All values: `TBD — BUSINESS/PRODUCT/OPERATIONS AUTHORITY REQUIRED`. Not chosen here.

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

## 31. Related steps

- Step 2.17 (hardening) — APPROVED; worker/CI/auth foundations this step builds on.
- Step 2.17A (Backup/DR) — APPROVED WITH REVIEW FIXES; independent gate.
- Step 2.17C (sales decomposition) — PLANNED, NOT STARTED; behavior-preserving.
- Step 2.12A / 2.12H — APPROVED; payment boundary + external idempotency (measured here).
- Step 2.12B — BLOCKED (PSP/aggregator commercial confirmation); owns PSP webhook burst
  subset (`STEP 2.17B-PSP` deferred until ADR-0015 ACCEPTED + 2.12B runtime + provider sandbox).
- ADR-0015 — PROPOSED/BLOCKED; PSP selection prerequisite.
- Step 2.18 — Phase Exit; consumes 2.17B evidence per §24.
