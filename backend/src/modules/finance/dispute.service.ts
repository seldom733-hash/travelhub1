/**
 * PHASE 2 STEP 2.13A — DisputeService (provider-neutral Chargeback/Dispute
 * Foundation).
 *
 * Finance-owned canonical Dispute aggregate (DSP-*). Спор/chargeback
 * фиксируется как отдельный финансовый факт против УЖЕ CAPTURED Payment;
 * Payment НЕ мутируется (остаётся историческим captured fact; никакого
 * Payment.status = DISPUTED). Provider-neutral: 0 PSP-адаптеров/webhooks/
 * вызовов (2.12A/2.12B); 0 Ledger/Commission/Settlement/Payout side-effects
 * (2.12D/2.12C/2.14A deferred); 0 cross-domain writes. chargeback —
 * vocabulary-категория причины (reason), НЕ отдельная сущность (Roadmap
 * 2.13A не различает Dispute/Chargeback как две модели; reconciliation:
 * foundation только, real-PSP chargeback → 2.12A/2.12B).
 *
 * Hard gates:
 *  - Dispute создаётся ТОЛЬКО Finance (finance.dispute.write); Order/Booking/
 *    Sales НЕ пишут finance.Dispute;
 *  - source authority — CAPTURED Payment (PENDING/FAILED/CANCELLED → 422);
 *    currency/orderId server-derived verbatim из Payment (никакого live
 *    commercial lookup / Product/Tax/FX re-read);
 *  - amount: server-validated 0 < amount ≤ payment.amount (frozen captured
 *    money fact). НЕ netting с Refund — monetary netting (disputable vs
 *    already-refunded) НЕ выдумывается: Roadmap 2.13A не определяет его;
 *    deferred до adjustments-шагов (2.12D/2.14A), документировано;
 *  - cardinality/idempotency: один активный Dispute на Payment (isActiveDispute
 *    partial unique на paymentId — НЕ paymentId+amount: спор один на платёж, не
 *    на сумму-срез); identical retry → существующий факт (no-op); RESOLVED/
 *    CANCELLED освобождают слот (повторное открытие после терминального
 *    состояния легально); concurrent duplicate → P2002 → controlled 409;
 *  - state machine (единственный authority): OPENED → RESOLVED | CANCELLED
 *    (CAS id+status+version, from-guard; won/lost liability-исход — deferred);
 *    milestone + history + outbox атомарны с переходом;
 *  - milestones (server-owned UTC, first-only): openedAt (creation),
 *    resolvedAt (RESOLVED), cancelledAt (CANCELLED); без backfill;
 *  - события: DisputeOpened/DisputeResolved/DisputeCancelled (outbox, PII-free,
 *    correlation/causation/actor server-authoritative; consumer-ов нет — 0
 *    cross-domain projections, Roadmap 2.13A их не требует).
 */
import { Injectable } from "@nestjs/common";
import { Prisma } from "../../generated/prisma/client";
import { DisputeStatus } from "../../generated/prisma/enums";
import { PrismaService } from "../../prisma/prisma.service";
import { IdsService } from "../../shared/ids.service";
import { SecurityService } from "../../security/security.service";
import { ConflictError, NotFoundError, ValidationDomainError } from "../../shared/errors";
import { uniqueConstraintNames } from "../../shared/prisma-errors";
import { EventBusService } from "../../eventbus/eventbus.service";
import { DomainEvents, type DisputeEventPayload } from "../../eventbus/domain-events";
import { validateDisputeAmount } from "./finance.validation";

/** Cardinality partial unique index (schema): ≤1 активный Dispute на Payment. */
const DISPUTE_ONE_ACTIVE_PER_PAYMENT = "Dispute_one_active_per_payment";

/** Терминальные статусы, освобождающие idempotency-слот (повторное открытие). */
const TERMINAL: DisputeStatus[] = ["RESOLVED", "CANCELLED"];

interface Actor {
  id: string;
  username: string;
}

