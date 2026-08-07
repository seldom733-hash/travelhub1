/**
 * Smoke-тест Phase 1 completion (Baseline §3/§4/§9):
 *  1. Бэкфилл: у всех заказов есть OrderItems и OrderTraveler'ы.
 *  2. Событие BOOKING_REQUESTED создаёт Booking (+Passenger) из состава заказа.
 *  3. Повторная публикация события НЕ создаёт дубликат (идемпотентность).
 * Запуск: DATABASE_URL='file:./dev.db' npx tsx scripts/smoke-phase1.ts
 */
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { emitOrderEvent, publishOrderEvents } from "../src/lib/events";
import { nextBusinessCode, orderUserNumber } from "../src/lib/ids";

const adapter = new PrismaBetterSqlite3({ url: process.env.DATABASE_URL || "file:./dev.db" });
const prisma = new PrismaClient({ adapter });

async function main() {
  // 1. Бэкфилл seed
  const [orders, items, travelers] = await Promise.all([
    prisma.order.count(),
    prisma.orderItem.count(),
    prisma.orderTraveler.count(),
  ]);
  console.log(`backfill: orders=${orders} items=${items} travelers=${travelers}`);
  if (items < orders) throw new Error("Не у всех заказов есть OrderItems (бэкфилл)");
  if (travelers < orders) throw new Error("Не у всех заказов есть OrderTraveler (бэкфилл)");

  // 2. Новый заказ (имитация POST /orders: order + items + travelers, без броней)
  const client = await prisma.user.findFirst({ where: { role: "BUYER" } });
  const svc = await prisma.service.findFirst({ where: { isActive: true } });
  if (!client || !svc) throw new Error("Нет клиента/услуги для smoke-теста");
  const rows = await prisma.order.findMany({ select: { code: true, orderNumber: true } });
  const code = nextBusinessCode("ORD", rows.map((r) => r.code));
  const orderNumber = orderUserNumber(new Date().getFullYear(), rows.map((r) => r.orderNumber));
  const order = await prisma.order.create({
    data: {
      code,
      orderNumber,
      userId: client.id,
      status: "NEW",
      paymentStatus: "UNPAID",
      currency: "USD",
      amount: 100,
      serviceDate: new Date(Date.now() + 86400000),
    },
  });
  await prisma.orderItem.create({
    data: {
      orderId: order.id,
      serviceId: svc.id,
      title: svc.title,
      type: svc.type,
      quantity: 1,
      price: 100,
      currency: "USD",
      amount: 100,
      serviceDate: new Date(Date.now() + 86400000),
    },
  });
  await prisma.orderTraveler.create({
    data: {
      orderId: order.id,
      customerId: client.id,
      firstName: "Тест",
      lastName: "Тестов",
      passportNumber: "P1000001",
      dataCompleteness: "complete",
    },
  });

  // 3. «Передать в Booking Center» → BOOKING_REQUESTED → Booking + Passenger
  await prisma.$transaction((tx) =>
    emitOrderEvent(tx, order.id, "BOOKING_REQUESTED", { orderCode: code }, { correlationId: code })
  );
  const published1 = await publishOrderEvents();
  const bookings1 = await prisma.booking.count({ where: { orderId: order.id } });
  const passengers1 = await prisma.passenger.count({ where: { booking: { orderId: order.id } } });
  console.log(`booking-request: published=${published1} bookings=${bookings1} passengers=${passengers1}`);
  if (bookings1 !== 1) throw new Error(`Ожидался ровно 1 Booking, получено ${bookings1}`);
  if (passengers1 !== 1) throw new Error(`Ожидался 1 Passenger из OrderTraveler, получено ${passengers1}`);

  // 4. Идемпотентность: повторное событие не создаёт второй Booking
  await prisma.$transaction((tx) => emitOrderEvent(tx, order.id, "BOOKING_REQUESTED", {}, { correlationId: code }));
  const published2 = await publishOrderEvents();
  const bookings2 = await prisma.booking.count({ where: { orderId: order.id } });
  console.log(`re-publish: published=${published2} bookings=${bookings2}`);
  if (bookings2 !== 1) throw new Error(`Идемпотентность нарушена: ${bookings2} броней`);

  // 5. trace: correlationId/causationId на событиях
  const evs = await prisma.orderEvent.findMany({ where: { orderId: order.id }, orderBy: { createdAt: "asc" } });
  const createdEv = evs.find((e) => e.type === "BOOKING_CREATED");
  if (!createdEv) throw new Error("Нет события BOOKING_CREATED");
  if (createdEv.correlationId !== code) throw new Error("correlationId не проставлен");
  const requestedEv = evs.find((e) => e.type === "BOOKING_REQUESTED");
  if (!requestedEv) throw new Error("Нет события BOOKING_REQUESTED");
  if (createdEv.causationId !== requestedEv.id) throw new Error("causationId не указывает на событие-родителя");

  // cleanup
  await prisma.booking.deleteMany({ where: { orderId: order.id } });
  await prisma.order.delete({ where: { id: order.id } });
  await prisma.$disconnect();
  console.log("SMOKE OK — Phase 1 completion");
}

main().catch((e) => {
  console.error("SMOKE FAIL:", e);
  process.exit(1);
});
