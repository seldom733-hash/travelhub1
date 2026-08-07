/**
 * Событийная модель Order Center (Гл. 6 «Событийная модель»).
 *
 * Паттерн transactional outbox: доменное событие записывается в таблицу
 * OrderEvent в ТОЙ ЖЕ транзакции, что и изменение бизнес-сущности
 * (emitOrderEvent), а после коммита публикуется подписчикам
 * (publishOrderEvents). Событие в outbox гарантирует доставку: при ошибке
 * обработки оно помечается FAILED и может быть обработано повторно.
 *
 * Подписчики регистрируются через onOrderEvent / onAnyOrderEvent.
 * Встроенный подписчик ORDER_SENT_TO_BOOKING реализует команду
 * «Передать в Booking Center» (Гл. 5.4 «Принцип интеграции рабочих центров»):
 * Booking Center автоматически начинает готовить запросы поставщикам.
 */
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";

type Tx = Prisma.TransactionClient;

/** Канонические подписи событий (используются в ленте «Последние события»). */
export const ORDER_EVENT_LABELS: Record<string, string> = {
  ORDER_CREATED: "Заказ создан",
  ORDER_STATUS_CHANGED: "Статус заказа изменён",
  ORDER_READY_FOR_BOOKING: "Заказ готов к бронированию",
  ORDER_SENT_TO_BOOKING: "Передан в Booking Center",
  ORDER_FULFILLED: "Заказ выполнен",
  ORDER_CLOSED: "Заказ закрыт",
  ORDER_CANCELLED: "Заказ отменён",
  ORDER_PROBLEM: "Заказ помечен проблемным",
  ORDER_PAYMENT_RECEIVED: "Получена оплата",
  ORDER_PAYMENT_REFUNDED: "Оформлен возврат",
  BOOKING_REQUESTED: "Запрос на бронирование",
  BOOKING_CREATED: "Бронирование создано",
  BOOKING_STATUS_CHANGED: "Статус бронирования изменён",
  BOOKING_SENT_TO_SUPPLIER: "Запрос отправлен поставщику",
  BOOKING_CONFIRMED: "Бронирование подтверждено",
  BOOKING_REJECTED: "Бронирование отклонено",
  BOOKING_CHANGED: "Бронирование изменено",
  BOOKING_CANCELLED: "Бронирование отменено",
  QUOTE_ACCEPTED: "Предложение принято",
  SALE_COMPLETED: "Сделка завершена",
  ORDER_REQUESTED: "Запрос на создание заказа",
  PAYMENT_CREATED: "Платёж создан",
  PAYMENT_RECEIVED: "Платёж получен",
  PAYMENT_FAILED: "Платёж не прошёл",
  REFUND_REQUESTED: "Запрошен возврат",
  REFUND_COMPLETED: "Возврат выполнен",
  INVOICE_ISSUED: "Счёт выставлен",
};

export const ORDER_EVENT_ICONS: Record<string, string> = {
  ORDER_CREATED: "🆕",
  ORDER_STATUS_CHANGED: "🔄",
  ORDER_READY_FOR_BOOKING: "✅",
  ORDER_SENT_TO_BOOKING: "📤",
  ORDER_FULFILLED: "🎉",
  ORDER_CLOSED: "🔒",
  ORDER_CANCELLED: "🚫",
  ORDER_PROBLEM: "🚨",
  ORDER_PAYMENT_RECEIVED: "💳",
  ORDER_PAYMENT_REFUNDED: "↩️",
  BOOKING_REQUESTED: "📥",
  BOOKING_CREATED: "🆕",
  BOOKING_STATUS_CHANGED: "🔄",
  BOOKING_SENT_TO_SUPPLIER: "📨",
  BOOKING_CONFIRMED: "✅",
  BOOKING_REJECTED: "❌",
  BOOKING_CHANGED: "✏️",
  BOOKING_CANCELLED: "🚫",
  QUOTE_ACCEPTED: "🤝",
  SALE_COMPLETED: "🏆",
  ORDER_REQUESTED: "📥",
  PAYMENT_CREATED: "💳",
  PAYMENT_RECEIVED: "✅",
  PAYMENT_FAILED: "⚠️",
  REFUND_REQUESTED: "↩️",
  REFUND_COMPLETED: "✔️",
  INVOICE_ISSUED: "🧾",
};

export interface OrderEventPayload {
  from?: string;
  to?: string;
  amount?: number;
  paymentStatus?: string;
  bookingId?: string;
  bookingCode?: string;
  priority?: string;
  actor?: string;
  [key: string]: unknown;
}

