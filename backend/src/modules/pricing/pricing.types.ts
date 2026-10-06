/**
 * Supplier Markup (STRICT PROMPT §20) — JSON-safe markup breakdown.
 *
 * Attached (`pricing`) to every public boundary response whose amount was
 * transformed by SupplierPricingService. Preserves the supplier price
 * separately (§9/§16): `amount` carries the PUBLIC price, `supplierAmount`
 * keeps the raw supplier value the public price was computed from.
 *
 * Plain numbers/strings only — survives JSON serialization (Prisma.Decimal
 * must never leak into HTTP responses).
 */
export interface MarkupPricingJson {
  /** Raw supplier amount the public price was computed from. */
  supplierAmount: number;
  /** Currency of both amounts (no FX — §22). */
  currency: string;
  /** Applied markup rate as decimal string, e.g. "0.05". */
  markupRate: string;
  /** publicAmount - supplierAmount (half-up to 2dp). */
  markupAmount: number;
  /** The selling price (= boundary `amount`). */
  publicAmount: number;
  /** MarkupRule.code used for the calculation (null when NOT_CONFIGURED). */
  markupRuleCode: string | null;
  /** MarkupRule.version used for the calculation (null when NOT_CONFIGURED). */
  markupRuleVersion: number | null;
  /** CONFIGURED | NOT_CONFIGURED (§7 — distinguishable at runtime). */
  configurationState: "CONFIGURED" | "NOT_CONFIGURED";
  /** ISO timestamp of the calculation. */
  calculatedAt: string;
}
