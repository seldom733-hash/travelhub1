import { Injectable, OnModuleInit } from "@nestjs/common";
import type { BookingStatus } from "../../generated/prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { EventBusService, type OutboxEnvelope } from "../../eventbus/eventbus.service";
import { DomainEvents, type BookingEventPayload, type BookingRequestedPayload, type OrderRefPayload } from "../../eventbus/domain-events";
import { IdsService } from "../../shared/ids.service";
import { ReferenceNumberService } from "../../shared/reference-number.service";
import { uniqueConstraintNames } from "../../shared/prisma-errors";
import { deriveServiceEndsAt, deriveServiceStartsAt, deriveServiceTimeType } from "../../shared/service-time";
// Step 2.11: canonical frozen money fact validation (платформенный денежный
// контракт DECIMAL(12,2)/half-up — single source of truth, как finance.money).
import { validateFrozenMoneyFact } from "../sales/sales.money";

const CONSUMER_ID = "booking-requested-consumer";
const ORDER_CANCELLED_CONSUMER_ID = "booking-order-cancelled-consumer";

/** Step 2.9: активные (cancel-able) статусы — терминальные (COMPLETED,
 *  SUPPLIER_REJECTED, CANCELLED) не перезаписываются компенсацией. */
const BOOKING_ACTIVE: BookingStatus[] = [
  "NEW",
  "PREPARING_REQUEST",
  "SENT_TO_SUPPLIER",
  "AWAITING_CONFIRMATION",
  "CONFIRMED",
  "IN_SERVICE",
  "NEEDS_CLARIFICATION",
  "CHANGE_REQUESTED",
  "CANCELLATION_REQUESTED",
  "PROBLEM",
];

/**
 * Подписчик Booking Center на событие Order: BookingRequested.
 *
 * Booking создаётся ТОЛЬКО из этого события (Baseline §9, Phase 1 DoD):
 *  - на каждый OrderItem создаётся Booking (BKG-*, статус NEW);
 *  - Passenger создаётся из подтверждённых (COMPLETE) OrderTraveler;
 *  - результат фиксируется событием BookingCreated (лента, causationId → BookingRequested).
 *
 * Идемпотентность: events.InboxEvent + проверка существующих броней заказа.
 * Consumer НЕ пишет в таблицы order.* — только читает их (READ-only).
 *
 * Step 2.9 §15 (compensation, гонка Order-cancel vs Booking-create): если на
 * момент создания Order уже CANCELLED (OrderCancelled обработан раньше
 * BookingRequested), Booking создаётся СРАЗУ в терминальном компенсированном
 * состоянии CANCELLED (история `created_cancelled`, БЕЗ BookingCancelled —
 * перехода не было, Booking никогда не была активной). Никакого delete,
 * никакой silent-инконсистентности (invariant: активный Order может иметь
 * неактивные брони, но Booking активной при CANCELLED Order не бывает).
 */
@Injectable()
export class BookingSubscribers implements OnModuleInit {
  constructor(
    private readonly eventBus: EventBusService,
    private readonly prisma: PrismaService,
    private readonly ids: IdsService,
    private readonly refNum: ReferenceNumberService,
  ) {}

  onModuleInit(): void {
    this.eventBus.on(DomainEvents.BookingRequested, (ev) => this.onBookingRequested(ev));
    this.eventBus.on(DomainEvents.OrderCancelled, (ev) => this.onOrderCancelled(ev));
  }

