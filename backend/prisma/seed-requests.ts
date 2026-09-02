/**
 * Historical Request Data Generation
 * 
 * Creates realistic Request records for existing Marketplace commerce chains.
 * Temporal invariant: Request.createdAt <= Order.createdAt <= Booking.createdAt
 * 
 * Run: npx tsx prisma/seed-requests.ts
 */
import * as dotenv from "dotenv";
import * as path from "path";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

const dbUrl = process.env.DATABASE_URL!;
const adapter = new PrismaPg({ connectionString: dbUrl });
const prisma = new PrismaClient({ adapter });

// Randomized offset range (1-6 hours before order)
function randomOffsetHours(): number {
  return 1 + Math.random() * 5;
}

async function main() {
  console.log("=== Historical Request Data Generation ===\n");

  // Get all Marketplace orders
  const orders = await prisma.order.findMany({
    where: {
      referenceNumber: { startsWith: "MKT-ORD-" },
    },
    select: {
      id: true,
      referenceNumber: true,
      commerceSequence: true,
      customerId: true,
      sellerPartnerId: true,
      currency: true,
      serviceDate: true,
      createdAt: true,
      acquisitionSource: true,
      items: { select: { productId: true, amount: true, currency: true }, take: 1 },
    },
    orderBy: { createdAt: "asc" },
  });

  console.log(`Found ${orders.length} Marketplace orders`);

  // Status distribution
  const statusDistribution = [
    { status: "CONVERTED", weight: 0.65 },
    { status: "REJECTED", weight: 0.10 },
    { status: "UNAVAILABLE", weight: 0.08 },
    { status: "SUPPLIER_TIMEOUT", weight: 0.07 },
    { status: "PRICE_CHANGED", weight: 0.05 },
    { status: "CUSTOMER_PAYMENT_TIMEOUT", weight: 0.05 },
  ];

  function pickStatus(): string {
    const r = Math.random();
    let cumulative = 0;
    for (const s of statusDistribution) {
      cumulative += s.weight;
      if (r <= cumulative) return s.status;
    }
    return "CONVERTED";
  }

  let counts: Record<string, number> = {};
  let skipped = 0;

  for (const order of orders) {
    const cs = order.commerceSequence;
    if (!cs) continue;

    const orderCreatedAt = new Date(order.createdAt);
    const firstItem = order.items[0];
    if (!firstItem) continue;

    const requestedServiceDate = order.serviceDate
      ? new Date(order.serviceDate)
      : new Date(orderCreatedAt.getTime() + 7 * 24 * 60 * 60 * 1000);

    const requestCreatedAt = new Date(
      orderCreatedAt.getTime() - randomOffsetHours() * 60 * 60 * 1000
    );

    const displayedPrice = firstItem.amount;
    const displayedCurrency = firstItem.currency || order.currency;

    const status = pickStatus();
    const supplierResponseDeadline = new Date(
      requestCreatedAt.getTime() + 24 * 60 * 60 * 1000
    );

    let data: any = {
      code: `REQ-${cs}`,
      commerceSequence: cs,
      referenceNumber: `MKT-REQ-${cs}`,
      customerId: order.customerId,
      productId: firstItem.productId,
      partnerId: order.sellerPartnerId,
      status,
      requestedServiceDate,
      quantity: 1,
      displayedPrice,
      displayedCurrency,
      supplierResponseDeadline,
      createdAt: requestCreatedAt,
      updatedAt: requestCreatedAt,
    };

    switch (status) {
      case "CONVERTED": {
        const supplierRespondedAt = new Date(
          requestCreatedAt.getTime() + (1 + Math.random() * 20) * 60 * 60 * 1000
        );
        const customerDeadline = new Date(supplierRespondedAt.getTime() + 48 * 60 * 60 * 1000);
        const customerAcceptedAt = new Date(supplierRespondedAt.getTime() + (1 + Math.random() * 10) * 60 * 60 * 1000);
        // Ensure customerAcceptedAt < Order.createdAt (temporal invariant)
        const finalAcceptedAt = customerAcceptedAt < orderCreatedAt ? customerAcceptedAt : new Date(orderCreatedAt.getTime() - 60 * 60 * 1000);
        data.supplierRespondedAt = supplierRespondedAt;
        data.supplierDecision = "CONFIRMED";
        data.confirmedPrice = displayedPrice;
        data.confirmedCurrency = displayedCurrency;
        data.customerActionDeadline = customerDeadline;
        data.customerAcceptedAt = finalAcceptedAt;
        data.customerDecision = "ACCEPTED";
        data.convertedOrderId = order.id;
        data.convertedAt = orderCreatedAt;
        break;
      }
      case "REJECTED": {
        const t = new Date(requestCreatedAt.getTime() + (1 + Math.random() * 15) * 60 * 60 * 1000);
        data.supplierRespondedAt = t;
        data.supplierDecision = "REJECTED";
        data.rejectedAt = t;
        data.rejectedBy = "supplier";
        data.rejectionReason = "Не удалось подтвердить availability";
        break;
      }
      case "UNAVAILABLE": {
        const t = new Date(requestCreatedAt.getTime() + (1 + Math.random() * 12) * 60 * 60 * 1000);
        data.supplierRespondedAt = t;
        data.supplierDecision = "UNAVAILABLE";
        data.rejectedAt = t;
        data.rejectedBy = "supplier";
        data.rejectionReason = "Услуга недоступна на запрошенную дату";
        break;
      }
      case "SUPPLIER_TIMEOUT": {
        data.rejectedAt = supplierResponseDeadline;
        data.rejectedBy = "system";
        data.rejectionReason = "Поставщик не ответил вовремя";
        break;
      }
      case "PRICE_CHANGED": {
        const t = new Date(requestCreatedAt.getTime() + (2 + Math.random() * 10) * 60 * 60 * 1000);
        const cd = new Date(t.getTime() + 48 * 60 * 60 * 1000);
        const np = Number(displayedPrice) * (1 + Math.random() * 0.2);
        data.supplierRespondedAt = t;
        data.supplierDecision = "PRICE_CHANGED";
        data.supplierPriceProposal = Math.round(np * 100) / 100;
        data.customerActionDeadline = cd;
        data.rejectedAt = cd;
        data.rejectedBy = "system";
        data.rejectionReason = "Клиент не ответил на изменение цены";
        break;
      }
      case "CUSTOMER_PAYMENT_TIMEOUT": {
        const t = new Date(requestCreatedAt.getTime() + (1 + Math.random() * 15) * 60 * 60 * 1000);
        const cd = new Date(t.getTime() + 48 * 60 * 60 * 1000);
        data.supplierRespondedAt = t;
        data.supplierDecision = "CONFIRMED";
        data.confirmedPrice = displayedPrice;
        data.confirmedCurrency = displayedCurrency;
        data.customerActionDeadline = cd;
        data.rejectedAt = cd;
        data.rejectedBy = "system";
        data.rejectionReason = "Клиент не завершил оплату вовремя";
        break;
      }
    }

    try {
      await prisma.request.create({ data });
      counts[status] = (counts[status] ?? 0) + 1;
    } catch (err: any) {
      if (err.code === "P2002") { skipped++; continue; }
      throw err;
    }
  }

  // Add extra NEW/CHECKING requests for realism
  let extraCreated = 0;
  const extraCount = Math.floor(orders.length * 0.08);
  for (let i = 0; i < extraCount; i++) {
    const cs = String(9000000 + i).padStart(8, "0");
    const requestCreatedAt = new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000);
    try {
      await prisma.request.create({
        data: {
          code: `REQ-${cs}`,
          commerceSequence: cs,
          referenceNumber: `MKT-REQ-${cs}`,
          status: Math.random() > 0.5 ? "NEW" : "CHECKING",
          requestedServiceDate: new Date(requestCreatedAt.getTime() + 14 * 24 * 60 * 60 * 1000),
          quantity: 1,
          displayedPrice: Math.round((100 + Math.random() * 500) * 100) / 100,
          displayedCurrency: "AZN",
          supplierResponseDeadline: new Date(requestCreatedAt.getTime() + 24 * 60 * 60 * 1000),
          createdAt: requestCreatedAt,
          updatedAt: requestCreatedAt,
        },
      });
      extraCreated++;
    } catch (err: any) {
      if (err.code === "P2002") continue;
      throw err;
    }
  }

  console.log("\n=== Results ===");
  for (const [k, v] of Object.entries(counts)) {
    console.log(`  ${k}: ${v}`);
  }
  console.log(`  NEW/CHECKING (extra): ${extraCreated}`);
  console.log(`  Skipped (duplicate):  ${skipped}`);
  const total = Object.values(counts).reduce((a, b) => a + b, 0) + extraCreated;
  console.log(`  Total: ${total}`);

  await prisma.$disconnect();
}

main().catch((err) => { console.error(err); process.exit(1); });
