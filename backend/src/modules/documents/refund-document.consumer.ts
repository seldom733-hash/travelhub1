import { Injectable, Logger } from "@nestjs/common";
import type { OutboxEnvelope } from "../../eventbus/eventbus.service";
import { EventBusService } from "../../eventbus/eventbus.service";
import { DomainEvents, type RefundEventPayload } from "../../eventbus/domain-events";
import { PrismaService } from "../../prisma/prisma.service";
import { DocumentsService } from "./documents.service";

const CONSUMER_ID = "documents-refund-consumer";

/**
 * RefundDocumentConsumer — D13 Refund Document generation.
 *
 * Subscribes to:
 * - RefundProcessed
 *
 * On RefundProcessed:
 * 1. Create Refund Document with refund details
 * 2. If full refund (refundedAmount >= paidAmount), invalidate active Voucher
 */
@Injectable()
export class RefundDocumentConsumer {
  private readonly logger = new Logger(RefundDocumentConsumer.name);

  constructor(
    private readonly eventBus: EventBusService,
    private readonly prisma: PrismaService,
    private readonly documents: DocumentsService,
  ) {}

  onModuleInit(): void {
    this.eventBus.on(DomainEvents.RefundProcessed, (ev) => this.onRefundProcessed(ev));
  }

  private async onRefundProcessed(ev: OutboxEnvelope): Promise<void> {
    const p = ev.payload as unknown as RefundEventPayload;
    if (!p?.orderId || !p?.refundId) return;
    if (await this.eventBus.isProcessed(CONSUMER_ID, ev.id)) return;

    try {
      await this.prisma.$transaction(async (tx) => {
        if (await tx.inboxEvent.findUnique({ where: { consumerId_eventId: { consumerId: CONSUMER_ID, eventId: ev.id } } })) return;

        const order = await tx.order.findUnique({ where: { id: p.orderId } });
        if (!order) {
          await tx.inboxEvent.create({ data: { consumerId: CONSUMER_ID, eventId: ev.id } });
          return;
        }

        // Find the booking for this order
        const booking = await tx.booking.findFirst({ where: { orderId: p.orderId } });
        if (!booking) {
          await tx.inboxEvent.create({ data: { consumerId: CONSUMER_ID, eventId: ev.id } });
          return;
        }

        // Check if refund document already exists (idempotent)
        const existing = await tx.document.findFirst({
          where: { orderId: p.orderId, type: "REFUND" },
        });
        if (existing) {
          await tx.inboxEvent.create({ data: { consumerId: CONSUMER_ID, eventId: ev.id } });
          return;
        }

        // Create Refund Document
        const { id: documentId, code } = await this.documents.createDocument(tx, {
          type: "REFUND",
          bookingId: booking.id,
          orderId: p.orderId,
          customerId: order.customerId,
          totalAmount: order.amount,
          paidAmount: order.paidAmount,
          currency: booking.currency,
          paymentStatus: order.paymentStatus,
        });

        // Build snapshot
        const snapshot = {
          code,
          bookingCode: booking.code,
          orderCode: order.code,
          originalPaidAmount: order.paidAmount?.toString() ?? null,
          refundAmount: p.amount ?? null,
          refundedAmount: order.refundedAmount?.toString() ?? null,
          currency: booking.currency,
          paymentStatus: order.paymentStatus,
          refundDate: new Date().toISOString(),
          refundCode: p.code,
        };

        // Issue document
        await this.documents.issueDocument(tx, documentId, `RefundProcessed (${p.code})`, snapshot);

        // If full refund, invalidate active Voucher
        if (order.paidAmount && order.refundedAmount.greaterThanOrEqualTo(order.paidAmount)) {
          const activeVoucher = await tx.document.findFirst({
            where: { bookingId: booking.id, type: "VOUCHER", status: "ISSUED" },
          });
          if (activeVoucher) {
            await this.documents.invalidateDocument(tx, activeVoucher.id, `Full refund processed (${p.code})`);
          }
        }

        await tx.inboxEvent.create({ data: { consumerId: CONSUMER_ID, eventId: ev.id } });
      });
    } catch (err) {
      if (this.isUniqueViolation(err)) return;
      this.logger.error(`RefundDocumentConsumer error: ${err}`);
      throw err;
    }
  }

  private isUniqueViolation(err: unknown): boolean {
    return (err as { code?: string })?.code === "P2002";
  }
}
