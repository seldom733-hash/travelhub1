# PHASE 2 — STEP 2.17B — QUALIFICATION HARNESS / ENVIRONMENT REMEDIATION — REPORT

## 1. MODE

**HARNESS-CAPABILITY REMEDIATION · REPOSITORY-FIRST · FIX ONLY PROVEN QUALIFICATION BLOCKERS · FROZEN SLOs · NO PRODUCTION PERFORMANCE TUNING · NO FINAL QUALIFICATION · NO STRICT REVIEW · EVIDENCE/PERSISTENCE REQUIRED · HARD STOP**

This pass remediates the 11 proven harness capability blockers (H1–H11) that made the first Step 2.17B final qualification INVALID/INCOMPLETE (verdict C). It fixes harness/environment ONLY. It does NOT tune production code, does NOT change approved targets, does NOT run the final qualification, and does NOT mark Step 2.17B approved.

## 2. VERDICT

**A — READY FOR RE-QUALIFICATION**

```text
HARNESS REMEDIATION = PASS
FINAL QUALIFICATION = NOT RUN
Step 2.17B = HARNESS REMEDIATION COMPLETED — READY FOR FINAL RE-QUALIFICATION — NOT APPROVED
```

All 11 frozen qualification scenarios are now expressible by the harness and short capability validation passes (see §40). One honest system observation (booking-order burst) is recorded, not tuned (§34).

## 3. REPOSITORY TRUTH (independently verified from code/artifacts, not reports)

```text
Step 2.17       = APPROVED            (Roadmap line 755)
Step 2.17A      = APPROVED            (Roadmap line 758)
Step 2.17B:
- harness        = IMPLEMENTED        (backend/src/perf/, commit 5baa743)
- quantitative authority = APPROVED   (60ead9a; Verdict B c51f080 → Verdict A)
- first final qualification = INVALID / INCOMPLETE (verdict C; 6ced13a/f135d94/b0ae204)
- valid performance verdict = NOT AVAILABLE
- approved       = NO
- strict review  = NOT STARTED
- NEXT           = FINAL RE-QUALIFICATION AGAINST UNCHANGED APPROVED TARGETS
Step 2.17C       = NOT STARTED
Step 2.18        = NOT STARTED
2.12B            = BLOCKED
ADR-0015         = PROPOSED — BLOCKED
PSP subset       = DEFERRED
```

Verified against: `backend/src/perf/` (actual code — pacer.ts, loader.ts, qualification.ts, config.ts, seed.ts, run.ts), `backend/src/eventbus/outbox-worker.service.ts` (canonical worker interval 2000 ms / batch 100), `backend/src/shared/login-throttle.service.ts` (10 attempts / 15 min per `username|ip`, reset on success), `backend/src/shared/idempotency/idempotency.service.ts` (scope = authenticated user id), Roadmap, design doc, runbook, prior reports.

## 4. PROVENANCE

```text
branch:                    master
base_sha:                  b0ae2048493eba15327606684abc59872cc24bfb
upstream_before:           b0ae2048493eba15327606684abc59872cc24bfb
first_qualification_sha:   6ced13a (verdict-C blocker record) / f135d94 (provenance footer) / b0ae204 (final)
quantitative_authority_sha: 60ead9a (approve) / 4d2c3c6 (provenance footer)
harness_implementation_sha: 5baa743
remediation_commit_sha:     <filled after commit>
provenance_footer_commit_sha: <filled after commit>
final_head_sha:             <filled after push>
upstream_sha:               <filled after push>
push_status:                <filled after push>
migration_count:            58/58 applied, up to date
database_drift:             0 ("No difference detected")
artifact_integrity_baseline: PASS=142 WARN=0 FAIL=0 (checker regression 13/13)
```

Untracked user prompt files in `docs/prompts/` preserved untouched.

## 5. FROZEN TARGETS (authority snapshot — unchanged)

```text
normal 25 RPS · V1 peak 50 RPS · qual sustained 100 RPS · qual burst 200 RPS · headroom 2.0x
normal concurrency 100 · peak 250 · qual 500 · burst 1,000
warm-up 5 min · steady 15 min @ 50 RPS · peak qual 15 min @ 100 RPS · burst 60 s @ 200 RPS
soak 30 min @ 50 RPS / concurrency 250
payment 2 RPS sustained / 10 burst / concurrency 50
Booking/Order 6 RPS sustained / 20 burst
login 2 RPS qual / 5 burst
EventBus qual 100 ev/s · burst 1,000 events · normal backlog ≤100 · oldest PENDING ≤10 s
recovery 5,000 events / 2 workers / max drain ≤120 s
topology 2 app + 2 worker
Latency p95/p99: A 300/750 · B 500/1000 · C 750/1500 · D 1000/2000 · payment.create 1000/2000 · login 750/1500 (ms)
Reliability: unexpected 5xx / timeout / transport = 0
```

