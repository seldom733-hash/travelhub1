/**
 * Supplier payment registry (Finance completion, 2026-10-25).
 *
 * Реестр платежей поставщикам поверх существующего SupplierPayout:
 *   PENDING (зарегистрирован) → CONFIRMED (исполнен) → CANCELLED;
 * распределения (SupplierPayoutAllocation) связывают платёж с одним или
 * несколькими обязательствами; нераспределённый остаток виден отдельно.
 *
 * Деньги:
 *   - amount/currency — фактическое движение (валюта платежа);
 *   - aznAmount — management-эквивалент по курсу на дату регистрации (snapshot,
 *     stored; изменение текущего курса не переписывает платёж);
 *   - allocation.aznAmount — сумма в AZN; если валюта платежа совпадает с
 *     валютой обязательства и есть frozen fxRate — считается по нему, иначе
 *     требуется явный aznAmount (никогда не подставляем чужой курс).
 *
 * Инварианты:
 *   - только CONFIRMED влияет на paid/remaining обязательств;
 *   - сумма распределений ≤ суммы платежа (в AZN);
 *   - распределение ≤ остатка обязательства (guarded UPDATE от гонок);
 *   - распределения между разными поставщиками запрещены;
 *   - providerRef — идемпотентность replay; CANCELLED не удаляется.
 */
import { Injectable } from "@nestjs/common";
import { Prisma } from "../../generated/prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { IdsService } from "../../shared/ids.service";
import { SecurityService } from "../../security/security.service";
import { EventBusService } from "../../eventbus/eventbus.service";
import { DomainEvents } from "../../eventbus/domain-events";
import { ConflictError, NotFoundError, ValidationDomainError } from "../../shared/errors";
import { toMoney2 } from "../sales/sales.money";
import { validateIsoCode } from "./finance.validation";
import { SupplierFxRateService } from "./supplier-fx-rate.service";

const AZN = "AZN";
const PAYABLE = ["OPEN", "PARTIALLY_PAID", "ADJUSTED"] as const;

export interface Actor {
  id: string;
  username: string;
}

export interface PaymentAllocationInput {
  /** SBO-* или id обязательства. */
  obligationCode: string;
  /** Сумма распределения в валюте платежа (> 0). */
  amount: string;
  /** AZN-эквивалент; обязателен, если валюты различаются и нет frozen fx. */
  aznAmount?: string;
}

export interface CreateSupplierPaymentInput {
  partnerId?: string | null;
  supplierCode?: string | null;
  amount: string;
  currency: string;
  aznAmount?: string;
  fxRate?: string;
  method?: string | null;
  providerRef?: string | null;
  purpose?: string | null;
  comment?: string | null;
  occurredAt?: string;
  evidenceUrl?: string | null;
  allocations?: PaymentAllocationInput[];
  /** true — сразу подтвердить (legacy createPayout); иначе PENDING. */
  autoConfirm?: boolean;
}

export interface SupplierAllocationDto {
  id: string;
  obligationId: string;
  obligationCode: string;
  amount: string;
  aznAmount: string;
  reversedAt: string | null;
  createdAt: string;
}

export interface SupplierPaymentDto {
  id: string;
  code: string;
  status: string;
  supplierCode: string | null;
  partnerId: string | null;
  partnerCode: string | null;
  amount: string;
  currency: string;
  aznAmount: string;
  allocatedAzn: string;
  unallocatedAzn: string;
  /** Почему остаток не распределён: не распределяли / FX-расхождение / частично. */
  unallocatedReason: "NONE" | "NOT_ALLOCATED" | "FX_VARIANCE" | "PARTIAL";
  method: string | null;
  providerRef: string | null;
  purpose: string | null;
  comment: string | null;
  occurredAt: string;
  confirmedAt: string | null;
  cancelledAt: string | null;
  actorId: string | null;
  version: number;
  createdAt: string;
  allocations: SupplierAllocationDto[];
}

interface PaymentRow {
  id: string;
  code: string;
  status: string;
  supplierCode: string | null;
  partnerId: string | null;
  amount: Prisma.Decimal;
  currency: string;
  aznAmount: Prisma.Decimal;
  method: string | null;
  providerRef: string | null;
  purpose: string | null;
  comment: string | null;
  occurredAt: Date;
  confirmedAt: Date | null;
  cancelledAt: Date | null;
  actorId: string | null;
  version: number;
  createdAt: Date;
}

interface AllocationRow {
  id: string;
  obligationId: string;
  amount: Prisma.Decimal;
  aznAmount: Prisma.Decimal;
  reversedAt: Date | null;
  createdAt: Date;
}

