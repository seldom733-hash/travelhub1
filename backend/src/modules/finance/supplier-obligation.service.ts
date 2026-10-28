/**
 * UNIFIED FINANCE CENTER Phase 2 — SupplierObligationService.
 *
 * SupplierObligation — сумма, которую платформа ДОЛЖНА поставщику за
 * подтверждённую услугу. Создаётся идемпотентно на событии BookingConfirmed
 * (см. _supplier-obligation.consumer). Замороженный денежный факт:
 *   sourceAmount/sourceCurrency — исходная валюта поставщика (immutable);
 *   aznAmount/fxRate/fxRateCode — AZN management-эквивалент + применённый курс
 *     (снапшот; изменение текущего SupplierFxRate НЕ переписывает obligation).
 * UNKNOWN (нет commercialSnapshot / нет курса для не-AZN) хранится как NULL,
 * НИКОГДА как 0; payout в таком состоянии заблокирован («blocked, never zero»).
 *
 * SupplierPayout — ФАКТ исходящего платежа (деньги реально ушли). Частичные
 * выплаты: НЕСКОЛЬКО payout на одну obligation; атомарный декремент remaining
 * под guarded UPDATE (concurrent overspend → 409); providerRef-idempotency
 * (replay → no-op, divergent → 409); overpayment → 422. Фактическое движение
 * amount/currency хранится ОТДЕЛЬНО от aznAmount — FX variance фиксируется,
 * замороженный obligation НЕ переписывается.
 *
 * Статусы: OPEN / PARTIALLY_PAID / CLOSED / CANCELLED / ADJUSTED.
 * Ограничения (документированные, Phase 2 scope): payout — только по
 * OPEN/PARTIALLY_PAID/ADJUSTED с remaining > 0; cancel/adjust — только когда
 * paidAmount == 0 (пост-facto adjust/reversal payout — будущий шаг).
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
import { computeDueDate } from "./supplier-payment-terms.service";

export const TARGET_AZN = "AZN";
/** Статусы, по которым допустима частичная выплата (remaining > 0). */
const PAYABLE_STATUSES = ["OPEN", "PARTIALLY_PAID", "ADJUSTED"] as const;

export interface Actor {
  id: string;
  username: string;
}

/** JSON-safe DTO обязательства. */
export interface SupplierObligationDto {
  id: string;
  code: string;
  bookingId: string;
  bookingCode: string | null;
  orderId: string;
  orderCode: string | null;
  orderItemId: string | null;
  /** Номер счёта поставщика (вводится финансами). */
  invoiceNumber: string | null;
  /** Срок оплаты (ISO date) или null — срок не согласован. */
  dueDate: string | null;
  /** true: срок прошёл, остаток > 0, статус позволяет оплату (derived, не stored). */
  overdue: boolean;
  /** status + derived OVERDUE для отображения (не пишется в БД). */
  displayStatus: string;
  supplierCode: string | null;
  partnerId: string | null;
  /** CRM Partner.code (PAR-*) — resolve на read; null если не привязан. */
  partnerCode: string | null;
  serviceType: string | null;
  sourceAmount: string;
  sourceCurrency: string;
  /** null = UNKNOWN (нет snapshot/курса); НИКОГДА не 0. */
  aznAmount: string | null;
  fxRate: string | null;
  fxRateCode: string | null;
  status: string;
  paidAmount: string;
  remainingAmount: string | null;
  /** true, если aznAmount UNKNOWN — payout заблокирован. */
  amountUnknown: boolean;
  source: string;
  sourceEventId: string | null;
  confirmedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** JSON-safe DTO факта исходящего платежа. */
export interface SupplierPayoutDto {
  id: string;
  code: string;
  /** null для нераспределённых платежей (реестр supplier payments). */
  obligationId: string | null;
  obligationCode: string;
  status: string;
  supplierCode: string | null;
  partnerId: string | null;
  purpose: string | null;
  comment: string | null;
  confirmedAt: string | null;
  amount: string;
  currency: string;
  aznAmount: string;
  fxRate: string | null;
  fxVariance: string | null;
  method: string | null;
  providerRef: string | null;
  occurredAt: string;
  reason: string | null;
  evidenceUrl: string | null;
  actorId: string | null;
  createdAt: string;
}

interface ObligationRow {
  id: string;
  code: string;
  bookingId: string;
  bookingCode: string | null;
  orderId: string;
  orderCode: string | null;
  orderItemId: string | null;
  invoiceNumber: string | null;
  dueDate: Date | null;
  supplierCode: string | null;
  partnerId: string | null;
  serviceType: string | null;
  sourceAmount: Prisma.Decimal;
  sourceCurrency: string;
  aznAmount: Prisma.Decimal | null;
  fxRate: Prisma.Decimal | null;
  fxRateCode: string | null;
  status: string;
  paidAmount: Prisma.Decimal;
  remainingAmount: Prisma.Decimal | null;
  source: string;
  sourceEventId: string | null;
  confirmedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const dec = (d: Prisma.Decimal | null | undefined): string | null => (d == null ? null : d.toString());

/** Начало сегодняшнего дня (UTC) — overdue сравнивается по календарной дате. */
function startOfTodayUtc(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

@Injectable()
export class SupplierObligationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ids: IdsService,
    private readonly security: SecurityService,
    private readonly eventBus: EventBusService,
  ) {}

