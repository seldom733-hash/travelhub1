/**
 * PHASE 2 STEP 2.10B — SettlementService (ProviderFee / Settlement / Payout
 * foundation).
 *
 * Finance-owned financial operational FACTS (Screen Design §456):
 *  - ProviderFee — immutable факт комиссии внешнего провайдера (PSP/bank),
 *    ОТДЕЛЬНО от TravelHub Commission (2.12C/E); не вычисляется «по проценту»
 *    без canonical source fact; не PSP-интеграция (providerRef — провенанс);
 *  - Settlement — durable факт сведения денежных обязательств (без balance/
 *    net-payable/periods/status — lifecycle/engine будущие шаги);
 *  - Payout — операционная запись выплаты Partner (bank rail), БЕЗ реальных
 *    PSP calls, bank credentials/PII, Stripe Connect assumptions.
 *
 * Никакой double-entry/balance/ledger-автопостинга: эти факты НЕ пишут
 * LedgerTransaction (единственный ledger writer — LedgerService, 2.10A
 * append-only сохраняется). Payment/Refund/Invoice/Commission runtime — deferred.
 *
 * Контракт (как Ledger 2.10A):
 *  - единственный canonical creation path (внутренний Finance API; публичного
 *    POST нет); read — Finance Center view;
 *  - amount > 0 DECIMAL(12,2), currency — ISO 4217 снапшот против
 *    finance.Currency (без FK);
 *  - idempotency: DB unique (ProviderFee: sourceType+sourceId+provider;
 *    Settlement/Payout: sourceType+sourceId) — first-write-wins + payload
 *    верификация (amount/currency/providerRef); divergent replay → 409,
 *    неизвестный P2002 → controlled conflict, НЕ raw 500;
 *  - correlation/causation/actor — server-authoritative из request context
 *    (ADR-0010); события НЕ эмитятся (нет consumer-ов).
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

/** Idempotency unique constraints (см. schema). */
const PFE_IDEMPOTENCY_CONSTRAINT = "ProviderFee_sourceType_sourceId_provider_key";
const STL_IDEMPOTENCY_CONSTRAINT = "Settlement_sourceType_sourceId_key";
const POT_IDEMPOTENCY_CONSTRAINT = "Payout_sourceType_sourceId_key";

export interface ProviderFeeCreateInput {
  provider: string;
  amount: string;
  currency: string;
  providerRef?: string | null;
  sourceType: string;
  sourceId: string;
}

export interface SettlementCreateInput {
  amount: string;
  currency: string;
  sourceType: string;
  sourceId: string;
}

export interface PayoutCreateInput {
  amount: string;
  currency: string;
  providerRef?: string | null;
  sourceType: string;
  sourceId: string;
}

export interface FactListQuery {
  sourceType?: string;
  currency?: string;
  page?: number;
  pageSize?: number;
}

