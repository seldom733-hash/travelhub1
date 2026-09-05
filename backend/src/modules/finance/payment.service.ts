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
 *  - cardinality: один Payment на Order (isActivePayment partial unique,
 *    DB-level); FAILED/CANCELLED — повторная инициация (attempt 2) легальна;
 *    CAPTURED/REFUNDED блокируют (overpayment protection); 2.12F снимет
 *    индекс в своей миграции (документировано);
 *  - status machine (единственный authority): PENDING → CAPTURED (paidAt) |
 *    FAILED (failedAt) | CANCELLED (cancelledAt). AUTHORIZED/REFUNDED —
 *    reserved vocabulary (producer: 2.12B PSP authorize / 2.13 refund);
 *    capturedAt/authorizedAt milestones — DEFER (2.12B);
 *  - idempotency: identical create retry → существующий активный Payment
 *    (no-op); concurrent duplicate → P2002 (Payment_one_active_per_order) →
 *    controlled 409, один факт; неизвестный P2002 не глотается;
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
import { uniqueConstraintNames } from "../../shared/prisma-errors";
import { getRequestContext } from "../../shared/request-context";
import { EventBusService } from "../../eventbus/eventbus.service";
import { DomainEvents, type PaymentEventPayload } from "../../eventbus/domain-events";
import { validateFrozenMoneyFact } from "../sales/sales.money";
import { normalizeInitialNote } from "../operational-notes/operational-notes.types";

/** Cardinality partial unique index (schema): ≤1 активный Payment на Order. */
const PAYMENT_ONE_ACTIVE_PER_ORDER = "Payment_one_active_per_order";

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
   * Деньги — frozen Order snapshot verbatim (amount/currency); frontend НЕ
   * источник цены (forged money → 422 forbidden keys). Idempotent: повторный
   * create с активным Payment → существующий факт (no-op, identical retry =
   * same effect); concurrent duplicate → P2002 → controlled 409.
   */
  async createPayment(input: { orderId: string; paymentMethod?: string | null; reason?: string | null; initialNote?: string }, actor: Actor): Promise<Record<string, unknown>> {
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

    // Phase 3 Round 2D.1: validate initialNote BEFORE transaction (pre-tx validation)
    // so >5000 rejection prevents Payment creation entirely.
    const noteText = normalizeInitialNote(input.initialNote);

    // READ-only cross-context read (ADR-0001): Order — owner обязательства.
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundError(`Order ${orderId} not found`);
    if (ORDER_NOT_PAYABLE.includes(order.status)) {
      throw new ValidationDomainError(`Order ${order.code} is ${order.status}; payment cannot be initiated`);
    }

    // Frozen money fact (Step 2.11 authority): amount+currency из ОДНОГО frozen
    // источника (Order snapshot). Валидация — платформенный контракт sales.money.
    validateFrozenMoneyFact(order.amount, order.currency, "payment money fact");

    const emitPayload = (paymentId: string, code: string): PaymentEventPayload => ({
      paymentId,
      code,
      orderId: order.id,
      customerId: order.customerId,
      amount: order.amount.toString(),
      currency: order.currency,
      method: paymentMethod,
    });

    try {
      return await this.prisma.$transaction(async (tx) => {
        // Idempotent retry: активный Payment уже существует → no-op.
        const existing = await tx.payment.findFirst({
          where: { orderId: order.id, isActivePayment: true },
        });
        if (existing) return this.paymentDto(existing);

        const code = await this.ids.nextCode(tx, "PAY");
        // Shared Commerce Sequence: derive Payment ref from Order's commerceSequence.
        const { referenceNumber, paymentOrdinal } = await this.generateCommercePaymentRef(tx, order);
        const created = await tx.payment.create({
          data: {
            code,
            referenceNumber,
            commerceSequence: order.commerceSequence ?? null,
            paymentOrdinal,
            orderId: order.id,
            customerId: order.customerId ?? null,
            amount: order.amount,
            currency: order.currency,
            status: PaymentStatus.PENDING,
            paymentMethod,
            isActivePayment: true,
            version: 1,
          },
        });
        await tx.paymentHistory.create({
          data: {
            paymentId: created.id,
            action: "created",
            to: PaymentStatus.PENDING,
            actorId: actor.id,
            actorName: actor.username,
            comment: reason ? `Платёж инициирован по заказу ${order.code}: ${reason}` : `Платёж инициирован по заказу ${order.code}`,
          },
        });
        await this.security.audit(tx, {
          userId: actor.id,
          username: actor.username,
          action: "finance.payment.created",
          resource: "Payment",
          resourceId: created.id,
          details: { code: created.code, orderId: order.id, amount: order.amount.toString(), currency: order.currency },
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
      // Concurrent duplicate create: оба прошли проверку isActivePayment,
      // один проиграл partial unique → controlled 409 (один факт, без raw 500).
      if (uniqueConstraintNames(err).includes(PAYMENT_ONE_ACTIVE_PER_ORDER)) {
        throw new ConflictError(`A payment is already active for order ${order.code}`);
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
   * true для CAPTURED — overpayment protection).
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
    // no N+1). Booking registry precedent.
    const rowOrderIds = [...new Set(items.map((p) => p.orderId).filter(Boolean))] as string[];
    const orders = rowOrderIds.length > 0
      ? await this.prisma.order.findMany({ where: { id: { in: rowOrderIds } }, select: { id: true, referenceNumber: true } })
      : [];
    const orderRefMap = new Map(orders.map((o) => [o.id, o.referenceNumber]));
    const enriched = rows.map((row) => ({ ...row, orderReference: orderRefMap.get(row.orderId as string) ?? null }));

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
        orderCode: order?.referenceNumber ?? '',
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

  private parseDateParam(value: string | undefined, label: string): Date | undefined {
    if (!value) return undefined;
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) {
      throw new ValidationDomainError(`${label} must be a valid date`);
    }
    return d;
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
