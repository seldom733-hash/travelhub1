// Аудит данных стенда: таблицы и объёмы по ключевым сущностям
import { createRequire } from "node:module";
const require = createRequire("C:/Projects/Navitravel/backend/package.json");
const { Client } = require("pg");

const client = new Client({
  connectionString: "postgresql://postgres:Nadir%40da7374%23@127.0.0.1:5432/travelhub",
});
await client.connect();

const tables = await client.query(`
  SELECT table_schema AS s, table_name AS t
  FROM information_schema.tables
  WHERE table_type='BASE TABLE'
    AND table_schema NOT IN ('pg_catalog','information_schema','pgboss')
  ORDER BY 1,2
`);

const groups = new Map();
for (const row of tables.rows) {
  const { s, t } = row;
  if (!groups.has(s)) groups.set(s, []);
  groups.get(s).push(t);
}
for (const [s, list] of groups) console.log(`\n### ${s} (${list.length})\n${list.join(", ")}`);

console.log("\n=== COUNTS ===");
for (const [s, list] of groups) {
  for (const t of list) {
    try {
      const r = await client.query(`SELECT count(*)::int AS c FROM "${s}"."${t}"`);
      if (r.rows[0].c > 0) console.log(`${s}.${t} = ${r.rows[0].c}`);
    } catch {}
  }
}

await client.end();
