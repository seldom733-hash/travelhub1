/**
 * Supplier Markup (STRICT PROMPT §20 / design §7) — commercial snapshot.
 *
 * Frozen commercial facts of a Request offer, in supplier currency (no FX §22):
 *
 *   supplierPrice → markupAmount → publicPrice
 *                 → individualDiscount → customerFinalPrice
 *
 * Mandatory invariants (design §14 / strict §12):
 *   customerFinalPrice >= supplierPrice
 *   supplierPrice > 0, currency present
 *   publicPrice = supplierPrice + markupAmount
 *   finalPrice = publicPrice - discountAmount
 *   individual discount does NOT alter publicPrice / MarkupRule
 *
 * Working state (customerAcceptedAt = null) is written by the pricing
 * boundary at request creation; freezeForAcceptance() seals it at
 * customerAccept (Gate F: accepted price immutable). All money math goes
 * through sales.money (single money-implementation, §8) — ValidationDomainError
 * on every rejection (422, never silent).
 *
 * This module is PURE (no DB / no Nest) — unit-testable.
 */
import { Prisma } from "../../generated/prisma/client";
import { QuoteDiscountType } from "../../generated/prisma/enums";
import { ValidationDomainError } from "../../shared/errors";
import {
  MoneyInput,
  discountAmountOf,
  toMoney2,
  totalOf,
  validateDiscountValue,
} from "../sales/sales.money";
import type { MarkupPricingJson } from "./pricing.types";

export type PriceSource = "PUBLIC" | "LIVE_SALES";

/**
 * UNIFIED FINANCE CENTER Phase 1: frozen FX conversion facts. When present,
 * supplierPrice/supplierCurrency keep the ORIGINAL source amount/currency
 * (immutable source facts) and markup/public/discount/final are denominated
 * in AZN (management currency); invariant becomes
 * publicPrice == fx.aznAmount + markupAmount and floor finalPrice >= fx.aznAmount.
 * Absent for AZN-sourced prices (customerCurrency = supplierCurrency, legacy).
 */
export interface FxSnapshot {
  sourceAmount: number;
  sourceCurrency: string;
  /** «1 sourceCurrency = rate AZN» as decimal string (≤6dp). */
  rate: string;
  /** SupplierFxRate.code (SFX-*) when available, null otherwise. */
  rateCode: string | null;
  /** Converted supplier cost in AZN (half-up 2dp). */
  aznAmount: number;
  /** ISO instant of the conversion. */
  convertedAt: string;
}

export interface CommercialSnapshot {
  supplierCode: string;
  serviceType: string;

  /** SOURCE supplier amount (original currency; see fx for conversion). */
  supplierPrice: number;
  supplierCurrency: string;

  markupRate: string;
  markupAmount: number;
  markupRuleCode: string | null;
  markupRuleVersion: number | null;

  publicPrice: number;

  individualDiscount: boolean;
  discountType: QuoteDiscountType;
  discountValue: number | null;
  discountAmount: number;

  customerFinalPrice: number;
  customerCurrency: string;

  priceSource: PriceSource;

  pricingCalculatedAt: string;
  supplierPriceFetchedAt: string | null;
  supplierPriceExpiresAt: string | null;
  /** null until customerAccept freezes the snapshot (Gate F). */
  customerAcceptedAt: string | null;

  /**
   * Present iff supplier price was converted to AZN (supplier-specific FX rate).
   * Source facts preserved; money chain (markup/public/final) in AZN.
   */
  fx?: FxSnapshot | null;
}

const iso = (value: string | Date | null | undefined): string | null =>
  value == null ? null : value instanceof Date ? value.toISOString() : String(value);

function requireCurrency(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim().length === 0 || value.trim().length > 16) {
    throw new ValidationDomainError(`missing currency: ${label} must be a non-empty currency code`);
  }
  return value.trim();
}

/**
 * Working snapshot from a boundary pricing block (MarkupPricingJson).
 * Gate E: missing/<=0 supplier price never becomes commercial money.
 */
