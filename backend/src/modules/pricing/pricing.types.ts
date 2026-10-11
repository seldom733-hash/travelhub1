/**
 * Supplier Markup (STRICT PROMPT §20) — JSON-safe markup breakdown.
 *
 * Attached (`pricing`) to every public boundary response whose amount was
 * transformed by SupplierPricingService. Preserves the supplier price
 * separately (§9/§16): `amount` carries the PUBLIC price, `supplierAmount`
 * keeps the raw supplier value the public price was computed from.
 *
 * UNIFIED FINANCE CENTER Phase 1 (FX): когда supplier-цена была сконвертирована
 * в AZN (supplier-specific курс «1 source = N AZN»), pricing-блок получает
 * опциональный `fx`-снапшот (source amount/currency, rate, aznAmount,
 * convertedAt) и `publicCurrency` = "AZN" — invariant
 * `publicAmount == fx.aznAmount + markupAmount` (convert-then-markup).
 * Без fx (историческое поведение / AZN-источник): `publicCurrency`
 * отсутствует, `currency` = валюта обеих сумм (no-FX §22).
 *
 * Plain numbers/strings only — survives JSON serialization (Prisma.Decimal
 * must never leak into HTTP responses).
 */
export interface MarkupPricingJson {
  /** Raw supplier amount the public price was computed from (SOURCE currency). */
  supplierAmount: number;
  /** Currency of `supplierAmount` (SOURCE currency of the supplier offer). */
  currency: string;
  /** Applied markup rate as decimal string, e.g. "0.05". */
  markupRate: string;
  /** publicAmount - supplierAmount в publicCurrency (half-up to 2dp). */
  markupAmount: number;
  /** The selling price (= boundary `amount`), in publicCurrency. */
  publicAmount: number;
  /** MarkupRule.code used for the calculation (null when NOT_CONFIGURED). */
  markupRuleCode: string | null;
  /** MarkupRule.version used for the calculation (null when NOT_CONFIGURED). */
  markupRuleVersion: number | null;
  /** CONFIGURED | NOT_CONFIGURED (§7 — distinguishable at runtime). */
  configurationState: "CONFIGURED" | "NOT_CONFIGURED";
  /** ISO timestamp of the calculation. */
  calculatedAt: string;

  /**
   * UNIFIED FINANCE CENTER Phase 1: present iff supplier price was converted
   * to AZN via a supplier-specific FX rate (convert-then-markup). Preserves
   * SOURCE facts alongside the AZN management equivalent (Confirmed decision:
   * «preserve original amount and currency alongside the AZN equivalent»).
   * Absent for AZN-sourced prices and for browse fail-open (no rate).
   */
  fx?: {
    /** Original supplier amount in sourceCurrency (immutable source fact). */
    sourceAmount: number;
    /** Original supplier currency (immutable source fact). */
    sourceCurrency: string;
    /** «1 sourceCurrency = rate AZN» as decimal string (≤6dp). */
    rate: string;
    /** SupplierFxRate.code reference when available (SFX-*), null if none. */
    rateCode: string | null;
    /** Converted supplier cost in AZN (half-up 2dp). */
    aznAmount: number;
    /** ISO timestamp of the conversion. */
    convertedAt: string;
  };
  /**
   * Currency of `publicAmount`/`markupAmount`. Equals `currency` when fx is
   * absent (no-FX legacy); "AZN" when fx conversion applied. Kept optional
   * for backwards compatibility with existing consumers.
   */
  publicCurrency?: string;
}
