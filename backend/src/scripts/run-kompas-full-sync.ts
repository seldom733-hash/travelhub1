import "dotenv/config";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "../app.module";
import { KompasSyncService } from "../modules/supplier/kompas/kompas-sync.service";

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const kompasSync = app.get(KompasSyncService);

  const partner = await kompasSync.getKompasPartner();
  if (!partner) {
    console.error("KOMPAS partner not found — seed partners first");
    process.exit(1);
  }

  console.log("Starting KOMPAS full sync (all countries → programs → tours)...");
  const result = await kompasSync.runSync(partner.id);

  console.log("\n=== KOMPAS SYNC RESULT ===");
  console.log(`Countries discovered: ${result.countriesDiscovered}`);
  console.log(`Programs discovered: ${result.programsDiscovered}`);
  console.log(`Programs searched: ${result.programsSearched}`);
  console.log(`Offers received: ${result.offersReceived}`);
  console.log(`Unique identities: ${result.uniqueIdentities}`);
  console.log(`New cards: ${result.newCards}`);
  console.log(`Updated cards: ${result.updatedCards}`);
  console.log(`Unchanged cards: ${result.unchangedCards}`);
  console.log(`Normalization failures: ${result.normalizationFailures}`);
  console.log(`Errors (${result.errors.length}):`);
  for (const err of result.errors.slice(0, 30)) {
    console.log(`  - ${err}`);
  }

  await app.close();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
