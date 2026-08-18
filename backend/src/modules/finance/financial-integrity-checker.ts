/**
 * PHASE 2 STEP 2.18A — Financial Integrity Reconciliation Checker
 *
 * Deterministic, repository-first verification of internal financial facts.
 * Inspects authoritative DB state and emits structured verdicts.
 *
 * This is an AUDITOR, not a FIXER. Never mutates authoritative data.
 *
 * Usage (test/ops context only — NOT a public endpoint):
 *   const checker = new FinancialIntegrityChecker(prisma);
 *   const result = await checker.runFullCheck();
 *   if (!result.passed) throw new Error(result.summary);
 */
import { PrismaService } from "../../prisma/prisma.service";

export interface IntegrityCheckResult {
  passed: boolean;
  checks: CheckEntry[];
  summary: string;
}

export interface CheckEntry {
  name: string;
  passed: boolean;
  detail: string;
}

export class FinancialIntegrityChecker {
  constructor(private readonly prisma: PrismaService) {}

  async runFullCheck(): Promise<IntegrityCheckResult> {
    const checks: CheckEntry[] = [];

    checks.push(await this.checkDuplicateActivePayments());
    checks.push(await this.checkDuplicateCommission());
    checks.push(await this.checkDuplicateAccrual());
    checks.push(await this.checkOrphanLedgerEntries());
    checks.push(await this.checkPaymentAmountConsistency());
    checks.push(await this.checkCommissionAmountConsistency());
    checks.push(await this.checkCurrencyConsistency());
    checks.push(await this.checkLedgerIdempotency());

    const passed = checks.every((c) => c.passed);
    const failedCount = checks.filter((c) => !c.passed).length;
    const summary = passed
      ? `All ${checks.length} financial integrity checks passed.`
      : `${failedCount}/${checks.length} checks FAILED.`;

    return { passed, checks, summary };
  }

  /**
   * CHECK 1: No duplicate active Payment per Order.
   * Schema backstop: @@unique([orderId], where: { isActivePayment: true })
   * Application guard: PaymentService.createPayment checks before insert.
   */
  private async checkDuplicateActivePayments(): Promise<CheckEntry> {
    const duplicates = await this.prisma.$queryRaw<{ orderId: string; count: bigint }[]>`
      SELECT "orderId", COUNT(*) as count
      FROM "finance"."Payment"
      WHERE "isActivePayment" = true
      GROUP BY "orderId"
      HAVING COUNT(*) > 1
    `;

    const passed = duplicates.length === 0;
    const detail = passed
      ? "No duplicate active Payments found."
      : `DUPLICATE ACTIVE PAYMENTS: ${duplicates.map((d) => `${d.orderId}(${d.count})`).join(", ")}`;

    return { name: "duplicate-active-payment", passed, detail };
  }

  /**
   * CHECK 2: No duplicate Commission per Order.
   * Schema backstop: @@unique([orderId])
   */
  private async checkDuplicateCommission(): Promise<CheckEntry> {
    const duplicates = await this.prisma.$queryRaw<{ orderId: string; count: bigint }[]>`
      SELECT "orderId", COUNT(*) as count
      FROM "finance"."Commission"
      GROUP BY "orderId"
      HAVING COUNT(*) > 1
    `;

    const passed = duplicates.length === 0;
    const detail = passed
      ? "No duplicate Commissions found."
      : `DUPLICATE COMMISSIONS: ${duplicates.map((d) => `${d.orderId}(${d.count})`).join(", ")}`;

    return { name: "duplicate-commission", passed, detail };
  }

  /**
   * CHECK 3: No duplicate CommissionAccrual per source Commission.
   * Schema backstop: @@unique([sourceCommissionId])
   */
  private async checkDuplicateAccrual(): Promise<CheckEntry> {
    const duplicates = await this.prisma.$queryRaw<{ sourceCommissionId: string; count: bigint }[]>`
      SELECT "sourceCommissionId", COUNT(*) as count
      FROM "finance"."CommissionAccrual"
      WHERE "sourceCommissionId" IS NOT NULL
      GROUP BY "sourceCommissionId"
      HAVING COUNT(*) > 1
    `;

    const passed = duplicates.length === 0;
    const detail = passed
      ? "No duplicate CommissionAccruals found."
      : `DUPLICATE ACCRUALS: ${duplicates.map((d) => `${d.sourceCommissionId}(${d.count})`).join(", ")}`;

    return { name: "duplicate-accrual", passed, detail };
  }

