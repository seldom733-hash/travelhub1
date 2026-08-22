import pg from "pg";
const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
try {
  await c.connect();
  const v = await c.query("SELECT version()");
  console.log("server:", v.rows[0].version);
  const dbs = await c.query("SELECT datname FROM pg_database WHERE datname LIKE 'l1probe%'");
  console.log("l1probe dbs:", dbs.rows.map((r) => r.datname).join(", ") || "(none)");
  await c.end();
} catch (e) {
  console.error("conn failed:", e.message);
  process.exit(1);
}
