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
import { SupplierAdapterRegistry } from "../src/modules/supplier/adapter/supplier-adapter.registry";
import { KazunionAdapter } from "../src/modules/supplier/kazunion/kazunion.adapter";
import { KazunionHttpService } from "../src/modules/supplier/kazunion/kazunion-http.service";

async function main() {
  const supplierCode = process.argv[2];
  if (!supplierCode) {
    console.error("Usage: tsx scripts/geo-ingest.ts <SUPPLIER_CODE>");
    process.exit(1);
  }
  const app = await NestFactory.createApplicationContext(SupplierModule, { logger: ["error", "warn", "log"] });
  await app.init(); // ensure SUPPLIER_MODULE_INIT (adapter registration) has run

  // tsx/esbuild does not emit design:paramtypes — constructor DI is unavailable
  // in standalone scripts. Re-wire adapters with ctor deps manually.
  if (supplierCode === "KAZUNION") {
    const registry = app.get(SupplierAdapterRegistry);
    const rewired = new KazunionAdapter(app.get(KazunionHttpService));
    (registry as unknown as { adapters: Map<string, unknown> }).adapters.set("KAZUNION", rewired);
  }

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
