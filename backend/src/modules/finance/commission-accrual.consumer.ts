import { Injectable, OnModuleInit } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { EventBusService, type OutboxEnvelope } from "../../eventbus/eventbus.service";
import { DomainEvents, type OrderEventPayload } from "../../eventbus/domain-events";
import { CommissionService } from "./commission.service";

const CONSUMER_ID = "commission-accrual-consumer";

/**
 * PHASE 2 STEP 2.12E — CommissionAccrual producer (PARTNER_COLLECT, ADR-0013
 * D10/D19): признание receivable Partner → TravelHub на **Order creation**
 * (OrderCreated result-event, атомарно с Order в Order-домене).
 *
 * Finance-owned producer: читает frozen Order факты (READ-only cross-context,
 * ADR-0001), НЕ пишет в order.*, НЕ читает live Catalog/Policy, НЕ требует
 * Payment CAPTURED / PSP (boundaries 2.12C/2.12D).
 *
 * Идемпотентность — тройная защита:
 *  1. events.InboxEvent (unique consumerId+eventId) — стандартный dedup;
 *  2. domain unique `Commission_orderId_key` + `CommissionAccrual_sourceCommissionId_key`
 *     — один факт на источник (DB backstop);
 *  3. P2002 обрабатывается КОНСТРЕЙНТ-специфично: no-op ТОЛЬКО для известных
 *     idempotency-unique (inbox consumerId+eventId, Commission.orderId,
 *     CommissionAccrual.sourceCommissionId); любой другой unique-дефект → FAILED
 *     (не ложный success).
 *
 * Fail-closed: отсутствие frozen snapshot / sellerPartnerId → no-op (0 accrual);
 * невалидный snapshot → событие FAILED (invariant violation, громко);
 * divergent replay → controlled ConflictError → FAILED (не молчаливый 200).
 */
@Injectable()
export class CommissionAccrualConsumer implements OnModuleInit {
  constructor(
    private readonly eventBus: EventBusService,
    private readonly prisma: PrismaService,
    private readonly commissions: CommissionService,
  ) {}

  onModuleInit(): void {
    this.eventBus.on(DomainEvents.OrderCreated, (ev) => this.onOrderCreated(ev));
  }

  private async onOrderCreated(ev: OutboxEnvelope): Promise<void> {
    const payload = ev.payload as unknown as OrderEventPayload;
    if (!payload?.orderId) return;
    if (await this.eventBus.isProcessed(CONSUMER_ID, ev.id)) return;

    try {
      await this.prisma.$transaction(async (tx) => {
        if (await tx.inboxEvent.findUnique({ where: { consumerId_eventId: { consumerId: CONSUMER_ID, eventId: ev.id } } })) return;

        // READ-only cross-context read (ADR-0001): frozen Order факты.
        const order = await tx.order.findUnique({
          where: { id: payload.orderId },
          select: { id: true, code: true, amount: true, currency: true, sellerPartnerId: true, commissionSnapshot: true },
        });
        if (!order) {
          // Order отсутствует — признание невозможно; отметить обработанным
          // (повторная доставка не создаст вечный retry — как order-payment).
          await tx.inboxEvent.create({ data: { consumerId: CONSUMER_ID, eventId: ev.id } });
          return;
        }

        await this.commissions.createAccrualForOrder(
          tx,
          {
            id: order.id,
            code: order.code,
            amount: order.amount,
            currency: order.currency,
            sellerPartnerId: order.sellerPartnerId,
            commissionSnapshot: order.commissionSnapshot,
          },
          { correlationId: ev.correlationId, causationId: ev.id },
        );

        await tx.inboxEvent.create({ data: { consumerId: CONSUMER_ID, eventId: ev.id } });
      });
    } catch (err) {
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
    // Commission_orderId_key (один earned-факт на Order) / accrual
    // sourceCommissionId (один receivable на Commission) — idempotency backstop.
    if (target.includes("orderId")) return true;
    if (target.includes("sourceCommissionId")) return true;
    // Inbox unique: consumerId+eventId (обязательно оба).
    return target.includes("consumerId") && target.includes("eventId");
  }
}
