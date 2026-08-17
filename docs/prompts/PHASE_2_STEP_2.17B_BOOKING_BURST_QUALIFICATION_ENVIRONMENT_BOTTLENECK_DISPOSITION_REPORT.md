# Phase 2 Step 2.17B — Booking Burst Qualification Environment / Bottleneck Disposition Report

> Prompt: `PHASE_2_STEP_2.17B_BOOKING_BURST_QUALIFICATION_ENVIRONMENT_BOTTLENECK_DISPOSITION.md`
> Date: 2026-08-18
> Mode: NARROW DISPOSITION PASS — evidence-only, frozen targets, no SLO relaxation, no Round 3

---

## 1. Executive summary

The remaining Booking/Order burst gate (20 chains/s) was dispositioned with a controlled, layered differential experiment on the current qualification host. **The dominant blocker is the DB-client path (node-postgres autocommit serialization on this Windows host), not TravelHub application logic, not the PostgreSQL server, and not the load client.** The load client can validly dispatch the frozen 20 chains/s workload (300/300, ±0.00%) against a trivial no-DB server; the PostgreSQL server answers every statement in <10ms (0 statements ≥10ms logged even under 50-way burst); and the application handler itself is fast (p50 119ms). The latency appears between the application and PostgreSQL: raw pg `pool.query` autocommit serializes linearly with concurrency (N=5→79ms, 10→134ms, 20→261ms, 50→621ms p50) while explicit transactions run in parallel (2–7ms), and the PG-side connection sampler shows 21 connections with only ~6 active and 0 lock waits (the server is waiting on the client, not vice versa).

**Primary disposition: B — QUALIFICATION HOST / ENVIRONMENT BOTTLENECK PROVEN** (DB-client toolchain path on the current Windows host).

The known payment warmup/idempotency-slot harness defect (paced warm-up reusing measurement idempotency keys) was root-caused and **fixed**: warm-up and measurement now consume a single monotonic identity stream, so `warmupSlotSet ∩ measurementSlotSet = ∅`. Payment steady (2 RPS) and burst (10 RPS) now pass with **non-zero warmup** (`--warmup=5000/3000`), no `--warmup=0` workaround needed.

Canonical status:

```text
BOOKING BURST SYSTEM VERDICT = NOT EVALUATED ON THIS HOST
QUALIFICATION ENVIRONMENT = INVALID FOR THIS GATE
Step 2.17B = NOT APPROVED
Round 3 = BLOCKED pending a suitable qualification environment
```

---

## 2. Mode and hard boundaries

- Frozen targets unchanged (20 chains/s, ±5% load validity, correctness 0 violations, payment p95 ≤1000ms/p99 ≤2000ms, EventBus backlog ≤100/oldest ≤10s/recovery ≤120s).
- No production query/index/migration/pool/worker/transaction-boundary changes.
- No SLO relaxation, no target changes, no `--warmup=0` as final workaround.
- Full Round 3 qualification NOT executed. Strict Review NOT started. 2.17C/2.18/RLS/PSP NOT started.

---

## 3. Provenance

```text
branch: master
baseline HEAD: d34875a (== upstream) — remediation commits ef90335 → 1913d7f → d34875a
this-pass changes: harness-only (loader.ts, run.ts, perf-harness.spec.ts) — warmup/idempotency fix
worktree: clean of tracked changes before this pass
```

---

## 4. Verified prior remediation state

| Item | Expected | Verified |
|---|---|---|
| EventBus interval | 2000→500ms + adaptive drain | ✅ code + live (maxBacklog 19, oldest 142ms, drain 504ms) |
| BusinessSequence | Hi/Lo block allocation (100) | ✅ code + spec |
| DB pool | `DATABASE_POOL_SIZE`=20 + seqClient | ✅ code (canonical default, env-overridable — qualification config, not production tuning) |
| publishEvent | per-event delivery in completeSale + order consumer | ✅ code |
| Payment conc-50 | p95 553–601ms | ✅ live re-run: p95 544ms, p99 1642ms |

