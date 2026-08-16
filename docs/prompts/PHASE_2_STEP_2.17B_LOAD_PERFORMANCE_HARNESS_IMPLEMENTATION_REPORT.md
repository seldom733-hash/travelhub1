# PHASE 2 — STEP 2.17B — LOAD & PERFORMANCE HARNESS IMPLEMENTATION REPORT

## 1. Status

```text
PHASE 2 STEP 2.17B LOAD/PERFORMANCE HARNESS IMPLEMENTATION COMPLETED —
EXPLORATORY BASELINE RECORDED — SLO/LOAD AUTHORITY REQUIRED
```

Step 2.17B remains NOT APPROVED. This pass built and validated the measurement system;
final qualification against approved SLO/load targets still requires Business/Product/
Operations authority.

## 2. Methodology

Repository-first: preconditions verified from Roadmap/design docs/git; tool selection made
against the authority/design criteria; harness implemented as dependency-free Node code
under `backend/src/perf/`; unit-tested; validated live against an isolated
`travelhub_perf_*` PostgreSQL database (migrate deploy 58/58); full regression after.

## 3. Repository baseline

- branch `master`; HEAD == upstream == `2861326` (Step 2.17B authority/design reconciliation).
- Worktree: only unrelated untracked prompt files preserved.
- Step statuses: 2.17 / 2.17A APPROVED WITH REVIEW FIXES; 2.17B PLANNED — NOT APPROVED;
  2.17C NOT STARTED; 2.18 NOT STARTED; 2.12B BLOCKED; ADR-0015 PROPOSED/BLOCKED.
- Migration count 58/58; 0 migrations in this pass.

## 4. Reviewed design authority

- `docs/architecture/load-performance-qualification-2.17B.md` (authority/design).
- `docs/operations/load-performance-qualification-runbook.md` (runbook design).
- `docs/prompts/PHASE_2_STEP_2.17B_LOAD_PERFORMANCE_AUTHORITY_DESIGN_RECONCILIATION_REPORT.md`
  (verdict A).
- Roadmap Step 2.17B entry.

## 5. Tool selection

**Dependency-free Node harness** (`backend/src/perf/`, Node global fetch) — no third-party
load tool, no lockfile change, no binary download. Deterministic (seeded mulberry32 PRNG),
Windows-native, full control over auth bootstrap / Idempotency-Key / outcome classification /
post-run correctness. k6 / autocannon / Artillery rejected (heavier, need an orchestrator for
auth/idempotency scenarios anyway; k6 adds a Go binary dependency). Selection criteria from
the design pass all met.

## 6. Dependency changes

**0** — `backend/package.json` gained only the `perf:run` script (`ts-node src/perf/run.ts`).
No npm dependency added; lockfiles untouched.

## 7. Harness architecture

```
backend/src/perf/
  run.ts                 CLI orchestrator: config → guard → boot app → seed → profile →
                         validate → artifacts → cleanup
  lib/config.ts          profiles + fail-closed CLI parsing
  lib/guard.ts           safe-target guard (fail-closed)
  lib/loader.ts          concurrent fetch pool (warm-up excluded, percentiles, throughput)
  lib/classify.ts        expected vs unexpected 4xx/409/429/5xx/timeout/transport
  lib/percentile.ts      p50/p95/p99/max + seeded PRNG
  lib/redact.ts          artifact redaction (secrets/URL credentials)
  lib/env.ts             environment metadata
  lib/artifacts.ts       summary/environment/scenario/correctness writers
  lib/seed.ts            deterministic synthetic datasets + registry + cleanup
  lib/correctness.ts     post-run correctness validator (authoritative DB state)
  perf-harness.spec.ts   31 unit/integration tests
```

The harness boots the REAL Nest application in-process (same bootstrap as `main.ts`) against
an isolated DB, so it measures the production code path (guards, pipes, filters, RBAC,
outbox worker when enabled).

## 8. Safe-target guard

`lib/guard.ts` refuses before any seed/load: NODE_ENV=production; protected/canonical DB
names (`travelhub1`, `*_prod*`, `postgres`, `template0/1`); non-local DB host or base URL
unless `--allow-non-local`; `stress` without `--stress`. Live-verified: canonical DB →
exit 2, no load executed.

## 9. Configuration

`--profile`, `--run-id`, `--out`, `--db-url`, `--concurrency`, `--duration`, `--warmup`,
`--request-timeout`, `--drain-timeout`, `--seed`, `--allow-non-local`, `--stress`. Malformed
config fails closed (exit 2). All numeric profile values are EXPLORATORY.

## 10. Profiles

SMOKE / BASELINE / STEADY / PEAK / BURST / SOAK / STRESS (load) + `paycreate` (external
idempotency concurrency) + `eventbus-recovery` (burst PENDING → drain, poison isolation,
multi-instance). STRESS requires explicit `--stress`.

