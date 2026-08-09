/**
 * SellerProfileRepair CLI (Phase 1 Step 1.11 REVIEW FIX 1).
 *
 * One-time idempotent migration/repair command для LEGACY Partners без
 * PublicSellerProfile. Заменяет удалённый startup backfill: запускается
 * оператором явно, а не при каждом старте приложения.
 *
 *   npx ts-node src/modules/catalog/seller/seller-profile-repair.cli.ts            # реальный прогон
 *   npx ts-node src/modules/catalog/seller/seller-profile-repair.cli.ts --dry-run  # только отчёт
 *
 * Отчёт (JSON): { scanned, created, alreadyPresent, skippedBrokenPartner, dryRun }.
 * Аудит: каждая созданная запись + итоговый audit результата.
 */
import "reflect-metadata";
import "dotenv/config";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "../../../app.module";
import { SellerProfileRepairService } from "./seller-profile-repair.service";

async function main(): Promise<void> {
  const dryRun = process.argv.includes("--dry-run");
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ["error", "warn", "log"],
  });
  try {
    const repair = app.get(SellerProfileRepairService);
    const report = await repair.run(dryRun);
    await repair.auditResult(null, report);
    console.log(JSON.stringify(report, null, 2));
  } finally {
    await app.close();
  }
}

main().catch((err) => {
  console.error("SellerProfileRepair failed:", err);
  process.exitCode = 1;
});
