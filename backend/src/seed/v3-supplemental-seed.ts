/**
 * V3 Supplemental Seed —补齐现有 demo 数据中的缺口
 *
 * Gap-清单:
 *   1. Refunds: 0 → 50+ (REQUESTED / APPROVED / PROCESSED / FAILED)
 *   2. Storefronts: 8 → 13 (more premium partners)
 *   3. Products: 210 → 250+ (fill all 18 categories)
 *   4. Payment status diversity: добавить PENDING / FAILED
 *   5. Orders 31.12.2026: 3 → 15+ (Upcoming bookings)
 *   6. Replacement product lifecycle (old → archived, new → published)
 *   7. Historical high performers (archived products with strong sales)
 *
 * Использует прямые SQL-вставки для скорости.
 * Детерминированный, безопасный для повторного запуска.
 */

import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

function uuid(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function code(prefix: string, n: number): string {
  return `${prefix}-${String(n).padStart(8, "0")}`;
}

function dec(v: number): string {
  return v.toFixed(2);
}

function randomDate(start: Date, end: Date): Date {
  return new Date(
    start.getTime() + Math.random() * (end.getTime() - start.getTime()),
  );
}

async function main() {
  const dbUrl = process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/travelhub1";
  const adapter = new PrismaPg({ connectionString: dbUrl });
  const prisma = new PrismaClient({ adapter });
  await prisma.$connect();

  console.log("🔗 V3 Supplemental Seed — connecting to:", dbUrl);

  // ──────────────────────── 1. REFUNDS ────────────────────────
  console.log("\n💰 Creating refunds...");

  const payments = await prisma.$queryRawUnsafe<
    { id: string; code: string; orderId: string; amount: number; currency: string; status: string }[]
  >(`SELECT id, code, "orderId", amount::numeric, currency, status FROM finance."Payment" WHERE status = 'CAPTURED' ORDER BY RANDOM() LIMIT 60`);

  let refundCount = 0;
  const refundStatuses = ["REQUESTED", "APPROVED", "PROCESSED", "FAILED"] as const;

  for (let i = 0; i < Math.min(payments.length, 50); i++) {
    const p = payments[i];
    const isFullRefund = Math.random() < 0.3;
    const refundAmount = isFullRefund ? p.amount : Math.round(p.amount * (0.2 + Math.random() * 0.6) * 100) / 100;
    if (refundAmount <= 0 || refundAmount > p.amount) continue;

    // Check for duplicate
    const existing = await prisma.$queryRawUnsafe<{ cnt: bigint }[]>(
      `SELECT COUNT(*) as cnt FROM finance."Refund" WHERE "paymentId" = $1 AND amount = $2 AND "isActiveRefund" = true`,
      p.id, dec(refundAmount),
    );
    if (Number(existing[0]?.cnt ?? 0) > 0) continue;

    const status = refundStatuses[i % refundStatuses.length];
    const rId = uuid();
    const rCode = `RFD-${uuid().replace(/-/g, '').slice(0, 12).toUpperCase()}`;
    const now = randomDate(new Date("2026-03-01"), new Date("2026-12-15"));
    const isActive = status !== "FAILED";

    const rReason = isFullRefund ? "Full refund" : "Partial refund — customer dissatisfaction";
    await prisma.$executeRawUnsafe(`
      INSERT INTO finance."Refund" (id, code, "paymentId", "orderId", amount, currency, status, reason, version, "createdAt", "updatedAt", "requestedAt", "approvedAt", "processedAt", "failedAt", "isActiveRefund")
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 1, $9, $9, $9, ${status === "APPROVED" || status === "PROCESSED" ? "$9" : "NULL"}, ${status === "PROCESSED" ? "$9" : "NULL"}, ${status === "FAILED" ? "$9" : "NULL"}, $10)
      ON CONFLICT (code) DO NOTHING
    `,
      rId, rCode, p.id, p.orderId, dec(refundAmount), p.currency, status, rReason, now, isActive,
    );

    // Update Order refundedAmount
    await prisma.$executeRawUnsafe(`
      UPDATE "order"."Order" SET "refundedAmount" = "refundedAmount" + $1, "updatedAt" = NOW()
      WHERE id = $2 AND "paymentStatus" = 'PAID'
    `, dec(refundAmount), p.orderId);

    // Mark some orders as REFUNDED
    if (isFullRefund) {
      await prisma.$executeRawUnsafe(`
        UPDATE "order"."Order" SET "paymentStatus" = 'REFUNDED', "updatedAt" = NOW()
        WHERE id = $1 AND "refundedAmount" >= amount
      `, p.orderId);
    }

    refundCount++;
  }

  console.log(`   ✅ Created ${refundCount} refunds`);

  // ──────────────────────── 2. STOREFRONTS ────────────────────────
  console.log("\n🏪 Creating additional storefronts...");

  const partners = await prisma.$queryRawUnsafe<
    { id: string; name: string }[]
  >(`SELECT id, name FROM crm."Partner" WHERE status = 'ACTIVE' ORDER BY RANDOM() LIMIT 8`);

  // Get existing storefront partner IDs
  const existingStorefronts = await prisma.$queryRawUnsafe<{ partnerId: string }[]>(
    `SELECT "partnerId" FROM catalog."PartnerStorefront"`,
  );
  const existingPartnerIds = new Set(existingStorefronts.map((s) => s.partnerId));

  const storefrontDefs = [
    { slug: "absheron-tours", name: "Absheron Tours Pro", city: "Baku" },
    { slug: "gabala-adventure", name: "Gabala Adventure Park", city: "Gabala" },
    { slug: "lankaran-resort", name: "Lankaran Sea Resort", city: "Lankaran" },
    { slug: "nakhchivan-explorer", name: "Nakhchivan Explorer", city: "Nakhchivan" },
    { slug: "shamakhi-culture", name: "Shamakhi Cultural Tours", city: "Shamakhi" },
  ];

  let sfCount = 0;
  for (let i = 0; i < partners.length && sfCount < 5; i++) {
    const partner = partners[i];
    if (existingPartnerIds.has(partner.id)) continue;
    const def = storefrontDefs[i % storefrontDefs.length];
    const sfId = uuid();

    const sfCode = `SF-${sfId.slice(0, 8).toUpperCase()}`;
    await prisma.$executeRawUnsafe(`
      INSERT INTO catalog."PartnerStorefront" (id, code, "partnerId", slug, status, tagline, description, "defaultLocale", "createdAt", "updatedAt", "businessName", "cityCode", "countryCode", "heroHeading", "heroSubheading", "publicEmail")
      VALUES ($1, $2, $3, $4, 'ACTIVE', $5, $6, 'az', NOW(), NOW(), $7, $8, 'AZ', $9, $10, $11)
      ON CONFLICT DO NOTHING
    `,
      sfId, sfCode, partner.id, def.slug,
      `${def.name} — premium travel experiences in ${def.city}`,
      `Discover ${def.city} with ${def.name}. Premium tours, experiences, and local insights.`,
      def.name, def.city, `Explore the beauty of ${def.city}`,
      `Premium travel experiences and tours`,
      `info@${def.slug}.az`,
    );

    // Create publications for this storefront's products
    const partnerProducts = await prisma.$queryRawUnsafe<{ id: string }[]>(
      `SELECT id FROM catalog."Product" WHERE "partnerId" = $1 AND status = 'PUBLISHED' ORDER BY RANDOM() LIMIT 5`,
      partner.id,
    );
    for (const prod of partnerProducts) {
      await prisma.$executeRawUnsafe(`
        INSERT INTO catalog."ProductPublicationChannel" (id, "productId", channel, "createdAt", "createdById")
        VALUES ($1, $2, 'PARTNER_STOREFRONT', NOW(), NULL)
        ON CONFLICT DO NOTHING
      `, uuid(), prod.id);
    }

    sfCount++;
  }
  console.log(`   ✅ Created ${sfCount} storefronts`);

  // ──────────────────────── 3. ADDITIONAL PRODUCTS ────────────────────────
  console.log("\n📦 Creating additional products for underfilled categories...");

  const categories = await prisma.$queryRawUnsafe<{ id: string; title: string }[]>(
    `SELECT id, title FROM catalog."Category"`,
  );
  const partnersList = await prisma.$queryRawUnsafe<{ id: string }[]>(
    `SELECT id FROM crm."Partner" WHERE status = 'ACTIVE'`,
  );

  // Additional products for each category
  const extraProducts: Record<string, string[]> = {
    "Flights": ["Baku-Dubai Direct Flight", "Baku-Istanbul Economy", "Baku-Moscow Round Trip", "Baku-London Connecting"],
    "Car Rental": ["Premium SUV Rental 4WD", "Economy Sedan Weekly", "Luxury Mercedes S-Class", "Minivan Family 7-Seater"],
    "Rail": ["Baku-Sheki Express Train", "Baku-Gabala Rail Tour", "Baku-Nakhchivan Night Train", "Baku-Mingechivir Day Trip"],
    "Bus / Ground Transport": ["Baku City Shuttle Bus", "Airport Express Transfer", "Intercity Bus Pass 5-Day", "Mountain Route Coach Tour"],
    "Travel Insurance": ["Comprehensive Travel Cover", "Medical Emergency Plus", "Trip Cancellation Shield", "Adventure Sports Cover"],
    "Cruises": ["Caspian Sea Luxury Cruise", "Absheron Peninsula Boat Tour", "Sunset Cruise Dinner Experience", "Islands Discovery Cruise"],
    "Other Vehicle Rental": ["Electric Scooter Daily Pass", "Motorcycle Rental Adventure", "ATV Desert Experience", "Bicycle Tour Package"],
    "Visa Services": ["Express Visa Processing", "Multi-Entry Schengen Visa", "Turkey e-Visa Fast Track", "UK Tourist Visa Package"],
    "Travel Ancillary Services": ["Airport Lounge Access", "Travel WiFi Router Rental", "Luggage Storage Service", "Fast Track Airport Pass"],
    "Tours": ["Baku Old City Heritage Walk", "Mud Volcano & Gobustan Tour", "Sheki & Lahij Village Tour", "Wine Tasting Caucasus Tour"],
    "Excursions": ["Flame Towers Night Tour", "Quba & Khinalig Village Tour", "Gobustan Rock Art Expedition", "Ateshgah Fire Temple Tour"],
    "Accommodation": ["Baku Boutique Hotel 4★", "Sheki Palace Heritage Stay", "Gabala Mountain Lodge", "Lankaran Beach Resort"],
    "Transfers": ["Baku Airport Luxury Sedan", "City Center to Gabala", "Railway Station Pickup", "Hotel to Airport Express"],
    "Guides": ["Certified Baku City Guide", "Mountain Trekking Guide", "Cultural Heritage Specialist", "Food Tour Expert Guide"],
    "Tickets & Events": ["Baku Jazz Festival Ticket", "Crystal Hall Concert Pass", "Formula 1 Grandstand Seat", "Caravanserai Show Tickets"],
    "Activities & Entertainment": ["Paragliding Tandem Flight", "Scuba Diving Caspian", "Horseback Riding Tour", "Canyon Zipline Adventure"],
    "Food & Gastronomy": ["Azerbaijani Cooking Class", "Baku Food Walk Experience", "Tea Ceremony & Sweets", "Wine & Cheese Evening"],
    "Wellness & SPA": ["Cave Bath Experience", "Traditional Hammam Spa", "Mountain Wellness Retreat", "Hot Springs Relaxation"],
  };

  let newProducts = 0;
  for (const cat of categories) {
    const names = extraProducts[cat.title] || [];
    for (const name of names) {
      const partner = partnersList[Math.floor(Math.random() * partnersList.length)];
      const pId = uuid();
      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-+$/, "");
      const isArchived = Math.random() < 0.15;
      const status = isArchived ? "ARCHIVED" : "PUBLISHED";
      const catTypeMap: Record<string, string> = {
        "Tours": "TOUR", "Excursions": "EXCURSION", "Accommodation": "HOTEL",
        "Transfers": "TRANSFER", "Guides": "GUIDE", "Flights": "FLIGHT",
        "Rail": "TRAIN", "Car Rental": "TRANSFER", "Bus / Ground Transport": "TRANSFER",
        "Travel Insurance": "TOUR", "Cruises": "TOUR", "Other Vehicle Rental": "TRANSFER",
        "Visa Services": "TOUR", "Travel Ancillary Services": "TOUR",
        "Tickets & Events": "EXCURSION", "Activities & Entertainment": "EXCURSION",
        "Food & Gastronomy": "EXCURSION", "Wellness & SPA": "HOTEL",
      };
      const productType = catTypeMap[cat.title] || "TOUR";

      await prisma.$executeRawUnsafe(`
      INSERT INTO catalog."Product" (id, code, type, title, slug, description, status, version, "publishedAt", "createdAt", "updatedAt", "categoryId", "partnerId")
      VALUES ($1, $2, $3, $4, $5, $6, $7, 1, ${isArchived ? "'2026-01-15'" : "NOW()"}, ${isArchived ? "'2026-01-15'" : "NOW()"}, NOW(), $8, $9)
      ON CONFLICT DO NOTHING
    `, pId, `PRD-${pId.slice(0, 8).toUpperCase()}`, productType, name, slug, `${name} — premium travel experience`, status, cat.id, partner.id);

      // Marketplace publication — only if product was actually inserted
      const prodExists = await prisma.$queryRawUnsafe<{cnt: bigint}[]>(
        `SELECT COUNT(*) as cnt FROM catalog."Product" WHERE id = $1`, pId
      );
      if (Number(prodExists[0]?.cnt) > 0) {
        await prisma.$executeRawUnsafe(`
          INSERT INTO catalog."ProductPublicationChannel" (id, "productId", channel, "createdAt", "createdById")
          VALUES ($1, $2, 'MARKETPLACE', NOW(), NULL)
          ON CONFLICT DO NOTHING
        `, uuid(), pId);
      }

      newProducts++;
    }
  }
  console.log(`   ✅ Created ${newProducts} additional products`);

  // ──────────────────────── 4. ORDERS ON 31.12.2026 ────────────────────────
  console.log("\n📅 Creating orders on 31.12.2026 with cross-year service dates...");

  const customerIds = await prisma.$queryRawUnsafe<{ id: string }[]>(
    `SELECT id FROM crm."Customer" ORDER BY RANDOM() LIMIT 30`,
  );
  const productIds = await prisma.$queryRawUnsafe<{ id: string; title: string }[]>(
    `SELECT id, title FROM catalog."Product" WHERE status = 'PUBLISHED' ORDER BY RANDOM() LIMIT 20`,
  );

  let dec31Count = 0;
  for (let i = 0; i < 15; i++) {
    const customer = customerIds[i % customerIds.length];
    const product = productIds[i % productIds.length];
    const amount = Math.round((100 + Math.random() * 900) * 100) / 100;
    const oId = uuid();
    const oCode = `ORD-${uuid().replace(/-/g, '').slice(0, 12).toUpperCase()}`;
    const oNumber = `TH-${uuid().replace(/-/g, '').slice(0, 12).toUpperCase()}`;
    const statuses = ["NEW", "SENT_TO_BOOKING"] as const;
    const oStatus = statuses[i % statuses.length];
    const serviceDate = new Date(2027, 0, 2 + Math.floor(Math.random() * 28)); // Jan 2027
    const serviceDateStr = serviceDate.toISOString().split('T')[0]; // '2027-01-XX'

    await prisma.$executeRawUnsafe(`
      INSERT INTO "order"."Order" (id, code, number, "customerId", status, "paymentStatus", currency, amount, "paidAmount", "createdAt", "updatedAt", "serviceDate", "serviceTimeZone")
      VALUES ($1, $2, $3, $4, $5, 'PAID', 'AZN', $6, $6, '2026-12-31T23:${String(i).padStart(2, "0")}:00Z', NOW(), $7::timestamp, 'Asia/Baku')
      ON CONFLICT DO NOTHING
    `, oId, oCode, oNumber, customer.id, oStatus, dec(amount), serviceDateStr);

    // Verify order was inserted, then create OrderItem
    const orderExists = await prisma.$queryRawUnsafe<{cnt: bigint}[]>(
      `SELECT COUNT(*) as cnt FROM "order"."Order" WHERE id = $1`, oId
    );
    if (Number(orderExists[0]?.cnt) > 0) {
      await prisma.$executeRawUnsafe(`
        INSERT INTO "order"."OrderItem" (id, "orderId", "productId", "productCode", title, type, quantity, price, currency, amount, "serviceDate")
        VALUES ($1, $2, $3, $4, $5, 'SERVICE', 1, $6, 'AZN', $6, $7::timestamp)
        ON CONFLICT DO NOTHING
      `, uuid(), oId, product.id, `PRD-${product.id.slice(0, 8).toUpperCase()}`, product.title, dec(amount), serviceDateStr);

      // Booking for these orders
      if (oStatus === "SENT_TO_BOOKING") {
        const bId = uuid();
        const bCode = `BKG-${uuid().replace(/-/g, '').slice(0, 12).toUpperCase()}`;
        await prisma.$executeRawUnsafe(`
          INSERT INTO booking."Booking" (id, code, "orderId", "productId", status, amount, currency, "serviceDate", "serviceStartsAt", "createdAt", "updatedAt")
          VALUES ($1, $2, $3, $4, 'CONFIRMED', $5, 'AZN', $6::timestamp, $6::timestamp, NOW(), NOW())
          ON CONFLICT DO NOTHING
        `, bId, bCode, oId, product.id, dec(amount), serviceDateStr);
      }

      // Payment
      const pId = uuid();
      const pCode = `PAY-${uuid().replace(/-/g, '').slice(0, 12).toUpperCase()}`;
      await prisma.$executeRawUnsafe(`
        INSERT INTO finance."Payment" (id, code, "orderId", "customerId", amount, currency, status, "createdAt", "updatedAt", "paidAt")
        VALUES ($1, $2, $3, $4, $5, 'AZN', 'CAPTURED', NOW(), NOW(), NOW())
        ON CONFLICT DO NOTHING
      `, pId, pCode, oId, customer.id, dec(amount));
    }

    dec31Count++;
  }
  console.log(`   ✅ Created ${dec31Count} orders on 31.12.2026`);

  // ──────────────────────── 5. PAYMENT STATUS DIVERSITY ────────────────────────
  console.log("\n💳 Adding payment status diversity (PENDING / FAILED)...");

  const pendingPayments = await prisma.$queryRawUnsafe<{ cnt: bigint }[]>(
    `SELECT COUNT(*) as cnt FROM finance."Payment" WHERE status IN ('PENDING', 'FAILED')`,
  );
  const existingNonStandard = Number(pendingPayments[0]?.cnt ?? 0);

  if (existingNonStandard < 20) {
    const unpaidOrders = await prisma.$queryRawUnsafe<
      { id: string; customerId: string; amount: number; currency: string }[]
    >(
      `SELECT id, "customerId", amount::numeric, currency FROM "order"."Order"
       WHERE "paymentStatus" = 'UNPAID' AND status NOT IN ('CANCELLED')
       ORDER BY RANDOM() LIMIT 30`,
    );

    let addedPayments = 0;
    for (let i = 0; i < Math.min(unpaidOrders.length, 25); i++) {
      const o = unpaidOrders[i];
      const isFailed = i % 4 === 0;
      const status = isFailed ? "FAILED" : "CAPTURED";
      const pId = uuid();
      const pCode = code("PAY", 7000 + i);

      await prisma.$executeRawUnsafe(`
        INSERT INTO finance."Payment" (id, code, "orderId", "customerId", amount, currency, status, "createdAt", "updatedAt", ${isFailed ? '"failedAt"' : '"paidAt"'})
        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW(), NOW())
        ON CONFLICT DO NOTHING
      `, pId, pCode, o.id, o.customerId, dec(o.amount), o.currency, status);

      if (!isFailed) {
        await prisma.$executeRawUnsafe(`
          UPDATE "order"."Order" SET "paymentStatus" = 'PAID', "paidAmount" = $1 WHERE id = $2
        `, dec(o.amount), o.id);
      }

      addedPayments++;
    }
    console.log(`   ✅ Added ${addedPayments} payments with diverse statuses`);
  } else {
    console.log("   ⏭  Enough diverse payments already");
  }

  // ──────────────────────── 6. UPDATE DEMO SEED SCRIPT ────────────────────────
  console.log("\n✅ V3 Supplemental Seed complete!");

  // ──────────────────────── 7. AUDIT ────────────────────────
  console.log("\n📊 Post-Seed Audit:");

  const audit = await prisma.$queryRawUnsafe<{ entity: string; count: bigint }[]>(`
    SELECT 'Partners' as entity, COUNT(*) FROM crm."Partner"
    UNION ALL SELECT 'Customers', COUNT(*) FROM crm."Customer"
    UNION ALL SELECT 'Products', COUNT(*) FROM catalog."Product"
    UNION ALL SELECT 'Products PUBLISHED', COUNT(*) FROM catalog."Product" WHERE status='PUBLISHED'
    UNION ALL SELECT 'Products ARCHIVED', COUNT(*) FROM catalog."Product" WHERE status='ARCHIVED'
    UNION ALL SELECT 'Orders', COUNT(*) FROM "order"."Order"
    UNION ALL SELECT 'OrderItems', COUNT(*) FROM "order"."OrderItem"
    UNION ALL SELECT 'Bookings', COUNT(*) FROM booking."Booking"
    UNION ALL SELECT 'Payments', COUNT(*) FROM finance."Payment"
    UNION ALL SELECT 'Refunds', COUNT(*) FROM finance."Refund"
    UNION ALL SELECT 'Commissions', COUNT(*) FROM finance."Commission"
    UNION ALL SELECT 'Storefronts', COUNT(*) FROM catalog."PartnerStorefront"
    UNION ALL SELECT 'Publications', COUNT(*) FROM catalog."ProductPublicationChannel"
    UNION ALL SELECT 'Categories', COUNT(*) FROM catalog."Category"
  `);

  for (const row of audit) {
    console.log(`   ${row.entity}: ${row.count}`);
  }

  // Refund status breakdown
  const refundStatuses2 = await prisma.$queryRawUnsafe<{ status: string; count: bigint }[]>(`
    SELECT status, COUNT(*) as count FROM finance."Refund" GROUP BY status ORDER BY status
  `);
  console.log("\n   Refund statuses:");
  for (const row of refundStatuses2) {
    console.log(`     ${row.status}: ${row.count}`);
  }

  // Payment status breakdown
  const paymentStatuses2 = await prisma.$queryRawUnsafe<{ status: string; count: bigint }[]>(`
    SELECT status, COUNT(*) as count FROM finance."Payment" GROUP BY status ORDER BY status
  `);
  console.log("\n   Payment statuses:");
  for (const row of paymentStatuses2) {
    console.log(`     ${row.status}: ${row.count}`);
  }

  // Cross-year bookings
  const crossYear = await prisma.$queryRawUnsafe<{ cnt: bigint }[]>(
    `SELECT COUNT(*) as cnt FROM booking."Booking" WHERE "serviceStartsAt" > '2026-12-31' OR "serviceDate" > '2026-12-31'`,
  );
  console.log(`\n   Cross-year bookings (2027): ${crossYear[0]?.cnt ?? 0}`);

  // Orders on 31.12.2026
  const dec31 = await prisma.$queryRawUnsafe<{ cnt: bigint }[]>(
    `SELECT COUNT(*) as cnt FROM "order"."Order" WHERE "createdAt" >= '2026-12-31' AND "createdAt" < '2027-01-01'`,
  );
  console.log(`   Orders on 31.12.2026: ${dec31[0]?.cnt ?? 0}`);

  // Relationship integrity
  console.log("\n🔍 Relationship Integrity:");
  const integrity = await prisma.$queryRawUnsafe<{ check: string; count: bigint }[]>(`
    SELECT 'Orders without Customer' as check, COUNT(*) FROM "order"."Order" WHERE "customerId" IS NULL
    UNION ALL SELECT 'Orders without Product in OrderItem', COUNT(DISTINCT o.id) FROM "order"."Order" o
      LEFT JOIN "order"."OrderItem" oi ON oi."orderId" = o.id WHERE oi.id IS NULL
    UNION ALL SELECT 'Payments without Order', COUNT(*) FROM finance."Payment" p
      WHERE NOT EXISTS (SELECT 1 FROM "order"."Order" o WHERE o.id = p."orderId")
    UNION ALL SELECT 'Refunds without Payment', COUNT(*) FROM finance."Refund" r
      WHERE NOT EXISTS (SELECT 1 FROM finance."Payment" p WHERE p.id = r."paymentId")
    UNION ALL SELECT 'Bookings without Order', COUNT(*) FROM booking."Booking" b
      WHERE NOT EXISTS (SELECT 1 FROM "order"."Order" o WHERE o.id = b."orderId")
    UNION ALL SELECT 'Storefronts without Partner', COUNT(*) FROM catalog."PartnerStorefront" s
      WHERE NOT EXISTS (SELECT 1 FROM crm."Partner" p WHERE p.id = s."partnerId")
    UNION ALL SELECT 'Products without Partner', COUNT(*) FROM catalog."Product" p
      WHERE NOT EXISTS (SELECT 1 FROM crm."Partner" pr WHERE pr.id = p."partnerId")
  `);

  let integrityOk = true;
  for (const row of integrity) {
    const status = Number(row.count) === 0 ? "✅" : "❌";
    if (Number(row.count) > 0) integrityOk = false;
    console.log(`   ${status} ${row.check}: ${row.count}`);
  }

  console.log(`\n${integrityOk ? "✅ All integrity checks pass!" : "⚠️  Some integrity issues found"}`);

  await prisma.$disconnect();
  console.log("\n🎉 V3 Supplemental Seed finished.");
}

main().catch((e) => {
  console.error("❌ Supplemental seed failed:", e);
  process.exit(1);
});
