/**
 * KOMPAS HOTELS geo ingest CLI (53-country hotel dictionary of /search_hotel):
 *   npx ts-node scripts/kompas-hotel-ingest.ts           # all 53 states
 *   npx ts-node scripts/kompas-hotel-ingest.ts 45 32     # only BG + VN
 *
 * Sources TOWN/STAR/HOTEL options from the HOTEL form (discoverHotelGeoOptions)
 * — hotel-only countries are absent from the tours form's STATEINC select.
 * Upserts are idempotent on supplierCode+kind+externalId, so overlapping
 * countries are safe to re-run (the hotel form may expose extra towns the
 * tours checklist lacks, e.g. Кутаиси/Местия for GE).
 */
import "dotenv/config";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "../src/app.module";
import { SupplierGeoIngestService } from "../src/modules/supplier/supplier-geo-ingest.service";

async function main() {
  const stateIncs = process.argv.slice(2).map((s) => s.trim()).filter(Boolean);
  // AppModule (not SupplierModule): FinanceService→SecurityService lives
  // outside SupplierModule's DI scope and the bare module context fails.
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ["error", "warn", "log"],
  });

  const ingest = app.get(SupplierGeoIngestService);
  const report = await ingest.ingestKompasHotels(stateIncs.length ? stateIncs : undefined);
  console.log("REPORT", JSON.stringify(report, null, 2));
  if (report.unmatched.length) {
    console.log(`\nUnmatched (${report.unmatched.length}):`);
    for (const u of report.unmatched) console.log(`  ${u}`);
  }

  await app.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