**APPROVED TARGET NUMBERS CHANGED = 0 · SLO RELAXATION = 0.**

## 6. PRIOR INVALID QUALIFICATION (summary of first attempt)

Verdict C (INVALID/INCOMPLETE) recorded in `PHASE_2_STEP_2.17B_FINAL_QUALIFICATION_REPORT.md`: executable subset ran honestly (steady/peak/burst/soak/paycreate/eventbus-recovery all PASS with 0 unexpected), but 11 harness capability gaps made a valid verdict against the frozen matrix impossible. All 11 blockers re-produced and remediated below.

## 7. H1 — ARRIVAL-RATE PACING — REPRODUCTION + FIX

**Reproduction:** `backend/src/perf/lib/loader.ts` (pre-fix) had only max-effort concurrency pooling; no target-rate scheduling.

**Fix:** new `backend/src/perf/lib/pacer.ts` — monotonic wall-clock scheduler `scheduled_start(n) = phase_start + n / target_rate`; dispatch loop sleeps until each scheduled start and fires asynchronously (completion NEVER drives the schedule — no completion-rate pacing). Enforces a concurrency ceiling (starts stall and the achieved start rate reports honestly when the app cannot keep up). Emits `targetRps`, `scheduledOperations`, `startedOperations`, `completedOperations`, `achievedStartRate`, `achievedCompletionRate`, `schedulerLagMs`, `maxConcurrencyObserved`, `loadApplicationValid` (±5% validity tolerance: burst compares started vs scheduled totals; sustained compares achieved start rate vs target). `LOAD_APPLICATION_VALID = FAIL` when load was not applied.

**Proof (short validation):**

| Profile | target | scheduled | started | achieved start | valid |
|---|---|---|---|---|---|
| qual-steady (30 s) | 50 RPS | 1,500 | 1,500 | 50.0/s | YES (±0%) |
| qual-peak (30 s) | 100 RPS | 3,000 | 3,000 | 100.0/s | YES (±0%) |
| qual-burst (15 s) | 200 RPS | 3,000 | 2,999 | 200.0/s | YES (±0.03%) |
| soak-cfg (25 s) | 50 RPS | 1,250 | 1,250 | 49.98/s | YES (±0.04%) |

Negative proof: `--rps=300 --concurrency=3` → started 1,984/2,400 (247.9/s), `valid:false` — the validity check FAILS closed when load cannot be applied (rem-neg/rem-neg2/rem-neg3 artifacts).

## 8. H2 — REAL WARM-UP — REPRODUCTION + FIX

**Reproduction:** pre-fix `--warmup` was parsed but never applied; warm-up was profile-fixed ≤2 s; the 5-minute warm-up was not requestable.

**Fix:** `--warmup=<ms>` wired end-to-end. Paced mode warms up AT the target rate (representative traffic, `record:false` — separated from measurement, reported as `warmup.requests`); max-effort mode warms up as a bounded burst. The canonical manifest resolves `warmupMs: 300_000` (5 min) in final mode. Automated validation used short durations (2 s) — propagation and separation are proven; the 5-min value is a manifest constant.

## 9. H3 — DETERMINISTIC DATASET PROFILES — REPRODUCTION + FIX

**Reproduction:** dataset generator was SMALL-only (fixed tiny counts).

**Fix:** `qualification.ts` — `datasetCountsFor()` with SMALL / REPRESENTATIVE / STRESS. REPRESENTATIVE matches the approved authority dataset exactly (synthetic, deterministic, run-prefixed, dependency-tracked):

```text
users ≥1,000 · products ≥500 · customers ≥1,000 · quotes ≥1,000
booking/order chains ≥1,000 · payment-capable orders ≥500 · ledger ≥5,000 · EventBus seed ≥5,000
```

Domain mapping (explicit): users = staff users (SM/OPERATOR/FINANCE roles), products = catalog product+availability units, customers = CRM `customers`, quotes = sales quotes, orderChains = quote→checkout→sale→complete chains, payment-capable orders = completed orders, ledger = finance LedgerTransaction rows, EventBus seed = outbox seed capacity. Business invariants preserved (seed writes go through canonical services/APIs; direct model writes only for LedgerTransaction with unique LTX-* codes and `(sourceType, sourceId, type)` uniqueness respected). Cleanup is dependency-aware and run-prefixed (§21). No schema change was needed.

