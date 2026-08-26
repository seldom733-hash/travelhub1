/**
 * PHASE 2 STEP 2.13 — RefundService (provider-neutral Refund runtime).
 *
 * Finance-owned canonical Refund aggregate (RFD-*). Активация runtime,
 * заявленного в Step 2.10 foundation (§15/§52): создание + lifecycle Refund
 * с НЕПСП-механикой — PSP/adapters/webhooks — 2.13A+/future (нет здесь).
 *
 * Принцип (Prompt §3): Refund — новый immutable/operational финансовый факт,
 * производный от УЖЕ CAPTURED Payment; НИКОГДА не переписывает Payment.amount /
 * frozen Order snapshot (никакого reprice). Refund ≠ Settlement/Payout,
 * ≠ Commission reversal, ≠ double-entry (boundaries 2.12D/2.12C/2.14/2.14A).
 *
 * Hard gates:
 *  - Refund создаётся ТОЛЬКО Finance (finance.refund.write); Order/Booking/
 *    Sales НЕ пишут finance.Refund (cross-domain writes отсутствуют);
 *  - source authority — CAPTURED Payment (PENDING/FAILED/CANCELLED → 422);
 *    currency verbatim из Payment; orderId server-derived из Payment.orderId
 *    (никакого live commercial lookup / Product/Tax/FX re-read);
 *  - cardinality (partial refunds): несколько Refund на Payment (разные суммы);
 *    idempotency slot — ≤1 НЕ-FAILED Refund на (paymentId, amount): identical
 *    retry → существующий факт (no-op); attempt 2 после FAILED легален;
 *    concurrent duplicate → P2002 → controlled 409;
 *  - over-refund protection (CRITICAL §16): serialized pg_advisory_xact_lock
 *    на paymentId + SUM(non-FAILED refunds) внутри той же tx — два concurrent
 *    частичных refund'а не могут превысить payment.amount (нет TOCTOU);
 *    refundable = payment.amount − Σ(refund.amount WHERE status != FAILED);
 *  - state machine (единственный authority): REQUESTED → APPROVED → PROCESSED |
 *    FAILED (REQUESTED|APPROVED → FAILED); CAS id+status+version, from-guard;
 *    milestone + history + outbox атомарны с переходом;
 *  - milestones (2.10C DEFER → 2.13): requestedAt/approvedAt/processedAt/
 *    failedAt — server-owned UTC, первый wins, без backfill;
 *  - Payment НЕ мутируется (остаётся CAPTURED; REFUNDED reserved unreachable —
 *    partial refund делает одиночный Payment.REFUNDED семантически неверным);
 *  - 0 side effects: без LedgerTransaction/ProviderFee/Settlement/Payout/
 *    Invoice/CommissionAccrual auto-post (boundaries §25–§29);
 *  - события: RefundCreated/RefundApproved/RefundProcessed/RefundFailed
 *    (outbox, PII-free, correlation/causation/actor server-authoritative).
 */
import { Injectable } from "@nestjs/common";
import { Prisma } from "../../generated/prisma/client";
import { RefundStatus } from "../../generated/prisma/enums";
import { PrismaService } from "../../prisma/prisma.service";
import { IdsService } from "../../shared/ids.service";
import { SecurityService } from "../../security/security.service";
import { normalizeInitialNote } from "../operational-notes/operational-notes.types";
import { ConflictError, NotFoundError, ValidationDomainError } from "../../shared/errors";
import { uniqueConstraintNames } from "../../shared/prisma-errors";
import { EventBusService } from "../../eventbus/eventbus.service";
import { DomainEvents, type RefundEventPayload } from "../../eventbus/domain-events";
import { validateRefundAmount } from "./finance.validation";

/** Cardinality partial unique index (schema): ≤1 НЕ-FAILED Refund на (paymentId, amount). */
const REFUND_ONE_ACTIVE_PER_PAYMENT_AMOUNT = "Refund_one_active_per_payment_amount";

