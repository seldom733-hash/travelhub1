# PHASE 2 — STEP 2.17B — FINAL RE-QUALIFICATION AGAINST UNCHANGED APPROVED TARGETS — REPORT

## 1. Mode / Verdict

**FINAL PERFORMANCE QUALIFICATION · REPOSITORY-FIRST · FROZEN AUTHORITY · PACED LOAD · EXACT 2 APP + 2 WORKER TOPOLOGY · CORRECTNESS-UNDER-LOAD HARD GATE · NO TARGET CHANGES · NO PERFORMANCE TUNING · NO HARNESS REMEDIATION · NO STRICT REVIEW · EVIDENCE/PERSISTENCE REQUIRED · HARD STOP**

**VERDICT C — QUALIFICATION INVALID / INCOMPLETE.**

```text
System PASS claimed = NO
System FAIL claimed = NO
FINAL RE-QUALIFICATION = INVALID / INCOMPLETE
Step 2.17B = NOT APPROVED
Strict Review = NOT STARTED
```

The required **REPRESENTATIVE dataset gate (§7) cannot be satisfied** because the persisted
harness (`backend/src/perf/`, SHA `9310253`, untouched in this pass) cannot prepare the
approved dataset: `seed.ts drainOutbox()` caps at `20 rounds × publishPending(200) = 4,000`
events per drain, while the REPRESENTATIVE profile requires an EventBus seed of **5,000**
probe events (plus ~2–3k chain events) — live proof: the `qual-steady` run failed with
`HARNESS EXECUTION FAILED: outbox did not drain within bound` after ~12 minutes of dataset
preparation. Per the qualification prompt §27, a harness defect discovered during
qualification → **verdict C, do not fix it here**. The proven blocker is routed to a
separate harness-remediation pass.

Independent gates that do NOT depend on the seeded dataset were executed with valid evidence:
**EventBus steady (100 ev/s) → backlog gate FAIL** (max backlog 178 > approved 100, §16),
**EventBus burst 1,000 → PASS**, **EventBus recovery 5,000/2 workers → PASS (51.1 s ≤ 120 s)**,
**multi-instance 2 app + 2 worker topology → PASS**. Smoke / baseline / paycreate correctness
scenarios → PASS (SMALL dataset, correctness-only).

## 2. Repository truth (independently verified from code/artifacts, not reports)

```text
Step 2.17       = APPROVED
Step 2.17A      = APPROVED
Step 2.17B:
- harness                = IMPLEMENTED (backend/src/perf/, 5baa743)
- quantitative authority = APPROVED (60ead9a; 4d2c3c6 footer)
- first final qualification = INVALID/INCOMPLETE (verdict C; 6ced13a/f135d94/b0ae204)
- harness remediation    = COMPLETED (e2c8231; 8262468 footer; terminal 9310253)
- final re-qualification = INVALID / INCOMPLETE (this pass)
- approved               = NO
- strict review          = NOT STARTED
Step 2.17C       = NOT STARTED
Step 2.18        = NOT STARTED
ADR-0015         = PROPOSED — BLOCKED
2.12B            = BLOCKED
PSP subset       = DEFERRED
```

Verified against actual code: `backend/src/perf/lib/seed.ts` (`drainOutbox` maxRounds=20,
`publishPending(200)`), `backend/src/perf/lib/qualification.ts` (REPRESENTATIVE counts:
`eventBusSeed = 5,000`), `backend/src/perf/lib/config.ts` / `run.ts` (profile wiring),
`backend/src/eventbus/outbox-worker.service.ts` (canonical 2000 ms / batch 100), Roadmap,
design doc `docs/architecture/load-performance-qualification-2.17B.md`, runbook
`docs/operations/load-performance-qualification-runbook.md`, prior reports.

## 3. Provenance

```text
branch:                    master
base_sha / upstream_before: 93102534e70c49be732e1c5cd1e834a129aa788b
HEAD == upstream:          93102534e70c49be732e1c5cd1e834a129aa788b (verified before this pass)
harness_remediation_sha:   e2c8231 (8262468 footer, 9310253 terminal)
quantitative_authority_sha: 60ead9a (4d2c3c6 footer)
requalification_commit_sha: <filled after commit>
provenance_footer_commit_sha: <filled after commit>
final_head_sha:            <filled after push>
upstream_sha:              <filled after push>
push_status:               <filled after push>
migration_count:           58/58 applied, up to date
database_drift:            0 ("No difference detected" / empty diff)
artifact_integrity_baseline: PASS=144 WARN=0 FAIL=0 (checker regression 13/13)
```

