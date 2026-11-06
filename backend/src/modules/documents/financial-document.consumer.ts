import { Injectable, Logger } from "@nestjs/common";
import type { OutboxEnvelope } from "../../eventbus/eventbus.service";
import { EventBusService } from "../../eventbus/eventbus.service";
import { DomainEvents, type PaymentEventPayload, type SupplierPayoutCreatedPayload } from "../../eventbus/domain-events";
import { PrismaService } from "../../prisma/prisma.service";
import { DocumentsService } from "./documents.service";

const PAYMENT_CONSUMER = "documents-payment-consumer";
const SUPPLIER_CONSUMER = "documents-supplier-payment-consumer";

@Injectable()
export class FinancialDocumentConsumer {
  private readonly logger = new Logger(FinancialDocumentConsumer.name);

  constructor(
    private readonly eventBus: EventBusService,
    private readonly prisma: PrismaService,
    private readonly documents: DocumentsService,
  ) {}

  onModuleInit(): void {
    this.eventBus.on(DomainEvents.PaymentCaptured, (ev) => this.onPayment(ev));
    this.eventBus.on(DomainEvents.SupplierPayoutCreated, (ev) => this.onSupplierPayout(ev));
    setTimeout(() => void this.backfill().catch((e) => this.logger.error(`Document backfill failed: ${e}`)), 3000);
  }

  private async backfill(): Promise<void> {
    const existing = new Set((await this.prisma.document.findMany({ where: { sourceId: { not: null } }, select: { sourceId: true } })).map((d) => d.sourceId));
    const payments = await this.prisma.payment.findMany({ where: { status: { in: ["CAPTURED", "REFUNDED"] } }, select: { id: true, orderId: true, amount: true, currency: true } });
    for (const p of payments) {
      if (existing.has(p.id)) continue;
      await this.prisma.$transaction(async (tx) => {
        const order = await tx.order.findUnique({ where: { id: p.orderId } });
        if (!order) return;
        const booking = await tx.booking.findFirst({ where: { orderId: p.orderId }, orderBy: { createdAt: "desc" } });
        if (!booking) return;
        const { id, code } = await this.documents.createDocument(tx, { type: "PARTIAL_PAYMENT", sourceId: p.id, bookingId: booking.id, orderId: order.id, customerId: order.customerId, totalAmount: order.amount, paidAmount: order.paidAmount, currency: p.currency, paymentStatus: order.paymentStatus });
        await this.documents.issueDocument(tx, id, "DocumentBackfill (Payment)", { code, bookingCode: booking.code, orderCode: order.code, serviceName: "Travel services", totalAmount: order.amount.toString(), paidAmount: p.amount.toString(), remainingAmount: null, currency: p.currency, paymentStatus: order.paymentStatus });
      }).catch((e) => this.logger.error(`Backfill payment ${p.id}: ${e}`));
    }
    const refunds = await this.prisma.refund.findMany({ where: { status: { not: "FAILED" } }, select: { id: true, code: true, orderId: true, amount: true, currency: true } });
    for (const r of refunds) {
      if (existing.has(r.id)) continue;
      await this.prisma.$transaction(async (tx) => {
        const order = await tx.order.findUnique({ where: { id: r.orderId } });
        if (!order) return;
        const booking = await tx.booking.findFirst({ where: { orderId: r.orderId }, orderBy: { createdAt: "desc" } });
        if (!booking) return;
        const { id, code } = await this.documents.createDocument(tx, { type: "REFUND", sourceId: r.id, bookingId: booking.id, orderId: order.id, customerId: order.customerId, totalAmount: order.amount, paidAmount: order.paidAmount, currency: r.currency, paymentStatus: order.paymentStatus });
        await this.documents.issueDocument(tx, id, "DocumentBackfill (Refund)", { code, bookingCode: booking.code, orderCode: order.code, originalPaidAmount: order.paidAmount.toString(), refundAmount: r.amount.toString(), refundedAmount: order.refundedAmount.toString(), currency: r.currency, paymentStatus: order.paymentStatus, refundDate: new Date().toISOString(), refundCode: r.code });
      }).catch((e) => this.logger.error(`Backfill refund ${r.id}: ${e}`));
    }
    const payouts = await this.prisma.supplierPayout.findMany({ where: { status: { not: "CANCELLED" }, orderId: { not: null } }, select: { id: true, orderId: true, amount: true, currency: true, direction: true } });
    for (const p of payouts) {
      if (existing.has(p.id) || !p.orderId) continue;
      await this.prisma.$transaction(async (tx) => {
        const order = await tx.order.findUnique({ where: { id: p.orderId! } });
        if (!order) return;
        const booking = await tx.booking.findFirst({ where: { orderId: order.id }, orderBy: { createdAt: "desc" } });
        if (!booking) return;
        const type = p.direction === "INCOMING" ? "REFUND" : "PARTIAL_PAYMENT";
        const { id, code } = await this.documents.createDocument(tx, { type, sourceId: p.id, bookingId: booking.id, orderId: order.id, customerId: order.customerId, totalAmount: order.amount, paidAmount: order.paidAmount, currency: p.currency, paymentStatus: order.paymentStatus });
        await this.documents.issueDocument(tx, id, "DocumentBackfill (SupplierPayout)", { code, bookingCode: booking.code, orderCode: order.code, serviceName: "Supplier settlement", totalAmount: order.amount.toString(), paidAmount: p.amount.toString(), remainingAmount: null, currency: p.currency, paymentStatus: order.paymentStatus });
      }).catch((e) => this.logger.error(`Backfill payout ${p.id}: ${e}`));
    }
  }