@Injectable()
export class SettlementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ids: IdsService,
    private readonly security: SecurityService,
  ) {}

  // ── ProviderFee ─────────────────────────────────────────────────────────────

  async createProviderFee(input: ProviderFeeCreateInput): Promise<Record<string, unknown>> {
    const amount = validateLedgerAmount(input.amount);
    const currency = validateIsoCode(input.currency, "currency");
    const provider = this.assertNonEmpty(input.provider, "provider");
    const sourceType = this.assertNonEmpty(input.sourceType, "sourceType");
    const sourceId = this.assertNonEmpty(input.sourceId, "sourceId");

    await this.assertCurrencyKnown(currency);

    const ctx = getRequestContext();
    return this.idempotentCreate({
      prefix: "PFE",
      action: "finance.provider_fee.created",
      constraint: PFE_IDEMPOTENCY_CONSTRAINT,
      key: { sourceType, sourceId, provider },
      create: (tx, code) =>
        tx.providerFee.create({
          data: {
            code,
            provider,
            amount: new Prisma.Decimal(amount),
            currency,
            providerRef: input.providerRef ?? null,
            sourceType,
            sourceId,
            correlationId: ctx?.correlationId ?? null,
            causationId: ctx?.causationId ?? null,
            actorType: ctx?.actor ? ctx.actor.type : null,
            actorId: ctx?.actor?.type === "USER" ? ctx.actor.id : ctx?.actor?.type === "SYSTEM" ? (ctx.actor.id ?? null) : null,
          },
        }),
      payload: { amount, currency, providerRef: input.providerRef ?? null },
      fetchExisting: () =>
        this.prisma.providerFee.findUnique({
          where: { sourceType_sourceId_provider: { sourceType, sourceId, provider } },
        }),
      toDto: (row) => this.providerFeeDto(row),
      resource: "ProviderFee",
    });
  }

  async listProviderFees(query: FactListQuery) {
    return this.listFacts(query, (where) => this.prisma.providerFee.findMany(where), (where) => this.prisma.providerFee.count(where), (r) => this.providerFeeDto(r));
  }

  async getProviderFeeByCode(code: string): Promise<Record<string, unknown>> {
    const row = await this.prisma.providerFee.findUnique({ where: { code } });
    if (!row) throw new NotFoundError(`ProviderFee ${code} not found`);
    return this.providerFeeDto(row);
  }

  // ── Settlement ──────────────────────────────────────────────────────────────

  async createSettlement(input: SettlementCreateInput): Promise<Record<string, unknown>> {
    const amount = validateLedgerAmount(input.amount);
    const currency = validateIsoCode(input.currency, "currency");
    const sourceType = this.assertNonEmpty(input.sourceType, "sourceType");
    const sourceId = this.assertNonEmpty(input.sourceId, "sourceId");

    await this.assertCurrencyKnown(currency);

    const ctx = getRequestContext();
    return this.idempotentCreate({
      prefix: "STL",
      action: "finance.settlement.created",
      constraint: STL_IDEMPOTENCY_CONSTRAINT,
      key: { sourceType, sourceId },
      create: (tx, code) =>
        tx.settlement.create({
          data: {
            code,
            amount: new Prisma.Decimal(amount),
            currency,
            sourceType,
            sourceId,
            correlationId: ctx?.correlationId ?? null,
            causationId: ctx?.causationId ?? null,
            actorType: ctx?.actor ? ctx.actor.type : null,
            actorId: ctx?.actor?.type === "USER" ? ctx.actor.id : ctx?.actor?.type === "SYSTEM" ? (ctx.actor.id ?? null) : null,
          },
        }),
      payload: { amount, currency },
      fetchExisting: () =>
        this.prisma.settlement.findUnique({
          where: { sourceType_sourceId: { sourceType, sourceId } },
        }),
      toDto: (row) => this.settlementDto(row),
      resource: "Settlement",
    });
  }

  async listSettlements(query: FactListQuery) {
    return this.listFacts(query, (where) => this.prisma.settlement.findMany(where), (where) => this.prisma.settlement.count(where), (r) => this.settlementDto(r));
  }

  async getSettlementByCode(code: string): Promise<Record<string, unknown>> {
    const row = await this.prisma.settlement.findUnique({ where: { code } });
    if (!row) throw new NotFoundError(`Settlement ${code} not found`);
    return this.settlementDto(row);
  }

  // ── Payout ──────────────────────────────────────────────────────────────────

  async createPayout(input: PayoutCreateInput): Promise<Record<string, unknown>> {
    const amount = validateLedgerAmount(input.amount);
    const currency = validateIsoCode(input.currency, "currency");
    const sourceType = this.assertNonEmpty(input.sourceType, "sourceType");
    const sourceId = this.assertNonEmpty(input.sourceId, "sourceId");

    await this.assertCurrencyKnown(currency);

    const ctx = getRequestContext();
    return this.idempotentCreate({
      prefix: "POT",
      action: "finance.payout.created",
      constraint: POT_IDEMPOTENCY_CONSTRAINT,
      key: { sourceType, sourceId },
      create: (tx, code) =>
        tx.payout.create({
          data: {
            code,
            amount: new Prisma.Decimal(amount),
            currency,
            providerRef: input.providerRef ?? null,
            sourceType,
            sourceId,
            correlationId: ctx?.correlationId ?? null,
            causationId: ctx?.causationId ?? null,
            actorType: ctx?.actor ? ctx.actor.type : null,
            actorId: ctx?.actor?.type === "USER" ? ctx.actor.id : ctx?.actor?.type === "SYSTEM" ? (ctx.actor.id ?? null) : null,
          },
        }),
      payload: { amount, currency, providerRef: input.providerRef ?? null },
      fetchExisting: () =>
        this.prisma.payout.findUnique({
          where: { sourceType_sourceId: { sourceType, sourceId } },
        }),
      toDto: (row) => this.payoutDto(row),
      resource: "Payout",
    });
  }

  async listPayouts(query: FactListQuery) {
    return this.listFacts(query, (where) => this.prisma.payout.findMany(where), (where) => this.prisma.payout.count(where), (r) => this.payoutDto(r));
  }

  async getPayoutByCode(code: string): Promise<Record<string, unknown>> {
    const row = await this.prisma.payout.findUnique({ where: { code } });
    if (!row) throw new NotFoundError(`Payout ${code} not found`);
    return this.payoutDto(row);
  }

  // ── Shared ──────────────────────────────────────────────────────────────────

  /**
   * first-write-wins + payload-верификация (конвенция Ledger 2.10A STRICT
   * REVIEW FIX 1): совпадение ключа с ИДЕНТИЧНЫМ payload → no-op (существующий
   * факт); расходящийся payload → controlled 409; неизвестный P2002 →
   * controlled conflict; non-P2002 → rethrow. Raw 500 = 0.
   */
  private async idempotentCreate<TRow>(args: {
    prefix: string;
    /** AuditLog action (snake_case, конвенция finance.*: ledger/currency/tax_rule). */
    action: string;
    constraint: string;
    key: Record<string, string>;
    create: (tx: Prisma.TransactionClient, code: string) => Promise<TRow>;
    payload: Record<string, unknown>;
    fetchExisting: () => Promise<TRow | null>;
    toDto: (row: TRow) => Record<string, unknown>;
    resource: string;
  }): Promise<Record<string, unknown>> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const code = await this.ids.nextCode(tx, args.prefix);
        const row = await args.create(tx, code);
        const rowId = (row as { id: string }).id;
        await this.security.audit(tx, {
          action: args.action,
          resource: args.resource,
          resourceId: rowId,
          details: { code },
        });
        return args.toDto(row);
      });
    } catch (err) {
      const constraints = uniqueConstraintNames(err);
      if (constraints.includes(args.constraint)) {
        const existing = await args.fetchExisting();
        if (existing) {
          const e = existing as unknown as { amount: Prisma.Decimal; currency: string; providerRef: string | null };
          const samePayload =
            e.amount.toString() === new Prisma.Decimal(args.payload.amount as string).toString() &&
            e.currency === args.payload.currency &&
            (e.providerRef ?? null) === (args.payload.providerRef ?? null);
          if (samePayload) return args.toDto(existing);
          throw new ConflictError(
            `${args.resource} for ${Object.values(args.key).join("/")} already exists with different payload`,
          );
        }
      }
      if (constraints.length > 0) throw new ConflictError(`${args.resource} conflict`);
      throw err;
    }
  }

  private async assertCurrencyKnown(currency: string): Promise<void> {
    const cur = await this.prisma.currency.findUnique({ where: { isoCode: currency }, select: { isoCode: true } });
    if (!cur) throw new ValidationDomainError(`Unknown currency ${currency}; register it in finance.Currency first`);
  }

  private async listFacts<TRow>(
    query: FactListQuery,
    findMany: (args: { where: Record<string, unknown>; orderBy: Array<Record<string, string>>; skip: number; take: number }) => Promise<TRow[]>,
    count: (args: { where: Record<string, unknown> }) => Promise<number>,
    dto: (row: TRow) => Record<string, unknown>,
  ): Promise<{ items: Array<Record<string, unknown>>; total: number; page: number; pageSize: number; hasMore: boolean }> {
    const page = query.page ?? 1;
    const pageSize = Math.min(query.pageSize ?? 50, 100);
    const where: Record<string, unknown> = {
      ...(query.sourceType ? { sourceType: query.sourceType } : {}),
      ...(query.currency ? { currency: query.currency } : {}),
    };
    const [items, total] = await Promise.all([
      findMany({ where, orderBy: [{ createdAt: "desc" }, { code: "asc" }], skip: (page - 1) * pageSize, take: pageSize }),
      count({ where }),
    ]);
    return { items: items.map(dto), total, page, pageSize, hasMore: page * pageSize < total };
  }

  private assertNonEmpty(value: string, label: string): string {
    const v = value.trim();
    if (!v) throw new ValidationDomainError(`${label} must be a non-empty string`);
    return v;
  }

  // ── Whitelist DTOs ──────────────────────────────────────────────────────────

  private providerFeeDto(r: {
    id: string;
    code: string;
    provider: string;
    amount: Prisma.Decimal;
    currency: string;
    providerRef: string | null;
    sourceType: string;
    sourceId: string;
    correlationId: string | null;
    causationId: string | null;
    actorType: string | null;
    actorId: string | null;
    createdAt: Date;
  }): Record<string, unknown> {
    return {
      id: r.id,
      code: r.code,
      provider: r.provider,
      amount: r.amount.toString(),
      currency: r.currency,
      providerRef: r.providerRef,
      sourceType: r.sourceType,
      sourceId: r.sourceId,
      correlationId: r.correlationId,
      causationId: r.causationId,
      actorType: r.actorType,
      actorId: r.actorId,
      createdAt: r.createdAt.toISOString(),
    };
  }

  private settlementDto(r: {
    id: string;
    code: string;
    amount: Prisma.Decimal;
    currency: string;
    sourceType: string;
    sourceId: string;
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
      sourceType: r.sourceType,
      sourceId: r.sourceId,
      correlationId: r.correlationId,
      causationId: r.causationId,
      actorType: r.actorType,
      actorId: r.actorId,
      createdAt: r.createdAt.toISOString(),
    };
  }

  private payoutDto(r: {
    id: string;
    code: string;
    amount: Prisma.Decimal;
    currency: string;
    providerRef: string | null;
    sourceType: string;
    sourceId: string;
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
      providerRef: r.providerRef,
      sourceType: r.sourceType,
      sourceId: r.sourceId,
      correlationId: r.correlationId,
      causationId: r.causationId,
      actorType: r.actorType,
      actorId: r.actorId,
      createdAt: r.createdAt.toISOString(),
    };
  }
}