@Injectable()
export class SupplierPaymentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ids: IdsService,
    private readonly security: SecurityService,
    private readonly eventBus: EventBusService,
    private readonly fxRates: SupplierFxRateService,
  ) {}

  // ── Create ────────────────────────────────────────────────────────────────

  async create(
    input: CreateSupplierPaymentInput,
    actor: Actor,
    idempotencySlotKey: string | null = null,
  ): Promise<SupplierPaymentDto> {
    // Crash window 3 (2.12H): business commit → crash before idempotency record
    // COMPLETED → stale takeover re-executes. Slot unique on payout makes this a
    // replay of the already-created fact, not a duplicate.
    if (idempotencySlotKey) {
      const existing = await this.prisma.supplierPayout.findUnique({
        where: { idempotencySlotKey },
        select: { code: true },
      });
      if (existing) return this.getByCodeOrId(existing.code);
    }

    const amount = toMoney2(input.amount, "amount");
    if (amount.lessThanOrEqualTo(0)) throw new ValidationDomainError("amount must be > 0");
    const currency = validateIsoCode(input.currency, "currency");

    const partner = input.partnerId
      ? await this.prisma.partner.findUnique({ where: { id: input.partnerId }, select: { id: true, code: true } })
      : null;
    if (input.partnerId && !partner) throw new NotFoundError(`Partner ${input.partnerId} not found`);
    const supplierCode = input.supplierCode?.trim() || null;
    if (!partner && !supplierCode) {
      throw new ValidationDomainError("supplierCode or partnerId is required: a payment must have a supplier");
    }

    const { aznAmount, fxRate } = await this.resolveAzn(
      input.aznAmount,
      amount,
      currency,
      supplierCode ?? partner?.code ?? "",
      input.fxRate,
    );
    const occurredAt = input.occurredAt ? this.parseDate(input.occurredAt, "occurredAt") : new Date();
    const providerRef = input.providerRef?.trim() || null;

    const allocations = await this.prepareAllocations(input.allocations ?? [], {
      supplierCode,
      partnerId: partner?.id ?? null,
      paymentCurrency: currency,
      paymentAzn: aznAmount,
    }, "create");

    if (providerRef) {
      const existing = await this.prisma.supplierPayout.findUnique({ where: { providerRef } });
      if (existing) {
        const same = await this.providerRefReplayMatches(existing, {
          amount,
          currency,
          supplierCode,
          partnerId: partner?.id ?? null,
          allocations,
        });
        if (same) return this.getByCodeOrId(existing.code);
        throw new ConflictError(`supplier payment with providerRef ${providerRef} already exists with a different payload`);
      }
    }

    const code = await this.ids.nextCode(null, "SPO");
    let created: { id: string; code: string } | undefined;
    try {
      created = await this.prisma.$transaction(async (tx) => {
        const payment = await tx.supplierPayout.create({
          data: {
            code,
            supplierCode,
            partnerId: partner?.id ?? null,
            status: "PENDING",
            amount,
            currency,
            aznAmount,
            fxRate,
            method: input.method?.trim() || null,
            providerRef,
            idempotencySlotKey,
            purpose: input.purpose?.trim() || null,
            comment: input.comment?.trim() || null,
            occurredAt,
            evidenceUrl: input.evidenceUrl?.trim() || null,
            actorType: "USER",
            actorId: actor.id,
            version: 1,
          },
        });
        for (const allocation of allocations) {
          await tx.supplierPayoutAllocation.create({
            data: {
              payoutId: payment.id,
              obligationId: allocation.obligationId,
              amount: allocation.amount,
              aznAmount: allocation.aznAmount,
              createdById: actor.id,
            },
          });
        }
        await this.security.audit(tx, {
          action: "finance.supplier_payment.created",
          resource: "SupplierPayout",
          resourceId: payment.id,
          details: {
            code,
            amount: amount.toString(),
            currency,
            aznAmount: aznAmount.toString(),
            supplierCode,
            partnerId: partner?.id ?? null,
            idempotencySlotKey,
            allocations: allocations.map((a) => ({ obligationId: a.obligationId, aznAmount: a.aznAmount.toString() })),
            actor: actor.username,
          },
        });
        return payment;
      });
    } catch (err) {
      // Concurrency backstop: same slot (stale takeover) или тот же providerRef
      // двумя разными ключами. Возвращаем существующий ФАКТ только если payload
      // семантически совпадает; иначе — controlled 409, не ложный успех.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        if (idempotencySlotKey) {
          const bySlot = await this.prisma.supplierPayout.findUnique({
            where: { idempotencySlotKey },
            select: { code: true },
          });
          if (bySlot) return this.getByCodeOrId(bySlot.code);
        }
        if (providerRef) {
          const byRef = await this.prisma.supplierPayout.findUnique({ where: { providerRef } });
          if (
            byRef &&
            (await this.providerRefReplayMatches(byRef, {
              amount,
              currency,
              supplierCode,
              partnerId: partner?.id ?? null,
              allocations,
            }))
          ) {
            return this.getByCodeOrId(byRef.code);
          }
          throw new ConflictError(`supplier payment with providerRef ${providerRef} already exists with a different payload`);
        }
      }
      throw err;
    }

    if (!created) throw new ConflictError("supplier payment creation failed without a committed row");

    if (input.autoConfirm) {
      return this.confirm(created.code, actor);
    }
    return this.getByCodeOrId(created.code);
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  /** Подтвердить исполнение: применяет все распределения к обязательствам. */
  async confirm(codeOrId: string, actor: Actor): Promise<SupplierPaymentDto> {
    const payment = await this.load(codeOrId);
    if (payment.status === "CONFIRMED") return this.getByCodeOrId(payment.code);
    if (payment.status !== "PENDING") {
      throw new ConflictError(`supplier payment ${payment.code} is ${payment.status} and cannot be confirmed`);
    }
    const allocations = await this.prisma.supplierPayoutAllocation.findMany({
      where: { payoutId: payment.id, reversedAt: null },
      include: { obligation: { select: { id: true, code: true } } },
    });

    let eventId: string | null = null;
    await this.prisma.$transaction(async (tx) => {
      // Guarded CAS: только PENDING → CONFIRMED (повторный параллельный confirm
      // не применит распределения дважды).
      const cas = await tx.supplierPayout.updateMany({
        where: { id: payment.id, status: "PENDING" },
        data: {
          status: "CONFIRMED",
          confirmedAt: new Date(),
          confirmedById: actor.id,
          version: { increment: 1 },
        },
      });
      if (cas.count === 0) {
        const fresh = await tx.supplierPayout.findUniqueOrThrow({ where: { id: payment.id } });
        if (fresh.status === "CONFIRMED") return;
        throw new ConflictError(`supplier payment ${payment.code} cannot be confirmed from ${fresh.status}`);
      }

      for (const allocation of allocations) {
        await this.applyAllocationToObligation(tx, payment.code, {
          obligationId: allocation.obligationId,
          aznAmount: allocation.aznAmount,
        });
      }

      await this.security.audit(tx, {
        action: "finance.supplier_payment.confirmed",
        resource: "SupplierPayout",
        resourceId: payment.id,
        details: {
          code: payment.code,
          aznAmount: payment.aznAmount.toString(),
          allocationCount: allocations.length,
          actor: actor.username,
        },
      });

      // Один ledger-факт на платёж (sourceType+sourceId unique). Obligation-поля
      // в payload — первый allocation; ledger использует только amount/currency.
      const first = allocations[0];
      eventId = await this.eventBus.emit(tx, {
        aggregateType: "SupplierPayout",
        aggregateId: payment.id,
        eventType: DomainEvents.SupplierPayoutCreated,
        payload: {
          payoutId: payment.id,
          payoutCode: payment.code,
          obligationId: first?.obligationId ?? "",
          obligationCode: first?.obligation.code ?? "MULTI",
          amount: payment.amount.toString(),
          currency: payment.currency,
          aznAmount: payment.aznAmount.toString(),
          providerRef: payment.providerRef,
          occurredAt: payment.occurredAt.toISOString(),
        },
        retryable: true,
      });
    });
    if (eventId) await this.eventBus.publishEvent(eventId);
    return this.getByCodeOrId(payment.code);
  }

  /**
   * Отмена: PENDING — просто CANCELLED (обязательства не тронуты);
   * CONFIRMED — CAS-переход, сторно распределений (paid/remaining
   * возвращаются) и компенсирующая ledger-проводка (`SUPPLIER_PAYOUT_REVERSAL`)
   * в той же транзакции. Исходная запись и исходная проводка НЕ удаляются.
   * Повторная отмена идемпотентна; конкурентная — только один победитель CAS.
   */
  async cancel(codeOrId: string, reason: string | null, actor: Actor): Promise<SupplierPaymentDto> {
    const payment = await this.load(codeOrId);
    if (payment.status === "CANCELLED") return this.getByCodeOrId(payment.code);

    const cancelledAt = new Date();
    let reversalEventId: string | null = null;
    await this.prisma.$transaction(async (tx) => {
      const fresh = await tx.supplierPayout.findUniqueOrThrow({ where: { id: payment.id } });
      if (fresh.status === "CANCELLED") return;

      // CAS: только один параллельный cancel переводит платёж в CANCELLED и
      // выполняет сторно. Проигравший видит CANCELLED и не повторяет reversal.
      const cas = await tx.supplierPayout.updateMany({
        where: { id: payment.id, status: fresh.status },
        data: {
          status: "CANCELLED",
          cancelledAt,
          cancelledById: actor.id,
          version: { increment: 1 },
        },
      });
      if (cas.count === 0) {
        const again = await tx.supplierPayout.findUniqueOrThrow({ where: { id: payment.id } });
        if (again.status === "CANCELLED") return;
        throw new ConflictError(`supplier payment ${payment.code} changed concurrently; retry`);
      }

      if (fresh.status === "CONFIRMED") {
        const allocations = await tx.supplierPayoutAllocation.findMany({
          where: { payoutId: payment.id, reversedAt: null },
        });
        for (const allocation of allocations) {
          await this.reverseAllocation(tx, payment.id, allocation, actor);
        }

        // Компенсирующий ledger-факт (append-only). Emission в той же tx —
        // outbox; consumer идемпотентен по inbox + unique(source,type).
        reversalEventId = await this.eventBus.emit(tx, {
          aggregateType: "SupplierPayout",
          aggregateId: payment.id,
          eventType: DomainEvents.SupplierPayoutReversed,
          payload: {
            payoutId: payment.id,
            payoutCode: payment.code,
            amount: fresh.amount.toString(),
            currency: fresh.currency,
            reason: reason ?? null,
            occurredAt: cancelledAt.toISOString(),
          },
          retryable: true,
        });
      }

      await this.security.audit(tx, {
        action: "finance.supplier_payment.cancelled",
        resource: "SupplierPayout",
        resourceId: payment.id,
        details: {
          code: payment.code,
          previousStatus: fresh.status,
          ledgerReversal: fresh.status === "CONFIRMED",
          reason: reason ?? null,
          actor: actor.username,
        },
      });
    });
    if (reversalEventId) await this.eventBus.publishEvent(reversalEventId);
    return this.getByCodeOrId(payment.code);
  }

  /** Распределить (добавить) платёж на обязательство. */
  async allocate(codeOrId: string, input: PaymentAllocationInput, actor: Actor): Promise<SupplierPaymentDto> {
    const payment = await this.load(codeOrId);
    if (payment.status === "CANCELLED") {
      throw new ConflictError(`supplier payment ${payment.code} is CANCELLED`);
    }
    const prepared = await this.prepareAllocations([input], {
      supplierCode: payment.supplierCode,
      partnerId: payment.partnerId,
      paymentCurrency: payment.currency,
      paymentAzn: payment.aznAmount,
      excludeAllocationOfPaymentId: payment.id,
    }, "allocate");

    const allocation = prepared[0];
    const existing = await this.prisma.supplierPayoutAllocation.findUnique({
      where: { payoutId_obligationId: { payoutId: payment.id, obligationId: allocation.obligationId } },
    });
    if (existing) {
      throw new ConflictError(`obligation ${input.obligationCode} is already allocated from payment ${payment.code}`);
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.supplierPayoutAllocation.create({
        data: {
          payoutId: payment.id,
          obligationId: allocation.obligationId,
          amount: allocation.amount,
          aznAmount: allocation.aznAmount,
          createdById: actor.id,
        },
      });
      if (payment.status === "CONFIRMED") {
        await this.applyAllocationToObligation(tx, payment.code, {
          obligationId: allocation.obligationId,
          aznAmount: allocation.aznAmount,
        });
      }
      await this.security.audit(tx, {
        action: "finance.supplier_payment.allocated",
        resource: "SupplierPayout",
        resourceId: payment.id,
        details: {
          code: payment.code,
          obligationId: allocation.obligationId,
          amount: allocation.amount.toString(),
          aznAmount: allocation.aznAmount.toString(),
          applied: payment.status === "CONFIRMED",
          actor: actor.username,
        },
      });
    });
    return this.getByCodeOrId(payment.code);
  }

  // ── Read ──────────────────────────────────────────────────────────────────

  async list(query: {
    status?: string;
    supplierCode?: string;
    partnerId?: string;
    currency?: string;
    from?: string;
    to?: string;
    search?: string;
    /** true — только платежи с нераспределённым остатком. */
    unallocated?: boolean;
    page?: number;
    pageSize?: number;
  }): Promise<{ items: SupplierPaymentDto[]; page: number; pageSize: number; total: number }> {
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(200, Math.max(1, query.pageSize ?? 20));
    const where: Prisma.SupplierPayoutWhereInput = {};
    if (query.status) where.status = query.status;
    if (query.supplierCode) where.supplierCode = query.supplierCode;
    if (query.partnerId) where.partnerId = query.partnerId;
    if (query.currency) where.currency = query.currency.toUpperCase();
    if (query.from || query.to) {
      where.occurredAt = {};
      if (query.from) where.occurredAt.gte = this.parseDate(query.from, "from");
      if (query.to) where.occurredAt.lte = this.parseDate(query.to, "to");
    }
    const search = query.search?.trim();
    if (search) {
      where.OR = [
        { code: { contains: search, mode: "insensitive" } },
        { providerRef: { contains: search, mode: "insensitive" } },
        { purpose: { contains: search, mode: "insensitive" } },
        { comment: { contains: search, mode: "insensitive" } },
      ];
    }

    // Режим «нераспределённые»: остаток вычисляется из allocations
    // (aznAmount − Σ active), поэтому фильтруем после маппинга. Объём
    // ограничен 5000 (как экспорт); для типичного реестра это безопасно.
    if (query.unallocated) {
      const rows = await this.prisma.supplierPayout.findMany({
        where,
        orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
        take: 5000,
        include: { allocations: true },
      });
      const mapped = (await this.mapMany(rows)).filter((p) => Number(p.unallocatedAzn) > 0);
      const start = (page - 1) * pageSize;
      return { items: mapped.slice(start, start + pageSize), page, pageSize, total: mapped.length };
    }

    const [total, rows] = await Promise.all([
      this.prisma.supplierPayout.count({ where }),
      this.prisma.supplierPayout.findMany({
        where,
        orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { allocations: true },
      }),
    ]);
    const items = await this.mapMany(rows);
    return { items, page, pageSize, total };
  }

  /**
   * Плоские строки для экспорта (CSV/XLSX): те же фильтры, что у реестра,
   * без пагинации (cap 5000 — защита от выгрузки всей истории в память).
   */
  async exportRows(query: {
    status?: string;
    supplierCode?: string;
    partnerId?: string;
    currency?: string;
    from?: string;
    to?: string;
    search?: string;
  }): Promise<Array<Record<string, string | null>>> {
    const where: Prisma.SupplierPayoutWhereInput = {};
    if (query.status) where.status = query.status;
    if (query.supplierCode) where.supplierCode = query.supplierCode;
    if (query.partnerId) where.partnerId = query.partnerId;
    if (query.currency) where.currency = query.currency.toUpperCase();
    if (query.from || query.to) {
      where.occurredAt = {};
      if (query.from) where.occurredAt.gte = this.parseDate(query.from, "from");
      if (query.to) where.occurredAt.lte = this.parseDate(query.to, "to");
    }
    const search = query.search?.trim();
    if (search) {
      where.OR = [
        { code: { contains: search, mode: "insensitive" } },
        { providerRef: { contains: search, mode: "insensitive" } },
        { purpose: { contains: search, mode: "insensitive" } },
        { comment: { contains: search, mode: "insensitive" } },
      ];
    }
    const rows = await this.prisma.supplierPayout.findMany({
      where,
      orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
      take: 5000,
      include: { allocations: true },
    });
    const items = await this.mapMany(rows);
    return items.map((p) => ({
      code: p.code,
      status: p.status,
      supplierCode: p.supplierCode,
      partnerCode: p.partnerCode,
      amount: p.amount,
      currency: p.currency,
      aznAmount: p.aznAmount,
      allocatedAzn: p.allocatedAzn,
      unallocatedAzn: p.unallocatedAzn,
      unallocatedReason: p.unallocatedReason,
      method: p.method,
      providerRef: p.providerRef,
      purpose: p.purpose,
      obligations: p.allocations.map((a) => a.obligationCode).join(" "),
      occurredAt: p.occurredAt,
      confirmedAt: p.confirmedAt,
      cancelledAt: p.cancelledAt,
    }));
  }

  async getByCodeOrId(codeOrId: string): Promise<SupplierPaymentDto> {
    const row = await this.prisma.supplierPayout.findFirst({
      where: { OR: [{ code: codeOrId }, { id: codeOrId }] },
      include: { allocations: true },
    });
    if (!row) throw new NotFoundError(`SupplierPayment ${codeOrId} not found`);
    const [dto] = await this.mapMany([row]);
    return dto;
  }

  async getHistory(codeOrId: string) {
    const payment = await this.load(codeOrId);
    const rows = await this.prisma.auditLog.findMany({
      where: { resource: "SupplierPayout", resourceId: payment.id },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: { id: true, action: true, username: true, details: true, createdAt: true },
    });
    return {
      paymentCode: payment.code,
      items: rows.map((r) => ({
        id: r.id,
        action: r.action,
        username: r.username,
        details: r.details,
        createdAt: r.createdAt.toISOString(),
      })),
    };
  }

  // ── Internals ────────────────────────────────────────────────────────────

  private async load(codeOrId: string): Promise<PaymentRow> {
    const row = await this.prisma.supplierPayout.findFirst({
      where: { OR: [{ code: codeOrId }, { id: codeOrId }] },
    });
    if (!row) throw new NotFoundError(`SupplierPayment ${codeOrId} not found`);
    return row;
  }

  private async resolveAzn(
    explicit: string | undefined,
    amount: Prisma.Decimal,
    currency: string,
    fxKey: string,
    explicitFxRate?: string,
  ): Promise<{ aznAmount: Prisma.Decimal; fxRate: Prisma.Decimal | null }> {
    if (explicit != null && explicit.trim() !== "") {
      const azn = toMoney2(explicit, "aznAmount");
      if (azn.lessThanOrEqualTo(0)) throw new ValidationDomainError("aznAmount must be > 0");
      const fxRate = explicitFxRate && explicitFxRate.trim() !== "" ? this.parseRate(explicitFxRate) : null;
      return { aznAmount: azn, fxRate };
    }
    if (currency === AZN) return { aznAmount: amount, fxRate: null };
    const fx = await this.fxRates.resolveStrict(fxKey, currency);
    return { aznAmount: this.fxRates.convertToAzn(amount, fx), fxRate: fx.rate };
  }

  private async prepareAllocations(
    inputs: PaymentAllocationInput[],
    ctx: {
      supplierCode: string | null;
      partnerId: string | null;
      paymentCurrency: string;
      paymentAzn: Prisma.Decimal;
      excludeAllocationOfPaymentId?: string;
    },
    mode: "create" | "allocate",
  ): Promise<Array<{ obligationId: string; amount: Prisma.Decimal; aznAmount: Prisma.Decimal }>> {
    if (inputs.length === 0) return [];
    const result: Array<{ obligationId: string; amount: Prisma.Decimal; aznAmount: Prisma.Decimal }> = [];
    const seen = new Set<string>();

    for (const input of inputs) {
      const obligation = await this.prisma.supplierObligation.findFirst({
        where: { OR: [{ code: input.obligationCode }, { id: input.obligationCode }] },
      });
      if (!obligation) throw new NotFoundError(`SupplierObligation ${input.obligationCode} not found`);
      if (seen.has(obligation.id)) throw new ValidationDomainError("duplicate obligation in allocations");
      seen.add(obligation.id);
      if (obligation.remainingAmount == null || obligation.aznAmount == null) {
        throw new ValidationDomainError(
          `obligation ${obligation.code} has UNKNOWN AZN amount; allocation is blocked until FX/snapshot is resolved`,
        );
      }
      if (!PAYABLE.includes(obligation.status as (typeof PAYABLE)[number])) {
        throw new ConflictError(`obligation ${obligation.code} is ${obligation.status} and cannot receive payment`);
      }
      if (ctx.supplierCode && obligation.supplierCode && ctx.supplierCode !== obligation.supplierCode) {
        throw new ValidationDomainError(
          `obligation ${obligation.code} belongs to ${obligation.supplierCode}, not ${ctx.supplierCode}`,
        );
      }
      if (ctx.partnerId && obligation.partnerId && ctx.partnerId !== obligation.partnerId) {
        throw new ValidationDomainError(`obligation ${obligation.code} belongs to another partner`);
      }

      const amount = toMoney2(input.amount, "allocation.amount");
      if (amount.lessThanOrEqualTo(0)) throw new ValidationDomainError("allocation amount must be > 0");

      let aznAmount: Prisma.Decimal;
      if (input.aznAmount != null && input.aznAmount.trim() !== "") {
        aznAmount = toMoney2(input.aznAmount, "allocation.aznAmount");
      } else if (ctx.paymentCurrency === obligation.sourceCurrency && obligation.fxRate != null) {
        aznAmount = toMoney2(amount.mul(obligation.fxRate), "allocation.aznAmount");
      } else if (ctx.paymentCurrency === AZN) {
        aznAmount = amount;
      } else {
        throw new ValidationDomainError(
          `allocation aznAmount is required: payment currency ${ctx.paymentCurrency} differs from obligation ` +
            `${obligation.sourceCurrency} and no frozen FX rate exists`,
        );
      }
      if (aznAmount.lessThanOrEqualTo(0)) throw new ValidationDomainError("allocation aznAmount must be > 0");
      if (aznAmount.greaterThan(obligation.remainingAmount)) {
        throw new ValidationDomainError(
          `allocation exceeds remaining: ${aznAmount.toString()} > ${obligation.remainingAmount.toString()} (${obligation.code})`,
        );
      }
      result.push({ obligationId: obligation.id, amount, aznAmount });
    }

    const totalAzn = result.reduce((sum, a) => sum.plus(a.aznAmount), new Prisma.Decimal(0));
    if (totalAzn.greaterThan(ctx.paymentAzn)) {
      throw new ValidationDomainError(
        `allocations exceed payment: ${totalAzn.toString()} > ${ctx.paymentAzn.toString()}`,
      );
    }
    if (mode === "allocate" && ctx.excludeAllocationOfPaymentId) {
      const existing = await this.prisma.supplierPayoutAllocation.aggregate({
        where: { payoutId: ctx.excludeAllocationOfPaymentId, reversedAt: null },
        _sum: { aznAmount: true },
      });
      const allocated = existing._sum.aznAmount ?? new Prisma.Decimal(0);
      if (allocated.plus(totalAzn).greaterThan(ctx.paymentAzn)) {
        throw new ValidationDomainError(
          `payment unallocated amount exceeded: ${allocated.plus(totalAzn).toString()} > ${ctx.paymentAzn.toString()}`,
        );
      }
    }
    return result;
  }

  /** Применить распределение к обязательству (guarded от concurrent overspend). */
  private async applyAllocationToObligation(
    tx: Prisma.TransactionClient,
    paymentCode: string,
    allocation: { obligationId: string; aznAmount: Prisma.Decimal },
  ): Promise<void> {
    const upd = await tx.supplierObligation.updateMany({
      where: {
        id: allocation.obligationId,
        status: { in: [...PAYABLE] },
        remainingAmount: { gte: allocation.aznAmount },
      },
      data: {
        paidAmount: { increment: allocation.aznAmount },
        remainingAmount: { decrement: allocation.aznAmount },
        updatedAt: new Date(),
      },
    });
    if (upd.count === 0) {
      throw new ConflictError(
        `allocation of ${paymentCode} failed: obligation became non-payable or remaining is lower than allocation (concurrent payment?)`,
      );
    }
    const fresh = await tx.supplierObligation.findUniqueOrThrow({ where: { id: allocation.obligationId } });
    const next = fresh.remainingAmount?.isZero() ? "CLOSED" : "PARTIALLY_PAID";
    if (fresh.status !== next) {
      await tx.supplierObligation.update({ where: { id: fresh.id }, data: { status: next } });
    }
  }

  /** Сторно распределения: возвращает paid/remaining, помечает reversedAt. */
  private async reverseAllocation(
    tx: Prisma.TransactionClient,
    paymentId: string,
    allocation: AllocationRow,
    actor: Actor,
  ): Promise<void> {
    const upd = await tx.supplierObligation.updateMany({
      where: { id: allocation.obligationId, paidAmount: { gte: allocation.aznAmount } },
      data: {
        paidAmount: { decrement: allocation.aznAmount },
        remainingAmount: { increment: allocation.aznAmount },
        updatedAt: new Date(),
      },
    });
    if (upd.count === 0) {
      throw new ConflictError(
        `cannot cancel payment: obligation ${allocation.obligationId} paid amount is lower than allocation (data inconsistency)`,
      );
    }
    const fresh = await tx.supplierObligation.findUniqueOrThrow({ where: { id: allocation.obligationId } });
    const next = fresh.paidAmount.isZero() ? "OPEN" : "PARTIALLY_PAID";
    if (fresh.status !== "CANCELLED" && fresh.status !== next) {
      await tx.supplierObligation.update({ where: { id: fresh.id }, data: { status: next } });
    }
    await tx.supplierPayoutAllocation.update({
      where: { id: allocation.id },
      data: { reversedAt: new Date(), reversedById: actor.id },
    });
    await this.security.audit(tx, {
      action: "finance.supplier_payment.allocation_reversed",
      resource: "SupplierPayout",
      resourceId: paymentId,
      details: {
        allocationId: allocation.id,
        obligationId: allocation.obligationId,
        aznAmount: allocation.aznAmount.toString(),
        actor: actor.username,
      },
    });
  }

  private async mapMany(rows: Array<PaymentRow & { allocations: AllocationRow[] }>): Promise<SupplierPaymentDto[]> {
    const obligationIds = [...new Set(rows.flatMap((r) => r.allocations.map((a) => a.obligationId)))];
    const obligations = obligationIds.length
      ? await this.prisma.supplierObligation.findMany({
          where: { id: { in: obligationIds } },
          select: { id: true, code: true, sourceCurrency: true, fxRate: true },
        })
      : [];
    const obligationInfo = new Map(obligations.map((o) => [o.id, o]));
    const codes = new Map(obligations.map((o) => [o.id, o.code]));
    const partnerIds = [...new Set(rows.map((r) => r.partnerId).filter((id): id is string => !!id))];
    const partners = partnerIds.length
      ? await this.prisma.partner.findMany({ where: { id: { in: partnerIds } }, select: { id: true, code: true } })
      : [];
    const partnerCodes = new Map(partners.map((p) => [p.id, p.code]));

    return rows.map((row) => {
      return this.toDto(row, row.allocations, codes, obligationInfo, partnerCodes.get(row.partnerId ?? "") ?? null);
    });
  }

  private toDto(
    row: PaymentRow,
    allocations: AllocationRow[],
    codes: Map<string, string>,
    obligationInfo: Map<string, { id: string; code: string; sourceCurrency: string; fxRate: Prisma.Decimal | null }>,
    partnerCode: string | null,
  ): SupplierPaymentDto {
    const active = allocations.filter((a) => a.reversedAt == null);
    const allocated = active.reduce((sum, a) => sum.plus(a.aznAmount), new Prisma.Decimal(0));
    const unallocated = row.aznAmount.sub(allocated);
    let unallocatedReason: SupplierPaymentDto["unallocatedReason"] = "NONE";
    if (unallocated.greaterThan(0)) {
      if (active.length === 0) {
        unallocatedReason = "NOT_ALLOCATED";
      } else {
        const coveredAmount = active.reduce((sum, a) => sum.plus(a.amount), new Prisma.Decimal(0));
        const sameCurrency = active.every(
          (a) => (obligationInfo.get(a.obligationId)?.sourceCurrency ?? row.currency) === row.currency,
        );
        // Платёж покрыт по сумме в своей валюте, но AZN-эквивалент распределения
        // меньше — это FX-разница между курсом платежа и frozen-курсом обязательства.
        const amountCovered = coveredAmount.minus(row.amount).abs().lessThanOrEqualTo(new Prisma.Decimal("0.01"));
        unallocatedReason = sameCurrency && amountCovered ? "FX_VARIANCE" : "PARTIAL";
      }
    }
    return {
      id: row.id,
      code: row.code,
      status: row.status,
      supplierCode: row.supplierCode,
      partnerId: row.partnerId,
      partnerCode,
      amount: row.amount.toString(),
      currency: row.currency,
      aznAmount: row.aznAmount.toString(),
      allocatedAzn: allocated.toString(),
      unallocatedAzn: unallocated.toString(),
      unallocatedReason,
      method: row.method,
      providerRef: row.providerRef,
      purpose: row.purpose,
      comment: row.comment,
      occurredAt: row.occurredAt.toISOString(),
      confirmedAt: row.confirmedAt ? row.confirmedAt.toISOString() : null,
      cancelledAt: row.cancelledAt ? row.cancelledAt.toISOString() : null,
      actorId: row.actorId,
      version: row.version,
      createdAt: row.createdAt.toISOString(),
      allocations: allocations.map((a) => ({
        id: a.id,
        obligationId: a.obligationId,
        obligationCode: codes.get(a.obligationId) ?? "",
        amount: a.amount.toString(),
        aznAmount: a.aznAmount.toString(),
        reversedAt: a.reversedAt ? a.reversedAt.toISOString() : null,
        createdAt: a.createdAt.toISOString(),
      })),
    };
  }

  /**
   * providerRef replay is allowed only for the SAME economic fact: amount,
   * currency, supplier/partner and the exact active allocation set. Same
   * external ref with different allocations is a conflict, not a silent replay.
   */
  private async providerRefReplayMatches(
    existing: { id: string; amount: Prisma.Decimal; currency: string; supplierCode: string | null; partnerId: string | null },
    expected: {
      amount: Prisma.Decimal;
      currency: string;
      supplierCode: string | null;
      partnerId: string | null;
      allocations: Array<{ obligationId: string; amount: Prisma.Decimal; aznAmount: Prisma.Decimal }>;
    },
  ): Promise<boolean> {
    if (
      !existing.amount.equals(expected.amount) ||
      existing.currency !== expected.currency ||
      (existing.supplierCode ?? null) !== (expected.supplierCode ?? null) ||
      (existing.partnerId ?? null) !== (expected.partnerId ?? null)
    ) {
      return false;
    }
    const rows = await this.prisma.supplierPayoutAllocation.findMany({
      where: { payoutId: existing.id, reversedAt: null },
      select: { obligationId: true, amount: true, aznAmount: true },
    });
    const keyOf = (a: { obligationId: string; amount: Prisma.Decimal; aznAmount: Prisma.Decimal }) =>
      `${a.obligationId}:${a.amount.toFixed(2)}:${a.aznAmount.toFixed(2)}`;
    const existingKeys = rows.map(keyOf).sort();
    const expectedKeys = expected.allocations.map(keyOf).sort();
    return existingKeys.length === expectedKeys.length && existingKeys.every((k, i) => k === expectedKeys[i]);
  }

  private parseDate(value: string, label: string): Date {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) throw new ValidationDomainError(`${label} must be a valid date`);
    return d;
  }

  private parseRate(value: string): Prisma.Decimal {
    try {
      const d = new Prisma.Decimal(value);
      if (!d.isFinite() || d.lessThanOrEqualTo(0)) throw new Error("bad rate");
      return d;
    } catch {
      throw new ValidationDomainError(`invalid FX rate: ${value}`);
    }
  }
}
