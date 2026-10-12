/**
 * KOMPAS (Kompastour) supplier FX rates → AZN.
 *
 * Sets the supplier-specific «1 source = N AZN» rates for the KOMPAS CRM
 * partner (Partner.name = "KOMPAS"), stored by Partner.code (PRN-*):
 *
 *   1 USD = 1.706 AZN
 *   1 EUR = 1.9284 AZN
 *
 * Mirrors the canonical fx-rates-seed.ts contract: upsert-in-place on unique
 * (supplierCode, sourceCurrencyIso, targetCurrencyIso='AZN'), append-only
 * SupplierFxRateHistory (CREATE/UPDATE), Decimal-safe. Idempotent: the same
 * rate is a no-op (no history noise); a differing rate is an UPDATE that keeps
 * the old value in history.
 *
 * The KOMPAS adapter reads prices in USD; the read-path (storefront/search/
 * calendars) converts to AZN through SupplierFxRateService using this rate.
 *
 * Run: npx ts-node src/seed/kompas-fx-seed.ts
 */
import "dotenv/config";
import { PrismaClient, Prisma } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

/** Partner looked up by name (the KOMPAS sync + FX resolver use this token). */
const PARTNER_NAME = "KOMPAS";

/** «1 sourceCurrency = N AZN» — the requested Kompastour default rates. */
const RATES: ReadonlyArray<readonly [string, string]> = [
  ["USD", "1.706"],
  ["EUR", "1.9284"],
];

const TARGET = "AZN";
const ACTOR_NAME = "seed:kompas-fx";

/** Next canonical code (mirror of IdsService.nextCode, digits=8). */
async function nextCode(client: Prisma.TransactionClient, prefix: string): Promise<string> {
  const record = await client.businessSequence.upsert({
    where: { prefix },
    update: { value: { increment: 1 } },
    create: { prefix, value: 1 },
  });
  return `${prefix}-${String(record.value).padStart(8, "0")}`;
}

async function main(): Promise<void> {
  let partner = await prisma.partner.findFirst({
    where: { name: PARTNER_NAME },
    select: { id: true, code: true, name: true },
  });
  if (!partner) {
    // Create the KOMPAS CRM partner on first run (code PRN-*, status ACTIVE).
    // The sync + FX resolver both key off Partner.name === "KOMPAS".
    partner = await prisma.$transaction(async (tx) => {
      const code = await nextCode(tx, "PRN");
      return tx.partner.create({
        data: { code, name: PARTNER_NAME, status: "ACTIVE" },
        select: { id: true, code: true, name: true },
      });
    });
    console.log(`Created CRM partner "${PARTNER_NAME}" (code ${partner.code})`);
  }
  // Rates are keyed by Partner.code (PRN-*) — the resolver translates the
  // adapter token KOMPAS → Partner.code before lookup.
  const supplierCode = partner.code;
  console.log(`Seeding FX rates for partner "${partner.name}" (code ${supplierCode})`);

  let created = 0;
  let updated = 0;
  let unchanged = 0;

  for (const [iso, rate] of RATES) {
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
        await tx.supplierFxRate.update({
          where: { id: existing.id },
          data: { rate: newRate, updatedByName: ACTOR_NAME },
        });
        await tx.supplierFxRateHistory.create({
          data: {
            rateId: existing.id,
            action: "UPDATE",
            oldRate: existing.rate,
            newRate,
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
          updatedByName: ACTOR_NAME,
        },
      });
      await tx.supplierFxRateHistory.create({
        data: {
          rateId: row.id,
          action: "CREATE",
          oldRate: null,
          newRate,
          actorName: ACTOR_NAME,
        },
      });
      return "created";
    });

    if (outcome === "created") created += 1;
    else if (outcome === "updated") updated += 1;
    else unchanged += 1;
  }

  console.log(`KOMPAS FX rates seeded: created=${created} updated=${updated} unchanged=${unchanged}`);

  const rows = await prisma.supplierFxRate.findMany({
    where: { supplierCode },
    orderBy: [{ sourceCurrencyIso: "asc" }],
    select: { supplierCode: true, sourceCurrencyIso: true, targetCurrencyIso: true, rate: true },
  });
  for (const r of rows) {
    console.log(`  ${r.supplierCode} ${r.sourceCurrencyIso} = ${r.rate.toString()} ${r.targetCurrencyIso}`);
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