@Injectable()
export class DisputeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ids: IdsService,
    private readonly security: SecurityService,
    private readonly eventBus: EventBusService,
  ) {}

  // ── Dispute creation ───────────────────────────────────────────────────────

  /**
   * Создание Dispute для CAPTURED Payment (Finance command, finance.dispute.write).
   * Клиент передаёт paymentId + amount (server-validated ≤ payment.amount) +
   * reason. Frozen money: currency/orderId verbatim из Payment (0 reprice).
   * Idempotent: активный Dispute на этот payment → no-op существующий факт;
   * concurrent duplicate → P2002 → controlled 409. Payment НЕ мутируется.
   */
  async createDispute(input: { paymentId: string; amount: string; reason?: string | null }, actor: Actor): Promise<Record<string, unknown>> {
    const paymentId = input.paymentId.trim();
    if (!paymentId) throw new ValidationDomainError("paymentId is required");
    const amount = validateDisputeAmount(input.amount);
    const reason = input.reason ? input.reason.trim() : null;
    if (reason && reason.length > 255) {
      throw new ValidationDomainError("reason must not exceed 255 characters");
    }
    const amountDecimal = new Prisma.Decimal(amount);

    // READ-only cross-context read (ADR-0001): Payment — owner обязательства.
    const payment = await this.prisma.payment.findUnique({ where: { id: paymentId } });
    if (!payment) throw new NotFoundError(`Payment ${paymentId} not found`);
    if (payment.status !== "CAPTURED") {
      throw new ValidationDomainError(`Payment ${payment.code} is ${payment.status}; dispute requires CAPTURED`);
    }
    // Frozen captured money fact — верхняя граница спора. НЕ netting с Refund
    // (monetary netting deferred; документировано в арх-доке §Refund interaction).
    if (amountDecimal.greaterThan(payment.amount)) {
      throw new ConflictError(`Dispute ${amount} exceeds captured amount ${payment.amount.toString()} for payment ${payment.code}`);
    }

    const emitPayload = (disputeId: string, code: string): DisputeEventPayload => ({
      disputeId,
      code,
      paymentId: payment.id,
      orderId: payment.orderId,
      amount: amountDecimal.toString(),
      currency: payment.currency,
      reason,
    });

    try {
      return await this.prisma.$transaction(async (tx) => {
        // Idempotent retry: активный Dispute на этот payment уже существует.
        // STRICT REVIEW FIX (2.13A §9 Case B / §51 #1 — класс «silent divergent
        // idempotency success», как Ledger 2.10A FIX 1): identical retry (тот же
        // amount) → no-op существующий факт; DIVERGENT amount — материально
        // другой business payload → controlled 409, НЕ молчаливый возврат
        // чужого факта (200 с неверной суммой). reason — descriptive metadata
        // (как Refund.reason), не часть business identity.
        const existing = await tx.dispute.findFirst({
          where: { paymentId: payment.id, isActiveDispute: true },
        });
        if (existing) {
          if (!existing.amount.equals(amountDecimal)) {
            throw new ConflictError(
              `Dispute ${existing.code} is already active for payment ${payment.code} with amount ${existing.amount.toString()}; divergent amount ${amount} rejected`,
            );
          }
          return this.disputeDto(existing);
        }

        const code = await this.ids.nextCode(tx, "DSP");
        const now = new Date();
        const created = await tx.dispute.create({
          data: {
            code,
            paymentId: payment.id,
            orderId: payment.orderId,
            amount: amountDecimal,
            currency: payment.currency,
            status: DisputeStatus.OPENED,
            reason,
            isActiveDispute: true,
            version: 1,
            openedAt: now,
          },
        });
        await tx.disputeHistory.create({
          data: {
            disputeId: created.id,
            action: "opened",
            to: DisputeStatus.OPENED,
            actorId: actor.id,
            actorName: actor.username,
            comment: `Спор открыт по платежу ${payment.code}`,
          },
        });
        await this.security.audit(tx, {
          userId: actor.id,
          username: actor.username,
          action: "finance.dispute.opened",
          resource: "Dispute",
          resourceId: created.id,
          details: { code: created.code, paymentId: payment.id, orderId: payment.orderId, amount: amountDecimal.toString(), currency: payment.currency },
        });
        await this.eventBus.emit(tx, {
          aggregateType: "Dispute",
          aggregateId: created.id,
          eventType: DomainEvents.DisputeOpened,
          payload: emitPayload(created.id, created.code),
        });
        return this.disputeDto(created);
      });
    } catch (err) {
      // Concurrent duplicate create: оба прошли findFirst, один проиграл partial
      // unique → controlled 409 (один факт, без raw 500).
      if (uniqueConstraintNames(err).includes(DISPUTE_ONE_ACTIVE_PER_PAYMENT)) {
        throw new ConflictError(`A dispute is already active for payment ${payment.code}`);
      }
      throw err;
    } finally {
      await this.eventBus.publishPending();
    }
  }

  // ── Lifecycle transitions (единственный state-machine authority) ──────────

  /** OPENED → RESOLVED (терминальный; спор закрыт — исход/liability deferred). */
  async resolveDispute(code: string, actor: Actor): Promise<Record<string, unknown>> {
    return this.transition(code, DisputeStatus.RESOLVED, "resolvedAt", "resolved", "finance.dispute.resolved", DomainEvents.DisputeResolved, actor);
  }

  /** OPENED → CANCELLED (терминальный; спор отклонён — attempt 2 легален). */
  async cancelDispute(code: string, actor: Actor): Promise<Record<string, unknown>> {
    return this.transition(code, DisputeStatus.CANCELLED, "cancelledAt", "cancelled", "finance.dispute.cancelled", DomainEvents.DisputeCancelled, actor);
  }

  /**
   * Единый CAS-переход (паттерн Payment/Refund): from-guard OPENED +
   * updateMany where id+status+version → ровно один победитель; повторный
   * переход → controlled 409 (terminal protection). Milestone + history +
   * audit + outbox атомарно с переходом. isActiveDispute освобождается на
   * терминальных (RESOLVED/CANCELLED — повторное открытие легально).
   */
  private async transition(
    code: string,
    to: DisputeStatus,
    milestone: "resolvedAt" | "cancelledAt",
    historyAction: string,
    auditAction: string,
    eventType: string,
    actor: Actor,
  ): Promise<Record<string, unknown>> {
    const dispute = await this.prisma.dispute.findUnique({ where: { code } });
    if (!dispute) throw new NotFoundError(`Dispute ${code} not found`);

    if (dispute.status !== DisputeStatus.OPENED) {
      throw new ConflictError(`Dispute ${code} cannot transition from ${dispute.status} to ${to}`);
    }
    if (dispute.status === to) {
      throw new ConflictError(`Dispute ${code} is already ${to}`);
    }

    const now = new Date();
    const result = await this.prisma.$transaction(async (tx) => {
      const updatedRows = await tx.dispute.updateMany({
        where: { id: dispute.id, status: DisputeStatus.OPENED, version: dispute.version },
        data: {
          status: to,
          version: { increment: 1 },
          [milestone]: now,
          isActiveDispute: !TERMINAL.includes(to),
        },
      });
      if (updatedRows.count !== 1) {
        throw new ConflictError(`Dispute ${code} was modified concurrently; retry`);
      }
      const fresh = await tx.dispute.findUniqueOrThrow({ where: { id: dispute.id } });

      await tx.disputeHistory.create({
        data: {
          disputeId: dispute.id,
          action: historyAction,
          from: DisputeStatus.OPENED,
          to,
          actorId: actor.id,
          actorName: actor.username,
          comment: historyAction === "resolved" ? "Спор закрыт (подтверждение Finance)" : undefined,
        },
      });
      await this.security.audit(tx, {
        userId: actor.id,
        username: actor.username,
        action: auditAction,
        resource: "Dispute",
        resourceId: dispute.id,
        details: { code: dispute.code, from: DisputeStatus.OPENED, to },
      });
      await this.eventBus.emit(tx, {
        aggregateType: "Dispute",
        aggregateId: dispute.id,
        eventType,
        payload: {
          disputeId: dispute.id,
          code: dispute.code,
          paymentId: dispute.paymentId,
          orderId: dispute.orderId,
          amount: dispute.amount.toString(),
          currency: dispute.currency,
          reason: dispute.reason,
        } as DisputeEventPayload,
      });
      return fresh;
    });

    await this.eventBus.publishPending();
    return this.disputeDto(result);
  }

  // ── Read (Finance Center) ───────────────────────────────────────────────────

  async list(query: { paymentId?: string; orderId?: string; status?: string; page?: number; pageSize?: number }) {
    const page = query.page ?? 1;
    const pageSize = Math.min(query.pageSize ?? 50, 100);
    const where: Prisma.DisputeWhereInput = {
      ...(query.paymentId ? { paymentId: query.paymentId } : {}),
      ...(query.orderId ? { orderId: query.orderId } : {}),
      ...(query.status ? { status: query.status as DisputeStatus } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.dispute.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { code: "asc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.dispute.count({ where }),
    ]);
    return { items: items.map((r) => this.disputeDto(r)), total, page, pageSize, hasMore: page * pageSize < total };
  }

  async getByCode(code: string): Promise<Record<string, unknown>> {
    const row = await this.prisma.dispute.findUnique({ where: { code } });
    if (!row) throw new NotFoundError(`Dispute ${code} not found`);
    return this.disputeDto(row);
  }

  // ── Whitelist DTO (без PII/secrets; money — Decimal strings) ───────────────

  private disputeDto(r: {
    id: string;
    code: string;
    paymentId: string;
    orderId: string;
    amount: Prisma.Decimal;
    currency: string;
    status: DisputeStatus;
    reason: string | null;
    version: number;
    createdAt: Date;
    openedAt: Date | null;
    resolvedAt: Date | null;
    cancelledAt: Date | null;
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
      openedAt: r.openedAt ? r.openedAt.toISOString() : null,
      resolvedAt: r.resolvedAt ? r.resolvedAt.toISOString() : null,
      cancelledAt: r.cancelledAt ? r.cancelledAt.toISOString() : null,
      version: r.version,
      createdAt: r.createdAt.toISOString(),
    };
  }
}
