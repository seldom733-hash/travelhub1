import { Injectable, Logger } from "@nestjs/common";
import type { Prisma } from "../../generated/prisma/client";
import type { OutboxEnvelope } from "../../eventbus/eventbus.service";
import { EventBusService } from "../../eventbus/eventbus.service";
import { DomainEvents, type BookingEventPayload } from "../../eventbus/domain-events";
import { PrismaService } from "../../prisma/prisma.service";
import { DocumentsService } from "./documents.service";

const CONSUMER_ID = "documents-invalidation-consumer";

/**
 * InvalidationConsumer — D13 Voucher invalidation on cancellation/rejection.
 *
 * Subscribes to:
 * - BookingCancelled
 * - BookingRejected
 *
 * On either event, invalidates the active Voucher for the Booking.
 */
@Injectable()
export class InvalidationConsumer {
  private readonly logger = new Logger(InvalidationConsumer.name);

  constructor(
    private readonly eventBus: EventBusService,
    private readonly prisma: PrismaService,
    private readonly documents: DocumentsService,
  ) {}

  onModuleInit(): void {
    this.eventBus.on(DomainEvents.BookingCancelled, (ev) => this.onBookingCancelled(ev));
    this.eventBus.on(DomainEvents.BookingRejected, (ev) => this.onBookingRejected(ev));
  }

  private async onBookingCancelled(ev: OutboxEnvelope): Promise<void> {
    const p = ev.payload as unknown as BookingEventPayload;
    if (!p?.bookingId) return;
    if (await this.eventBus.isProcessed(CONSUMER_ID, ev.id)) return;

    try {
      await this.prisma.$transaction(async (tx) => {
        if (await tx.inboxEvent.findUnique({ where: { consumerId_eventId: { consumerId: CONSUMER_ID, eventId: ev.id } } })) return;
        await this.invalidateVouchers(tx, p.bookingId, `BookingCancelled (${p.code})`);
        await tx.inboxEvent.create({ data: { consumerId: CONSUMER_ID, eventId: ev.id } });
      });
    } catch (err) {
      if (this.isUniqueViolation(err)) return;
      this.logger.error(`InvalidationConsumer BookingCancelled error: ${err}`);
      throw err;
    }
  }

  private async onBookingRejected(ev: OutboxEnvelope): Promise<void> {
    const p = ev.payload as unknown as BookingEventPayload;
    if (!p?.bookingId) return;
    if (await this.eventBus.isProcessed(CONSUMER_ID, ev.id)) return;

    try {
      await this.prisma.$transaction(async (tx) => {
        if (await tx.inboxEvent.findUnique({ where: { consumerId_eventId: { consumerId: CONSUMER_ID, eventId: ev.id } } })) return;
        await this.invalidateVouchers(tx, p.bookingId, `BookingRejected (${p.code})`);
        await tx.inboxEvent.create({ data: { consumerId: CONSUMER_ID, eventId: ev.id } });
      });
    } catch (err) {
      if (this.isUniqueViolation(err)) return;
      this.logger.error(`InvalidationConsumer BookingRejected error: ${err}`);
      throw err;
    }
  }

  private async invalidateVouchers(
    tx: Prisma.TransactionClient,
    bookingId: string,
    reason: string,
  ): Promise<void> {
    const activeVouchers = await tx.document.findMany({
      where: { bookingId, type: "VOUCHER", status: "ISSUED" },
    });

    for (const voucher of activeVouchers) {
      await this.documents.invalidateDocument(tx, voucher.id, reason);
    }
  }

  private isUniqueViolation(err: unknown): boolean {
    return (err as { code?: string })?.code === "P2002";
  }
}
