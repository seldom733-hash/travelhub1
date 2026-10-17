/**
 * Приведение списка CRM-партнёров к каноническому виду (8 позиций):
 *
 *   PRN-00000001 Summertour
 *   PRN-00000002 Kompastour
 *   PRN-00000003 Anextour
 *   PRN-00000004 Voyager
 *   PRN-00000005 FSTravel
 *   PRN-00000006 Kazunion
 *   PRN-00000007 AZAL
 *   PRN-00000008 Aviasales
 *
 * Что делает (идемпотентно, одной транзакцией):
 *  1. Удаляет дубль Summertour без товаров (в живой БД это PRN-00000001,
 *     товаров 0) вместе с его строками курсов — остающийся Summertour
 *     («Summer / Summertour», 192 товара) уже имеет оба курса USD/EUR.
 *  2. Переименовывает «Summer / Summertour» → Summertour и KOMPAS → Kompastour.
 *  3. Создаёт недостающих партнёров (Anextour, Voyager, FSTravel, Kazunion)
 *     с дефолтными курсами — как CrmService.createPartner.
 *  4. Перенумерует всё в PRN-00000001..08 в порядке списка, синхронно
 *     обновляя finance.SupplierFxRate.supplierCode (курсы привязаны к коду
 *     строкой — иначе они «отвяжутся» от партнёра).
 *  5. Ставит BusinessSequence PRN = 8.
 *
 * Товары (catalog.Product.partnerId) ссылаются на партнёра по uuid —
 * переименования и перенумерация их не затрагивают.
 *
 * Run: npx ts-node src/seed/partners-canonical-seed.ts
 */
import "dotenv/config";
import { PrismaClient, Prisma } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

/** Канонический список: имя → код (порядок = порядок в CRM). */
const TARGET: ReadonlyArray<{ name: string; code: string }> = [
  { name: "Summertour", code: "PRN-00000001" },
  { name: "Kompastour", code: "PRN-00000002" },
  { name: "Anextour", code: "PRN-00000003" },
  { name: "Voyager", code: "PRN-00000004" },
  { name: "FSTravel", code: "PRN-00000005" },
  { name: "Kazunion", code: "PRN-00000006" },
  { name: "AZAL", code: "PRN-00000007" },
  { name: "Aviasales", code: "PRN-00000008" },
];

/** «1 sourceCurrency = N AZN» — дефолтные курсы нового партнёра. */
const DEFAULT_RATES: ReadonlyArray<readonly [string, string]> = [
  ["USD", "1.7"],
  ["EUR", "1.91"],
];

const TARGET_CURRENCY = "AZN";
const ACTOR_NAME = "seed:partners-canonical";

async function countProducts(client: Prisma.TransactionClient, partnerId: string): Promise<number> {
  const rows = await client.$queryRaw<{ count: number }[]>`
    SELECT count(*)::int AS count FROM catalog."Product" WHERE "partnerId" = ${partnerId}`;
  return Number(rows[0]?.count ?? 0);
}

/** Следующий канонический код (зеркало IdsService.nextCode, digits=8). */
async function nextCode(client: Prisma.TransactionClient, prefix: string): Promise<string> {
  const record = await client.businessSequence.upsert({
    where: { prefix },
    update: { value: { increment: 1 } },
    create: { prefix, value: 1 },
  });
  return `${prefix}-${String(record.value).padStart(8, "0")}`;
}

/** Дефолтные курсы нового партнёра — как CrmService.seedDefaultFxRates. */
async function seedDefaultFxRates(
  client: Prisma.TransactionClient,
  supplierCode: string,
): Promise<void> {
  for (const [sourceCurrencyIso, rate] of DEFAULT_RATES) {
    const existing = await client.supplierFxRate.findUnique({
      where: {
        supplierCode_sourceCurrencyIso_targetCurrencyIso: {
          supplierCode,
          sourceCurrencyIso,
          targetCurrencyIso: TARGET_CURRENCY,
        },
      },
    });
    if (existing) continue;
    const code = await nextCode(client, "SFX");
    const row = await client.supplierFxRate.create({
      data: {
        code,
        supplierCode,
        sourceCurrencyIso,
        targetCurrencyIso: TARGET_CURRENCY,
        rate: new Prisma.Decimal(rate),
        updatedByName: ACTOR_NAME,
      },
    });
    await client.supplierFxRateHistory.create({
      data: {
        rateId: row.id,
        action: "CREATE",
        oldRate: null,
        newRate: new Prisma.Decimal(rate),
        actorName: ACTOR_NAME,
      },
    });
  }
}

