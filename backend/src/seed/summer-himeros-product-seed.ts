/**
 * One-off controlled seed (HIMEROS matrix E2E): creates exactly ONE TravelHub
 * Product for HIMEROS BEACH HOTEL from real Summer data. Idempotent.
 *
 * Security: no credentials/secrets stored here. Partner resolved by name.
 *
 * Usage: cd backend && npx ts-node src/seed/summer-himeros-product-seed.ts
 */
import "dotenv/config";
import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

const PRODUCT_CODE = "SUMMERTOUR-229-2807";
const HOTEL = "HIMEROS BEACH HOTEL 3* (Кемер)";
const HOTEL_KEY = "2807";
const TOUR_INC = { value: "229", name: "Antalya 2026" };
const ONE_WAY = { value: "254", name: "Antalya 2026 (NO RETURN)" };

/** Product attributes — catalog identity only. Prices are indicative (dynamic offers live in Summer). */
function buildAttributes(): Record<string, unknown> {
  return {
    days: 8,
    nights: 7,
    hotel: HOTEL,
    hotelKey: HOTEL_KEY,
    tour: TOUR_INC.name,
    tourKey: "229",
    tourIncValue: "229",
    tourIncName: TOUR_INC.name,
    // Multi-program merge: round-trip + one-way programs share ONE card.
    tourIncValues: [TOUR_INC.value, ONE_WAY.value],
    tourIncNames: [TOUR_INC.name, ONE_WAY.name],
    country: "Turkey",
    countryCode: "TR",
    resort: "Кемер",
    stars: 3,
    supplier: "Summertour",
    supplierCode: "SUMMERTOUR",
    // Indicative starting price = min over real observed offers (254 one-way, 2026-10-03).
    startingPrice: 816.83,
    currency: "USD",
    offerCount: 2,
    rooms: ["STANDARD ROOM / DBL"],
    meals: ["AI"],
    availableNights: [7],
    availableDates: ["2026-09-26", "2026-09-30", "2026-10-03"],
    rawHotelKey: HOTEL_KEY,
    rawTourKey: "229",
  };
}

async function main() {
  console.log("=== Summer HIMEROS product seed (one card) ===\n");

  const partner = await prisma.partner.findFirst({
    where: { name: "Summer / Summertour" },
    select: { id: true, code: true, name: true },
  });
  if (!partner) throw new Error("Summer partner not found");
  console.log(`Partner: ${partner.code} (${partner.id})`);

  const category = await prisma.category.findUnique({
    where: { slug: "tours" },
    select: { id: true, slug: true },
  });
  if (!category) throw new Error("Category 'tours' not found");

  const existing = await prisma.product.findUnique({
    where: { code: PRODUCT_CODE },
    select: { id: true, code: true, status: true },
  });

  const attributes = buildAttributes();

  if (existing) {
    console.log(`Product EXISTS: ${existing.code} — updating attributes`);
    await prisma.product.update({
      where: { id: existing.id },
      data: { attributes: attributes as object, updatedAt: new Date() },
    });
    console.log("Attributes updated (status/tariffs/channels preserved).");
  } else {
    const idResult = await prisma.$queryRaw<{ id: string }[]>`
      INSERT INTO "catalog"."Product" (
        "id", "code", "type", "title", "slug", "status", "version",
        "categoryId", "attributes", "partnerId", "publishedAt", "createdAt", "updatedAt"
      ) VALUES (
        gen_random_uuid(), ${PRODUCT_CODE}, 'TOUR'::"catalog"."ProductType",
        ${"HIMEROS BEACH HOTEL 3* (Кемер) — Antalya 2026"}, ${"summer-229-2807-kemer"}, 'PUBLISHED'::"catalog"."ProductStatus", 1,
        ${category.id}, ${JSON.stringify(attributes)}::jsonb, ${partner.id},
        now(), now(), now()
      )
      RETURNING "id"
    `;
    const id = idResult[0].id;

    // Indicative starting price tariff (min across real observed offers)
    await prisma.$executeRaw`
      INSERT INTO "catalog"."Tariff" ("id", "code", "productId", "name", "price", "currency", "status", "version", "createdAt", "updatedAt")
      VALUES (gen_random_uuid(), ${"TRF-SUM-2807-229"}, ${id}, ${"Base"}, ${816.83}::decimal, ${"USD"}, 'ACTIVE'::"catalog"."RatePlanStatus", 1, now(), now())
    `;

    // Publication channels: Marketplace + Partner storefront
    await prisma.$executeRaw`
      INSERT INTO "catalog"."ProductPublicationChannel" ("id", "productId", "channel", "createdAt")
      VALUES (gen_random_uuid(), ${id}, 'MARKETPLACE'::"catalog"."PublicationChannel", now())
    `;
    await prisma.$executeRaw`
      INSERT INTO "catalog"."ProductPublicationChannel" ("id", "productId", "channel", "createdAt")
      VALUES (gen_random_uuid(), ${id}, 'PARTNER_STOREFRONT'::"catalog"."PublicationChannel", now())
    `;

    console.log(`Product CREATED: ${PRODUCT_CODE} (id=${id})`);
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("Seed failed:", e);
  process.exit(1);
});
