/**
 * Stage E — Deterministic Evidence-Based Impact
 *
 * Canonical Impact contract for Decision Intelligence.
 * Impact is derived on read from DecisionSignal evidence + authoritative domain data.
 * Same inputs + same rule version = same output (determinism).
 *
 * ABSOLUTE PROHIBITION: no fabricated monetary impact, no arbitrary severity thresholds,
 * no fake confidence percentages, no n × coefficient formulas.
 */

// ── Impact Status ────────────────────────────────────────────────────────────

/**
 * How complete/trustworthy is the impact assessment for this signal?
 * - PROVEN: all relevant dimensions have factual evidence
 * - PARTIALLY_PROVEN: some dimensions have evidence, others are insufficient
 * - INFORMATIONAL: factual scope data available, no adverse business impact demonstrated
 * - INSUFFICIENT_EVIDENCE: not enough data to assess any meaningful impact
 */
export type ImpactStatus =
  | "PROVEN"
  | "PARTIALLY_PROVEN"
  | "INFORMATIONAL"
  | "INSUFFICIENT_EVIDENCE";

// ── Impact Dimensions ────────────────────────────────────────────────────────

export type ImpactDimensionType =
  | "FINANCIAL"
  | "CUSTOMER"
  | "OPERATIONAL"
  | "PARTNER"
  | "SLA_TIME"
  | "SCOPE";

export type DimensionStrength =
  | "FACTUAL"       // directly provable from evidence/domain data
  | "DERIVED"       // computed from factual evidence
  | "NOT_PROVABLE"; // evidence insufficient

export interface ImpactDimension {
  type: ImpactDimensionType;
  /** Human-readable description of this impact dimension */
  label: string;
  /** i18n key for localized label resolution */
  labelKey: string;
  /** Structured params for i18n template interpolation */
  params: Record<string, string | number>;
  /** Factual value (number, string, etc.) */
  value: string | number;
  /** Unit (AZN, count, days, etc.) */
  unit?: string;
  /** Strength of this dimension's evidence */
  strength: DimensionStrength;
  /** References to source evidence keys */
  evidenceRefs: string[];
}

// ── Impact Summary ───────────────────────────────────────────────────────────

export interface ImpactSummary {
  /** Localized one-line summary of overall impact */
  text: string;
  /** i18n key for the summary text */
  textKey: string;
}

// ── Impact Rule Identity ─────────────────────────────────────────────────────

export interface ImpactRuleIdentity {
  ruleId: string;
  ruleVersion: string;
}

// ── Main Impact Contract ─────────────────────────────────────────────────────

export interface DecisionImpact {
  /** Overall impact assessment status */
  status: ImpactStatus;
  /** Individual impact dimensions (only meaningful ones) */
  dimensions: ImpactDimension[];
  /** Human-readable summary */
  summary: ImpactSummary;
  /** Rule identity for traceability */
  rule: ImpactRuleIdentity;
}

// ── Rule Catalog ─────────────────────────────────────────────────────────────

export interface ImpactRuleCatalogEntry {
  ruleId: string;
  signalCode: string;
  ruleVersion: string;
  dimensions: ImpactDimensionType[];
  description: string;
}

export const IMPACT_RULE_CATALOG: ImpactRuleCatalogEntry[] = [
  {
    ruleId: "IMPACT-PENDING-BOOKINGS-001",
    signalCode: "PENDING_BOOKINGS",
    ruleVersion: "1.0.0",
    dimensions: ["SCOPE", "CUSTOMER", "FINANCIAL", "SLA_TIME"],
    description: "Impact from bookings awaiting confirmation beyond SLA",
  },
  {
    ruleId: "IMPACT-FAILED-PAYMENTS-001",
    signalCode: "FAILED_PAYMENTS",
    ruleVersion: "1.0.0",
    dimensions: ["SCOPE", "CUSTOMER", "FINANCIAL"],
    description: "Impact from failed payment attempts",
  },
  {
    ruleId: "IMPACT-RECENT-CANCELLATIONS-001",
    signalCode: "RECENT_CANCELLATIONS",
    ruleVersion: "1.0.0",
    dimensions: ["SCOPE", "CUSTOMER", "FINANCIAL"],
    description: "Impact from recently cancelled orders",
  },
  {
    ruleId: "IMPACT-PENDING-REFUNDS-001",
    signalCode: "PENDING_REFUNDS",
    ruleVersion: "1.0.0",
    dimensions: ["SCOPE", "CUSTOMER", "FINANCIAL", "SLA_TIME"],
    description: "Impact from pending refund requests",
  },
  {
    ruleId: "IMPACT-UPCOMING-BOOKINGS-001",
    signalCode: "UPCOMING_BOOKINGS",
    ruleVersion: "1.0.0",
    dimensions: ["SCOPE", "CUSTOMER", "FINANCIAL"],
    description: "Informational impact from upcoming bookings",
  },
  {
    ruleId: "IMPACT-SERVICES-WITHOUT-SALES-001",
    signalCode: "SERVICES_WITHOUT_SALES",
    ruleVersion: "1.0.0",
    dimensions: ["SCOPE", "PARTNER", "OPERATIONAL"],
    description: "Impact from published services without sales",
  },
];
