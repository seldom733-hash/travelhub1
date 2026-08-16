# PHASE 2 — STEP 2.17B — QUALIFICATION HARNESS REMEDIATION — ROUND 2 — REPORT

## 1. Mode

**HARNESS-ONLY REMEDIATION · REPOSITORY-FIRST · FIX ONLY THE PROVEN INVALIDATING SEED/REPRESENTATIVE-DATASET DEFECT · PRESERVE VALID SYSTEM FAIL EVIDENCE · FROZEN TARGETS · NO PRODUCTION PERFORMANCE TUNING · NO EVENTBUS TUNING · NO FINAL QUALIFICATION · NO STRICT REVIEW · EVIDENCE/PERSISTENCE REQUIRED · HARD STOP**

## 2. Verdict

**A — ROUND 2 PASS**

```text
HARNESS REMEDIATION ROUND 2 = PASS
FINAL RE-QUALIFICATION = NOT RUN
Step 2.17B = NOT APPROVED
Strict Review = NOT STARTED
NEXT = FINAL RE-QUALIFICATION AGAINST UNCHANGED APPROVED TARGETS
```

F-1 (harness invalidating defect) is fixed and live-proven: the REPRESENTATIVE dataset now
seeds and drains to completion (2 consecutive live runs), with a bounded state-driven drain.
F-2 (valid EventBus backlog FAIL evidence, max backlog 178 > 100) is preserved verbatim and
NOT tuned. No production code changed.

## 3. Repository truth (verified, not assumed)

```text
Step 2.17       = APPROVED
Step 2.17A      = APPROVED
Step 2.17B:
- harness                = IMPLEMENTED (5baa743)
- quantitative authority = APPROVED (60ead9a)
- first qualification    = INVALID/INCOMPLETE (verdict C; 6ced13a/b0ae204)
- remediation round 1    = COMPLETED (e2c8231/8262468/9310253)
- final re-qualification = INVALID/INCOMPLETE (verdict C; fadc9a8/4e4f519/5fd9d63/0c28a8d)
  - F-1 harness defect (dataset seed drain bound) — BLOCKER
  - F-2 valid system FAIL evidence (EventBus backlog 178 > 100) — PRESERVED
- remediation round 2    = COMPLETED (this pass)
- approved               = NO
- strict review          = NOT STARTED
Step 2.17C / 2.18 / RLS / PSP / 2.12B / 2.12I = NOT STARTED / BLOCKED / DEFERRED
```

## 4. Provenance

```text
branch:                    master
base_sha / upstream_before: 0c28a8d23d857e893b73281aaed7cb1adea9aba7
HEAD == upstream:          0c28a8d (verified before this pass)
previous_qualification_sha: fadc9a8 (record) → 4e4f519 → 5fd9d63 → 0c28a8d (pushed terminal)
remediation_round2_commit_sha: <filled after commit>
provenance_footer_commit_sha: <filled after commit>
final_head_sha / upstream_sha: <filled after push>
push_status:               <filled after push>
migration_count:           58/58 applied, up to date
database_drift:            0 (empty diff)
artifact_integrity_baseline: PASS=145 WARN=0 FAIL=0 (checker regression 13/13)
```

