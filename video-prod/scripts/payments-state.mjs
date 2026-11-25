// Платежи и статусы по сделке
import { createRequire } from "node:module";
const require = createRequire("C:/Projects/Navitravel/backend/package.json");
const { Client } = require("pg");
const client = new Client({ connectionString: "postgresql://postgres:Nadir%40da7374%23@127.0.0.1:5432/travelhub" });
await client.connect();

const p = await client.query(`SELECT code, status, amount, currency, "paymentMethod", "paidAt", "orderId" FROM "finance"."Payment" ORDER BY "createdAt" DESC LIMIT 5`);
console.log("PAYMENTS:", JSON.stringify(p.rows, null, 1));

const o = await client.query(`SELECT code, status, "paymentStatus", "paidAmount", amount FROM "order"."Order" ORDER BY "createdAt" DESC LIMIT 2`);
console.log("ORDERS:", JSON.stringify(o.rows));
await client.end();
