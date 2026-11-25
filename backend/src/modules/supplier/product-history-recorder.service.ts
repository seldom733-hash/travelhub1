import { Injectable } from "@nestjs/common";
import { Prisma } from "../../generated/prisma/client";

/**
 * Запись истории изменения Product при синке поставщика.
 *
 * Вызывается ВНУТРИ той же транзакции, что и обновление продукта: если
 * транзакция откатится, истории не останется. Пишем только реально изменённые
 * поля — синк идемпотентен, и пустые записи замусорили бы аудит.
 */
@Injectable()
export class ProductHistoryRecorder {
  async record(
    tx: Prisma.TransactionClient,
    productId: string,
    version: number,
    changes: Record<string, unknown>,
    action = "supplier.sync",
    actorId: string | null = null,
  ): Promise<void> {
    const fields: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(changes ?? {})) {
      if (value === undefined) continue;
      fields[key] = value;
    }
    if (Object.keys(fields).length === 0) return;
    await tx.productHistory.create({
      data: {
        productId,
        version,
        action,
        fields: fields as Prisma.InputJsonValue,
        actorId,
        comment: "supplier sync",
      },
    });
  }
}
