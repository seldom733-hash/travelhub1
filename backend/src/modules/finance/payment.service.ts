/**
 * PHASE 2 STEP 2.12 — PaymentService (provider-neutral Payment runtime).
 *
 * Finance-owned canonical Payment aggregate (PAY-*). Активация runtime,
 * заявленного в Step 2.10 foundation (§15/§52): создание + lifecycle Payment
 * с НЕПСП-механикой — PSP/adapters/webhooks — Step 2.12A/2.12B.
 *
 * Принцип (Prompt §2): Payment погашает УЖЕ замороженное финансовое
 * обязательство; Payment НЕ является pricing authority.
 *
 * Hard gates:
 *  - Payment создаётся ТОЛЬКО Finance (finance.payment.write); Order/Booking/
 *    Sales НЕ пишут finance.Payment (никаких cross-domain writes);
 *  - payable source — frozen Order snapshot (Order.amount/currency verbatim,
 *    immutable; НИКАКОГО reprice из mutable Catalog/Tax/FX — §12/§43);
 *  - cardinality (MULTI/PARTIAL PAYMENTS §3): БЕЗ ограничения «один Payment
 *    на Order» — частичный unique "Payment_one_active_per_order" снят
 *    миграцией 20261009100000_multi_partial_payments. Один Order может иметь
 *    неограниченное число Payment-записей; каждая со СВОЕЙ суммой
 *    (0 < amount <= due, transaction-safe due-guard под advisory lock);
 *    FAILED/CANCELLED не влияют на остаток (повторная инициация легальна);
 *  - status machine (единственный authority): PENDING → CAPTURED (paidAt) |
 *    FAILED (failedAt) | CANCELLED (cancelledAt). AUTHORIZED/REFUNDED —
 *    reserved vocabulary (producer: 2.12B PSP authorize / 2.13 refund);
 *    capturedAt/authorizedAt milestones — DEFER (2.12B);
 *  - idempotency (§5): внешний Idempotency-Key (Idempotent interceptor,
 *    fingerprint replay) — тот же ключ+body → replay существующего факта;
 *    бизнес-level «active payment no-op» СНЯТ (мульти-платежи — каждый create
 *    с новым ключом = новый факт); конкурентные create сериализуются
 *    pg_advisory_xact_lock на Order, сумма одобренных ≤ due проверяется
 *    транзакционно; неизвестный P2002 не глотается;
 *  - 0 side effects: без LedgerTransaction/ProviderFee/Settlement/Payout/
 *    Refund/Invoice/CommissionAccrual auto-post (boundaries §22–§25);
 *  - события: PaymentCreated/PaymentCaptured/PaymentFailed/PaymentCancelled
 *    (outbox, correlation/causation/actor server-authoritative);
 *  - milestones server-owned UTC, первый переход wins, атомарны с CAS.
 */
import { Injectable } from "@nestjs/common";
import { Prisma } from "../../generated/prisma/client";
import { PaymentStatus, RefundStatus } from "../../generated/prisma/enums";
import { PrismaService } from "../../prisma/prisma.service";
import { isDeniedStorefrontScope, PARTNER_STOREFRONT_SOURCE } from "../../shared/sales-scope";
import {
  buildPaymentsScopes,
  emptyPaymentStatusAgg,
  emptyRefundStatusAgg,
  isPaymentDateField,
  isPaymentStatusValue,
  isRefundStatusValue,
} from "./payments-registry";
import { IdsService } from "../../shared/ids.service";
import { ReferenceNumberService } from "../../shared/reference-number.service";
import { SecurityService } from "../../security/security.service";
import { ConflictError, NotFoundError, ValidationDomainError } from "../../shared/errors";
import { parseDateParam as parseRegistryDateParam } from "../../shared/date-param";
import { getRequestContext } from "../../shared/request-context";
import { EventBusService } from "../../eventbus/eventbus.service";
import { DomainEvents, type PaymentEventPayload } from "../../eventbus/domain-events";
import { validateFrozenMoneyFact } from "../sales/sales.money";
import { normalizeInitialNote } from "../operational-notes/operational-notes.types";
import { validatePaymentAmount } from "./finance.validation";

/** Статусы, НЕ блокирующие новую инициацию (attempt 2). */
const REINITIABLE: PaymentStatus[] = ["FAILED", "CANCELLED"];

interface Actor {
  id: string;
  username: string;
}

/** Статусы Order, при которых оплата невозможна (обязательство не подлежит оплате). */
const ORDER_NOT_PAYABLE = ["CANCELLED", "CLOSED"];