## 11. Dataset generator

Deterministic synthetic data: run-prefixed users (`perf<runid>_sm/_fin/_lg*`), products,
availability, canonical quote→checkout→sale→order chains, payments, idempotency keys,
outbox events. No PII / PAN / CVV / production credentials / production JWTs.

## 12. Isolation

Each run targets an isolated `travelhub_perf_*` database (created + migrated before the run;
harness guard refuses canonical/production names). Synthetic rows are run-prefixed and
deleted deterministically in dependency order (users → idempotency slots → payments →
orders → sales → availability → checkouts → quotes → products → outbox). Cleanup failures
are visible (exit 3) — never hidden.

## 13. Environment metadata

`environment.json` per run: runId, timestamp, git SHA/branch/dirty, Node version,
PostgreSQL version, OS/platform/arch/CPU/memory, DB name + host class, profile, seed,
dataset class, app/worker instance counts, worker interval/batch, request timeout,
logging mode. Secrets scrubbed (`sanitizeMetadata`).

## 14. Result format

`backend/artifacts/performance/<run-id>/{summary,environment,scenario,correctness}.json`
(gitignored). `summary.json` verdict separates: harnessExecution (PASS/FAIL),
correctness (PASS/FAIL), measurement (RECORDED), sloQualification
(NOT EVALUATED — AUTHORITY REQUIRED). Never emits a production SLO PASS.

## 15. Route / workload matrix (real routes, verified)

- `GET /api/v1/public/products?limit=5` (public)
- `GET /api/v1/public/categories` (public)
- `GET /api/v1/auth/session` (public probe)
- `POST /api/v1/auth/login` (scripted probe, distinct users, throttle-respecting)
- `GET /api/v1/sales/sales`, `GET /api/v1/sales/quotes` (SALES_MANAGER)
- `GET /api/v1/customers` (admin; CRM controller is mounted at `/api/v1/customers`)
- `GET /api/v1/finance/ledger-transactions` (FINANCE)
- `POST /api/v1/finance/payments` + `Idempotency-Key` (FINANCE; payment.create)
- EventBus: outbox PENDING/Burst/drain via real app + worker

## 16. Authentication

Synthetic users created via the admin API (`POST /api/v1/users`) then logged in through the
real login flow; Bearer tokens used for authenticated load. Credentials never printed or
persisted. Login load uses distinct users (per-instance throttle respected).

## 17. Payment / idempotency

`paycreate` scenario on 8 canonical orders: 10 unique keys (2/order) → 5 Payment facts +
5 canonical business-level no-ops (PaymentService idempotent retry returns the existing
active payment, 201 — verified in `payment.service.ts`); identical retry ×3 (DB-backed
replay, same id); concurrent identical ×4 → exactly 1 fact, 0 raw 500; concurrent divergent
→ 1×201 + 1×409, 1 fact; COMPLETED idempotency slots = facts + no-op keys (12 = 7 + 5);
0 duplicate committed facts, 0 wrong replay, 0 raw 500. Fake provider NOT measured as PSP.

## 18. Booking / Order

Order lifecycle exercised through the canonical chain (quote → checkout → sale → complete →
OrderRequested → Order). 0 duplicate Orders; single `OrderCreated` per order; nested
consumer chain (OrderRequested → Order → OrderCreated → CommissionAccrualConsumer) proven
via InboxEvent dedup rows (8/8 consumed).

## 19. Finance correctness

Frozen money facts preserved (Order snapshot verbatim; `validateFrozenMoneyFact`); Payment
amount/currency from frozen Order; no duplicate Payment facts; idempotency slots exact;
no mutable-policy regeneration (no CommissionAccrual without a commission policy —
documented as policy-dependent, not an error); no Ledger/ProviderFee/Settlement/Payout
writes from load.

## 20. EventBus scenarios

- Steady/burst PENDING: 250 seeded `BookingCreated` (no consumer) exceed the default batch
  (100); worker disabled phase A → all PENDING.
- Recovery: worker enabled (fast interval) → drain 250/250 in 1335 ms (~187 events/s);
  0 residual PENDING; 0 unexpected FAILED.
- Poison isolation: exhausted non-retryable FAILED stays FAILED while others drain.
- Multi-instance: two worker-enabled apps on the same DB → 100/100 drained, 0 duplicate
  effects, advisory-lock serialization observed (no errors).
- Semantics preserved: at-least-once + Inbox/consumer idempotency; exactly-once NOT claimed.

## 21. Multi-instance

Phase C of `eventbus-recovery` boots two worker-enabled application instances against the
same isolated DB: burst drained 100/100, 0 lost, 0 duplicates, 0 raw 500. Horizontal
scalability is NOT claimed from this.