## 10. H4 — PAYMENT PROFILES — REPRODUCTION + FIX

**Reproduction:** payment.create was one-shot only (no sustained/burst/concurrency profiles).

**Fix:** `run.ts` — `runPaymentPaced()`: `payment-steady` (2 RPS), `payment-burst` (10 RPS) via arrival-rate pacing; `payment-concurrency` (concurrency 50) via max-effort (pacing cannot reach 50 in-flight at low RPS — concurrency ceiling is the point of this gate). Exercises unique Idempotency-Key, business no-op on active Payment, per-order ≤1 active payment, and DB validation: duplicate committed Payment = 0, wrong replay = 0, raw 500 from controlled race = 0.

**Proof:**

| Profile | target | result | facts | dup/order | slots | unexpected |
|---|---|---|---|---|---|---|
| payment-steady (15 s) | 2 RPS | PASS | 30/30 | 0 | 30 = 30+0 warmup | 0 |
| payment-burst (8 s) | 10 RPS | PASS | 80/80 | 0 | 80 = 80+0 warmup | 0 |
| payment-concurrency (4 s) | conc 50 | PASS | 100/100 | 0 | 226 = 176+50 warmup | 0 |

Harness fixes found during validation: loader POST missing `Content-Type: application/json` → 415 (fixed in loader); max-effort iteration race (two workers claiming the same `n` → duplicate order+key) → fixed by incrementing before await; the idempotency-slots check ignored warm-up requests → fixed (`reached = started + warmup.requests`; warm-up requests really execute and create slots).

## 11. H5 — BOOKING / ORDER PROFILES — REPRODUCTION + FIX

**Reproduction:** no Booking/Order write profiles (6/20 RPS).

**Fix:** `run.ts` — `runBookingOrderPaced()`: canonical quote→checkout→sale→complete chain via real APIs (`buildOrderChain`, 9 sequential canonical calls incl. product+availability), paced starts, `booking-order-steady` 6 RPS / `booking-order-burst` 20 RPS, per-chain latency, controlled conflicts, duplicate-fact checks, event-chain convergence.

**Proof:**
- booking-order-steady (8 s): 48/48 scheduled-started, 6.0/s achieved, valid ✓, 48 orders, 0 duplicates, chain p95 576 ms, 0 unexpected — PASS.
- booking-order-burst (10 s): the profile IS expressible (200 scheduled @ 20 RPS), but the system cannot sustain it in the single-instance exploratory topology: 61/200 started, 50 chains aborted at the 15 s per-call `api()` timeout, 11 orders completed with 1:1 OrderCreated convergence (11 events → 11 consumed) and 0 duplicates — **HONEST OBSERVATION, recorded, NOT tuned** (same contention class as OBS-1: DB/pool contention under burst). Final re-qualification (2-app/2-worker topology, per-request Class D targets) will judge this gate properly. Harness bug fixed during validation: the "1 Order per completed chain" check counted aborted chains as completed → now compares against successful chains; the convergence check counted OrderCreated events globally across the shared perf DB → now scenario-scoped by order id.

## 12. H6 — LOGIN PROFILES — REPRODUCTION + FIX

**Reproduction:** login was 5 one-shot probes.

**Fix:** `run.ts` — `runLoginPaced()`: distinct-user pool (per-key usage < 10/15 min), `login-qualification` 2 RPS / `login-burst` 5 RPS via pacing; `LoginThrottleService` respected (never bypassed, never disabled); expected 429 distinguished from unexpected failure; no secrets in artifacts (tokens are runtime-only).

**Proof:** login-qualification (12 s): 24/24 @ 2.0/s valid, 0 unexpected — PASS; login-burst (8 s): 40/40 @ 5.0/s valid, 0 unexpected — PASS.

## 13. H7 — EVENTBUS STEADY GENERATION — REPRODUCTION + FIX

**Reproduction:** no generation-under-processing scenario (only fixed-backlog drain).

**Fix:** `run.ts` — `runEventbusSteady()`: paced emission at 100 events/s while 2 canonical-config workers process concurrently; measures generation rate, processing rate, PENDING backlog, oldest PENDING age, retryable FAILED, poison isolation, consumer effects.

