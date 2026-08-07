import { Injectable } from "@nestjs/common";
import type { Prisma } from "../../generated/prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { NotFoundError } from "../../shared/errors";

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
  async getByOrderId(orderId: string) {
    return this.prisma.booking.findMany({
      where: { orderId },
      orderBy: { createdAt: "asc" },
      include: { passengers: true },
    });
  }

  async getById(id: string) {
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
    return booking;
  }
}