@Injectable()
export class PaymentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ids: IdsService,
    private readonly security: SecurityService,
    private readonly eventBus: EventBusService,
    private readonly refNum: ReferenceNumberService,
  ) {}

  // ── Payment creation ────────────────────────────────────────────────────────

  /**
   * Инициация Payment для Order (Finance command, finance.payment.write).
   * MULTI/PARTIAL (§4): клиент может указать amount (строковый Decimal) —
   * сервер валидирует 0 < amount <= due (validatePaymentAmount + due-guard)
   * ТРАНЗАКЦИОННО под pg_advisory_xact_lock(order-payments:{orderId}):
   * конкурентные create/confirm сериализуются, переплата невозможна. Без
   * amount — берётся весь текущий остаток (available = order.amount −
   * Σ(CAPTURED,REFUNDED) − Σ(PENDING,AUTHORIZED)). Деньги — frozen Order
   * snapshot verbatim (currency); frontend НЕ источник валюты (forged → 422).
   * Idempotency: ВНЕШНИЙ Idempotency-Key (Idempotent interceptor replay);
   * бизнес-level active-noop снят — каждый create с новым ключом = новый факт.
   */
  async createPayment(
    input: { orderId: string; amount?: string | null; paymentMethod?: string | null; reason?: string | null; initialNote?: string },
    actor: Actor,
    idempotencySlotKey?: string | null,
  ): Promise<Record<string, unknown>> {
    // MULTI/PARTIAL §13 (2.12H crash window 3) — бизнес-идемпотентность по слоту:
    // retry того же create request (stale IN_PROGRESS → CAS takeover → re-execute)
    // возвращает УЖЕ созданный этим же request'ом Payment — без дубликата и без
    // active-noop (он несовместим с multi/partial: легальные повторные платежи на
    // один Order — норма). Скоуп строго per-slot (Idempotency-Key): другой ключ →
    // findUnique не находит строку → штатный create. Server-owned ключ пишет
    // ТОЛЬКО IdempotencyInterceptor (из body его подставить нельзя).
    if (idempotencySlotKey) {
      const existing = await this.prisma.payment.findUnique({ where: { idempotencySlotKey } });
      if (existing) return this.paymentDto(existing);
    }
    const orderId = input.orderId.trim();
    if (!orderId) throw new ValidationDomainError("orderId is required");
    const paymentMethod = input.paymentMethod ? input.paymentMethod.trim() : null;
    if (paymentMethod && paymentMethod.length > 64) {
      throw new ValidationDomainError("paymentMethod must not exceed 64 characters");
    }
    // Step 3.6C.1: reason REQUIRED for manual payment initiation.
    const reason = input.reason ? input.reason.trim() : null;
    if (!reason || reason.length === 0) {
      throw new ValidationDomainError("reason is required for manual payment initiation");
    }

    // MULTI/PARTIAL §4: pre-tx валидация формата суммы (>0, ≤2dp) — до транзакции,
    // как validateRefundAmount в RefundService.
    const requestedAmount = input.amount != null && String(input.amount).trim().length > 0
      ? validatePaymentAmount(String(input.amount).trim())
      : null;

    // Phase 3 Round 2D.1: validate initialNote BEFORE transaction (pre-tx validation)
    // so >5000 rejection prevents Payment creation entirely.
    const noteText = normalizeInitialNote(input.initialNote);

    // READ-only cross-context read (ADR-0001): Order — owner обязательства.
    // Предварительная проверка (fast 404 / not-payable); авторитетная проверка
    // due выполняется внутри транзакции под advisory lock (свежая перечитка).
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundError(`Order ${orderId} not found`);
    if (ORDER_NOT_PAYABLE.includes(order.status)) {
      throw new ValidationDomainError(`Order ${order.code} is ${order.status}; payment cannot be initiated`);
    }

    // Frozen money fact (Step 2.11 authority): amount+currency из ОДНОГО frozen
    // источника (Order snapshot). Валидация — платформенный контракт sales.money.
    validateFrozenMoneyFact(order.amount, order.currency, "payment money fact");

    try {
      return await this.prisma.$transaction(async (tx) => {
        // MULTI/PARTIAL §4 (CRITICAL): сериализация create/confirm по Order —
        // конкурентные create и capture не могут вместе превысить due
        // (advisory xact lock освобождается на commit/rollback tx; проект-паттерн
        // atomic capacity — как в RefundService.createRefund).
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`order-payments:${order.id}`}))`;

        // Авторитетная перечитка Order под lock (due-guard на свежем состоянии).
        const fresh = await tx.order.findUnique({ where: { id: order.id } });
        if (!fresh) throw new NotFoundError(`Order ${orderId} not found`);
        if (ORDER_NOT_PAYABLE.includes(fresh.status)) {
          throw new ValidationDomainError(`Order ${fresh.code} is ${fresh.status}; payment cannot be initiated`);
        }

        // Денежный остаток: paid = Σ(CAPTURED, REFUNDED), reserved = Σ(PENDING,
        // AUTHORIZED); FAILED/CANCELLED не участвуют (повторная инициация).
        const paidAgg = await tx.payment.aggregate({
          where: { orderId: fresh.id, status: { in: [PaymentStatus.CAPTURED, PaymentStatus.REFUNDED] } },
          _sum: { amount: true },
        });
        const reservedAgg = await tx.payment.aggregate({
          where: { orderId: fresh.id, status: { in: [PaymentStatus.PENDING, PaymentStatus.AUTHORIZED] } },
          _sum: { amount: true },
        });
        const paidSum = paidAgg._sum.amount ?? new Prisma.Decimal(0);
        const reservedSum = reservedAgg._sum.amount ?? new Prisma.Decimal(0);
        const available = new Prisma.Decimal(fresh.amount).minus(paidSum).minus(reservedSum);

        // due-guard: 0 < amount <= available; без amount — весь остаток.
        let effectiveAmount: Prisma.Decimal;
        if (requestedAmount != null) {
          const candidate = new Prisma.Decimal(requestedAmount);
          if (candidate.greaterThan(available)) {
            throw new ValidationDomainError(
              `payment amount ${requestedAmount} exceeds remaining due ${available.toString()} for order ${fresh.code}` +
                (available.lte(0)
                  ? paidSum.gte(fresh.amount)
                    ? " (order is fully paid)"
                    : " (remaining due reserved by active payments)"
                  : ""),
            );
          }
          effectiveAmount = candidate;
        } else {
          if (available.lte(0)) {
            throw new ValidationDomainError(
              `order ${fresh.code} has no remaining amount due ` +
                (paidSum.gte(fresh.amount) ? "(fully paid)" : "(reserved by active payments)"),
            );
          }
          effectiveAmount = available;
        }

        const emitPayload = (paymentId: string, code: string): PaymentEventPayload => ({
          paymentId,
          code,
          orderId: fresh.id,
          customerId: fresh.customerId,
          amount: effectiveAmount.toString(),
          currency: fresh.currency,
          method: paymentMethod,
        });

        const code = await this.ids.nextCode(tx, "PAY");
        // Shared Commerce Sequence: derive Payment ref from Order's commerceSequence.
        const { referenceNumber, paymentOrdinal } = await this.generateCommercePaymentRef(tx, fresh);
        const created = await tx.payment.create({
          data: {
            code,
            referenceNumber,
            commerceSequence: fresh.commerceSequence ?? null,
            paymentOrdinal,
            orderId: fresh.id,
            customerId: fresh.customerId ?? null,
            amount: effectiveAmount,
            currency: fresh.currency,
            status: PaymentStatus.PENDING,
            paymentMethod,
            isActivePayment: true,
            version: 1,
            // MULTI/PARTIAL §13: связка «слот → платёж» для бизнес-идемпотентности
            // (retry того же request возвращает этот же Payment; null — вне
            // HTTP-idempotency-контекста, например system/provider-создание).
            idempotencySlotKey: idempotencySlotKey ?? null,
          },
        });
        await tx.paymentHistory.create({
          data: {
            paymentId: created.id,
            action: "created",
            to: PaymentStatus.PENDING,
            actorId: actor.id,
            actorName: actor.username,
            comment: reason ? `Платёж инициирован по заказу ${fresh.code}: ${reason}` : `Платёж инициирован по заказу ${fresh.code}`,
          },
        });
        await this.security.audit(tx, {
          userId: actor.id,
          username: actor.username,
          action: "finance.payment.created",
          resource: "Payment",
          resourceId: created.id,
          details: { code: created.code, orderId: fresh.id, amount: effectiveAmount.toString(), currency: fresh.currency },
        });
        await this.eventBus.emit(tx, {
          aggregateType: "Payment",
          aggregateId: created.id,
          eventType: DomainEvents.PaymentCreated,
          payload: emitPayload(created.id, created.code),
        });

        // Phase 3 Round 2D.1: optional initial OperationalNote (same transaction)
        if (noteText) {
          await tx.operationalNote.create({
            data: {
              entityType: "Payment",
              entityId: created.id,
              text: noteText,
              visibility: "INTERNAL",
              authorUserId: actor.id,
              authorName: actor.username,
            },
          });
        }

        return this.paymentDto(created);
      });
    } catch (err) {
      // Backstop: P2002 на Payment_idempotencySlotKey_key — гонка двух executor'ов
      // одного слота (теоретически недостижимо: stale takeover — CAS, winner один).
      // Бизнес-идемпотентность: возвращаем уже созданный Payment, НЕ raw 500.
      if (
        idempotencySlotKey &&
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002"
      ) {
        const existing = await this.prisma.payment.findUnique({ where: { idempotencySlotKey } });
        if (existing) return this.paymentDto(existing);
      }
      throw err;
    } finally {
      await this.eventBus.publishPending();
    }
  }

  /**
   * Shared Commerce Sequence: generate Payment reference with ordinal.
   * MKT-PAY-{root}-{ordinal} where ordinal = count of existing payments + 1.
   * Falls back to independent reference if Order has no commerceSequence.
   */
  private async generateCommercePaymentRef(
    tx: any,
    order: { id: string; commerceSequence: string | null; acquisitionSource: string | null; sellerPartnerId: string | null },
  ): Promise<{ referenceNumber: string; paymentOrdinal: number }> {
    if (order.commerceSequence) {
      // Count existing payments for this order to determine ordinal
      const existingCount = await tx.payment.count({ where: { orderId: order.id } });
      const ordinal = existingCount + 1;
      return {
        referenceNumber: this.refNum.commercePaymentRef(order.commerceSequence, ordinal),
        paymentOrdinal: ordinal,
      };
    }
    // Fallback: independent reference for legacy orders without commerceSequence
    const source = order.acquisitionSource;
    if (source === "PARTNER_STOREFRONT" && order.sellerPartnerId) {
      const sf = await tx.partnerStorefront.findUnique({
        where: { partnerId: order.sellerPartnerId },
        select: { storefrontCode: true },
      });
      if (sf) return { referenceNumber: await this.refNum.nextStorefrontReference(tx, sf.storefrontCode, "PAY"), paymentOrdinal: 0 };
    }
    return { referenceNumber: await this.refNum.nextMarketplaceReference(tx, "PAY"), paymentOrdinal: 0 };
  }

  // ── Lifecycle transitions (единственный state-machine authority) ──────────

  /** PENDING → CAPTURED (успех; money received, manual/provider-neutral
   *  подтверждение). Milestone paidAt (Step 2.10C DEFER → 2.12). */
  async confirmPayment(code: string, actor: Actor): Promise<Record<string, unknown>> {
    return this.transition(code, PaymentStatus.CAPTURED, "paidAt", "captured", "finance.payment.captured", DomainEvents.PaymentCaptured, actor);
  }

  /** PENDING → FAILED (терминальное отклонение; повторная инициация легальна). */
  async failPayment(code: string, actor: Actor): Promise<Record<string, unknown>> {
    return this.transition(code, PaymentStatus.FAILED, "failedAt", "failed", "finance.payment.failed", DomainEvents.PaymentFailed, actor);
  }

  /** PENDING → CANCELLED (терминальное отклонение; повторная инициация легальна). */
  async cancelPayment(code: string, actor: Actor): Promise<Record<string, unknown>> {
    return this.transition(code, PaymentStatus.CANCELLED, "cancelledAt", "cancelled", "finance.payment.cancelled", DomainEvents.PaymentCancelled, actor);
  }

  /**
   * Единый CAS-переход (паттерн Order/Booking): from-guard PENDING +
   * updateMany where id+status+version → ровно один победитель; повторный
   * переход → controlled 409 (terminal protection, конвенция completeSale).
   * Milestone + history + outbox атомарно с переходом. isActivePayment
   * обновляется атомарно (false для FAILED/CANCELLED — attempt 2 легален;
   * true для CAPTURED). MULTI/PARTIAL §4: перед CAPTURED — overpayment guard
   * под pg_advisory_xact_lock(order-payments:{orderId}) — Σ(CAPTURED/REFUNDED
   * остальных) + amount ≤ order.amount (переплата невозможна, 422).
   */
  private async transition(
    code: string,
    to: PaymentStatus,
    milestone: "paidAt" | "failedAt" | "cancelledAt",
    historyAction: string,
    auditAction: string,
    eventType: string,
    actor: Actor,
  ): Promise<Record<string, unknown>> {
    const payment = await this.prisma.payment.findUnique({ where: { code } });
    if (!payment) throw new NotFoundError(`Payment ${code} not found`);

    if (payment.status === to) {
      throw new ConflictError(`Payment ${code} is already ${to}`);
    }
    if (payment.status !== PaymentStatus.PENDING) {
      throw new ConflictError(`Payment ${code} cannot transition from ${payment.status} to ${to}`);
    }

    const now = new Date();
    const result = await this.prisma.$transaction(async (tx) => {
      // MULTI/PARTIAL §4 (CRITICAL): capture уменьшает остаток → сериализуемся
      // с create/другими confirm по Order тем же advisory lock'ом.
      if (to === PaymentStatus.CAPTURED) {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`order-payments:${payment.orderId}`}))`;
        const order = await tx.order.findUnique({ where: { id: payment.orderId } });
        if (order) {
          const others = await tx.payment.aggregate({
            where: {
              orderId: payment.orderId,
              status: { in: [PaymentStatus.CAPTURED, PaymentStatus.REFUNDED] },
              id: { not: payment.id },
            },
            _sum: { amount: true },
          });
          const capturedSum = others._sum.amount ?? new Prisma.Decimal(0);
          if (capturedSum.add(payment.amount).greaterThan(order.amount)) {
            throw new ValidationDomainError(
              `payment amount ${payment.amount.toString()} exceeds remaining due for order ${order.code} ` +
                `(overpayment protection: captured ${capturedSum.toString()} + this ${payment.amount.toString()} > total ${order.amount.toString()})`,
            );
          }
        }
      }
      const updatedRows = await tx.payment.updateMany({
        where: { id: payment.id, status: PaymentStatus.PENDING, version: payment.version },
        data: {
          status: to,
          version: { increment: 1 },
          [milestone]: now,
          isActivePayment: !REINITIABLE.includes(to),
        },
      });
      if (updatedRows.count !== 1) {
        throw new ConflictError(`Payment ${code} was modified concurrently; retry`);
      }
      const fresh = await tx.payment.findUniqueOrThrow({ where: { id: payment.id } });

      await tx.paymentHistory.create({
        data: {
          paymentId: payment.id,
          action: historyAction,
          from: PaymentStatus.PENDING,
          to,
          actorId: actor.id,
          actorName: actor.username,
          comment: historyAction === "captured" ? "Оплата получена (подтверждение Finance)" : undefined,
        },
      });
      await this.security.audit(tx, {
        userId: actor.id,
        username: actor.username,
        action: auditAction,
        resource: "Payment",
        resourceId: payment.id,
        details: { code: payment.code, from: PaymentStatus.PENDING, to },
      });
      await this.eventBus.emit(tx, {
        aggregateType: "Payment",
        aggregateId: payment.id,
        eventType,
        payload: {
          paymentId: payment.id,
          code: payment.code,
          orderId: payment.orderId,
          customerId: payment.customerId,
          amount: payment.amount.toString(),
          currency: payment.currency,
          method: payment.paymentMethod,
        } as PaymentEventPayload,
      });
      return fresh;
    });

    await this.eventBus.publishPending();
    return this.paymentDto(result);
  }

  // ── Read (Finance Center / Payments registry) ──────────────────────────────
  // UI-C1.2E read model: the payments registry splits the TABLE scope from the
  // OVERVIEW KPI scope (Requests/Orders/Bookings KPI-click contract). The
  // overview aggregates (total + paymentStatus 6/6 + refundStatus 4/4 +
  // per-currency money) are computed over the GLOBAL registry scope ONLY — the
  // active KPI dimensions (paymentStatus / refundStatus) filter the TABLE only,
  // so selecting one KPI card never collapses the other counts. Every canonical
  // status is exposed server-authoritatively (zero-count included); money stays
  // currency-scoped (no cross-currency totals). D7 financial authority untouched.

  async list(query: {
    orderId?: string;
    status?: string;
    paymentStatus?: string;
    refundStatus?: string;
    search?: string;
    currency?: string;
    currencyCard?: string;
    dateFrom?: string;
    dateTo?: string;
    dateField?: string;
    sortBy?: string;
    sortDirection?: string;
    page?: number;
    pageSize?: number;
    acquisitionSource?: string;
  }) {
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20));
    const n = this.normalizeRegistryQuery(query);
    // D4 REMEDIATION F2 (согласовано с Orders/Bookings list/export): explicit
    // Storefront-фильтр на platform Payments контракте → deny (invisibility,
    // empty result с честными нулевыми агрегатами).
    if (n.denied) {
      return { items: [], total: 0, page, pageSize, hasMore: false, aggregates: this.emptyRegistryAggregates() };
    }
    const channelOrderIds = await this.resolveChannelOrderIds(n.source);
    if (channelOrderIds.length === 0) {
      return { items: [], total: 0, page, pageSize, hasMore: false, aggregates: this.emptyRegistryAggregates() };
    }
    const searchOrderIds = n.search ? await this.resolveOrderSearchIds(n.search, n.source) : [];
    const scopeInput = {
      channelOrderIds,
      orderId: n.orderId,
      currency: n.currency,
      currencyCard: n.currencyCard,
      searchText: n.search,
      searchOrderIds,
      dateFrom: n.range?.from,
      dateTo: n.range?.to,
      dateField: n.dateField,
      paymentStatus: n.paymentStatus,
    };
    const scopes = buildPaymentsScopes(scopeInput);
    // Base-scope payment ids — canonical correlation set for Refund (Refund is a
    // separate Finance aggregate referenced by Refund.paymentId; no FK relation).
    const basePaymentIds = (await this.prisma.payment.findMany({ where: scopes.baseWhere, select: { id: true } })).map((p) => p.id);
    let tableScopes = scopes;
    if (n.refundStatus) {
      const refundPaymentIds = basePaymentIds.length === 0
        ? []
        : [...new Set((await this.prisma.refund.findMany({
            where: { status: n.refundStatus, paymentId: { in: basePaymentIds } },
            select: { paymentId: true },
          })).map((r) => r.paymentId))];
      tableScopes = buildPaymentsScopes({ ...scopeInput, refundStatus: n.refundStatus, refundPaymentIds });
    }

    const orderBy = this.buildRegistrySort(query.sortBy, query.sortDirection);
    const [items, tableTotal, statusGroups, overviewTotal, refundGroups, currencyGroups] = await Promise.all([
      this.prisma.payment.findMany({
        where: tableScopes.tableWhere,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.payment.count({ where: tableScopes.tableWhere }),
      this.prisma.payment.groupBy({ by: ["status"], where: scopes.baseWhere, _count: { status: true } }),
      this.prisma.payment.count({ where: scopes.baseWhere }),
      basePaymentIds.length > 0
        ? this.prisma.refund.groupBy({ by: ["status"], where: { paymentId: { in: basePaymentIds } }, _count: { status: true } })
        : Promise.resolve([]),
      this.prisma.payment.groupBy({
        by: ["currency"],
        where: scopes.baseWhere,
        _count: { _all: true },
        _sum: { amount: true },
      }),
    ]);

    // Assemble server-authoritative aggregates (deterministic zero-filled maps).
    const paymentStatusAgg = emptyPaymentStatusAgg();
    for (const g of statusGroups) paymentStatusAgg[g.status] = g._count.status;
    const refundStatusAgg = emptyRefundStatusAgg();
    for (const g of refundGroups) refundStatusAgg[g.status] = g._count.status;
    const currency = currencyGroups
      .map((c) => ({ currency: c.currency, count: c._count._all, amount: c._sum.amount ? c._sum.amount.toString() : "0" }))
      .sort((a, b) => b.count - a.count || a.currency.localeCompare(b.currency));
    const aggregates = {
      total: overviewTotal,
      paymentStatus: paymentStatusAgg,
      refundStatus: refundStatusAgg,
      currency,
    };

    const rows = items.map((r) => this.paymentDto(r));
    // Enrich each row with its canonical Order reference (single batched read —
    // no N+1). Booking registry precedent. MULTI/PARTIAL §7: каждая строка
    // несёт orderAmount + хронологический № (per-order 1..N) + Остаток после
    // строки (total − Σ CAPTURED/REFUNDED по заказу на момент строки) +
    // acceptedBy (PaymentHistory action='created', кто принял платёж).
    const rowOrderIds = [...new Set(items.map((p) => p.orderId).filter(Boolean))] as string[];
    const rowPaymentIds = items.map((p) => p.id);
    const [orders, allOrderPayments, createdHistories] = await Promise.all([
      rowOrderIds.length > 0
        ? this.prisma.order.findMany({ where: { id: { in: rowOrderIds } }, select: { id: true, referenceNumber: true, amount: true } })
        : Promise.resolve([]),
      rowOrderIds.length > 0
        ? this.prisma.payment.findMany({
            where: { orderId: { in: rowOrderIds } },
            orderBy: [{ createdAt: "asc" }, { id: "asc" }],
            select: { id: true, orderId: true, amount: true, status: true },
          })
        : Promise.resolve([]),
      rowPaymentIds.length > 0
        ? this.prisma.paymentHistory.findMany({
            where: { paymentId: { in: rowPaymentIds }, action: "created" },
            orderBy: [{ createdAt: "asc" }, { id: "asc" }],
            select: { paymentId: true, actorName: true },
          })
        : Promise.resolve([]),
    ]);
    const orderRefMap = new Map(orders.map((o) => [o.id, o.referenceNumber]));
    const orderAmountMap = new Map(orders.map((o) => [o.id, o.amount.toString()]));
    const orderTotalMap = new Map(orders.map((o) => [o.id, new Prisma.Decimal(o.amount)]));

    // Хронологический № + Остаток после строки — по ВСЕМ Payment'ам заказа
    // (не только page-страницы), накопление в порядке createdAt.
    const statsByPayment = new Map<string, { ordinal: number; remainingAfter: string }>();
    const runningByOrder = new Map<string, { count: number; paid: Prisma.Decimal }>();
    for (const p of allOrderPayments) {
      const acc = runningByOrder.get(p.orderId) ?? { count: 0, paid: new Prisma.Decimal(0) };
      acc.count += 1;
      if (p.status === PaymentStatus.CAPTURED || p.status === PaymentStatus.REFUNDED) {
        acc.paid = acc.paid.add(p.amount);
      }
      runningByOrder.set(p.orderId, acc);
      const total = orderTotalMap.get(p.orderId);
      const remaining = total ? total.minus(acc.paid) : null;
      statsByPayment.set(p.id, {
        ordinal: acc.count,
        remainingAfter: remaining && !remaining.isNegative() ? remaining.toString() : "0",
      });
    }

    const acceptedByMap = new Map<string, string | null>();
    for (const h of createdHistories) {
      if (!acceptedByMap.has(h.paymentId)) acceptedByMap.set(h.paymentId, h.actorName);
    }

    const enriched = rows.map((row) => {
      const stats = statsByPayment.get(row.id as string);
      return {
        ...row,
        orderReference: orderRefMap.get(row.orderId as string) ?? null,
        orderAmount: orderAmountMap.get(row.orderId as string) ?? null,
        ordinal: stats?.ordinal ?? null,
        remainingAfter: stats?.remainingAfter ?? null,
        acceptedBy: acceptedByMap.get(row.id as string) ?? null,
      };
    });

    return { items: enriched, total: tableTotal, page, pageSize, hasMore: page * pageSize < tableTotal, aggregates };
  }

  /**
   * Export all matching payments (current TABLE scope, no pagination).
   * Export follows the active TABLE FILTER scope — not the static overview KPI
   * scope (future export binding rule, C1.2E §28).
   */
  async exportPayments(query: {
    orderId?: string;
    status?: string;
    paymentStatus?: string;
    refundStatus?: string;
    search?: string;
    currency?: string;
    dateFrom?: string;
    dateTo?: string;
    dateField?: string;
    acquisitionSource?: string;
  }) {
    const n = this.normalizeRegistryQuery(query);
    if (n.denied) return { rows: [], total: 0 };
    const channelOrderIds = await this.resolveChannelOrderIds(n.source);
    if (channelOrderIds.length === 0) return { rows: [], total: 0 };
    const searchOrderIds = n.search ? await this.resolveOrderSearchIds(n.search, n.source) : [];
    const scopeInput = {
      channelOrderIds,
      orderId: n.orderId,
      currency: n.currency,
      currencyCard: n.currencyCard,
      searchText: n.search,
      searchOrderIds,
      dateFrom: n.range?.from,
      dateTo: n.range?.to,
      dateField: n.dateField,
      paymentStatus: n.paymentStatus,
    };
    let scopes = buildPaymentsScopes(scopeInput);
    if (n.refundStatus) {
      const basePaymentIds = (await this.prisma.payment.findMany({ where: scopes.baseWhere, select: { id: true } })).map((p) => p.id);
      const refundPaymentIds = basePaymentIds.length === 0
        ? []
        : [...new Set((await this.prisma.refund.findMany({
            where: { status: n.refundStatus, paymentId: { in: basePaymentIds } },
            select: { paymentId: true },
          })).map((r) => r.paymentId))];
      scopes = buildPaymentsScopes({ ...scopeInput, refundStatus: n.refundStatus, refundPaymentIds });
    }

    const items = await this.prisma.payment.findMany({
      where: scopes.tableWhere,
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    });

    // Resolve order + partner + customer names
    const orderIds = [...new Set(items.map(p => p.orderId).filter(Boolean))] as string[];
    const orders = orderIds.length > 0
      ? await this.prisma.order.findMany({ where: { id: { in: orderIds } }, select: { id: true, code: true, referenceNumber: true, sellerPartnerId: true, customerId: true } })
      : [];
    const partnerIds = [...new Set(orders.map(o => o.sellerPartnerId).filter(Boolean))] as string[];
    const customerIds = [...new Set(orders.map(o => o.customerId).filter(Boolean))] as string[];
    const [partners, customers] = await Promise.all([
      partnerIds.length > 0 ? this.prisma.partner.findMany({ where: { id: { in: partnerIds } }, select: { id: true, code: true, name: true } }) : [],
      customerIds.length > 0 ? this.prisma.customer.findMany({ where: { id: { in: customerIds } }, select: { id: true, code: true, firstName: true, lastName: true, companyName: true } }) : [],
    ]);
    const orderMap = new Map(orders.map(o => [o.id, o]));
    const partnerMap = new Map(partners.map(p => [p.id, p]));
    const customerMap = new Map(customers.map(c => [c.id, c]));

    const rows = items.map(p => {
      const order = p.orderId ? orderMap.get(p.orderId) : null;
      const partner = order?.sellerPartnerId ? partnerMap.get(order.sellerPartnerId) : null;
      const customer = order?.customerId ? customerMap.get(order.customerId) : null;
      return {
        id: p.id,
        code: p.code,
        referenceNumber: p.referenceNumber ?? '',
        status: p.status,
        amount: String(p.amount),
        currency: p.currency,
        createdAt: p.createdAt?.toISOString() ?? '',
        updatedAt: p.updatedAt?.toISOString() ?? '',
        paidAt: p.paidAt?.toISOString() ?? '',
        orderId: p.orderId ?? '',
        orderCode: order?.code ?? '',
        orderReference: order?.referenceNumber ?? '',
        partnerId: order?.sellerPartnerId ?? '',
        partnerCode: partner?.code ?? '',
        partnerName: partner?.name ?? '',
        customerId: order?.customerId ?? '',
        customerCode: customer?.code ?? '',
        customerName: customer ? (customer.companyName ?? `${customer.firstName ?? ''} ${customer.lastName ?? ''}`.trim()) : '',
      };
    });

    return { rows, total: rows.length };
  }

  async getByCode(code: string): Promise<Record<string, unknown>> {
    const row = await this.prisma.payment.findUnique({ where: { code } });
    if (!row) throw new NotFoundError(`Payment ${code} not found`);
    // D4 F2 direct-read invisibility (согласовано с Order/Booking detail):
    // Storefront-платеж «не существует» для platform-контракта → 404-like.
    const order = await this.prisma.order.findUnique({
      where: { id: row.orderId },
      select: { acquisitionSource: true },
    });
    if (order && order.acquisitionSource === PARTNER_STOREFRONT_SOURCE) {
      throw new NotFoundError(`Payment ${code} not found`);
    }
    return this.paymentDto(row);
  }

  // ── Registry read-model helpers (UI-C1.2E) ─────────────────────────────────

  private emptyRegistryAggregates(): {
    total: number;
    paymentStatus: Record<PaymentStatus, number>;
    refundStatus: Record<RefundStatus, number>;
    currency: { currency: string; count: number; amount: string }[];
  } {
    return { total: 0, paymentStatus: emptyPaymentStatusAgg(), refundStatus: emptyRefundStatusAgg(), currency: [] };
  }

  private normalizeRegistryQuery(query: {
    orderId?: string;
    status?: string;
    paymentStatus?: string;
    refundStatus?: string;
    search?: string;
    currency?: string;
    currencyCard?: string;
    dateFrom?: string;
    dateTo?: string;
    dateField?: string;
    acquisitionSource?: string;
  }): {
    denied: boolean;
    source: string;
    orderId?: string;
    paymentStatus?: PaymentStatus;
    refundStatus?: RefundStatus;
    search?: string;
    currency?: string;
    currencyCard?: string;
    dateField: "createdAt" | "paidAt";
    range?: { from: Date; to: Date };
  } {
    const source = query.acquisitionSource || "MARKETPLACE";
    const denied = isDeniedStorefrontScope(query.acquisitionSource);

    // Payment-status KPI dimension: canonical `paymentStatus` with legacy
    // alias `status` (Finance Center / analytics deep-links). Conflict → 422.
    const canonical = query.paymentStatus?.trim() ?? "";
    const legacy = query.status?.trim() ?? "";
    if (canonical && legacy && canonical !== legacy) {
      throw new ValidationDomainError("paymentStatus and status filters conflict");
    }
    const rawPaymentStatus = canonical || legacy;
    let paymentStatus: PaymentStatus | undefined;
    if (rawPaymentStatus) {
      if (!isPaymentStatusValue(rawPaymentStatus)) {
        throw new ValidationDomainError(`invalid paymentStatus ${rawPaymentStatus}`);
      }
      paymentStatus = rawPaymentStatus;
    }

    let refundStatus: RefundStatus | undefined;
    const rawRefundStatus = query.refundStatus?.trim() ?? "";
    if (rawRefundStatus) {
      if (!isRefundStatusValue(rawRefundStatus)) {
        throw new ValidationDomainError(`invalid refundStatus ${rawRefundStatus}`);
      }
      refundStatus = rawRefundStatus;
    }

    let currency: string | undefined;
    const rawCurrency = query.currency?.trim() ?? "";
    if (rawCurrency) {
      if (!/^[A-Z]{3}$/.test(rawCurrency)) {
        throw new ValidationDomainError(`invalid currency ${rawCurrency}`);
      }
      currency = rawCurrency;
    }

    const rawDateField = query.dateField?.trim() ?? "";
    let dateField: "createdAt" | "paidAt";
    if (!rawDateField) dateField = "createdAt";
    else if (isPaymentDateField(rawDateField)) dateField = rawDateField;
    else throw new ValidationDomainError(`invalid dateField ${rawDateField}`);

    let range: { from: Date; to: Date } | undefined;
    const from = this.parseDateParam(query.dateFrom, "dateFrom");
    const to = this.parseDateParam(query.dateTo, "dateTo");
    if (from || to) range = { from, to } as { from: Date; to: Date };

    let search: string | undefined;
    const rawSearch = query.search?.trim() ?? "";
    if (rawSearch) {
      if (rawSearch.length > 80) throw new ValidationDomainError("search must not exceed 80 characters");
      search = rawSearch;
    }

    let orderId: string | undefined;
    const rawOrderId = query.orderId?.trim() ?? "";
    if (rawOrderId) {
      if (rawOrderId.length > 64) throw new ValidationDomainError("orderId must not exceed 64 characters");
      orderId = rawOrderId;
    }

    // UI-C1.2F currency-card KPI: table-only currency filter, validated
    // independently of the global `currency` param (both can coexist).
    let currencyCard: string | undefined;
    const rawCurrencyCard = query.currencyCard?.trim() ?? "";
    if (rawCurrencyCard) {
      if (!/^[A-Z]{3}$/.test(rawCurrencyCard)) {
        throw new ValidationDomainError(`invalid currencyCard ${rawCurrencyCard}`);
      }
      currencyCard = rawCurrencyCard;
    }

    return { denied, source, orderId, paymentStatus, refundStatus, search, currency, currencyCard, dateField, range };
  }

  /**
   * D8 (B-06, §7): registry QUERY-PARAM date filters use the canonical 400
   * BadRequestException contract (shared date-param helper). The Finance
   * ValidationDomainError (422) contract for SUBMITTED financial payloads
   * (e.g. LedgerTransaction.occurredAt) is intentionally unchanged.
   */
  private parseDateParam(value: string | undefined, label: string): Date | undefined {
    return parseRegistryDateParam(value, label);
  }

  private async resolveChannelOrderIds(source: string): Promise<string[]> {
    const channelOrders = await this.prisma.order.findMany({
      where: { acquisitionSource: source },
      select: { id: true },
    });
    return channelOrders.map((o) => o.id);
  }

  private async resolveOrderSearchIds(search: string, source: string): Promise<string[]> {
    const orders = await this.prisma.order.findMany({
      where: {
        acquisitionSource: source,
        OR: [
          { code: { contains: search, mode: "insensitive" } },
          { referenceNumber: { contains: search, mode: "insensitive" } },
        ],
      },
      select: { id: true },
    });
    return orders.map((o) => o.id);
  }

  private buildRegistrySort(sortBy: string | undefined, sortDirection: string | undefined): Prisma.PaymentOrderByWithRelationInput[] {
    const sortField = sortBy || "createdAt";
    const sortDir = sortDirection === "asc" ? "asc" : "desc";
    const sortMap: Record<string, string> = {
      createdAt: "createdAt",
      amount: "amount",
      currency: "currency",
      status: "status",
      code: "code",
      referenceNumber: "referenceNumber",
    };
    const field = sortMap[sortField] || "createdAt";
    return [{ [field]: sortDir as Prisma.SortOrder }, { id: "asc" as Prisma.SortOrder }];
  }

  // ── Whitelist DTO (без PII/secrets; money — Decimal strings) ───────────────

  private paymentDto(r: {
    id: string;
    code: string;
    referenceNumber?: string | null;
    orderId: string;
    customerId: string | null;
    partnerId: string | null;
    amount: Prisma.Decimal;
    currency: string;
    status: PaymentStatus;
    paymentMethod: string | null;
    providerRef: string | null;
    version: number;
    createdAt: Date;
    paidAt: Date | null;
    failedAt: Date | null;
    cancelledAt: Date | null;
  }): Record<string, unknown> {
    return {
      id: r.id,
      code: r.code,
      referenceNumber: r.referenceNumber ?? null,
      orderId: r.orderId,
      customerId: r.customerId,
      partnerId: r.partnerId,
      amount: r.amount.toString(),
      currency: r.currency,
      status: r.status,
      paymentMethod: r.paymentMethod,
      providerRef: r.providerRef,
      paidAt: r.paidAt ? r.paidAt.toISOString() : null,
      failedAt: r.failedAt ? r.failedAt.toISOString() : null,
      cancelledAt: r.cancelledAt ? r.cancelledAt.toISOString() : null,
      version: r.version,
      createdAt: r.createdAt.toISOString(),
    };
  }
}