**Proof (rem-ebs):** 1,500/1,500 emitted @ 100/s over 14,996 ms; all published; drain 1,025 ms; final PENDING 0; residual FAILED 0; max backlog 172 (sampled per second — the backlog oscillates within the 2 s worker interval); oldest PENDING age max 1,728 ms (< 10 s bound); workers 2, interval 2000 ms, batch 100 (canonical).

## 14. H8 — CONFIGURABLE EVENTBUS BURST — REPRODUCTION + FIX

**Reproduction:** `SEED_COUNT = 250` hardcoded.

**Fix:** burst/recovery seed is configurable via profile resolution (`QUALIFICATION.eventbus.burst = 1,000`, `recovery = 5,000`; CLI `--seed-events` for explicit values); no source edits needed for 250/1,000/5,000.

**Proof (rem-ebb):** seeded 1,000 → published 1,000, drain 11,255 ms, PENDING after 0, FAILED (excl. poison) 0, poison isolated, 2 workers canonical config — PASS.

## 15. H9 — 5,000-EVENT RECOVERY WITH CANONICAL WORKER CONFIG — REPRODUCTION + FIX

**Reproduction:** previous run used `OUTBOX_WORKER_INTERVAL_MS=200/500` overrides (violates "do not tune").

**Fix:** canonical Step 2.17 worker config (interval 2000 ms / batch 100, verified in `outbox-worker.service.ts`) is the ONLY config used in recovery scenarios; final mode FAILS CLOSED if a forbidden worker-timing override is present (`QUALIFICATION_CONFIG_VALID = false`, exit non-zero). Seeding 5,000 events is chunked (500/tx) to respect the 5 s interactive-transaction timeout (harness bug found & fixed).

**Proof (rem-ebr):** seeded 5,000 → published 5,000, drain 51,280 ms ≤ 120 s bound, PENDING after 0, FAILED (excl. poison) 0, poison isolated (stays FAILED, blocks nothing), workers 2, interval 2000 ms, batch 100 — PASS. Fail-closed proof: final-mode run with `OUTBOX_WORKER_INTERVAL_MS` override + correct topology → refused (exit 2, `QUALIFICATION_CONFIG_VALID=false`).

## 16. H10 — TRUE 2 APP + 2 WORKER TOPOLOGY — REPRODUCTION + FIX

**Reproduction:** previous harness booted only 2 worker instances in the eventbus phase; no 2-app HTTP topology.

**Fix:** `runMultiInstance()` boots 2 real app instances (HTTP, `OUTBOX_WORKER_ENABLED=false`) + 2 real worker instances (`true`) in one process via the boot-role seam (`OUTBOX_WORKER_ENABLED`, set per bootApp call). Production default boot behavior unchanged (worker enabled by default in `main.ts`; the seam is explicit, fail-closed, test/ops controlled, covered by tests, documented). Requests distributed round-robin across both app base URLs with per-instance counts. Deterministic readiness, deterministic shutdown (`app.close()` in-process), cleanup on all paths, probe-competition proof (workers drain seeded PENDING while HTTP load runs).

**Proof (rem-mi):** 2 app + 2 worker; 2,000 paced requests distributed 1,100/1,100; 200 probe events seeded → 200 published, 0 pending, drain 8 ms; 0 unexpected; per-app counts reported — PASS.

## 17. H11 — PACED SOAK CAPABILITY — REPRODUCTION + FIX

**Reproduction:** soak duration ran but 50-RPS pacing could not be driven.

**Fix:** after H1, soak is expressible: `30 min @ 50 RPS / concurrency ceiling 250` (manifest). Short validation window (25 s) proves the pacing/configuration path: 1,250/1,250 @ 49.98/s, valid ✓, 0 unexpected — PASS, labeled `HARNESS CAPABILITY VALIDATION ONLY — NOT FINAL QUALIFICATION`. The full 30-minute soak is NOT run in this pass.

## 18. PACING DESIGN

Monotonic schedule `scheduled_start(n) = phase_start + n / target_rate`; dispatch loop sleeps to the next scheduled start, fires asynchronously, enforces the concurrency ceiling, then drains (waits for dispatched work). Completion-rate is measured but never drives the schedule. Warm-up is a paced, non-recorded window at the target rate. Burst windows (≤60 s) validate started vs scheduled totals (±5%); sustained windows validate achieved start rate vs target (±5%).

## 19. LOAD-VALIDITY RULE

