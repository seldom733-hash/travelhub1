// Step 2.17B Workstream A — live backlog sampler during eventbus-steady.
// Queries the perf DB every 200ms for PENDING/FAILED by aggregateId prefix.
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";

const dbName = readFileSync(process.env.TMP ? `${process.env.TMP}/rq3_db.txt` : "/tmp/rq3_db.txt", "utf8").trim();
const dbUrl = `postgresql://postgres:postgres@localhost:5432/${dbName}`;
const prefix = process.argv[2] ?? "rem3a-ebs3";

const samples = [];
const sampler = setInterval(async () => {
  try {
    const res = await fetch(`${dbUrl.replace("postgresql://postgres:postgres@localhost:5432/", "")}`, { signal: AbortSignal.timeout(500) }).catch(() => null);
    // Not a REST endpoint — use psql instead.
  } catch {}
  const { execSync } = await import("node:child_process");
  try {
    const q = `SELECT status, count(*) FROM events.\"OutboxEvent\" WHERE \"aggregateId\" LIKE 'perf-${prefix}-%' GROUP BY status`;
    const out = execSync(
      `psql -h localhost -U postgres -d ${dbName} -tA -c "${q}"`,
      { encoding: "utf8", timeout: 1500, env: { ...process.env, PGPASSWORD: "postgres" } },
    );
    const counts = {};
    for (const line of out.trim().split("\n").filter(Boolean)) {
      const [status, c] = line.split("|");
      counts[status.trim()] = Number(c);
    }
    samples.push({ t: Date.now(), ...counts });
    const pend = counts.PENDING ?? 0;
    process.stdout.write(`\r t+${Math.round((Date.now() - start) / 100) / 10}s PENDING=${pend} PUB=${counts.PUBLISHED ?? 0} FAIL=${counts.FAILED ?? 0}   `);
  } catch (e) {
    process.stdout.write(`\r sampler err: ${String(e.message).slice(0, 60)}   `);
  }
}, 200);

const start = Date.now();
const child = spawn(process.execPath, ["node_modules/ts-node/dist/bin.js", "src/perf/run.ts", "--profile=eventbus-steady", "--duration=20000", "--workers=2", `--run-id=${prefix}`], {
  cwd: process.cwd(),
  env: { ...process.env, DATABASE_URL: `postgresql://postgres:postgres@localhost:5432/${dbName}` },
  stdio: ["ignore", "pipe", "pipe"],
});
let childOut = "";
child.stdout.on("data", (d) => (childOut += d.toString()));
child.stderr.on("data", (d) => (childOut += d.toString()));
child.on("exit", (code) => {
  clearInterval(sampler);
  process.stdout.write("\n");
  const peak = Math.max(0, ...samples.map((s) => s.PENDING ?? 0));
  const nonZero = samples.filter((s) => (s.PENDING ?? 0) > 0);
  console.log(`\n=== SAMPLES: ${samples.length}, peak PENDING=${peak}, nonzero=${nonZero.length} ===`);
  // print compressed series
  const series = samples.map((s) => `${((s.t - start) / 1000).toFixed(1)}:${s.PENDING ?? 0}`).join(" ");
  console.log(series.slice(0, 3000));
  const verdict = childOut.split("\n").filter((l) => l.includes("verdict:") || l.includes("EVENTBUS")).join("\n");
  console.log(verdict);
});
