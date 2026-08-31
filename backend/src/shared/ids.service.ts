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
   * Инкремент выполняется атомарным upsert-ом на ВЫДЕЛЕННОМ клиенте seqClient
   * (Step 2.17B remediation, Workstream B).
   *
   * Доказано микро-бенчмарком (50 concurrent, работа 50ms): upsert внутри доменной
   * транзакции держит row-lock строки-счётчика до commit домена → все цепочки
   * сериализуются на общем prefix (p95 ~3.1s). Выделенный клиент исполняет upsert
   * одиночным autocommit-statement: lock держится только ~2ms, сериализация
   * исчезает (p95 ~148ms).
   *
   * FINAL REMEDIATION (Round 3, Workstream B): Hi/Lo (block) allocation.
   * Микро-бенчмарк 50-way конкуренции на ОДНОМ prefix-row показал, что даже
   * короткая явная tx на seqClient сериализует аллокации на row-lock счётчика:
   * nextCode(PAY) при concurrency 50 → p50 257ms / p95 287ms (конвой 50×~5ms
   * lock-hold на общем prefix). Это удерживает доменные транзакции open
   * (idle-in-transaction), насыщает connection pool и раздувает каждый шаг
   * цепочки Booking/Order и payment.create. Решение — блочная аллокация
   * (Hi/Lo): процесс один раз атомарно забирает блок BUSINESS_SEQUENCE_BLOCK_SIZE
   * (default 100) значений с общего счётчика, остальные 99 аллокаций
   * обслуживаются из памяти БЕЗ row-lock. Конкуренция на счётчик падает с
   * per-allocation до per-block (~100×). Уникальность сохранена (непересекающиеся
   * блоки на атомарном инкременте), multi-instance безопасно.
   *
   * Параметр tx (транзакция домена) сохранён для совместимости вызывающих кодов
   * и НЕ используется: аллокация намеренно вынесена из доменной транзакции.
   * Откат доменной транзакции НЕ откатывает счётчик — допустимый gap
   * последовательности (как у нативных PG sequences; блочная аллокация
   * увеличивает возможный gap до blockSize-1 на блок, включая crash между
   * claim и использованием — контракт ID Policy сохраняется).
   */
  private readonly blockSize = Number(process.env.BUSINESS_SEQUENCE_BLOCK_SIZE ?? 100);
  /** Per-process Hi/Lo кэш: prefix → следующий свободный код (end — включительно). */
  private readonly cache = new Map<string, { next: number; end: number }>();
  /** Per-prefix claim gate: сериализует claims блока внутри процесса (Hi/Lo). */
  private readonly claims = new Map<string, Promise<unknown>>();

  async nextCode(_tx: Prisma.TransactionClient, prefix: string, digits = 8): Promise<string> {
    const value = await this.allocate(prefix);
    return `${prefix}-${String(value).padStart(digits, "0")}`;
  }

  private allocate(prefix: string): Promise<number> {
    // Fast path: кэшированный блок.
    const block = this.cache.get(prefix);
    if (block && block.next <= block.end) {
      return Promise.resolve(block.next++);
    }
    // Свежий блок: ровно ОДИН claim в полёте на prefix (пери-процессный mutex).
    // Без гейта конкурентные первые аллокации сделали бы N claims (N блоков —
    // уникально, но неупорядоченно и с дырами ×N). Цепочка: ожидающие дождутся
    // текущего claim, затем перечитают кэш и возьмут код из него.
    const prior = this.claims.get(prefix) ?? Promise.resolve();
    const run = prior.then(async () => {
      const again = this.cache.get(prefix);
      if (again && again.next <= again.end) {
        return again.next++;
      }
      // Один атомарный upsert на общем счётчике (seqClient, короткая явная tx).
      // update: value += blockSize → блок [old+1 .. old+blockSize];
      // create (первая аллокация): value = blockSize → блок [1 .. blockSize].
      const claimed = await this.prisma.seqClient.$transaction((tx) =>
        tx.businessSequence.upsert({
          where: { prefix },
          update: { value: { increment: this.blockSize } },
          create: { prefix, value: this.blockSize },
        }),
      );
      // Первое значение блока отдаётся ИЗ кэша (fresh.next++), чтобы указатель
      // кэша сразу продвинулся — иначе первый код блока был бы выдан дважды.
      const fresh = { next: claimed.value - this.blockSize + 1, end: claimed.value };
      this.cache.set(prefix, fresh);
      return fresh.next++;
    });
    // Следующий waiter цепляется за этот claim; ошибки не рвут цепочку.
    this.claims.set(prefix, run.catch(() => undefined));
    return run;
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

  /**
   * Step 3.12 — Storefront stable short code: SF001, SF002, ...
   * Uses Hi/Lo block allocation on BusinessSequence (same concurrency-safe
   * mechanism as nextCode). Prefix "SF" reserves a dedicated sequence namespace.
   * Output format: SF + 3-digit zero-padded sequence (no hyphen — compact).
   */
  async nextStorefrontCode(_tx: Prisma.TransactionClient): Promise<string> {
    const value = await this.allocate("SF");
    return `SF${String(value).padStart(3, "0")}`;
  }
}
