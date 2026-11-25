// Состояние заказа и связанных сущностей
import { createRequire } from "node:module";
const require = createRequire("C:/Projects/Navitravel/backend/package.json");
const { Client } = require("pg");
const client = new Client({ connectionString: "postgresql://postgres:Nadir%40da7374%23@127.0.0.1:5432/travelhub" });
await client.connect();
const id = process.argv[2];

const o = await client.query(`SELECT code, status, "travelerDataCompletedAt", "finalConfirmedAt", "paymentStatus" FROM "order"."Order" WHERE id=$1`, [id]);
console.log("ORDER:", JSON.stringify(o.rows[0]));

const t = await client.query(`SELECT position, "firstName", "birthDate", citizenship, "passportNumber", "dataCompleteness" FROM "order"."OrderTraveler" WHERE "orderId"=$1 ORDER BY position`, [id]);
console.log("TRAVELERS:", JSON.stringify(t.rows));

const b = await client.query(`SELECT code, status INTO TEMP tmp FROM "booking"."Booking" WHERE 1=0`).catch(() => null);
const bk = await client.query(`SELECT b.code, b.status FROM "booking"."Booking" b WHERE b."orderId"=$1`, [id]).catch((e) => ({ rows: [{ err: e.message.slice(0, 80) }] }));
console.log("BOOKINGS:", JSON.stringify(bk.rows));
await client.end();