  // ── Creation (idempotent, BookingConfirmed consumer) ──────────────────────

  /**
   * Идемпотентное создание obligation на подтверждении брони. Вызывается
   * потребителем внутри транзакции. Уникальный bookingId — DB-backstop
   * (одна obligation на booking=item/service); P2002 на bookingId → no-op
   * (возвращает существующую). Азn-снапшот берётся ТОЛЬКО из frozen
   * Order.commercialSnapshot (не из клиента); UNKNOWN → null, не 0.
   */
  async createObligationForBooking(
    tx: Prisma.TransactionClient,
    input: {
      bookingId: string;
      bookingCode: string | null;
      orderId: string;
      orderCode: string | null;
      orderItemId: string | null;
      /** Замороженная сумма брони (из Booking.amount, исходная валюта). */
      bookingAmount: Prisma.Decimal;
      bookingCurrency: string;
      commercialSnapshot: unknown;
      sellerPartnerId: string | null;
    },
    ctx: { sourceEventId: string; confirmedAt: Date | null },
  ): Promise<SupplierObligationDto> {
    const snap = this.parseSnapshot(input.commercialSnapshot);

    // Источник денег: snapshot.supplierPrice (immutable source fact), иначе
    // замороженная сумма брони.
    const sourceAmount = toMoney2(
      snap && typeof snap.supplierPrice === "number" ? snap.supplierPrice : input.bookingAmount,
      "sourceAmount",
    );
    const sourceCurrency = validateIsoCode(
      (snap && typeof snap.supplierCurrency === "string" ? snap.supplierCurrency : input.bookingCurrency) ?? "",
      "sourceCurrency",
    );

    // AZN-эквивалент + курс-снапшот. UNKNOWN (нет fx и не AZN) → null.
    let aznAmount: Prisma.Decimal | null = null;
    let fxRate: Prisma.Decimal | null = null;
    let fxRateCode: string | null = null;
    const fx = snap && typeof snap.fx === "object" && snap.fx !== null ? (snap.fx as Record<string, unknown>) : null;
    if (fx && fx.aznAmount != null && Number.isFinite(Number(fx.aznAmount))) {
      aznAmount = toMoney2(Number(fx.aznAmount), "aznAmount");
      if (fx.rate != null) fxRate = this.parseRate(fx.rate);
      fxRateCode = typeof fx.rateCode === "string" ? fx.rateCode : null;
    } else if (sourceCurrency === TARGET_AZN) {
      // AZN identity: курс всегда 1, строка не хранится.
      aznAmount = sourceAmount;
      fxRate = new Prisma.Decimal(1);
    }
    // else: aznAmount/fxRate остаются null → UNKNOWN (blocked, never zero).

    const supplierCode = snap && typeof snap.supplierCode === "string" ? snap.supplierCode : null;
    const serviceType = snap && typeof snap.serviceType === "string" ? snap.serviceType : null;

    // Срок оплаты: применяем активное правило поставщика ТОЛЬКО сейчас и
    // фиксируем snapshot; изменение правила позже не переписывает срок.
    const terms = supplierCode
      ? await tx.supplierPaymentTerms.findUnique({ where: { supplierCode: supplierCode.trim().toUpperCase() } })
      : null;
    const termsAppliedAt = terms?.active ? new Date() : null;
    const dueDate = terms?.active
      ? computeDueDate(terms.rule, terms.days, ctx.confirmedAt ?? new Date())
      : null;

    const code = await this.ids.nextCode(tx, "SBO");
    try {
      const row = await tx.supplierObligation.create({
        data: {
          code,
          bookingId: input.bookingId,
          bookingCode: input.bookingCode,
          orderId: input.orderId,
          orderCode: input.orderCode,
          orderItemId: input.orderItemId,
          supplierCode,
          partnerId: input.sellerPartnerId,
          serviceType,
          sourceAmount,
          sourceCurrency,
          aznAmount,
          fxRate,
          fxRateCode,
          status: "OPEN",
          paidAmount: new Prisma.Decimal(0),
          remainingAmount: aznAmount, // paid = 0 → remaining = aznAmount (или null = UNKNOWN)
          source: "BOOKING_CONFIRMED",
          sourceEventId: ctx.sourceEventId,
          confirmedAt: ctx.confirmedAt,
          dueDate,
          paymentTermsRule: terms?.active ? terms.rule : null,
          paymentTermsDays: terms?.active ? terms.days : null,
          paymentTermsAppliedAt: termsAppliedAt,
        },
      });
      await this.security.audit(tx, {
        action: "finance.obligation.created",
        resource: "SupplierObligation",
        resourceId: row.id,
        details: {
          code,
          bookingId: input.bookingId,
          orderId: input.orderId,
          supplierCode,
          sourceAmount: sourceAmount.toString(),
          sourceCurrency,
          aznAmount: aznAmount ? aznAmount.toString() : null,
          amountUnknown: aznAmount == null,
        },
      });
      // Историческая проекция для отчёта «задолженность на дату».
      await tx.supplierObligationEvent.create({
        data: {
          obligationId: row.id,
          type: "CREATED",
          aznAmount,
          occurredAt: ctx.confirmedAt ?? row.createdAt,
          details: { source: "BOOKING_CONFIRMED", sourceEventId: ctx.sourceEventId },
        },
      });
      return this.toDto(row, null);
    } catch (err) {
      // Идемпотентность: bookingId уже имеет obligation → вернуть существующую.
      if (this.isUniqueOn(err, "bookingId")) {
        const existing = await tx.supplierObligation.findUnique({ where: { bookingId: input.bookingId } });
        if (existing) return this.toDto(existing, null);
      }
      throw err;
    }
  }

