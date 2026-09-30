import "dotenv/config";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "../app.module";
import { SupplierGeoIngestService } from "../modules/supplier/supplier-geo-ingest.service";

/**
 * Geo ingest runner (live supplier discovery → Master Geography).
 *
 * Usage:
 *   npx ts-node src/scripts/run-geo-ingest.ts [SUPPLIER] [STATEINC ...]
 *   npm run ingest:geo -- KOMPAS           # all countries
 *   npm run ingest:geo -- KOMPAS 28 37     # only Thailand (28) + Egypt (37)
 */
async function main() {
  const supplier = process.argv[2] ?? "KOMPAS";
  const stateIncs = process.argv.slice(3);

  const app = await NestFactory.createApplicationContext(AppModule, { logger: ["log", "warn", "error"] });
  const ingest = app.get(SupplierGeoIngestService);
  try {
    const report = await ingest.ingestSupplier(supplier, stateIncs.length ? stateIncs : undefined);
    console.log("\n=== GEO INGEST RESULT ===");
    console.log(JSON.stringify(report, null, 2));
    if (report.unmatched.length) {
      console.log(`\nUnmatched (${report.unmatched.length}):`);
      for (const u of report.unmatched.slice(0, 50)) console.log(`  - ${u}`);
    }
  } finally {
    await app.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
