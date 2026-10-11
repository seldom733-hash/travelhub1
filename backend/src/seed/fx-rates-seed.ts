/**
 * FX-курсы поставщиков → AZN — дефолтные значения для ВСЕХ поставщиков
 * реестра (KNOWN_TOUR_SUPPLIERS ∪ уже настроенные), как listSuppliers():
 *
 *   1 USD = 1.7 AZN
 *   1 EUR = 1.91 AZN
 *
 * Идемпотент: уже выставленное значение не трогает (без шума в истории);
 * отличающееся — UPDATE + append-only история (старое значение
 * сохраняется в SupplierFxRateHistory.oldRate, ничего не теряется).
 * Зеркалит контракт SupplierFxRateService.setCurrent: code SFX-*,
 * unique (supplierCode, sourceCurrencyIso, targetCurrencyIso),
 * история CREATE/UPDATE.
 *
 * Запуск: npm run seed:fx-rates
 */
import "dotenv/config";
import { PrismaClient, Prisma } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

/** Интегрированные тур-адаптеры — зеркалит KNOWN_TOUR_SUPPLIERS в сервисе. */
const KNOWN_TOUR_SUPPLIERS = ["KAZUNION", "KOMPAS", "SUMMERTOUR", "AZAL", "ANEX"];

/** «1 sourceCurrency = N AZN» — дефолтные курсы для колонок USD/EUR. */
const DEFAULT_RATES: ReadonlyArray<readonly [string, string]> = [
  ["USD", "1.7"],
  ["EUR", "1.91"],
];

const TARGET = "AZN";
const ACTOR_ID: string | null = null;
const ACTOR_NAME = "seed:fx-rates";

/** Следующий канонический код (зеркало IdsService.nextCode, digits=8). */
async function nextCode(client: Prisma.TransactionClient, prefix: string): Promise<string> {
  const record = await client.businessSequence.upsert({
    where: { prefix },
    update: { value: { increment: 1 } },
    create: { prefix, value: 1 },
  });
  return `${prefix}-${String(record.value).padStart(8, "0")}`;
}

async function main(): Promise<void> {
  // Реестр поставщиков: известные адаптеры ∪ уже настроенные токены.
  const configured = await prisma.supplierFxRate.findMany({
    select: { supplierCode: true },
    distinct: ["supplierCode"],
  });
  const suppliers = [
    ...new Set([...KNOWN_TOUR_SUPPLIERS, ...configured.map((r) => r.supplierCode)]),
  ].sort();

  let created = 0;
  let updated = 0;
  let unchanged = 0;

  for (const supplierCode of suppliers) {
    for (const [iso, rate] of DEFAULT_RATES) {
      const outcome = await prisma.$transaction(async (tx) => {
        const existing = await tx.supplierFxRate.findUnique({
          where: {
            supplierCode_sourceCurrencyIso_targetCurrencyIso: {
              supplierCode,
              sourceCurrencyIso: iso,
              targetCurrencyIso: TARGET,
            },
          },
        });
        const newRate = new Prisma.Decimal(rate);

        if (existing) {
          if (existing.rate.equals(newRate)) return "unchanged";
          const row = await tx.supplierFxRate.update({
            where: { id: existing.id },
            data: { rate: newRate, updatedById: ACTOR_ID, updatedByName: ACTOR_NAME },
          });
          await tx.supplierFxRateHistory.create({
            data: {
              rateId: row.id,
              action: "UPDATE",
              oldRate: existing.rate,
              newRate,
              actorId: ACTOR_ID,
              actorName: ACTOR_NAME,
            },
          });
          return "updated";
        }

        const code = await nextCode(tx, "SFX");
        const row = await tx.supplierFxRate.create({
          data: {
            code,
            supplierCode,
            sourceCurrencyIso: iso,
            targetCurrencyIso: TARGET,
            rate: newRate,
            updatedById: ACTOR_ID,
            updatedByName: ACTOR_NAME,
          },
        });
        await tx.supplierFxRateHistory.create({
          data: {
            rateId: row.id,
            action: "CREATE",
            oldRate: null,
            newRate,
            actorId: ACTOR_ID,
            actorName: ACTOR_NAME,
          },
        });
        return "created";
      });

      if (outcome === "created") created += 1;
      else if (outcome === "updated") updated += 1;
      else unchanged += 1;
    }
  }

  console.log(
    `FX rates seeded: suppliers=${suppliers.length} created=${created} updated=${updated} unchanged=${unchanged}`,
  );

  const rows = await prisma.supplierFxRate.findMany({
    where: { sourceCurrencyIso: { in: DEFAULT_RATES.map(([iso]) => iso) } },
    orderBy: [{ supplierCode: "asc" }, { sourceCurrencyIso: "asc" }],
    select: { supplierCode: true, sourceCurrencyIso: true, rate: true },
  });
  for (const r of rows) {
    console.log(`  ${r.supplierCode.padEnd(12)} ${r.sourceCurrencyIso} = ${r.rate.toString()} ${TARGET}`);
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
