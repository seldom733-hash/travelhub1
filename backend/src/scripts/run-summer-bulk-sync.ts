import "dotenv/config";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "../app.module";
import { SummerBulkSyncService } from "../modules/supplier/summertour/summer-bulk-sync.service";

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const bulkSync = app.get(SummerBulkSyncService);
  
  console.log("Starting bulk sync...");
  const result = await bulkSync.runBulkSync();
  
  console.log("\n=== BULK SYNC RESULT ===");
  console.log(`Duration: ${result.durationMs}ms`);
  console.log(`Total products: ${result.totalProducts}`);
  console.log(`Total offers: ${result.totalOffers}`);
  console.log(`Errors: ${result.errors.length}`);
  
  for (const prog of result.programs) {
    console.log(`\n--- ${prog.tourIncName} (${prog.tourIncValue}) ---`);
    console.log(`  Hotels: ${prog.hotelsFound}, Products: ${prog.productsCreated}/${prog.productsUpdated}, Offers: ${prog.offersReceived}`);
    if (prog.errors.length > 0) console.log(`  Errors: ${prog.errors.join("; ")}`);
  }
  
  await app.close();
  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
