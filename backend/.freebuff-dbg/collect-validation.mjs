import { readFileSync } from "node:fs";

const dirs = ["rem-p50", "rem-p100", "rem-p200", "rem-pay-s", "rem-pay-b", "rem-pay-c2", "rem-bok-s", "rem-bok-b3", "rem-lg-q", "rem-lg-b", "rem-ebs", "rem-ebb", "rem-ebr", "rem-mi", "rem-soak-cfg", "rem-neg", "rem-neg2", "rem-neg3"];
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
    line += ` | verdict:${c.verdict}`;
    console.log(line);
  } catch (e) {
    console.log(`${d} ERR ${e.message}`);
  }
}
