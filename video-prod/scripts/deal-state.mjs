// Состояние сделки по номеру: заявка/заказ/бронь/платёж
import { createRequire } from "node:module";
const require = createRequire("C:/Projects/Navitravel/backend/package.json");
const { Client } = require("pg");
const client = new Client({ connectionString: "postgresql://postgres:Nadir%40da7374%23@127.0.0.1:5432/travelhub" });
await client.connect();

const o = await client.query(`SELECT o.code, o.status, o."paymentStatus", o."paidAmount", o.amount, b.code AS booking, b.status AS booking_status
  FROM "order"."Order" o LEFT JOIN "booking"."Booking" b ON b."orderId" = o.id ORDER BY o."createdAt" DESC LIMIT 3`);
console.log("ORDER/BOOKING:", JSON.stringify(o.rows, null, 1));

const r = await client.query(`SELECT code, status FROM "order"."Request" ORDER BY "createdAt" DESC LIMIT 2`);
console.log("REQUEST:", JSON.stringify(r.rows));
await client.end();
