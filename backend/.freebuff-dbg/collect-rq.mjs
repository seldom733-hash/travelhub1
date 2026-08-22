import { readFileSync } from "node:fs";

const dirs = ["rq-ds-sm", "rq-topo", "rq-pay-s", "rq-pay-b", "rq-pay-c", "rq-lg-q", "rq-lg-b", "rq-bok-s", "rq-bok-b", "rq-ebs", "rq-ebb", "rq-ebr"];
for (const d of dirs) {
  try {
    const s = JSON.parse(readFileSync(`artifacts/performance/${d}/scenario.json`, "utf8"));
    const su = JSON.parse(readFileSync(`artifacts/performance/${d}/summary.json`, "utf8"));
    const c = JSON.parse(readFileSync(`artifacts/performance/${d}/correctness.json`, "utf8"));
    const p = su.load && su.load.pacing;
    let line = `${d} | scen:${JSON.stringify(s)}`;
    if (p) line += ` | pace:${JSON.stringify({ t: p.targetRps, sch: p.scheduledOperations, st: p.startedOperations, ach: p.achievedStartRate ? +p.achievedStartRate.toFixed(2) : null, valid: p.loadApplicationValid })}`;
    if (su.load && su.load.totals) line += ` | tot:${JSON.stringify(su.load.totals)}`;
    if (su.multiInstance) line += ` | mi:${JSON.stringify(su.multiInstance)}`;
    if (su.dataset) line += ` | ds:${JSON.stringify(su.dataset)}`;
    line += ` | verdict:${c.verdict}`;
    console.log(line);
    if (c.verdict !== "PASS") {
      for (const ch of c.checks) if (!ch.passed) console.log(`   FAIL-CHECK: ${ch.name} — ${ch.detail}`);
    }
  } catch (e) {
    console.log(`${d} ERR ${e.message}`);
  }
}