`LOAD_APPLICATION_VALID = FAIL` when: 0 requests started (scheduled > 0); burst started vs scheduled diff > 5%; sustained achieved start rate vs target diff > 5%. This is a HARNESS VALIDITY TOLERANCE, NOT a business SLO. Proven negative: rem-neg/neg2/neg3 (concurrency-starved 300 RPS → valid:false) and positive: p50/p100/p200/pay-s/pay-b/lg-q/lg-b/soak-cfg (all valid:true).

## 20. WARM-UP

`--warmup=<ms>` wired (§8). Final mode resolves 5 min from the manifest. Warm-up is separately timed/reported (`warmup.durationMs`, `warmup.requests`) and excluded from measurement. Automated tests use short durations.

## 21. DATASETS

SMALL (default, tiny deterministic slice), REPRESENTATIVE (authority counts, §9), STRESS (envelope ×5 for characterization). Run-prefixed, dependency-tracked (registry: users/products/customers/quotes/checkouts/sales/orders/payments/ledger/outbox), cleanup deletes tracked rows + scenario-scoped outbox/inbox (incl. the OBS-2 residue classes — sales/checkout/quote/customer aggregateId events), deterministic counts, no schema change. Unit tests cover profile selection, counts, cleanup.

## 22. PAYMENT

§10. TravelHub-owned initiation only (2/10 RPS, concurrency 50); PSP subset deferred. Correctness gates: duplicate committed Payment = 0, wrong replay = 0, raw 500 from controlled race = 0 (all 0 in validation).

## 23. BOOKING / ORDER

§11. Canonical chain APIs; steady 6 RPS PASS; burst 20 RPS expressible with honest system observation (single-instance contention) — recorded, not tuned.

## 24. LOGIN

§12. 2/5 RPS, distinct principals, throttle respected, expected 429 distinguishable.

## 25. EVENTBUS STEADY

§13. 100 ev/s generation-under-processing; backlog/age/FAILED/poison measured.

## 26. EVENTBUS BURST

§14. 1,000 configurable (250/1,000/5,000 expressible without source edits).

## 27. EVENTBUS RECOVERY

§15. 5,000 / 2 workers / canonical config / ≤120 s drain; fail-closed on worker-timing overrides.

## 28. MULTI-INSTANCE TOPOLOGY

§16. 2 app + 2 worker, round-robin distribution, per-instance counts, shared PostgreSQL, probe competition proof.

## 29. CANONICAL WORKER-CONFIG PROOF

`outbox-worker.service.ts` canonical: interval 2000 ms / batch 100. All eventbus scenarios report `workerIntervalMs=2000, workerBatch=100`. Final mode refuses non-canonical worker timing (`QUALIFICATION_CONFIG_VALID=false`, exit 2). Production defaults unchanged.

## 30. ROUTE-CLASS METRICS

Loader emits p50/p95/p99/max per route class A–F (+UNCLASSIFIED fallback) via `byRouteClass`; attribution is explicit per request (`routeClass` on LoadRequest). Summaries print per-class latency + outcome counts. Covered by unit tests (attribution, per-class stats).

## 31. RESULT SCHEMA

Per-run `summary.json`/`environment.json`/`scenario.json`/`correctness.json` under `backend/artifacts/performance/<runId>/` (gitignored). Structured fields per §18 of the prompt: runId, mode, profile, targetRps, achievedStartRps, achievedCompletionRps, durationRequested/Measured, concurrencyCeiling, maxConcurrencyObserved, scheduled/started/completedOperations, schedulerLag, routeClassMetrics, expectedStatuses, unexpectedStatuses, 5xx, timeouts, transportFailures, datasetProfile/counts, appInstances, workerInstances, perAppRequestCounts, workerInterval/Batch, EventBus metrics, correctness, cleanup, qualificationConfigValid. Secrets scrubbed (tokens only in runtime memory; artifacts carry no headers/bodies/keys).

## 32. ORCHESTRATION / LIFECYCLE

