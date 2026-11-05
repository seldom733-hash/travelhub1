import { Injectable } from "@nestjs/common";
import { Prisma, OrderFinancialStatus } from "../../generated/prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { IdsService } from "../../shared/ids.service";
import { SecurityService } from "../../security/security.service";
import { ConflictError, NotFoundError, ValidationDomainError } from "../../shared/errors";
import { LedgerService } from "./ledger.service";
import { RefundService } from "./refund.service";
import {
  calculateCancellationSettlement,
  type CancellationSettlementResult,
} from "./order-financial-settlement.calculator";

type Actor = { id: string; username: string };

export interface SettlementConfirmInput {
  finalCustomerLiability?: string | null;
  penaltyAmount?: string | null;
  clientPenaltyAmount?: string | null;
  clientPenaltyStatus?: "PENDING" | "CONFIRMED" | "WITHHELD" | "RECEIVED" | "WAIVED";
  supplierPenaltyStatus?: "PENDING" | "CONFIRMED" | "WITHHELD" | "RECEIVED" | "WAIVED";
  platformPenaltyShare?: string | null;
  supplierPenaltyShare?: string | null;
  writeOffAmount?: string | null;
  writeOffReason?: string | null;
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
    private readonly refunds: RefundService,
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
          clientPenaltyAmount: new Prisma.Decimal(result.clientPenaltyAmount),
          clientPenaltyStatus: result.clientPenaltyStatus,
          supplierPenaltyStatus: result.supplierPenaltyStatus,
          platformPenaltyShare: new Prisma.Decimal(result.platformPenaltyShare),
          supplierPenaltyShare: new Prisma.Decimal(result.supplierPenaltyShare),
          annulledUnpaidAmount: new Prisma.Decimal(result.annulledUnpaidAmount),
          remainingToPay: new Prisma.Decimal(result.remainingToPay),
          remainingToRefund: new Prisma.Decimal(result.remainingToRefund),
          writeOffAmount: new Prisma.Decimal(input.writeOffAmount ?? "0"),
          writeOffReason: input.writeOffAmount && Number(input.writeOffAmount) > 0 ? (input.writeOffReason?.trim() || reason) : null,
          writeOffAt: input.writeOffAmount && Number(input.writeOffAmount) > 0 ? new Date() : null,
          writeOffById: input.writeOffAmount && Number(input.writeOffAmount) > 0 ? actor.id : null,
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
      if (["CONFIRMED", "WITHHELD", "RECEIVED"].includes(result.clientPenaltyStatus) && Number(result.platformPenaltyShare) > 0) {
        adjustmentSpecs.push({ type: "PLATFORM_PENALTY_SHARE", amount: result.platformPenaltyShare });
      }
      if (["CONFIRMED", "WITHHELD", "RECEIVED"].includes(result.supplierPenaltyStatus) && Number(result.supplierPenaltyShare) > 0) {
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
      if (input.writeOffAmount && Number(input.writeOffAmount) > 0) {
        await tx.supplierObligation.updateMany({
          where: { orderId, status: { in: ["OPEN", "PARTIALLY_PAID"] } },
          data: { status: "CANCELLED", remainingAmount: new Prisma.Decimal(0) },
        });
        if (context.order.status === "CANCELLED") {
          await tx.booking.updateMany({ where: { orderId, status: { notIn: ["CANCELLED", "COMPLETED"] } }, data: { status: "CANCELLED" } });
        }
      }
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
          clientPenaltyAmount: result.clientPenaltyAmount,
          annulledUnpaidAmount: result.annulledUnpaidAmount,
          reason,
        },
      });
      return settlement;
    });

    return this.toDto(created);
  }

  async writeOffSupplierDebt(orderId: string, input: { amount?: string | null; reason: string }, actor: Actor) {
    const reason = input.reason?.trim();
    if (!reason) throw new ValidationDomainError("Write-off reason is required");
    const order = await this.prisma.order.findUnique({ where: { id: orderId }, select: { id: true, code: true, status: true, cancelledAt: true, amount: true, currency: true, commercialSnapshot: true } });
    if (!order) throw new NotFoundError(`Order ${orderId} not found`);
    if (order.status !== "CANCELLED" && !order.cancelledAt) throw new ValidationDomainError("Supplier debt write-off is allowed only for a cancelled order");
    const [outgoing, incoming, obligations, previous] = await Promise.all([
      this.prisma.supplierPayout.aggregate({ where: { orderId, status: "CONFIRMED", direction: { not: "INCOMING" } }, _sum: { amount: true } }),
      this.prisma.supplierPayout.aggregate({ where: { orderId, status: "CONFIRMED", direction: "INCOMING" }, _sum: { amount: true } }),
      this.prisma.supplierObligation.aggregate({ where: { orderId, status: { in: ["OPEN", "PARTIALLY_PAID"] } }, _sum: { remainingAmount: true } }),
      this.prisma.supplierDebtWriteOff.aggregate({ where: { orderId }, _sum: { amount: true } }),
    ]);
    const snap = (order.commercialSnapshot ?? {}) as Record<string, unknown>;
    let cost = Number(snap.netSupplierCost ?? snap.supplierPrice ?? 0);
    if (cost <= 0) {
      const items = await this.prisma.orderItem.findMany({ where: { orderId }, select: { productId: true, amount: true } });
      for (const item of items) {
        if (!item.productId) continue;
        const product = await this.prisma.product.findUnique({ where: { id: item.productId }, select: { attributes: true } });
        const attrs = (product?.attributes ?? {}) as Record<string, unknown>;
        cost += Number(attrs.priceLocal ?? attrs.convertedPrice ?? attrs.startingPrice ?? 0);
      }
    }
    const obligationDebt = Number(obligations._sum.remainingAmount ?? 0);
    const baseDebt = obligationDebt > 0 ? obligationDebt : Math.max(0, cost - Number(outgoing._sum.amount ?? 0) + Number(incoming._sum.amount ?? 0));
    const debt = Math.max(0, baseDebt - Number(previous._sum.amount ?? 0));
    if (debt <= 0) throw new ConflictError("Supplier has no outstanding debt to write off");
    const amount = input.amount ? new Prisma.Decimal(input.amount) : new Prisma.Decimal(debt);
    if (amount.lte(0) || amount.greaterThan(new Prisma.Decimal(debt))) throw new ValidationDomainError("Write-off amount exceeds supplier debt");
    const code = await this.ids.nextCode(this.prisma as any, "SDW");
    const row = await this.prisma.supplierDebtWriteOff.create({ data: { code, orderId, amount, currency: order.currency, reason, actorId: actor.id, actorName: actor.username } });
    await this.security.audit(this.prisma as any, { userId: actor.id, username: actor.username, action: "finance.supplier_debt.written_off", resource: "SupplierDebtWriteOff", resourceId: row.id, details: { orderId, code, amount: amount.toString(), reason } });
    return { id: row.id, code, amount: amount.toString(), orderId, reason };
  }

  async writeOffSupplier(orderId: string, input: { amount?: string | null; reason: string }, actor: Actor): Promise<Record<string, unknown>> {
    const reason = input.reason?.trim();
    if (!reason) throw new ValidationDomainError("Write-off reason is required");
    const context = await this.loadContext(orderId);
    if (context.terminalKind !== "CANCELLED") throw new ValidationDomainError("Supplier write-off is allowed only for a cancelled order");
    const [outgoing, incoming] = await Promise.all([
      this.prisma.supplierPayout.aggregate({ where: { orderId, status: "CONFIRMED", direction: { not: "INCOMING" } }, _sum: { amount: true } }),
      this.prisma.supplierPayout.aggregate({ where: { orderId, status: "CONFIRMED", direction: "INCOMING" }, _sum: { amount: true } }),
    ]);
    const paid = new Prisma.Decimal(outgoing._sum.amount ?? 0);
    const refunded = new Prisma.Decimal(incoming._sum.amount ?? 0);
    const outstanding = Prisma.Decimal.max(new Prisma.Decimal(0), paid.minus(refunded));
    if (outstanding.isZero()) throw new ConflictError("Supplier has no outstanding refund to write off");
    const amount = input.amount ? new Prisma.Decimal(input.amount) : outstanding;
    if (amount.lte(0) || amount.greaterThan(outstanding)) throw new ValidationDomainError("Write-off amount exceeds outstanding supplier refund");
    const clientNet = Prisma.Decimal.max(new Prisma.Decimal(0), context.capturedAmount.minus(context.refundedAmount));
    const clientPenalty = Prisma.Decimal.min(amount, clientNet);
    return this.confirm(orderId, {
      finalCustomerLiability: clientPenalty.toString(),
      penaltyAmount: amount.toString(),
      clientPenaltyAmount: clientPenalty.toString(),
      clientPenaltyStatus: clientPenalty.greaterThan(0) ? "CONFIRMED" : "WAIVED",
      supplierPenaltyShare: amount.toString(),
      supplierPenaltyStatus: "CONFIRMED",
      writeOffAmount: amount.toString(),
      writeOffReason: reason,
      reason,
    }, actor);
  }

  async cancelPenalty(
    orderId: string,
    input: { client?: boolean; supplier?: boolean; reason: string },
    actor: { id: string; username: string },
  ): Promise<Record<string, unknown>> {
    const settlement = await this.prisma.orderFinancialSettlement.findUnique({ where: { orderId } });
    if (!settlement) throw new NotFoundError(`Financial settlement for order ${orderId} not found`);
    const recognized = new Set(["CONFIRMED", "WITHHELD", "RECEIVED"]);
    const cancelClient = Boolean(input.client) && recognized.has(settlement.clientPenaltyStatus);
    const cancelSupplier = Boolean(input.supplier) && recognized.has(settlement.supplierPenaltyStatus);
    if (!cancelClient && !cancelSupplier) {
      throw new ValidationDomainError("At least one recognised penalty must be selected for cancellation");
    }

    const clientAmount = cancelClient ? settlement.clientPenaltyAmount : new Prisma.Decimal(0);
    const supplierAmount = cancelSupplier ? settlement.supplierPenaltyShare : new Prisma.Decimal(0);

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`order-settlement:${orderId}`}))`;
      const specs: Array<{ type: string; amount: Prisma.Decimal }> = [];
      if (cancelClient && !clientAmount.isZero()) specs.push({ type: "PLATFORM_PENALTY_SHARE_REVERSAL", amount: clientAmount });
      if (cancelSupplier && !supplierAmount.isZero()) specs.push({ type: "SUPPLIER_PENALTY_SHARE_REVERSAL", amount: supplierAmount });

      for (const [index, spec] of specs.entries()) {
        const code = await this.ids.nextCode(tx, "FAD");
        const adjustment = await tx.orderFinancialAdjustment.create({
          data: {
            code,
            orderId,
            settlementId: settlement.id,
            type: spec.type,
            amount: spec.amount,
            currency: settlement.currency,
            reason: input.reason,
            actorId: actor.id,
            actorName: actor.username,
            occurredAt: new Date(),
            idempotencyKey: `${orderId}:${spec.type}:1:${index}`,
          },
        });
        const ledgerRow = await this.ledger.createInTransaction(tx, {
          amount: spec.amount.toString(),
          currency: settlement.currency,
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

      const finalLiability = Prisma.Decimal.max(new Prisma.Decimal(0), settlement.finalCustomerLiability.minus(clientAmount));
      const remainingToRefund = settlement.remainingToRefund.add(clientAmount);
      const nextStatus = remainingToRefund.greaterThan(0) ? "PENDING_SETTLEMENT" : "FINANCIALLY_SETTLED";
      const row = await tx.orderFinancialSettlement.update({
        where: { id: settlement.id },
        data: {
          clientPenaltyStatus: cancelClient ? "WAIVED" : settlement.clientPenaltyStatus,
          supplierPenaltyStatus: cancelSupplier ? "WAIVED" : settlement.supplierPenaltyStatus,
          finalCustomerLiability: finalLiability,
          remainingToRefund,
          status: nextStatus,
          version: { increment: 1 },
        },
      });
      await tx.order.update({
        where: { id: orderId },
        data: { financialStatus: nextStatus as OrderFinancialStatus },
      });
      await this.security.audit(tx, {
        action: "finance.order_settlement.penalty_cancelled",
        resource: "OrderFinancialSettlement",
        resourceId: settlement.id,
        details: {
          orderId,
          client: cancelClient,
          supplier: cancelSupplier,
          clientAmount: clientAmount.toString(),
          supplierAmount: supplierAmount.toString(),
          reason: input.reason,
        },
      });
      return row;
    });

    let finalSettlement = updated;
    if (cancelClient && clientAmount.greaterThan(0)) {
      const payment = await this.prisma.payment.findFirst({
        where: { orderId, status: "CAPTURED" },
        orderBy: { createdAt: "desc" },
        select: { id: true },
      });
      if (payment) {
        const refund = await this.refunds.createRefund(
          { paymentId: payment.id, amount: clientAmount.toString(), reason: input.reason },
          actor,
        );
        await this.refunds.approveRefund(String(refund.code), actor);
        await this.refunds.processRefund(String(refund.code), actor);
        finalSettlement = await this.prisma.orderFinancialSettlement.update({
          where: { id: settlement.id },
          data: { remainingToRefund: new Prisma.Decimal(0), status: "FINANCIALLY_SETTLED", version: { increment: 1 } },
        });
        await this.prisma.order.update({
          where: { id: orderId },
          data: { financialStatus: "FINANCIALLY_SETTLED" },
        });
      }
    }

    return this.toDto(finalSettlement);
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
      clientPenaltyAmount: input.clientPenaltyAmount ?? input.penaltyAmount ?? "0",
      clientPenaltyStatus: input.clientPenaltyStatus ?? "CONFIRMED",
      supplierPenaltyStatus: input.supplierPenaltyStatus ?? "CONFIRMED",
      platformPenaltyShare: input.platformPenaltyShare ?? "0",
      supplierPenaltyShare: input.supplierPenaltyShare ?? "0",
      penaltyReason: input.reason ?? null,
      ledgerComplete: context.ledgerComplete,
    });
  }

  private sameSettlement(
    existing: { finalCustomerLiability: Prisma.Decimal; penaltyAmount: Prisma.Decimal; clientPenaltyAmount: Prisma.Decimal; clientPenaltyStatus: string; supplierPenaltyStatus: string; annulledUnpaidAmount: Prisma.Decimal; status: OrderFinancialStatus },
    result: CancellationSettlementResult,
  ): boolean {
    return new Prisma.Decimal(existing.finalCustomerLiability).equals(result.finalCustomerLiability ?? "0") &&
      new Prisma.Decimal(existing.penaltyAmount).equals(result.penaltyAmount) &&
      new Prisma.Decimal(existing.clientPenaltyAmount).equals(result.clientPenaltyAmount) &&
      existing.clientPenaltyStatus === result.clientPenaltyStatus &&
      existing.supplierPenaltyStatus === result.supplierPenaltyStatus &&
      new Prisma.Decimal(existing.annulledUnpaidAmount).equals(result.annulledUnpaidAmount) &&
      existing.status === result.status;
  }

  private toDto(row: {
    id: string; code: string; orderId: string; originalAmount: Prisma.Decimal; currency: string;
    capturedAmount: Prisma.Decimal; refundedAmount: Prisma.Decimal; pendingRefundAmount: Prisma.Decimal;
    finalCustomerLiability: Prisma.Decimal; penaltyAmount: Prisma.Decimal; clientPenaltyAmount: Prisma.Decimal; clientPenaltyStatus: string; supplierPenaltyStatus: string; platformPenaltyShare: Prisma.Decimal;
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
      clientPenaltyAmount: row.clientPenaltyAmount.toString(),
      clientPenaltyStatus: row.clientPenaltyStatus,
      supplierPenaltyStatus: row.supplierPenaltyStatus,
      platformPenaltyShare: row.platformPenaltyShare.toString(), supplierPenaltyShare: row.supplierPenaltyShare.toString(),
      annulledUnpaidAmount: row.annulledUnpaidAmount.toString(), remainingToPay: row.remainingToPay.toString(),
      remainingToRefund: row.remainingToRefund.toString(), status: row.status, reason: row.reason,
      confirmedAt: row.confirmedAt.toISOString(), confirmedById: row.confirmedById, createdAt: row.createdAt.toISOString(),
    };
  }
}