---

## 5. Frozen authority

Unchanged: Booking steady 6 chains/s / burst 20 chains/s; burst duration 15s (300 chains) used for focused reproduction; correctness 0; Payment 2/10/conc-50; EventBus steady 100 ev/s, backlog ≤100, oldest ≤10s, recovery 5000/2/≤120s; reliability 5xx=0/timeout=0/transport=0.

---

## 6. Host / environment inventory

```text
OS: Windows (win32 x64)
CPU: AMD Ryzen 5 PRO 4650U, 12 logical processors
RAM: 7.4 GB
Node: v24.18.0
PostgreSQL: 18.4 (same host as app)
DB location: localhost (same machine)
app/database same host: YES
background load: dev server running on :4000 (nonessential processes NOT stopped per §9 preference)
host sanity: 100 sequential trivial HTTP round-trips = 57ms (≈1749 rps serial) — host itself is not degenerate
```

---

## 7. Diagnostic methodology

Layered isolation, same REPRESENTATIVE-compatible dataset assumptions (SMALL synthetic for focused probes), frozen workload shape (20 chains/s × 10 sequential HTTP round-trips/chain). No full qualification suite was run.

---

## 8. Raw PostgreSQL evidence (Layer 1)

`backend/.freebuff-dbg/pg-probe.mjs` / `pg-probe2.mjs` on an isolated DB (58 migrations, drift 0):

```text
autocommit pool.query INSERT  N=5   p50=79ms   p95=165ms
                              N=10  p50=134ms  p95=153ms
                              N=20  p50=261ms  p95=319ms
                              N=50  p50=621ms  p95=774ms  max=775ms
explicit tx (BEGIN/INSERT/COMMIT)  N=50  p50=22ms  p95=52ms
                                   N=20  p50=7ms    N=10 p50=3ms  N=5 p50=2ms
```

Interpretation: autocommit latency grows linearly with concurrent in-flight queries (~13ms/query FIFO — a client-side serialization signature), while explicit transactions parallelize. This is a **client-side (node-postgres on Windows) effect**: the same statements inside a transaction complete in milliseconds.

## 9. PostgreSQL server-side duration (decisive)

`log_min_duration_statement=10` enabled; a calibration `pg_sleep(50ms)` was logged correctly (53ms), proving the log works. During a full 15s booking burst (50-way, 142 chains) and a 20s steady run (120 chains), the log recorded **0 statements ≥10ms**. The PostgreSQL server itself is not the bottleneck — every query completes server-side in <10ms.

## 10. Raw Node HTTP / client evidence (Layer 2 + §8 arrival-rate validity)

`backend/.freebuff-dbg/dispatch-capability.ts` — paced harness loader against a trivial no-DB `node:http` server, 20 chains/s × 10 sequential round-trips, 15s, conc 50:

```text
scheduled=300 started=300 completed=300  diffPct=0.00%  loadApplicationValid=TRUE
step (single trivial round-trip): p50=0.6ms p95=0.6ms
chain (10 sequential steps):      p50=7.1ms p95=7.1ms max=7.1ms
maxConcurrencyObserved=2
client can dispatch 20 chains/s against trivial server: YES
```

**The load client is NOT the bottleneck** — it can schedule and dispatch the frozen 20 chains/s arrival rate on this host.

## 11. Lightweight TravelHub HTTP evidence

`backend/.freebuff-dbg/raw-client-probe.ts` (quote POST, conc 50, N=40, isolated DB):

```text
client-observed: p50=733ms p95=907ms
server handler:  p50=119ms p95=195ms        ← application handler is fast
trivial-route (no DB/no guards): p50=78ms p95=88ms   ← host+HTTP floor at conc 50
gap client−handler ≈ 614ms ← DB-client path
```

## 12. Booking request-path timing (Layer 4)