  private async onBookingRequested(ev: OutboxEnvelope): Promise<void> {
    const p = ev.payload as unknown as BookingRequestedPayload;
    if (!p?.orderId) return;
    if (await this.eventBus.isProcessed(CONSUMER_ID, ev.id)) return;

    try {
      await this.prisma.$transaction(async (tx) => {
        if (await tx.inboxEvent.findUnique({ where: { consumerId_eventId: { consumerId: CONSUMER_ID, eventId: ev.id } } })) return;

        // Чтение состава заказа (READ-only, таблицы order.*).
        const order = await tx.order.findUnique({
          where: { id: p.orderId },
          include: { items: true, travelers: true },
        });
        if (!order || order.items.length === 0) {
          await tx.inboxEvent.create({ data: { consumerId: CONSUMER_ID, eventId: ev.id } });
          return;
        }

        // Защита от дублей (дополнительно к inbox): брони уже созданы — пропуск.
        const existing = await tx.booking.count({ where: { orderId: order.id } });
        if (existing > 0) {
          await tx.inboxEvent.create({ data: { consumerId: CONSUMER_ID, eventId: ev.id } });
          return;
        }

        const readyTravelers = order.travelers.filter((t) => t.dataCompleteness === "COMPLETE");
        const created: { id: string; code: string }[] = [];

        // Step 2.11: defensive consistency — каждый копируемый money fact
        // (amount + currency) валиден до записи (Decimal ≥ 0, ≤2dp, ISO 4217).
        for (const item of order.items) {
          validateFrozenMoneyFact(item.amount, item.currency, "booking money fact");
        }

        // Step 2.8A: frozen local temporal факты (order-level, verbatim из
        // OrderRequested → Order). Деривация UTC instant — ОДИН раз здесь, из
        // frozen local фактов (чистая функция, БЕЗ чтения mutable Catalog §10).
        // time без zone невозможен через canonical chain (Checkout 422 + Order
        // consumer validation) — defensive throw ниже → событие FAILED (честно).
        const orderServiceTime = order.serviceTime ?? null;
        const orderServiceEndTime = order.serviceEndTime ?? null;
        const orderServiceTimeZone = order.serviceTimeZone ?? null;

        // Step 2.9 §15: compensation race — если Order уже CANCELLED на момент
        // создания (OrderCancelled обработан раньше BookingRequested), Booking
        // создаётся в терминальном компенсированном состоянии. Durable event
        // authority сохранён: Booking ВСЕГДА создаётся (факт не игнорируется),
        // но никогда не бывает активной при отменённом заказе.
        //
        // Step 2.9A §11/§19 (born-CANCELLED temporal truth): cancelledAt = createdAt
        // (один серверный instant создания — Booking никогда не существовала в
        // не-CANCELLED состоянии; момент «отмены» совпадает с моментом создания
        // факта). requestedAt НЕ ставится (запрос поставщику не отправлялся);
        // BookingCancelled НЕ эмитится (approved 2.9: перехода не было). Upstream
        // OrderCancelled.occurredAt сохранён в causal chain событий (не в колонке).
        const compensated = order.status === "CANCELLED";
        const initialStatus: BookingStatus = compensated ? "CANCELLED" : "NEW";
        const bornCancelledAt = compensated ? new Date() : null;

        for (const item of order.items) {
          const code = await this.ids.nextCode(tx, "BKG");
          // Shared Commerce Sequence: derive Booking ref from Order's commerceSequence.
          const bookingRefNum = order.commerceSequence
            ? this.refNum.commerceBookingRef(order.commerceSequence)
            : await this.generateBookingReferenceNumber(tx, order, item);
          // Step 2.8: canonical cardinality 1 OrderItem → 1 Booking. orderItemId
          // (DB-level @unique) — надёжная защита от logically-duplicate
          // BookingRequested (разный eventId, тот же Order) и от concurrent
          // доставки; legacy Booking (до 2.8) — NULL без backfill.
          const itemServiceDate = item.serviceDate ?? order.serviceDate;
          const booking = await tx.booking.create({
            data: {
              code,
              orderId: order.id,
              productId: item.productId,
              orderItemId: item.id,
              status: initialStatus,
              // Step 2.9A: born-CANCELLED — cancelledAt == createdAt (один instant,
              // Booking создана уже отменённой); остальные milestones NULL.
              createdAt: bornCancelledAt ?? undefined,
              cancelledAt: bornCancelledAt,
              amount: item.amount,
              // Step 2.11: frozen money fact verbatim — amount + currency из ОДНОГО
              // OrderItem (frozen 2.5); НЕ пересчитывается, НЕ резолвится из
              // mutable Catalog/Finance master-data. Defensive: невалидный
              // money fact → событие FAILED (честно), никогда не молчаливый save.
              currency: item.currency,
              serviceDate: itemServiceDate,
              // ── Step 2.8A: frozen service occurrence (Roadmap 2.8A) ──
              // Тип из presence-фактов (OPEN_DATE — serviceDate null; TIME_SLOT —
              // точное local время; DATE_RANGE зарезервирован, не продуцируется).
              serviceTimeType: deriveServiceTimeType(itemServiceDate, orderServiceTime),
              serviceTime: orderServiceTime,
              serviceEndTime: orderServiceEndTime,
              serviceTimeZone: orderServiceTimeZone,
              // UTC instants: derived ОДИН раз (детерминированно, Intl). Date-only
              // → null (00:00 НЕ фабрикуется, §7). Инвариант local↔UTC (§13)
              // enforced на записи — не могут drift-ить независимо.
              serviceStartsAt: deriveServiceStartsAt(itemServiceDate, orderServiceTime, orderServiceTimeZone),
              serviceEndsAt: deriveServiceEndsAt(itemServiceDate, orderServiceTime, orderServiceEndTime, orderServiceTimeZone),
              // Step 2.5B: frozen acquisition source из Order (READ-only,
              // ADR-0001 — Booking НЕ ре-выводит source; копия canonical факта).
              referenceNumber: bookingRefNum,
              commerceSequence: order.commerceSequence ?? null,
              acquisitionSource: order.acquisitionSource ?? null,
              version: 1,
            },
            select: { id: true, code: true },
          });

          await tx.bookingHistory.create({
            data: {
              bookingId: booking.id,
              action: compensated ? "created_cancelled" : "created",
              to: initialStatus,
              actorId: null,
              actorName: "Система",
              comment: compensated
                ? "Бронирование создано consumer-ом BookingRequested при уже отменённом заказе — терминальное компенсированное состояние (Step 2.9 §15)"
                : "Бронирование создано consumer-ом BookingRequested (Baseline §9)",
            },
          });

          // D3 §11 — Passenger получает данные из confirmed OrderTraveler
          // (НЕ из Customer, НЕ из mutable Product requirements); никакие
          // поля не фабрикуются. passportExpiry переносится из OrderTraveler
          // (полный snapshot подтверждённых данных, D3).
          for (const t of readyTravelers) {
            await tx.passenger.create({
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

          created.push({ id: booking.id, code: booking.code });
        }

        // STRICT REVIEW FIX (invariant proof, §16): created непуст — invariant
        // выше (early return при order.items.length === 0 ⇒ items ≥ 1 ⇒ ровно
        // одна Booking на item). Тем не менее делаем контролируемый guard:
        // пустой результат — не runtime TypeError, а no-op (inbox отметится,
        // повторная доставка ничего не создаст).
        const first = created[0];
        if (!first) {
          await tx.inboxEvent.create({ data: { consumerId: CONSUMER_ID, eventId: ev.id } });
          return;
        }

        // Событие-результат (связь по correlation/causation).
        // Step 1.15: correlation наследуется из родительского события BookingRequested
        // (business код заказа НЕ используется как correlationId); causation = parent id.
        // Step 1.15A §20: entityId (aggregateId) — canonical booking ID (first.id),
        // пустой ID запрещён валидатором emitResult.
        await this.eventBus.emitResult(tx, {
          aggregateType: "Booking",
          aggregateId: first.id,
          eventType: DomainEvents.BookingCreated,
          payload: { count: created.length, bookings: created, orderId: order.id } as PrismaInput,
          correlationId: ev.correlationId,
          causationId: ev.id,
        });

        await tx.inboxEvent.create({ data: { consumerId: CONSUMER_ID, eventId: ev.id } });
      });
    } catch (err) {
      if (this.isUniqueViolation(err)) return; // параллельная обработка — уже обработано
      throw err;
    }
  }

  /**
   * Step 2.9 §15 — компенсация «Order отменён ПОСЛЕ durable BookingRequested/Booking».
   *
   * OrderCancelled — canonical факт Order domain (2.7). Booking центр компенсирует
   * свои активные брони заказа: каждая переводится в CANCELLED (CAS, history +
   * canonical BookingCancelled result-event). Это Booking-owned reconciliation
   * handler — использует те же guards/CAS, что и bookingAction (HARD GATE §6).
   *
   * Правила:
   *  - никакого hard delete (durable history);
   *  - терминальные брони (COMPLETED/SUPPLIER_REJECTED/CANCELLED) не трогаются;
   *  - Order НЕ пишется (Order уже CANCELLED — reconcile Order ранний return);
   *  - никакого refund/Finance/availability-release (ownership не определён — §32);
   *  - идемпотентность: InboxEvent; concurrent OrderCancelled — DB unique.
   *  - гонка Order-cancel vs Booking-create: если Booking ещё не создана,
   *    консьюмер no-op, а BookingRequested consumer создаст её сразу в CANCELLED
   *    (компенсированное состояние, см. onBookingRequested).
   */
  private async onOrderCancelled(ev: OutboxEnvelope): Promise<void> {
    const p = ev.payload as unknown as OrderRefPayload;
    if (!p?.orderId) return;
    if (await this.eventBus.isProcessed(ORDER_CANCELLED_CONSUMER_ID, ev.id)) return;

    try {
      await this.prisma.$transaction(async (tx) => {
        if (await tx.inboxEvent.findUnique({ where: { consumerId_eventId: { consumerId: ORDER_CANCELLED_CONSUMER_ID, eventId: ev.id } } })) return;

        const bookings = await tx.booking.findMany({
          where: { orderId: p.orderId, status: { in: BOOKING_ACTIVE } },
          select: { id: true, code: true, status: true, version: true, productId: true, cancelledAt: true },
        });

        // Step 2.9A §18: единый `now` для всех компенсируемых броней (одно
        // логическое событие OrderCancelled → один временной срез).
        const cancelledAt = new Date();
        for (const b of bookings) {
          // CAS: переход только если статус/версия не изменились (гоночные
          // HTTP-cancel/confirm с компенсацией — один победитель).
          const updatedRows = await tx.booking.updateMany({
            where: { id: b.id, status: b.status, version: b.version },
            data: { status: "CANCELLED", version: { increment: 1 }, cancelledAt: b.cancelledAt ?? cancelledAt },
          });
          if (updatedRows.count !== 1) continue; // другой transition победил

          await tx.bookingHistory.create({
            data: {
              bookingId: b.id,
              action: "cancelled_order",
              from: b.status,
              to: "CANCELLED",
              actorId: null,
              actorName: "Система",
              comment: "Заказ отменён — бронирование компенсировано (Step 2.9 §15)",
            },
          });

          // Result-event: durable факт компенсации (PUBLISHED сразу). Correlation
          // наследуется из OrderCancelled; causation = OrderCancelled.eventId.
          // Order subscriber на BookingCancelled НЕ подписан (Order уже CANCELLED,
          // reconcile не нужен) — событие фиксирует факт для ленты/аналитики.
          await this.eventBus.emitResult(tx, {
            aggregateType: "Booking",
            aggregateId: b.id,
            eventType: DomainEvents.BookingCancelled,
            payload: {
              bookingId: b.id,
              code: b.code,
              orderId: p.orderId,
              productId: b.productId,
              reason: "Заказ отменён",
            } as BookingEventPayload,
            correlationId: ev.correlationId,
            causationId: ev.id,
          });
        }

        await tx.inboxEvent.create({ data: { consumerId: ORDER_CANCELLED_CONSUMER_ID, eventId: ev.id } });
      });
    } catch (err) {
      if (this.isUniqueViolation(err)) return; // concurrent — уже обработано
      throw err;
    }
  }

  /**
   * Step 3.12 — generate tenant-scoped reference number for Booking.
   * Marketplace → MKT-BKG-{SEQ}; Storefront → {SF_CODE}-BKG-{SEQ}
   */
  private async generateBookingReferenceNumber(
    tx: any,
    order: { acquisitionSource: string | null; sellerPartnerId: string | null },
    _item: { productId: string },
  ): Promise<string> {
    const source = order.acquisitionSource;
    if (source === "PARTNER_STOREFRONT" && order.sellerPartnerId) {
      const sf = await tx.partnerStorefront.findUnique({
        where: { partnerId: order.sellerPartnerId },
        select: { storefrontCode: true },
      });
      if (sf) return this.refNum.nextStorefrontReference(tx, sf.storefrontCode, "BKG");
    }
    return this.refNum.nextMarketplaceReference(tx, "BKG");
  }

  /**
   * Step 2.8 (STRICT REVIEW fix): P2002 = no-op ТОЛЬКО для idempotency-unique
   * (inbox InboxEvent_consumerId_eventId_key; Booking_orderItemId_key — canonical
   * cardinality 1 OrderItem → ≤1 Booking). Любой ДРУГОЙ unique-дефект (BKG-код
   * и пр.) пробрасывается наружу → событие FAILED (честно: это дефект ленты),
   * а не ложный «уже обработано» — конвенция OrderRequested consumer-а (Step 2.5
   * STRICT REVIEW). Имена constraint'ов извлекаются каноническим shared-хелпером
   * (классический meta.target И driver-adapter originalMessage — оба shape).
   */
  private isUniqueViolation(err: unknown): boolean {
    const names = uniqueConstraintNames(err);
    if (names.includes("Booking_orderItemId_key")) return true;
    return names.includes("InboxEvent_consumerId_eventId_key");
  }
}

type PrismaInput = Record<string, unknown>;