Untracked user prompt files in `docs/prompts/` preserved untouched.

## 4. Frozen authority (reconstructed from persisted manifest — zero changes)

Reconstructed from `backend/src/perf/lib/qualification.ts` (single machine-readable source):

```text
normal 25 RPS · V1 peak 50 RPS · qual sustained 100 RPS · qual burst 200 RPS · headroom 2.0x
concurrency normal 100 · peak 250 · qual 500 · burst 1,000
warm-up 5 min · steady 15 min @ 50 RPS · peak 15 min @ 100 RPS · burst 60 s @ 200 RPS
soak 30 min @ 50 RPS / concurrency 250
payment 2 RPS steady / 10 burst / concurrency 50
Booking/Order 6 RPS steady / 20 burst
login 2 RPS qual / 5 burst
EventBus qual 100 ev/s · burst 1,000 events · backlog ≤ 100 · oldest PENDING ≤ 10 s
recovery 5,000 events / 2 workers / max drain ≤ 120 s
topology 2 app + 2 worker · canonical worker 2000 ms / batch 100
Latency p95/p99: A 300/750 · B 500/1000 · C 750/1500 · D 1000/2000 · E 1000/2000 · F 750/1500 (ms)
Reliability: unexpected 5xx / timeout / transport = 0
```

## 5. Target-change proof

```text
TARGETS_CHANGED  = 0
TARGETS_RELAXED  = 0
```

The manifest (`qualification.ts`) matches the approved quantitative authority exactly
(verified by reading; no diff in this pass). No target was changed to fit a measurement.

## 6. Environment

```text
OS:      Windows (win32) · arch x64
Node:    v24.18.0
CPU:     AMD Ryzen 5 PRO 4650U with Radeon Graphics, 12 logical CPUs
RAM:     7,549 MB total
PostgreSQL: 18.4 (localhost:5432)
Qualification DB: travelhub_perf_000741 (dedicated isolated, class local, safe-target guard PASS)
Harness: travelhub-perf-harness 1.0.0 (backend/src/perf/run.ts, no third-party load tool)
Request timeout 10,000 ms · seed 1 · logging info
git SHA at run time: 93102534e70c49be732e1c5cd1e834a129aa788b (worktree had untracked prompt files only)
```

## 7. DB safety

Canonical DB `travelhub1` untouched — all qualification runs targeted the dedicated isolated
`travelhub_perf_000741` DB. Safe-target guard passed on every run (local host, perf-class DB
name, no `--allow-non-local`). The isolated DB was dropped after evidence collection.

## 8. Migrations / drift

58/58 canonical migrations applied on the isolated qualification DB; `prisma migrate status`
= up to date; `prisma migrate diff --from-config-datasource --to-schema` = empty migration
(drift 0). Verified both pre- and post-pass. No schema/migration change in this pass.

## 9. Dataset

**BLOCKED — harness defect (proven).**

The qualification requires the canonical `REPRESENTATIVE` profile (§7):

```text
Users ≥1,000 · Products/service units ≥500 · Customers/CRM ≥1,000 · Sales/quotes ≥1,000
Booking/Order chains ≥1,000 · Payment-capable orders ≥500 · Finance/ledger ≥5,000
EventBus seed ≥5,000
```

Live evidence (`qual-steady`, runId `rq-steady`, `--dataset=REPRESENTATIVE`):
the run prepared 1,003 users, 1,253 products, 1,000 customers, 1,753 quotes, ~752+ sales
and then failed with `HARNESS EXECUTION FAILED: outbox did not drain within bound` at
~12.3 minutes (memory sampler duration 740,244 ms; `dataset: null` in summary.json).

Root cause (code-verified): `backend/src/perf/lib/seed.ts` `drainOutbox()` performs
`maxRounds = 20` rounds of `eventBus.publishPending(200)` → **4,000 events max per drain**.
`prepareDataset()` calls `drainOutbox()` once after the 1,000 order chains (~2–3k events:
OrderRequested → Order → OrderCreated → CommissionAccrual) and once after seeding the
**5,000** EventBus probe events (`seedEventBusProbes`). The 5,000-event drain alone exceeds
the 4,000-event bound → the REPRESENTATIVE dataset cannot be prepared. This also blocks
every dataset-seeding scenario (qual-steady/peak/burst/soak, payment-*, booking-order-*,
login-*), because they all share `prepareDataset()`.