export interface OrderEventEnvelope {
  id: string;
  orderId: string | null;
  type: string;
  payload: OrderEventPayload | null;
  correlationId: string | null;
  causationId: string | null;
  createdAt: Date;
}

type OrderEventHandler = (event: OrderEventEnvelope) => void | Promise<void>;

const eventHandlers = new Map<string, OrderEventHandler[]>();
const anyHandlers: OrderEventHandler[] = [];

export function onOrderEvent(type: string, handler: OrderEventHandler): void {
  const list = eventHandlers.get(type) ?? [];
  list.push(handler);
  eventHandlers.set(type, list);
}

export function onAnyOrderEvent(handler: OrderEventHandler): void {
  anyHandlers.push(handler);
}

/**
 * Запись события в outbox в рамках переданной транзакции (атомарно с изменением
 * сущности). После коммита транзакции вызовите publishOrderEvents().
 * correlationId — сквозной ID бизнес-процесса (как правило Order.code),
 * causationId — ID события-родителя (трассировка, Baseline §13).
 * orderId опционален: события Sales Center (SALE_COMPLETED, ORDER_REQUESTED)
 * предшествуют созданию Order — привязка через correlationId (sale.code).
 */
export async function emitOrderEvent(
  tx: Tx,
  orderId: string | null,
  type: string,
  payload?: OrderEventPayload,
  meta?: { correlationId?: string; causationId?: string },
): Promise<string> {
  const created = await tx.orderEvent.create({
    data: {
      orderId,
      type: type as never,
      payload: (payload ?? {}) as never,
      correlationId: meta?.correlationId ?? null,
      causationId: meta?.causationId ?? null,
    },
    select: { id: true },
  });
  return created.id;
}

/**
 * Публикация накопившихся PENDING-событий подписчикам. Успешные помечаются
 * PUBLISHED, упавшие — FAILED (сохраняются для повторной публикации).
 * Возвращает количество опубликованных событий.
 */
export async function publishOrderEvents(limit = 200): Promise<number> {
  const pending = await prisma.orderEvent.findMany({
    where: { status: "PENDING" },
    orderBy: { createdAt: "asc" },
    take: limit,
  });
  let published = 0;
  for (const ev of pending) {
    const envelope: OrderEventEnvelope = {
      id: ev.id,
      orderId: ev.orderId,
      type: ev.type,
      payload: (ev.payload as OrderEventPayload | null) ?? null,
      correlationId: ev.correlationId,
      causationId: ev.causationId,
      createdAt: ev.createdAt,
    };
    try {
      const list = eventHandlers.get(ev.type) ?? [];
      for (const handler of [...list, ...anyHandlers]) {
        await handler(envelope);
      }
      await prisma.orderEvent.update({
        where: { id: ev.id },
        data: { status: "PUBLISHED", publishedAt: new Date() },
      });
      published++;
    } catch (err) {
      await prisma.orderEvent.update({
        where: { id: ev.id },
        data: { status: "FAILED", error: String((err as Error).message ?? err) },
      });
    }
  }
  return published;
}

// ── Встроенные подписчики ────────────────────────────────────────────────────

/**
 * Создание Booking — ТОЛЬКО из события BookingRequested (Baseline §9, Phase 1 DoD).
 * Идемпотентный consumer: повторная публикация события не создаёт второй Booking
 * (заказ уже имеет бронирования → пропуск). На основании OrderItems создаются
 * Booking (статус NEW), на основании подтверждённых OrderTraveler — Passenger.
 * Booking создаётся в статусе NEW; последующий ORDER_SENT_TO_BOOKING переводит
 * его в PREPARING_REQUEST («готовится запрос поставщику»).
 */
