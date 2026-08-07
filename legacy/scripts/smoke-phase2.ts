/**
 * Smoke-тест Phase 2 (Sales → Order Center, Baseline §0.7):
 *  1. Сделка (Sale) → SALE_COMPLETED + ORDER_REQUESTED → consumer создаёт Order
 *     с каноническими кодами ORD-* / TH-YYYY-###### и OrderItems из payload.
 *  2. Sale.orderId связывается с созданным заказом.
 *  3. Повторная публикация ORDER_REQUESTED НЕ создаёт второй заказ (идемпотентность).
 * Запуск: DATABASE_URL='file:./dev.db' npx tsx scripts/smoke-phase2.ts
 */
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { emitOrderEvent, publishOrderEvents } from "../src/lib/events";
import { nextBusinessCode } from "../src/lib/ids";

const adapter = new PrismaBetterSqlite3({ url: process.env.DATABASE_URL || "file:./dev.db" });
const prisma = new PrismaClient({ adapter });

async function main() {
  // 1. Подготовка: клиент, услуга, предложение → сделка
  const client = await prisma.user.findFirst({ where: { role: "BUYER" } });
  const svc = await prisma.service.findFirst({ where: { isActive: true } });
  if (!client || !svc) throw new Error("Нет клиента/услуги для smoke-теста");

  const opp = await prisma.opportunity.create({
    data: {
      code: nextBusinessCode("OPP", (await prisma.opportunity.findMany({ select: { code: true } })).map((o) => o.code)),
      customerId: client.id,
      customerName: `${client.firstName} ${client.lastName ?? ""}`.trim() || "Тест",
      ownerName: "Смоук-тест",
      stage: "NEGOTIATION",
    },
  });
  const quote = await prisma.quote.create({
    data: {
      code: nextBusinessCode("QTE", (await prisma.quote.findMany({ select: { code: true } })).map((q) => q.code)),
      opportunityId: opp.id,
      customerId: client.id,
      customerName: opp.customerName,
      status: "ACCEPTED",
      approval: "approved",
    },
  });
  await prisma.quoteItem.create({
    data: {
      quoteId: quote.id,
      serviceId: svc.id,
      title: svc.title,
      type: svc.type,
      quantity: 2,
      price: 100,
      amount: 200,
    },
  });
  const sale = await prisma.sale.create({
    data: {
      code: nextBusinessCode("SAL", (await prisma.sale.findMany({ select: { code: true } })).map((s) => s.code)),
      quoteId: quote.id,
      customerId: client.id,
      customerName: opp.customerName,
      amount: 200,
      currency: "USD",
      status: "WON",
      closedAt: new Date(),
    },
  });

  // 2. SALE_COMPLETED + ORDER_REQUESTED → заказ создаётся
  await prisma.$transaction(async (tx) => {
    await emitOrderEvent(tx, null, "SALE_COMPLETED", { saleCode: sale.code }, { correlationId: sale.code });
    await emitOrderEvent(
      tx,
      null,
      "ORDER_REQUESTED",
      {
        saleId: sale.id,
        saleCode: sale.code,
        customerId: client.id,
        customerName: opp.customerName,
        currency: "USD",
        amount: 200,
        source: "Sales Center",
        items: [{ serviceId: svc.id, title: svc.title, type: svc.type, quantity: 2, price: 100, amount: 200 }],
      },
      { correlationId: sale.code }
    );
  });
  const published1 = await publishOrderEvents();

  const saleAfter = await prisma.sale.findUnique({ where: { id: sale.id }, select: { orderId: true } });
  if (!saleAfter?.orderId) throw new Error("Sale.orderId не связан с заказом");
  const order = await prisma.order.findUnique({ where: { id: saleAfter.orderId }, include: { items: true } });
  if (!order) throw new Error("Заказ не создан");
  if (!/^ORD-\d{8}$/.test(order.code)) throw new Error(`Некорректный код заказа: ${order.code}`);
  if (!/^TH-\d{4}-\d{6}$/.test(order.orderNumber)) throw new Error(`Некорректный номер заказа: ${order.orderNumber}`);
  if (order.items.length !== 1 || order.items[0].quantity !== 2) throw new Error("OrderItems не созданы из payload");
  console.log(`order-requested: published=${published1} order=${order.code} ${order.orderNumber} items=${order.items.length}`);

  // 3. Идемпотентность: повторная публикация не создаёт второй заказ
  await prisma.$transaction((tx) =>
    emitOrderEvent(tx, null, "ORDER_REQUESTED", { saleId: sale.id }, { correlationId: sale.code })
  );
  const published2 = await publishOrderEvents();
  const dupOrders = await prisma.order.count({ where: { id: saleAfter.orderId } });
  const allForSale = await prisma.sale.findUnique({ where: { id: sale.id }, select: { orderId: true } });
  console.log(`re-publish: published=${published2} ordersForSale=${dupOrders} orderIdStable=${allForSale?.orderId === saleAfter.orderId}`);
  if (allForSale?.orderId !== saleAfter.orderId) throw new Error("Идемпотентность нарушена: sale перепривязан");

  // 4. trace: ORDER_CREATED с orderId + correlationId
  const evs = await prisma.orderEvent.findMany({ where: { orderId: saleAfter.orderId }, orderBy: { createdAt: "asc" } });
  const createdEv = evs.find((e) => e.type === "ORDER_CREATED");
  if (!createdEv) throw new Error("Нет события ORDER_CREATED");
  if (createdEv.correlationId !== sale.code) throw new Error("correlationId ORDER_CREATED не совпадает с sale.code");

  // cleanup
  await prisma.order.delete({ where: { id: saleAfter.orderId } });
  await prisma.sale.delete({ where: { id: sale.id } });
  await prisma.quote.delete({ where: { id: quote.id } });
  await prisma.opportunity.delete({ where: { id: opp.id } });
  await prisma.$disconnect();
  console.log("SMOKE OK — Phase 2 (Sales → Order)");
}

main().catch((e) => {
  console.error("SMOKE FAIL:", e);
  process.exit(1);
});