This is a **harness capability gap** (REPRESENTATIVE counts were defined in the remediation
pass but the live seeding was validated only at SMALL scale — see §38 F-3), NOT a system
performance signal. Per the qualification prompt §1/§27, the harness is NOT modified here.

## 10. Topology

Proven by the `multi-instance` scenario (runId `rq-topo`, 2 app + 2 worker, shared
PostgreSQL, round-robin HTTP):

```text
app1 READY + app2 READY + worker1 READY + worker2 READY = YES
shared isolated DB = YES
canonical worker interval (2000 ms) = YES
canonical worker batch (100) = YES
HTTP requests: 3,150 / 3,150 across the two app instances (perfectly balanced)
EventBus competition: 200 probe events seeded → 200 published, 0 pending, drain 8 ms
```

Load-application validity: 6,000 scheduled → 6,000 started → 6,000 completed @ 100 RPS
(achieved start rate 99.99/s, diff 0.00% ≤ ±5%), scheduler lag 4.1 ms.

## 11. Worker config

Canonical throughout: interval 2,000 ms / batch 100 (production defaults, verified in
`outbox-worker.service.ts`). No timing overrides were used in any scenario. EventBus
scenarios report `workerIntervalMs=2000, workerBatch=100`.

## 12. Baseline regression (pre-qualification, §6 gate — PASS)

```text
Backend: tsc --noEmit = 0 · build = PASS · unit = PASS (exit 0) · full serial e2e = 1194/1194 (69 suites)
Frontend: tsc --noEmit = 0 · vitest = 135/135 · production build = PASS
DB: migrate 58/58 up to date · drift 0 ("No difference detected")
Artifact integrity: PASS=144 WARN=0 FAIL=0 (checker regression 13/13)
```

Vitest note: first parallel attempt reported 131 passed + 1 unhandled worker-pool startup
timeout (resource contention with concurrent backend e2e + frontend build); clean isolated
rerun = 135/135 (documented in §32, not hidden).

## 13. Warm-up (5 min)

**BLOCKED** — dataset preparation (REPRESENTATIVE) fails before warm-up can start; the
`qual-steady` run died during seeding with the §9 defect. Warm-up itself is wired
(`--warmup=300000` accepted; manifest `warmupMs=300_000`; paced at target rate, excluded
from measurement — verified by code), but no valid 5-minute warm-up + measurement window
was executed because no load phase could start.

## 14. Steady 15 min @ 50 RPS

**BLOCKED** — same root cause (§9): the REPRESENTATIVE dataset cannot be prepared, so the
paced steady phase never started (`qual-steady` failed at seeding). No steady measurements.

## 15. Peak 15 min @ 100 RPS

**BLOCKED** — same root cause (§9). Not executed (would fail identically at seeding).

## 16. Burst 60 s @ 200 RPS

**BLOCKED** — same root cause (§9). Not executed.

## 17. Classes A–F latency

**NOT JUDGED.** No valid paced HTTP qualification phase executed (all blocked at seeding).
The executed non-authoritative scenarios (SMALL dataset) recorded the following partials —
reported as measurements, NOT gate verdicts:

| Scenario | Class A p50/p95/p99/max | Class B p50/p95/p99/max |
|---|---|---|
| smoke (SMALL) | 3.8 / 6.5 / 16.2 / 21.7 ms | 18.4 / 27.2 / 32.3 / 37.2 ms |
| baseline (SMALL) | 7.7 / 12.5 / 18.6 / 56.3 ms | 39.5 / 52.0 / 65.0 / 107.1 ms |
| multi-instance 2+2 (SMALL env) | 4.9 / 20.9 / 23.0 / 30.4 ms | 16.6 / 34.6 / 38.2 / 42.6 ms |

Classes C/D/E/F were not exercised by any executed profile (payment/booking/login gates
blocked; finance.ledger route is part of the blocked qual-steady/peak/soak profiles).

## 18. payment.create 2 / 10 / concurrency 50

**BLOCKED** — same root cause (§9): `payment-steady` / `payment-burst` /
`payment-concurrency` all call `prepareDataset()` with the dataset class; REPRESENTATIVE
seeding fails. Not executed.

Correctness-only scenario `paycreate` (SMALL) executed and PASSED (see §28).

## 19. Booking/Order 6 / 20

**BLOCKED** — same root cause (§9). Not executed. The prior single-instance observation
(20 chains/s → 15 s/call chain aborts) is NOT inherited as a failure and remains
NOT JUDGED under the required 2-app + 2-worker topology.