## 22. Recovery

PENDING accumulation → worker resume → drain measured (drainMs, events/s recorded in
summary/correctness). No arbitrary sleeps as the oracle — bounded polling of authoritative
DB state.

## 23. Soak

`soak` profile (default 60 s; live validation ran 30 s): 9591 requests, ~320 req/s,
0 unexpected errors, no memory/backlog growth observed. Labeled exploratory — NOT a
production endurance qualification.

## 24. Stress safety

`stress` profile (concurrency 60) requires `--stress`. Bounded duration, no unbounded ramp;
not run against production; post-run correctness + cleanup always evaluated.

## 25. Metrics

Latency p50/p95/p99/max per label (client-observed); throughput req/s + successful/s;
EventBus events/s + drain; error classification per class. Averages never primary.

## 26. DB / process observability

Harness records: PostgreSQL version, DB name/host class, connection pool defaults, worker
interval/batch, outbox backlog before/after recovery, drain timing. No superuser-only
metrics required; no index added to improve numbers.

## 27. Correctness validator

Independent of the load generator: `correctness.json` queries authoritative DB state
(payment counts per order, idempotency slots, outbox statuses, inbox dedup rows) and emits
checks + verdict. A run is never PASS merely because the load tool succeeded.

## 28. Cleanup

Run-scoped deterministic delete in dependency order; cleanup failures visible (exit 3).
Verified: after live runs the perf DB contained 0 harness rows.

## 29. Security / redaction

Loader records only status + duration (never headers/bodies/tokens/raw Idempotency-Key).
`sanitizeMetadata` redacts sensitive keys and scrubs URL credentials from artifacts.
Live-verified: `environment.json` contains no credentials.

## 30. Windows support

Harness is Node-only (global fetch), no Bash-only wrappers; validated on the Windows dev
environment via `npx ts-node`.

## 31. CI boundary

No absolute performance qualification added to CI. The 31 harness unit tests run in the
normal unit suite (fast, deterministic — they validate guard/config/classification/
percentiles/redaction/loader against a tiny local HTTP server). Shared-runner latency is not
an SLO gate.

## 32. PSP subset — deferred

```text
STEP 2.17B PSP SUBSET = DEFERRED
dependency = ADR-0015 ACCEPTED + Step 2.12B runtime/provider sandbox
```

No real PSP adapter, no provider sandbox calls, no webhook load, no signature benchmark,
no Apple/Google Pay flow, no provider rate-limit simulation as evidence.

## 33. Live validation runs (exploratory)

| Profile | Run | Requests | Result | Key numbers |
|---|---|---|---|---|
| SMOKE | smoke-1 | 3669 | PASS | 367 req/s; p95 5.7–43.1 ms; 0 unexpected |
| BASELINE | baseline-2 | 2351 | PASS | 235 req/s; p95 6.7–42.7 ms; 0 unexpected |
| PAYCREATE | paycreate-4 | 22 API ops | PASS | 7 facts/8 orders; 0 raw 500; slots=12 |
| EVENTBUS | eventbus-1 | 250 events | PASS | drain 1335 ms, 187 ev/s; poison isolated; multi-instance 100/100 |
| BURST | burst-1 | 7720 | PASS | ~1544 req/s; 0 unexpected |
| SOAK (30 s) | soak-1 | 9591 | PASS | ~320 req/s; 0 unexpected |

All EXPLORATORY / HARNESS VALIDATION — NOT production SLOs, NOT capacity targets.

## 34. Failures / findings (not cherry-picked)

- **F1 (harness)**: `crm.customers` step used `/api/v1/crm/customers`; the CRM controller is
  mounted at `/api/v1/customers` → 404 unexpected-4xx storm in baseline-1. Fixed path +
  hardened `loadRunChecks` to fail on ANY unexpected 4xx/409/429 (a broken step template is
  a harness defect, not a green run).
- **F2 (expectation model)**: paycreate initially assumed a second Idempotency-Key on an
  order with an active payment → controlled 409. Ground truth (verified in
  `payment.service.ts` + 2.12H contract): `PaymentService.createPayment` is business-
  idempotent per order — active payment exists → returns the existing fact (201 no-op);
  P2002 → 409 only on a genuine race. Checks rewritten to assert 0 duplicate facts and
  `COMPLETED slots = facts + no-op keys`.
- **F3 (expectation model)**: `commissionAccruals >= 1` is invalid without a commission
  policy; the nested-chain proof now uses OrderCreated + InboxEvent consumer rows.
- **F4 (reporting)**: corrected exit-code/verdict wiring (harnessExecution vs correctness
  vs cleanup) — verified: guard→2, exec-fail→1, PASS→0.

## 35. Fixes