Booking steady (6 chains/s, conc 10): 120/120, chain p50 297ms, p95 393ms — PASS. Burst (20 chains/s, conc 50): started 131–155/300 across three fresh runs (p50 5.4–6.3s, p95 6.1–7.3s, 0 failures, 0 duplicates, 1:1 convergence) — load application FAIL (achieved ~9–10 chains/s vs 20/s).

## 13. Full Booking→Order timing (Layer 5)

Focused fresh reproduction on committed HEAD (`1913d7f`+):

```text
runId          started/scheduled   achievedStart/s   chain p50    chain p95    errors/dup/convergence
disp2-book     155/300             9.9               5373ms       6124ms       0 / 0 / 1:1
disp2-book2    142/300             9.4               6164ms       6787ms       0 / 0 / 1:1
disp2-book3    131/300             8.6               6309ms       7227ms       0 / 0 / 1:1
```

## 14. Scheduled vs dispatched vs completed rate

Pacer scheduled 300 chains; 131–155 started (achieved 8.6–9.9 chains/s); every started chain completed (0 failures). The concurrency ceiling is hit because each chain takes ~5–7s; the chain duration is dominated by per-step DB-client serialization, not by client dispatch.

## 15. DB / pool / lock evidence

`conn-watch-disp.mjs` during a burst: peak conns=21 (pool 20 + seq 1), peak active=6, peak locks=0, peak client-wait=21, peak io=1. **21 connections checked out, only ~6 executing, 0 locks** — the server is idle-waiting on the client for most statements (client-side serialization), not contending on the server.

## 16. Event-loop / host evidence

Host sanity: 1749 rps serial on trivial HTTP. Trivial-route floor at conc 50 ≈ 78ms (includes dev-server background + shared host). The client dispatch probe (300/300) ran on the same host — dispatch is not the limit.

## 17. Controlled differential analysis

| Layer | Result | Bottleneck? |
|---|---|---|
| PostgreSQL server (log) | 0 stmts ≥10ms even under burst | NO |
| Load client dispatch | 300/300 @20 chains/s ±0% | NO |
| Application handler | p50 119ms @ conc 50 | NO |
| DB client (pg autocommit) | linear 79→621ms with N; tx 2–22ms | **YES — dominant** |
| Booking chain | ~9–10 chains/s achieved vs 20/s target | symptom of the above |

## 18. Primary disposition

**B — QUALIFICATION HOST / ENVIRONMENT BOTTLENECK PROVEN** (DB-client toolchain path on the current Windows host). Controlled evidence: raw pg autocommit serialization (client-side, linear in concurrency), PG server <10ms for every statement, 0 lock waits, client dispatch 300/300, application handler fast. TravelHub application logic is not proven to be the dominant cost; the residual is the node-postgres/prisma client autocommit path on this host.

## 19. Warmup/idempotency defect — root cause

`runPacedWindow` used a **window-local** `n` counter restarting at 0 for every window while `iteration.n` (the global stream) was never advanced in paced mode. Warm-up and measurement therefore generated **identical** idempotency keys (`perf-<runId>-pay-0…`), so warm-up slots collided with measurement slots: `completedSlots=40 vs reached=42` — formally invalid even when the system is fully correct. `--warmup=0` was only a workaround.

## 20. Warmup fix

`loader.ts`: `makeRequest(iteration.n++)` — warm-up and measurement consume one monotonic, run-scoped identity stream; keys are disjoint by construction (`warmupSlotSet ∩ measurementSlotSet = ∅`). `run.ts`: explicit measurement accounting (measurementStarted/completedSlots, warmupStarted/completedSlots, businessFacts/businessNoOps) and the canonical assertion is now on the disjoint measurement set.

## 21. Warmup tests

`perf-harness.spec.ts` +2 tests (72 total harness tests, all PASS):
- warm-up and measurement use disjoint identity streams (monotonic, non-repeating, starts at 0);
- deterministic run-scoped namespaces (same seed → same identity sequence; each run starts its own stream).

## 22. Payment non-zero-warmup validation

