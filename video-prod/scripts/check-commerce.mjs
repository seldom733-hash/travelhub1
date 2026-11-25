// Проверка витрин и коммерческой цепочки Sale/Quote/CheckoutIntent
import { createRequire } from "node:module";
const require = createRequire("C:/Projects/Navitravel/backend/package.json");
const { Client } = require("pg");
const client = new Client({ connectionString: "postgresql://postgres:Nadir%40da7374%23@127.0.0.1:5432/travelhub" });
await client.connect();

const t = await client.query(`
  SELECT table_schema AS s, table_name AS n
  FROM information_schema.tables
  WHERE table_name IN ('PartnerStorefront','Sale','Quote','CheckoutIntent','Order','Request','Booking','Payment')
  ORDER BY 1,2`);
console.log("tables:", t.rows.map(r => `${r.s}.${r.n}`).join(", "));

for (const row of t.rows) {
  try {
    const c = await client.query(`SELECT count(*)::int AS c FROM "${row.s}"."${row.n}"`);
    console.log(`${row.s}.${row.n} = ${c.rows[0].c}`);
  } catch (e) { console.log(`${row.s}.${row.n} ERR ${e.message.slice(0,60)}`); }
}

const sf = await client.query(`SELECT slug, status, "entitlementStatus" FROM sales."PartnerStorefront"`).catch(async () => {
  return client.query(`SELECT * FROM crm."PartnerStorefront" LIMIT 0`).catch(() => ({ rows: [] }));
});
console.log("storefronts rows:", sf.rows.length);

const st = await client.query(`SELECT status, count(*)::int AS c FROM order."Request" GROUP BY 1`);
console.log("request statuses:", JSON.stringify(st.rows));

await client.end();
