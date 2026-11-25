#!/usr/bin/env node
/**
 * One-off maintenance script: normalize stale KazUnion catalog cards that are
 * still quoted in USD to AZN.
 *
 * Why: KazUnion natively returns AZN when the search requests CURRENCY=10.
 * The tour adapter started doing that in commit 98b27182 (2026-10-29 13:10).
 * A handful of cards created earlier that morning were fetched in USD and are
 * still stored with `attributes.currency = "USD"` and USD Base tariffs.
 *
 * What it does (per card, idempotent):
 *   - converts the already-public USD amount to AZN at the CBA USD/AZN rate
 *     (or an explicit --rate / the latest platform FX row as fallback);
 *   - rewrites product.attributes { currency: "AZN", startingPrice, fx, ... };
 *   - rewrites every Base tariff { price, currency: "AZN", inclusions.fx };
 *   - writes an audit row to catalog.ProductHistory;
 *   - increments Product.version.
 *
 * Usage (from the backend directory):
 *   node scripts/fix-kazunion-usd-to-azn.cjs                 # dry run
 *   node scripts/fix-kazunion-usd-to-azn.cjs --apply         # write changes
 *   node scripts/fix-kazunion-usd-to-azn.cjs --rate 1.7      # override rate
 *   node scripts/fix-kazunion-usd-to-azn.cjs --date 17.11.2026
 */

const path = require("path");

require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const prismaClient = require(path.join(__dirname, "..", "dist", "generated", "prisma", "client.js"));
const { PrismaPg } = require("@prisma/adapter-pg");
const PrismaClient = prismaClient.PrismaClient || prismaClient.default?.PrismaClient;

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL, max: 4 }),
});

const APPLY = process.argv.includes("--apply");

function argValue(name) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function bakuTodayDmy() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Baku",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const v = (t) => parts.find((p) => p.type === t)?.value ?? "";
  return `${v("day")}.${v("month")}.${v("year")}`;
}

async function fetchCbaRate(dateDmy) {
  const url = `https://www.cbar.az/currencies/${dateDmy}.xml`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`CBA ${url} → HTTP ${res.status}`);
  const xml = await res.text();
  const m = xml.match(
    /<Valute\s+Code="USD">[\s\S]*?<Nominal>\s*(\d+)\s*<\/Nominal>[\s\S]*?<Value>\s*([\d.]+)\s*<\/Value>/,
  );
  if (!m) throw new Error(`CBA ${url}: USD entry not found`);
  const nominal = Number(m[1]);
  const value = Number(m[2]);
  if (!(nominal > 0) || !(value > 0)) throw new Error(`CBA ${url}: invalid USD rate`);
  return { rate: value / nominal, source: "CBA" };
}

async function resolveRate() {
  const explicit = argValue("--rate");
  if (explicit) {
    const rate = Number(explicit.replace(",", "."));
    if (!(rate > 0)) throw new Error(`--rate must be > 0, got ${explicit}`);
    return { rate, source: "manual --rate" };
  }

  const dateDmy = argValue("--date") ?? bakuTodayDmy();
  try {
    const cba = await fetchCbaRate(dateDmy);
    return { ...cba, date: dateDmy };
  } catch (err) {
    console.warn(`WARN: CBA rate unavailable (${err.message}); falling back to the latest platform FX row`);
    const row = await prisma.supplierFxRate.findFirst({
      where: { sourceCurrencyIso: "USD", targetCurrencyIso: "AZN" },
      orderBy: { updatedAt: "desc" },
      select: { rate: true, updatedAt: true, supplierCode: true },
    });
    if (!row) throw new Error("No CBA rate and no USD→AZN row in finance.SupplierFxRate");
    console.warn(
      `WARN: using platform row ${row.supplierCode} ${row.rate.toString()} (updated ${row.updatedAt.toISOString()})`,
    );
    return { rate: Number(row.rate.toString()), source: `platform ${row.supplierCode}`, date: row.updatedAt.toISOString() };
  }
}

