import { Injectable } from "@nestjs/common";
import { Prisma, OrderFinancialStatus } from "../../generated/prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { IdsService } from "../../shared/ids.service";
import { SecurityService } from "../../security/security.service";
import { ConflictError, NotFoundError, ValidationDomainError } from "../../shared/errors";
import { LedgerService } from "./ledger.service";
import {
  calculateCancellationSettlement,
  type CancellationSettlementResult,
} from "./order-financial-settlement.calculator";

type Actor = { id: string; username: string };

export interface SettlementConfirmInput {
  finalCustomerLiability?: string | null;
  penaltyAmount?: string | null;
  platformPenaltyShare?: string | null;
  supplierPenaltyShare?: string | null;
  reason?: string;
}

interface SettlementContext {
  order: {
    id: string;
    code: string;
    referenceNumber: string;
    status: string;
    amount: Prisma.Decimal;
    currency: string;
    paidAmount: Prisma.Decimal;
    refundedAmount: Prisma.Decimal;
    cancelledAt: Date | null;
    financialStatus: OrderFinancialStatus;
  };
  capturedAmount: Prisma.Decimal;
  refundedAmount: Prisma.Decimal;
  pendingRefundAmount: Prisma.Decimal;
  pendingPaymentsCount: number;
  activeRefundsCount: number;
  ledgerComplete: boolean;
  terminalKind: "CANCELLED" | "COMPLETED" | null;
}

