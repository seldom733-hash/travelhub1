import { Injectable } from "@nestjs/common";
import type { Prisma } from "../../generated/prisma/client";
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

    // Step 1.17: field-level redaction — passenger PII виден только OPERATOR/ADMIN.
    return {
      ...booking,
      passengers: redactTravelersPii(booking.passengers ?? [], viewer),
      orderCode: orderDisplay?.referenceNumber ?? null,
      productTitle: productDisplay?.title ?? null,
    };
  }
}
