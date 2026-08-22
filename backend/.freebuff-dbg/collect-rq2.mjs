import { readFileSync } from "node:fs";
for (const d of ["rq-topo", "rq-ds-sm"]) {
  const su = JSON.parse(readFileSync(`artifacts/performance/${d}/summary.json`, "utf8"));
  console.log(`=== ${d} route classes ===`);
  for (const [cls, l] of Object.entries(su.load.byRouteClass)) {
    console.log(` class ${cls}: n=${l.count} p50=${l.stats.p50.toFixed(0)} p95=${l.stats.p95.toFixed(0)} p99=${l.stats.p99.toFixed(0)} max=${l.stats.max.toFixed(0)} ${JSON.stringify(l.outcomes)}`);
  }
  console.log(` totals: ${JSON.stringify(su.load.totals)}`);
}
