import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { EventBusService, type OutboxEnvelope } from "../../eventbus/eventbus.service";
import { DomainEvents, type OrderEventPayload } from "../../eventbus/domain-events";

const CONSUMER_ID = "marketplace-pcr-attribution-consumer";

/**
 * PHASE 3 STEP 3.6A — Marketplace PCR Auto-Attribution Consumer.
 *
 * When an Order is created with a sellerPartnerId and customerId,
 * automatically create a PartnerCustomerRelation with leadSource = MARKETPLACE
 * if one does not already exist for this (partnerId, customerId) pair.
 *
 * First-source preservation: existing PCR leadSource is NEVER overwritten.
 *
 * Idempotency — triple protection:
 *  1. events.InboxEvent (unique consumerId+eventId) — standard dedup;
 *  2. domain unique @@unique([partnerId, customerId]) on PCR — DB backstop;
 *  3. P2002 handled constraint-specifically: no-op only for known idempotency
 *     unique; any other unique violation is propagated.
 *
 * Fail-closed: missing Order/sellerPartnerId/customerId → no-op.
 */
@Injectable()
export class MarketplacePcrAttributionConsumer implements OnModuleInit {
  private readonly logger = new Logger(MarketplacePcrAttributionConsumer.name);

  constructor(
    private readonly eventBus: EventBusService,
    private readonly prisma: PrismaService,
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
        // Idempotency: skip if already processed
        if (await tx.inboxEvent.findUnique({ where: { consumerId_eventId: { consumerId: CONSUMER_ID, eventId: ev.id } } })) return;

        // READ-only cross-context read (ADR-0001): Order facts needed for attribution
        const order = await tx.order.findUnique({
          where: { id: payload.orderId },
          select: { id: true, customerId: true, sellerPartnerId: true },
        });

        // Fail-closed: no order, no sellerPartnerId, no customerId → no-op
        if (!order || !order.sellerPartnerId || !order.customerId) {
          await tx.inboxEvent.create({ data: { consumerId: CONSUMER_ID, eventId: ev.id } });
          return;
        }

        const partnerId = order.sellerPartnerId;
        const customerId = order.customerId;

        // Check existing PCR — first-source preservation
        const existingPcr = await tx.partnerCustomerRelation.findUnique({
          where: { partnerId_customerId: { partnerId, customerId } },
          select: { id: true, leadSource: true },
        });

        if (existingPcr) {
          // PCR already exists — preserve original leadSource, do NOT overwrite
          await tx.inboxEvent.create({ data: { consumerId: CONSUMER_ID, eventId: ev.id } });
          return;
        }

        // Create new PCR with MARKETPLACE source
        try {
          await tx.partnerCustomerRelation.create({
            data: {
              partnerId,
              customerId,
              leadSource: "MARKETPLACE",
              lifecycle: "LEAD",
              tags: [],
              notes: null,
              assignedTo: null,
            },
          });

          await tx.partnerCustomerRelationHistory.create({
            data: {
              relationId: (await tx.partnerCustomerRelation.findUnique({
                where: { partnerId_customerId: { partnerId, customerId } },
                select: { id: true },
              }))!.id,
              action: "created",
              to: "ACTIVE",
              actorId: null,
              actorName: "System",
              comment: `Marketplace auto-attribution (Order ${order.id})`,
            },
          });

          this.logger.log(`PCR created: partner=${partnerId} customer=${customerId} source=MARKETPLACE`);
        } catch (err: any) {
          // P2002 unique violation = race condition — another event created PCR first
          // This is expected for concurrent events, not a real error
          if (err?.code === "P2002") {
            this.logger.debug(`PCR already exists (race): partner=${partnerId} customer=${customerId}`);
          } else {
            throw err;
          }
        }

        await tx.inboxEvent.create({ data: { consumerId: CONSUMER_ID, eventId: ev.id } });
      });
    } catch (err) {
      if (this.isIdempotencyUniqueViolation(err)) return;
      throw err;
    }
  }

  /** P2002: idempotency-unique violations are safe no-ops (race/dedup). */
  private isIdempotencyUniqueViolation(err: unknown): boolean {
    if (
      typeof err === "object" &&
      err !== null &&
      "code" in err &&
      (err as any).code === "P2002" &&
      typeof (err as any).meta?.target === "string"
    ) {
      const target = (err as any).meta.target as string;
      return target.includes("inboxEvent") || target.includes("PartnerCustomerRelation");
    }
    return false;
  }
}