## 20. Login 2 / 5

**BLOCKED** — same root cause (§9). Not executed.

## 21. EventBus steady — 100 ev/s — EXECUTED (VALID) — BACKLOG GATE FAIL

Fresh paced generation (runId `rq-ebs`): 3,000 events @ 100 ev/s over 30 s, 2 workers,
canonical config (2,000 ms / 100).

```text
emitted = 3,000 (== scheduled, load applied) · published = 3,000 · finalPending = 0
residual retryable FAILED = 0 · drain after generation = 506 ms
max backlog = 178            → approved gate ≤ 100 → FAIL
oldest PENDING max = 1,772 ms → approved gate ≤ 10 s → PASS
backlogSamples = 3,000 (sampled per emit)
```

Per the qualification prompt §16: the remediation's short-capability max backlog of 172 was
explicitly NOT final evidence; a fresh valid final run again producing max backlog > 100
**fails the backlog gate — no reinterpretation, no worker tuning**. The fresh final run
produced 178 → **backlog gate = FAIL** (formal system gate failure under valid evidence).
The backlog did converge to 0 after generation (drain 506 ms); the excess occurs during
generation-under-processing within the 2 s worker cycle (2 s × 100 ev/s = 200 > batch 100).

## 22. EventBus burst — 1,000 — PASS

Fresh execution (runId `rq-ebb`): 1,000 seeded PENDING (+ poison) with workers off →
drained by 2 canonical-config workers.

```text
seeded = 1,000 · published = 1,000 · drain = 11,262 ms · pending after = 0
FAILED after excluding poison = 0 · poison isolated = YES (stays FAILED, blocks nothing)
```

## 23. EventBus recovery — 5,000 / 2 workers — PASS

Fresh execution (runId `rq-ebr`): 5,000 seeded PENDING (+ poison) → drained by 2
canonical-config workers.

```text
seeded = 5,000 · published = 5,000 · drain = 51,117 ms ≤ 120,000 ms gate → PASS
pending after = 0 · FAILED after excluding poison = 0 · poison isolated = YES
recoverable events converged · duplicate business effects = 0 · lost events = 0
```

