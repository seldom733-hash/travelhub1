import "dotenv/config";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "../app.module";
import { VoyagerSyncService } from "../modules/supplier/voyager/voyager-sync.service";
import { VoyagerHotelSyncService } from "../modules/supplier/voyager/voyager-hotel-sync.service";

/**
 * Voyager catalog-cards runner (tours + hotels → Product cards).
 *
 * Runs from src (no prod-server restart needed — the sync services are
 * imported directly, and Voyager pacing keeps supplier requests polite).
 *
 * Usage:
 *   npx ts-node src/scripts/run-voyager-sync.ts both
 *   npx ts-node src/scripts/run-voyager-sync.ts tours TZ,IN
 *   npx ts-node src/scripts/run-voyager-sync.ts hotels AZ,GE,MY
 *   npx ts-node src/scripts/run-voyager-sync.ts both "" 2026-10-22 2026-11-21
 */
async function main() {
  const mode = (process.argv[2] ?? "both").toLowerCase();
  const countryIsos = process.argv[3]
    ?.split(",")
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);
  const dateFrom = process.argv[4] || undefined;
  const dateTo = process.argv[5] || undefined;

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ["log", "warn", "error"],
  });

  try {
    if (mode === "tours" || mode === "both") {
      const tours = app.get(VoyagerSyncService);
      console.log("\n=== VOYAGER TOURS SYNC ===");
      const toursReport = await tours.runSync({
        countryIsos,
        dateFrom,
        dateTo,
      });
      console.log(JSON.stringify(toursReport, null, 2));
      if (toursReport.errors.length) {
        console.log(`\nErrors (${toursReport.errors.length}):`);
        for (const e of toursReport.errors.slice(0, 30)) console.log(`  - ${e}`);
      }
    }

    if (mode === "hotels" || mode === "both") {
      const hotels = app.get(VoyagerHotelSyncService);
      console.log("\n=== VOYAGER HOTELS SYNC ===");
      const hotelsReport = await hotels.runSync({
        countryIsos,
        dateFrom,
        dateTo,
      });
      console.log(JSON.stringify(hotelsReport, null, 2));
      if (hotelsReport.errors.length) {
        console.log(`\nErrors (${hotelsReport.errors.length}):`);
        for (const e of hotelsReport.errors.slice(0, 30)) console.log(`  - ${e}`);
      }
    }
  } finally {
    await app.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
