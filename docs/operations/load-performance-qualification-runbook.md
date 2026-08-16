# Load & Performance Qualification — Runbook (Step 2.17B)

> STATUS: HARNESS IMPLEMENTED (2026-08-16). Tool = dependency-free Node harness
> (`backend/src/perf/run.ts`, run via `npx ts-node`). Commands below are real and were
> validated live against an isolated `travelhub_perf_*` database. Do not execute against
> production.

## 0. SLO / load authority state (2026-08-16) — VERDICT B (PARTIAL)

Decision pass: `docs/prompts/PHASE_2_STEP_2.17B_SLO_LOAD_AUTHORITY_DECISION_REPORT.md`.

- **Approved (repository contracts, not business demand):** correctness-under-load hard
  gates (0 duplicate Payment/Order/Commission/Accrual, 0 wrong/divergent replay, 0 lost
  committed PENDING event, 0 poison-blocking, 0 raw 500 from controlled races, Decimal
  exact, 0 invalid terminal transition) and HTTP reliability posture (unexpected
  5xx/timeout/transport = 0). Fast-but-wrong FAILS.
- **TBD — BUSINESS/PRODUCT/OPERATIONS AUTHORITY REQUIRED:** every quantitative target
  (expected V1 peak RPS, concurrency, read/write mix, booking/order/payment/login rates,
  p95/p99 latency per route class, EventBus steady/peak/burst/backlog-age/drain-time,
  soak duration, release regression tolerance, qualification environment/instance counts).
  0 approved numbers exist in the repository; engineering does NOT invent them.
- **Hard semantic rule:** `approved SLO ≠ measured capacity ≠ production capacity ≠ V1
  launch requirement ≠ future scaling target`. All numbers in this runbook's example
  profiles are EXPLORATORY harness validation only.
- **Final qualification is BLOCKED** where material targets are TBD. Step 2.17B remains
  NOT APPROVED.
- **PSP subset deferred:** `STEP 2.17B-PSP` until ADR-0015 ACCEPTED + 2.12B runtime +
  provider sandbox/contract evidence.

## 1. Prerequisites

- PostgreSQL 18.x (matching dev), isolated qualification DB (NEVER canonical dev/prod DB).
- Node version as recorded in `backend/.env`/CI; backend buildable (`npm run build`).
- Backend env: `DATABASE_URL` → isolated DB; `OUTBOX_WORKER_INTERVAL_MS`/`OUTBOX_WORKER_BATCH`
  defaults (2000 ms / 100) unless a scenario explicitly varies them and records it.
- MinIO/S3 up if media-bearing scenarios run (public media, storefront assets).
- Harness: `backend/src/perf/run.ts` (dependency-free; `npm run perf:run`). No third-party
  load tool is installed.
- Synthetic credentials/users dataset generator built into the harness (no PII, no PAN/CVV,
  no production JWTs).

## 2. Isolated environment

```bash
# from backend/
PERF_DB="travelhub_perf_$(date +%H%M%S)"
PGPASSWORD=postgres psql -h localhost -U postgres -c "DROP DATABASE IF EXISTS \"$PERF_DB\" WITH (FORCE)" -c "CREATE DATABASE \"$PERF_DB\""
export DATABASE_URL="postgresql://postgres:postgres@localhost:5432/$PERF_DB"
npx prisma migrate deploy   # 58 canonical migrations
npx prisma migrate status   # must be up to date
```

- Shared dirty test state is FORBIDDEN as capacity evidence — fresh DB per qualification run.
- Record machine characteristics (CPU/RAM/OS/Node/PostgreSQL versions) — the harness emits
  them automatically into `environment.json` (secrets scrubbed).

## 3. Seed / reset

- Deterministic generators: users (distinct logins for throttle scenarios), sellers,
  products, tariffs, availability, finance rows.
- Record seed state (generator version + params) in `summary.json`.
- Verify business seed invariants before load (spot checks: Decimal values, slots, statuses).

