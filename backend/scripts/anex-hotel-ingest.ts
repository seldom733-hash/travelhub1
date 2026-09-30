/**
 * ANEX HOTELS geo ingest CLI (52-country hotel dictionary):
 *   npx tsx scripts/anex-hotel-ingest.ts              # all 52 states
 *   npx tsx scripts/anex-hotel-ingest.ts DO JO        # only these ISOs
 *
 * Upserts GeoCountry rows missing from Master Geography («Доминикана»,
 * «Иордания» … were absent because the tour ingest only covers the 21-state
 * tour dictionary) and links each hotel town (region → city, town → resort).
 */
import "dotenv/config";
import { NestFactory } from "@nestjs/core";
import { SupplierModule } from "../src/modules/supplier/supplier.module";
import { PrismaService } from "../src/prisma/prisma.service";
import { SupplierGeoIngestService } from "../src/modules/supplier/supplier-geo-ingest.service";

async function main() {
  const isos = process.argv.slice(2).map((s) => s.trim().toUpperCase()).filter(Boolean);
  const app = await NestFactory.createApplicationContext(SupplierModule, {
    logger: ["error", "warn", "log"],
  });
  await app.init();

  const ingest = app.get(SupplierGeoIngestService);
  const report = await ingest.ingestAnexHotels(isos.length ? isos : undefined);
  console.log("REPORT", JSON.stringify(report, null, 2));

  await app.get(PrismaService).$disconnect();
  await app.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