export function buildWorkingSnapshot(input: {
  supplierCode: string;
  serviceType: string;
  pricing: MarkupPricingJson;
  priceSource?: PriceSource;
  supplierPriceFetchedAt?: string | Date | null;
  supplierPriceExpiresAt?: string | Date | null;
}): CommercialSnapshot {
  const p = input.pricing;
  if (p == null || p.supplierAmount == null || !Number.isFinite(Number(p.supplierAmount))) {
    throw new ValidationDomainError("missing supplier price: pricing block required to build commercial snapshot");
  }
  if (!(Number(p.supplierAmount) > 0)) {
    throw new ValidationDomainError("supplierPrice <= 0 is not a valid commercial price");
  }
  const supplierPrice = toMoney2(p.supplierAmount, "supplierPrice");
  const supplierCurrency = requireCurrency(p.currency, "supplierCurrency");
  const publicPrice = toMoney2(p.publicAmount, "publicPrice");
  const markupAmount = toMoney2(p.markupAmount, "markupAmount");
  let rate: Prisma.Decimal;
  try {
    rate = new Prisma.Decimal(String(p.markupRate));
  } catch {
    throw new ValidationDomainError(`invalid markup rate in pricing block: ${String(p.markupRate)}`);
  }
  if (rate.isNegative() || rate.greaterThanOrEqualTo(1)) {
    throw new ValidationDomainError(`invalid markup rate in pricing block: ${rate.toString()}`);
  }

  // UNIFIED FINANCE CENTER Phase 1: fx branch — invariant считается от
  // сконвертированного AZN-стоимости (convert-then-markup), а не от
  // SOURCE-суммы; customerCurrency — AZN (management currency).
  const fx: FxSnapshot | null = p.fx
    ? {
        sourceAmount: toMoney2(p.fx.sourceAmount, "fx.sourceAmount").toNumber(),
        sourceCurrency: requireCurrency(p.fx.sourceCurrency, "fx.sourceCurrency"),
        rate: String(p.fx.rate),
        rateCode: p.fx.rateCode ?? null,
        aznAmount: toMoney2(p.fx.aznAmount, "fx.aznAmount").toNumber(),
        convertedAt: iso(p.fx.convertedAt) ?? new Date().toISOString(),
      }
    : null;

  const markupBase = fx != null ? toMoney2(fx.aznAmount, "fx.aznAmount") : supplierPrice;
  if (!markupBase.plus(markupAmount).equals(publicPrice)) {
    throw new ValidationDomainError(
      `invalid public price: publicPrice (${publicPrice}) != ${fx != null ? "fx.aznAmount" : "supplierPrice"} (${markupBase}) + markupAmount (${markupAmount})`,
    );
  }
  if (publicPrice.lessThanOrEqualTo(0)) {
    throw new ValidationDomainError("invalid public price: must be greater than 0");
  }
  const customerCurrency = fx != null ? (p.publicCurrency ?? "AZN") : supplierCurrency;

  return {
    supplierCode: input.supplierCode,
    serviceType: input.serviceType,
    supplierPrice: Number(supplierPrice.toString()),
    supplierCurrency,
    markupRate: rate.toString(),
    markupAmount: Number(markupAmount.toString()),
    markupRuleCode: p.markupRuleCode ?? null,
    markupRuleVersion: p.markupRuleVersion ?? null,
    publicPrice: Number(publicPrice.toString()),
    individualDiscount: false,
    discountType: QuoteDiscountType.NONE,
    discountValue: null,
    discountAmount: 0,
    customerFinalPrice: Number(publicPrice.toString()),
    customerCurrency,
    priceSource: input.priceSource ?? "PUBLIC",
    pricingCalculatedAt: iso(p.calculatedAt) ?? new Date().toISOString(),
    supplierPriceFetchedAt: iso(input.supplierPriceFetchedAt),
    supplierPriceExpiresAt: iso(input.supplierPriceExpiresAt),
    customerAcceptedAt: null,
    ...(fx != null ? { fx } : {}),
  };
}

/**
 * Server-authoritative individual discount (§11): final = public - discount.
 * Reuses sales.money primitives (PERCENTAGE/FIXED, half-up 2dp).
 * Does NOT alter publicPrice / MarkupRule — floor is checked in validate.
 */
export function applyIndividualDiscount(
  snapshot: CommercialSnapshot,
  type: QuoteDiscountType,
  value?: MoneyInput | null,
): CommercialSnapshot {
  const discountValue = validateDiscountValue(type, value ?? null);
  const publicPrice = toMoney2(snapshot.publicPrice, "publicPrice");
  const discountAmount = discountAmountOf(publicPrice, type, discountValue);
  const finalPrice = totalOf(publicPrice, discountAmount);
  return {
    ...snapshot,
    individualDiscount: type !== QuoteDiscountType.NONE,
    discountType: type,
    discountValue: discountValue == null ? null : Number(discountValue.toString()),
    discountAmount: Number(discountAmount.toString()),
    customerFinalPrice: Number(finalPrice.toString()),
  };
}

/**
 * Acceptance gate (§13 / design Phase 3). Rejects:
 *   missing supplier price / supplierPrice <= 0 / missing currency /
 *   invalid public price / invalid final price / final price < supplier price.
 * `acceptedMoney` (confirmed proposal or snapshot final) is validated too.
 */