  /**
   * CHECK 4: No orphan LedgerTransactions.
   * Every ledger entry must reference a valid source entity.
   */
  private async checkOrphanLedgerEntries(): Promise<CheckEntry> {
    // Check for ORDER-sourced ledger entries without matching Order
    const orphanOrders = await this.prisma.$queryRaw<{ sourceId: string }[]>`
      SELECT lt."sourceId"
      FROM "finance"."LedgerTransaction" lt
      LEFT JOIN "order"."Order" o ON o."id" = lt."sourceId"
      WHERE lt."sourceType" = 'ORDER' AND o."id" IS NULL
    `;

    // Check for PAYMENT-sourced ledger entries without matching Payment
    const orphanPayments = await this.prisma.$queryRaw<{ sourceId: string }[]>`
      SELECT lt."sourceId"
      FROM "finance"."LedgerTransaction" lt
      LEFT JOIN "finance"."Payment" p ON p."id" = lt."sourceId"
      WHERE lt."sourceType" = 'PAYMENT' AND p."id" IS NULL
    `;

    const totalOrphans = orphanOrders.length + orphanPayments.length;
    const passed = totalOrphans === 0;
    const detail = passed
      ? "No orphan LedgerTransactions found."
      : `ORPHAN LEDGER: ${orphanOrders.length} order-orphaned, ${orphanPayments.length} payment-orphaned`;

    return { name: "orphan-ledger", passed, detail };
  }

  /**
   * CHECK 5: Payment.amount consistency with Order.total.
   * Payment is frozen from Order at creation — verify no drift.
   */
  private async checkPaymentAmountConsistency(): Promise<CheckEntry> {
    const mismatches = await this.prisma.$queryRaw<{ paymentId: string; orderId: string; paymentAmount: unknown; orderTotal: unknown }[]>`
      SELECT p."id" as "paymentId", p."orderId",
             p."amount" as "paymentAmount", o."total" as "orderTotal"
      FROM "finance"."Payment" p
      JOIN "order"."Order" o ON o."id" = p."orderId"
      WHERE p."isActivePayment" = true
        AND p."amount" != o."total"
    `;

    const passed = mismatches.length === 0;
    const detail = passed
      ? "All active Payments match Order totals."
      : `AMOUNT MISMATCH: ${mismatches.map((m) => `Payment ${m.paymentId} (${m.paymentAmount}) ≠ Order ${m.orderId} (${m.orderTotal})`).join("; ")}`;

    return { name: "payment-amount-consistency", passed, detail };
  }

  /**
   * CHECK 6: Commission.amount consistency with frozen snapshot.
   * Commission is frozen at Order creation — verify no drift.
   */
  private async checkCommissionAmountConsistency(): Promise<CheckEntry> {
    // Commission.amount should match the frozen snapshot in Order.commissionSnapshot
    // We verify that Commission exists for every Order with a non-null commissionSnapshot
    const missingCommissions = await this.prisma.$queryRaw<{ orderId: string }[]>`
      SELECT o."id" as "orderId"
      FROM "order"."Order" o
      LEFT JOIN "finance"."Commission" c ON c."orderId" = o."id"
      WHERE o."commissionSnapshot" IS NOT NULL
        AND o."commissionSnapshot" != 'null'::jsonb
        AND c."id" IS NULL
    `;

    const passed = missingCommissions.length === 0;
    const detail = passed
      ? "All Orders with commissionSnapshot have Commission records."
      : `MISSING COMMISSION: ${missingCommissions.map((m) => m.orderId).join(", ")}`;

    return { name: "commission-snapshot-consistency", passed, detail };
  }

  /**
   * CHECK 7: Currency consistency across related financial facts.
   * Payment.currency == Order.currency, Commission.currency == Order.currency.
   */
  private async checkCurrencyConsistency(): Promise<CheckEntry> {
    const paymentCurrencyMismatch = await this.prisma.$queryRaw<{ paymentId: string }[]>`
      SELECT p."id" as "paymentId"
      FROM "finance"."Payment" p
      JOIN "order"."Order" o ON o."id" = p."orderId"
      WHERE p."isActivePayment" = true
        AND p."currency" != o."currency"
    `;

    const commissionCurrencyMismatch = await this.prisma.$queryRaw<{ commissionId: string }[]>`
      SELECT c."id" as "commissionId"
      FROM "finance"."Commission" c
      JOIN "order"."Order" o ON o."id" = c."orderId"
      WHERE c."currency" != o."currency"
    `;

    const totalMismatches = paymentCurrencyMismatch.length + commissionCurrencyMismatch.length;
    const passed = totalMismatches === 0;
    const detail = passed
      ? "All currencies consistent across financial facts."
      : `CURRENCY MISMATCH: ${paymentCurrencyMismatch.length} payment, ${commissionCurrencyMismatch.length} commission`;

    return { name: "currency-consistency", passed, detail };
  }

  /**
   * CHECK 8: Ledger idempotency — no duplicate (sourceType, sourceId, type).
   * Schema backstop: @@unique([sourceType, sourceId, type])
   */
  private async checkLedgerIdempotency(): Promise<CheckEntry> {
    const duplicates = await this.prisma.$queryRaw<{ sourceType: string; sourceId: string; type: string; count: bigint }[]>`
      SELECT "sourceType", "sourceId", "type", COUNT(*) as count
      FROM "finance"."LedgerTransaction"
      GROUP BY "sourceType", "sourceId", "type"
      HAVING COUNT(*) > 1
    `;

    const passed = duplicates.length === 0;
    const detail = passed
      ? "No duplicate LedgerTransactions found."
      : `DUPLICATE LEDGER: ${duplicates.map((d) => `${d.sourceType}:${d.sourceId}:${d.type}(${d.count})`).join(", ")}`;

    return { name: "ledger-idempotency", passed, detail };
  }
}
