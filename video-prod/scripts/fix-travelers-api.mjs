// Дозаполнение туристов заказа через API (admin)
import { createRequire } from "node:module";
const require = createRequire("C:/Projects/Navitravel/backend/package.json");
const { Client } = require("pg");

const API = "http://127.0.0.1:4000/api/v1";
const seq = (process.argv[2] ?? "00000008").padStart(8, "0");

const login = await fetch(`${API}/auth/login`, {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ username: "admin", password: "admin123" }),
});
const { accessToken } = await login.json();
const H = { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" };

const db = new Client({ connectionString: "postgresql://postgres:Nadir%40da7374%23@127.0.0.1:5432/travelhub" });
await db.connect();
const { rows } = await db.query(
  `SELECT id, code FROM "order"."Order" WHERE "commerceSequence" = $1 ORDER BY "createdAt" DESC LIMIT 1`,
  [seq],
);
const order = rows[0];
console.log("order:", order);
if (!order) { await db.end(); process.exit(1); }

const existing = await db.query(
  `SELECT id FROM "order"."OrderTraveler" WHERE "orderId" = $1 ORDER BY position`, [order.id]);
await db.end();

const full = {
  firstName: "Айгюн", lastName: "Мамедова", birthDate: "1991-04-12",
  citizenship: "Азербайджан", passportSeries: "AZE", passportNumber: "1234567", passportExpiry: "2030-05-01",
};
const second = {
  firstName: "Эльдар", lastName: "Мамедов", birthDate: "1988-09-03",
  citizenship: "Азербайджан", passportSeries: "AZE", passportNumber: "7654321", passportExpiry: "2031-09-15",
};

for (const [i, row] of existing.rows.entries()) {
  const body = i === 0 ? full : second;
  const res = await fetch(`${API}/orders/${order.id}/travelers/${row.id}`, {
    method: "PATCH", headers: H, body: JSON.stringify(body),
  });
  console.log(`patch traveler ${i + 1}:`, res.status, (await res.text()).slice(0, 80));
}

const add = await fetch(`${API}/orders/${order.id}/travelers`, {
  method: "POST", headers: H, body: JSON.stringify(second),
});
console.log("add traveler 2:", add.status, (await add.text()).slice(0, 120));
