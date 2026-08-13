/**
 * PHASE 2 STEP 2.10A — LedgerService (immutable LedgerTransaction foundation).
 *
 * Ledger — IMMUTABLE record of financial facts, НЕ mutable operational object
 * (Roadmap 2.10A: «Append-only LedgerTransaction. Финансовая история не
 * восстанавливается из текущего Payment status»).
 *
 * Контракт:
 *  - ровно один canonical creation path (этот сервис, внутренний Finance API);
 *    публичного POST нет (Roadmap не требует manual journal API, §13 option A);
 *  - amount > 0 DECIMAL(12,2) (платформенный money-контракт), экономический
 *    смысл несёт type; currency — ISO 4217 снапшот, валидируется против
 *    finance.Currency (без FK);
 *  - idempotency invariant: @@unique([sourceType, sourceId, type]) — replay
 *    одного canonical source fact возвращает существующий факт (no-op);
 *    неизвестный P2002 (например LTX code collision) — controlled 409, НЕ raw 500;
 *  - correlation/causation/actor — server-authoritative из request context
 *    (ADR-0010), никогда из body;
 *  - immutability: нет update/updateMany/delete путей, нет updatedAt колонки;
 *  - double-entry/account chart/balances/reversal — НЕ в 2.10A (без
 *    канонического контракта; задокументировано в arch artifact);
 *  - событие НЕ эмитится (нет consumer-а/канонического источника).
 */
import { Injectable } from "@nestjs/common";
import { Prisma } from "../../generated/prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { IdsService } from "../../shared/ids.service";
import { SecurityService } from "../../security/security.service";
import { ConflictError, NotFoundError, ValidationDomainError } from "../../shared/errors";
import { uniqueConstraintNames } from "../../shared/prisma-errors";
import { getRequestContext } from "../../shared/request-context";
import { validateIsoCode, validateLedgerAmount } from "./finance.validation";

/** Idempotency unique constraint: ровно один факт данного типа на source. */
const LEDGER_IDEMPOTENCY_CONSTRAINT = "LedgerTransaction_sourceType_sourceId_type_key";

export interface LedgerCreateInput {
  /** Immutable amount > 0 (Decimal string, ≤2 dp). */
  amount: string;
  /** ISO 4217 снапшот (валидируется против finance.Currency). */
  currency: string;
  /** Классификация факта (String; словарь значений — с producer-шагом 2.12+). */
  type: string;
  /** Домен-производитель (ORDER/BOOKING/PAYMENT/...). */
  sourceType: string;
  /** Каноническая ссылка на source aggregate/entity. */
  sourceId: string;
  /** Провенанс: event id, если факт порождён event-ом (provenance-only). */
  sourceEventId?: string | null;
  /** Опциональный human-readable business ref. */
  businessRef?: string | null;
}

export interface LedgerListQuery {
  sourceType?: string;
  type?: string;
  currency?: string;
  page?: number;
  pageSize?: number;
}