async function main(): Promise<void> {
  // ── 1. Дубль Summertour: оставляем одного (приоритет — тот, у кого товары),
  //       остальных удаляем вместе с курсами.
  const summerRows = await prisma.partner.findMany({
    where: { name: { in: ["Summertour", "Summer / Summertour"] } },
    orderBy: { code: "asc" },
  });
  if (summerRows.length === 0) {
    throw new Error("No Summertour partner found — nothing to reconcile");
  }
  const withProducts: string[] = [];
  const withoutProducts: string[] = [];
  for (const row of summerRows) {
    const count = await countProducts(prisma as unknown as Prisma.TransactionClient, row.id);
    (count > 0 ? withProducts : withoutProducts).push(row.id);
  }
  // Удаляем только тех, у кого НЕТ товаров; партнёра с товарами не трогаем.
  const keeper = summerRows.find((r) => r.id === withProducts[0]) ?? summerRows.find((r) => r.id === withoutProducts[0])!;
  const deletable = [...withProducts.slice(1), ...withoutProducts.filter((id) => id !== keeper.id)];
  if (withProducts.length > 1) {
    throw new Error(
      `Refusing to delete: multiple Summertour partners have products (${withProducts.length}). ` +
        "Resolve manually.",
    );
  }
  for (const id of deletable) {
    const row = summerRows.find((r) => r.id === id)!;
    const fxRows = await prisma.supplierFxRate.findMany({
      where: { supplierCode: row.code },
      select: { id: true },
    });
    await prisma.supplierFxRateHistory.deleteMany({ where: { rateId: { in: fxRows.map((r) => r.id) } } });
    await prisma.supplierFxRate.deleteMany({ where: { supplierCode: row.code } });
    await prisma.partner.delete({ where: { id } });
    console.log(`Deleted duplicate partner "${row.name}" (${row.code}) + ${fxRows.length} FX row(s)`);
  }
  if (keeper.name !== "Summertour") {
    await prisma.partner.update({ where: { id: keeper.id }, data: { name: "Summertour" } });
    console.log(`Renamed partner ${keeper.code}: "${keeper.name}" → "Summertour"`);
  }

  // ── 2. Переименование KOMPAS → Kompastour.
  const kompas = await prisma.partner.findFirst({ where: { name: "KOMPAS" } });
  if (kompas) {
    await prisma.partner.update({ where: { id: kompas.id }, data: { name: "Kompastour" } });
    console.log(`Renamed partner ${kompas.code}: "KOMPAS" → "Kompastour"`);
  }

  // ── 3. Создание недостающих партнёров.
  const existingNames = new Set((await prisma.partner.findMany({ select: { name: true } })).map((p) => p.name));
  for (const { name } of TARGET) {
    if (existingNames.has(name)) continue;
    const partner = await prisma.$transaction(async (tx) => {
      const code = await nextCode(tx, "PRN");
      const created = await tx.partner.create({
        data: { code, name, status: "ACTIVE" },
      });
      await seedDefaultFxRates(tx, code);
      return created;
    });
    existingNames.add(name);
    console.log(`Created partner "${name}" (${partner.code}) with default FX rates`);
  }

  // ── 4. Перенумерация в порядке списка (коды уникальны → через временные).
  const finalCodes = await prisma.$transaction(async (tx) => {
    const plan: Array<{ id: string; oldCode: string; tempCode: string; finalCode: string; name: string }> = [];
    for (let i = 0; i < TARGET.length; i++) {
      const { name, code } = TARGET[i];
      const partner = await tx.partner.findFirst({ where: { name } });
      if (!partner) throw new Error(`Partner "${name}" not found before renumbering`);
      plan.push({ id: partner.id, oldCode: partner.code, tempCode: `TMP-${i}`, finalCode: code, name });
    }
    // Фаза 1: временные коды у партнёров И у их строк курсов (unique на
    // (supplierCode, source, target) — иначе перенумерание упирается в коды,
    // которые ещё заняты неперемещёнными партнёрами).
    for (let i = 0; i < plan.length; i++) {
      await tx.partner.update({ where: { id: plan[i].id }, data: { code: `TMP-${i}` } });
      await tx.supplierFxRate.updateMany({
        where: { supplierCode: plan[i].oldCode },
        data: { supplierCode: `TMP-${i}` },
      });
    }
    // Фаза 2: финальные коды + синхронная правка курсов (привязка по строке).
    for (const entry of plan) {
      await tx.partner.update({ where: { id: entry.id }, data: { code: entry.finalCode } });
      const moved = await tx.supplierFxRate.updateMany({
        where: { supplierCode: entry.tempCode },
        data: { supplierCode: entry.finalCode },
      });
      console.log(`Renumbered ${entry.name}: ${entry.oldCode} → ${entry.finalCode} (${moved.count} FX row(s) moved)`);
    }
    // ── 5. Счётчик последовательности.
    await tx.businessSequence.update({
      where: { prefix: "PRN" },
      data: { value: TARGET.length },
    });
    return plan;
  });

  // ── Контрольный вывод.
  const rows = await prisma.partner.findMany({
    where: { name: { in: TARGET.map((t) => t.name) } },
    orderBy: { code: "asc" },
    select: { code: true, name: true, status: true },
  });
  console.log("\nCanonical partner list:");
  for (const r of rows) console.log(`  ${r.code}  ${r.name}  [${r.status}]`);
  const fx = await prisma.supplierFxRate.groupBy({
    by: ["supplierCode"],
    _count: { _all: true },
  });
  console.log("\nFX rows per partner code:");
  for (const f of fx.sort((a, b) => a.supplierCode.localeCompare(b.supplierCode))) {
    console.log(`  ${f.supplierCode}: ${f._count._all}`);
  }
  const seq = await prisma.businessSequence.findUnique({ where: { prefix: "PRN" } });
  console.log(`\nBusinessSequence PRN = ${seq?.value}`);
  console.log(`Planned ${finalCodes.length} partners, found ${rows.length}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
