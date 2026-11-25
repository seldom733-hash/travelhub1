// Последние заказы, брони и платежи
import { createRequire } from "node:module";
const require = createRequire("C:/Projects/Navitravel/backend/package.json");
const { Client } = require("pg");
const client = new Client({ connectionString: "postgresql://postgres:Nadir%40da7374%23@127.0.0.1:5432/travelhub" });
await client.connect();

const o = await client.query(`SELECT id, code, status, "createdAt", amount, currency FROM "order"."Order" ORDER BY "createdAt" DESC LIMIT 5`);
console.log("ORDERS:");
for (const r of o.rows) console.log(`${r.code} | ${r.id} | ${r.status} | ${r.amount} ${r.currency}`);

for (const [t, s] of [["OrderTraveler", "order"], ["Booking", "booking"], ["Payment", "finance"], ["RequestTraveler", "order"]]) {
  const q = await client.query(`SELECT count(*)::int AS c FROM "${s}"."${t}"`);
  console.log(`${t}: ${q.rows[0].c}`);
}
const b = await client.query(`SELECT status, count(*)::int c FROM "booking"."Booking" GROUP BY 1`).catch(() => ({ rows: [] }));
console.log("booking statuses:", JSON.stringify(b.rows));
await client.end();