export function validateForAcceptance(
  snapshot: CommercialSnapshot,
  acceptedMoney?: MoneyInput | null,
  acceptedCurrency?: string | null,
): void {
  if (snapshot == null) {
    throw new ValidationDomainError("missing supplier price: commercial snapshot required for acceptance");
  }
  if (snapshot.supplierPrice == null || !Number.isFinite(Number(snapshot.supplierPrice))) {
    throw new ValidationDomainError("missing supplier price");
  }
  if (!(Number(snapshot.supplierPrice) > 0)) {
    throw new ValidationDomainError("supplierPrice <= 0 is not a valid commercial price");
  }
  const supplierPrice = toMoney2(snapshot.supplierPrice, "supplierPrice");
  requireCurrency(snapshot.supplierCurrency, "supplierCurrency");
  requireCurrency(snapshot.customerCurrency, "customerCurrency");

  if (snapshot.publicPrice == null || !Number.isFinite(Number(snapshot.publicPrice))) {
    throw new ValidationDomainError("invalid public price: missing");
  }
  const publicPrice = toMoney2(snapshot.publicPrice, "publicPrice");
  if (publicPrice.lessThanOrEqualTo(0)) {
    throw new ValidationDomainError("invalid public price: must be greater than 0");
  }
  const markupAmount = toMoney2(snapshot.markupAmount ?? 0, "markupAmount");

  // UNIFIED FINANCE CENTER Phase 1: fx branch — invariant/floor считаются от
  // сконвертированного AZN-стоимости (money chain в AZN при наличии fx).
  const fx = snapshot.fx ?? null;
  const markupBase = fx != null ? toMoney2(fx.aznAmount, "fx.aznAmount") : supplierPrice;
  if (!markupBase.plus(markupAmount).equals(publicPrice)) {
    throw new ValidationDomainError(
      `invalid public price: publicPrice (${publicPrice}) != ${fx != null ? "fx.aznAmount" : "supplierPrice"} (${markupBase}) + markupAmount (${markupAmount})`,
    );
  }

  // Discount must be recomputed server-side (§31) — snapshot math is verified,
  // never trusted as-is.
  const expectedDiscount = discountAmountOf(
    publicPrice,
    snapshot.discountType ?? QuoteDiscountType.NONE,
    snapshot.discountValue == null ? null : toMoney2(snapshot.discountValue, "discountValue"),
  );
  const discountAmount = toMoney2(snapshot.discountAmount ?? 0, "discountAmount");
  if (!discountAmount.equals(expectedDiscount)) {
    throw new ValidationDomainError(
      `invalid final price: discountAmount (${discountAmount}) inconsistent with discount type/value`,
    );
  }
  const expectedFinal = totalOf(publicPrice, discountAmount);
  if (snapshot.customerFinalPrice == null || !Number.isFinite(Number(snapshot.customerFinalPrice))) {
    throw new ValidationDomainError("invalid final price: missing");
  }
  const finalPrice = toMoney2(snapshot.customerFinalPrice, "customerFinalPrice");
  if (!finalPrice.equals(expectedFinal)) {
    throw new ValidationDomainError(
      `invalid final price: finalPrice (${finalPrice}) != publicPrice (${publicPrice}) - discountAmount (${discountAmount})`,
    );
  }
  if (finalPrice.lessThanOrEqualTo(0)) {
    throw new ValidationDomainError("invalid final price: must be greater than 0");
  }

  // Mandatory floor (§12 / design §14): при fx — флоор по AZN-стоимости
  // (markupBase), без fx — по SOURCE supplierPrice (легаси).
  if (finalPrice.lessThan(markupBase)) {
    throw new ValidationDomainError(
      `final price < supplier price: finalPrice (${finalPrice}) < ${fx != null ? "fx.aznAmount" : "supplierPrice"} (${markupBase})`,
    );
  }

  if (acceptedMoney !== undefined && acceptedMoney !== null) {
    const accepted = toMoney2(acceptedMoney, "acceptedMoney");
    if (accepted.lessThanOrEqualTo(0)) {
      throw new ValidationDomainError("invalid final price: accepted money must be greater than 0");
    }
    if (accepted.lessThan(markupBase)) {
      throw new ValidationDomainError(
        `final price < supplier price: accepted money (${accepted}) < ${fx != null ? "fx.aznAmount" : "supplierPrice"} (${markupBase})`,
      );
    }
  }
  if (acceptedCurrency !== undefined && acceptedCurrency !== null) {
    requireCurrency(acceptedCurrency, "acceptedCurrency");
  }
}

/**
 * Freeze at customerAccept (Gate F): validates then stamps the acceptance
 * instant and the accepted final money. Result is immutable.
 */
export function freezeForAcceptance(
  snapshot: CommercialSnapshot,
  acceptedMoney: MoneyInput,
  acceptedCurrency: string | null | undefined,
  at: Date,
): CommercialSnapshot {
  validateForAcceptance(snapshot, acceptedMoney, acceptedCurrency ?? snapshot.customerCurrency);
  const finalPrice = toMoney2(acceptedMoney, "acceptedMoney");
  return {
    ...snapshot,
    customerFinalPrice: Number(finalPrice.toString()),
    customerCurrency: requireCurrency(acceptedCurrency ?? snapshot.customerCurrency, "customerCurrency"),
    customerAcceptedAt: at.toISOString(),
  };
}
