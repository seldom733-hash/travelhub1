/**
 * TRAVELHUB — KOMPAS LIVE DATA → CATALOG PRODUCT INGESTION
 *
 * Populates catalog."Product" from REAL live KOMPAS offers via the existing
 * closed public supplier search API (Phase D of the implementation prompt).
 *
 * SAFETY (Phase P):
 *   - UPSERT/INSERT/UPDATE ONLY. No DELETE, no TRUNCATE, no reset.
 *   - Catalog wiped previously by an unknown bulk process; this tool must never
 *     provide a destructive path.
 *
 * IDEMPOTENCY (Phase C):
 *   Identity = "KOMPAS-HOTEL-<hotelKey>"  (one Product per KOMPAS hotel).
 *   Product.attributes.sourceKey  → identity lookup (unique in practice per
 *     live data: hotelKey→name is 1:1 in the golden window; ambiguous names
 *     are disambiguated by resort in the title).
 *   Tariff identity = deterministic per (hotelKey|departureDate|nights):
 *     code "TRF-KOMPAS-<hotelKey>-<YYYYMMDD>-<nights>n", price = MIN amount of
 *     the day's room/meal variants (Catalog contract: min tariff = priceFrom).
 *
 * USAGE:
 *   npx tsx scripts/kompas-catalog-ingest.ts --dry-run
 *   npx tsx scripts/kompas-catalog-ingest.ts
 *
 * Read-only dependencies: the running backend (:4000) for the live search,
 * DATABASE_URL from backend/.env for Prisma writes.
 */

import "dotenv/config";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient, Prisma } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── env: load backend/.env DATABASE_URL (script lives in backend/scripts) ──
function loadDatabaseUrl(): string {
  const envPath = resolve(__dirname, "../.env");
  try {
    const env = readFileSync(envPath, "utf-8");
    const m = env.match(/DATABASE_URL\s*=\s*"([^"]+)"/);
    if (m) return m[1];
  } catch {
    /* fallthrough */
  }
  const fromProcess = process.env.DATABASE_URL;
  if (!fromProcess) throw new Error("DATABASE_URL not found (backend/.env or env)");
  return fromProcess;
}

// ── types mirroring SupplierOffer (supplier.types.ts) ──
interface SupplierPriceSnapshot {
  amount: number;
  currency: string;
  fetchedAt: string;
  expiresAt: string;
  queryHash: string;
  source: string;
}

interface SupplierOfferLike {
  supplierCode: string;
  externalOfferId: string;
  externalClaim?: string;
  tour?: string;
  hotel: string;
  hotelExternalId?: string;
  country?: string | null;
  destination?: string | null;
  departureDate: string;
  nights: number;
  room?: string;
  meal?: string;
  adults: number;
  children: number;
  childAges: number[];
  price: SupplierPriceSnapshot;
  availability: string;
  transport?: string;
  fetchedAt: string;
  expiresAt: string;
  rawMetadata?: Record<string, unknown>;
}

interface IngestStats {
  fetched: number;
  valid: number;
  skipped: number;
  hotelsIdentified: number;
  productsCreated: number;
  productsUpdated: number;
  tariffsCreated: number;
  tariffsUpdated: number;
  publicationCreated: number;
  historyCreated: number;
  errors: string[];
}

// ── normalization helpers ──

/** "SANTA SOPHIA HOTEL 3*\n<spaces>(Кемер)" → { name, stars, resort } */
function parseHotelLine(rawLine: string): { name: string; stars: number | null; resort: string | null } {
  const firstLine = rawLine.split("\n")[0].trim();
  const starMatch = firstLine.match(/(\d)\s*\*\s*$/);
  const name = firstLine.replace(/\s*\d\s*\*\s*$/, "").trim();
  const resortMatch = rawLine.match(/\(([^()]*)\)\s*$/);
  const resort = resortMatch ? resortMatch[1].trim() : null;
  return { name, stars: starMatch ? parseInt(starMatch[1], 10) : null, resort };
}

