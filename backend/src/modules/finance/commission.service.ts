/**
 * PHASE 2 STEP 2.12E — CommissionService (PARTNER_COLLECT / CommissionAccrual
 * Foundation, ADR-0013 D9/D10/D19).
 *
 * Scope: canonical earned-факт `Commission` (CMS-*) + receivable
 * `CommissionAccrual` (CAA-*) для PARTNER_COLLECT, признаваемый на **Order
 * creation** из **frozen commissionSnapshot** (Quote ISSUE freeze, verbatim).
 *
 * Hard gates / инварианты:
 *  - recognition trigger = Order creation (D10: Partner собрал деньги вне
 *    platform rail; НЕ Payment CAPTURED, НЕ PSP, НЕ live state);
 *  - 0 live policy lookup (D7/invariant 3): producer использует ТОЛЬКО frozen
 *    snapshot; NO_POLICY/AMBIGUOUS на freeze → NULL snapshot → 0 accrual
 *    (fail-closed, НЕ «0%»);
 *  - multi-seller/без seller (sellerPartnerId NULL) → 0 accrual (D14,
 *    fail-closed; НЕ live Catalog lookup);
 *  - commissionAmount = round_half_up(base × rate) — Decimal authority
 *    (finance.money → sales.money toMoney2), 0 JS float (invariant 4);
 *  - base = frozen Order.total (D4: tax-exclusive by construction, до refund);
 *  - idempotency: inbox + `Commission_orderId_key` + `CommissionAccrual_sourceCommissionId_key`;
 *    divergent replay → controlled ConflictError (НЕ silent success);
 *  - 0 side-effects: 0 Ledger (2.12D), 0 Settlement/Payout (2.14A/B), 0 Invoice
 *    (2.14), 0 PSP split (2.12C), 0 Refund/Dispute adjustment (D11/D12);
 *  - событие `CommissionAccrued` (outbox, атомарно, PII-free) — consumer-ов 0;
 *  - immutable финансовые поля; status НЕ эволюционирует в 2.12E
 *    (INVOICED/PAID/COLLECTED — future шаги); update/delete путей нет.
 */
import { Injectable } from "@nestjs/common";
import { Prisma } from "../../generated/prisma/client";
import { CommissionAccrualStatus, CommissionCollectionModel, CommissionStatus } from "../../generated/prisma/enums";
import { PrismaService } from "../../prisma/prisma.service";
import { IdsService } from "../../shared/ids.service";
import { EventBusService } from "../../eventbus/eventbus.service";
import { DomainEvents, type CommissionAccruedPayload } from "../../eventbus/domain-events";
import { ConflictError, NotFoundError, ValidationDomainError } from "../../shared/errors";
import { toMoney2 } from "./finance.money";
import { validateCommissionSnapshot, type CommissionSnapshotShape } from "./finance.validation";

/** Вход producer-а (frozen Order факты, READ-only cross-context read). */
export interface CommissionSourceOrder {
  id: string;
  code: string;
  amount: Prisma.Decimal;
  currency: string;
  sellerPartnerId: string | null;
  commissionSnapshot: unknown;
}

/** Итог признания (для consumer-а: факты + событие). */
export interface CommissionAccrualResult {
  commission: { id: string; code: string };
  accrual: { id: string; code: string };
  eventId: string;
  amount: string;
}

