import { Injectable } from "@nestjs/common";
import type { Prisma } from "../generated/prisma/client";
import { PrismaService } from "../prisma/prisma.service";

/**
 * Каноническая ID Policy (Baseline §0.8).
 *
 * Бизнес-идентификаторы неизменяемы, генерируются ТОЛЬКО доменом-владельцем,
 * атомарным инкрементом счётчика (таблица events.BusinessSequence):
 *   PRD-* Product, ORD-* Order, BKG-* Booking, CUS-* Customer,
 *   CNT-* Contact, CAT-* Category, TRF-* Tariff, SUP-*, PRN-*, COM-*,
 *   TH-YYYY-###### — пользовательский номер Order (последовательность по году).
 *
 * СПЛОШНАЯ (contiguous) последовательность — Owner Decision (Аудит нумераций):
 *   - каждая аллокация = ровно ОДИН атомарный upsert `value += 1` на строке
 *     счётчика; Hi/Lo-блочная аллокация (Step 2.17B, block size 100) УДАЛЕНА —
 *     хвосты блоков больше не сжигаются, перезапуск процесса не влияет на
 *     последовательность (in-memory состояния нет вообще);
 *   - инкремент исполняется на клиенте, переданном вызывающим:
 *       • доменная tx → row-lock счётчика держится до commit домена;
 *         откат доменной транзакции ВОЗВРАЩАЕТ номер счётчику (нет gap);
 *       • legacy-вызовы без tx (`null` / global prisma) → autocommit-инкремент
 *         на глобальном клиенте (номер не возвращается при откате домена —
 *         допустимый редкий gap, как у нативных PG sequences);
 *   - multi-instance безопасно: сериализация через row-lock строки-счётчика PG.
 *
 * Компромисс (задокументирован сознательно): per-allocation row-lock в доменной
 * tx удерживается до её commit → при 50-way бёрсте на ОДНОМ prefix цепочки
 * сериализуются (Step 2.17B мерил p95 ~3.1s против ~148ms с Hi/Lo). По
 * решению владельца сплошность нумерации приоритетнее бёрст-производительности;
 * переменные BUSINESS_SEQUENCE_BLOCK_SIZE / REFERENCE_SEQUENCE_BLOCK_SIZE
 * больше не используются кодом.
 */
@Injectable()
export class IdsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Следующий канонический код: {prefix}-{N}, N слева дополнен нулями до digits.
   * tx передаётся доменом-владельцем — инкремент выполняется В его транзакции
   * (rollback домена возвращает номер). Без tx — autocommit на глобальном клиенте.
   */
  async nextCode(tx: Prisma.TransactionClient | null, prefix: string, digits = 8): Promise<string> {
    const value = await this.allocate(tx, prefix);
    return `${prefix}-${String(value).padStart(digits, "0")}`;
  }

  /** Атомарный increment +1. Прямой, без кэша/блоков/claim-гейтов: один вызов =
   *  один upsert = ровно один следующий номер (сплошная последовательность). */
  private async allocate(tx: Prisma.TransactionClient | null, prefix: string): Promise<number> {
    const client = (tx && typeof (tx as { businessSequence?: unknown }).businessSequence !== "undefined"
      ? tx
      : this.prisma) as unknown as Prisma.TransactionClient;
    const record = await client.businessSequence.upsert({
      where: { prefix },
      update: { value: { increment: 1 } },
      create: { prefix, value: 1 },
    });
    return record.value;
  }

  /** Пользовательский номер заказа TH-YYYY-###### (последовательность сквозная по году).
   *  Год — по UTC (canonical time convention проекта; Step 2.5 §7). */
  async nextOrderNumber(tx: Prisma.TransactionClient | null, year = new Date().getUTCFullYear()): Promise<string> {
    return this.nextCode(tx, `TH-${year}`, 6);
  }

  /** Код пользователя/клиента: CUS-* для клиентов, USR-* для персонала (вне Phase 1). */
  async nextCustomerCode(tx: Prisma.TransactionClient | null): Promise<string> {
    return this.nextCode(tx, "CUS");
  }

  /**
   * Step 3.12 — Storefront stable short code: SF001, SF002, ...
   * Output format: SF + 3-digit zero-padded sequence (no hyphen — compact).
   *
   * Аудит нумераций: внутренний code (`SF-00000001`, nextCode(tx, "SF")) и
   * публичный storefrontCode (`SF001`) РАНЕЕ делили ОДНУ строку "SF" → публичные
   * коды шли с интерливом (SF002, SF004, ...). Разделены на ДВЕ независимые
   * сплошные последовательности: "SF" — только внутренний code,
   * "SFPUB" — только публичный storefrontCode.
   */
  async nextStorefrontCode(tx: Prisma.TransactionClient | null): Promise<string> {
    const value = await this.allocate(tx, "SFPUB");
    return `SF${String(value).padStart(3, "0")}`;
  }
}