@Injectable()
export class OrderFinancialSettlementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ids: IdsService,
    private readonly security: SecurityService,
    private readonly ledger: LedgerService,
  ) {}

  async get(orderId: string): Promise<Record<string, unknown> | null> {
    const existing = await this.prisma.orderFinancialSettlement.findUnique({ where: { orderId } });
    // No stored settlement yet: return null so the UI shows the editable
    // preview form. Returning a calculated preview here made the panel treat
    // it as an already-confirmed settlement and hide the confirm controls.
    return existing ? this.toDto(existing) : null;
  }

  async preview(orderId: string, input: SettlementConfirmInput): Promise<Record<string, unknown>> {
    const context = await this.loadContext(orderId);
    const result = this.calculate(context, input, true);
    return { ...result, orderId, code: null, confirmedAt: null };
  }

  async confirm(orderId: string, input: SettlementConfirmInput, actor: Actor): Promise<Record<string, unknown>> {
    const reason = input.reason?.trim();
    if (!reason) throw new ValidationDomainError("Settlement reason is required");

    const context = await this.loadContext(orderId);
    if (!context.terminalKind) {
      throw new ValidationDomainError("Financial settlement is allowed only for a cancelled or completed order");
    }
    if (context.terminalKind === "CANCELLED" && !context.order.cancelledAt) {
      throw new ValidationDomainError("Cancellation is not confirmed (cancelledAt is missing)");
    }
    if (input.finalCustomerLiability == null && context.terminalKind === "CANCELLED") {
      throw new ValidationDomainError("finalCustomerLiability is required for a cancelled order");
    }

    const result = this.calculate(context, input, false);
    if (result.status === "PENDING_SETTLEMENT") {
      throw new ConflictError(`Cannot financially settle ${context.order.referenceNumber}: ${result.blockers.join(", ")}`);
    }

    const existing = await this.prisma.orderFinancialSettlement.findUnique({ where: { orderId } });
    if (existing) {
      if (this.sameSettlement(existing, result)) return this.toDto(existing);
      throw new ConflictError(`Order ${context.order.referenceNumber} is already financially settled with a different calculation`);
    }

    const created = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`order-settlement:${orderId}`}))`;
      const again = await tx.orderFinancialSettlement.findUnique({ where: { orderId } });
      if (again) {
        if (this.sameSettlement(again, result)) return again;
        throw new ConflictError(`Order ${context.order.referenceNumber} was concurrently settled differently`);
      }

      const settlementCode = await this.ids.nextCode(tx, "SET");
      const settlement = await tx.orderFinancialSettlement.create({
        data: {
          code: settlementCode,
          orderId,
          originalAmount: new Prisma.Decimal(result.originalAmount),
          currency: context.order.currency,
          capturedAmount: new Prisma.Decimal(result.capturedAmount),
          refundedAmount: new Prisma.Decimal(result.refundedAmount),
          pendingRefundAmount: new Prisma.Decimal(result.pendingRefundAmount),
          finalCustomerLiability: new Prisma.Decimal(result.finalCustomerLiability ?? "0"),
          penaltyAmount: new Prisma.Decimal(result.penaltyAmount),
          platformPenaltyShare: new Prisma.Decimal(result.platformPenaltyShare),
          supplierPenaltyShare: new Prisma.Decimal(result.supplierPenaltyShare),
          annulledUnpaidAmount: new Prisma.Decimal(result.annulledUnpaidAmount),
          remainingToPay: new Prisma.Decimal(result.remainingToPay),
          remainingToRefund: new Prisma.Decimal(result.remainingToRefund),
          status: result.status as OrderFinancialStatus,
          reason,
          confirmedAt: new Date(),
          confirmedById: actor.id,
          version: 1,
        },
      });

      const adjustmentSpecs: Array<{ type: string; amount: string }> = [];
      if (Number(result.annulledUnpaidAmount) > 0) {
        adjustmentSpecs.push({ type: "UNPAID_WRITE_OFF", amount: result.annulledUnpaidAmount });
      }
      if (Number(result.platformPenaltyShare) > 0) {
        adjustmentSpecs.push({ type: "PLATFORM_PENALTY_SHARE", amount: result.platformPenaltyShare });
      }
      if (Number(result.supplierPenaltyShare) > 0) {
        adjustmentSpecs.push({ type: "SUPPLIER_PENALTY_SHARE", amount: result.supplierPenaltyShare });
      }

      for (const [index, spec] of adjustmentSpecs.entries()) {
        const code = await this.ids.nextCode(tx, "FAD");
        const adjustment = await tx.orderFinancialAdjustment.create({
          data: {
            code,
            orderId,
            settlementId: settlement.id,
            type: spec.type,
            amount: new Prisma.Decimal(spec.amount),
            currency: context.order.currency,
            reason,
            actorId: actor.id,
            actorName: actor.username,
            occurredAt: new Date(),
            idempotencyKey: `${orderId}:${spec.type}:1:${index}`,
          },
        });
        const ledgerRow = await this.ledger.createInTransaction(tx, {
          amount: spec.amount,
          currency: context.order.currency,
          type: spec.type,
          sourceType: "ORDER_FINANCIAL_ADJUSTMENT",
          sourceId: adjustment.id,
          businessRef: adjustment.code,
          occurredAt: new Date().toISOString(),
        });
        await tx.orderFinancialAdjustment.update({
          where: { id: adjustment.id },
          data: { ledgerTransactionId: String(ledgerRow.id ?? "") || null },
        });
      }

      await tx.order.update({
        where: { id: orderId },
        data: {
          financialStatus: result.status as OrderFinancialStatus,
          financiallySettledAt: new Date(),
        },
      });
      await this.security.audit(tx, {
        userId: actor.id,
        username: actor.username,
        action: "finance.order_settlement.confirmed",
        resource: "OrderFinancialSettlement",
        resourceId: settlement.id,
        details: {
          orderId,
          code: settlement.code,
          status: result.status,
          finalCustomerLiability: result.finalCustomerLiability,
          penaltyAmount: result.penaltyAmount,
          annulledUnpaidAmount: result.annulledUnpaidAmount,
          reason,
        },
      });
      return settlement;
    });

    return this.toDto(created);
  }

  private async loadContext(orderId: string): Promise<SettlementContext> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true, code: true, referenceNumber: true, status: true, amount: true, currency: true,
        paidAmount: true, refundedAmount: true, cancelledAt: true, financialStatus: true,
      },
    });
    if (!order) throw new NotFoundError(`Order ${orderId} not found`);

    const [captured, refunded, pendingRefund, pendingPayments, activeRefunds, paymentRows, refundRows] = await Promise.all([
      this.prisma.payment.aggregate({
        where: { orderId, status: { in: ["CAPTURED", "REFUNDED"] } },
        _sum: { amount: true },
      }),
      this.prisma.refund.aggregate({
        where: { orderId, status: "PROCESSED" },
        _sum: { amount: true },
      }),
      this.prisma.refund.aggregate({
        where: { orderId, status: { in: ["REQUESTED", "APPROVED"] } },
        _sum: { amount: true },
      }),
      this.prisma.payment.count({ where: { orderId, status: { in: ["PENDING", "AUTHORIZED"] } } }),
      this.prisma.refund.count({ where: { orderId, status: { in: ["REQUESTED", "APPROVED"] } } }),
      this.prisma.payment.findMany({ where: { orderId, status: { in: ["CAPTURED", "REFUNDED"] } }, select: { id: true } }),
      this.prisma.refund.findMany({ where: { orderId, status: "PROCESSED" }, select: { id: true } }),
    ]);

    const paymentIds = paymentRows.map((row) => row.id);
    const refundIds = refundRows.map((row) => row.id);
    const [paymentLedger, refundLedger] = await Promise.all([
      paymentIds.length === 0 ? Promise.resolve(0) : this.prisma.ledgerTransaction.count({
        where: { sourceType: "PAYMENT", sourceId: { in: paymentIds }, type: "PAYMENT_CAPTURED" },
      }),
      refundIds.length === 0 ? Promise.resolve(0) : this.prisma.ledgerTransaction.count({
        where: { sourceType: "REFUND", sourceId: { in: refundIds }, type: "REFUND_PROCESSED" },
      }),
    ]);

    return {
      order,
      capturedAmount: captured._sum.amount ?? new Prisma.Decimal(0),
      refundedAmount: refunded._sum.amount ?? new Prisma.Decimal(0),
      pendingRefundAmount: pendingRefund._sum.amount ?? new Prisma.Decimal(0),
      pendingPaymentsCount: pendingPayments,
      activeRefundsCount: activeRefunds,
      ledgerComplete: paymentLedger === paymentIds.length && refundLedger === refundIds.length,
      terminalKind: order.status === "CANCELLED" ? "CANCELLED" : ["FULFILLED", "CLOSED"].includes(order.status) ? "COMPLETED" : null,
    };
  }

  private calculate(context: SettlementContext, input: SettlementConfirmInput, preview: boolean): CancellationSettlementResult {
    const finalLiability = input.finalCustomerLiability
      ?? (context.terminalKind === "CANCELLED"
        ? (preview ? context.capturedAmount.toString() : null)
        : context.order.amount.toString());
    return calculateCancellationSettlement({
      originalAmount: context.order.amount.toString(),
      capturedAmount: context.capturedAmount.toString(),
      refundedAmount: context.refundedAmount.toString(),
      pendingRefundAmount: context.pendingRefundAmount.toString(),
      pendingPaymentsCount: context.pendingPaymentsCount,
      activeRefundsCount: context.activeRefundsCount,
      terminal: context.terminalKind !== null,
      terminalKind: context.terminalKind,
      cancellationConfirmed: context.order.cancelledAt !== null,
      finalCustomerLiability: finalLiability,
      penaltyAmount: input.penaltyAmount ?? "0",
      platformPenaltyShare: input.platformPenaltyShare ?? "0",
      supplierPenaltyShare: input.supplierPenaltyShare ?? "0",
      penaltyReason: input.reason ?? null,
      ledgerComplete: context.ledgerComplete,
    });
  }

  private sameSettlement(
    existing: { finalCustomerLiability: Prisma.Decimal; penaltyAmount: Prisma.Decimal; annulledUnpaidAmount: Prisma.Decimal; status: OrderFinancialStatus },
    result: CancellationSettlementResult,
  ): boolean {
    return new Prisma.Decimal(existing.finalCustomerLiability).equals(result.finalCustomerLiability ?? "0") &&
      new Prisma.Decimal(existing.penaltyAmount).equals(result.penaltyAmount) &&
      new Prisma.Decimal(existing.annulledUnpaidAmount).equals(result.annulledUnpaidAmount) &&
      existing.status === result.status;
  }

  private toDto(row: {
    id: string; code: string; orderId: string; originalAmount: Prisma.Decimal; currency: string;
    capturedAmount: Prisma.Decimal; refundedAmount: Prisma.Decimal; pendingRefundAmount: Prisma.Decimal;
    finalCustomerLiability: Prisma.Decimal; penaltyAmount: Prisma.Decimal; platformPenaltyShare: Prisma.Decimal;
    supplierPenaltyShare: Prisma.Decimal; annulledUnpaidAmount: Prisma.Decimal; remainingToPay: Prisma.Decimal;
    remainingToRefund: Prisma.Decimal; status: OrderFinancialStatus; reason: string; confirmedAt: Date;
    confirmedById: string | null; createdAt: Date;
  }): Record<string, unknown> {
    return {
      id: row.id, code: row.code, orderId: row.orderId,
      originalAmount: row.originalAmount.toString(), currency: row.currency,
      capturedAmount: row.capturedAmount.toString(), refundedAmount: row.refundedAmount.toString(),
      pendingRefundAmount: row.pendingRefundAmount.toString(),
      finalCustomerLiability: row.finalCustomerLiability.toString(), penaltyAmount: row.penaltyAmount.toString(),
      platformPenaltyShare: row.platformPenaltyShare.toString(), supplierPenaltyShare: row.supplierPenaltyShare.toString(),
      annulledUnpaidAmount: row.annulledUnpaidAmount.toString(), remainingToPay: row.remainingToPay.toString(),
      remainingToRefund: row.remainingToRefund.toString(), status: row.status, reason: row.reason,
      confirmedAt: row.confirmedAt.toISOString(), confirmedById: row.confirmedById, createdAt: row.createdAt.toISOString(),
    };
  }
}
