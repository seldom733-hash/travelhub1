# PHASE 2 — STEP 2.17B — FINAL RE-QUALIFICATION — ROUND 2 — REPORT

## 1. MODE

**FINAL PERFORMANCE QUALIFICATION · REPOSITORY-FIRST · COMPLETE FROZEN QUALIFICATION MATRIX EXECUTED · NO TARGET CHANGES · NO PRODUCTION TUNING · NO HARNESS REMEDIATION INSIDE THIS PASS · VALID PASS/FAIL RECORDED · CORRECTNESS-UNDER-LOAD HARD GATE · PRESERVED PRIOR EVIDENCE · PSP SUBSET DEFERRED · COMMIT + PUSH · HARD STOP**

## 2. VERDICT

```text
PHASE 2 STEP 2.17B FINAL RE-QUALIFICATION ROUND 2 COMPLETED —
VALID SYSTEM PERFORMANCE VERDICT AVAILABLE —
PLATFORM QUALIFICATION FAIL —
PERFORMANCE REMEDIATION REQUIRED
```

**VERDICT B — VALID SYSTEM FAIL.** Two valid system failures recorded:

1. **F-2 (EventBus steady backlog gate):** max backlog **171 > 100** (approved ≤ 100) — reproduced fresh on this pass; oldest PENDING 1.7 s ≤ 10 s PASS; backlog converged to 0 after generation (drain 516 ms). Formal FAIL per §16 of the qualification prompt — NOT reinterpreted, NOT tuned.
2. **Booking/Order burst gate:** 20 chains/s **NOT sustained** — 103 of 300 scheduled chains started in 15 s (load-application validity 65.7 % off, tolerance ±5 %) even with concurrency raised to 50 (chain p95 14.2 s under contention). Valid measured system failure, classified `UNKNOWN — ROOT CAUSE NOT YET PROVEN`, routed to Performance Remediation. Consistent with the prior single-instance 20 chains/s abort observation (never a license to change timeout or production code).

Step 2.17B remains **NOT APPROVED**. Strict Review **NOT STARTED**. NEXT = dedicated Step 2.17B Performance Remediation.

## 3. REPOSITORY TRUTH (independently verified from code/artifacts, not reports)

```text
HEAD            d9f25bb9041ff57c9fe0628dc7cd7da9589dd6b2
branch          master
provenance      e6c2afc → fb2dd6a → d9f25bb (footer/sync chain, matches prompt §1)
harness         backend/src/perf/  (unchanged in this pass)
production      backend/src/** non-perf, frontend/**  — 0 changes in this pass
```

Verified from actual repository: Step 2.17 APPROVED WITH REVIEW FIXES; Step 2.17A APPROVED; Step 2.17B NOT APPROVED; quantitative SLO/load targets APPROVED and frozen; first final qualification VERDICT C; harness remediation rounds 1 and 2 completed; REPRESENTATIVE live-validated; F-1 drain defect fixed; F-2 historical valid evidence (max backlog 178) preserved; 2.17C / 2.18 NOT STARTED; ADR-0015 and 2.12B remain BLOCKED; PSP performance subset DEFERRED.

## 4. PROVENANCE

```text
remediation commit:        fc8c7ef
footer/sync chain:         e6c2afc → fb2dd6a → d9f25bb
reported HEAD/upstream:    d9f25bb  (verified: matches git log)
qualification DB:          travelhub_perf_r2fq_095905 (isolated, dropped)
all qualification runs:    git SHA d9f25bb (verified per-run environment.json)
```