All four findings above are harness-code fixes within Step 2.17B scope (no application
behavior changed). Regression re-run after fixes: full suite green.

## 36. Regression

- backend: tsc 0; build OK; unit **714/714** (683 + 31 perf harness); serial e2e
  **1194/1194** (69 suites: 592 + 602).
- frontend: tsc 0; vitest **135/135**; production build OK (0 files changed).
- DB: migrate 58/58 up to date; live-vs-schema diff = "No difference detected" (drift 0);
  perf DB dropped after validation.
- artifact integrity: checker regression 13/13; real checker **PASS=135 WARN=0 FAIL=0**.

## 37. Artifact integrity

`PASS=135 WARN=0 FAIL=0` (real Roadmap checker), regression 13/13.

## 38. Negative checks

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

## 39. Files changed

- `backend/src/perf/run.ts` (new), `backend/src/perf/lib/*.ts` (new),
  `backend/src/perf/perf-harness.spec.ts` (new)
- `backend/package.json` (`perf:run` script)
- `.gitignore` (`backend/artifacts/performance/`)
- `docs/architecture/load-performance-qualification-2.17B.md` (tool decision + harness status)
- `docs/operations/load-performance-qualification-runbook.md` (real commands)
- `docs/prompts/PHASE_2_STEP_2.17B_LOAD_PERFORMANCE_HARNESS_IMPLEMENTATION_REPORT.md` (new)
- `docs/prompts/TravelHub_CANONICAL_IMPLEMENTATION_ROADMAP_v3.md` (Step 2.17B status)

No schema/migration/CI/application-runtime change.

## 40. Roadmap update

Step 2.17B set to:
`🚧 HARNESS IMPLEMENTATION COMPLETED — EXPLORATORY BASELINE MEASURED — FINAL SLO/LOAD AUTHORITY + QUALIFICATION + STRICT REVIEW REQUIRED` (NOT APPROVED; PSP subset deferred).

## 41. Remaining SLO authority gap

Every quantitative row remains `TBD — BUSINESS/PRODUCT/OPERATIONS AUTHORITY REQUIRED`
(availability/error objective, p95/p99 read/write latency, payment-initiation latency,
EventBus backlog drain, expected peak RPS/concurrency/users, soak duration, release
regression tolerance). No value chosen here.

## 42. Persistence

See evidence footer.

## 43. Repository Evidence

Evidence footer at the end of this document; no earlier prose uses the canonical header.

## 44. Release

`RELEASE: NOT PERFORMED — PERFORMANCE HARNESS ONLY`

## 45. NEXT

`PHASE 2 — STEP 2.17B — SLO/LOAD AUTHORITY DECISION` (then FINAL QUALIFICATION AGAINST
APPROVED TARGETS, then STRICT REVIEW). Step 2.17B Strict Review is not started in this pass.

## 46. Final statement

The measurement system is implemented, unit-tested (31 tests), and validated live across
SMOKE / BASELINE / PAYCREATE / EVENTBUS-RECOVERY / BURST / SOAK against an isolated DB.
Correctness-under-load held everywhere (0 duplicate Payment facts, 0 raw 500, 0 lost
PENDING, poison isolated, multi-instance drain clean). All measurements are exploratory —
no SLO invented, no production capacity claimed. Final Step 2.17B approval remains gated on
authority-approved SLO/load targets and final qualification.

---

REPOSITORY EVIDENCE

repository: travelhub_v1
branch: master
head: 5baa743
origin: 2861326
worktree_clean: true (of my changes)
migration_count: 58
reviewed_state: IMPLEMENTATION
reviewed_diff_base: 2861326
reviewed_diff_head: 5baa743
persistence_status: PERSISTED
persistence_sha: 5baa743
implementation_base_sha: 2861326
implementation_commit_sha: 5baa743
provenance_footer_commit_sha: acdfab1
final_head_sha: acdfab1
upstream_sha: acdfab1
push_status: PUSHED
load_tool: dependency-free Node harness (backend/src/perf/run.ts, global fetch)
load_tool_version: 1.0.0
harness_profiles: smoke/baseline/steady/peak/burst/soak/stress/paycreate/eventbus-recovery
live_validation_profiles: smoke, baseline, paycreate, eventbus-recovery, burst, soak
slo_authority_state: TBD — BUSINESS/PRODUCT/OPERATIONS AUTHORITY REQUIRED
production_slo_qualification: NOT EVALUATED — AUTHORITY REQUIRED
psp_performance_subset: DEFERRED until ADR-0015 ACCEPTED + 2.12B runtime + provider sandbox
step_2_17b_state: HARNESS IMPLEMENTATION COMPLETED — NOT APPROVED
step_2_17c_state: PLANNED — NOT STARTED
step_2_18_state: PLANNED — NOT STARTED
release_status: NOT PERFORMED
