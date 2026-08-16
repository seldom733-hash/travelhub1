# Load & Performance Qualification — Runbook (Step 2.17B)

> STATUS: AUTHORITY/DESIGN RECONCILIATION (2026-08-16). This runbook is a DESIGN — the load
> tool is NOT selected yet (§11 criteria), the harness is NOT implemented, and no commands
> below assume a specific tool. `<TOOL>`/`<SCENARIO>` placeholders are resolved at
> implementation time. Do not execute against production.

## 1. Prerequisites

- PostgreSQL 18.x (matching dev), isolated qualification DB (NEVER canonical dev/prod DB).
- Node version as recorded in `backend/.env`/CI; backend buildable (`npm run build`).
- Backend env: `DATABASE_URL` → isolated DB; `OUTBOX_WORKER_INTERVAL_MS`/`OUTBOX_WORKER_BATCH`
  defaults (2000 ms / 100) unless a scenario explicitly varies them and records it.
- MinIO/S3 up if media-bearing scenarios run (public media, storefront assets).
- Load tool selected per `docs/architecture/load-performance-qualification-2.17B.md` §11
  and installed as dev-dependency in `backend/` (NOT installed in this pass).
- Synthetic credentials/users dataset generator (no PII, no PAN/CVV, no production JWTs).

## 2. Isolated environment

```bash
# create isolated DB (names: travelhub_perf_<run-id>)
# apply migrations: npx prisma migrate deploy
# confirm migrate status + drift 0 before any load
```

- Shared dirty test state is FORBIDDEN as capacity evidence — fresh DB per qualification run.
- Record machine characteristics (CPU/RAM/OS/Node/PostgreSQL versions) in run metadata.

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

```text
SMOKE → BASELINE → STEADY → PEAK → BURST → SOAK → STRESS/BREAKPOINT → RECOVERY
```

Each scenario records: purpose, duration, concurrency/arrival model, dataset, metrics,
correctness assertions, pass/fail semantics (`docs/architecture/load-performance-qualification-2.17B.md` §23).

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

Per-run results directory under `docs/performance/results/` (run-id per run): `summary.json`
(env metadata, scenario, thresholds, pass/fail, commit SHA, timestamps) and optional CSV
files (not committed by default).

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
