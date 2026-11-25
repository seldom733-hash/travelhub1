// Состав туристов: заявка vs заказ
import { createRequire } from "node:module";
const require = createRequire("C:/Projects/Navitravel/backend/package.json");
const { Client } = require("pg");
const client = new Client({ connectionString: "postgresql://postgres:Nadir%40da7374%23@127.0.0.1:5432/travelhub" });
await client.connect();

const rt = await client.query(`SELECT "firstName","lastName","birthDate","position" FROM "order"."RequestTraveler" ORDER BY "position"`);
console.log("RequestTraveler:", JSON.stringify(rt.rows));

const ot = await client.query(`SELECT "firstName","lastName","birthDate","dataCompleteness" FROM "order"."OrderTraveler" ORDER BY "position"`);
console.log("OrderTraveler:", JSON.stringify(ot.rows));

const o = await client.query(`SELECT "travelerCount","pinnedRequirements","termsAcceptedAt","travelerDataCompletedAt","finalConfirmedAt" FROM "order"."Order" WHERE code='ORD-00000013'`);
console.log("Order:", JSON.stringify(o.rows[0]));
await client.end();
