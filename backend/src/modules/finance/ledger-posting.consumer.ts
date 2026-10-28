import { Injectable, OnModuleInit } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { EventBusService, type OutboxEnvelope } from "../../eventbus/eventbus.service";
import {
  DomainEvents,
  type PaymentEventPayload,
  type RefundEventPayload,
  type SupplierPayoutCreatedPayload,
  type SupplierPayoutReversedPayload,
  type ObligationAdjustedPayload,
} from "../../eventbus/domain-events";
import { LedgerService, type LedgerCreateInput } from "./ledger.service";

const CONSUMER_ID = "ledger-posting-consumer";

/**
 * UNIFIED FINANCE CENTER Phase 5 — LedgerPostingConsumer.
 *
 * Finance-owned consumer: подписывается на денежные source-facts и фиксирует их
 * в append-only LedgerTransaction через LedgerService (единственный canonical
 * writer). Никогда не пишет в Payment/Refund/Order/Booking (ADR-0001, READ-only
 * cross-context — payload уже несёт frozen money facts).
 *
 * Триггеры:
 *  - PaymentCaptured  → type PAYMENT_CAPTURED   (sourceType PAYMENT,    sourceId paymentId)   — cash IN;
 *  - RefundProcessed  → type REFUND_PROCESSED   (sourceType REFUND,    sourceId refundId)    — cash OUT;
 *  - SupplierPayoutCreated → type SUPPLIER_PAYOUT (sourceType SUPPLIER_PAYOUT, sourceId payoutId) — cash OUT (поставщику);
 *  - ObligationAdjusted    → type OBLIGATION_ADJUSTED (sourceType OBLIGATION, sourceId obligationId) — revaluation (не cash-movement).
 *
 * Идемпотентность (двойная):
 *  1. events.InboxEvent (unique consumerId+eventId) — стандартный dedup;
 *  2. LedgerTransaction @@unique([sourceType, sourceId, type]) — DB-backstop:
 *     replay того же факта → no-op (возвращает существующий); divergent payload
 *     → ConflictError 409 (producer-баг, громко, НЕ молчаливый дубликат).
 *
 * Retry safety: handler-failure НЕ пробрасывается к producer-у (eventbus
 * dispatch в try/catch; outbox помечает FAILED, при retryable=true — durable
 * retry с backoff). Платёж/выплата уже зафиксированы; ledger-проекция — вторична
 * и догоняет при retry. НЕ double-entry accounting (append-only single-entry
 * facts; сбалансированная модель — вне scope).
 */
@Injectable()
export class LedgerPostingConsumer implements OnModuleInit {
  constructor(
    private readonly eventBus: EventBusService,
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
  ) {}

  onModuleInit(): void {
    this.eventBus.on(DomainEvents.PaymentCaptured, (ev) =>
      this.post<PaymentEventPayload>(ev, (p) => ({
        amount: p.amount,
        currency: p.currency,
        type: "PAYMENT_CAPTURED",
        sourceType: "PAYMENT",
        sourceId: p.paymentId,
        sourceEventId: ev.id,
        businessRef: p.code,
        occurredAt: null, // payload не несёт occurredAt — не fabricate (NULL = unknown)
      })),
    );

    this.eventBus.on(DomainEvents.RefundProcessed, (ev) =>
      this.post<RefundEventPayload>(ev, (p) => ({
        amount: p.amount,
        currency: p.currency,
        type: "REFUND_PROCESSED",
        sourceType: "REFUND",
        sourceId: p.refundId,
        sourceEventId: ev.id,
        businessRef: p.code,
        occurredAt: null,
      })),
    );

    this.eventBus.on(DomainEvents.SupplierPayoutCreated, (ev) =>
      this.post<SupplierPayoutCreatedPayload>(ev, (p) => ({
        amount: p.amount,
        currency: p.currency,
        type: "SUPPLIER_PAYOUT",
        sourceType: "SUPPLIER_PAYOUT",
        sourceId: p.payoutId,
        sourceEventId: ev.id,
        businessRef: p.payoutCode,
        occurredAt: p.occurredAt, // frozen бизнес-время движения (ISO 8601)
      })),
    );

    this.eventBus.on(DomainEvents.SupplierPayoutReversed, (ev) =>
      this.post<SupplierPayoutReversedPayload>(ev, (p) => ({
        amount: p.amount,
        currency: p.currency,
        type: "SUPPLIER_PAYOUT_REVERSAL",
        sourceType: "SUPPLIER_PAYOUT",
        sourceId: p.payoutId,
        sourceEventId: ev.id,
        businessRef: p.payoutCode,
        occurredAt: p.occurredAt,
      })),
    );

    this.eventBus.on(DomainEvents.ObligationAdjusted, (ev) =>
      this.post<ObligationAdjustedPayload>(ev, (p) => ({
        amount: p.newAznAmount,
        currency: "AZN",
        type: "OBLIGATION_ADJUSTED",
        sourceType: "OBLIGATION",
        sourceId: p.obligationId,
        sourceEventId: ev.id,
        businessRef: p.obligationCode,
        occurredAt: null,
      })),
    );
  }

  private async post<T>(ev: OutboxEnvelope, build: (payload: T) => LedgerCreateInput): Promise<void> {
    if (await this.eventBus.isProcessed(CONSUMER_ID, ev.id)) return;
    const payload = ev.payload as unknown as T;
    // LedgerService.create идемпотентен: replay → no-op; divergent → 409.
    await this.ledger.create(build(payload));
    await this.markProcessed(ev.id);
  }

  private async markProcessed(eventId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await this.eventBus.markProcessed(tx, CONSUMER_ID, eventId);
    });
  }
}
