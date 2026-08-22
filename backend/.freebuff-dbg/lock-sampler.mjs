/**
 * Lock-only sampler (plain JS): reports REAL lock waits (wait_event_type='Lock',
 * 'LWLock', 'Transaction') during a chain run, excluding idle 'Client'
 * connections (which the earlier lock-watch misread as contention).
 */
import { spawnSync } from "node:child_process";

const dbName = process.argv[2] ?? "postgres";
const intervalMs = Number(process.argv[3] ?? 500);
const maxSamples = Number(process.argv[4] ?? 200);

let samples = 0;
const counts = new Map();
const t0 = Date.now();

function sample() {
  const r = spawnSync(
    "psql",
    ["-h", "localhost", "-U", "postgres", "-d", dbName, "-t", "-A", "-c", `
      SELECT CASE
        WHEN a.wait_event_type = 'Lock' THEN 'LOCK:' || COALESCE(a.wait_event, '?')
        WHEN a.wait_event_type = 'LWLock' THEN 'LWLOCK:' || COALESCE(a.wait_event, '?')
        WHEN a.wait_event_type = 'Transaction' THEN 'TXID:' || COALESCE(a.wait_event, '?')
        WHEN a.wait_event_type IS NOT NULL AND a.wait_event_type <> 'Client' THEN a.wait_event_type || ':' || COALESCE(a.wait_event, '?')
        ELSE NULL
      END AS w, left(a.query, 70) AS q
      FROM pg_stat_activity a
      WHERE a.datname = '${dbName}' AND a.state = 'active'
        AND a.wait_event_type IS NOT NULL AND a.wait_event_type <> 'Client'
    `],
    { encoding: "utf8", env: { ...process.env, PGPASSWORD: "postgres" } },
  );
  for (const line of r.stdout.trim().split("\n").filter(Boolean)) {
    const parts = line.split("|");
    const key = `${parts[0]} :: ${(parts[1] ?? "").slice(0, 55)}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  samples++;
}

function sleep(ms) {
  return new Promise((res) => setTimeout(res, ms));
}

async function main() {
  while (samples < maxSamples) {
    sample();
    await sleep(intervalMs);
  }
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`samples=${samples} elapsed=${elapsed}s`);
  console.log("=== REAL LOCK/LWLOCK/TXID waits (query → count) ===");
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25);
  for (const [k, v] of sorted) {
    console.log(`  ${String(v).padStart(4)}  ${k}`);
  }
  if (counts.size === 0) console.log("  (none)");
  process.exit(0);
}

void main();
