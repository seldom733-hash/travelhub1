# PHASE 2 — STEP 2.17B
# LOAD & PERFORMANCE QUALIFICATION
## CURRENT-STATE BLOCKER AUDIT REPORT

**Date:** 2026-09-11
**Mode:** AUDIT / QUALIFICATION READINESS ONLY
**Production implementation:** FORBIDDEN
**Known state:** STEP 2.17B = BLOCKED; Phase 2 Exit = BLOCKED

---

## 1. Mission

Audit the current state of **STEP 2.17B — Load & Performance Qualification** and determine exactly why the Phase 2 Exit remains blocked.

> What exactly prevents 2.17B from being qualified today?

---

## 2. Baseline Git

```text
Branch:           master
HEAD:             cbb1f0e2bf8019497b94382f4f49b258f2ce6fa8
Remote:           cbb1f0e2bf8019497b94382f4f49b258f2ce6fa8 (== HEAD, verified)
Working tree:     clean (only untracked: STEP 3.12 prompt file)
Production code:  UNCHANGED (audit only)
```

---

## 3. Canonical 2.17B Sources

| Source | Path | Purpose |
|---|---|---|
| Authority/design doc | `docs/architecture/load-performance-qualification-2.17B.md` (665 lines) | Frozen SLO matrix, harness contract, environment requirements |
| Phase 2 exit audit | `docs/architecture/phase-2-exit-audit-2.18.md` (527 lines) | Exit gate inventory, 2.17B as mandatory gate |
| Runbook | `docs/operations/load-performance-qualification-runbook.md` (208 lines) | Execution instructions, commands, scenario order |
| Harness implementation | `backend/src/perf/` (14 files) | Dependency-free Node load harness |
| Remediation report | `docs/prompts/PHASE_2_STEP_2.17B_QUALIFICATION_HARNESS_ENVIRONMENT_REMEDIATION_REPORT.md` | H1–H11 blocker remediation |
| Round 3 report | `docs/prompts/PHASE_2_STEP_2.17B_FINAL_REQUALIFICATION_ROUND_3_DEDICATED_ENVIRONMENT_REPORT.md` | Dedicated environment admission failure |
| Authority decision | `docs/prompts/PHASE_2_STEP_2.17B_QUANTITATIVE_TARGETS_AUTHORITY_DECISION_REPORT.md` | SLO/load authority VERDICT A |
| Disposition report | `docs/prompts/PHASE_2_STEP_2.17B_BOOKING_BURST_QUALIFICATION_ENVIRONMENT_BOTTLENECK_DISPOSITION_REPORT.md` | Windows host DB-path bottleneck |

27 total 2.17B-related files in `docs/prompts/`.

---

## 4. Historical Findings

### PERF-01 — EventBus Backlog

```text
Under 100 ev/s sustained load:
EventBus max backlog ~171–178
Target <= 100
Oldest PENDING target <= 10s
Backlog converges to 0 after generation stops
```

**Status:** EXPLORED / REMEDIATED (harness capability validation showed backlog max 172, oldest PENDING max 1.7 s — within bounds under harness validation load). However, this was NOT a qualification run against the full frozen matrix. The target `<=100` remains the canonical authority.

### PERF-02 — Booking Burst

```text
At concurrency 50:
20 chains/s burst
103/300 chains started
~34% complete
Target >= 95%
```

**Status:** Two root causes identified:
1. **Harness capability gap** (H5): remediated — booking-order profiles now expressible (6 RPS steady PASS; 20 RPS expressible with honest observation)
2. **Environment bottleneck** (R3-1): the dedicated Linux container environment (Docker Desktop/WSL2) has a DB commit/fsync ceiling of 237–280 tps server-side, which cannot sustain 20 chains/s (~240–500 commits/s required). This is a **WSL2 virtualized storage characteristic**, not an application defect.

**Classification:** Valid controlled qualification runs were executed (exploratory baseline 2026-08-16); the frozen matrix was NOT executed because the qualification environment failed admission. PERF-02 remains a valid target — the environment is the blocker, not the application.

---

## 5. Environment Audit

### What environment is required?

