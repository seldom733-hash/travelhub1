import { Injectable } from "@nestjs/common";
import { Prisma } from "../../generated/prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { NotFoundError } from "../../shared/errors";
import { redactTravelersPii, type TravelerViewer } from "../../shared/pii";

/**
 * Read-only доступ к данным Booking Center для других доменов
 * (Order подписывается на BookingConfirmed и читает состояние броней).
 * Никаких записей — только чтение по ID/заказу.
 */
@Injectable()
export class BookingQueryService {
  constructor(private readonly prisma: PrismaService) {}

  /** Статусы всех броней заказа (для агрегации Order). */
  async getStatusesByOrderId(tx: Prisma.TransactionClient, orderId: string): Promise<string[]> {
    const rows = await tx.booking.findMany({ where: { orderId }, select: { status: true } });
    return rows.map((b) => b.status);
  }

  /** Полные брони заказа (список связанных сущностей). */
  async getByOrderId(orderId: string, viewer?: TravelerViewer) {
    const rows = await this.prisma.booking.findMany({
      where: { orderId },
      orderBy: { createdAt: "asc" },
      include: { passengers: true },
    });
    // Step 1.17: field-level redaction — passenger PII виден только OPERATOR/ADMIN.
    return rows.map((b) => ({ ...b, passengers: redactTravelersPii(b.passengers ?? [], viewer) }));
  }

  async getById(id: string, viewer?: TravelerViewer) {
    const booking = await this.prisma.booking.findUnique({
      where: { id },
      include: {
        passengers: true,
        reservations: true,
        supplierConfirmations: { orderBy: { receivedAt: "desc" } },
        history: { orderBy: { createdAt: "desc" }, take: 100 },
      },
    });
    if (!booking) throw new NotFoundError(`Booking ${id} not found`);

    // D4 §10/§21: Storefront-tenant Booking не читается через platform
    // marketplace read-контракт (HTTP viewer присутствует → 404, direct UUID
    // enumeration denied). Внутренние вызовы без viewer (trusted) остаются.
    if (viewer && booking.acquisitionSource === "PARTNER_STOREFRONT") {
      throw new NotFoundError(`Booking ${id} not found`);
    }

    // ── Related-entity display name enrichment (Round 2E.2R.1) ──
    // Batch-resolve order code + product title (no N+1)
    let orderDisplay: { id: string; referenceNumber: string } | null = null;
    let productDisplay: { id: string; title: string } | null = null;

    if (booking.orderId) {
      const o = await this.prisma.order.findUnique({
        where: { id: booking.orderId },
        select: { id: true, referenceNumber: true },
      });
      if (o) orderDisplay = { id: o.id, referenceNumber: o.referenceNumber };
    }
    if (booking.productId) {
      const prod = await this.prisma.product.findUnique({
        where: { id: booking.productId },
        select: { id: true, title: true },
      });
      if (prod) productDisplay = { id: prod.id, title: prod.title };
    }

    // D7: fetch linked Order financial summary for Booking detail
    let financialSummary: Record<string, unknown> | null = null;
    if (booking.orderId) {
      const order = await this.prisma.order.findUnique({
        where: { id: booking.orderId },
        select: {
          id: true, amount: true, currency: true, paidAmount: true,
          refundedAmount: true, paymentStatus: true, status: true,
        },
      });
      if (order) {
        const totalAmt = new Prisma.Decimal(order.amount ?? 0);
        const paidAmt = new Prisma.Decimal(order.paidAmount ?? 0);
        const refundedAmt = new Prisma.Decimal(order.refundedAmount ?? 0);
        const dueAmount = Prisma.Decimal.max(new Prisma.Decimal(0), totalAmt.minus(paidAmt));
        const refundableAmount = Prisma.Decimal.max(new Prisma.Decimal(0), paidAmt.minus(refundedAmt));
        financialSummary = {
          totalAmount: order.amount,
          paidAmount: order.paidAmount,
          refundedAmount: order.refundedAmount,
          dueAmount: dueAmount.toString(),
          refundableAmount: refundableAmount.toString(),
          netCollected: refundableAmount.toString(),
          currency: order.currency,
          paymentStatus: order.paymentStatus,
          orderStatus: order.status,
        };
      }
    }

    // D7: fetch active Payment reference if exists
    let activePayment: Record<string, unknown> | null = null;
    if (booking.orderId) {
      const payment = await this.prisma.payment.findFirst({
        where: { orderId: booking.orderId, isActivePayment: true },
        select: {
          id: true, code: true, referenceNumber: true, status: true,
          amount: true, currency: true, paymentMethod: true, providerRef: true,
        },
      });
      if (payment) {
        activePayment = {
          id: payment.id,
          code: payment.code,
          referenceNumber: payment.referenceNumber,
          status: payment.status,
          amount: payment.amount,
          currency: payment.currency,
          paymentMethod: payment.paymentMethod,
        };
      }
    }

    // Step 1.17: field-level redaction — passenger PII виден только OPERATOR/ADMIN.
    return {
      ...booking,
      passengers: redactTravelersPii(booking.passengers ?? [], viewer),
      orderCode: orderDisplay?.referenceNumber ?? null,
      productTitle: productDisplay?.title ?? null,
      financialSummary,
      activePayment,
    };
  }
}
