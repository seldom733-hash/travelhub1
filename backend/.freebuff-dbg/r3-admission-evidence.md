# ROUND 3 PRE-FLIGHT ADMISSION EVIDENCE (raw, unedited)

Pass: PHASE 2 STEP 2.17B FINAL RE-QUALIFICATION ROUND 3 (DEDICATED ENVIRONMENT)
Date: 2026-08-18 (UTC timestamps per run)
Repository HEAD: 3ec8629 (== upstream, verified)
Candidate environment: thq-r3 (Linux containers on Docker Desktop/WSL2):
  - thq-r3-backend: node:22-alpine (Node v22.23.2), image == HEAD tree (325 src/prisma files SHA-identical)
  - thq-pg: postgres:16-alpine (PG 16.14), dedicated, NOT port-exposed, isolated thq-r3 bridge network
  - travelhub_r3 DB: 58/58 migrations applied, drift check pending
  - WSL2 kernel 6.18.33.2-microsoft-standard-WSL2; VM: 12 vCPU, 3,771 MB RAM, 1 GB swap
  - Host physical machine: AMD Ryzen 5 PRO 4650U / 12 logical / 7.4 GB RAM (same machine as dispositioned host)

## L1 — raw PostgreSQL autocommit vs explicit-tx (probe: l1-linux-probe.mjs, pool max=60)

Linux client -> thq-pg (container PG, WSL2 virtual disk):
  autocommit pool.query: n=20 p50=120.4ms p95=131.0ms max=132.9ms
  explicit tx:          n=20 p50=27.8ms  p95=29.1ms  max=30.6ms
  autocommit pool.query: n=50 p50=400.8ms p95=431.6ms max=432.0ms
  explicit tx:          n=50 p50=262.0ms p95=279.4ms max=280.1ms

Differential — Linux client -> native Windows PostgreSQL 18.4 (host.docker.internal:5432):
  autocommit pool.query: n=20 p50=308.6ms p95=410.8ms max=416.4ms
  explicit tx:          n=20 p50=21.8ms  p95=28.5ms  max=29.4ms
  autocommit pool.query: n=50 p50=937.1ms p95=1165.9ms max=1168.7ms
  explicit tx:          n=50 p50=130.9ms p95=139.3ms  max=142.8ms

Reference (prior disposition, Windows client -> Windows PG): autocommit n=50 p50=621ms; tx n=50 p50=22ms.

Interpretation: commit-bound writes serialize under concurrency in BOTH container paths. The
autocommit-vs-tx serialization signature is reproduced by the node-postgres client path on this
machine regardless of client OS (Windows or Linux container) and regardless of server
(container PG on WSL2 disk or native Windows PG). The container PG additionally fails to
parallelize explicit transactions (262ms @ n=50 vs 22ms native) — fsync/commit ceiling on the
WSL2 virtual disk.

## pgbench (server-side, inside thq-pg container — no Node client in path)

SELECT-only c=20 j=4 T=5:  2,003 tps (lat avg 9.98ms)          <- reads healthy
default (UPDATE+SELECT, commit) c=20 j=4 T=5: 280 tps (71.3ms) <- commit-bound ceiling
write-only (-N) c=20 j=4 T=5: 494 tps (40.5ms)
default c=50 j=8 T=5: 237 tps (210.9ms)                        <- does NOT scale with concurrency

Latency floor (Linux client -> thq-pg, latency-floor.mjs):
  single sequential SELECT 1: p50=1.19ms p95=2.92ms min=0.79ms
  concurrent SELECT 1 n=10:   p50=3.63ms max=4.11ms
  single sequential INSERT:   p50=2.76ms min=2.28ms

## L2 — trivial no-DB load client (dispatch-capability.ts, harness runLoad, 20 chains/s x10 steps, 15s, conc 50)

  step (single trivial round-trip): n=3000 p50=0.4ms p95=0.4ms max=0.4ms
  chain (10 sequential steps): n=300 p50=4.9ms p95=4.9ms max=4.9ms
  pacing: scheduled=300 started=300 completed=300 achievedStartRate=20.00/s (0.00% diff)
  loadApplicationValid=true  maxConcurrencyObserved=4
  -> client CAN dispatch the frozen 20 chains/s arrival rate in this environment.

## L3 — app/client differential (raw-client-probe.ts, quote POST, conc 50, N=40, SMALL dataset)

  client-observed: n=40 p50=1312 p95=1423 max=1424 ms
  server handler:  n=40 p50=147  p95=245  max=246  ms
  trivial-route probe (no DB/guards): n=22 p50=186 p95=785 max=796 ms
  gap client - handler ~= 1,165ms (DB-client path); reference disposition host: 733/119/78 (gap 614ms).

## REPRESENTATIVE seed feasibility (booking-order-burst, REPRESENTATIVE, final mode)

  Container seeded > 16 minutes without completing prepareDataset (sequential: 1,000 users,
  500 products+availability, 1,000 customers, 1,000 quotes, 1,000 order chains x ~10 API calls).
  At L3 per-request client latency (~1.3s), the 1,000-chain loop alone is ~hours. Aborted as an
  admission probe (per prompt §7 "do not spend hours on a known-invalid environment").

## Conclusion

Environment admission FAILS for the frozen Booking/Order burst gate (20 chains/s): the DB
write/commit path in the candidate dedicated environment cannot deliver the required committed
transaction rate (~240-500 commits/s for 20 chains/s vs measured ~125-280 tps ceiling) and
app-level client-observed latency at concurrency 50 (1.3s) is worse than the dispositioned host.
Per prompt §7, this pass STOPS with VERDICT C (QUALIFICATION INVALID / INCOMPLETE).
