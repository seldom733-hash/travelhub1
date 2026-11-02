import { Prisma } from "../../generated/prisma/client";
import { toMoney2 } from "../sales/sales.money";
import { ValidationDomainError } from "../../shared/errors";

export interface PricingCalculationInput {
  supplierBasePrice: string;
  currency: string;
  markupRate: string;
  commissionType?: "PERCENT" | "FIXED" | "NONE";
  commissionRate?: string;
  commissionFixedAmount?: string;
  commissionBase?: "SUPPLIER_BASE" | "STOREFRONT";
}

export interface PricingCalculationResult {
  supplierBasePrice: string;
  currency: string;
  markupRate: string;
  markupAmount: string;
  storefrontPrice: string;
  commissionType: "PERCENT" | "FIXED" | "NONE";
  commissionRate: string | null;
  commissionAmount: string;
  netSupplierCost: string;
  platformGrossIncome: string;
}

/** Single backend calculation for storefront price, commission and net cost. */
export function calculateSupplierPricing(input: PricingCalculationInput): PricingCalculationResult {
  const base = toMoney2(input.supplierBasePrice, "supplierBasePrice");
  if (base.lessThanOrEqualTo(0)) throw new ValidationDomainError("supplierBasePrice must be > 0");
  const currency = input.currency?.trim().toUpperCase();
  if (!currency) throw new ValidationDomainError("currency is required");
  const markupRate = new Prisma.Decimal(input.markupRate || "0");
  if (markupRate.isNegative() || markupRate.greaterThanOrEqualTo(1)) {
    throw new ValidationDomainError("markupRate must be in [0, 1)");
  }
  const markupAmount = toMoney2(base.mul(markupRate), "markupAmount");
  const storefrontPrice = toMoney2(base.plus(markupAmount), "storefrontPrice");

  const commissionType = input.commissionType ?? "NONE";
  let commissionAmount = new Prisma.Decimal(0);
  let commissionRate: Prisma.Decimal | null = null;
  if (commissionType === "PERCENT") {
    commissionRate = new Prisma.Decimal(input.commissionRate ?? "0");
    if (commissionRate.isNegative() || commissionRate.greaterThanOrEqualTo(1)) {
      throw new ValidationDomainError("commissionRate must be in [0, 1)");
    }
    const commissionBase = input.commissionBase === "STOREFRONT" ? storefrontPrice : base;
    commissionAmount = toMoney2(commissionBase.mul(commissionRate), "commissionAmount");
  } else if (commissionType === "FIXED") {
    commissionAmount = toMoney2(input.commissionFixedAmount ?? "0", "commissionFixedAmount");
    if (commissionAmount.isNegative()) throw new ValidationDomainError("commissionAmount must be >= 0");
  }
  if (commissionAmount.greaterThan(base)) {
    throw new ValidationDomainError("commission cannot exceed supplier base price");
  }
  const netSupplierCost = toMoney2(base.minus(commissionAmount), "netSupplierCost");
  const platformGrossIncome = toMoney2(storefrontPrice.minus(netSupplierCost), "platformGrossIncome");

  return {
    supplierBasePrice: base.toString(),
    currency,
    markupRate: markupRate.toString(),
    markupAmount: markupAmount.toString(),
    storefrontPrice: storefrontPrice.toString(),
    commissionType,
    commissionRate: commissionRate?.toString() ?? null,
    commissionAmount: commissionAmount.toString(),
    netSupplierCost: netSupplierCost.toString(),
    platformGrossIncome: platformGrossIncome.toString(),
  };
}
