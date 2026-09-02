/**
 * PHASE 3 — PRE-STEP 3.12 — DEV DATABASE CLEAN RESET + REPRESENTATIVE CANONICAL RESEED
 *
 * This script performs a controlled reset of business data in the dev database
 * and re-runs the canonical seed pipeline to produce a consistent, representative dataset.
 *
 * SAFETY:
 * - ONLY works against dev/test databases (name must contain "travelhub1")
 * - Requires ALLOW_DEV_DATABASE_RESET=true environment variable
 * - Does NOT touch migrations, schema, roles, permissions, or system config
 * - Business data is cleaned in dependency order (children before parents)
 *
 * Usage:
 *   ALLOW_DEV_DATABASE_RESET=true npx tsx prisma/reset-and-reseed.ts
 */

import "dotenv/config";
import { PrismaClient, Prisma } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const DB_URL = process.env.DATABASE_URL;
if (!DB_URL) {
  console.error("❌ DATABASE_URL is required");
  process.exit(1);
}

// Safety guard
if (!DB_URL.includes("travelhub1")) {
  console.error(`❌ Target database URL must contain 'travelhub1'. Got: ${DB_URL.replace(/:[^@]+@/, ':***@')}`);
  process.exit(1);
}
if (process.env.ALLOW_DEV_DATABASE_RESET !== "true") {
  console.error("❌ Set ALLOW_DEV_DATABASE_RESET=true to proceed with destructive reset");
  process.exit(1);
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: DB_URL }),
});

// ── Step 1: Count before ───────────────────────────────────────────────

async function countBefore(): Promise<Record<string, number>> {
  const tables = [
    ["Request", prisma.request],
    ["Order", prisma.order],
    ["OrderItem", prisma.orderItem],
    ["OrderTraveler", prisma.orderTraveler],
    ["Booking", prisma.booking],
    ["Passenger", prisma.passenger],
    ["Payment", prisma.payment],
    ["Refund", prisma.refund],
    ["Commission", prisma.commission],
    ["Customer", prisma.customer],
    ["Partner", prisma.partner],
    ["Product", prisma.product],
    ["ProductPublicationChannel", prisma.productPublicationChannel],
    ["PartnerStorefront", prisma.partnerStorefront],
    ["StorefrontSubscription", prisma.storefrontSubscription],
    ["Contact", prisma.contact],
    ["User", prisma.user],
  ] as const;

  const counts: Record<string, number> = {};
  for (const [name, model] of tables) {
    try {
      counts[name] = await (model as any).count();
    } catch {
      counts[name] = -1; // table might not exist
    }
  }
  return counts;
}

// ── Step 2: Delete business data in dependency order ───────────────────

async function cleanBusinessData() {
  console.log("\n🧹 Cleaning business data...");

  // Aggressive raw SQL cleanup — delete ALL business data in correct order
  console.log("  Cleaning all business tables via raw SQL...");

  const cleanupSQL = [
    // History tables
    `DELETE FROM "order"."RequestHistory"`,
    `DELETE FROM "order"."OrderHistory"`,
    `DELETE FROM "order"."OrderItem"`,
    `DELETE FROM "order"."OrderTraveler"`,
    `DELETE FROM booking."BookingHistory"`,
    `DELETE FROM booking."Passenger"`,
    `DELETE FROM finance."PaymentHistory"`,
    `DELETE FROM finance."RefundHistory"`,
    `DELETE FROM finance."Refund"`,
    `DELETE FROM finance."Payment"`,
    `DELETE FROM finance."Commission"`,
    `DELETE FROM finance."CommissionAccrual"`,
    `DELETE FROM booking."Booking"`,
    `DELETE FROM "order"."Request"`,
    `DELETE FROM "order"."Order"`,
    `DELETE FROM catalog."StorefrontSubscription"`,
    `DELETE FROM catalog."PartnerStorefront"`,
    `DELETE FROM catalog."ProductPublicationChannel"`,
    `DELETE FROM catalog."ProductMedia"`,
    `DELETE FROM catalog."ProductDraft"`,
    `DELETE FROM catalog."ProductHistory"`,
    `DELETE FROM catalog."Product"`,
    `DELETE FROM crm."Contact"`,
    `DELETE FROM crm."CrmActivity"`,
    `DELETE FROM crm."OperationalNote"`,
    `DELETE FROM crm."CustomerHistory"`,
    `DELETE FROM crm."Customer"`,
    `DELETE FROM crm."PartnerCustomerRelation"`,
    `DELETE FROM crm."PartnerCustomerRelationHistory"`,
    `DELETE FROM crm."Partner"`,
    `DELETE FROM catalog."CategorySchema"`,
    `DELETE FROM catalog."Category"`,
    `DELETE FROM catalog."StorefrontSubscriptionPlan"`,
    `DELETE FROM events."OutboxEvent"`,
    `DELETE FROM marketing."Campaign"`,
    `DELETE FROM marketing."Audience"`,
    `DELETE FROM support."Case"`,
    `DELETE FROM communication."Conversation"`,
    `DELETE FROM communication."Message"`,
    `DELETE FROM sales."Lead"`,
    `DELETE FROM sales."Opportunity"`,
    `DELETE FROM sales."Quote"`,
    `DELETE FROM sales."Sale"`,
  ];

  for (const sql of cleanupSQL) {
    try {
      await prisma.$executeRawUnsafe(sql);
    } catch (e: any) {
      // Table might not exist — that's OK
      if (!e.message.includes("does not exist") && !e.message.includes("does not correspond")) {
        console.log(`    WARN: ${sql.slice(0, 50)}... → ${e.message.slice(0, 60)}`);
      }
    }
  }

  console.log("  ✅ Business data cleaned");
}

