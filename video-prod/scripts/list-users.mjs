// Список пользователей стенда с ролями (только чтение)
import { createRequire } from "node:module";
const require = createRequire("C:/Projects/Navitravel/backend/package.json");
const { Client } = require("pg");

const client = new Client({
  connectionString: "postgresql://postgres:Nadir%40da7374%23@127.0.0.1:5432/travelhub",
});

await client.connect();
const { rows } = await client.query(`
  SELECT u.username, u."fullName", u.status, r.code AS role, u."partnerId" IS NOT NULL AS partner
  FROM security."User" u
  LEFT JOIN security."Role" r ON r.id = u."roleId"
  ORDER BY r.code, u.username
`);
for (const r of rows) {
  console.log(`${(r.role ?? "?").padEnd(14)} ${r.username.padEnd(24)} ${r.status.padEnd(8)} ${r.fullName ?? ""}`);
}
await client.end();