function normName(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").replace(/[^a-zа-я0-9 ]/gi, "").trim();
}

const KOMPAS_SUPPLIER_CODE = "KOMPAS";

/** Deterministic Product identity from the KOMPAS hotel key. */
function productSourceKey(hotelKey: string): string {
  return `KOMPAS-HOTEL-${hotelKey}`;
}

/** Deterministic Tariff code per (hotelKey|date|nights). */
function tariffCode(hotelKey: string, departureDate: string, nights: number): string {
  const d = departureDate.replaceAll("-", "");
  return `TRF-KOMPAS-${hotelKey}-${d}-${nights}n`;
}

// ── validation (Phase G) ──

function validateOffer(o: SupplierOfferLike): string | null {
  if (o.supplierCode !== KOMPAS_SUPPLIER_CODE) return `supplierCode=${o.supplierCode}`;
  if (!o.hotelExternalId) return "missing hotelExternalId";
  if (!o.externalOfferId) return "missing externalOfferId (spoKey)";
  if (!/^\d{4}-\d{2}-\d{2}/.test(o.departureDate)) return `bad departureDate=${o.departureDate}`;
  if (!Number.isFinite(o.nights) || o.nights <= 0) return `bad nights=${o.nights}`;
  if (!Number.isFinite(o.price?.amount) || o.price.amount <= 0) return "bad price.amount";
  if (!o.price?.currency) return "missing currency";
  if (!Number.isFinite(o.adults) || o.adults <= 0) return "bad adults";
  return null;
}

// ── live fetch (Phase D) ──

async function fetchLiveOffers(baseUrl: string): Promise<SupplierOfferLike[]> {
  const params = new URLSearchParams({
    supplier: KOMPAS_SUPPLIER_CODE,
    country: "Turkey",
    departureCity: "Baku",
    nightsFrom: "7",
    nightsTo: "7",
    adults: "2",
    children: "0",
    departureDateFrom: "2026-09-20",
    departureDateTo: "2026-09-27",
  });
  const res = await fetch(`${baseUrl}/api/v1/public/supplier/search?${params}`);
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`live search failed: HTTP ${res.status} ${body.slice(0, 200)}`);
  }
  const data = (await res.json()) as SupplierOfferLike[];
  return Array.isArray(data) ? data : ((data as unknown as { items?: SupplierOfferLike[] }).items ?? []);
}

// ── ingestion core ──

