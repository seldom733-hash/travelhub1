// Поиск опубликованных товаров для витрины
import { createRequire } from "node:module";
const require = createRequire("C:/Projects/Navitravel/backend/package.json");
const { Client } = require("pg");
const client = new Client({ connectionString: "postgresql://postgres:Nadir%40da7374%23@127.0.0.1:5432/travelhub" });
await client.connect();
const cols = await client.query(`SELECT column_name FROM information_schema.columns WHERE table_schema='catalog' AND table_name='Product' ORDER BY ordinal_position`);
console.log("columns:", cols.rows.map(r => r.column_name).join(", "));
const rows = await client.query(`SELECT * FROM catalog."Product" LIMIT 2`);
console.log(JSON.stringify(rows.rows, null, 2).slice(0, 1800));
await client.end();
