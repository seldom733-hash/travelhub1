/**
 * Supplier geo ingest CLI:
 *   npx tsx scripts/geo-ingest.ts KOMPAS
 *
 * Discovers the supplier's geo/tour options live and upserts
 * SupplierGeoLink rows (idempotent — safe to re-run).
 */
import { NestFactory } from "@nestjs/core";
import { SupplierModule } from "../src/modules/supplier/supplier.module";
import { PrismaService } from "../src/prisma/prisma.service";
import { SupplierGeoIngestService } from "../src/modules/supplier/supplier-geo-ingest.service";

async function main() {
  const supplierCode = process.argv[2];
  if (!supplierCode) {
    console.error("Usage: tsx scripts/geo-ingest.ts <SUPPLIER_CODE>");
    process.exit(1);
  }
  const app = await NestFactory.createApplicationContext(SupplierModule, { logger: ["error", "warn", "log"] });
  await app.init(); // ensure SUPPLIER_MODULE_INIT (adapter registration) has run

  const ingest = app.get(SupplierGeoIngestService);
  const report = await ingest.ingestSupplier(supplierCode);
  console.log("REPORT", JSON.stringify(report, null, 2));
  await app.get(PrismaService).$disconnect();
  await app.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
