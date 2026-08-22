/**
 * Layer 2 / §8 — client dispatch capability probe.
 *
 * Question: can the paced load client dispatch the frozen booking workload
 * (20 chains/s, each chain = 10 sequential HTTP round-trips) on THIS host when
 * pointed at a trivial no-DB target?
 *
 * A raw node:http server answers 10 route paths with JSON immediately (no DB,
 * no guards, no TravelHub code). The harness pacer (loader.ts runLoad, paced
 * mode) drives it: makeRequest performs the 10 sequential round-trips and the
 * whole chain is one "request" for the pacer (mirrors the booking scenario's
 * startChain shape).
 *
 * If started ≈ scheduled (within ±5%), the client CAN schedule and dispatch the
 * frozen arrival rate on this host → server-side cost is what prevents the
 * booking gate, not the client. If started ≪ scheduled even against a trivial
 * server, the client/host itself cannot apply the load.
 */
import http from "node:http";
import { runLoad } from "../src/perf/lib/loader";

const CHAIN_STEPS = 10;
const TARGET_RPS = Number(process.argv[2] ?? 20);
const DURATION_MS = Number(process.argv[3] ?? 15_000);
const CONCURRENCY = Number(process.argv[4] ?? 50);

function pct(sorted, q) {
  if (sorted.length === 0) return 0;
  return sorted[Math.min(sorted.length - 1, Math.ceil((q / 100) * sorted.length) - 1)];
}

async function main(): Promise<void> {
const server = http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ ok: true }));
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const port = (server.address() as { port: number }).port;
const baseUrl = `http://127.0.0.1:${port}`;

function stepGet(i) {
  return new Promise((resolve) => {
    const t0 = performance.now();
    const req = http.request({ host: "127.0.0.1", port, path: `/step/${i}`, method: "GET", agent: false }, (res) => {
      res.resume();
      res.on("end", () => resolve(performance.now() - t0));
    });
    req.on("error", () => resolve(-1));
    req.end();
  });
}

const stepDurations = [];
const chainDurations = [];

const result = await runLoad({
  baseUrl,
  concurrency: CONCURRENCY,
  durationMs: DURATION_MS,
  warmupMs: 0,
  mode: "paced",
  targetRps: TARGET_RPS,
  makeRequest: async () => {
    const chainStart = performance.now();
    for (let i = 0; i < CHAIN_STEPS; i++) {
      const d = await stepGet(i);
      stepDurations.push(d);
    }
    chainDurations.push(performance.now() - chainStart);
    return { label: "chain", method: "GET", path: "/done", expected: [200], routeClass: "D" };
  },
  seed: 1,
});

await new Promise((resolve) => server.close(resolve));

const sp = [...stepDurations].sort((a, b) => a - b);
const cp = [...chainDurations].sort((a, b) => a - b);
console.log(`=== DISPATCH CAPABILITY: ${TARGET_RPS} chains/s x${CHAIN_STEPS} steps, ${DURATION_MS}ms, conc ${CONCURRENCY} ===`);
console.log(`step (single trivial round-trip): n=${sp.length} p50=${pct(sp, 0.5).toFixed(1)}ms p95=${pct(sp, 0.95).toFixed(1)}ms max=${pct(sp, 1).toFixed(1)}ms`);
console.log(`chain (${CHAIN_STEPS} sequential steps): n=${cp.length} p50=${pct(cp, 0.5).toFixed(1)}ms p95=${pct(cp, 0.95).toFixed(1)}ms max=${pct(cp, 1).toFixed(1)}ms`);
console.log(`pacing: scheduled=${result.pacing?.scheduledOperations} started=${result.pacing?.startedOperations} completed=${result.pacing?.completedOperations}`);
console.log(`achievedStartRate=${result.pacing?.achievedStartRate?.toFixed(2)}/s target=${TARGET_RPS}/s`);
console.log(`loadApplicationValid=${result.pacing?.loadApplicationValid} detail=${result.pacing?.loadValidityDetail}`);
console.log(`maxConcurrencyObserved=${result.pacing?.maxConcurrencyObserved}`);
console.log(`client can dispatch ${TARGET_RPS} chains/s against trivial server: ${result.pacing?.loadApplicationValid ? "YES" : "NO"}`);
process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