async function main() {
  const { rate, source, date } = await resolveRate();
  console.log(`Mode: ${APPLY ? "APPLY" : "DRY-RUN"}`);
  console.log(`USD→AZN rate: ${rate} (${source}${date ? `, ${date}` : ""})\n`);

  const products = await prisma.product.findMany({
    where: { supplierRef: { startsWith: "KAZUNION" } },
    select: {
      id: true,
      code: true,
      supplierRef: true,
      title: true,
      status: true,
      version: true,
      attributes: true,
      tariffs: {
        select: { id: true, code: true, price: true, currency: true, inclusions: true },
      },
    },
    orderBy: { supplierRef: "asc" },
  });

  const targets = [];
  const skipped = [];
  for (const p of products) {
    const attrs = (p.attributes ?? {});
    const attrCur = String(attrs.currency ?? "").toUpperCase();
    if (attrCur !== "USD") continue;
    const usdTariffs = p.tariffs.filter((t) => String(t.currency ?? "").toUpperCase() === "USD");
    const otherTariffs = p.tariffs.filter((t) => String(t.currency ?? "").toUpperCase() !== "USD");
    if (p.tariffs.length === 0) {
      skipped.push({ ref: p.supplierRef, reason: "no tariffs" });
      continue;
    }
    if (otherTariffs.length > 0) {
      skipped.push({ ref: p.supplierRef, reason: `mixed tariff currencies (${p.tariffs.map((t) => t.currency).join(",")})` });
      continue;
    }
    const usd = Number(attrs.startingPrice ?? usdTariffs[0]?.price ?? 0);
    if (!(usd > 0)) {
      skipped.push({ ref: p.supplierRef, reason: `non-positive USD price (${usd})` });
      continue;
    }
    targets.push({ product: p, attrs, usd, azn: round2(usd * rate) });
  }

  if (targets.length === 0) {
    console.log("Nothing to do: no KAZUNION products with USD price/currency.");
    for (const s of skipped) console.log(`  skip ${s.ref}: ${s.reason}`);
    return;
  }

  console.log(`Targets: ${targets.length} card(s)\n`);
  for (const t of targets) {
    console.log(`  ${t.product.supplierRef}`);
    console.log(`    ${t.product.title}`);
    console.log(`    USD ${t.usd} → AZN ${t.azn}  (rate ${rate})`);
  }
  if (skipped.length) {
    console.log("\nSkipped:");
    for (const s of skipped) console.log(`  ${s.ref}: ${s.reason}`);
  }

  if (!APPLY) {
    console.log("\nDry run only. Re-run with --apply to write changes.");
    return;
  }

  const now = new Date();
  const fx = {
    sourceAmount: null, // filled per card
    sourceCurrency: "USD",
    targetCurrency: "AZN",
    rate,
    rateSource: source,
    rateDate: date ?? null,
    appliedAt: now.toISOString(),
    reason: "one-off: stale KazUnion USD cards normalized to native AZN",
  };

  let updated = 0;
  for (const t of targets) {
    const p = t.product;
    const cardFx = { ...fx, sourceAmount: t.usd, targetAmount: t.azn };
    await prisma.$transaction(async (tx) => {
      const fresh = await tx.product.findUnique({ where: { id: p.id }, select: { attributes: true, version: true, status: true } });
      if (!fresh) throw new Error(`Product ${p.supplierRef} disappeared`);
      const current = (fresh.attributes ?? {});
      if (String(current.currency ?? "").toUpperCase() !== "USD") {
        throw new Error(`Product ${p.supplierRef} currency changed meanwhile (${current.currency}); aborting`);
      }

      await tx.product.update({
        where: { id: p.id },
        data: {
          attributes: {
            ...current,
            currency: "AZN",
            startingPrice: t.azn,
            sourcePrice: t.usd,
            sourceCurrency: "USD",
            fx: cardFx,
          },
          version: { increment: 1 },
        },
      });

      for (const tariff of p.tariffs) {
        const inc = (tariff.inclusions ?? {});
        await tx.tariff.update({
          where: { id: tariff.id },
          data: {
            price: t.azn,
            currency: "AZN",
            inclusions: {
              ...inc,
              sourcePrice: t.usd,
              sourceCurrency: "USD",
              fx: cardFx,
            },
          },
        });
      }

      await tx.productHistory.create({
        data: {
          productId: p.id,
          version: fresh.version + 1,
          action: "supplier.currency.normalize",
          from: fresh.status,
          to: fresh.status,
          fields: {
            fix: "kazunion-usd-to-azn",
            supplierRef: p.supplierRef,
            currencyFrom: "USD",
            currencyTo: "AZN",
            priceFrom: t.usd,
            priceTo: t.azn,
            rate,
            rateSource: source,
            rateDate: date ?? null,
          },
        },
      });

      updated++;
    });
  }

  console.log(`\nApplied: ${updated} card(s) converted from USD to AZN.`);
}

main()
  .catch((err) => {
    console.error("\nFAILED:", err.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