## 4. Start app / worker instances

- 1 application instance for baseline; 2 application instances for multi-instance scenarios
  (each with its own port); 1–2 outbox worker instances as the scenario requires.
- Log level recorded (do NOT disable audit/security logs; note level in metadata).
- Wait for warm-up (first Prisma connection, worker startup) before measuring.

## 5. Scenario execution order

```bash
npx ts-node src/perf/run.ts --profile=smoke  --run-id=<id>
npx ts-node src/perf/run.ts --profile=baseline --run-id=<id>
npx ts-node src/perf/run.ts --profile=paycreate --run-id=<id>          # idempotency concurrency
npx ts-node src/perf/run.ts --profile=eventbus-recovery --run-id=<id>   # burst drain + multi-instance
npx ts-node src/perf/run.ts --profile=burst --run-id=<id>
npx ts-node src/perf/run.ts --profile=soak --run-id=<id> --duration=30000
npx ts-node src/perf/run.ts --profile=stress --stress --run-id=<id>     # explicit opt-in
```

Order: SMOKE → BASELINE → STEADY → PEAK → BURST → SOAK → STRESS/BREAKPOINT → RECOVERY.
The harness boots the app in-process against the isolated DB, seeds deterministic synthetic
data, runs the profile, validates correctness against authoritative DB state and cleans up.
Each scenario records: purpose, duration, concurrency, dataset, metrics, correctness
assertions, pass/fail semantics (§23 of the design doc).

## 6. Capture metrics

- Latency p50/p95/p99/max per operation class; throughput ops/sec; successful ops/sec;
  EventBus events/sec; backlog drain rate; error/conflict rate by class.
- Resource: process CPU, RSS/heap, event-loop lag, PG active connections, DB size,
  outbox backlog, test-client saturation (only what the environment measures reliably).

## 7. Validate business invariants (hard gate)

After each scenario (and at soak milestones):
- 0 duplicate Payment/Order/Commission/Accrual facts (idempotency + inbox dedup);
- no invalid Booking transition; no negative capacity; last-slot guard held;
- no lost PENDING events; no unexpected poison amplification;
- Decimal values exact; no raw 500 from controlled races;
- Inbox/outbox rows never deleted as cleanup.

## 8. Interpret errors

- Expected 4xx (validation/RBAC), expected 409 (idempotency divergence, last-slot conflict),
  429 (login throttle) — counted separately, not failures.
- Unexpected 5xx, timeouts, connection/DB failures, harness failures — FAIL the run.

## 9. Clean up

- Drop the isolated qualification DB; remove temp artifacts; kill app/worker/load processes.
- Verify no leftover advisory locks / connections on canonical DB.
- Remove any seeded rows from shared dev DB (the isolated DB is the only load target).

## 10. Archive result metadata

Artifacts are written automatically by the harness to `backend/artifacts/performance/<run-id>/`
(gitignored): `summary.json` (verdict: harnessExecution/correctness/measurement/
sloQualification), `environment.json` (env metadata, secrets scrubbed), `scenario.json`
(steps/params), `correctness.json` (checks + verdict). Summary measurements may be copied
into the implementation report; bulky raw artifacts are never committed.

## 11. Abort criteria

- Raw 500 storm, duplicate committed facts, negative capacity, deadlock storm,
  DB pool exhaustion with app failure, event-loop stall, backlog unbounded growth,
  test-client saturation invalidating measurements, disk/memory exhaustion.
- On abort: capture partial evidence, clean up, classify, do NOT retry-until-pass.

## 12. Relationship to authority

- Approved targets ≠ measured results. Local/CI results are NOT production capacity proof.
- Final qualification requires authority-approved SLO/load targets
  (`TBD — BUSINESS/PRODUCT/OPERATIONS AUTHORITY REQUIRED`).
- PSP-dependent subset (`STEP 2.17B-PSP`) deferred until ADR-0015 ACCEPTED + 2.12B runtime +
  provider sandbox/contract evidence.
