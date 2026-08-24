/**
 * Step 3.29D — Storefront Subscription Billing Foundation
 *
 * Authoritative billing engine for Storefront SaaS subscriptions.
 * Provides: contracted pricing, invoice generation, payment recording,
 * trial→paid conversion, cancellation, renewal.
 *
 * Frozen principle: List Price ≠ Contracted Price
 * Canonical billing currency: AZN
 */

import { Injectable } from "@nestjs/common";
import { PrismaClient, Prisma } from "../../../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

// ─── Types ─────────────────────────────────────────────────────────────────

export interface CreateContractParams {
  subscriptionId: string;
  planId: string;
  contractedUnitAmount: number;
  currency?: string;
  billingInterval?: "MONTHLY" | "ANNUAL";
  quantity?: number;
  effectiveFrom?: Date;
}

export interface InvoiceResult {
  invoice: any;
  idempotent: boolean;
}

export interface PaymentResult {
  payment: any;
  invoicePaid: boolean;
}

// ─── Service ───────────────────────────────────────────────────────────────

@Injectable()
export class StorefrontBillingService {
  // ─── CONTRACT ────────────────────────────────────────────────────────

  /**
   * Create an authoritative billing contract for a subscription.
   * Snapshots the contracted price — immune to future plan list-price changes.
   */
  async createContract(params: CreateContractParams): Promise<any> {
    const quantity = params.quantity ?? 1;
    const contractedTotal = new Prisma.Decimal(params.contractedUnitAmount).mul(quantity);

    const contract = await prisma.subscriptionContract.create({
      data: {
        code: await this.nextCode("SC"),
        subscriptionId: params.subscriptionId,
        planId: params.planId,
        contractedUnitAmount: params.contractedUnitAmount,
        currency: params.currency ?? "AZN",
        billingInterval: params.billingInterval ?? "MONTHLY",
        quantity,
        contractedTotalAmount: contractedTotal,
        effectiveFrom: params.effectiveFrom ?? new Date(),
        isActive: true,
      },
    });

    return contract;
  }

  /**
   * Get the active contract for a subscription.
   */
  async getActiveContract(subscriptionId: string): Promise<any | null> {
    return prisma.subscriptionContract.findFirst({
      where: { subscriptionId, isActive: true },
      orderBy: { effectiveFrom: "desc" },
    });
  }

  // ─── INVOICE ─────────────────────────────────────────────────────────

  /**
   * Generate an invoice for a billing period.
   * Idempotent: same contract + periodStart → returns existing invoice.
   * Monetary snapshot is immutable after creation.
   */
  async generateInvoice(
    contractId: string,
    periodStart: Date,
    periodEnd: Date,
  ): Promise<InvoiceResult> {
    // Idempotency check
    const existing = await prisma.subscriptionInvoice.findUnique({
      where: { contractId_periodStart: { contractId, periodStart } },
    });
    if (existing) {
      return { invoice: existing, idempotent: true };
    }

    const contract = await prisma.subscriptionContract.findUniqueOrThrow({
      where: { id: contractId },
    });

    const invoice = await prisma.subscriptionInvoice.create({
      data: {
        code: await this.nextCode("SINV"),
        contractId,
        subscriptionId: contract.subscriptionId,
        subtotalAmount: contract.contractedTotalAmount,
        discountAmount: 0,
        totalAmount: contract.contractedTotalAmount,
        currency: contract.currency,
        status: "OPEN",
        periodStart,
        periodEnd,
        dueAt: periodEnd,
      },
    });

    return { invoice, idempotent: false };
  }

  // ─── PAYMENT ─────────────────────────────────────────────────────────

  /**
   * Record a payment against an invoice.
   * Validates: invoice must be OPEN, amount must not exceed outstanding,
   * currency must match, no overpayment without credit model.
   */
  async recordPayment(
    invoiceId: string,
    amount: number,
    currency: string = "AZN",
  ): Promise<PaymentResult> {
    const invoice = await prisma.subscriptionInvoice.findUniqueOrThrow({
      where: { id: invoiceId },
    });

    if (invoice.status !== "OPEN") {
      throw new Error(`Invoice ${invoice.code} is ${invoice.status}, not OPEN`);
    }

    if (currency !== invoice.currency) {
      throw new Error(
        `Currency mismatch: payment ${currency} vs invoice ${invoice.currency}`,
      );
    }

    // Calculate outstanding
    const paidSum = await prisma.subscriptionPayment.aggregate({
      where: { invoiceId, status: "SUCCEEDED" },
      _sum: { amount: true },
    });
    const alreadyPaid = Number(paidSum._sum.amount ?? 0);
    const outstanding = Number(invoice.totalAmount) - alreadyPaid;

    if (amount > outstanding) {
      throw new Error(
        `Overpayment: amount ${amount} exceeds outstanding ${outstanding}`,
      );
    }

    const payment = await prisma.subscriptionPayment.create({
      data: {
        code: await this.nextCode("SPAY"),
        invoiceId,
        amount,
        currency,
        status: "SUCCEEDED",
        paidAt: new Date(),
      },
    });

    // Check if invoice is fully paid
    const newPaid = alreadyPaid + amount;
    const invoicePaid = newPaid >= Number(invoice.totalAmount);

    if (invoicePaid) {
      await prisma.subscriptionInvoice.update({
        where: { id: invoiceId },
        data: { status: "PAID", paidAt: new Date() },
      });
    }

    return { payment, invoicePaid };
  }

