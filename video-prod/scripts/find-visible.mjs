// Товары, реально видимые в маркетплейсе и на витрине
import { createRequire } from "node:module";
const require = createRequire("C:/Projects/Navitravel/backend/package.json");
const { Client } = require("pg");
const client = new Client({ connectionString: "postgresql://postgres:Nadir%40da7374%23@127.0.0.1:5432/travelhub" });
await client.connect();

for (const ch of ["MARKETPLACE", "PARTNER_STOREFRONT"]) {
  const r = await client.query(`
    SELECT p.slug, p.code, p.title, p.status
    FROM catalog."Product" p
    JOIN catalog."ProductPublicationChannel" c ON c."productId" = p.id
    WHERE c.channel = $1 AND p.status='PUBLISHED'
    LIMIT 3`, [ch]);
  console.log(`\n### ${ch}`);
  for (const row of r.rows) console.log(`${row.slug} | ${row.code} | ${row.title.slice(0, 70)}`);
}

const sf = await client.query(`SELECT slug, status, "entitlementStatus", "activatedAt" IS NOT NULL AS activated FROM \`catalog\`.\`PartnerStorefront\``.replace(/`/g, '"'));
console.log("\n### storefronts");
for (const row of sf.rows) console.log(JSON.stringify(row));

await client.end();