onOrderEvent("BOOKING_REQUESTED", async (ev) => {
  if (!ev.orderId) return; // события без заказа к Booking Center не относятся
  const order = await prisma.order.findUnique({
    where: { id: ev.orderId },
    include: {
      items: { include: { service: { select: { currency: true } } } },
      travelers: true,
    },
  });
  if (!order) return;
  // Идемпотентность: бронирования уже созданы — повторное событие игнорируется.
  const existing = await prisma.booking.count({ where: { orderId: order.id } });
  if (existing > 0) return;
  if (order.items.length === 0) return;

  const bkRows = await prisma.booking.findMany({ select: { code: true } });
  const existingCodes = new Set(bkRows.map((b) => b.code));
  let seq = 0;
  for (const c of existingCodes) {
    const m = /^BKG-(\d+)$/.exec(c);
    if (m) seq = Math.max(seq, parseInt(m[1], 10));
  }
  const readyTravelers = order.travelers.filter((t) => t.dataCompleteness === "complete");
  const createdIds: string[] = [];
  for (const item of order.items) {
    const code = `BKG-${String(++seq).padStart(8, "0")}`;
    const booking = await prisma.booking.create({
      data: {
        code,
        userId: order.userId,
        serviceId: item.serviceId,
        status: "NEW",
        amount: item.amount,
        serviceDate: item.serviceDate ?? order.serviceDate ?? new Date(),
        orderId: order.id,
      },
      select: { id: true },
    });
    createdIds.push(booking.id);
    await prisma.bookingHistory.create({
      data: {
        bookingId: booking.id,
        action: "created",
        from: null,
        to: "NEW",
        actorId: null,
        actorName: "Система",
        comment: "Бронирование создано consumer-ом BookingRequested (Baseline §9)",
      },
    });
    await prisma.bookingMessage.create({
      data: {
        bookingId: booking.id,
        senderId: null,
        senderName: "Система",
        senderRole: "system",
        text: "🆕 Бронирование создано из состава заказа",
      },
    });
    // Passenger — из подтверждённых OrderTraveler (Baseline §4).
    for (const t of readyTravelers) {
      await prisma.passenger.create({
        data: {
          bookingId: booking.id,
          firstName: t.firstName,
          lastName: t.lastName,
          birthDate: t.birthDate,
          citizenship: t.citizenship,
          gender: t.gender,
          passportNumber: t.passportNumber,
          passportExpiry: t.passportExpiry,
        },
      });
    }
  }
  // Событие-результат (связь по correlationId/causationId).
  await prisma.orderEvent.create({
    data: {
      orderId: order.id,
      type: "BOOKING_CREATED",
      payload: { count: createdIds.length, bookings: createdIds },
      status: "PUBLISHED",
      publishedAt: new Date(),
      correlationId: ev.correlationId ?? order.code,
      causationId: ev.id,
    },
  });
});

/**
 * Команда «Передать в Booking Center» (Гл. 5): при публикации ORDER_SENT_TO_BOOKING
 * Booking Center автоматически подхватывает заказ — бронирования в статусе NEW
 * переводятся в PREPARING_REQUEST («готовится запрос поставщику»). Это иллюстрирует
 * принцип «Передача данных выполняется без участия пользователя» (Гл. 5.4).
 */
onOrderEvent("ORDER_SENT_TO_BOOKING", async (ev) => {
  const bookings = await prisma.booking.findMany({
    where: { orderId: ev.orderId, status: "NEW" },
    select: { id: true, code: true },
  });
  for (const b of bookings) {
    await prisma.booking.update({
      where: { id: b.id },
      data: { status: "PREPARING_REQUEST" },
    });
    await prisma.bookingHistory.create({
      data: {
        bookingId: b.id,
        action: "prepare",
        from: "NEW",
        to: "PREPARING_REQUEST",
        actorId: null,
        actorName: "Система",
        comment: "Заказ передан в Booking Center — готовится запрос поставщику",
      },
    });
    await prisma.bookingMessage.create({
      data: {
        bookingId: b.id,
        senderId: null,
        senderName: "Система",
        senderRole: "system",
        text: "📤 Заказ передан в Booking Center: готовится запрос поставщику",
      },
    });
  }
});

/**
 * Создание Order — ТОЛЬКО из события OrderRequested (Phase 2, Baseline §0.7).
 * Идемпотентный consumer: повторная публикация не создаёт второй Order — при
 * наличии заказа с таким же saleId (correlationId) событие игнорируется.
 * Создаёт ORD-* / TH-YYYY-######, OrderItems из payload, OrderTraveler,
 * публикует ORDER_CREATED (уже с orderId).
 */