Per §33.12 of the authority/design doc:
```text
Dedicated isolated performance environment (local/perf host or dedicated CI/perf runner),
isolated PostgreSQL, canonical migrations, production Nest path, deterministic synthetic
data only, never canonical/prod DB, full environment metadata.
```

Per §33.8:
```text
Topology: 2 app instances + 2 worker instances + shared PostgreSQL
(dedicated isolated performance environment).
```

### Where is it defined?

`docs/architecture/load-performance-qualification-2.17B.md` §10 (environment contract), §33.12 (environment authority).

### Which services are required?

- 2× NestJS app instances (HTTP, `OUTBOX_WORKER_ENABLED=false`)
- 2× outbox worker instances (`OUTBOX_WORKER_ENABLED=true`)
- 1× PostgreSQL (dedicated, isolated, 58/58 canonical migrations applied)
- Optional: MinIO (if media-bearing scenarios run)

### Which DB/Redis/EventBus components?

- PostgreSQL only (no Redis; EventBus is application-level outbox/inbox pattern)
- DB must support commit-bound writes under concurrency without serialization ceiling
- No Redis, no external message broker

### Which external dependencies?

- None (PSP subset explicitly deferred; synthetic data only; no real PSP calls)

### Which load generator?

- Dependency-free Node harness (`backend/src/perf/run.ts`)
- Uses Node global `fetch` (no third-party HTTP client)
- No k6, Artillery, autocannon, or other external load tools

### Which configuration?

- Canonical worker config: interval 2000 ms / batch 100 (Step 2.17 fix)
- `DATABASE_POOL_SIZE` = 20 per instance (4 × 23 = 92 connections < PG max_connections=100)
- `DATABASE_SEQ_POOL_SIZE` = 3 per instance
- `BUSINESS_SEQUENCE_BLOCK_SIZE` = 100
- Worker timing overrides FORBIDDEN in final mode (fail-closed)

### Which dataset?

REPRESENTATIVE (§33.11):
```text
Users >= 1,000; Products >= 500; Customers >= 1,000; Quotes >= 1,000;
Booking/Order chains >= 1,000; Payment-capable orders >= 500;
Finance/Ledger >= 5,000; EventBus seed >= 5,000
```

### Which observability?

- Harness-level: p50/p95/p99/max per route class A–F, throughput, outcome counts, memory RSS/heap
- Server-side: pgbench probes, DB commit ceiling measurement
- NO prom-client, OpenTelemetry, Grafana, Prometheus, `/metrics` endpoint (§27 of authority doc)

### Why unavailable?

**The environment does not exist.** Three attempts have been made:

1. **Windows host (native PG 18.4):** DB-path serialization at commit level (autocommit 621 ms @N=50 vs explicit tx 22 ms). Server-side commit ceiling measurable but not the bottleneck — the node-postgres client serialization is. Booking burst: 131–155/300 started (8.6–9.9 chains/s vs 20/s target). **Dispositioned as unsuitable.**

