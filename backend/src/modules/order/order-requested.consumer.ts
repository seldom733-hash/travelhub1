import { Injectable, OnModuleInit } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { EventBusService, type OutboxEnvelope } from "../../eventbus/eventbus.service";
import { DomainEvents, type OrderRequestedPayload } from "../../eventbus/domain-events";
import { OrderService, assertValidOrderRequestedPayload } from "./order.service";
import { isTravelerRequirementState, TRAVELER_FIELDS } from "../catalog/traveler-requirements";

/** SR R2: полная карта из 7 полей с каноническими состояниями. */
function isFullRequirementsMap(v: unknown): v is Record<string, string> {
  if (typeof v !== "object" || v === null) return false;
  const m = v as Record<string, unknown>;
  return TRAVELER_FIELDS.every((f) => isTravelerRequirementState(m[f]));
}
import { getEffectiveTravelerRequirements } from "../../modules/catalog/traveler-requirements";

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
      const orderCreatedEventId = await this.prisma.$transaction(async (tx) => {
        // Повторная проверка внутри tx: гонка двух доставок — ровно один winner.
        if (await tx.inboxEvent.findUnique({ where: { consumerId_eventId: { consumerId: CONSUMER_ID, eventId: ev.id } } })) {
          return null;
        }

        // READ-only cross-context read (ADR-0001): traveler контекст из
        // Sales-owned CheckoutIntent (payload PII-свободен по контракту; контекст
        // immutable после Sale completion — детерминированный replay).
        const travelers = await tx.checkoutIntentTraveler.findMany({
          where: { checkoutIntentId: payload.checkoutId },
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
          select: { firstName: true, lastName: true, birthDate: true },
        });

        // D3 §3 — PIN traveler requirements at termsAcceptedAt.
        // SR R2: snapshot уже ЗАМОРОЖЕН в payload в момент acceptance (Sale
        // completion, sales-completion.service). Consumer НЕ читает mutable
        // Product на T3 — acceptance→pin race невозможен, replay детерминирован.
        // Legacy payload (до R1/R2, без pinnedRequirements): transitional
        // fallback — вычисляем effective requirements как раньше (по Product).
        const payloadPinned = payload.pinnedRequirements;
        // Canonical path (SR R2): snapshot заморожен в payload в момент acceptance
        // → consumer НЕ читает mutable Product на T3 (race невозможен).
        let pinnedRequirements: Record<string, string>;
        if (isFullRequirementsMap(payloadPinned)) {
          pinnedRequirements = payloadPinned;
        } else {
          // Legacy payload (до R1/R2, без frozen snapshot): transitional fallback —
          // effective requirements по Product (как до SR). Канонический путь
          // (снапшот в payload) Product на T3 НЕ читает.
          const productTypes = payload.items.map(i => i.productType);
          const primaryProductType = productTypes[0] ?? "TOUR";
          const firstProduct = await tx.product.findUnique({
            where: { id: payload.items[0]?.productId ?? "" },
            select: { type: true, travelerRequirements: true },
          }).catch(() => null);
          pinnedRequirements = getEffectiveTravelerRequirements(
            firstProduct?.type ?? primaryProductType,
            firstProduct?.travelerRequirements ?? null,
          );
        }
        // SR R1: реальный acceptance instant (Sale.completedAt), не processing time.
        // Legacy payload без acceptedAt → fallback now() (до R1 события).
        const acceptedAt = payload.acceptedAt ? new Date(payload.acceptedAt) : new Date();

        // Доменная логика создания (OrderService — owner) в той же транзакции.
        // Step 2.17B remediation (Workstream B): OrderCreated эмитится атомарно
        // с Order — сохраняем его id для точечной доставки ниже (publishEvent
        // вместо полного publishPending: не дреним чужой backlog в цепочке).
        const { eventId: orderCreatedEventId } = await this.orders.createOrderFromRequested(tx, {
          payload,
          travelers,
          pinnedRequirements,
          acceptedAt,
          orderRequestedEventId: ev.id,
          correlationId: ev.correlationId,
          causationId: ev.id,
        });

        await tx.inboxEvent.create({ data: { consumerId: CONSUMER_ID, eventId: ev.id } });
        return orderCreatedEventId;
      });

      // Step 2.12E: OrderCreated эмитится PENDING (emit) атомарно с Order;
      // доставка подписчикам (CommissionAccrualConsumer) — сразу после
      // успешного коммита. ПЕРЕД вложенным publishPending помечаем исходное
      // OrderRequested PUBLISHED: иначе вложенный publishPending заново
      // доставил бы его всем обработчикам (внешний цикл ещё держит его
      // PENDING) → задвоение deliveries/attempts. Порядок handler-ов: этот
      // consumer — первый, поэтому OrderCreated уже в ленте к моменту
      // вложенного publishPending. Downstream failure (коррупция snapshot)
      // помечает OrderCreated FAILED внутри publishPending без rethrow —
      // OrderRequested остаётся PUBLISHED.
      await this.prisma.outboxEvent.updateMany({
        where: { id: ev.id, status: "PENDING" },
        data: { status: "PUBLISHED", publishedAt: new Date() },
      });
      // Step 2.17B remediation (Workstream B): точечная доставка OrderCreated
      // (CommissionAccrualConsumer) вместо полного publishPending — вложенная
      // доставка НЕ дренит чужой backlog (гонки/дубликаты при conc 50).
      // null = idempotent no-op (уже обработано другим winner-ом) — публиковать
      // нечего.
      if (orderCreatedEventId) {
        await this.eventBus.publishEvent(orderCreatedEventId);
      }
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