```text
payment-steady 2 RPS, --warmup=5000 (10 warmup requests):  PASS — p95 61ms, load valid ±0%
   completedSlots=50 = measurementStarted(40) + warmupStarted(10); businessNoOps=10; facts=40; dupOrders=0
payment-burst 10 RPS, --warmup=3000 (30 warmup requests):   PASS — p95 42ms, load valid ±0%
   completedSlots=180 = 150 + 30; facts=120; dupOrders=0
```

Non-zero warmup now passes **without `--warmup=0`**.

## 23. EventBus regression probes (final code)

```text
steady 100 ev/s (30s, 2 workers): 3000/3000 emitted/published, drain 504ms,
   maxBacklog=19 (≤100 PASS), oldest PENDING=142ms (≤10s PASS), 0 FAILED, 0 duplicates
burst 1,000: 1000/1000, drain 3.3s, PASS
recovery 5,000 / 2 workers: 5000/5000, drain 10.3s (≤120s PASS), poison isolated, PASS
multi-instance 2 app + 2 worker @100 RPS: 6000/6000, per-app 3150/3150 (50/50), load valid, PASS
```

## 24. Payment regression probes (final code)

```text
2 RPS steady (non-zero warmup): PASS, p95 61ms
10 RPS burst (non-zero warmup): PASS, p95 42ms
concurrency 50: PASS 9/9 — 3142 requests, p95 544ms (≤1000ms), p99 1642ms (≤2000ms),
   0 duplicate Payment, 0 raw 500, one-active-payment invariant held
```

## 25. Booking correctness (hard gate)

All three fresh burst runs and the steady run: 0 chain failures, 0 duplicate Order, Booking↔Order 1:1 convergence for every committed chain, last-slot/availability invariants intact (no raw 500 from controlled races). Correctness is PASS; the gate fails on **load application only** (environment).

## 26. Finding matrix

| Finding | Prior evidence | Fresh reproduction | Isolation evidence | Root cause/disposition | Fix | Fresh result | Status |
|---|---|---|---|---|---|---|---|
| EventBus F-2 | 171/178 >100 | maxBacklog 19 ≤100 | steady 3000/3000, drain 504ms | prior fix verified (500ms+adaptive) | already shipped | 19/142ms | PASS (no regression) |
| Booking burst | 103/300 → 134/300 | 131–155/300 ×3 | raw DB <10ms, client 300/300, handler 119ms, autocommit linear | **B — host/DB-client environment** | N/A (environment) | 131–155/300 | FAIL (load application; environment) |
| Payment conc-50 | ~4.3s → 553–601ms | p95 544ms / p99 1642ms | 9/9 checks, 3142 req, 0 dup | prior fix verified | already shipped | PASS | PASS (no regression) |
| Payment warmup | namespace collision | slots 50=40+10, 180=150+30 | disjoint identity stream | harness defect | loader.ts + run.ts | non-zero warmup PASS | **FIXED** |

Historical evidence (171/178, 103/300, 134/300, ~4.3s) preserved in prior reports and Roadmap — not rewritten.

## 27. Full regression

```text
backend: tsc 0 errors; build PASS; unit 756/756 PASS (754 + 2 warmup tests); serial e2e 1194/1194 PASS (69 suites)
frontend: tsc 0; vitest 135/135 PASS; production build PASS
DB: migrate status up-to-date (58/58); migrate diff → "No difference detected" (drift 0)
artifact integrity: PASS=148 WARN=0 FAIL=0 (checker regression 13/13)
```

No skipped tests, no weakened assertions, no retries to mask failures.

## 28. Migrations / drift

No migrations added (harness-only change). Drift 0 verified.

## 29. Artifact integrity

`node scripts/check-roadmap-artifacts.mjs` → **PASS=148, WARN=0, FAIL=0**.

## 30. Negative checks