@Injectable()
export class CommissionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ids: IdsService,
    private readonly eventBus: EventBusService,
  ) {}

  /**
   * Признание PARTNER_COLLECT Commission + CommissionAccrual на Order creation.
   * Вызывается CommissionAccrualConsumer ВНУТРИ транзакции consumer-а.
   * Fail-closed:
   *  - без commissionSnapshot → возвращает null (no-op: нет commission-контекста);
   *  - sellerPartnerId NULL → null (multi-seller/без seller);
   *  - невалидный/коррумпированный snapshot → ValidationDomainError (событие
   *    FAILED, НЕ молчаливый 0-факт — invariant violation);
   *  - расхождение baseAmount с frozen Order.amount → ValidationDomainError.
   * Idempotency: Commission_orderId_key / accrual sourceCommissionId unique —
   * повторный вызов для того же Order возвращает существующий факт (no-op)
   * ТОЛЬКО при идентичном frozen payload; divergent → ConflictError.
   */
  async createAccrualForOrder(
    tx: Prisma.TransactionClient,
    order: CommissionSourceOrder,
    eventCtx: { correlationId: string | null; causationId: string | null },
  ): Promise<CommissionAccrualResult | null> {
    if (order.commissionSnapshot === null || order.commissionSnapshot === undefined) return null; // no commission-контекст
    if (!order.sellerPartnerId) return null; // multi-seller / без seller → fail-closed (D14)

    // Frozen snapshot — единственный источник (0 live lookup). Глубокая
    // валидация формы: коррупция = invariant violation → громкий FAILED.
    const snap = validateCommissionSnapshot(order.commissionSnapshot);
    if (snap.sellerPartnerId !== order.sellerPartnerId) {
      throw new ValidationDomainError(`Order ${order.code}: commissionSnapshot sellerPartnerId does not match Order.sellerPartnerId`);
    }
    if (snap.baseCurrency !== order.currency) {
      throw new ValidationDomainError(`Order ${order.code}: commissionSnapshot baseCurrency does not match Order currency`);
    }
    // base = frozen Order.total (D4). Расхождение snapshot ↔ Order = producer-дефект.
    if (!new Prisma.Decimal(snap.baseAmount).equals(order.amount)) {
      throw new ValidationDomainError(`Order ${order.code}: commissionSnapshot baseAmount does not match frozen Order.amount`);
    }

    // commissionAmount = round_half_up(base × rate), Decimal authority (D5).
    const amount = toMoney2(new Prisma.Decimal(snap.baseAmount).times(new Prisma.Decimal(snap.rate)), `commission amount for Order ${order.code}`);
    if (amount.isZero()) {
      // rate > 0 по контракту; base >= 0. Zero-amount commission — дефект
      // frozen-данных, не легитимный 0% (NO_POLICY ≠ 0% — invariant).
      throw new ValidationDomainError(`Order ${order.code}: computed commission amount is zero (invalid frozen rate/base)`);
    }

    // Существующий факт (replay / concurrent duplicate) — verify-then-no-op.
    const existing = await tx.commission.findUnique({ where: { orderId: order.id } });
    if (existing) {
      // Identical replay → no-op. Divergent payload → controlled conflict,
      // НЕ молчаливый success (class: Finance divergent-replay defect).
      if (
        existing.amount.toString() === amount.toString() &&
        existing.currency === order.currency &&
        existing.partnerId === order.sellerPartnerId &&
        existing.collectionModel === CommissionCollectionModel.PARTNER_COLLECT
      ) {
        const accrual = await tx.commissionAccrual.findUniqueOrThrow({ where: { sourceCommissionId: existing.id } });
        return {
          commission: { id: existing.id, code: existing.code },
          accrual: { id: accrual.id, code: accrual.code },
          eventId: "", // no new event on no-op replay
          amount: amount.toString(),
        };
      }
      throw new ConflictError(`Order ${order.code} already has a divergent Commission fact — refusing silent overwrite`);
    }

    // ── Create Commission + CommissionAccrual + CommissionAccrued (атомарно) ──
    const commission = await tx.commission.create({
      data: {
        code: await this.ids.nextCode(tx, "CMS"),
        orderId: order.id,
        partnerId: order.sellerPartnerId,
        amount,
        currency: order.currency,
        collectionModel: CommissionCollectionModel.PARTNER_COLLECT,
        status: CommissionStatus.ACCRUED,
        version: 1,
      },
      select: { id: true, code: true },
    });

    const accruedAt = new Date();
    const accrual = await tx.commissionAccrual.create({
      data: {
        code: await this.ids.nextCode(tx, "CAA"),
        partnerId: order.sellerPartnerId,
        amount,
        currency: order.currency,
        status: CommissionAccrualStatus.ACCRUED,
        sourceCommissionId: commission.id,
        accruedAt,
        version: 1,
      },
      select: { id: true, code: true },
    });

    // CommissionAccrued — факт-событие (D19): refs + frozen money/policy
    // provenance (без PII). correlation/causation — из OrderCreated (chain).
    const eventId = await this.eventBus.emitResult(tx, {
      aggregateType: "CommissionAccrual",
      aggregateId: accrual.id,
      eventType: DomainEvents.CommissionAccrued,
      payload: {
        commissionId: commission.id,
        commissionCode: commission.code,
        accrualId: accrual.id,
        accrualCode: accrual.code,
        orderId: order.id,
        orderCode: order.code,
        partnerId: order.sellerPartnerId,
        channel: snap.channel,
        collectionModel: CommissionCollectionModel.PARTNER_COLLECT,
        amount: amount.toString(),
        currency: order.currency,
        policyCode: snap.policyCode,
        policyVersion: snap.policyVersion,
        baseAmount: snap.baseAmount,
        baseCurrency: snap.baseCurrency,
        selectedAt: snap.selectedAt,
      } as CommissionAccruedPayload,
      correlationId: eventCtx.correlationId,
      causationId: eventCtx.causationId,
    });
    return {
      commission: { id: commission.id, code: commission.code },
      accrual: { id: accrual.id, code: accrual.code },
      eventId,
      amount: amount.toString(),
    };
  }

  // ── Read surface (immutable facts; RBAC finance.commission.read) ──────────

  async listCommissions(query: { status?: string; orderId?: string; partnerId?: string; page?: number; pageSize?: number }) {
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20));
    const where: Prisma.CommissionWhereInput = {
      ...(query.status ? { status: query.status as CommissionStatus } : {}),
      ...(query.orderId ? { orderId: query.orderId } : {}),
      ...(query.partnerId ? { partnerId: query.partnerId } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.commission.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize }),
      this.prisma.commission.count({ where }),
    ]);
    return { items: items.map((c) => this.commissionDto(c)), page, pageSize, total };
  }

  async getCommissionByCode(code: string) {
    const row = await this.prisma.commission.findUnique({ where: { code } });
    if (!row) throw new NotFoundError(`Commission ${code} not found`);
    return this.commissionDto(row);
  }

  async listAccruals(query: { status?: string; partnerId?: string; page?: number; pageSize?: number }) {
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20));
    const where: Prisma.CommissionAccrualWhereInput = {
      ...(query.status ? { status: query.status as CommissionAccrualStatus } : {}),
      ...(query.partnerId ? { partnerId: query.partnerId } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.commissionAccrual.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize }),
      this.prisma.commissionAccrual.count({ where }),
    ]);
    return { items: items.map((a) => this.accrualDto(a)), page, pageSize, total };
  }

  async getAccrualByCode(code: string) {
    const row = await this.prisma.commissionAccrual.findUnique({ where: { code } });
    if (!row) throw new NotFoundError(`CommissionAccrual ${code} not found`);
    return this.accrualDto(row);
  }

  private commissionDto(c: {
    id: string;
    code: string;
    orderId: string;
    partnerId: string;
    amount: Prisma.Decimal;
    currency: string;
    collectionModel: CommissionCollectionModel;
    status: CommissionStatus;
    version: number;
    createdAt: Date;
    updatedAt: Date;
  }): Record<string, unknown> {
    return {
      id: c.id,
      code: c.code,
      orderId: c.orderId,
      partnerId: c.partnerId,
      amount: c.amount.toString(),
      currency: c.currency,
      collectionModel: c.collectionModel,
      status: c.status,
      version: c.version,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
    };
  }

  private accrualDto(a: {
    id: string;
    code: string;
    partnerId: string;
    amount: Prisma.Decimal;
    currency: string;
    status: CommissionAccrualStatus;
    sourceCommissionId: string | null;
    accruedAt: Date | null;
    periodStart: Date | null;
    periodEnd: Date | null;
    version: number;
    createdAt: Date;
    updatedAt: Date;
  }): Record<string, unknown> {
    return {
      id: a.id,
      code: a.code,
      partnerId: a.partnerId,
      amount: a.amount.toString(),
      currency: a.currency,
      status: a.status,
      sourceCommissionId: a.sourceCommissionId,
      accruedAt: a.accruedAt ? a.accruedAt.toISOString() : null,
      periodStart: a.periodStart ? a.periodStart.toISOString() : null,
      periodEnd: a.periodEnd ? a.periodEnd.toISOString() : null,
      version: a.version,
      createdAt: a.createdAt.toISOString(),
      updatedAt: a.updatedAt.toISOString(),
    };
  }
}