  // ── Read ─────────────────────────────────────────────────────────────────

  async listObligations(query: {
    status?: string;
    supplierCode?: string;
    orderId?: string;
    /** true — только просроченные (dueDate < сегодня, остаток > 0, payable). */
    overdue?: boolean;
    /** dueDate < переданной даты (ISO). */
    dueBefore?: string;
    /** Поиск по коду/счёту/заказу/брони. */
    search?: string;
    page?: number;
    pageSize?: number;
  }): Promise<{ items: SupplierObligationDto[]; page: number; pageSize: number; total: number }> {
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(200, Math.max(1, query.pageSize ?? 20));
    const where: Prisma.SupplierObligationWhereInput = {};
    if (query.status) where.status = query.status;
    if (query.supplierCode) where.supplierCode = query.supplierCode;
    if (query.orderId) where.orderId = query.orderId;
    const today = startOfTodayUtc();
    if (query.overdue === true) {
      where.dueDate = { lt: today };
      where.status = { in: [...PAYABLE_STATUSES] };
      where.remainingAmount = { gt: new Prisma.Decimal(0) };
    } else if (query.dueBefore) {
      where.dueDate = { lt: this.parseDate(query.dueBefore, "dueBefore") };
    }
    const search = query.search?.trim();
    if (search) {
      where.OR = [
        { code: { contains: search, mode: "insensitive" } },
        { invoiceNumber: { contains: search, mode: "insensitive" } },
        { orderCode: { contains: search, mode: "insensitive" } },
        { bookingCode: { contains: search, mode: "insensitive" } },
      ];
    }

    const [total, rows] = await Promise.all([
      this.prisma.supplierObligation.count({ where }),
      this.prisma.supplierObligation.findMany({
        where,
        orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    const partners = await this.resolvePartnerCodes(rows.map((r) => r.partnerId));
    return {
      items: rows.map((r) => this.toDto(r, partners.get(r.partnerId ?? "") ?? null)),
      page,
      pageSize,
      total,
    };
  }

  /** Плоские строки для экспорта реестра обязательств (cap 5000). */
  async exportRows(query: {
    status?: string;
    supplierCode?: string;
    overdue?: boolean;
    search?: string;
    dueBefore?: string;
  }): Promise<Array<Record<string, string | null>>> {
    const where: Prisma.SupplierObligationWhereInput = {};
    if (query.status) where.status = query.status;
    if (query.supplierCode) where.supplierCode = query.supplierCode;
    if (query.overdue === true) {
      where.dueDate = { lt: startOfTodayUtc() };
      where.status = { in: [...PAYABLE_STATUSES] };
      where.remainingAmount = { gt: new Prisma.Decimal(0) };
    } else if (query.dueBefore) {
      where.dueDate = { lt: this.parseDate(query.dueBefore, "dueBefore") };
    }
    const search = query.search?.trim();
    if (search) {
      where.OR = [
        { code: { contains: search, mode: "insensitive" } },
        { invoiceNumber: { contains: search, mode: "insensitive" } },
        { orderCode: { contains: search, mode: "insensitive" } },
        { bookingCode: { contains: search, mode: "insensitive" } },
      ];
    }
    const rows = await this.prisma.supplierObligation.findMany({
      where,
      orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
      take: 5000,
    });
    const partners = await this.resolvePartnerCodes(rows.map((r) => r.partnerId));
    return rows.map((r) => {
      const dto = this.toDto(r, partners.get(r.partnerId ?? "") ?? null);
      return {
        code: dto.code,
        status: dto.displayStatus,
        supplierCode: dto.supplierCode,
        partnerCode: dto.partnerCode,
        invoiceNumber: dto.invoiceNumber,
        dueDate: dto.dueDate,
        overdue: String(dto.overdue),
        orderCode: dto.orderCode,
        bookingCode: dto.bookingCode,
        sourceAmount: dto.sourceAmount,
        sourceCurrency: dto.sourceCurrency,
        aznAmount: dto.aznAmount,
        paidAmount: dto.paidAmount,
        remainingAmount: dto.remainingAmount,
        confirmedAt: dto.confirmedAt,
      };
    });
  }

  async getObligation(codeOrId: string): Promise<SupplierObligationDto & { payouts: SupplierPayoutDto[] }> {
    const row = await this.prisma.supplierObligation.findFirst({
      where: { OR: [{ code: codeOrId }, { id: codeOrId }] },
      include: { payouts: { orderBy: { occurredAt: "asc" } } },
    });
    if (!row) throw new NotFoundError(`SupplierObligation ${codeOrId} not found`);
    const partner = row.partnerId ? await this.resolvePartnerCodes([row.partnerId]).then((m) => m.get(row.partnerId!) ?? null) : null;
    return { ...this.toDto(row, partner), payouts: row.payouts.map((p) => this.toPayoutDto(p, row.code)) };
  }

  // ── Partial payout (atomic, idempotent, overpayment-blocked) ─────────────

  /**
   * Частичная выплата поставщику. Атомарно: guarded UPDATE
   * (status payable AND remaining >= aznAmount) защищает от concurrent
   * overspend → 409. providerRef — ключ идемпотентности (replay → no-op,
   * divergent → 409). aznAmount: если не передан и валюта движения совпадает
   * с sourceCurrency при fxRate — считается сервером (amount × fxRate);
   * иначе требуется явный aznAmount (валидируется <= remaining).
   */
  async createPayout(
    input: {
      obligationCode: string;
      amount: string;
      currency: string;
      aznAmount?: string;
      fxRate?: string;
      method?: string;
      providerRef?: string;
      occurredAt?: string;
      reason?: string;
      evidenceUrl?: string;
      purpose?: string;
      comment?: string;
    },
    actor: Actor,
  ): Promise<SupplierPayoutDto> {
    const obligation = await this.prisma.supplierObligation.findFirst({
      where: { OR: [{ code: input.obligationCode }, { id: input.obligationCode }] },
    });
    if (!obligation) throw new NotFoundError(`SupplierObligation ${input.obligationCode} not found`);

    const amount = toMoney2(input.amount, "amount");
    if (amount.lessThanOrEqualTo(0)) throw new ValidationDomainError("amount must be > 0");
    const currency = validateIsoCode(input.currency, "currency");

    // UNKNOWN obligation → payout заблокирован (never zero).
    if (obligation.aznAmount == null || obligation.remainingAmount == null) {
      throw new ValidationDomainError(
        `SupplierObligation ${obligation.code} has UNKNOWN AZN amount (missing commercial snapshot / FX rate); payouts are blocked until resolved`,
      );
    }
    if (!PAYABLE_STATUSES.includes(obligation.status as (typeof PAYABLE_STATUSES)[number])) {
      throw new ConflictError(`SupplierObligation ${obligation.code} is ${obligation.status} and no longer accepts payouts`);
    }

    // AZN-аллокация: сервер считает при совпадении валюты + fxRate; иначе
    // требует явный aznAmount (не доверяем «AZN-итогам» клиента без валидации).
    let aznAmount: Prisma.Decimal;
    const sameCurrency = currency === obligation.sourceCurrency && obligation.fxRate != null;
    if (input.aznAmount != null && input.aznAmount.trim() !== "") {
      aznAmount = toMoney2(input.aznAmount, "aznAmount");
    } else if (sameCurrency) {
      aznAmount = toMoney2(amount.mul(obligation.fxRate!), "aznAmount");
    } else {
      throw new ValidationDomainError(
        "aznAmount is required when payout currency differs from the obligation source currency (no frozen rate to convert)",
      );
    }
    if (aznAmount.lessThanOrEqualTo(0)) throw new ValidationDomainError("aznAmount must be > 0");
    if (aznAmount.greaterThan(obligation.remainingAmount)) {
      throw new ValidationDomainError(
        `overpayment blocked: aznAmount ${aznAmount.toString()} exceeds remaining ${obligation.remainingAmount.toString()} on ${obligation.code}`,
      );
    }

    // FX variance: aznAmount − (amount по замороженному курсу); только когда
    // движение в исходной валюте и fxRate известен.
    let fxVariance: Prisma.Decimal | null = null;
    if (sameCurrency) {
      const expected = toMoney2(amount.mul(obligation.fxRate!), "expected");
      fxVariance = aznAmount.sub(expected);
    }
    const payoutFxRate = input.fxRate != null && input.fxRate.trim() !== "" ? this.parseRate(input.fxRate) : null;
    const occurredAt = input.occurredAt ? this.parseDate(input.occurredAt, "occurredAt") : new Date();
    const providerRef = input.providerRef?.trim() ? input.providerRef.trim() : null;

    // Идемпотентность по providerRef (replay → no-op; divergent → 409).
    if (providerRef) {
      const existing = await this.prisma.supplierPayout.findUnique({ where: { providerRef } });
      if (existing) {
        const same =
          existing.obligationId === obligation.id &&
          existing.aznAmount.equals(aznAmount) &&
          existing.amount.equals(amount) &&
          existing.currency === currency;
        if (same) return this.toPayoutDto(existing, obligation.code);
        throw new ConflictError(`payout with providerRef ${providerRef} already exists with a different payload`);
      }
    }

    const code = await this.ids.nextCode(null, "SPO");
    let payoutEventId = "";
    const dto = await this.prisma.$transaction(async (tx) => {
      // Gаged atomic update: инкремент paid / декремент remaining ТОЛЬКО если
      // obligation всё ещё payable И remaining >= aznAmount (concurrent overspend
      // → count 0 → 409, деньги не «создаются»).
      const upd = await tx.supplierObligation.updateMany({
        where: {
          id: obligation.id,
          status: { in: [...PAYABLE_STATUSES] },
          remainingAmount: { gte: aznAmount },
        },
        data: {
          paidAmount: { increment: aznAmount },
          remainingAmount: { decrement: aznAmount },
          updatedAt: new Date(),
        },
      });
      if (upd.count === 0) {
        throw new ConflictError(
          `concurrent overspend or obligation ${obligation.code} became non-payable; payout rejected`,
        );
      }

      const payout = await tx.supplierPayout.create({
        data: {
          code,
          obligationId: obligation.id,
          supplierCode: obligation.supplierCode,
          partnerId: obligation.partnerId,
          status: "CONFIRMED",
          amount,
          currency,
          aznAmount,
          fxRate: payoutFxRate ?? obligation.fxRate,
          fxVariance,
          method: input.method?.trim() || null,
          providerRef,
          purpose: input.purpose?.trim() || null,
          comment: input.comment?.trim() || null,
          occurredAt,
          reason: input.reason?.trim() || null,
          evidenceUrl: input.evidenceUrl?.trim() || null,
          confirmedAt: occurredAt,
          confirmedById: actor.id,
          actorType: "USER",
          actorId: actor.id,
        },
      });
      // Allocation — единственный источник, из которого пересчитывается
      // paid/remaining; legacy-путь остаётся «одна obligation = один платёж»,
      // но данные уже совместимы с multi-allocation реестром.
      await tx.supplierPayoutAllocation.create({
        data: {
          payoutId: payout.id,
          obligationId: obligation.id,
          amount,
          aznAmount,
          createdById: actor.id,
        },
      });

      // Статус по свежему остатку: 0 → CLOSED, иначе PARTIALLY_PAID.
      const fresh = await tx.supplierObligation.findUniqueOrThrow({ where: { id: obligation.id } });
      const nextStatus = fresh.remainingAmount != null && fresh.remainingAmount.isZero() ? "CLOSED" : "PARTIALLY_PAID";
      if (fresh.status !== nextStatus) {
        await tx.supplierObligation.update({ where: { id: obligation.id }, data: { status: nextStatus } });
      }

      await this.security.audit(tx, {
        action: "finance.supplier_payout.created",
        resource: "SupplierPayout",
        resourceId: payout.id,
        details: {
          code,
          obligationCode: obligation.code,
          amount: amount.toString(),
          currency,
          aznAmount: aznAmount.toString(),
          fxVariance: fxVariance ? fxVariance.toString() : null,
          providerRef,
          actor: actor.username,
        },
      });

      // UNIFIED FINANCE CENTER Phase 5 — ledger source-fact. Эмитится в ТОЙ ЖЕ
      // транзакции (transactional outbox); retryable=true — durable retry
      // ledger-проекции (LedgerPostingConsumer). Идемпотентность — inbox +
      // LedgerTransaction @@unique([sourceType, sourceId, type]).
      payoutEventId = await this.eventBus.emit(tx, {
        aggregateType: "SupplierPayout",
        aggregateId: payout.id,
        eventType: DomainEvents.SupplierPayoutCreated,
        payload: {
          payoutId: payout.id,
          payoutCode: payout.code,
          obligationId: obligation.id,
          obligationCode: obligation.code,
          amount: amount.toString(),
          currency,
          aznAmount: aznAmount.toString(),
          providerRef,
          occurredAt: occurredAt.toISOString(),
        },
        retryable: true,
      });

      return this.toPayoutDto(payout, obligation.code);
    });

    // Step 2.17B: доставляем ТОЛЬКО событие текущего запроса (publishEvent),
    // не дренируя весь PENDING-backlog (publishPending) — латентность HTTP-пути.
    await this.eventBus.publishEvent(payoutEventId);
    return dto;
  }

  async listPayouts(query: { obligationCode?: string; page?: number; pageSize?: number }): Promise<{ items: SupplierPayoutDto[]; page: number; pageSize: number; total: number }> {
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(200, Math.max(1, query.pageSize ?? 20));
    const where: Record<string, unknown> = {};
    if (query.obligationCode) {
      const ob = await this.prisma.supplierObligation.findFirst({
        where: { OR: [{ code: query.obligationCode }, { id: query.obligationCode }] },
        select: { id: true, code: true },
      });
      if (!ob) throw new NotFoundError(`SupplierObligation ${query.obligationCode} not found`);
      where.obligationId = ob.id;
    }
    const [total, rows] = await Promise.all([
      this.prisma.supplierPayout.count({ where }),
      this.prisma.supplierPayout.findMany({ where, orderBy: { occurredAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize }),
    ]);
    const obCodes = new Map<string, string>();
    const obIds = [...new Set(rows.map((r) => r.obligationId).filter((id): id is string => Boolean(id)))];
    if (obIds.length) {
      const obs = await this.prisma.supplierObligation.findMany({ where: { id: { in: obIds } }, select: { id: true, code: true } });
      for (const o of obs) obCodes.set(o.id, o.code);
    }
    return { items: rows.map((r) => this.toPayoutDto(r, obCodes.get(r.obligationId ?? "") ?? "")), page, pageSize, total };
  }

  // ── Cancel / adjust (только unpaid; auditable) ───────────────────────────

  /** Отмена obligation (только когда paidAmount == 0). Append-only audit. */
  async cancelObligation(codeOrId: string, reason: string | null, actor: Actor): Promise<SupplierObligationDto> {
    const ob = await this.prisma.supplierObligation.findFirst({
      where: { OR: [{ code: codeOrId }, { id: codeOrId }] },
    });
    if (!ob) throw new NotFoundError(`SupplierObligation ${codeOrId} not found`);
    if (!ob.paidAmount.isZero()) {
      throw new ConflictError(`cannot cancel ${ob.code}: ${ob.paidAmount.toString()} AZN already paid; reverse payouts first (future step)`);
    }
    if (ob.status === "CANCELLED") return this.toDto(ob, null);
    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.supplierObligation.update({ where: { id: ob.id }, data: { status: "CANCELLED", updatedAt: new Date() } });
      await this.security.audit(tx, {
        action: "finance.obligation.cancelled",
        resource: "SupplierObligation",
        resourceId: ob.id,
        details: { code: ob.code, reason: reason ?? null, actor: actor.username },
      });
      await tx.supplierObligationEvent.create({
        data: {
          obligationId: ob.id,
          type: "CANCELLED",
          aznAmount: ob.aznAmount,
          occurredAt: new Date(),
          actorId: actor.id,
          details: { reason: reason ?? null },
        },
      });
      return row;
    });
    return this.toDto(updated, null);
  }

  /**
   * Корректировка суммы obligation (только когда paidAmount == 0): меняет
   * aznAmount/remaining, статус → ADJUSTED. Старое/новое значение — в append-only
   * AuditLog (история сохраняется, финансовый факт не «переписывается» молча).
   */
  async adjustObligation(
    codeOrId: string,
    input: { newAznAmount: string; newSourceAmount?: string; reason: string | null },
    actor: Actor,
  ): Promise<SupplierObligationDto> {
    const ob = await this.prisma.supplierObligation.findFirst({
      where: { OR: [{ code: codeOrId }, { id: codeOrId }] },
    });
    if (!ob) throw new NotFoundError(`SupplierObligation ${codeOrId} not found`);
    if (!ob.paidAmount.isZero()) {
      throw new ConflictError(`cannot adjust ${ob.code}: ${ob.paidAmount.toString()} AZN already paid; post-payout adjustment is a future step`);
    }
    if (ob.status === "CANCELLED") throw new ConflictError(`cannot adjust ${ob.code}: obligation is CANCELLED`);

    const newAzn = toMoney2(input.newAznAmount, "newAznAmount");
    if (newAzn.lessThanOrEqualTo(0)) throw new ValidationDomainError("newAznAmount must be > 0");
    const newSource = input.newSourceAmount != null && input.newSourceAmount.trim() !== "" ? toMoney2(input.newSourceAmount, "newSourceAmount") : ob.sourceAmount;

    let adjustEventId = "";
    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.supplierObligation.update({
        where: { id: ob.id },
        data: {
          aznAmount: newAzn,
          remainingAmount: newAzn, // paid == 0
          sourceAmount: newSource,
          status: "ADJUSTED",
          updatedAt: new Date(),
        },
      });
      await this.security.audit(tx, {
        action: "finance.obligation.adjusted",
        resource: "SupplierObligation",
        resourceId: ob.id,
        details: {
          code: ob.code,
          oldAznAmount: ob.aznAmount ? ob.aznAmount.toString() : null,
          newAznAmount: newAzn.toString(),
          oldSourceAmount: ob.sourceAmount.toString(),
          newSourceAmount: newSource.toString(),
          reason: input.reason ?? null,
          actor: actor.username,
        },
      });
      await tx.supplierObligationEvent.create({
        data: {
          obligationId: ob.id,
          type: "ADJUSTED",
          aznAmount: newAzn,
          occurredAt: new Date(),
          actorId: actor.id,
          details: {
            oldAznAmount: ob.aznAmount ? ob.aznAmount.toString() : null,
            newAznAmount: newAzn.toString(),
            reason: input.reason ?? null,
          },
        },
      });

      // UNIFIED FINANCE CENTER Phase 5 — ledger source-fact (revaluation).
      // Эмитится в ТОЙ ЖЕ транзакции; retryable=true — durable retry
      // ledger-проекции (LedgerPostingConsumer). Append-only ledger фиксирует
      // изменение AZN-суммы как факт, не перезаписывая прошлые записи.
      adjustEventId = await this.eventBus.emit(tx, {
        aggregateType: "SupplierObligation",
        aggregateId: ob.id,
        eventType: DomainEvents.ObligationAdjusted,
        payload: {
          obligationId: ob.id,
          obligationCode: ob.code,
          previousAznAmount: ob.aznAmount ? ob.aznAmount.toString() : null,
          newAznAmount: newAzn.toString(),
          reason: input.reason ?? null,
        },
        retryable: true,
      });

      return row;
    });

    // Step 2.17B: доставляем ТОЛЬКО событие текущего запроса (publishEvent).
    await this.eventBus.publishEvent(adjustEventId);
    return this.toDto(updated, null);
  }

  /**
   * Реквизиты счёта и срок оплаты (вводятся/уточняются финансами). Меняются
   * только метаданные обязательства — суммы и frozen FX не переписываются.
   * Каждое изменение версионируется и попадает в AuditLog.
   */
  async updateTerms(
    codeOrId: string,
    input: { dueDate?: string | null; invoiceNumber?: string | null; reason?: string | null },
    actor: Actor,
  ): Promise<SupplierObligationDto> {
    const ob = await this.prisma.supplierObligation.findFirst({
      where: { OR: [{ code: codeOrId }, { id: codeOrId }] },
    });
    if (!ob) throw new NotFoundError(`SupplierObligation ${codeOrId} not found`);
    if (ob.status === "CANCELLED" || ob.status === "CLOSED") {
      throw new ConflictError(`cannot change payment terms of ${ob.code}: obligation is ${ob.status}`);
    }

    let dueDate: Date | null = ob.dueDate;
    if (input.dueDate !== undefined) {
      if (input.dueDate === null || input.dueDate.trim() === "") {
        dueDate = null;
      } else {
        const parsed = this.parseDate(input.dueDate, "dueDate");
        // Date-only contract: нормализуем к UTC-полуночи, чтобы «сегодня» не
        // становилось просрочкой из-за времени суток.
        dueDate = new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate()));
      }
    }
    let invoiceNumber: string | null = ob.invoiceNumber;
    if (input.invoiceNumber !== undefined) {
      const trimmed = input.invoiceNumber?.trim() ?? "";
      if (trimmed.length > 100) throw new ValidationDomainError("invoiceNumber must be <= 100 characters");
      invoiceNumber = trimmed || null;
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.supplierObligation.update({
        where: { id: ob.id },
        data: { dueDate, invoiceNumber, version: { increment: 1 }, updatedAt: new Date() },
      });
      await this.security.audit(tx, {
        action: "finance.obligation.terms_updated",
        resource: "SupplierObligation",
        resourceId: ob.id,
        details: {
          code: ob.code,
          oldDueDate: ob.dueDate ? ob.dueDate.toISOString() : null,
          newDueDate: dueDate ? dueDate.toISOString() : null,
          oldInvoiceNumber: ob.invoiceNumber,
          newInvoiceNumber: invoiceNumber,
          reason: input.reason ?? null,
          actor: actor.username,
        },
      });
      return row;
    });
    return this.toDto(updated, null);
  }

  /** Append-only история действий по обязательству (security.AuditLog). */
  async getHistory(codeOrId: string) {
    const ob = await this.prisma.supplierObligation.findFirst({
      where: { OR: [{ code: codeOrId }, { id: codeOrId }] },
      select: { id: true, code: true },
    });
    if (!ob) throw new NotFoundError(`SupplierObligation ${codeOrId} not found`);
    const rows = await this.prisma.auditLog.findMany({
      where: { resource: "SupplierObligation", resourceId: ob.id },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        action: true,
        username: true,
        details: true,
        createdAt: true,
      },
    });
    return {
      obligationCode: ob.code,
      items: rows.map((r) => ({
        id: r.id,
        action: r.action,
        username: r.username,
        details: r.details,
        createdAt: r.createdAt.toISOString(),
      })),
    };
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  /** Просрочка: срок в прошлом, остаток > 0 и статус допускает оплату. */
  private isOverdue(status: string, remaining: Prisma.Decimal | null, dueDate: Date | null): boolean {
    if (!dueDate || remaining == null || remaining.lessThanOrEqualTo(0)) return false;
    if (!PAYABLE_STATUSES.includes(status as (typeof PAYABLE_STATUSES)[number])) return false;
    return dueDate.getTime() < startOfTodayUtc().getTime();
  }

  private toDto(row: ObligationRow, partnerCode: string | null): SupplierObligationDto {
    const remaining = row.remainingAmount;
    const overdue = this.isOverdue(row.status, remaining, row.dueDate);
    return {
      id: row.id,
      code: row.code,
      bookingId: row.bookingId,
      bookingCode: row.bookingCode,
      orderId: row.orderId,
      orderCode: row.orderCode,
      orderItemId: row.orderItemId,
      invoiceNumber: row.invoiceNumber,
      dueDate: row.dueDate ? row.dueDate.toISOString() : null,
      overdue,
      displayStatus: overdue ? "OVERDUE" : row.status,
      supplierCode: row.supplierCode,
      partnerId: row.partnerId,
      partnerCode,
      serviceType: row.serviceType,
      sourceAmount: row.sourceAmount.toString(),
      sourceCurrency: row.sourceCurrency,
      aznAmount: dec(row.aznAmount),
      fxRate: dec(row.fxRate),
      fxRateCode: row.fxRateCode,
      status: row.status,
      paidAmount: row.paidAmount.toString(),
      remainingAmount: dec(row.remainingAmount),
      amountUnknown: row.aznAmount == null,
      source: row.source,
      sourceEventId: row.sourceEventId,
      confirmedAt: row.confirmedAt ? row.confirmedAt.toISOString() : null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private toPayoutDto(
    p: {
      id: string;
      code: string;
      obligationId: string | null;
      status: string;
      supplierCode: string | null;
      partnerId: string | null;
      purpose: string | null;
      comment: string | null;
      confirmedAt: Date | null;
      amount: Prisma.Decimal;
      currency: string;
      aznAmount: Prisma.Decimal;
      fxRate: Prisma.Decimal | null;
      fxVariance: Prisma.Decimal | null;
      method: string | null;
      providerRef: string | null;
      occurredAt: Date;
      reason: string | null;
      evidenceUrl: string | null;
      actorId: string | null;
      createdAt: Date;
    },
    obligationCode: string,
  ): SupplierPayoutDto {
    return {
      id: p.id,
      code: p.code,
      obligationId: p.obligationId,
      obligationCode,
      status: p.status,
      supplierCode: p.supplierCode,
      partnerId: p.partnerId,
      purpose: p.purpose,
      comment: p.comment,
      confirmedAt: p.confirmedAt ? p.confirmedAt.toISOString() : null,
      amount: p.amount.toString(),
      currency: p.currency,
      aznAmount: p.aznAmount.toString(),
      fxRate: dec(p.fxRate),
      fxVariance: dec(p.fxVariance),
      method: p.method,
      providerRef: p.providerRef,
      occurredAt: p.occurredAt.toISOString(),
      reason: p.reason,
      evidenceUrl: p.evidenceUrl,
      actorId: p.actorId,
      createdAt: p.createdAt.toISOString(),
    };
  }

  private parseSnapshot(value: unknown): Record<string, unknown> | null {
    if (value == null) return null;
    if (typeof value === "string") {
      try {
        const parsed = JSON.parse(value);
        return typeof parsed === "object" && parsed !== null ? (parsed as Record<string, unknown>) : null;
      } catch {
        return null;
      }
    }
    return typeof value === "object" ? (value as Record<string, unknown>) : null;
  }

  private parseRate(value: unknown): Prisma.Decimal {
    try {
      const d = new Prisma.Decimal(String(value));
      if (!d.isFinite() || d.lessThanOrEqualTo(0)) throw new Error("bad rate");
      return d;
    } catch {
      throw new ValidationDomainError(`invalid FX rate: ${String(value)}`);
    }
  }

  private parseDate(value: string, label: string): Date {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) throw new ValidationDomainError(`${label} must be a valid ISO-8601 datetime`);
    return d;
  }

  private async resolvePartnerCodes(partnerIds: Array<string | null>): Promise<Map<string, string>> {
    const unique = [...new Set(partnerIds.filter((id): id is string => Boolean(id)))];
    if (unique.length === 0) return new Map();
    const partners = await this.prisma.partner.findMany({ where: { id: { in: unique } }, select: { id: true, code: true } });
    return new Map(partners.map((p) => [p.id, p.code]));
  }

  private isUniqueOn(err: unknown, field: string): boolean {
    if (typeof err !== "object" || err === null) return false;
    const e = err as { code?: string; meta?: { target?: unknown } };
    if (e.code !== "P2002") return false;
    const target = Array.isArray(e.meta?.target) ? (e.meta.target as string[]) : [];
    return target.includes(field);
  }
}