async function main(): Promise<void> {
  const dryRun = process.argv.includes("--dry-run");
  const baseUrl = process.env.BACKEND_URL ?? "http://localhost:4000";

  console.log(`════════ KOMPAS → Catalog ingestion (${dryRun ? "DRY-RUN" : "REAL WRITE"}) ════════`);
  const t0 = Date.now();

  // Phase D: live retrieval — never stale fixtures
  console.log("\n[1/5] Fetching live KOMPAS offers (golden window 2026-09-20..27, 7n, 2+0, USD)...");
  const offers = await fetchLiveOffers(baseUrl);
  console.log(`      fetched: ${offers.length} offers`);

  // Phase G: validation
  const stats: IngestStats = {
    fetched: offers.length,
    valid: 0,
    skipped: 0,
    hotelsIdentified: 0,
    productsCreated: 0,
    productsUpdated: 0,
    tariffsCreated: 0,
    tariffsUpdated: 0,
    publicationCreated: 0,
    historyCreated: 0,
    errors: [],
  };

  const valid: SupplierOfferLike[] = [];
  const skipReasons = new Map<string, number>();
  for (const o of offers) {
    const problem = validateOffer(o);
    if (problem) {
      stats.skipped++;
      skipReasons.set(problem, (skipReasons.get(problem) ?? 0) + 1);
      if (stats.errors.length < 10) stats.errors.push(`offer spo=${o.externalOfferId}: ${problem}`);
    } else {
      valid.push(o);
    }
  }
  stats.valid = valid.length;
  console.log(`      valid: ${stats.valid}, skipped: ${stats.skipped}`, skipReasons.size ? JSON.stringify([...skipReasons]) : "");
  if (!stats.valid) throw new Error("no valid offers — aborting before any DB write");

  // Group by hotel (Product identity)
  const byHotel = new Map<string, SupplierOfferLike[]>();
  for (const o of valid) {
    const key = o.hotelExternalId as string;
    const arr = byHotel.get(key) ?? [];
    arr.push(o);
    byHotel.set(key, arr);
  }
  stats.hotelsIdentified = byHotel.size;
  console.log(`      distinct hotels (Products): ${byHotel.size}`);

  // Category lookup (tours), partner (KOMPAS)
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: loadDatabaseUrl() }) });
  try {
    const category = await prisma.category.findFirst({ where: { slug: "tours", status: "ACTIVE" } });
    if (!category) throw new Error("Category slug=tours (ACTIVE) not found — cannot map products");
    const partner = await prisma.partner.findFirst({ where: { name: KOMPAS_SUPPLIER_CODE } });
    console.log(`\n[2/5] Category: ${category.slug} (${category.id}); partner: ${partner ? partner.name : "none (partnerId=null)"}`);

    if (dryRun) {
      console.log("\n[DRY-RUN] Would create/update:");
      console.log(`      Products (hotels):   ${byHotel.size}`);
      console.log(`      Tariffs (hotel×date): ${byHotel.size * 8} (approx: distinct hotel|date in window)`);
      console.log(`      PublicationChannel:  ${byHotel.size} (MARKETPLACE)`);
      console.log("\n      Sample mapping (first 3 hotels):");
      for (const [hotelKey, offersOfHotel] of [...byHotel.entries()].slice(0, 3)) {
        const parsed = parseHotelLine(offersOfHotel[0].hotel);
        const minPrice = Math.min(...offersOfHotel.map((o) => o.price.amount));
        const dates = [...new Set(offersOfHotel.map((o) => o.departureDate))].sort();
        console.log(`      · ${parsed.name}${parsed.stars ? ` ${parsed.stars}*` : ""} [${parsed.resort ?? "-"}]`);
        console.log(`        sourceKey=${productSourceKey(hotelKey)}  tariffs=${dates.length}  priceFrom=$${minPrice} ${offersOfHotel[0].price.currency}`);
      }
      console.log("\n[DRY-RUN] No DB writes performed.");
      return;
    }

    // Phase H: transactional upsert per hotel
    console.log("\n[3/5] Writing catalog (upsert-only)...");
    let hotelIdx = 0;
    for (const [hotelKey, offersOfHotel] of byHotel) {
      hotelIdx++;
      const parsed = parseHotelLine(offersOfHotel[0].hotel);
      const sourceKey = productSourceKey(hotelKey);
      const displayName = parsed.resort
        ? `${parsed.name} (${parsed.resort})`
        : parsed.name;
      // deterministic per-day min prices
      const dayMin = new Map<string, { amount: number; currency: string; room: string; meal: string; spoKey: string }>();
      for (const o of offersOfHotel) {
        const d = o.departureDate.slice(0, 10);
        const prev = dayMin.get(d);
        if (!prev || o.price.amount < prev.amount) {
          dayMin.set(d, { amount: o.price.amount, currency: o.price.currency, room: (o.room ?? "").trim(), meal: (o.meal ?? "").trim(), spoKey: o.externalOfferId });
        }
      }

      await prisma.$transaction(async (tx) => {
        // Product upsert by deterministic attributes.sourceKey
        const existing = await tx.product.findFirst({
          where: { attributes: { path: ["sourceKey"], equals: sourceKey } },
          include: { publicationChannels: true },
        });

        let productId: string;
        if (!existing) {
          const created = await tx.product.create({
            data: {
              code: `PRD-KOMPAS-${hotelKey}`,
              type: "TOUR",
              title: displayName,
              slug: `kompas-turkey-${parsed.stars ?? 0}star-${normName(parsed.name).replace(/\s+/g, "-")}-${hotelKey}`,
              description: `${parsed.name}${parsed.stars ? ` ${parsed.stars}*` : ""}${parsed.resort ? `, ${parsed.resort}` : ""} — Turkey. Real KOMPAS live offer ingested ${new Date().toISOString()}. Prices per 2 adults, 7 nights, USD.`,
              status: "PUBLISHED",
              publishedAt: new Date(),
              version: 1,
              createdBy: "kompas-ingest",
              updatedBy: "kompas-ingest",
              categoryId: category.id,
              partnerId: partner?.id ?? null,
              attributes: {
                source: KOMPAS_SUPPLIER_CODE,
                sourceKey,
                hotelExternalId: hotelKey,
                stars: parsed.stars,
                resort: parsed.resort,
                country: "Turkey",
                departureCity: "Baku",
                stateInc: 17,
                townFromInc: 1411,
                tourKey: offersOfHotel[0].tour ?? "3332",
              },
              serviceTimeZone: "Europe/Istanbul",
            },
          });
          productId = created.id;
          stats.productsCreated++;
          await tx.productHistory.create({
            data: {
              productId,
              version: 1,
              action: "CREATED",
              actorId: "kompas-ingest",
              actorName: "KOMPAS catalog ingestion",
              comment: `Live KOMPAS ingestion (spoKey=${offersOfHotel[0].externalOfferId}, hotelKey=${hotelKey})`,
              fields: { source: KOMPAS_SUPPLIER_CODE, hotelKey, offers: offersOfHotel.length },
            },
          });
          stats.historyCreated++;
        } else {
          productId = existing.id;
          await tx.product.update({
            where: { id: productId },
            data: { updatedAt: new Date(), updatedBy: "kompas-ingest" },
          });
          stats.productsUpdated++;
        }

        // MARKETPLACE publication channel (idempotent via @@unique(productId, channel))
        const hasChannel = existing
          ? existing.publicationChannels.some((c) => c.channel === "MARKETPLACE")
          : false;
        if (!hasChannel) {
          await tx.productPublicationChannel.create({
            data: { productId, channel: "MARKETPLACE", createdById: "kompas-ingest" },
          });
          stats.publicationCreated++;
        }

        // Tariffs: one per departure date (min price of the day), deterministic code
        for (const [date, day] of [...dayMin.entries()].sort()) {
          const code = tariffCode(hotelKey, date, offersOfHotel[0].nights);
          const tariffData = {
            name: `${date} · 7 nights · ${day.room || "STD"} / ${day.meal || "RO"}`,
            price: new Prisma.Decimal(day.amount),
            currency: day.currency,
            validFrom: new Date(`${date}T00:00:00Z`),
            validTo: new Date(`${date}T23:59:59Z`),
            priceBasis: "PER_PERSON" as const,
            pricingMode: "FIXED" as const,
            status: "ACTIVE" as const,
          } satisfies Prisma.TariffUpdateInput;
          const existingTariff = await tx.tariff.findUnique({ where: { code } });
          if (!existingTariff) {
            await tx.tariff.create({
              data: { code, productId, version: 1, ...tariffData },
            });
            stats.tariffsCreated++;
          } else if (existingTariff.price.toNumber() !== day.amount || existingTariff.status !== "ACTIVE") {
            await tx.tariff.update({ where: { code }, data: { ...tariffData, version: existingTariff.version + 1 } });
            stats.tariffsUpdated++;
          }
        }
      });
      if (hotelIdx % 20 === 0) console.log(`      ...${hotelIdx}/${byHotel.size} hotels`);
    }

    console.log(`\n[4/5] Done in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
    console.log("      " + JSON.stringify(stats, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("INGESTION FAILED:", err instanceof Error ? err.message : err);
  process.exit(1);
});
