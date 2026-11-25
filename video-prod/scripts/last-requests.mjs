// Последние заявки и заказы: что реально создалось
import { createRequire } from "node:module";
const require = createRequire("C:/Projects/Navitravel/backend/package.json");
const { Client } = require("pg");
const client = new Client({ connectionString: "postgresql://postgres:Nadir%40da7374%23@127.0.0.1:5432/travelhub" });
await client.connect();

const r = await client.query(`
  SELECT id, code, status, "createdAt", "customerId", "displayedPrice", "displayedCurrency", "travelerCount"
  FROM "order"."Request" ORDER BY "createdAt" DESC LIMIT 6`);
console.log("REQUEST:");
for (const row of r.rows) console.log(`${row.code} | ${row.id} | ${row.status} | ${row.createdAt.toISOString()} | travelers=${row.travelerCount} | ${row.displayedPrice} ${row.displayedCurrency}`);

const t = await client.query(`SELECT count(*)::int AS c FROM "order"."RequestTraveler"`);
console.log("request travelers:", t.rows[0].c);

const c = await client.query(`SELECT count(*)::int AS c FROM "crm"."Customer"`);
console.log("customers:", c.rows[0].c);
await client.end();
