// ─── WHY Attribution Types (Stage D) ────────────────────────────────────────
// Deterministic, evidence-based, auditable WHY Attribution contract.
// WHY is derived on read from DecisionSignal evidence + deterministic rules.
// DecisionSignal remains the single source of truth — no second signal engine.
//
// Storage decision: WHY derived on read.
// Rationale: same evidence + same rule version = same WHY (determinism invariant).
// Re-observation updates evidence → WHY recomputes naturally on next read.
// Legacy/resolved/dismissed signals get safe INSUFFICIENT_EVIDENCE by default
// unless evidence snapshot is sufficient for attribution.
// Historical correctness: evidence is captured at detection time, rule version
// is stable, so re-reading a historical signal produces the same WHY.

// ── Attribution Status ───────────────────────────────────────────────────────
// Maps directly to claim strength for UI wording.

export type WhyStatus =
  | "PROVEN_CAUSE"
  | "OBSERVED_DRIVER"
  | "CONTRIBUTING_FACTOR"
  | "INSUFFICIENT_EVIDENCE";

// ── Evidence Strength ────────────────────────────────────────────────────────
// Factual strength descriptor — NOT a percentage/confidence score.

export type EvidenceStrength = "strong" | "moderate" | "weak" | "none";

// ── Why Rule Identity ────────────────────────────────────────────────────────
// Each attribution rule has stable identity + version for traceability.

export interface WhyRuleIdentity {
  ruleId: string;
  ruleVersion: string;
}

// ── Primary Driver ───────────────────────────────────────────────────────────
// The single most explanatory factual driver, if derivable.

export interface WhyPrimaryDriver {
  /** Localized display text key (resolved via i18n, NOT raw rule ID). */
  textKey: string;
  /** Factual value from evidence (e.g. "DECLINED", "3 из 4", "240 мин"). */
  factualValue: string | number;
  /** Evidence keys that support this driver. */
  evidenceRefs: string[];
}

// ── Contributing Factor ──────────────────────────────────────────────────────
// Additional factual factors that explain part of the signal.

export interface WhyContributingFactor {
  textKey: string;
  factualValue: string | number;
  evidenceRefs: string[];
}

// ── WHY Attribution (API Response Shape) ─────────────────────────────────────
// Derived on read from DecisionSignal.evidence + deterministic rules.
// NOT persisted in DB — recomputed each read from stable evidence.

export interface WhyAttribution {
  /** Attribution status / claim strength. */
  status: WhyStatus;

  /** Primary driver — most explanatory factual factor. Optional: may be absent
   *  even for OBSERVED_DRIVER (multiple co-primary drivers). */
  primaryDriver?: WhyPrimaryDriver;

  /** Additional factual contributing factors. Deterministic order. */
  contributingFactors: WhyContributingFactor[];

  /** Factual evidence strength assessment. NOT a confidence percentage. */
  evidenceStrength: EvidenceStrength;

  /** Evidence keys from SignalEvidenceItem that support this WHY. */
  evidenceRefs: string[];

  /** Rule that produced this attribution. For audit traceability. */
  rule: WhyRuleIdentity;
}

// ── Detector-specific Evidence Shapes (for WHY derivation) ───────────────────
// Enriched evidence fields that detectors optionally provide.

export interface FailedPaymentEvidenceExtra {
  /** Grouped by failure code: [{code: "DECLINED", count: 3}, ...] */
  failureCodeGroups?: Array<{ code: string; count: number }>;
}

export interface CancellationEvidenceExtra {
  /** Grouped by cancellation reason if available. */
  cancellationReasonGroups?: Array<{ reason: string; count: number }>;
  /** Orders cancelled by partner vs buyer vs system. */
  cancelledByGroups?: Array<{ by: string; count: number }>;
}

export interface ServicesWithoutSalesEvidenceExtra {
  /** Products without sales but not published long enough. */
  recentlyPublishedCount?: number;
  /** Products published > 30 days without sales. */
  longTermUnsoldCount?: number;
  /** Products with availability configured. */
  withAvailabilityCount?: number;
  /** Products without availability. */
  withoutAvailabilityCount?: number;
}

// ── Signal Code → Attribution Applicability ───────────────────────────────────
// Defines which signal codes have deterministic WHY rules.

export const WHY_RULE_CATALOG: Array<
  WhyRuleIdentity & {
    signalCode: string;
    description: string;
  }
> = [
  {
    ruleId: "why.booking.confirmation.sla",
    ruleVersion: "1.0.0",
    signalCode: "BOOKING_CONFIRMATION_DELAY",
    description: "WHY for booking confirmation SLA breach based on observation age and count",
  },
  {
    ruleId: "why.payment.failure.grouped",
    ruleVersion: "1.0.0",
    signalCode: "FAILED_PAYMENTS",
    description: "WHY for failed payments based on dominant failure code grouping",
  },
  {
    ruleId: "why.cancellation.recent",
    ruleVersion: "1.0.0",
    signalCode: "RECENT_CANCELLATIONS",
    description: "WHY for recent cancellations based on reason/cancelledBy grouping if available",
  },
  {
    ruleId: "why.refund.pending",
    ruleVersion: "1.0.0",
    signalCode: "PENDING_REFUNDS",
    description: "WHY for pending refunds — usually INSUFFICIENT_EVIDENCE (no root cause in evidence)",
  },
  {
    ruleId: "why.booking.upcoming",
    ruleVersion: "1.0.0",
    signalCode: "UPCOMING_BOOKINGS",
    description: "WHY for upcoming bookings — informational signal, INSUFFICIENT_EVIDENCE for negative cause",
  },
  {
    ruleId: "why.catalog.unsold",
    ruleVersion: "1.0.0",
    signalCode: "SERVICES_WITHOUT_SALES",
    description: "WHY for services without sales based on publication/availability/catalog state",
  },
];