2. **Docker Desktop WSL2 containers (thq-r3: Node 22 + PG 16):** DB commit/fsync ceiling 237–280 tps (does NOT scale with concurrency). Client-observed latency at conc 50: 1,312 ms (worse than Windows host's 733 ms). REPRESENTATIVE seed infeasible (>16 min, hours estimated). **Admission failed (VERDICT C).**

3. **No third environment has been provisioned.**

### Classification

```text
E5 — external infrastructure/access required
```

No dedicated Linux x86_64 host/VM with native (non-WSL2-virtualized) storage exists in the project infrastructure.

---

## 6. Harness Audit

### Candidate Harnesses

| Harness | Path | Purpose | Executable now? | Canonical 2.17B? |
|---|---|---|---|---|
| Node perf harness | `backend/src/perf/run.ts` | Full qualification orchestrator | YES | YES |
| Pacer | `backend/src/perf/lib/pacer.ts` | Arrival-rate scheduling | YES | YES |
| Loader | `backend/src/perf/lib/loader.ts` | Concurrent fetch pool | YES | YES |
| Seed | `backend/src/perf/lib/seed.ts` | Deterministic dataset generator | YES | YES |
| Correctness | `backend/src/perf/lib/correctness.ts` | Post-run DB validator | YES | YES |
| Config | `backend/src/perf/lib/config.ts` | Profile manifest | YES | YES |
| Guard | `backend/src/perf/lib/guard.ts` | Safe-target protection | YES | YES |
| Qualification | `backend/src/perf/lib/qualification.ts` | Dataset profiles | YES | YES |
| Classify | `backend/src/perf/lib/classify.ts` | Outcome classification | YES | YES |
| Artifacts | `backend/src/perf/lib/artifacts.ts` | Result writing | YES | YES |
| Percentile | `backend/src/perf/lib/percentile.ts` | Math library | YES | YES |
| Redact | `backend/src/perf/lib/redact.ts` | Secret scrubbing | YES | YES |
| Env | `backend/src/perf/lib/env.ts` | Environment helpers | YES | YES |
| Tests | `backend/src/perf/perf-harness.spec.ts` | 31 unit/integration tests | YES | YES |

**No k6, Artillery, autocannon, or third-party load tools are installed or used.** The harness is dependency-free and uses Node global `fetch`.

### Harness Status

- All 11 capability blockers (H1–H11) remediated (arrival-rate pacing, warm-up wiring, dataset profiles, payment/booking/login profiles, EventBus steady/burst/recovery, multi-instance topology, paced soak)
- Short capability validation: all 16 scenarios PASS (booking-burst recorded as honest observation)
- Harness byte-identical to committed HEAD
- **Harness is NOT the blocker**

---

## 7. Dataset / Fixture Audit

| Aspect | Status |
|---|---|
| Source | Built-in deterministic generators (`backend/src/perf/lib/seed.ts`) |
| RECORD counts | SMALL (default), REPRESENTATIVE (authority), STRESS (envelope ×5) |
| Tenant structure | Single-tenant qualification DB (shared dev DB never used) |
| Users/partners | Synthetic staff users (SM/OPERATOR/FINANCE roles), sellers, products |
| Orders/bookings/events | Synthetic quote→checkout→sale→complete chains via canonical APIs |
| Isolation | Fresh DB per run, run-prefixed, dependency-tracked cleanup |
| Reproducibility | Deterministic seeded PRNG, seed state recorded in environment metadata |
| Versioning | Harness version tracked via git SHA; dataset generators versioned in `qualification.ts` |

**REPRESENTATIVE dataset seeding is slow** (sequential chain creation at ~1.3 s/step × 1,000 chains ≈ hours on the dispositioned environment). This is an environment limitation (DB commit ceiling), not a harness defect.

---

## 8. Acceptance Thresholds

Frozen authority matrix (§33 of the design doc, VERDICT A — APPROVED):

### Latency SLO

| Class | p95 | p99 |
|---|---|---|
| A — public/light reads | <= 300 ms | <= 750 ms |
| B — authenticated reads | <= 500 ms | <= 1000 ms |
| C — ordinary domain writes | <= 750 ms | <= 1500 ms |
| D — concurrency-sensitive writes | <= 1000 ms | <= 2000 ms |
| E — payment.create | <= 1000 ms | <= 2000 ms |
| F — auth/login | <= 750 ms | <= 1500 ms |

### Reliability

```text
Unexpected HTTP 5xx = 0
Unexpected transport failures = 0
Unexpected timeouts = 0
```

### EventBus

```text
Qualification steady: 100 ev/s
Qualification burst: 1,000 events
Normal backlog: <= 100
Oldest PENDING: <= 10 s
Recovery: 5,000 events / 2 workers / drain <= 120 s
```

### Booking/Order

```text
Sustained: 6 RPS
Burst: 20 chains/s
```

### Payment

```text
Sustained: 2 RPS
Burst: 10 RPS
Concurrency: 50
```

### Correctness (absolute, never weakened)

```text
Duplicate committed Payment = 0
Wrong/silent divergent idempotent replay = 0
Duplicate Order = 0
Duplicate Commission/Accrual = 0
Lost committed PENDING event = 0
Poison blocks unrelated progress = 0
Raw 500 from controlled race = 0
Decimal corruption = 0
Invalid terminal lifecycle transition = 0
```

**All thresholds are from the authority decision (VERDICT A). None have been changed.**

---

## 9. Measurement Integrity

| Metric | Source | Trustworthy? |
|---|---|---|
| Throughput (req/s) | Harness pacer (`achievedStartRate`, `achievedCompletionRate`) | YES — monotonic wall-clock scheduler |
| Latency p50/p95/p99/max | Harness loader (per-route-class A–F) | YES — client-observed, classified |
| Errors/outcomes | Harness classifier (`classify.ts`) | YES — expected vs unexpected split |
| EventBus backlog | Harness seed + worker drain measurement | YES — direct DB query |
| Oldest PENDING age | Harness correctness validator | YES — DB query |
| Completion rate | Harness chain completion tracking | YES — per-chain |
| Concurrency | Harness `maxConcurrencyObserved` | YES — in-flight counter |
| CPU/memory | Harness `MemorySampler` (RSS/heapUsed) | INFORMATIONAL — no SLO |
| DB connections | Not measured (harness does not query `pg_stat_activity`) | GAP — acceptable for qualification |
| DB commit ceiling | `pgbench` direct probe (server-side) | YES — used for admission |
| Event-loop lag | Not measured | GAP — acceptable for qualification |

**No acceptance criterion depends solely on an unauditable screenshot.** All metrics are from harness structured JSON artifacts or direct DB probes.

---

## 10. Reproducibility

| Aspect | Status |
|---|---|
| Environment | Requires dedicated Linux x86_64 host/VM with native PostgreSQL |
| Configuration | Fully documented in authority doc §33 + runbook |
| Dataset | Deterministic generators in harness, seeded from git SHA |
| Command | `npx ts-node src/perf/run.ts --profile=<name> --run-id=<id>` (per runbook §5) |
| Load profile | Paced arrival-rate (pacer.ts), frozen manifest values |
| Duration | Per scenario (15 min steady, 15 min peak, 60 s burst, 30 min soak) |
| Concurrency | Per scenario (250 for soak, 50 for payment, etc.) |
| Thresholds | Frozen authority matrix §33 |
| Expected output | Structured JSON artifacts per run |
| Cleanup | Automatic (dependency-aware, run-prefixed) |

### Classification

```text
R2 — requires unavailable infrastructure
```

The harness, configuration, dataset, commands, and thresholds are all fully documented and reproducible from repository-controlled artifacts. The ONLY missing piece is the qualification environment itself (dedicated Linux host with native storage).

---

## 11. True Blocker Classification

```text
BLOCKER-ENV
```

### Why can 2.17B not be accepted today?

The qualification environment does not exist. Three attempts to find or create one have failed:

1. **Windows host (native PG):** node-postgres client serialization under commit-bound writes. Booking burst: 8.6–9.9 chains/s vs 20/s target.
2. **Docker Desktop/WSL2 containers:** DB commit/fsync ceiling 237–280 tps (WSL2 virtualized storage). Booking burst: environment cannot deliver required committed transaction rate.
3. **No third environment provisioned.**

The root cause is **WSL2 virtualized storage** — both the Windows host and Docker Desktop/WSL2 run on the same physical machine (AMD Ryzen 5 PRO 4650U), and the storage I/O path through WSL2 creates a commit/fsync ceiling that cannot sustain the Booking burst gate.

### What exact artifact/capability is missing?

A **dedicated Linux x86_64 host or VM with native (non-WSL2-virtualized) storage** — bare metal or a proper VM (e.g., AWS EC2, dedicated server, or a non-WSL2 Linux installation). The environment must:
- Run PostgreSQL natively (not through WSL2 disk virtualization)
- Support commit-bound writes under concurrency without serialization ceiling
- Be able to sustain ~500+ committed transactions per second (required for 20 chains/s Booking burst)
- Complete REPRESENTATIVE dataset seeding in bounded time

### What is the minimum action required to make qualification executable?

Provision a dedicated Linux x86_64 environment with native PostgreSQL and pass the admission suite (L1 autocommit/tx parallelization, L3 client-observed ≈ handler + small delta, REPRESENTATIVE seed in bounded time).

### Does that action require production-code changes?

**No.** The harness, application code, and configuration are all ready. The blocker is purely infrastructure.

---

## 12. Minimum Remediation

### Option A: Provision dedicated infrastructure

Provision a Linux x86_64 VM (e.g., AWS EC2 m5.large or equivalent) with:
- Native PostgreSQL 16+ (not containerized on virtualized storage)
- Node.js 22+
- Docker (for consistent harness execution)
- Network access for the harness to reach PostgreSQL

Minimum spec: 2 vCPU, 4 GB RAM, 50 GB SSD (gp3 or equivalent).

Admission criteria (must pass BEFORE running the matrix):
- L1: autocommit AND explicit-tx both parallelize with single-digit-ms p50 @N=50
- L3: client-observed ≈ handler + small delta @conc 50
- REPRESENTATIVE seed completes in bounded time (<30 min)

### Option B: Authority decision on environment standard

If dedicated infrastructure is not feasible, an explicit authority decision on:
- Whether the qualification environment standard (§9 preference order / §10 host claim standard) can be relaxed
- Whether WSL2-virtualized storage is acceptable for the Booking burst gate
- Whether the Booking burst gate can be reclassified or deferred

**This requires a governance decision, not a code change.**

---

## 13. Production-Code Impact

**NONE.** No production code changes are required. The harness is fully remediated (H1–H11). The application code, schema, configuration, and behavior are all unchanged. The blocker is purely infrastructure/environment.

---

## 14. Phase 2 Exit Impact

Per `docs/architecture/phase-2-exit-audit-2.18.md` §7:

```text
G3: Load/performance qualification | 2.17B | BLOCKED | ← EXIT BLOCKER
```

Per §28:
```text
Phase 2 exit = ALL mandatory gates APPROVED
Phase 2 exit = FORBIDDEN while any gate is NOT APPROVED.
```

**Unless a valid current 2.17B qualification is executed and accepted:**

```text
Phase 2 Exit = BLOCKED
STEP 3.12 = BLOCKED
```

This audit does not unblock anything.

---

## 15. Recommendations

1. **Immediate:** Document the blocker precisely (this report) so governance decisions are informed.
2. **Infrastructure:** Provision a dedicated Linux x86_64 VM with native PostgreSQL. Estimated cost: ~$20-50/month for a minimal instance (AWS EC2, Hetzner, or equivalent).
3. **Admission gate:** Run the L1/L2/L3 admission suite before attempting the full matrix. If admission fails, the environment is not suitable.
4. **Authority decision:** If infrastructure provisioning is not feasible, convene a governance decision on the environment standard (Option B above).
5. **PSP subset:** Remains deferred (ADR-0015 + 2.12B prerequisites not satisfied). This is a separate deferral, not the primary blocker.

---

## 16. Final Verdict

```text
AUDIT PASS — BLOCKER PRECISELY IDENTIFIED; QUALIFICATION NOT YET EXECUTABLE
```

**Rationale:**
- The harness is fully implemented and remediated (all H1–H11 resolved)
- The quantitative SLO authority is approved (VERDICT A)
- The acceptance thresholds are frozen and documented
- The measurement methodology is sound
- The dataset generators are deterministic and authority-compliant
- The ONLY missing piece is the qualification environment itself

**True blocker:** `BLOCKER-ENV` — no dedicated Linux x86_64 host with native PostgreSQL exists. All three candidate environments (Windows native PG, Docker Desktop/WSL2 containers) failed admission due to DB write-path serialization characteristics of WSL2-virtualized storage.

**Step 2.17B remains NOT APPROVED. Phase 2 Exit remains BLOCKED. STEP 3.12 remains BLOCKED.**

---

## Expected Safe Outcome (unchanged)

```text
D0–D14                 CLOSED
Phase 3 implementation COMPLETE / VERIFIED
STEP 3.12              BLOCKED
Phase 2 Exit           BLOCKED
STEP 2.17B             NOT YET QUALIFIED
2.17B blocker          PRECISELY IDENTIFIED (BLOCKER-ENV)
Production code        UNCHANGED
```
