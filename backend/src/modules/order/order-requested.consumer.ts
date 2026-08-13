import { Injectable, OnModuleInit } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { EventBusService, type OutboxEnvelope } from "../../eventbus/eventbus.service";
import { DomainEvents, type OrderRequestedPayload } from "../../eventbus/domain-events";
import { OrderService, assertValidOrderRequestedPayload } from "./order.service";

const CONSUMER_ID = "order-requested-consumer";

/**
 * Step 2.5 — Order Creation Consumer (canonical OrderRequested → Order).
 *
 * Владелец Order — Order Center (ADR-0001): consumer создаёт Order/OrderItems/
 * OrderTraveler/Fulfillment + OrderCreated строго через OrderService (доменную
 * логику). Step 2.6: это ЕДИНСТВЕННЫЙ путь создания нормального Order —
 * HTTP bootstrap-путь удалён.
 *
 * Идемпотентность — тройная защита:
 *  1. events.InboxEvent (unique consumerId+eventId) — стандартный dedup;
 *  2. domain-level инвариант Order.saleId @unique (один Sale → один Order,
 *     DB-level — корректность не зависит только от in-process пути);
 *  3. P2002 обрабатывается КОНСТРЕЙНТ-специфично (STRICT REVIEW 2.5): no-op
 *     только для известных idempotency-unique (inbox consumerId+eventId,
 *     Order.saleId); любой ДРУГОЙ unique-дефект пробрасывается наружу (FAILED,
 *     а не ложный success).
 *
 * Cross-context read (READ-only, ADR-0001):
 *  - checkoutIntentTraveler (sales.*) — canonical traveler контекст (payload
 *    НЕ несёт PII; Step 2.4 §5; immutable после Sale completion —
 *    assertCheckoutNotCompleted блокирует мутации → детерминированный replay).
 *  ПРОЧИЕ факты — из frozen payload (productType/reservationIds/…): никакого
 *  чтения mutable Catalog state для создания Order.
 *
 * Availability: НЕ резервируется повторно (Step 2.4 уже сделал capacity hold);
 * Order сохраняет reservationId + reservationIds (все holds). Booking/Payment/
 * BookingRequested — НЕ создаются (Steps 2.7/2.8).
 */
@Injectable()
export class OrderRequestedConsumer implements OnModuleInit {
  constructor(
    private readonly eventBus: EventBusService,
    private readonly prisma: PrismaService,
    private readonly orders: OrderService,
  ) {}

  onModuleInit(): void {
    this.eventBus.on(DomainEvents.OrderRequested, (ev) => this.onOrderRequested(ev));
  }

  private async onOrderRequested(ev: OutboxEnvelope): Promise<void> {
    // Строгая валидация ДО транзакции/reads: malformed/unsupported payload не
    // создаёт Order (→ исключение → событие FAILED, retryable; без partial
    // state и без бесполезных cross-context reads).
    const payload = ev.payload as unknown as OrderRequestedPayload;
    assertValidOrderRequestedPayload(payload);

    if (await this.eventBus.isProcessed(CONSUMER_ID, ev.id)) return;

    try {
      await this.prisma.$transaction(async (tx) => {
        // Повторная проверка внутри tx: гонка двух доставок — ровно один winner.
        if (await tx.inboxEvent.findUnique({ where: { consumerId_eventId: { consumerId: CONSUMER_ID, eventId: ev.id } } })) {
          return;
        }

        // READ-only cross-context read (ADR-0001): traveler контекст из
        // Sales-owned CheckoutIntent (payload PII-свободен по контракту; контекст
        // immutable после Sale completion — детерминированный replay).
        const travelers = await tx.checkoutIntentTraveler.findMany({
          where: { checkoutIntentId: payload.checkoutId },
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
          select: { firstName: true, lastName: true, birthDate: true },
        });

        // Доменная логика создания (OrderService — owner) в той же транзакции.
        await this.orders.createOrderFromRequested(tx, {
          payload,
          travelers,
          orderRequestedEventId: ev.id,
          correlationId: ev.correlationId,
          causationId: ev.id,
        });

        await tx.inboxEvent.create({ data: { consumerId: CONSUMER_ID, eventId: ev.id } });
      });
    } catch (err) {
      // STRICT REVIEW 2.5: P2002 = no-op ТОЛЬКО для idempotency-unique
      // (inbox consumerId+eventId, Order.saleId). Любой другой unique-коллизии
      // (code/number/… — настоящий дефект) пробрасываются → событие FAILED,
      // а не ложный «уже обработано».
      if (this.isIdempotencyUniqueViolation(err)) return;
      throw err;
    }
  }

  /** P2002 именно по idempotency-constraint-ам (по meta.target, не глобально). */
  private isIdempotencyUniqueViolation(err: unknown): boolean {
    if (typeof err !== "object" || err === null) return false;
    const e = err as { code?: string; meta?: { target?: unknown } };
    if (e.code !== "P2002") return false;
    const target = Array.isArray(e.meta?.target) ? (e.meta.target as string[]) : [];
    if (target.includes("saleId")) return true; // Order_saleId_key (один Sale → один Order)
    // Inbox unique: consumerId+eventId (обязательно оба — не путать с др. unique).
    return target.includes("consumerId") && target.includes("eventId");
  }
}