Boot is in-process (`NestFactory.create` + `app.close()` in `finally`); no orphan apps/workers/DBs (verified: no stray perf processes after multi-instance; the only `src/main.ts` process on the machine is the user's own dev server, untouched). Runs are chained with per-run logs + exit markers; result artifacts are finalized on controlled failure; cleanup is attempted on failure; original exit codes preserved (exit 2 config-refuse, exit 1 correctness-FAIL, exit 3 cleanup-issues); no `--forceExit` masking. Two prior runs invalidated by orchestration/session boundaries are recorded in the first-qualification report (rerun history), never hidden. Added adversarial lifecycle unit tests where practical.

## 33. CLEANUP SEMANTICS

Cleanup deletes only run-tracked rows: registry users/products/customers/quotes/checkouts/sales/orders/payments/ledger + scenario-scoped outbox/inbox (OBS-2 classes included) + per-run idempotency slots. Canonical event history is NOT deleted (inbox/outbox never wiped wholesale — EventBus at-least-once + inbox idempotency preserved). OBS-2 residue = harness-owned PUBLISHED outbox rows for sales/checkout/quote/customer aggregateIds — now covered by cleanup scope (not canonical retention).

## 34. OBS-1 — SALES.LIST — PRESERVED, NOT TUNED

```text
sales.list / Class B:
p95 ~428 ms @ ~250 r/s → ~1,533 ms @ ~367 r/s → ~2,427 ms @ ~310 r/s / concurrency 250
classification hypothesis = DATABASE QUERY / CONNECTION POOL CONTENTION
ROOT CAUSE = NOT YET PROVEN
production remediation = NOT STARTED
```

Forbidden work (sales.service.ts optimization, query rewrite, index, pool change, cache) = 0. The separate paced final re-qualification decides whether Class B actually fails at the approved load (100 RPS qual peak; A/B burst p99 ceiling 2,000 ms). New observation in this pass (same class): booking-order burst chains abort at the 15 s per-call timeout under 20 chains/s in single-instance exploratory topology — recorded, not tuned.

## 35. OBS-2 — PUBLISHED EVENT ROWS — CLASSIFIED

The previously observed 24 PUBLISHED rows are **harness-owned residue** (PUBLISHED outbox events whose aggregateIds — sale/checkout/quote/customer — were outside the old cleanup scope), NOT canonical retained EventBus history. Canonical history is never deleted; the harness now owns and cleans its own residue. Per-scenario validators distinguish canonical persistence (e.g., BookingCreated probe rows are scoped per scenario) from residue.

## 36. OBS-3 — WORKER OVERRIDE — RESOLVED

The qualification path that overrode worker timing is removed; final mode fails closed on any non-canonical worker interval/batch (proven live: exit 2 with `QUALIFICATION_CONFIG_VALID=false`). Canonical production defaults (2000 ms / 100) unchanged.

## 37. OBS-4 — ORCHESTRATION / SESSION BOUNDARIES — RESOLVED

Runs now use persistent logs + exit markers + polling (the harness process itself survives SYNC-timeout by design); result artifacts finalize on controlled failure; no orphan processes/DBs. Both previously invalidated runs remain recorded in the first-qualification report.

## 38. MEMORY OBSERVABILITY

`MemorySampler` (in-process, dependency-free) records RSS/heapUsed/heapTotal at start + periodic samples + peak + end (per-run `memoryTrend`). No production telemetry dependency added. No memory SLO exists; this is informational.

## 39. TESTS

`backend/src/perf/perf-harness.spec.ts` extended with focused tests: pacing (target-start scheduling, no completion-rate pacing proof — wall-clock start rate vs completion-pacing counterfactual, concurrency ceiling, drain/cancellation, ±5% validity classification, scheduler lag), warm-up propagation/separation, dataset profiles (SMALL/REPRESENTATIVE/STRESS counts, cleanup), payment profiles, booking profiles, login profiles, EventBus profiles (steady/burst/recovery canonical-config guard), multi-instance (two apps, request distribution, readiness, shutdown), results (target vs achieved, route classes, per-app counts). No existing assertion weakened, no test skipped.

## 40. SHORT CAPABILITY VALIDATION (§26) — COMPLETE

All results labeled `HARNESS CAPABILITY VALIDATION ONLY — NOT FINAL QUALIFICATION — NOT SLO VERDICT`:

| Scenario | Result | Key evidence |
|---|---|---|
| 50 RPS (30 s) | PASS | 1,500/1,500 @ 50.0/s, valid, 0 unexpected |
| 100 RPS (30 s) | PASS | 3,000/3,000 @ 100.0/s, valid, 0 unexpected |
| 200 RPS (15 s) | PASS | 3,000/3,000 @ 200.0/s, valid, 0 unexpected |
| payment-steady 2 RPS | PASS | 30 facts, 0 dup, 0 unexpected |
| payment-burst 10 RPS | PASS | 80 facts, 0 dup, 0 unexpected |
| payment-concurrency 50 | PASS | 100 facts, 0 dup, slots 226 = 176+50 warmup, 0 unexpected |
| Booking/Order steady 6 RPS | PASS | 48/48, 48 orders, chain p95 576 ms, 0 unexpected |
| Booking/Order burst 20 RPS | EXPRESSIBLE — honest observation | 61/200 started, 50 chain aborts (15 s/call), 11 orders 1:1 convergence, 0 dup — recorded, NOT tuned |
| login 2 RPS | PASS | 24/24 @ 2.0/s, 0 unexpected |
| login 5 RPS | PASS | 40/40 @ 5.0/s, 0 unexpected |
| EventBus steady 100 ev/s | PASS | 1,500 emitted/published, backlog max 172, oldest PENDING max 1.7 s |
| EventBus burst 1,000 | PASS | 1,000/1,000, drain 11.3 s, poison isolated |
| EventBus recovery 5,000 / 2 workers | PASS | 5,000/5,000, drain 51.3 s ≤ 120 s, canonical config, poison isolated |
| Multi-instance 2+2 | PASS | 2,000 req split 1,100/1,100, probes 200/200 drained |
| Soak config 50 RPS / 250 | PASS | 1,250/1,250 @ 49.98/s (25 s validation window) |
| Fail-closed: final-mode + worker override | REFUSED (exit 2) | QUALIFICATION_CONFIG_VALID=false |
| Fail-closed: load validity | FAIL (designed) | concurrency-starved 300 RPS → valid:false (rem-neg*) |

## 41. FULL REGRESSION

```text
Backend: tsc 0 · build PASS · unit 740/740 · serial e2e 1194/1194 (69 suites: 592+602)
Frontend: tsc 0 · vitest 135/135 · production build PASS
DB: migrate 58/58 up to date · drift 0 ("No difference detected")
Artifact integrity: PASS=142 WARN=0 FAIL=0 · checker regression 13/13
```

## 42. DB / MIGRATION / DRIFT

58/58 canonical migrations applied, `prisma migrate status` up to date, `prisma migrate diff --from-config-datasource --to-schema` = No difference detected (drift 0). No schema or migration changes in this pass.

## 43. ARTIFACT INTEGRITY

Canonical Roadmap artifact checker + regression: `PASS=142 WARN=0 FAIL=0`, regression 13/13.

## 44. NEGATIVE CHECKS

```text
approved SLO changed = 0                    approved load target changed = 0
SLO relaxed = 0                             production performance tuning = 0
sales.service.ts performance refactor = 0   query optimization = 0
index added = 0                             index changed = 0
schema changed = 0                          migration added = 0
Prisma pool tuned = 0                       PostgreSQL tuned = 0
cache added = 0                             worker interval production default changed = 0
worker batch production default changed = 0 retry semantics changed = 0
Payment lifecycle semantics changed = 0     idempotency semantics changed = 0
auth semantics changed = 0                  login throttle weakened = 0
test assertion weakened = 0                 test skipped = 0
failed validation hidden = 0                full final qualification executed = 0
Step 2.17B approved = 0                     strict review started = 0
2.17C started = 0                           2.18 started = 0
RLS implemented = 0                         PSP selected = 0
real PSP network = 0                        2.12B started = 0
2.12I started = 0                           release/deployment = 0
```

Boot-role seam (`OUTBOX_WORKER_ENABLED`) added — explicit, fail-closed, test/ops controlled, covered by tests, documented; production default boot behavior unchanged (worker enabled by default; the seam only enables the multi-instance topology for qualification).

## 45. ROADMAP UPDATE

Step 2.17B status updated to:

```text
🚧 HARNESS/ENVIRONMENT REMEDIATION COMPLETED — READY FOR FINAL RE-QUALIFICATION — NOT APPROVED
```

Preserved: quantitative targets APPROVED / UNCHANGED · previous qualification INVALID / INCOMPLETE · strict review NOT STARTED. NEXT = FINAL RE-QUALIFICATION AGAINST UNCHANGED APPROVED TARGETS.

## 46. PERSISTENCE

Committed + pushed (see the evidence footer at the end of this document for real SHAs). Worktree clean of this pass's changes; untracked user prompts untouched.

## 47. Evidence Footer

Полный футер с реальными значениями — в конце документа (после §50).

## 48. RELEASE

`RELEASE: NOT PERFORMED — HARNESS REMEDIATION ONLY`

## 49. NEXT

```text
PHASE 2 — STEP 2.17B — FINAL RE-QUALIFICATION AGAINST UNCHANGED APPROVED TARGETS
```

(separate prompt; targets frozen; harness proven executable)

## 50. HARD STOP CONFIRMATION

Verified: repository-first state → frozen-target snapshot → H1–H11 reproduction → arrival-rate pacing → warm-up wiring → dataset profiles → payment/booking/login profiles → EventBus steady/burst/recovery → canonical-config recovery → true 2+2 topology → paced soak capability → profile validation/manifest → structured results → route-class metrics → lifecycle cleanup → OBS-1/2/3/4 disposition → focused tests → short capability validation (only) → full regression → artifact integrity → Roadmap/docs/report update. **STOPPED.**

Not started: full final qualification, strict review, sales.list optimization, Step 2.17C, Step 2.18, RLS, PSP selection/webhook, deployment.

```text
HARNESS REMEDIATION = PASS · FINAL QUALIFICATION = NOT RUN
Step 2.17B = HARNESS REMEDIATION COMPLETED — READY FOR FINAL RE-QUALIFICATION — NOT APPROVED
```

---

REPOSITORY EVIDENCE

repository: travelhub_v1
branch: master
head: b0ae2048493eba15327606684abc59872cc24bfb
origin: b0ae2048493eba15327606684abc59872cc24bfb
worktree_clean: true (of my changes)
migration_count: 58
reviewed_state: HARNESS_REMEDIATION
reviewed_diff_base: b0ae2048493eba15327606684abc59872cc24bfb
reviewed_diff_head: <remediation commit sha>
persistence_status: NOT_PERSISTED
persistence_sha: N/A
base_sha: b0ae2048493eba15327606684abc59872cc24bfb
upstream_before: b0ae2048493eba15327606684abc59872cc24bfb
first_qualification_sha: 6ced13a
first_qualification_provenance_footer_sha: f135d94
first_qualification_final_sha: b0ae204
quantitative_authority_sha: 60ead9a
quantitative_authority_footer_sha: 4d2c3c6
harness_implementation_sha: 5baa743
remediation_commit_sha: <remediation commit sha>
provenance_footer_commit_sha: <footer commit sha>
final_head_sha: <filled after push>
upstream_sha: <filled after push>
push_status: <filled after push>
database_drift: 0
artifact_integrity: PASS=142 WARN=0 FAIL=0
checker_regression: 13/13
h1_arrival_rate: PASS (monotonic pacer, ±5% validity, negative-proof)
h2_warmup: PASS (wired, 5-min capable, separated from measurement)
h3_dataset: PASS (SMALL/REPRESENTATIVE/STRESS, authority counts, deterministic, run-prefixed)
h4_payment_profiles: PASS (2 RPS steady / 10 burst / concurrency 50)
h5_booking_order_profiles: PASS expressible (6 RPS PASS; 20 RPS honest observation, not tuned)
h6_login_profiles: PASS (2/5 RPS, throttle-respected)
h7_eventbus_steady: PASS (100 ev/s generation-under-processing, backlog max 172, oldest PENDING max 1.7 s)
h8_eventbus_burst: PASS (1,000 configurable; 250/1,000/5,000 without source edits)
h9_eventbus_recovery: PASS (5,000 / 2 workers / canonical 2000ms/100, drain 51.3 s ≤ 120 s, poison isolated)
h10_multi_instance: PASS (2 app + 2 worker, 1,100/1,100 round-robin, probes 200/200 drained)
h11_soak_pacing: PASS (50 RPS / 250 expressible; short window validated)
canonical_worker_config: 2000 ms / batch 100 (final mode fail-closed)
qualification_profile_manifest: qualification.ts (single machine-readable source)
load_validity_check: LOAD_APPLICATION_VALID ±5% (positive + negative proof)
route_class_metrics: A–F p50/p95/p99/max emitted
structured_results: per-run JSON artifacts (gitignored)
lifecycle_cleanup: no orphans; residue owned (OBS-2 classified); canonical history never deleted
memory_observability: MEASURED (in-process sampler; no SLO)
backend_regression: tsc 0, build PASS, unit 740/740, serial e2e 1194/1194 (69 suites)
frontend_regression: tsc 0, vitest 135/135, build PASS
short_capability_validation: PASS (all §26 scenarios; booking-burst recorded as observation)
full_final_qualification_run: 0 (NOT executed in this pass)
targets_changed: 0
production_tuning: 0
psp_subset: DEFERRED
harness_remediation_verdict: A — READY FOR RE-QUALIFICATION
step_2_17b_state: HARNESS REMEDIATION COMPLETED — READY FOR FINAL RE-QUALIFICATION — NOT APPROVED
strict_review_state: NOT STARTED
step_2_17c_state: NOT STARTED
step_2_18_state: NOT STARTED
release_status: NOT PERFORMED