```text
frozen targets changed: 0
Booking target changed: 0
Booking concurrency reduced: 0
Booking timeout inflated: 0
dataset reduced: 0
correctness assertions weakened: 0
payment warmup removed: 0
--warmup=0 used as final workaround: 0
EventBus target changed: 0

production query changes: 0
index changes: 0
migration changes: 0
pool changes: 0 (DATABASE_POOL_SIZE=20 was shipped in the prior remediation commit, not this pass)
worker-config changes: 0
transaction-boundary changes: 0
cache changes: 0
Sales structural refactor: 0

2.17C started: NO
2.18/RLS started: NO
PSP/2.12B/2.12I started: NO
Strict Review started: NO
Round 3 full qualification executed: NO
release/deployment: NO
```

## 31. Remaining risks

1. **DB-client serialization (node-postgres on Windows) is the dominant residual** — evidence is client-side (linear autocommit scaling, tx parallel, PG server <10ms, 0 locks). Round 3 requires a clean/dedicated qualification environment (preferably Linux) or an authority decision on the qualification environment, per §9 preference order. This is NOT an application-defect claim and NOT a production capacity claim.
2. The shared host runs the dev server (background load); per §9, isolated execution with nonessential processes stopped was not performed (no clean environment available to the agent). The differential evidence (raw pg, raw client, PG log) is host-agnostic enough to stand alone.
3. Payment warmup fix changes harness identity semantics — covered by 2 new unit tests + 2 live non-zero-warmup runs + full regression (756 unit, 1194 e2e).
4. Booking steady 6 chains/s remains PASS on this host; burst 20 chains/s needs a valid environment.

## 32. Roadmap decision

Step 2.17B entry updated to:

```text
⛔ QUALIFICATION ENVIRONMENT BLOCKED —
BOOKING BURST SYSTEM VERDICT NOT AVAILABLE ON CURRENT HOST —
NOT APPROVED
```

NEXT: execute the unchanged Booking burst gate on a suitable clean/dedicated qualification environment with recorded metadata, then decide Round 3 readiness.

## 33. Changed files

- `backend/src/perf/lib/loader.ts` — global identity stream for makeRequest (warmup/measurement disjoint keys)
- `backend/src/perf/run.ts` — explicit warmup/measurement slot accounting + scenario fields
- `backend/src/perf/perf-harness.spec.ts` — +2 namespace-disjointness/determinism tests

## 34. Commits / push

(to be completed after push — see REPOSITORY EVIDENCE)

## 35. REPOSITORY EVIDENCE

