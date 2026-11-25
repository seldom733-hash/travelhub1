// Факты из БД по спорным пунктам ТЗ
import { createRequire } from "node:module";
const require = createRequire("C:/Projects/Navitravel/backend/package.json");
const { Client } = require("pg");
const client = new Client({ connectionString: "postgresql://postgres:Nadir%40da7374%23@127.0.0.1:5432/travelhub" });
await client.connect();

const out = {};

// автоназначение: у заявок есть менеджер?
const req = await client.query(`
  SELECT r.code, r.status, r."createdAt", u.username AS manager
  FROM "order"."Request" r
  LEFT JOIN security."User" u ON u.id = r."assignedToId"
  ORDER BY r."createdAt" DESC LIMIT 8`).catch(async () => {
  const alt = await client.query(`SELECT column_name FROM information_schema.columns WHERE table_schema='order' AND table_name='Request'`);
  return { rows: [{ columns: alt.rows.map((c) => c.column_name).join(",") }] };
});
out.requests = req.rows;

// настройки распределения
const asg = await client.query(`SELECT * FROM "sales"."SalesAssignmentSettings" LIMIT 3`).catch(() => ({ rows: [] }));
out.assignmentSettings = asg.rows;

// профили менеджеров (кто участвует в ротации)
const prof = await client.query(`
  SELECT u.username, p.* FROM "sales"."SalesManagerProfile" p
  JOIN security."User" u ON u.id = p."userId" LIMIT 8`).catch(() => ({ rows: [] }));
out.managerProfiles = prof.rows;

// уведомления
const notif = await client.query(`
  SELECT u.username, count(*)::int AS c, max(n."createdAt") AS last
  FROM security."UserNotification" n
  JOIN security."User" u ON u.id = n."userId"
  GROUP BY u.username ORDER BY c DESC LIMIT 10`).catch((e) => ({ rows: [{ err: e.message.slice(0, 80) }] }));
out.notifications = notif.rows;

// платежи: есть ли поле документа
const payCols = await client.query(`SELECT column_name FROM information_schema.columns WHERE table_schema='finance' AND table_name='Payment' ORDER BY ordinal_position`);
out.paymentColumns = payCols.rows.map((c) => c.column_name).join(",");

// заявки: есть ли возраст детей в данных
const reqCols = await client.query(`SELECT column_name FROM information_schema.columns WHERE table_schema='order' AND table_name='Request' ORDER BY ordinal_position`);
out.requestColumns = reqCols.rows.map((c) => c.column_name).join(",");

console.log(JSON.stringify(out, null, 1));
await client.end();