onOrderEvent("ORDER_REQUESTED", async (ev) => {
  const p = (ev.payload ?? {}) as {
    saleId?: string;
    customerId?: string;
    customerName?: string;
    currency?: string;
    amount?: number;
    serviceDate?: string;
    source?: string;
    items?: { serviceId: string; title: string; type: string; quantity: number; price: number; amount: number; serviceDate?: string }[];
    travelers?: { firstName: string; lastName: string; birthDate?: string; citizenship?: string; gender?: string; passportNumber?: string }[];
  };

  // Идемпотентность: заказ по этой сделке уже создан (связь Sale↔Order).
  const correlationId = ev.correlationId ?? (p.saleId ? `sale:${p.saleId}` : null);
  if (correlationId && p.saleId) {
    const sale = await prisma.sale.findUnique({
      where: { id: p.saleId },
      select: { orderId: true },
    });
    if (sale?.orderId) return; // заказ уже создан — повторное событие игнорируется
  }
  if (!p.items || p.items.length === 0) return;
  if (!p.customerId) return;

  // Канонические коды: ORD-* (внутренний) и TH-YYYY-###### (пользовательский).
  const orders = await prisma.order.findMany({ select: { code: true, orderNumber: true } });
  let ordSeq = 0;
  for (const o of orders) {
    const m = /^ORD-(\d+)$/.exec(o.code);
    if (m) ordSeq = Math.max(ordSeq, parseInt(m[1], 10));
  }
  let thSeq = 0;
  const year = new Date().getFullYear();
  for (const o of orders) {
    const m = new RegExp(`^TH-${year}-(\\d+)$`).exec(o.orderNumber);
    if (m) thSeq = Math.max(thSeq, parseInt(m[1], 10));
  }
  const code = `ORD-${String(ordSeq + 1).padStart(8, "0")}`;
  const orderNumber = `TH-${year}-${String(1000 + thSeq + 1).padStart(6, "0")}`;
  const amount = p.amount ?? p.items.reduce((a, i) => a + (i.amount ?? i.price * i.quantity), 0);
  const serviceDate = p.serviceDate ? new Date(p.serviceDate) : null;

  const created = await prisma.$transaction(async (tx) => {
    const order = await tx.order.create({
      data: {
        code,
        orderNumber,
        userId: p.customerId as string,
        status: "NEW",
        currency: p.currency ?? "USD",
        amount: Math.round(amount * 100) / 100,
        serviceDate,
        source: p.source ?? "Sales Center",
      },
      select: { id: true },
    });
    for (const item of p.items ?? []) {
      await tx.orderItem.create({
        data: {
          orderId: order.id,
          serviceId: item.serviceId,
          title: item.title,
          type: item.type as never,
          quantity: item.quantity || 1,
          price: item.price,
          currency: p.currency ?? "USD",
          amount: item.amount ?? item.price * (item.quantity || 1),
          serviceDate: item.serviceDate ? new Date(item.serviceDate) : serviceDate,
        },
      });
    }
    for (const t of p.travelers ?? []) {
      await tx.orderTraveler.create({
        data: {
          orderId: order.id,
          customerId: p.customerId as string,
          firstName: t.firstName,
          lastName: t.lastName,
          birthDate: t.birthDate ? new Date(t.birthDate) : null,
          citizenship: t.citizenship ?? null,
          gender: t.gender ?? null,
          passportNumber: t.passportNumber ?? null,
          dataCompleteness: t.passportNumber ? "complete" : "incomplete",
        },
      });
    }
    await tx.orderHistory.create({
      data: {
        orderId: order.id,
        action: "created",
        from: null,
        to: "NEW",
        actorId: null,
        actorName: "Система",
        comment: "Заказ создан consumer-ом OrderRequested (Phase 2)",
      },
    });
    await tx.orderMessage.create({
      data: {
        orderId: order.id,
        senderId: null,
        senderName: "Система",
        senderRole: "system",
        text: "🆕 Заказ создан из завершённой сделки Sales Center",
      },
    });
    // Связь сделки с заказом (Baseline §5: Sales видит Order read-only).
    if (p.saleId) {
      await tx.sale.update({
        where: { id: p.saleId },
        data: { orderId: order.id, status: "WON", closedAt: new Date() },
      });
    }
    // Событие-результат (уже с orderId) + аудит в той же транзакции.
    await tx.orderEvent.create({
      data: {
        orderId: order.id,
        type: "ORDER_CREATED",
        payload: { orderCode: code, orderNumber, amount },
        status: "PUBLISHED",
        publishedAt: new Date(),
        correlationId: ev.correlationId ?? correlationId,
        causationId: ev.id,
      },
    });
    return order;
  });

  // Финансовый след сделки: платёж-ожидание и счёт создаёт Finance; здесь только
  // событие ORDER_CREATED достаточно для трассировки цепочки (тест §12.4–7).
  void created;
});

/** Лента событий: последние события платформы с данными заказа (Гл. 5.3). */
export async function getRecentOrderEvents(limit = 30) {
  const rows = await prisma.orderEvent.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      orderId: true,
      type: true,
      payload: true,
      status: true,
      createdAt: true,
      order: { select: { orderNumber: true, status: true, amount: true } },
    },
  });
  return rows;
}