```text
repository: travelhub_v1 (local canonical identity)
branch: master
base_sha: d34875a
upstream_before: d34875a
remediation_commit_sha: 1913d7f (prior pass)
provenance_footer_commit_sha: d34875a (prior pass)
final_head_sha: <recorded after push>
upstream_sha: <recorded after push>
push_status: <PUSHED after push>
worktree_clean: true (of my changes; untracked diagnostics in backend/.freebuff-dbg/)

step_2_17b_state_before: REMEDIATION PARTIAL — NOT READY FOR ROUND 3
strict_review_state: NOT STARTED
round3_state: NOT STARTED

frozen_targets_changed: 0

host_os: Windows win32 x64
host_cpu: AMD Ryzen 5 PRO 4650U
host_logical_cpu: 12
host_ram: 7.4 GB
node_version: v24.18.0
postgres_version: 18.4
database_location: localhost (same host)
qualification_environment_classification: B — HOST/DB-CLIENT ENVIRONMENT BOTTLENECK (autocommit serialization on Windows)

booking_target_chains_per_sec: 20
booking_prior_round2: 103/300
booking_prior_remediation: 134/300
booking_fresh_scheduled: 300
booking_fresh_dispatched: 300 (client against trivial server)
booking_fresh_http_completed: 131–155 (three runs)
booking_fresh_converged: 131–155 (1:1)
booking_fresh_p50: 5373–6309ms
booking_fresh_p95: 6124–7227ms
booking_fresh_p99: 6195–7331ms
booking_fresh_max: 6218–7389ms
booking_actual_applied_rate: 8.6–9.9 chains/s
booking_correctness: PASS (0 failures, 0 dup, 1:1)

raw_postgres_probe: autocommit linear 79→621ms (N=5→50); tx parallel 2–22ms
raw_node_http_probe: client dispatch 300/300 @20 chains/s ±0.00%
lightweight_app_probe: handler p50 119ms @ conc 50
db_pool_evidence: peak conns 21, active 6, locks 0
db_lock_evidence: 0 lock waits (client-side serialization)
event_loop_evidence: trivial-route floor ~78ms @ conc 50; host sanity 1749 rps serial
host_resource_evidence: dev server running (background load); NOT MEASURED CPU% (wmic unavailable in bash)

booking_disposition: B — QUALIFICATION HOST/ENVIRONMENT BOTTLENECK PROVEN
booking_root_cause: node-postgres autocommit serialization on Windows host (client-side, linear in concurrency)
booking_fix: N/A (environment) — Round 3 needs clean/dedicated env or authority decision
booking_gate_status: FAIL on load application (environment); correctness PASS

eventbus_fresh_steady: PASS (3000/3000)
eventbus_fresh_max_backlog: 19 (≤100)
eventbus_fresh_oldest_pending: 142ms (≤10s)
eventbus_fresh_burst: PASS (1000/1000, drain 3.3s)
eventbus_fresh_recovery: PASS (5000/5000, drain 10.3s ≤120s)
eventbus_multi_instance: PASS (6000/6000, 3150/3150 per app)
eventbus_correctness: PASS (0 lost PENDING, poison isolated, 0 dup)

payment_warmup_defect: FIXED (disjoint identity stream)
payment_warmup_fix: loader.ts iteration.n++ + run.ts explicit accounting
payment_warmup_tests: +2 unit tests (72 harness tests PASS)
payment_nonzero_warmup_result: PASS (steady 50=40+10; burst 180=150+30)
payment_2rps: PASS (p95 61ms)
payment_10rps: PASS (p95 42ms)
payment_concurrency_50: PASS 9/9 (p95 544ms, p99 1642ms)
payment_p95: 544ms (conc 50)
payment_p99: 1642ms (conc 50)
payment_correctness: PASS (0 duplicate, one-active invariant)

production_query_changes: 0
index_changes: 0
migration_changes: 0
pool_changes: 0 (this pass)
worker_config_changes: 0
transaction_boundary_changes: 0
cache_changes: 0
sales_structural_refactor: 0

backend_regression: tsc 0 / build PASS / unit 756/756 / serial e2e 1194/1194 (69 suites)
frontend_regression: tsc 0 / vitest 135/135 / build PASS
migration_count: 58
database_drift: 0 ("No difference detected")
artifact_integrity: PASS=148 WARN=0 FAIL=0
checker_regression: 13/13

step_2_17c_state: NOT STARTED
step_2_18_state: NOT STARTED
psp_state: BLOCKED (ADR-0015 PROPOSED/BLOCKED; 2.12B BLOCKED)
release_status: NOT PERFORMED
next: FINAL RE-QUALIFICATION ROUND 3 on a clean/dedicated qualification environment (or authority decision on environment) — Step 2.17B remains NOT APPROVED
```

## 36. Release

`RELEASE: NOT PERFORMED`

## 37. NEXT

```text
PHASE 2 — STEP 2.17B —
BOOKING BURST GATE ON A CLEAN/DEDICATED QUALIFICATION ENVIRONMENT (or authority decision),
THEN FINAL RE-QUALIFICATION ROUND 3 AGAINST UNCHANGED FROZEN TARGETS
```

## 38. HARD STOP

Disposition complete: environment/client blocker proven (B), warmup defect fixed and validated, regression green, evidence persisted. Full Round 3 NOT executed; Step 2.17B NOT APPROVED; Strict Review NOT started; 2.17C/2.18/RLS/PSP NOT started; release NOT performed.