(Remediation's ~51.3 s figure was NOT reused — fresh run measured 51.1 s.)

## 24. Soak 30 min @ 50 RPS / concurrency 250

**BLOCKED** — same root cause (§9). Not executed.

## 25. Load-application validity

- `multi-instance` (100 RPS): scheduled 6,000 → started 6,000 (99.99/s, diff 0.00%),
  completed 6,000, `loadApplicationValid=true`, scheduler lag 4.1 ms — VALID.
- `eventbus-steady` (100 ev/s): emitted 3,000 == scheduled — VALID.
- `eventbus-burst`/`recovery`: seeding counts verified == requested — VALID.
- Load phases (steady/peak/burst/soak): NOT APPLICABLE (blocked at dataset prep, never
  started).

## 26. Reliability

Across every executed scenario (smoke, baseline, paycreate, eventbus-steady, eventbus-burst,
eventbus-recovery, multi-instance):

```text
unexpected 5xx = 0 · timeouts = 0 · transport failures = 0
```

Expected controlled statuses classified separately: paycreate divergent concurrent reuse →
1×409 (expected); login throttle not exercised (gates blocked); no expected 429 recorded.

## 27. Correctness-under-load

Validator (independent authoritative DB-state checks in `lib/correctness.ts`) on all
executed scenarios: **PASS**.

```text
duplicate Payment = 0 · duplicate Order = 0 · duplicate Commission/Accrual = 0
wrong/divergent idempotency replay = 0 · lost committed PENDING = 0
poison-blocking = 0 · raw 500 from controlled races = 0
invalid terminal transition = 0 · Decimal corruption = 0
Inbox/consumer dedup preserved · at-least-once preserved
```

## 28. Idempotency

`paycreate` (SMALL, correctness scenario): 8 orders via the canonical chain; 10 unique keys
→ 7 committed facts + business no-ops (per-order one-active-Payment invariant); 3 identical
retries → same fact replayed; concurrent identical ×4 → exactly 1 fact, 0 raw 500;
concurrent divergent → 1×201 + 1×409, 0 raw 500; nested consumer chain
OrderRequested → Order → OrderCreated → consumed inbox 8/8; duplicate committed Payment = 0.

Sustained 2/10 RPS and concurrency-50 gates: **BLOCKED** (dataset root cause).

## 29. OBS-1 (sales.list / Class B) — final judgment

**NOT JUDGED.** The paced qualification at approved load (100 RPS peak) under the required
REPRESENTATIVE dataset could not be executed (dataset blocker, §9). The prior observation
(sales.list p95 428 ms @ ~250 r/s → 1,533 ms @ ~367 → 2,427 ms @ ~310 / conc 250) remains
preserved; **root cause NOT YET PROVEN**; no tuning performed (sales.service.ts untouched).

## 30. Booking/Order prior observation — final judgment

**NOT JUDGED** (gate blocked, §19). No 2-app + 2-worker burst evidence obtained.

## 31. Memory observation

Harness `MemorySampler` (in-process, no SLO): the failed `qual-steady` seed run peaked at
~1,357 MB RSS (start 936 MB, heap peak 1,073 MB) before aborting at ~12.3 min — informative
only, no leak claim. Other scenarios: short-lived, no unbounded-growth pattern observed.
No approved memory SLO exists; no production telemetry added.

## 32. Invalid / rerun history

| Run | Result | Reason / classification |
|---|---|---|
| `rq-steady` (qual-steady, REPRESENTATIVE) | INVALID (harnessExecution FAIL) | Harness defect: `drainOutbox` bound 4,000 < 5,000 EventBus seed → "outbox did not drain within bound" (dataset prep). Not a system signal. Not fixed (§27). |
| `qual-peak/burst/soak`, `payment-*`, `booking-order-*`, `login-*` | NOT RUN | Same proven blocker (would fail identically at seeding). |
| backend frontend vitest (first attempt) | environment flake | 131 passed + 1 unhandled worker-pool startup timeout while backend e2e + frontend build ran concurrently; clean isolated rerun 135/135 (exit 0). Recorded, not hidden. |

No rerun-until-green; no target/duration/concurrency reduction; no tuning.

## 33. PSP / future-scaling boundary

```text
real PSP network = 0 · provider latency = deferred · provider webhook burst = deferred
provider callback convergence = deferred · ADR-0015 = BLOCKED · 2.12B = BLOCKED
future-scaling targets (1,000 RPS / 5,000 concurrent / 20 pay RPS / 500 ev/s) NOT tested
production capacity claim = 0
```

## 34. Cleanup

```text
app/worker instances: closed in-process by the harness (per-run finally); no orphan perf processes
isolated qualification DB: dropped (travelhub_perf_000741) — verified 0 travelhub_perf* DBs remain
canonical DB: untouched; canonical retained EventBus history semantics preserved (inbox/outbox never wiped wholesale)
orphan processes: 0 (only the user's own pre-existing dev-server node processes remain, untouched)
```

Note: the failed `rq-steady` seed left 1,550 PUBLISHED outbox residue rows (untracked
chain-event aggregates — same class as the first qualification's OBS-2); all residue was
removed with the isolated DB drop.

**Cleanup verdict: PASS.**

## 35. Post-run regression

```text
Backend: tsc --noEmit = 0 · build = PASS · unit = PASS (exit 0) · full serial e2e = 1194/1194 (69 suites)
Frontend: tsc --noEmit = 0 · vitest = 135/135 · production build = PASS
DB: migrate 58/58 up to date · drift 0
Artifact integrity: PASS=144 WARN=0 FAIL=0 (checker regression 13/13)
```

Expected code changes from qualification itself:

```text
production code = 0 · harness code = 0 · schema = 0 · migrations = 0 · CI = 0
```

## 36. Artifact integrity

`scripts/check-roadmap-artifacts.mjs`: **PASS=144 WARN=0 FAIL=0**, exit 0; checker
regression 13/13. Per-run artifacts under `backend/artifacts/performance/` (gitignored):
summary/environment/scenario/correctness.json for `rq-smoke`, `rq-baseline`, `rq-paycreate`,
`rq-steady`, `rq-ebs`, `rq-ebb`, `rq-ebr`, `rq-topo`.

## 37. Negative checks

```text
approved SLO changed = 0                    approved load target changed = 0
SLO relaxed = 0                             qualification duration reduced = 0
qualification RPS reduced = 0               production performance tuning = 0
harness remediation (this pass) = 0         sales.service.ts changed = 0
query optimization = 0                      index added/changed = 0
schema changed = 0                          migration added = 0
Prisma pool tuned = 0                       PostgreSQL tuned = 0
cache added = 0                             worker interval/batch changed = 0
retry semantics changed = 0                 Payment semantics changed = 0
idempotency semantics changed = 0           auth semantics changed = 0
login throttle bypassed = 0                 test assertion weakened = 0
test skipped = 0                            failed run hidden = 0
failed gate omitted = 0                     percentile cherry-picking = 0
production capacity claim = 0               future-scaling qualification = 0
real PSP network = 0                        PSP selected = 0
Step 2.17B approved = 0                     strict review started = 0
2.17C started = 0                           2.18 started = 0
RLS implemented = 0                         2.12B/2.12I started = 0
release/deployment = 0
```

## 38. Findings / severity

| ID | Severity | Finding | Disposition |
|---|---|---|---|
| F-1 | HIGH | **Harness defect (dataset gate):** `drainOutbox()` bound = 20 × 200 = 4,000 events/drain < REPRESENTATIVE EventBus seed 5,000 (+ chain events). REPRESENTATIVE dataset cannot be prepared → §7 dataset gate and all dataset-dependent gates (steady/peak/burst/soak, payment 2/10/50, Booking/Order 6/20, login 2/5) are unjudgeable. Live proof: `rq-steady` failed "outbox did not drain within bound" at ~12.3 min. | Verdict C blocker → separate harness-remediation pass (per prompt §27; not fixed here). |
| F-2 | HIGH | **System gate FAIL (valid evidence):** EventBus steady 100 ev/s with canonical 2-worker config produced max backlog **178 > 100** (approved ≤ 100). Oldest PENDING 1.77 s ≤ 10 s PASS. Backlog converged to 0 after generation (drain 506 ms). Per prompt §16 this is a formal FAIL, not a reinterpretation. | Recorded as FAIL; NOT remediated (prompt §1/§16). Candidate for performance-remediation/worker-config review in the next pass. |
| F-3 | MEDIUM | Remediation gap: REPRESENTATIVE dataset counts were defined and unit-tested but the live seeding was validated only at SMALL scale — the 5,000-event drain path was never executed before this qualification. | Recorded; the separate harness-remediation pass must live-validate REPRESENTATIVE (incl. a drain bound sufficient for ≥5,000 probes). |
| F-4 | LOW | Failed `rq-steady` seed left 1,550 PUBLISHED outbox residue rows (untracked chain aggregates). Removed with the isolated DB drop; cleanup of failed-seed residue could be made dependency-complete in the harness-remediation pass. | Recorded; no correctness impact (0 PENDING/FAILED residue). |

## 39. Complete gate matrix

| Gate | Target | Observed | Evidence valid? | Verdict |
|---|---:|---:|---|---|
| steady load | 50 RPS ±5%, 15 min | not executed (dataset blocker) | NO | INVALID |
| peak load | 100 RPS ±5%, 15 min | not executed (dataset blocker) | NO | INVALID |
| burst load | 200 RPS ±5%, 60 s | not executed (dataset blocker) | NO | INVALID |
| warm-up | 5 min paced | not executed (dataset blocker) | NO | INVALID |
| soak | 30 min @ 50 RPS / 250 | not executed (dataset blocker) | NO | INVALID |
| Class A p95/p99 | 300 / 750 ms | no paced phase; partials only (smoke/baseline/multi) | NO | INVALID |
| Class B p95/p99 | 500 / 1000 ms | no paced phase; partials only | NO | INVALID (OBS-1 NOT JUDGED) |
| Class C p95/p99 | 750 / 1500 ms | no write profile executed | NO | INVALID |
| Class D p95/p99 | 1000 / 2000 ms | not exercised | NO | INVALID |
| Class E p95/p99 | 1000 / 2000 ms | payment gates blocked | NO | INVALID |
| Class F p95/p99 | 750 / 1500 ms | login gates blocked | NO | INVALID |
| unexpected 5xx | 0 | 0 (all executed scenarios) | YES | PASS (executed subset) |
| timeout | 0 | 0 | YES | PASS (executed subset) |
| transport | 0 | 0 | YES | PASS (executed subset) |
| duplicate facts | 0 | 0 (smoke/baseline/paycreate/eventbus/multi) | YES | PASS (executed subset) |
| payment 2 RPS / 10 RPS / conc 50 | 2 / 10 / 50 | blocked (dataset) | NO | INVALID |
| payment correctness | 0 duplicate / wrong replay | paycreate: 0 duplicates, 0 raw 500, 1×409 expected | YES | PASS (correctness-only scenario) |
| Booking/Order 6 / 20 | 6 / 20 RPS | blocked (dataset) | NO | INVALID |
| login 2 / 5 | 2 / 5 RPS | blocked (dataset) | NO | INVALID |
| EventBus steady 100 ev/s | 100 ev/s | 3,000 emitted @ 100/s, published 3,000 | YES | PASS (generation) |
| EventBus backlog | ≤ 100 | **178** | YES | **FAIL** |
| oldest PENDING | ≤ 10 s | 1.77 s | YES | PASS |
| EventBus burst | 1,000 events | 1,000 → 1,000, drain 11.3 s, poison isolated | YES | PASS |
| EventBus recovery | 5k / 2 workers / ≤ 120 s | 5,000 → 5,000, drain 51.1 s, poison isolated | YES | PASS |
| multi-instance topology | 2 app + 2 worker | 3,150 / 3,150, probes 200/200 drained | YES | PASS |
| load-application validity | ±5% | multi 0.00%, eventbus 0.00% | YES | PASS (executed phases) |
| correctness-under-load | zero violations | 0 violations on all executed scenarios | YES | PASS (executed subset) |
| dataset gate | REPRESENTATIVE | **not preparable (harness defect)** | NO | **INVALID — blocker** |

## 40. Overall verdict

**C — QUALIFICATION INVALID / INCOMPLETE.** A valid system PASS/FAIL against the approved
quantitative matrix is not available because the persisted harness cannot prepare the
required REPRESENTATIVE dataset (F-1). System PASS claimed: NO. System FAIL claimed: NO.
Independent valid evidence additionally records one genuine system gate FAIL
(EventBus backlog 178 > 100, F-2) on the executed subset.

## 41. Roadmap update

```text
Step 2.17B:
🚧 FINAL RE-QUALIFICATION INVALID / INCOMPLETE —
HARNESS BLOCKER: drainOutbox bound 4,000 < REPRESENTATIVE EventBus seed 5,000
(REPRESENTATIVE dataset not preparable) —
EventBus backlog gate FAIL 178 > 100 (valid evidence) —
NOT APPROVED
```

Step 2.17B is NOT marked APPROVED in this pass. Strict review NOT started.

## 42. Persistence

Report + Roadmap evidence committed; real SHAs in the evidence footer. Untracked prompt
files untouched; exact-file staging only.

## 43. Repository Evidence footer

```text
REPOSITORY EVIDENCE

repository: travelhub_v1
branch: master
head: 93102534e70c49be732e1c5cd1e834a129aa788b
origin: 93102534e70c49be732e1c5cd1e834a129aa788b
worktree_clean: true (of my changes)
migration_count: 58
reviewed_state: REQUALIFICATION_INVALID
reviewed_diff_base: 93102534e70c49be732e1c5cd1e834a129aa788b
reviewed_diff_head: fadc9a8
persistence_status: PERSISTED
persistence_sha: fadc9a8
base_sha: 93102534e70c49be732e1c5cd1e834a129aa788b
upstream_before: 93102534e70c49be732e1c5cd1e834a129aa788b
harness_remediation_sha: e2c8231
qualification_commit_sha: fadc9a8
provenance_footer_commit_sha: 4e4f519
final_head_sha: 5fd9d63
upstream_sha: 5fd9d63
push_status: PUSHED

node_version: v24.18.0
postgres_version: 18.4
os_platform: win32 (x64)
cpu: AMD Ryzen 5 PRO 4650U — 12 logical CPUs
memory: 7,549 MB
qualification_db: travelhub_perf_000741 (isolated, dropped)
migration_count: 58/58
database_drift: 0

dataset_profile: REPRESENTATIVE (required) — NOT PREPARABLE (harness blocker F-1)
dataset_counts: users 1003 / products 1253 / customers 1000 / quotes 1753 / sales ~752 built before abort; dataset=null
app_instances: 2 (multi-instance proof) / 1 (blocked load profiles would use 1)
worker_instances: 2 (eventbus + multi-instance)
worker_interval: 2000 ms
worker_batch: 100
topology_valid: YES (multi-instance 3150/3150; probes 200/200 drained)

warmup: BLOCKED (dataset prep fails before warm-up)
steady_50: BLOCKED (dataset blocker)
peak_100: BLOCKED (dataset blocker)
burst_200: BLOCKED (dataset blocker)
soak_50: BLOCKED (dataset blocker)

class_a_p50_p95_p99_max: NOT JUDGED (partials only: multi 4.9/20.9/23.0/30.4 ms)
class_b_p50_p95_p99_max: NOT JUDGED (partials only: multi 16.6/34.6/38.2/42.6 ms)
class_c_p50_p95_p99_max: NOT JUDGED (not exercised)
class_d_p50_p95_p99_max: NOT JUDGED (not exercised)
class_e_p50_p95_p99_max: NOT JUDGED (payment gates blocked)
class_f_p50_p95_p99_max: NOT JUDGED (login gates blocked)

unexpected_5xx: 0
timeouts: 0
transport_failures: 0

payment_2rps: BLOCKED
payment_10rps: BLOCKED
payment_concurrency_50: BLOCKED
payment_duplicates: 0 (paycreate correctness scenario)
payment_wrong_replays: 0

booking_order_6rps: BLOCKED
booking_order_20rps: BLOCKED
booking_order_duplicates: N/A (not executed)
booking_order_invalid_transitions: N/A (not executed)

login_2rps: BLOCKED
login_5rps: BLOCKED
login_throttle_semantics: NOT EXERCISED

eventbus_100eps: 3000/3000 emitted/published @ 100 ev/s (valid)
eventbus_max_backlog: 178 (gate ≤ 100 → FAIL)
eventbus_oldest_pending: 1772 ms (gate ≤ 10 s → PASS)
eventbus_burst_1000: PASS (1000/1000, drain 11.3 s, poison isolated)
eventbus_recovery_5000: PASS (5000/5000, drain 51.1 s)
eventbus_recovery_workers: 2
eventbus_recovery_drain: 51,117 ms ≤ 120,000 ms
eventbus_duplicates: 0
eventbus_lost_events: 0
poison_isolation: PASS

correctness_gate: PASS (executed subset)
load_application_gate: PASS (multi 0.00%, eventbus 0.00%)
latency_gate: INVALID (no paced qualification phases)
reliability_gate: PASS (executed subset)
eventbus_gate: FAIL (backlog 178 > 100) — recovery/burst PASS
soak_gate: INVALID (blocked)

obs_1_sales_list: NOT JUDGED — root cause NOT YET PROVEN (paced qualification blocked)
booking_order_burst_observation: NOT JUDGED (blocked)
memory_observation: seed run peaked 1,357 MB RSS (no SLO, no leak claim)
invalid_run_history: rq-steady (harness blocker); vitest 1 env flake → clean rerun 135/135

backend_regression: tsc 0, build PASS, unit PASS, e2e 1194/1194 (pre + post)
frontend_regression: tsc 0, vitest 135/135, build PASS (pre + post)
artifact_integrity: PASS=144 WARN=0 FAIL=0
checker_regression: 13/13

targets_changed: 0
production_tuning: 0
harness_changed: 0
psp_subset: DEFERRED
production_capacity_claim: 0

final_qualification_verdict: C — INVALID / INCOMPLETE
step_2_17b_state: FINAL RE-QUALIFICATION INVALID / INCOMPLETE — NOT APPROVED
strict_review_state: NOT STARTED
step_2_17c_state: NOT STARTED
step_2_18_state: NOT STARTED
release_status: NOT PERFORMED
persistence_status: <filled after commit>
```

## 44. RELEASE

`RELEASE: NOT PERFORMED`

## 45. NEXT

```text
PHASE 2 — STEP 2.17B — QUALIFICATION HARNESS REMEDIATION (round 2)
proven blocker: drainOutbox bound 4,000 < REPRESENTATIVE EventBus seed 5,000
(+ live-validate REPRESENTATIVE seeding; EventBus backlog gate 178 > 100 for
performance-remediation decision)
then FINAL RE-QUALIFICATION AGAINST UNCHANGED APPROVED TARGETS
```

(separate prompt; targets frozen; harness defect NOT fixed here)

## 46. HARD STOP

Completed: repository verification → frozen-authority reconstruction → environment/topology
validation → baseline regression → dataset gate (BLOCKED, proven) → independent gates
(EventBus steady/burst/recovery, multi-instance) → correctness validation → cleanup →
post-run regression → artifact integrity → report/Roadmap → exact-file staging → commit /
provenance → push decision → HEAD/upstream verification. **STOPPED.**

Not started / not performed in this pass: performance remediation, harness modification,
target changes, Strict Review, Step 2.17C, Step 2.18, RLS, PSP.

```text
FINAL RE-QUALIFICATION = INVALID / INCOMPLETE (verdict C)
Step 2.17B = NOT APPROVED
NEXT = harness remediation for the proven dataset blocker
```
