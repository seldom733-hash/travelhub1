import { Injectable, Logger } from "@nestjs/common";
import type { Prisma } from "../../generated/prisma/client";
import type { OutboxEnvelope } from "../../eventbus/eventbus.service";
import { EventBusService } from "../../eventbus/eventbus.service";
import { DomainEvents, type BookingEventPayload, type PaymentEventPayload } from "../../eventbus/domain-events";
import { PrismaService } from "../../prisma/prisma.service";
import { DocumentsService } from "./documents.service";

const CONSUMER_ID = "documents-voucher-consumer";

/**
 * VoucherConsumer — D13 dual-gate Voucher generation.
 *
 * Subscribes to:
 * - BookingConfirmed (Booking status gate)
 * - PaymentCaptured (Payment status gate)
 *
 * On either event, checks if BOTH conditions are satisfied:
 *   Booking.status === CONFIRMED
 *   AND Order.paymentStatus === PAID
 *   AND Order.paidAmount >= Order.amount
 *
 * If both satisfied → generates Voucher (Document + Version + PDF + S3).
 * Idempotent: InboxEvent pattern prevents duplicate generation.
 */
@Injectable()
export class VoucherConsumer {
  private readonly logger = new Logger(VoucherConsumer.name);

  constructor(
    private readonly eventBus: EventBusService,
    private readonly prisma: PrismaService,
    private readonly documents: DocumentsService,
  ) {}

  onModuleInit(): void {
    this.eventBus.on(DomainEvents.BookingConfirmed, (ev) => this.onBookingConfirmed(ev));
    this.eventBus.on(DomainEvents.PaymentCaptured, (ev) => this.onPaymentCaptured(ev));
  }

  private async onBookingConfirmed(ev: OutboxEnvelope): Promise<void> {
    const p = ev.payload as unknown as BookingEventPayload;
    if (!p?.orderId || !p?.bookingId) return;
    if (await this.eventBus.isProcessed(CONSUMER_ID, ev.id)) return;

    try {
      await this.prisma.$transaction(async (tx) => {
        if (await tx.inboxEvent.findUnique({ where: { consumerId_eventId: { consumerId: CONSUMER_ID, eventId: ev.id } } })) return;
        await this.tryGenerateVoucher(tx, p.orderId, p.bookingId, `BookingConfirmed (${p.code})`);
        await tx.inboxEvent.create({ data: { consumerId: CONSUMER_ID, eventId: ev.id } });
      });
    } catch (err) {
      if (this.isUniqueViolation(err)) return;
      this.logger.error(`VoucherConsumer BookingConfirmed error: ${err}`);
      throw err;
    }
  }

  private async onPaymentCaptured(ev: OutboxEnvelope): Promise<void> {
    const p = ev.payload as unknown as PaymentEventPayload;
    if (!p?.orderId) return;
    if (await this.eventBus.isProcessed(CONSUMER_ID, ev.id)) return;

    try {
      await this.prisma.$transaction(async (tx) => {
        if (await tx.inboxEvent.findUnique({ where: { consumerId_eventId: { consumerId: CONSUMER_ID, eventId: ev.id } } })) return;
        // Find the booking for this order
        const bookings = await tx.booking.findMany({ where: { orderId: p.orderId } });
        for (const booking of bookings) {
          await this.tryGenerateVoucher(tx, p.orderId, booking.id, `PaymentCaptured (${p.code})`);
        }

        await tx.inboxEvent.create({ data: { consumerId: CONSUMER_ID, eventId: ev.id } });
      });
    } catch (err) {
      if (this.isUniqueViolation(err)) return;
      this.logger.error(`VoucherConsumer PaymentCaptured error: ${err}`);
      throw err;
    }
  }

  /**
   * Try to generate a voucher if both gates are satisfied.
   * Called inside a transaction.
   */
  private async tryGenerateVoucher(
    tx: Prisma.TransactionClient,
    orderId: string,
    bookingId: string,
    triggeringEvent: string,
  ): Promise<void> {
    // Check Booking status
    const booking = await tx.booking.findUnique({ where: { id: bookingId } });
    if (!booking || booking.status !== "CONFIRMED") return;

    // Check Order payment status
    const order = await tx.order.findUnique({ where: { id: orderId } });
    if (!order) return;
    if (order.paymentStatus !== "PAID") return;
    if (order.paidAmount.lessThan(order.amount)) return;

    // Check if voucher already exists for this booking
    const existing = await tx.document.findFirst({
      where: { bookingId, type: "VOUCHER", status: { not: "INVALIDATED" } },
    });
    if (existing) return; // already generated (idempotent)

    // Check passengers exist
    const passengers = await tx.passenger.findMany({ where: { bookingId } });
    if (passengers.length === 0) return; // no passengers yet

    // Create document entity
    const { id: documentId, code } = await this.documents.createDocument(tx, {
      type: "VOUCHER",
      bookingId,
      orderId,
      customerId: order.customerId,
      serviceDate: booking.serviceDate,
      serviceTime: booking.serviceTime,
      serviceTimeZone: booking.serviceTimeZone,
      totalAmount: booking.amount,
      paidAmount: order.paidAmount,
      currency: booking.currency,
      paymentStatus: order.paymentStatus,
    });

    // Build snapshot
    const snapshot = {
      code,
      bookingCode: booking.code,
      orderCode: order.code,
      serviceName: "Service", // TODO: resolve from catalog
      serviceDate: booking.serviceDate?.toISOString() ?? null,
      serviceTime: booking.serviceTime,
      serviceTimeZone: booking.serviceTimeZone,
      totalAmount: booking.amount?.toString() ?? null,
      paidAmount: order.paidAmount?.toString() ?? null,
      currency: booking.currency,
      paymentStatus: order.paymentStatus,
      travelers: passengers.map((passenger) => ({
        firstName: passenger.firstName,
        lastName: passenger.lastName,
        birthDate: passenger.birthDate?.toISOString() ?? null,
        citizenship: passenger.citizenship,
        gender: passenger.gender,
        passportNumber: passenger.passportNumber,
        passportExpiry: passenger.passportExpiry?.toISOString() ?? null,
      })),
    };

    // Issue document (create version, render PDF, store in S3)
    await this.documents.issueDocument(tx, documentId, triggeringEvent, snapshot);
  }

  private isUniqueViolation(err: unknown): boolean {
    return (err as { code?: string })?.code === "P2002";
  }
}