  // ─── TRIAL → PAID CONVERSION ────────────────────────────────────────

  /**
   * Convert a trial subscription to a paid plan.
   * Creates a new contract with the specified price.
   */
  async convertTrialToPaid(
    subscriptionId: string,
    newPlanId: string,
    contractedUnitAmount: number,
    quantity: number = 1,
  ): Promise<any> {
    const sub = await prisma.storefrontSubscription.findUniqueOrThrow({
      where: { id: subscriptionId },
    });

    if (sub.status !== "TRIAL" && sub.status !== "ACTIVE") {
      throw new Error(
        `Cannot convert subscription in ${sub.status} status`,
      );
    }

    // Deactivate old contract if exists
    const oldContract = await this.getActiveContract(subscriptionId);
    if (oldContract) {
      await prisma.subscriptionContract.update({
        where: { id: oldContract.id },
        data: { isActive: false, effectiveTo: new Date() },
      });
    }

    // Create new contract
    const contract = await this.createContract({
      subscriptionId,
      planId: newPlanId,
      contractedUnitAmount,
      quantity,
    });

    // Update subscription
    await prisma.storefrontSubscription.update({
      where: { id: subscriptionId },
      data: {
        planId: newPlanId,
        status: "ACTIVE",
      },
    });

    return contract;
  }

  // ─── CANCELLATION ───────────────────────────────────────────────────

  /**
   * Cancel a subscription. No future invoices after effective cancellation.
   */
  async cancelSubscription(subscriptionId: string): Promise<any> {
    const sub = await prisma.storefrontSubscription.findUniqueOrThrow({
      where: { id: subscriptionId },
    });

    if (sub.status === "CANCELLED" || sub.status === "EXPIRED") {
      throw new Error(`Subscription already ${sub.status}`);
    }

    // Deactivate active contract
    const contract = await this.getActiveContract(subscriptionId);
    if (contract) {
      await prisma.subscriptionContract.update({
        where: { id: contract.id },
        data: { isActive: false, effectiveTo: new Date() },
      });
    }

    // Update subscription status
    return prisma.storefrontSubscription.update({
      where: { id: subscriptionId },
      data: {
        status: "CANCELLED",
        cancelledAt: new Date(),
      },
    });
  }

  // ─── RENEWAL ────────────────────────────────────────────────────────

  /**
   * Generate next period invoice for an active subscription.
   * Idempotent: won't create duplicate for same period.
   */
  async renewSubscription(subscriptionId: string): Promise<InvoiceResult | null> {
    const sub = await prisma.storefrontSubscription.findUniqueOrThrow({
      where: { id: subscriptionId },
    });

    if (sub.status !== "ACTIVE") {
      return null;
    }

    const contract = await this.getActiveContract(subscriptionId);
    if (!contract) {
      return null;
    }

    // Next period starts at currentPeriodEnd
    const periodStart = sub.currentPeriodEnd;
    const periodDays = 30; // Default monthly
    const periodEnd = new Date(periodStart.getTime() + periodDays * 86400000);

    const result = await this.generateInvoice(
      contract.id,
      periodStart,
      periodEnd,
    );

    // Advance billing period
    await prisma.storefrontSubscription.update({
      where: { id: subscriptionId },
      data: {
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd,
      },
    });

    return result;
  }

  // ─── HELPERS ─────────────────────────────────────────────────────────

  private async nextCode(prefix: string): Promise<string> {
    const tableMap: Record<string, string> = {
      SC: "SubscriptionContract",
      SINV: "SubscriptionInvoice",
      SPAY: "SubscriptionPayment",
    };
    const table = tableMap[prefix] ?? "SubscriptionContract";
    const last = await prisma.$queryRaw<{ code: string }[]>(
      Prisma.sql`SELECT code FROM catalog.${Prisma.raw(`"${table}"`)}
        WHERE code LIKE ${prefix + "-%"}
        ORDER BY code DESC LIMIT 1`,
    );
    const lastNum =
      last.length > 0 ? parseInt(last[0].code.split("-").pop() ?? "0", 10) : 0;
    return `${prefix}-${String(lastNum + 1).padStart(8, "0")}`;
  }
}