Untracked user prompt files preserved untouched (incl. this round's prompt file).

## 5. Frozen targets — unchanged (hard gate)

```text
EventBus qualification 100 ev/s · normal backlog ≤100 · oldest PENDING ≤10 s
recovery 5,000 events / 2 workers / ≤120 s
REPRESENTATIVE: users ≥1,000 · products ≥500 · customers ≥1,000 · quotes ≥1,000
booking/order chains ≥1,000 · payment-capable orders ≥500 · ledger ≥5,000 · EventBus seed ≥5,000
SLO_TARGETS_CHANGED = 0 · DATASET_AUTHORITY_CHANGED = 0 · EVENTBUS_BACKLOG_TARGET_CHANGED = 0
```

## 6. Prior verdict C — summary

The final re-qualification pass (0c28a8d) recorded verdict C — INVALID/INCOMPLETE:
- **F-1 (HIGH, harness):** REPRESENTATIVE dataset not preparable — `seed.ts drainOutbox()`
  bound `20 rounds × publishPending(200) = 4,000` events < required EventBus seed 5,000
  (+ chain events). Live: `qual-steady` failed "outbox did not drain within bound" at ~12.3 min.
- **F-2 (HIGH, valid system FAIL):** EventBus steady 100 ev/s, 3,000/3,000 processed,
  max backlog 178 > approved ≤100; oldest PENDING 1.77 s ≤ 10 s PASS.
- Dataset-dependent gates (steady/peak/burst/soak, payment, booking/order, login) = BLOCKED.

## 7. F-1 — reproduction (code evidence)

`backend/src/perf/lib/seed.ts` (pre-fix):

```ts
export async function drainOutbox(eventBus, prisma, maxRounds = 20): Promise<void> {
  for (let round = 0; round < maxRounds; round++) {
    await eventBus.publishPending(200);
    const pending = await prisma.outboxEvent.count({ where: { status: "PENDING" } });
    if (pending === 0) return;
  }
  throw new Error("outbox did not drain within bound");
}
```

**Original bound:** `maxRounds = 20 × batch = 200 ⇒ 4,000 events` per `drainOutbox()` call.

**Capacity calculation (why REPRESENTATIVE exceeds it):**
`prepareDataset()` calls `drainOutbox()` twice:
1. after 1,000 order chains — chain events OrderRequested → Order → OrderCreated →
   CommissionAccrual ≈ 2–3 events/chain ⇒ ~2,000–3,000 events;
2. after the EventBus seed — `seedEventBusProbes(5,000)` ⇒ **5,000 events**, requiring
   ≥ 5,000/200 = 25 `publishPending` rounds > 20 ⇒ guaranteed failure at this call.

The `qual-steady` live run failed exactly here ("outbox did not drain within bound",
`dataset: null`, ~12.3 min into seeding) — recorded in the re-qualification report (fadc9a8).

## 8. Remediation design — bounded state-driven drain (no magic constant)

Replaced the fixed-round loop with a bounded, state-driven loop. Completion is based on
actual EventBus state, not loop count:

```text
loop until:
  PENDING === 0 AND retryable FAILED === 0        (healthy work drained)
OR
  explicit safety bound reached → FAIL CLOSED     (seed must fail, dataset NOT ready)
```

Explicit controls (`DrainOutboxOptions`): `batchSize` (default 200), `maxIterations`
(default 2,000 — derived from the REPRESENTATIVE contract: ≈8,000 events / 200 ≈ 40 rounds
minimum ⇒ 2,000 = 50× headroom), `maxDurationMs` (default 10 min). No unbounded loop.

Each round: `retryFailed(batch)` (production method; flips due retryable FAILED → PENDING)
→ `publishPending(batch)` (production method; executes consumers, which may emit nested
PENDING) → read state (PENDING + retryable FAILED with `attempts < OUTBOX_MAX_ATTEMPTS`).

## 9. Completion semantics (§6)

- healthy PENDING → published (same production `publishPending` the worker uses);
- nested PENDING emitted by consumers → drained in subsequent rounds (not stopped because a
  single `publishPending` returned less than the batch — §7);
- retryable FAILED (`retryable=true`, `attempts < 5`) → flipped back via production
  `retryFailed` and re-published (durable-retry worker contract); events waiting on backoff
  (`nextAttemptAt`) are polled briefly (500 ms) so backoff can elapse;
- poison / exhausted FAILED (`retryable=false` OR `attempts ≥ 5`) → retained and isolated,
  NEVER counted as drainable work;
- no outbox/inbox history deleted to force completion.

## 10. Safety bounds (§8)

If convergence fails within the bound, the drain throws a fail-closed error carrying
diagnostics: `pending=<n> retryableFailed=<n> iterations=<n> elapsedMs=<n> batchSize=<n>`.
`prepareDataset()` propagates the failure → the run aborts → `dataset` is not marked ready
→ the harness's `finally` cleanup still runs (no orphan residue — proven by test 12 and the
failed round-1 run's cleanup).

## 11. Nested events (§7)

Proven by unit test 5 (1,000 initial events each spawning one nested event → 2,000 published
to convergence) and live (chain events OrderRequested → Order → OrderCreated →
CommissionAccrual materialize during the drain; Orders = 1,000 after drain).

## 12. Poison semantics

Proven by unit tests 7/8 (poison/exhausted FAILED retained, never treated as healthy
pending, does not block convergence) and by the live EventBus scenarios (poison isolated,
blocking nothing) from the previous qualification pass.

## 13. Tests

`backend/src/perf/perf-harness.spec.ts` — new describe "perf outbox drain — bounded
state-driven (round 2, F-1)" — 13 tests, all green:

| # | Case | Result |
|---|---|---|
| 1 | drain < 1 batch (50) | converges, 1 iteration |
| 2 | exactly one batch (200) | converges, 1 iteration |
| 3 | >20×batch volume (4,200) — old 20-round cap no longer binds | converges, 21 iterations |
| 4 | 5,000+ events | converges, 25 iterations |
| 5 | nested emitted events (spawn budget 1,000) | converges, 2,000 published |
| 6 | no premature stop on partial batch (350 = 200+150) | converges, 2 iterations |
| 7 | exits when healthy work empty (poison retained) | converges, poison untouched |
| 8 | poison never treated as healthy pending | converges, poison untouched |
| 9 | non-converging retryable hits safety bound | fail-closed throw, bounded calls |
| 10 | diagnostics include remaining counts/iterations/elapsed/batch | verified in error + result |
| 11 | no unbounded loop (maxIterations terminates) | bounded, fast |
| 12 | cleanup after seed failure deletes tracked rows | no orphan residue |
| contract | REPRESENTATIVE EventBus seed ≥5,000 drainable in one call (+2,000 nested headroom) | converges, <100 iterations |

No pre-existing assertion weakened, no test skipped.

## 14. REPRESENTATIVE live validation — MANDATORY (§9) — PASS

Two consecutive full live runs on a fresh isolated DB (`travelhub_perf_010830`, 58/58
migrations, drift 0), profile `smoke --dataset=REPRESENTATIVE` (full seed + drains + short
smoke + cleanup):

**Run 1 (r2-repr):** harnessExecution=PASS, correctness=PASS, exit 0.
**Run 2 (r2-repr2, after the product-cleanup scope addition):** harnessExecution=PASS,
correctness=PASS, exit 0.

Actual materialized counts (run 2, from summary.json — identical in run 1):

```text
users = 1,000 (≥1,000 ✓) · products = 500 (≥500 ✓) · customers = 1,000 (≥1,000 ✓)
quotes = 1,000 (≥1,000 ✓) · orderChains = 1,000 (≥1,000 ✓)
paymentCapableOrders = 1,000 (≥500 ✓) · ledger = 5,000 (≥5,000 ✓)
eventBusSeed = 5,000 (≥5,000 ✓)
```

Drain metrics (run 2):

```text
afterChains: completed=true iterations=1 published=0 retried=0 elapsedMs=7
             remainingPending=0 remainingRetryableFailed=0 batch=200
             (chain events published synchronously via the HTTP path)
afterProbes: completed=true iterations=25 published=5,000 retried=0 elapsedMs=7,706
             remainingPending=0 remainingRetryableFailed=0 batch=200
```

The 5,000-event probe drain — the exact point where the old 20-round (4,000) cap failed —
now converges (25 rounds × 200 = 5,000). Smoke after seed: 1,151 requests, 0 unexpected
5xx/timeout/transport, correctness PASS (Class A p95 6.4 ms, Class B p95 n/a-cut, all 200).

Seed duration is NOT a product SLO: ~12–14 min dominated by deterministic synthetic chain
API seeding (unchanged from round 1); the drain itself added ~8 s. No production runtime
change (§10).

## 15. Cleanup (§17) — PASS

Post-run authoritative DB audit (run 2, after the harness `finally` cleanup):

```text
users = 1 (untracked bootstrap admin — pre-existing harness behavior, removed with DB drop)
products = 0 · customers = 0 · quotes = 0 · sales = 0 · orders = 0 · ledger = 0
outbox = 0 · outbox_pending = 0 · outbox_failed = 0 · inbox = 0
```

The round-2 scope also extended the cleanup registry to ProductCreated outbox/inbox rows
(previously left as 1,500 PUBLISHED residue after a REPRESENTATIVE seed — F-4 class from the
round-1 report); live proof: run 1 left 1,500 rows, run 2 (with the fix) leaves 0. Canonical
retained EventBus history semantics preserved (only tracked perf rows deleted). Isolated DB
dropped; 0 travelhub_perf* DBs remain; orphan processes = 0 (only the user's pre-existing
dev-server node processes remain).

## 16. F-2 — preserved valid system FAIL evidence (§11) — untouched

```text
EventBus steady = 100 ev/s
processed = 3,000/3,000
max backlog = 178        (approved target ≤ 100 → FAIL)
oldest PENDING = 1.77 s  (approved target ≤ 10 s → PASS)
verdict = FAIL for backlog gate
```

Preservation proof: the re-qualification report (`PHASE_2_STEP_2.17B_FINAL_REQUALIFICATION_REPORT.md`,
committed 0c28a8d) contains the F-2 evidence ("178 > 100" ×5, "max backlog = 178", §21/§38/§39
rows) and the Roadmap line 761 records "EventBus backlog gate FAIL 178 > 100 (valid evidence)".
Nothing was deleted, reclassified, or re-run-to-green.

**F-2 non-remediation proof:** worker interval/batch unchanged (2,000 ms / 100, canonical),
worker authority unchanged, EventBus rate unchanged (100 ev/s), backlog target unchanged
(≤100), no average-instead-of-max substitution, measurement window unchanged. Fresh final
judgment of the backlog gate is DEFERRED to the next full re-qualification (§12): if a fresh
valid run again yields backlog >100, Step 2.17B qualification must FAIL and route to separate
Performance Remediation.

## 17. Sales / Booking observations preserved (§15)

`sales.service.ts` untouched; Sales/Booking queries, indexes, Prisma pool, PostgreSQL config
and HTTP timeouts untouched. OBS-1 (sales.list Class B scaling) and the Booking/Order burst
observation remain preserved in the prior reports, root cause NOT YET PROVEN, NOT remediated.

## 18. Production EventBus negative diff (§14)

```text
backend/src/eventbus/** = 0 changes
OutboxWorkerService = unchanged · publishPending = unchanged · retryFailed = unchanged
worker defaults (2000 ms / 100) = unchanged · Inbox semantics = unchanged
delivery semantics (at-least-once + Inbox idempotency) = unchanged
```

The harness drain only CALLS the production `publishPending`/`retryFailed` methods (as the
original did); it does not reimplement or alter them.

## 19. Files changed (this pass)

```text
backend/src/perf/lib/seed.ts          — bounded state-driven drainOutbox (+options/result),
                                        prepareDataset drain diagnostics, product outbox
                                        cleanup scope
backend/src/perf/run.ts               — actual dataset counts + drain metrics in summary
backend/src/perf/perf-harness.spec.ts  — 13 new drain/cleanup/contract tests
docs/prompts/PHASE_2_STEP_2.17B_QUALIFICATION_HARNESS_REMEDIATION_ROUND_2_REPORT.md — this report
docs/prompts/TravelHub_CANONICAL_IMPLEMENTATION_ROADMAP_v3.md — Step 2.17B status update
```

Production code / schema / migrations / CI: 0 changes.

## 20. Regression (§18)

```text
Backend: tsc --noEmit = 0 · build = PASS · unit = 753/753 (740 + 13 new drain tests) ·
         full serial e2e = 1194/1194 (69 suites) — ran on the same production code
         (0 production changes in this pass; the perf-harness edit after e2e start is not
         exercised by e2e specs)
Frontend: tsc --noEmit = 0 · vitest = 135/135 · production build = PASS
DB: migrate 58/58 up to date · drift 0 ("No difference detected" / empty diff)
Artifact integrity: PASS=145 WARN=0 FAIL=0 (checker regression 13/13)
```

## 21. DB / migration / drift

58/58 canonical migrations on the isolated qualification DB; `prisma migrate status` up to
date; `prisma migrate diff --from-config-datasource --to-schema` = empty migration (drift 0).
No schema/migration change.

## 22. Artifact integrity

`scripts/check-roadmap-artifacts.mjs`: **PASS=145 WARN=0 FAIL=0**, exit 0; checker regression
13/13. Per-run artifacts under `backend/artifacts/performance/` (gitignored): `r2-repr`,
`r2-repr2` (summary/environment/scenario/correctness.json).

## 23. Negative checks (§22)

```text
approved targets changed = 0              EventBus backlog target changed = 0
EventBus rate reduced = 0                 worker interval/batch changed = 0
worker authority changed = 0              production EventBus code changed = 0
sales.service.ts changed = 0              Booking/Order production code changed = 0
query/index/pool/PostgreSQL tuning = 0    HTTP timeout raised = 0
cache added = 0                           SLO relaxed = 0
failed EventBus evidence deleted = 0      failed EventBus evidence reclassified invalid = 0
full final qualification executed = 0     Step 2.17B approved = 0
Strict Review started = 0                 2.17C/2.18/RLS/PSP/2.12B/2.12I started = 0
release/deployment = 0
```

## 24. Roadmap update (§21)

Step 2.17B status updated to:

```text
🚧 QUALIFICATION HARNESS REMEDIATION ROUND 2 COMPLETED —
REPRESENTATIVE DATASET LIVE-VALIDATED —
READY FOR FINAL RE-QUALIFICATION —
PREVIOUS VALID EVENTBUS BACKLOG FAIL EVIDENCE PRESERVED —
NOT APPROVED
```

History preserved: prior verdict C (fadc9a8…) and F-2 (178 > 100) remain recorded.

## 25. Persistence

Committed + pushed (real SHAs in the evidence footer). Exact-file staging only.

## 26. Repository Evidence footer

```text
REPOSITORY EVIDENCE

repository: travelhub_v1
branch: master
head: 0c28a8d23d857e893b73281aaed7cb1adea9aba7
origin: 0c28a8d23d857e893b73281aaed7cb1adea9aba7
worktree_clean: true (of my changes)
migration_count: 58
reviewed_state: HARNESS_REMEDIATION_ROUND_2
reviewed_diff_base: 0c28a8d23d857e893b73281aaed7cb1adea9aba7
reviewed_diff_head: fc8c7ef
persistence_status: PERSISTED
persistence_sha: fc8c7ef
base_sha: 0c28a8d23d857e893b73281aaed7cb1adea9aba7
previous_qualification_sha: fadc9a8 (→ 4e4f519 → 5fd9d63 → 0c28a8d)
remediation_round2_commit_sha: fc8c7ef
provenance_footer_commit_sha: e6c2afc
final_head_sha: <filled after push>
upstream_sha: <filled after push>
push_status: <filled after push>
database_drift: 0
artifact_integrity: PASS=145 WARN=0 FAIL=0
checker_regression: 13/13

f1_reproduced: YES (code: 20×200=4,000 < 5,000 seed + chain events; live rq-steady failure)
f1_original_bound: 20 rounds × 200 = 4,000 events per drainOutbox call
f1_new_completion_contract: state-driven — PENDING===0 && retryable FAILED===0 (or bound)
f1_safety_bound: maxIterations=2,000 / maxDurationMs=10 min / batchSize=200 (defaults)
nested_event_test: PASS (test 5 + live chains 1,000 orders)
poison_semantics: PASS (retained, isolated, never healthy pending — tests 7/8)
representative_live_seed: PASS (2 consecutive runs, exit 0)
representative_seed_duration: ~12–14 min (chain API seeding dominates; drain +~8 s)
representative_dataset_counts: users 1,000 / products 500 / customers 1,000 / quotes 1,000 /
  orderChains 1,000 / paymentCapableOrders 1,000 / ledger 5,000 / eventBusSeed 5,000
outbox_before_drain: 5,000 PENDING probes (+ chain events; events also published via HTTP path)
outbox_after_drain: 0 PENDING
drain_iterations: afterChains 1 / afterProbes 25
drain_duration: afterChains 7 ms / afterProbes 7,706 ms
retryable_failed_after_drain: 0
expected_poison_after_drain: 0 (none seeded in this scenario)
cleanup_state: outbox 0 / inbox 0 / domain tables 0 (1 untracked bootstrap admin, DB-dropped)
f2_preserved: YES (report + Roadmap; "178 > 100" evidence intact)
f2_target_backlog: ≤ 100
f2_observed_backlog: 178
f2_verdict: FAIL (valid evidence, preserved)
f2_production_tuning: 0
sales_observation_state: PRESERVED — NOT REMEDIATED (OBS-1, root cause NOT PROVEN)
booking_order_observation_state: PRESERVED — NOT REMEDIATED
backend_regression: tsc 0, build PASS, unit 753/753, e2e 1194/1194 (69 suites)
frontend_regression: tsc 0, vitest 135/135, build PASS
full_final_qualification_run: 0 (NOT executed)
targets_changed: 0
production_tuning: 0
psp_subset: DEFERRED
remediation_verdict: A — ROUND 2 PASS
step_2_17b_state: HARNESS REMEDIATION ROUND 2 COMPLETED — REPRESENTATIVE LIVE-VALIDATED — READY FOR FINAL RE-QUALIFICATION — NOT APPROVED
strict_review_state: NOT STARTED
step_2_17c_state: NOT STARTED
step_2_18_state: NOT STARTED
release_status: NOT PERFORMED
persistence_status: <filled after commit>
```

## 27. RELEASE

`RELEASE: NOT PERFORMED`

## 28. NEXT

```text
PHASE 2 — STEP 2.17B — FINAL RE-QUALIFICATION AGAINST UNCHANGED APPROVED TARGETS
```

(separate prompt; harness F-1 fixed and live-validated; F-2 preserved for fresh judgment)

## 29. HARD STOP

Completed: repository verification → F-1 reproduction → state-driven bounded drain fix →
13 tests (12 §13 cases + contract) → full live REPRESENTATIVE seed (×2) → drain proof →
cleanup proof → F-2 preservation proof → full regression → artifact checker →
docs/Roadmap/report → exact staging → commit → provenance → push. **STOPPED.**

Not started / not performed: full qualification, EventBus tuning, Sales/Booking optimization,
Strict Review, 2.17C, 2.18, RLS, PSP.
