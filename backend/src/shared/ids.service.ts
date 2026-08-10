import { Injectable } from "@nestjs/common";
import type { Prisma } from "../generated/prisma/client";
import { PrismaService } from "../prisma/prisma.service";

/**
 * Каноническая ID Policy (Baseline §0.8).
 *
 * Бизнес-идентификаторы неизменяемы, генерируются ТОЛЬКО доменом-владельцем,
 * атомарным инкрементом счётчика (таблица events.BusinessSequence):
 *   PRD-* Product, ORD-* Order, BKG-* Booking, CUS-* Customer,
 *   CNT-* Contact, CAT-* Category, TRF-* Tariff, SUP-*, PAR-*, COM-*,
 *   TH-YYYY-###### — пользовательский номер Order (последовательность по году).
 */
@Injectable()
export class IdsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Следующий канонический код: {prefix}-{N}, N слева дополнен нулями до digits.
   * Инкремент выполняется upsert-ом в рамках транзакции домена — атомарно.
   */
  async nextCode(tx: Prisma.TransactionClient, prefix: string, digits = 8): Promise<string> {
    const seq = await tx.businessSequence.upsert({
      where: { prefix },
      update: { value: { increment: 1 } },
      create: { prefix, value: 1 },
    });
    return `${prefix}-${String(seq.value).padStart(digits, "0")}`;
  }

  /** Пользовательский номер заказа TH-YYYY-###### (последовательность сквозная по году).
   *  Год — по UTC (canonical time convention проекта; Step 2.5 §7). */
  async nextOrderNumber(tx: Prisma.TransactionClient, year = new Date().getUTCFullYear()): Promise<string> {
    return this.nextCode(tx, `TH-${year}`, 6);
  }

  /** Код пользователя/клиента: CUS-* для клиентов, USR-* для персонала (вне Phase 1). */
  async nextCustomerCode(tx: Prisma.TransactionClient): Promise<string> {
    return this.nextCode(tx, "CUS");
  }
}