/** Статусы, НЕ резервирующие refundable-емкость и освобождающие idempotency-слот. */
const TERMINAL_RELEASE: RefundStatus[] = ["FAILED"];

interface Actor {
  id: string;
  username: string;
}

@Injectable()
export class RefundService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ids: IdsService,
    private readonly security: SecurityService,
    private readonly eventBus: EventBusService,
  ) {}

  // ── Refund creation ────────────────────────────────────────────────────────

  /**
   * Создание Refund для CAPTURED Payment (Finance command, finance.refund.write).
   * Клиент передаёт paymentId + amount (server-validated ≤ refundable) + reason.
   * Over-refund: serialized pg_advisory_xact_lock на paymentId (одна транзакция),
   * refundable = payment.amount − Σ(non-FAILED). Idempotent: identical retry
   * (paymentId+amount, НЕ-FAILED) → существующий факт (no-op); concurrent
   * duplicate → P2002 → controlled 409. Payment НЕ мутируется.
   */
  async createRefund(input: { paymentId: string; amount: string; reason?: string | null; initialNote?: string }, actor: Actor): Promise<Record<string, unknown>> {
    const paymentId = input.paymentId.trim();
    if (!paymentId) throw new ValidationDomainError("paymentId is required");
    const amount = validateRefundAmount(input.amount);
    const reason = input.reason ? input.reason.trim() : null;
    if (reason && reason.length > 255) {
      throw new ValidationDomainError("reason must not exceed 255 characters");
    }
    const amountDecimal = new Prisma.Decimal(amount);

    // Phase 3 Round 2D.1: validate initialNote BEFORE transaction (pre-tx validation)
    // so >5000 rejection prevents Refund creation entirely.
    const noteText = normalizeInitialNote(input.initialNote);

    // READ-only cross-context read (ADR-0001): Payment — owner обязательства.
    const payment = await this.prisma.payment.findUnique({ where: { id: paymentId } });
    if (!payment) throw new NotFoundError(`Payment ${paymentId} not found`);
    if (payment.status !== "CAPTURED") {
      throw new ValidationDomainError(`Payment ${payment.code} is ${payment.status}; refund requires CAPTURED`);
    }

    const emitPayload = (refundId: string, code: string): RefundEventPayload => ({
      refundId,
      code,
      paymentId: payment.id,
      orderId: payment.orderId,
      amount: amountDecimal.toString(),
      currency: payment.currency,
      reason,
    });

    try {
      return await this.prisma.$transaction(async (tx) => {
        // Idempotent retry: НЕ-FAILED Refund с тем же (paymentId, amount) → no-op.
        const existing = await tx.refund.findFirst({
          where: { paymentId: payment.id, amount: amountDecimal, isActiveRefund: true },
        });
        if (existing) return this.refundDto(existing);

        // Over-refund protection (CRITICAL): serialized по paymentId — два
        // concurrent частичных refund'а не могут вместе превысить payment.amount
        // (advisory xact lock освобождается на commit/rollback tx; проект-паттерн
        // atomic capacity — как reserveAvailability, но без мутации Payment).
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`refund:${payment.id}`}))`;
        const agg = await tx.refund.aggregate({
          _sum: { amount: true },
          where: { paymentId: payment.id, status: { notIn: TERMINAL_RELEASE } },
        });
        const refunded = agg._sum.amount ?? new Prisma.Decimal(0);
        const refundable = new Prisma.Decimal(payment.amount).minus(refunded);
        if (amountDecimal.greaterThan(refundable)) {
          throw new ConflictError(
            `Refund ${amount} exceeds refundable ${refundable.toString()} for payment ${payment.code} (already refunded ${refunded.toString()})`,
          );
        }

        const code = await this.ids.nextCode(tx, "RFD");
        const now = new Date();
        const created = await tx.refund.create({
          data: {
            code,
            paymentId: payment.id,
            orderId: payment.orderId,
            amount: amountDecimal,
            currency: payment.currency,
            status: RefundStatus.REQUESTED,
            reason,
            isActiveRefund: true,
            version: 1,
            requestedAt: now,
          },
        });
        await tx.refundHistory.create({
          data: {
            refundId: created.id,
            action: "created",
            to: RefundStatus.REQUESTED,
            actorId: actor.id,
            actorName: actor.username,
            comment: `Refund запрошен по платежу ${payment.code}`,
          },
        });
        await this.security.audit(tx, {
          userId: actor.id,
          username: actor.username,
          action: "finance.refund.created",
          resource: "Refund",
          resourceId: created.id,
          details: { code: created.code, paymentId: payment.id, orderId: payment.orderId, amount: amountDecimal.toString(), currency: payment.currency },
        });
        await this.eventBus.emit(tx, {
          aggregateType: "Refund",
          aggregateId: created.id,
          eventType: DomainEvents.RefundCreated,
          payload: emitPayload(created.id, created.code),
        });

        // Phase 3 Round 2D.1: optional initial OperationalNote (same transaction)
        if (noteText) {
          await tx.operationalNote.create({
            data: {
              entityType: "Refund",
              entityId: created.id,
              text: noteText,
              visibility: "INTERNAL",
              authorUserId: actor.id,
              authorName: actor.username,
            },
          });
        }

        return this.refundDto(created);
      });
    } catch (err) {
      // Concurrent duplicate create: оба прошли findFirst, один проиграл partial
      // unique → controlled 409 (один факт, без raw 500).
      if (uniqueConstraintNames(err).includes(REFUND_ONE_ACTIVE_PER_PAYMENT_AMOUNT)) {
        throw new ConflictError(`A refund for payment ${payment.code} with the same amount is already active`);
      }
      throw err;
    } finally {
      await this.eventBus.publishPending();
    }
  }

  // ── Lifecycle transitions (единственный state-machine authority) ──────────

  /** REQUESTED → APPROVED (согласован; approval step, finance.refund.approve). */
  async approveRefund(code: string, actor: Actor): Promise<Record<string, unknown>> {
    return this.transition(code, RefundStatus.APPROVED, RefundStatus.REQUESTED, "approvedAt", "approved", "finance.refund.approved", DomainEvents.RefundApproved, actor);
  }

  /** APPROVED → PROCESSED (деньги возвращены; manual/provider-neutral подтверждение). */
  async processRefund(code: string, actor: Actor): Promise<Record<string, unknown>> {
    return this.transition(code, RefundStatus.PROCESSED, RefundStatus.APPROVED, "processedAt", "processed", "finance.refund.processed", DomainEvents.RefundProcessed, actor);
  }

  /** REQUESTED|APPROVED → FAILED (терминальное отклонение; attempt 2 легален). */
  async failRefund(code: string, actor: Actor): Promise<Record<string, unknown>> {
    return this.transition(code, RefundStatus.FAILED, null, "failedAt", "failed", "finance.refund.failed", DomainEvents.RefundFailed, actor);
  }

  /**
   * Единый CAS-переход (паттерн Payment/Order/Booking): from-guard +
   * updateMany where id+status+version → ровно один победитель; повторный
   * переход → controlled 409 (terminal protection). Milestone + history +
   * audit + outbox атомарно с переходом. isActiveRefund освобождается ТОЛЬКО
   * на FAILED (attempt 2 легален); PROCESSED держит слот (identical retry →
   * no-op; защита от двойного refund).
   */
  private async transition(
    code: string,
    to: RefundStatus,
    requiredFrom: RefundStatus | null,
    milestone: "approvedAt" | "processedAt" | "failedAt",
    historyAction: string,
    auditAction: string,
    eventType: string,
    actor: Actor,
  ): Promise<Record<string, unknown>> {
    const refund = await this.prisma.refund.findUnique({ where: { code } });
    if (!refund) throw new NotFoundError(`Refund ${code} not found`);

    if (requiredFrom !== null && refund.status !== requiredFrom) {
      throw new ConflictError(`Refund ${code} cannot transition from ${refund.status} to ${to}`);
    }
    if (requiredFrom === null && (refund.status !== RefundStatus.REQUESTED && refund.status !== RefundStatus.APPROVED)) {
      throw new ConflictError(`Refund ${code} cannot transition from ${refund.status} to ${to}`);
    }
    if (refund.status === to) {
      throw new ConflictError(`Refund ${code} is already ${to}`);
    }

    const now = new Date();
    const result = await this.prisma.$transaction(async (tx) => {
      const updatedRows = await tx.refund.updateMany({
        where: { id: refund.id, status: refund.status, version: refund.version },
        data: {
          status: to,
          version: { increment: 1 },
          [milestone]: now,
          isActiveRefund: !TERMINAL_RELEASE.includes(to),
        },
      });
      if (updatedRows.count !== 1) {
        throw new ConflictError(`Refund ${code} was modified concurrently; retry`);
      }
      const fresh = await tx.refund.findUniqueOrThrow({ where: { id: refund.id } });

      await tx.refundHistory.create({
        data: {
          refundId: refund.id,
          action: historyAction,
          from: refund.status,
          to,
          actorId: actor.id,
          actorName: actor.username,
          comment: historyAction === "processed" ? "Деньги возвращены (подтверждение Finance)" : undefined,
        },
      });
      await this.security.audit(tx, {
        userId: actor.id,
        username: actor.username,
        action: auditAction,
        resource: "Refund",
        resourceId: refund.id,
        details: { code: refund.code, from: refund.status, to },
      });
      await this.eventBus.emit(tx, {
        aggregateType: "Refund",
        aggregateId: refund.id,
        eventType,
        payload: {
          refundId: refund.id,
          code: refund.code,
          paymentId: refund.paymentId,
          orderId: refund.orderId,
          amount: refund.amount.toString(),
          currency: refund.currency,
          reason: refund.reason,
        } as RefundEventPayload,
      });
      return fresh;
    });

    await this.eventBus.publishPending();
    return this.refundDto(result);
  }

  // ── Read (Finance Center) ───────────────────────────────────────────────────

  async list(query: { paymentId?: string; orderId?: string; status?: string; page?: number; pageSize?: number }) {
    const page = query.page ?? 1;
    const pageSize = Math.min(query.pageSize ?? 50, 100);
    const where: Prisma.RefundWhereInput = {
      ...(query.paymentId ? { paymentId: query.paymentId } : {}),
      ...(query.orderId ? { orderId: query.orderId } : {}),
      ...(query.status ? { status: query.status as RefundStatus } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.refund.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { code: "asc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.refund.count({ where }),
    ]);
    return { items: items.map((r) => this.refundDto(r)), total, page, pageSize, hasMore: page * pageSize < total };
  }

  async getByCode(code: string): Promise<Record<string, unknown>> {
    const row = await this.prisma.refund.findUnique({ where: { code } });
    if (!row) throw new NotFoundError(`Refund ${code} not found`);
    return this.refundDto(row);
  }

  // ── Whitelist DTO (без PII/secrets; money — Decimal strings) ───────────────

  private refundDto(r: {
    id: string;
    code: string;
    paymentId: string;
    orderId: string;
    amount: Prisma.Decimal;
    currency: string;
    status: RefundStatus;
    reason: string | null;
    version: number;
    createdAt: Date;
    requestedAt: Date | null;
    approvedAt: Date | null;
    processedAt: Date | null;
    failedAt: Date | null;
  }): Record<string, unknown> {
    return {
      id: r.id,
      code: r.code,
      paymentId: r.paymentId,
      orderId: r.orderId,
      amount: r.amount.toString(),
      currency: r.currency,
      status: r.status,
      reason: r.reason,
      requestedAt: r.requestedAt ? r.requestedAt.toISOString() : null,
      approvedAt: r.approvedAt ? r.approvedAt.toISOString() : null,
      processedAt: r.processedAt ? r.processedAt.toISOString() : null,
      failedAt: r.failedAt ? r.failedAt.toISOString() : null,
      version: r.version,
      createdAt: r.createdAt.toISOString(),
    };
  }
}