@Injectable()
export class LedgerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ids: IdsService,
    private readonly security: SecurityService,
  ) {}

  /**
   * Canonical creation path (внутренний Finance API; единственный production
   * writer). Атомарно в одной transaction: LTX-аллокация + create + AuditLog.
   */
  async create(input: LedgerCreateInput): Promise<Record<string, unknown>> {
    const amount = validateLedgerAmount(input.amount);
    const currency = validateIsoCode(input.currency, "currency");
    const sourceType = this.assertNonEmpty(input.sourceType, "sourceType");
    const sourceId = this.assertNonEmpty(input.sourceId, "sourceId");
    const type = this.assertNonEmpty(input.type, "type");

    // Currency authority: ISO 4217 снапшот должен существовать в finance.Currency
    // (inactive допустим — исторические факты сохраняются; без FK, read-by-code).
    const cur = await this.prisma.currency.findUnique({ where: { isoCode: currency }, select: { isoCode: true } });
    if (!cur) throw new ValidationDomainError(`Unknown currency ${currency}; register it in finance.Currency first`);

    const ctx = getRequestContext();
    const actor = ctx?.actor ?? null;
    const actorType = actor ? actor.type : null;
    const actorId = actor?.type === "USER" ? actor.id : actor?.type === "SYSTEM" ? (actor.id ?? null) : null;

    try {
      return await this.prisma.$transaction(async (tx) => {
        const code = await this.ids.nextCode(tx, "LTX");
        const row = await tx.ledgerTransaction.create({
          data: {
            code,
            amount: new Prisma.Decimal(amount),
            currency,
            type,
            sourceType,
            sourceId,
            sourceEventId: input.sourceEventId ?? null,
            businessRef: input.businessRef ?? null,
            correlationId: ctx?.correlationId ?? null,
            causationId: ctx?.causationId ?? null,
            actorType,
            actorId,
          },
        });
        await this.security.audit(tx, {
          action: "finance.ledger_transaction.created",
          resource: "LedgerTransaction",
          resourceId: row.id,
          details: { code },
        });
        return this.ledgerDto(row);
      });
    } catch (err) {
      // Replay/idempotency: тот же canonical source fact → детерминированный
      // no-op ТОЛЬКО при идентичном финансовом payload (first-write-wins + верификация).
      const constraints = uniqueConstraintNames(err);
      if (constraints.includes(LEDGER_IDEMPOTENCY_CONSTRAINT)) {
        const existing = await this.prisma.ledgerTransaction.findUnique({
          where: { sourceType_sourceId_type: { sourceType, sourceId, type } },
        });
        if (existing) {
          // Immutable факт-поля обязаны совпадать (amount/currency/sourceEventId/
          // businessRef). Расхождение = producer-баг/другое событие — громкий 409,
          // НЕ молчаливый возврат существующего (STRICT REVIEW 2.10A FIX 1).
          const samePayload =
            existing.amount.toString() === new Prisma.Decimal(amount).toString() &&
            existing.currency === currency &&
            (existing.sourceEventId ?? null) === (input.sourceEventId ?? null) &&
            (existing.businessRef ?? null) === (input.businessRef ?? null);
          if (samePayload) return this.ledgerDto(existing);
          throw new ConflictError(
            `LedgerTransaction ${existing.code} already exists for ${sourceType}/${sourceId}/${type} with different payload`,
          );
        }
      }
      // Любой другой P2002 (например LTX_code_key) — controlled conflict, не маскируем.
      if (constraints.length > 0) throw new ConflictError("Ledger transaction conflict");
      throw err;
    }
  }

  /** Минимальный read contract (Finance Center ledger view): whitelist + пагинация. */
  async list(query: LedgerListQuery): Promise<{ items: Array<Record<string, unknown>>; total: number; page: number; pageSize: number; hasMore: boolean }> {
    const page = query.page ?? 1;
    const pageSize = Math.min(query.pageSize ?? 50, 100);
    const where: Prisma.LedgerTransactionWhereInput = {
      ...(query.sourceType ? { sourceType: query.sourceType } : {}),
      ...(query.type ? { type: query.type } : {}),
      ...(query.currency ? { currency: query.currency } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.ledgerTransaction.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { code: "asc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.ledgerTransaction.count({ where }),
    ]);
    return { items: items.map((r) => this.ledgerDto(r)), total, page, pageSize, hasMore: page * pageSize < total };
  }

  async getByCode(code: string): Promise<Record<string, unknown>> {
    const row = await this.prisma.ledgerTransaction.findUnique({ where: { code } });
    if (!row) throw new NotFoundError(`LedgerTransaction ${code} not found`);
    return this.ledgerDto(row);
  }

  private assertNonEmpty(value: string, label: string): string {
    const v = value.trim();
    if (!v) throw new ValidationDomainError(`${label} must be a non-empty string`);
    return v;
  }

  /** Whitelist DTO — внутренние/технические детали НЕ сериализуются сверх контракта. */
  private ledgerDto(r: {
    id: string;
    code: string;
    amount: Prisma.Decimal;
    currency: string;
    type: string;
    sourceType: string;
    sourceId: string;
    sourceEventId: string | null;
    businessRef: string | null;
    correlationId: string | null;
    causationId: string | null;
    actorType: string | null;
    actorId: string | null;
    createdAt: Date;
  }): Record<string, unknown> {
    return {
      id: r.id,
      code: r.code,
      amount: r.amount.toString(),
      currency: r.currency,
      type: r.type,
      sourceType: r.sourceType,
      sourceId: r.sourceId,
      sourceEventId: r.sourceEventId,
      businessRef: r.businessRef,
      correlationId: r.correlationId,
      causationId: r.causationId,
      actorType: r.actorType,
      actorId: r.actorId,
      createdAt: r.createdAt.toISOString(),
    };
  }
}