  private async onPayment(ev: OutboxEnvelope): Promise<void> {
    const p = ev.payload as unknown as PaymentEventPayload;
    if (!p?.paymentId || !p?.orderId) return;
    if (await this.eventBus.isProcessed(PAYMENT_CONSUMER, ev.id)) return;
    try {
      await this.prisma.$transaction(async (tx) => {
        if (await tx.inboxEvent.findUnique({ where: { consumerId_eventId: { consumerId: PAYMENT_CONSUMER, eventId: ev.id } } })) return;
        const existing = await tx.document.findFirst({ where: { type: "PARTIAL_PAYMENT", sourceId: p.paymentId } });
        if (existing) { await tx.inboxEvent.create({ data: { consumerId: PAYMENT_CONSUMER, eventId: ev.id } }); return; }
        const order = await tx.order.findUnique({ where: { id: p.orderId } });
        if (!order) return;
        const booking = await tx.booking.findFirst({ where: { orderId: p.orderId }, orderBy: { createdAt: "desc" } });
        if (!booking) return;
        const { id, code } = await this.documents.createDocument(tx, {
          type: "PARTIAL_PAYMENT", sourceId: p.paymentId, bookingId: booking.id, orderId: order.id,
          customerId: order.customerId, totalAmount: order.amount, paidAmount: order.paidAmount,
          currency: p.currency, paymentStatus: order.paymentStatus,
        });
        await this.documents.issueDocument(tx, id, `PaymentCaptured (${p.code})`, {
          code, bookingCode: booking.code, orderCode: order.code, serviceName: "Travel services",
          totalAmount: order.amount.toString(), paidAmount: p.amount,
          remainingAmount: null, currency: p.currency, paymentStatus: order.paymentStatus,
        });
        await tx.inboxEvent.create({ data: { consumerId: PAYMENT_CONSUMER, eventId: ev.id } });
      });
    } catch (err) {
      this.logger.error(`Payment document error: ${err}`);
      throw err;
    }
  }

  private async onSupplierPayout(ev: OutboxEnvelope): Promise<void> {
    const p = ev.payload as unknown as SupplierPayoutCreatedPayload;
    if (!p?.payoutId) return;
    if (await this.eventBus.isProcessed(SUPPLIER_CONSUMER, ev.id)) return;
    try {
      await this.prisma.$transaction(async (tx) => {
        if (await tx.inboxEvent.findUnique({ where: { consumerId_eventId: { consumerId: SUPPLIER_CONSUMER, eventId: ev.id } } })) return;
        const payout = await tx.supplierPayout.findUnique({ where: { id: p.payoutId } });
        if (!payout?.orderId) { await tx.inboxEvent.create({ data: { consumerId: SUPPLIER_CONSUMER, eventId: ev.id } }); return; }
        const type = payout.direction === "INCOMING" ? "REFUND" : "PARTIAL_PAYMENT";
        const existing = await tx.document.findFirst({ where: { type, sourceId: p.payoutId } });
        if (existing) { await tx.inboxEvent.create({ data: { consumerId: SUPPLIER_CONSUMER, eventId: ev.id } }); return; }
        const order = await tx.order.findUnique({ where: { id: payout.orderId } });
        if (!order) return;
        const booking = await tx.booking.findFirst({ where: { orderId: order.id }, orderBy: { createdAt: "desc" } });
        if (!booking) return;
        const { id, code } = await this.documents.createDocument(tx, {
          type, sourceId: p.payoutId, bookingId: booking.id, orderId: order.id, customerId: order.customerId,
          totalAmount: order.amount, paidAmount: order.paidAmount, currency: p.currency, paymentStatus: order.paymentStatus,
        });
        await this.documents.issueDocument(tx, id, `SupplierPayoutCreated (${p.payoutCode})`, {
          code, bookingCode: booking.code, orderCode: order.code, serviceName: "Supplier settlement",
          totalAmount: order.amount.toString(), paidAmount: p.amount, remainingAmount: null,
          currency: p.currency, paymentStatus: order.paymentStatus,
        });
        await tx.inboxEvent.create({ data: { consumerId: SUPPLIER_CONSUMER, eventId: ev.id } });
      });
    } catch (err) {
      this.logger.error(`Supplier payment document error: ${err}`);
      throw err;
    }
  }
}
