// Аудит данных стенда: какие сущности есть и в каких статусах
import { createRequire } from "node:module";
const require = createRequire("C:/Projects/Navitravel/backend/package.json");
const { Client } = require("pg");

const client = new Client({
  connectionString: "postgresql://postgres:Nadir%40da7374%23@127.0.0.1:5432/travelhub",
});
await client.connect();

const tables = await client.query(`
  SELECT table_schema, table_name
  FROM information_schema.tables
  WHERE table_type='BASE TABLE' AND table_schema NOT IN ('pg_catalog','information_schema','pgboss')
  ORDER BY table_schema, table_name
`);
console.log("TABLES:", tables.rows.length);
const bySchema = {};
for (const t of tables.rows) (bySchema[t.table_schema] ??= []).push(t.table_name);
for (const [s, list] of Object.entries(bySchema)) console.log(`${s}: ${list.join(", ")}`);

await client.end();