// ── Step 3: Run canonical seed ────────────────────────────────────────

async function runCommand(label: string, cmd: string) {
  console.log(`\n🌱 ${label}...`);
  const { execSync } = require("child_process");
  try {
    execSync(cmd, { stdio: "inherit", cwd: process.cwd(), timeout: 300_000 });
    console.log(`  ✅ ${label} completed`);
  } catch (e: any) {
    console.error(`  ❌ ${label} failed: ${e.message.slice(0, 200)}`);
    throw e;
  }
}

async function runCanonicalSeed() {
  await runCommand("Running canonical demo-seed.ts",
    "npx tsx src/seed/demo-seed.ts");
}

async function runRequestSeed() {
  await runCommand("Running seed-requests.ts",
    "npx tsx prisma/seed-requests.ts");
}

// ── Step 4: Verify invariants ─────────────────────────────────────────

async function verifyInvariants() {
  console.log("\n🔍 Verifying hard invariants...");

  let pass = 0;
  let fail = 0;

  const check = async (label: string, sql: string) => {
    try {
      const result = await prisma.$queryRawUnsafe(sql);
      const count = Number((result as any)[0]?.count ?? 0);
      if (count === 0) {
        pass++;
        console.log(`  ✅ ${label} = 0`);
      } else {
        fail++;
        console.log(`  ❌ ${label} = ${count}`);
      }
    } catch (e: any) {
      fail++;
      console.log(`  ❌ ${label}: ERROR - ${e.message.slice(0, 60)}`);
    }
  };

  // Reference width checks
  await check("Legacy 6-digit Order refs",
    `SELECT count(*) as count FROM "order"."Order" WHERE "referenceNumber" IS NOT NULL AND length("referenceNumber") = 14 AND "referenceNumber" LIKE 'MKT-ORD-%'`);

  await check("Legacy 6-digit Refund refs",
    `SELECT count(*) as count FROM "finance"."Refund" WHERE "referenceNumber" IS NOT NULL AND length("referenceNumber") = 14 AND "referenceNumber" LIKE 'MKT-REF-%'`);

  // Duplicate references
  await check("Duplicate Request references",
    `SELECT count(*) as count FROM (SELECT "referenceNumber" FROM "order"."Request" WHERE "referenceNumber" IS NOT NULL GROUP BY "referenceNumber" HAVING count(*) > 1) t`);

  await check("Duplicate Order references",
    `SELECT count(*) as count FROM (SELECT "referenceNumber" FROM "order"."Order" WHERE "referenceNumber" IS NOT NULL GROUP BY "referenceNumber" HAVING count(*) > 1) t`);

  await check("Duplicate Booking references",
    `SELECT count(*) as count FROM (SELECT "referenceNumber" FROM "booking"."Booking" WHERE "referenceNumber" IS NOT NULL GROUP BY "referenceNumber" HAVING count(*) > 1) t`);

  // Temporal integrity
  await check("Booking before Order (1h+ anomaly)",
    `SELECT count(*) as count FROM "order"."Order" o JOIN "booking"."Booking" b ON b."orderId" = o.id WHERE b."createdAt" < o."createdAt" - interval '1 hour'`);

  await check("COMPLETED without completedAt",
    `SELECT count(*) as count FROM "booking"."Booking" WHERE "status" = 'COMPLETED' AND "completedAt" IS NULL`);

  // Currency integrity
  await check("Order/Payment currency mismatch",
    `SELECT count(*) as count FROM "order"."Order" o JOIN "finance"."Payment" p ON p."orderId" = o.id WHERE o."currency" != p."currency"`);

  // Broken Request→Order links
  await check("Request convertedOrderId points to missing Order",
    `SELECT count(*) as count FROM "order"."Request" r WHERE r."convertedOrderId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "order"."Order" o WHERE o.id = r."convertedOrderId")`);

  console.log(`\n  Results: ${pass} passed, ${fail} failed`);
  return fail === 0;
}

// ── Main ──────────────────────────────────────────────────────────────

async function main() {
  console.log("═══════════════════════════════════════════════════");
  console.log("  DEV DATABASE CLEAN RESET + CANONICAL RESEED");
  console.log("═══════════════════════════════════════════════════");
  console.log(`Target: ${DB_URL!.replace(/:[^@]+@/, ':***@')}`);
  console.log(`Guard: ALLOW_DEV_DATABASE_RESET=${process.env.ALLOW_DEV_DATABASE_RESET}`);

  const startTime = Date.now();

  try {
    // 1. Count before
    console.log("\n📊 Database counts BEFORE reset:");
    const before = await countBefore();
    for (const [name, count] of Object.entries(before)) {
      if (count >= 0) console.log(`  ${name}: ${count}`);
    }

    // 2. Clean business data
    await cleanBusinessData();

    // 3. Run canonical seed (demo-seed.ts)
    await runCanonicalSeed();

    // 4. Run request seed (seed-requests.ts)
    await runRequestSeed();

    // 5. Verify invariants
    const invariantResult = await verifyInvariants();

    // 6. Count after
    console.log("\n📊 Database counts AFTER reseed:");
    const after = await countBefore();
    for (const [name, count] of Object.entries(after)) {
      if (count >= 0) console.log(`  ${name}: ${count}`);
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\n═══════════════════════════════════════════════════`);
    if (invariantResult) {
      console.log(`✅ Reset + Reseed completed in ${elapsed}s — ALL INVARIANTS PASS`);
    } else {
      console.log(`⚠️  Reset + Reseed completed in ${elapsed}s — SOME INVARIANTS FAILED`);
    }
    console.log(`═══════════════════════════════════════════════════`);

  } catch (error) {
    console.error("\n❌ Reset failed:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