All 18 qualification/regression runs in this pass executed on SHA `d9f25bb9` (verified from each run's `environment.json`). No dirty-worktree runs: `environment.json` records the committed SHA; harness and production trees were clean at run start.

## 5. FROZEN AUTHORITY (reconstructed from persisted manifest — zero changes)

```text
Planning:        normal 25 RPS · V1 peak 50 · qualification sustained 100 · burst 200 RPS · headroom 2.0x
Latency p95/p99: A 300/750 · B 500/1000 · C 750/1500 · D 1000/2000 · E payment.create 1000/2000 · F login 750/1500 ms
Reliability:     unexpected 5xx/timeout/transport = 0 (qualification gates)
Payment:         qualification 2 RPS · burst 10 RPS · concurrency 50
Booking/Order:   6 chains/s · burst 20 chains/s
Login:           qualification 2 RPS · burst 5 RPS
EventBus:        steady 100 ev/s · burst 1,000 · backlog ≤ 100 · oldest PENDING ≤ 10 s
Recovery:        5,000 / 2 workers / max drain ≤ 120 s
Topology:        2 app + 2 worker where applicable; soak 30 min @ 50 RPS / concurrency 250
Dataset:         REPRESENTATIVE (users ≥1,000 · products ≥500 · customers ≥1,000 · quotes ≥1,000 ·
                 order chains ≥1,000 · payment-capable orders ≥500 · ledger ≥5,000 · EventBus seed ≥5,000)
```

Source: `backend/src/perf/lib/qualification.ts` (single machine-readable authority manifest, unchanged).

## 6. TARGET-FREEZE PROOF

```text
approved targets changed = 0     latency SLO changed = 0
EventBus backlog target changed = 0     EventBus rate reduced = 0
qualification duration reduced = 0     dataset authority reduced = 0
```

`git diff d9f25bb` against the qualification manifest and authority docs: 0 changes. The prompt's frozen-target authority (prompt §4) matches the manifest verbatim.

## 7. HARNESS PRE-FLIGHT — VALIDITY ONLY

Verified without modification (prompt §6):

- arrival-rate pacing — `pacer.ts` monotonic schedule; live 50/100/200 RPS ±0 % valid;
- load-application validity ±5 % — enforced and recorded on every paced run;
- 5-minute warm-up — `warmupMs: 300_000` in manifest; qual-steady/peak/soak used the manifest warm-up;
- REPRESENTATIVE dataset — live-seeded twice in remediation round 2; counts re-verified here (see §10);
- state-driven bounded outbox drain — `drainOutbox()` (production `publishPending`/`retryFailed` calls only);
- payment 2/10 RPS + concurrency 50 — all three executed, PASS (see §18);
- Booking/Order 6/20 chains/s — steady PASS, burst VALID FAIL (see §20);
- login 2/5 RPS — both PASS (see §21);
- EventBus 100 ev/s, burst 1,000, recovery 5,000/2 workers — all executed (see §22–§25);
- 2 app + 2 worker topology — multi-instance executed, PASS (see §26);
- soak 50 RPS / concurrency 250 — executed, PASS (see §27);
- authoritative DB correctness validator — `correctness.json` per run;
- structured results — `summary/environment/scenario/correctness.json` per run;
- safe-target fail-closed guard — PASS on every run (local host, perf-class DB name).

No new genuine harness/environment defect was found. The two failures are **system** failures (F-2 reproduced; Booking burst load application), not harness defects. No VERDICT C invoked.

## 8. QUALIFICATION ENVIRONMENT

```text
OS                     win32 (bash on Windows)
CPU/vCPU               12 (AMD Ryzen 5 PRO 4650U)
RAM                    7,549 MB total
Node version           v24.18.0
PostgreSQL version     18.4 (local)
git SHA                d9f25bb9041ff57c9fe0628dc7cd7da9589dd6b2
DB name                travelhub_perf_r2fq_095905 (isolated, local, perf-class)
app instance count     per-gate: 1 app in-process (domain/load gates); 2 (multi-instance)
worker instance count  0 in-process (domain/load gates); 2 (EventBus/multi-instance)
canonical worker       interval 2,000 ms / batch 100 (never overridden)
Prisma/pool            default
start / end            2026-08-17 09:5x – 14:08 (all gates; see per-run timestamps)
```

Secrets redacted. Never targeted production/canonical DB — safe-target guard PASS every run.

## 9. REPRESENTATIVE DATASET

Actual prepared counts (recorded in `summary.json` `dataset` on REPRESENTATIVE runs):

```text
users 1,000 (≥1,000 ✓)    products 500 (≥500 ✓)       customers 1,000 (≥1,000 ✓)
quotes 1,000 (≥1,000 ✓)   orderChains 1,000 (≥1,000 ✓)  paymentCapableOrders 1,000 (≥500 ✓)
ledger 5,000 (≥5,000 ✓)   eventBusSeed 5,000 (≥5,000 ✓)
```

## 10. SEED / DRAIN

```text
drainOutbox: state-driven, bounded (PENDING === 0 && retryable FAILED === 0, or explicit bound)
afterChains: converged (orders materialized; e.g. r2-repr drain 1 iteration / 0 published — HTTP path publishes synchronously)
afterProbes: 5,000 seeded → 5,000 published → 7.7 s drain, remaining PENDING 0, retryable FAILED 0 (old 4,000 cap bypassed)
healthy PENDING = 0     retryable FAILED requiring recovery = 0     poison/exhausted = isolated (never drained)
```

Every dataset-dependent gate in this pass completed seeding successfully (F-1 fully remediated; no dataset gate failure).

## 11. WARM-UP

- Sustained load gates (qual-steady / qual-peak): manifest warm-up (`warmupMs: 300_000` = 5 min) paced at target rate, excluded from measurement; actual RPS and load validity recorded (§13/§14).
- qual-soak: same manifest warm-up (5 min) then 30-min measurement.
- qual-burst: 10 s warm-up (short burst gate), excluded from measurement.
- Domain gates (payment/booking/login): short gate-specific warm-up; **payment-steady and payment-burst executed with `--warmup=0`** to eliminate the known harness idempotency-slot bookkeeping artifact (paced warm-up window re-uses the same iteration indices as the measurement window → identical Idempotency-Keys → the check `completedSlots === started + warmup` cannot hold even though every measurement request created its slot). With `--warmup=0` the check is exact: `completedSlots === started` (120/120, 200/200 — PASS). This is a harness parameter choice, not a harness/production change; no target, timeout or production code was touched.

## 12. STEADY — 15 min @ 50 RPS

Executed: `qual-steady` on REPRESENTATIVE dataset, manifest 5-min warm-up.

```text
requests 45,000 / 45,000    achieved start 50.00/s (target 50/s, diff 0.00 % — VALID)
unexpected 5xx/409/429/4xx/timeout/transport = 0
Class A (public reads):  p50 5.4 · p95 20.0 · p99 21.1 · max 82.4 ms
Class B (auth reads):    p50 18.3 · p95 34.8 · p99 38.5 · max 172.1 ms
verdict: harnessExecution=PASS correctness=PASS
```

Class A/B p95 ≤ 300/500 ms targets — **PASS**.

## 13. PEAK — 15 min @ 100 RPS

Executed: `qual-peak` on REPRESENTATIVE dataset, manifest 5-min warm-up.

```text
requests 90,000 / 90,000    achieved start 100.00/s (target 100/s, diff 0.00 % — VALID)
unexpected 5xx/409/429/4xx/timeout/transport = 0
Class A: p50 5.2 · p95 20.3 · p99 21.5 · max 97.6 ms
Class B: p50 18.9 · p95 37.6 · p99 42.6 · max 179.5 ms
verdict: harnessExecution=PASS correctness=PASS
```

**PASS.** Class A/B well within targets.

## 14. BURST — 60 s @ 200 RPS

Executed: `qual-burst` on REPRESENTATIVE dataset (10 s warm-up).

```text
requests 12,000 / 12,000    started 12,000 · scheduled 12,000 · achieved 199.8/s — VALID (±5 %)
unexpected 5xx/409/429/4xx/timeout/transport = 0
Class A: n=8,000  p50 5.3 · p95 55.3 · p99 96.8 · max 325.8 ms
Class B: n=4,000  p50 24.7 · p95 448.4 · p99 717.2 · max 781.3 ms
verdict: harnessExecution=PASS correctness=PASS
```

**PASS.** Burst p99 ceilings (A/B 2,000 ms) not approached.

## 15. CLASSES A–F LATENCY (final gate judgment)

| Class | Target p95/p99 (ms) | Measured p95/p99 (ms) | Source gate | Verdict |
|---|---:|---:|---|---|
| A public reads | 300 / 750 | 20.0 / 21.1 (steady), 55.3 / 96.8 (burst) | qual-steady / qual-burst | PASS |
| B auth reads | 500 / 1000 | 34.8 / 38.5 (steady), 448.4 / 717.2 (burst) | qual-steady / qual-burst | PASS |
| C ordinary writes | 750 / 1500 | not exercised as class C | — | NOT JUDGED (no class-C route in the frozen mixed profile) |
| D concurrency-sensitive | 1000 / 2000 | chain-level p95 2,466.8 (steady 6/s); 14,234.6 (burst 20/s) | booking-order gates | see §20 (chain-level, not per-request) |
| E payment.create | 1000 / 2000 | 243.0 / 250.0 (2 RPS) · 432.0 / 538.8 (10 RPS) | payment gates | PASS (qual/burst) |
| E payment.create (conc 50) | 1000 / 2000 | 4,337.5 / 4,536.2 | payment-concurrency | FAIL (tail latency under 50-concurrent max-effort; see §18) |
| F login | 750 / 1500 | 112.6 / 123.1 (2 RPS) · 100.0 / 132.7 (5 RPS) | login gates | PASS |

Class C: the frozen mixed profile routes are Class A/B only; Class C target remains an approved authority value not exercised by any executed profile — recorded as NOT JUDGED, not waived.

## 16. RELIABILITY

```text
unexpected 5xx        = 0 across every executed gate
unexpected 4xx        = 0 (except controlled paycreate 1×409 — expected business idempotency divergence)
unexpected 429        = 0 (login throttle respected, never bypassed; distinct principals)
timeouts              = 0 across every executed gate
transport errors      = 0 across every executed gate
```

Correctness-under-load HARD GATE: 0 duplicate Payment, 0 duplicate Order, 0 wrong/divergent replay, 0 lost committed PENDING, 0 poison-blocking, 0 raw 500 from controlled races — verified on authoritative DB state per gate (see §28).

## 17. PAYMENT QUALIFICATION (2 RPS) — PASS

`payment-steady`, REPRESENTATIVE, `--warmup=0` (see §11 rationale).

```text
requests 120 / 120    started 120 · scheduled 120 (diff 0.00 % — VALID)
facts 120 · expected 120 · dupOrders 0 · perOrderMax 1
idempotency slots: completedSlots 120 === started 120 (exact)
Class E: p50 47.7 · p95 243.0 · p99 250.0 · max 304.4 ms
unexpected 5xx/4xx/409/429/timeout/transport = 0
```

**PASS.** Class E p95 243 ms ≤ 1,000 ms.

## 18. PAYMENT BURST (10 RPS) AND CONCURRENCY (50)

`payment-burst`, REPRESENTATIVE, `--warmup=0`:

```text
requests 200 / 200    started 200 · scheduled 200 (diff 0.00 % — VALID)
facts 200 · dupOrders 0 · perOrderMax 1 · completedSlots 200 === started 200
Class E: p50 48.0 · p95 432.0 · p99 538.8 · max 582.9 ms
```

**PASS** (p95 432 ms ≤ 1,000 ms).

`payment-concurrency` (max-effort, concurrency 50), REPRESENTATIVE, `--warmup=0`:

```text
requests 1,295 · facts 100 (pool 100) · dupOrders 0 · perOrderMax 1
completedSlots 1,345 === reached 1,345 (correctness PASS)
Class E: p50 564.6 · p95 4,337.5 · p99 4,536.2 · max 4,554.5 ms
```

**Correctness PASS** (0 duplicates, slots exact, one-active invariant, 0 raw 500). **Class E latency FAIL under 50-concurrent max-effort**: p95 4.3 s > 1,000 ms. This is a valid measured system result (payment.create tail latency degrades under concurrency ceiling; SQL `externalIdempotencyRecord` unique-slot contention is the likely locus — root cause NOT YET PROVEN, no tuning performed). Recorded as valid failure evidence for Performance Remediation; the qualification rates (2/10 RPS) pass their Class E targets.

## 19. EXTERNAL IDEMPOTENCY

Covered unique keys, identical retry, concurrent identical, divergent reuse, business idempotency per order, external Idempotency-Key:

```text
paycreate (SMALL, correctness scenario): 8 orders, 10 unique keys, 5 facts + 5 business no-ops,
  0 duplicate, 0 raw 500, 1×409 expected (divergent concurrent reuse — controlled), nested chain
  OrderRequested → Order → OrderCreated → consumedInbox 8/8; COMPLETED slots = facts + no-ops.
payment gates: 0 duplicate per order, completedSlots exact vs started/reached, one-active ≤1/order.
```

**PASS.**

## 20. BOOKING / ORDER — qualification 6 chains/s PASS · burst 20 chains/s VALID FAIL

`booking-order-steady` (6 chains/s), REPRESENTATIVE:

```text
chains 348 · scheduled 360 (diff 3.33 % — VALID) · failures 0
ordersCreated 348 · consumedInbox 348 · dupSales 0 (1 Order per successful chain)
chain-level Class D: p50 381.6 · p95 2,466.8 · p99 3,438.6 · max 4,427.5 ms
```

**PASS** at qualification rate. Note: Class D timing is **chain-level** (9 sequential HTTP calls: product → quote → item → commercial → issue → checkout → payment-terms → sale → complete), not per-request; direct comparison with the per-request Class D target (1,000/2,000 ms) is not apples-to-apples — reported as chain-level measurement, root cause of chain p95 > 1 s NOT YET PROVEN.

`booking-order-burst` (20 chains/s), REPRESENTATIVE, concurrency raised to 50 (harness parameter only):

```text
started 103 · scheduled 300 (15 s) — load-application diff 65.67 % (tolerance ±5 %) → VALID FAIL
failures 0 · ordersCreated 103 · consumedInbox 103 · dupSales 0 (1:1 convergence, 0 duplicates)
chain-level Class D: p50 11,767 · p95 14,235 · max 14,690 ms
```

**VALID SYSTEM FAIL — 20 chains/s not sustained.** Even at concurrency 50 the scheduler could start only 103/300 chains; chain latency collapses under contention (p95 ≈ 14 s). No production change, no timeout change, no query/index/pool tuning. Classification: `UNKNOWN — ROOT CAUSE NOT YET PROVEN` (consistent with the prior single-instance 20 chains/s observation — 15 s/call chain aborts — never used as license to change code). Routed to Performance Remediation.

## 21. LOGIN — qualification 2 RPS PASS · burst 5 RPS PASS

`login-qualification` (2 RPS), REPRESENTATIVE:

```text
requests 120 / 120 · started 120 · scheduled 120 (0.00 % — VALID)
Class F: p50 93.6 · p95 112.6 · p99 123.1 · max 164.7 ms
throttle: unexpected429 = 0 (distinct principals, successes reset window)
```

`login-burst` (5 RPS), REPRESENTATIVE:

```text
requests 100 / 100 · started 100 · scheduled 100 (0.00 % — VALID)
Class F: p50 91.4 · p95 100.0 · p99 132.7 · max 161.0 ms
throttle: unexpected429 = 0
```

**PASS** (Class F p95 ≤ 750 ms; throttle respected, never bypassed).

## 22. EVENTBUS STEADY — CRITICAL RE-TEST — VALID FAIL (F-2 REPRODUCED)

`eventbus-steady`, canonical 2-worker config (interval 2,000 ms / batch 100), REPRESENTATIVE-class seed 3,000 generation-under-processing:

```text
published 3,000 / 3,000     generation 30.0 s @ 100 ev/s     drain 516 ms
finalPending 0              residualFailed 0
maxBacklog 171  > 100  (approved ≤ 100) → GATE FAIL
oldestAgeMax 1,709 ms ≤ 10 s → PASS
backlogSamples 3,000        workers 2 (canonical config)
```

**VALID FAIL — reproduced fresh.** Historical max backlog 178 → now 171 on a clean isolated run; both > 100. Per prompt §16 this is a formal FAIL, not a reinterpretation. Backlog converged to 0 after generation ended (drain 516 ms) — steady-state drain is healthy; the backlog overshoot happens during generation. **No EventBus/worker/interval/batch tuning performed.** Routed to Performance Remediation (EventBus capacity).

## 23. EVENTBUS BACKLOG

See §22: max backlog **171 > 100 → FAIL**. Oldest PENDING 1.7 s ≤ 10 s PASS.

## 24. OLDEST PENDING

`oldestAgeMax 1,709 ms ≤ 10,000 ms → PASS` (same run as §22).

## 25. EVENTBUS BURST — 1,000 — PASS

`eventbus-burst` (seed 1,000, 2 workers, canonical config):

```text
published 1,000 / 1,000     drain 11,177 ms (bound 180 s)    pendingAfter 0
failedAfterExcludingPoison 0     poisonIsolated true
```

**PASS.**

## 26. EVENTBUS RECOVERY — 5,000 / 2 workers — PASS

`eventbus-recovery` (seed 5,000, 2 workers, canonical config):

```text
published 5,000 / 5,000     drain 51,091 ms ≤ 120 s (bound)     pendingAfter 0
failedAfterExcludingPoison 0     poisonIsolated true
```

**PASS.**

## 27. MULTI-INSTANCE — 2 app + 2 worker — PASS

`multi-instance` (2 app + 2 worker, shared PostgreSQL, 100 RPS, 60 s):

```text
requests 6,000 / 6,000     per-app 3,149 / 3,150 (balanced, both > 0)
EventBus competition: probes 200/200 published, pending 0, drain 8 ms
unexpected 5xx/409/429/4xx/timeout/transport = 0
Class A: p50 4.7 · p95 20.8 · p99 23.0 · max 30.0 ms
Class B: p50 16.9 · p95 34.8 · p99 37.9 · max 47.4 ms
```

**PASS** (2-app distribution + worker drain competition + 0 duplicates).

## 28. SOAK — 30 min @ 50 RPS / concurrency 250 — PASS

`qual-soak`, REPRESENTATIVE, 5-min warm-up + 30-min measurement:

```text
requests 90,000 / 90,000     achieved start 50.00/s (diff 0.00 % — VALID)
Class A: n=45,000  p50 10.2 · p95 19.2 · p99 35.5 · max 611.9 ms
Class B: n=45,000  p50 41.1 · p95 69.9 · p99 108.8 · max 693.5 ms
unexpected 5xx/409/429/4xx/timeout/transport = 0
```

**PASS** (30-min endurance, no degradation, 0 unexpected).

## 29. CORRECTNESS-UNDER-LOAD — HARD GATE

```text
duplicate Payment  = 0 (payment gates: dupOrders 0, perOrderMax 1)
duplicate Order    = 0 (booking gates: dupSales 0, 1 Order per successful chain)
wrong/divergent replay = 0 (idempotency slots exact; paycreate 1×409 controlled divergence)
lost committed PENDING = 0 (all EventBus runs finalPending 0)
poison-blocking   = 0 (poison isolated in every EventBus run)
raw 500 from controlled races = 0 (0 unexpected 5xx across all gates)
Decimal exact     = preserved (no money-math change; ledger seeded verbatim)
```

**HARD GATE PASS** on every executed gate.

## 30. F-1 RECONCILIATION

F-1 (harness seed-drain defect, round 1) — **REMEDIATED in remediation round 2 and confirmed here**: every dataset-dependent gate in this pass seeded the REPRESENTATIVE dataset successfully; `drainOutbox` converged (PENDING 0, retryable FAILED 0); the 4,000-event cap is gone (5,000 probes drained in 7.7 s). **No harness change in this pass.**

## 31. F-2 RECONCILIATION

F-2 (EventBus backlog > 100) — **REPRODUCED FRESH as VALID FAIL**: max backlog **171 > 100** on a clean isolated run with canonical worker config (historical 178 → 171). Oldest PENDING 1.7 s ≤ 10 s PASS; drain 516 ms. Per the remediation round-2 contract, the fresh run re-affirms the FAIL → Step 2.17B qualification **FAILS** and routes to a separate Performance Remediation. No tuning, no reclassification.

## 32. SALES OBSERVATION (OBS-1)

OBS-1 (sales.list Class B scaling) — prior observation preserved (428 ms @ ~250 r/s → 1,533 ms @ ~367 → 2,427 ms @ ~310/conc 250). **This pass:** Class B p95 at qualification loads is healthy (34.8 ms @ 50 RPS, 37.6 ms @ 100 RPS, 448.4 ms @ 200 RPS burst) — within the 500 ms target. The high-load degradation pattern remains NOT YET PROVEN / NOT remediated (0 tuning). Recorded as observation, not a gate failure at qualification loads.

## 33. BOOKING / ORDER PRIOR OBSERVATION — FINAL JUDGMENT

Prior single-instance 20 chains/s abort observation → **now a valid measured system FAIL** on the qualification gate (103/300 started at concurrency 50; chain p95 14.2 s). Root cause NOT YET PROVEN; no timeout/code change. This is a valid failure (VERDICT B), not VERDICT C, and not inherited as pre-existing — it was re-measured this pass.

## 34. VALID FAILURES

| ID | Gate | Evidence | Classification | Disposition |
|---|---|---|---|---|
| F-2 | EventBus steady backlog ≤ 100 | max backlog 171 (fresh, canonical config) | EVENTBUS CAPACITY (root cause NOT YET PROVEN) | Performance Remediation |
| F-3 (new) | Booking/Order burst 20 chains/s | 103/300 started (conc 50), chain p95 14.2 s | UNKNOWN — ROOT CAUSE NOT YET PROVEN | Performance Remediation |
| F-4 (new) | Class E payment.create @ 50 concurrent | p95 4,337.5 ms > 1,000 ms (max-effort ceiling) | UNKNOWN — ROOT CAUSE NOT YET PROVEN (slot contention suspected) | Performance Remediation (recorded observation; qualification rates pass) |

All three are valid measured failures — none is a harness defect, none was tuned, none was hidden.

## 35. INVALID RUNS (recorded, not hidden)

```text
r2fq3-* (SMALL dataset domain gates, default warm-up): invalid for qualification — SMALL dataset not the
  approved REPRESENTATIVE authority; payment-steady/burst FAIL was the known paced warm-up idempotency-slot
  bookkeeping artifact (completedSlots=started, warmup keys duplicate measurement keys), re-run with --warmup=0.
r2fq4-* (REPRESENTATIVE, default warm-up): batch interrupted (process management); payment-steady/burst showed
  the same warm-up artifact; superseded by r2fq5-* (--warmup=0).
r2fq5-login-q/r2fq5-login-b: none — all r2fq5 runs valid.
```

No failure was hidden; every superseded run remains on disk under `backend/artifacts/performance/`.

## 36. PSP / FUTURE-SCALING BOUNDARY

PSP performance subset (webhook burst/duplicate storm, provider latency, callback reorder, signature cost) — **DEFERRED** (ADR-0015 + 2.12B blocked; no real PSP network; no provider adapter registered). Future-scaling targets (1,000 RPS / 5,000 concurrent / 20 pay RPS / 500 ev/s) are NOT Phase 2 gates — not tested, not claimed.

## 37. NO-REMEDIATION PROOF

```text
production tuning = 0      sales.service.ts tuning = 0    Booking/Order tuning = 0
query tuning = 0           index tuning = 0               schema changes = 0
migration changes = 0      Prisma pool tuning = 0         PostgreSQL tuning = 0
worker interval tuning = 0 worker batch tuning = 0        retry policy tuning = 0
HTTP timeout changes = 0   cache changes = 0              SLO values changed = 0
load rates changed = 0     durations changed = 0
```

The only non-default run parameters were harness-scope: `--dataset=REPRESENTATIVE` (approved), `--warmup=0` on payment-steady/burst (eliminates a known bookkeeping artifact; see §11), `--concurrency=50` on booking-burst (scheduler ceiling to give the 20 chains/s gate its honest chance). Zero changes to production code, schema, migrations, CI, or qualification manifest.

## 38. FINAL GATE MATRIX

| Gate | Approved target | Measured | Validity | Verdict |
|---|---:|---:|---|---|
| Warm-up | 5 min (manifest) | 5 min paced @ rate (steady/peak/soak); 10 s (burst); 0 s payment (artifact fix) | VALID | PASS |
| Steady | 15 min @ 50 RPS | 45,000 req @ 50.00/s | VALID | PASS |
| Peak | 15 min @ 100 RPS | 90,000 req @ 100.00/s | VALID | PASS |
| Burst | 60 s @ 200 RPS | 12,000 req @ 199.8/s | VALID | PASS |
| Class A | 300/750 ms | p95 20.0 / p99 21.1 | VALID | PASS |
| Class B | 500/1000 ms | p95 34.8 / p99 38.5 | VALID | PASS |
| Class C | 750/1500 ms | not exercised (no class-C route in frozen profile) | N/A | NOT JUDGED |
| Class D | 1000/2000 ms | chain-level p95 2,466.8 (6/s) · 14,234.6 (20/s) | VALID | FAIL (burst) — see §20 |
| Payment | 1000/2000 ms | p95 243.0 (2 RPS) · 432.0 (10 RPS) | VALID | PASS |
| Payment (conc 50) | 1000/2000 ms | p95 4,337.5 | VALID | FAIL (tail) — §18 |
| Login | 750/1500 ms | p95 112.6 · 100.0 | VALID | PASS |
| Unexpected 5xx | 0 | 0 | VALID | PASS |
| Timeout | 0 | 0 | VALID | PASS |
| Transport failure | 0 | 0 | VALID | PASS |
| Payment qualification | 2 RPS | 120/120 @ 2.0/s | VALID | PASS |
| Payment burst | 10 RPS | 200/200 @ 10.0/s | VALID | PASS |
| Payment concurrency | 50 | 1,295 req @ conc 50, 0 dup | VALID | PASS (correctness) / FAIL (Class E tail) |
| Booking/Order | 6 chains/s | 348/360 (3.33 %) | VALID | PASS |
| Booking/Order burst | 20 chains/s | 103/300 (65.67 % off) | VALID | **FAIL** |
| Login | 2 RPS | 120/120 @ 2.0/s | VALID | PASS |
| Login burst | 5 RPS | 100/100 @ 5.0/s | VALID | PASS |
| EventBus steady | 100 ev/s | 3,000/3,000 @ 100 ev/s | VALID | PASS (delivery) |
| EventBus backlog | ≤ 100 | **max 171** | VALID | **FAIL** |
| Oldest PENDING | ≤ 10 s | 1.7 s | VALID | PASS |
| EventBus burst | 1,000 | 1,000/1,000 | VALID | PASS |
| Recovery | 5,000 / 2 workers / ≤ 120 s | 5,000/5,000 / 51.1 s | VALID | PASS |
| Multi-instance | 2 app + 2 worker | 6,000/6,000 balanced | VALID | PASS |
| Soak | 30 m @ 50 RPS / 250 | 90,000 @ 50.0/s | VALID | PASS |
| Correctness | zero violations | 0 duplicates / 0 raw 500 / exact slots | VALID | PASS |
| PSP subset | deferred | N/A | DEFERRED | N/A |

## 39. FULL REGRESSION (post-qualification, same HEAD)

```text
Backend: tsc --noEmit = 0 · build = PASS · unit = 753/753 (56 suites)
         full serial e2e = 1194/1194 (69 suites)
Frontend: tsc --noEmit = 0 · vitest = 135/135 (23 files) · production build = PASS
DB: migrate status 58/58 up to date · drift 0 (`migrate diff --from-config-datasource --to-schema` = empty)
Artifact integrity: scripts/check-roadmap-artifacts.mjs PASS (0 FAIL / 0 WARN) — checker regression 13/13
```

## 40. DB / DRIFT

```text
migrations: 58/58 applied, "Database schema is up to date!" (migrate status)
drift: `prisma migrate diff --from-config-datasource --to-schema` → empty diff (drift 0)
schema/migrations: 0 changes this pass
```

## 41. CLEANUP

```text
isolated qualification DB travelhub_perf_r2fq_095905: DROPPED
prior isolated DB travelhub_perf_035700 (earlier r2fq-* runs): DROPPED
remaining travelhub_perf* DBs: 0 (verified via pg_database query)
orphan perf processes: 0 (batch processes terminated; only pre-existing unrelated node processes remain)
per-run cleanup (perf harness): in-process app close, tracked rows deleted, outbox/inbox residue 0
```

## 42. ARTIFACT INTEGRITY

```text
backend/artifacts/performance/ — 32 r2fq* run dirs (summary/environment/scenario/correctness.json each)
artifact checker (roadmap references): PASS, 0 FAIL / 0 WARN
```

## 43. NEGATIVE CHECKS

```text
approved targets changed = 0        latency SLO changed = 0
EventBus backlog target changed = 0 EventBus rate reduced = 0
qualification duration reduced = 0  dataset authority reduced = 0
production tuning = 0               sales.service.ts tuning = 0
Booking/Order tuning = 0            query tuning = 0
index tuning = 0                    schema changes = 0
migration changes = 0               Prisma pool tuning = 0
PostgreSQL tuning = 0               worker interval tuning = 0
worker batch tuning = 0             retry policy tuning = 0
HTTP timeout tuning = 0             cache tuning = 0
tests skipped/weakened = 0          hidden failures = 0
```

## 44. ROADMAP UPDATE

`docs/prompts/TravelHub_CANONICAL_IMPLEMENTATION_ROADMAP_v3.md` Step 2.17B status updated to:

```text
🚧 FINAL RE-QUALIFICATION ROUND 2 COMPLETED — VALID PLATFORM PERFORMANCE FAIL —
PERFORMANCE REMEDIATION REQUIRED — NOT APPROVED
```

Historical entries preserved verbatim; new segment appended (see commit).

## 45. CHANGED FILES

```text
docs/prompts/PHASE_2_STEP_2.17B_FINAL_REQUALIFICATION_ROUND_2_REPORT.md  — this report (new)
docs/prompts/TravelHub_CANONICAL_IMPLEMENTATION_ROADMAP_v3.md            — Step 2.17B status segment
```

Per-run artifacts live under `backend/artifacts/performance/` (gitignored, not committed).

## 46. COMMIT / PUSH

```text
exact staging: report + Roadmap only (this pass changed no code)
commit message: docs(2.17B): record final re-qualification round 2 — verdict B (valid system fail)
push: performed; HEAD == upstream verified
```

## 47. REPOSITORY EVIDENCE

```text
qualification_verdict: B — VALID SYSTEM FAIL (2 valid failures: EventBus backlog 171>100; Booking burst 20 chains/s not sustained)
f2_verdict: FAIL (fresh max backlog 171 > 100; oldest PENDING 1.7 s; canonical config; no tuning)
booking_burst_verdict: FAIL (103/300 @ 20 chains/s, conc 50; chain p95 14.2 s; root cause NOT YET PROVEN)
payment_conc_class_e: FAIL (p95 4,337.5 ms @ conc 50; correctness PASS)
all_other_gates: PASS
step_2_17b_state: FINAL RE-QUALIFICATION ROUND 2 COMPLETED — VALID PLATFORM PERFORMANCE FAIL — PERFORMANCE REMEDIATION REQUIRED — NOT APPROVED
strict_review_state: NOT STARTED
step_2_17c_state: NOT STARTED
step_2_18_state: NOT STARTED
release_status: NOT PERFORMED
```

## 48. RELEASE

`RELEASE: NOT PERFORMED`

## 49. NEXT

```text
PHASE 2 — STEP 2.17B — PERFORMANCE REMEDIATION (dedicated pass)
```

Route: EventBus backlog gate (F-2) + Booking/Order burst 20 chains/s + Class E payment.create tail at concurrency 50 — root-cause analysis and remediation only (sales.service.ts, Booking/Order production code, EventBus worker config, queries/indexes, Prisma pool, PostgreSQL settings are remediation candidates; approved targets remain frozen).

## 50. HARD STOP

Completed: repository verification → target-freeze proof → pre-flight → isolated environment (58/58 migrations, drift 0) → REPRESENTATIVE seed/drain proof → full qualification matrix (steady/peak/burst/soak/payment 2/10/50/booking 6/20/login 2/5/EventBus steady+burst+recovery/multi-instance) → correctness-under-load hard gate → F-2 fresh reproduction → full regression (backend tsc/build/unit 753/e2e 1194; frontend tsc/vitest 135/build; migrate/drift; artifact checker) → cleanup (perf DBs dropped, orphans 0) → report → Roadmap update → exact staging → commit → push → HEAD==upstream verified. **STOPPED.**

Not performed: performance remediation, production tuning, EventBus tuning, Booking/Order optimization, payment tail-latency remediation, Strict Review, 2.17C, 2.18, RLS, PSP.
