/**
 * Stage E — Deterministic Evidence-Based Impact Computation Service
 *
 * Computes Impact from DecisionSignal evidence + deterministic rules.
 * Same inputs + same rule version = same output (determinism).
 *
 * Labels use i18n keys — NO hardcoded language in backend.
 * Frontend resolves keys through i18n dictionary.
 *
 * ABSOLUTE PROHIBITIONS:
 * - No fabricated monetary impact (count × coefficient)
 * - No arbitrary severity thresholds (count > N = HIGH)
 * - No fake confidence percentages
 * - No lost revenue/loss/profit claims without canonical proof
 */

import {
  type DecisionImpact,
  type ImpactDimension,
  type ImpactDimensionType,
  type ImpactStatus,
  type ImpactSummary,
} from "./impact-attribution.types";

// ── Types ───────────────────────────────────────────────────────────────────

type EvidenceItem = { key: string; value: string | number | string[] };

// ── Helpers ─────────────────────────────────────────────────────────────────

function findNum(evidence: EvidenceItem[], key: string): number | null {
  const ev = evidence.find((e) => e.key === key);
  if (!ev) return null;
  const n = Number(ev.value);
  return Number.isFinite(n) ? n : null;
}

function findStr(evidence: EvidenceItem[], key: string): string | null {
  const ev = evidence.find((e) => e.key === key);
  if (!ev) return null;
  return String(ev.value);
}

function findArray(evidence: EvidenceItem[], key: string): string[] | null {
  const ev = evidence.find((e) => e.key === key);
  if (!ev) return null;
  if (Array.isArray(ev.value)) return ev.value.map(String);
  return null;
}

/** Build a count dimension with i18n labelKey */
function countDimension(
  type: ImpactDimensionType,
  labelKey: string,
  params: Record<string, string | number>,
  count: number,
  refs: string[],
): ImpactDimension {
  return {
    type,
    label: labelKey, // placeholder — frontend resolves via i18n
    labelKey,
    params,
    value: count,
    unit: "count",
    strength: "FACTUAL",
    evidenceRefs: refs,
  };
}

/** Build a numeric dimension with i18n labelKey */
function numDimension(
  type: ImpactDimensionType,
  labelKey: string,
  params: Record<string, string | number>,
  value: number,
  unit: string,
  refs: string[],
): ImpactDimension {
  return {
    type,
    label: labelKey, // placeholder
    labelKey,
    params,
    value: Math.round(value * 100) / 100,
    unit,
    strength: "FACTUAL",
    evidenceRefs: refs,
  };
}

/** Build a text dimension with i18n labelKey */
function textDimension(
  type: ImpactDimensionType,
  labelKey: string,
  params: Record<string, string | number>,
  value: string | number,
  refs: string[],
): ImpactDimension {
  return {
    type,
    label: labelKey, // placeholder
    labelKey,
    params,
    value,
    strength: "FACTUAL",
    evidenceRefs: refs,
  };
}

// ── Per-Signal Impact Rules ─────────────────────────────────────────────────

function impactPendingBookings(evidence: EvidenceItem[]): DecisionImpact {
  const count = findNum(evidence, "pendingConfirmationCount") ?? 0;
  const oldestMin = findNum(evidence, "oldestPendingMinutes") ?? 0;
  const gmv = findNum(evidence, "affectedGmv") ?? 0;
  const slaMin = findNum(evidence, "slaThresholdMinutes") ?? 240;

  const dimensions: ImpactDimension[] = [];

  if (count > 0) {
    dimensions.push(countDimension("SCOPE", "cc.impact.pending_bookings.count", { count }, count, [
      "pendingConfirmationCount",
    ]));
  }

  if (gmv > 0) {
    dimensions.push(numDimension("FINANCIAL", "cc.impact.pending_bookings.gmv", { amount: gmv }, gmv, "AZN", [
      "affectedGmv",
    ]));
  }

  if (oldestMin > 0) {
    const breachCount = oldestMin > slaMin ? count : 0;
    dimensions.push({
      type: "SLA_TIME",
      label: "cc.impact.pending_bookings.sla",
      labelKey: breachCount > 0
        ? "cc.impact.pending_bookings.sla_breach"
        : "cc.impact.pending_bookings.oldest_wait",
      params: breachCount > 0
        ? { count, slaMinutes: slaMin, oldestMinutes: oldestMin }
        : { oldestMinutes: oldestMin },
      value: oldestMin,
      unit: "minutes",
      strength: "FACTUAL",
      evidenceRefs: ["oldestPendingMinutes", "slaThresholdMinutes"],
    });
  }

  let status: ImpactStatus = "INSUFFICIENT_EVIDENCE";
  if (dimensions.length > 0) {
    status = count > 0 && gmv > 0 ? "PROVEN" : "PARTIALLY_PROVEN";
  }

  return buildImpact(status, dimensions, "IMPACT-PENDING-BOOKINGS-001", "1.0.0", {
    textKey: "cc.impact.pending_bookings.summary",
    text: `${count} bookings pending confirmation`, // placeholder — frontend resolves
  });
}

function impactFailedPayments(evidence: EvidenceItem[]): DecisionImpact {
  const count = findNum(evidence, "failedCount") ?? 0;
  const oldestMin = findNum(evidence, "oldestFailedMinutes") ?? 0;
  const amount = findNum(evidence, "totalFailedAmount") ?? 0;
  const groups = findStr(evidence, "paymentMethodGroups") ?? "";

  const dimensions: ImpactDimension[] = [];

  if (count > 0) {
    dimensions.push(countDimension("SCOPE", "cc.impact.failed_payments.count", { count }, count, ["failedCount"]));
  }

  if (amount > 0) {
    dimensions.push(numDimension("FINANCIAL", "cc.impact.failed_payments.amount", { amount }, amount, "AZN", [
      "totalFailedAmount",
    ]));
  }

  if (groups) {
    // Parse payment method distribution for display
    const parsed = groups.split(";").map((g) => {
      const [method, cnt] = g.split(":");
      return { method, count: Number(cnt) || 0 };
    });
    const dominant = parsed.sort((a, b) => b.count - a.count)[0];
    dimensions.push({
      type: "OPERATIONAL",
      label: "cc.impact.failed_payments.methods",
      labelKey: "cc.impact.failed_payments.methods",
      params: {
        dominantMethod: dominant?.method ?? "",
        dominantCount: dominant?.count ?? 0,
        totalCount: count,
        distribution: groups,
      },
      value: groups,
      strength: "FACTUAL",
      evidenceRefs: ["paymentMethodGroups"],
    });
  }

  if (oldestMin > 0) {
    dimensions.push({
      type: "SLA_TIME",
      label: "cc.impact.failed_payments.oldest",
      labelKey: "cc.impact.failed_payments.oldest",
      params: { minutes: oldestMin },
      value: oldestMin,
      unit: "minutes",
      strength: "FACTUAL",
      evidenceRefs: ["oldestFailedMinutes"],
    });
  }

  let status: ImpactStatus = "INSUFFICIENT_EVIDENCE";
  if (dimensions.length > 0) {
    status = count > 0 && amount > 0 ? "PROVEN" : "PARTIALLY_PROVEN";
  }

  return buildImpact(status, dimensions, "IMPACT-FAILED-PAYMENTS-001", "1.0.0", {
    textKey: "cc.impact.failed_payments.summary",
    text: `${count} failed payments`,
  });
}

function impactRecentCancellations(evidence: EvidenceItem[]): DecisionImpact {
  const count = findNum(evidence, "cancellationCount") ?? 0;
  const oldestMin = findNum(evidence, "oldestCancellationMinutes") ?? 0;
  const gmv = findNum(evidence, "affectedGmv") ?? 0;
  const periodDays = findNum(evidence, "periodDays") ?? 0;

  const dimensions: ImpactDimension[] = [];

  if (count > 0) {
    dimensions.push(countDimension("SCOPE", "cc.impact.recent_cancellations.count", { count }, count, [
      "cancellationCount",
    ]));
  }

  if (gmv > 0) {
    dimensions.push(
      numDimension("FINANCIAL", "cc.impact.recent_cancellations.gmv", { amount: gmv }, gmv, "AZN", ["affectedGmv"]),
    );
  }

  if (periodDays > 0) {
    dimensions.push({
      type: "SLA_TIME",
      label: "cc.impact.recent_cancellations.period",
      labelKey: "cc.impact.recent_cancellations.period",
      params: { days: periodDays },
      value: periodDays,
      unit: "days",
      strength: "FACTUAL",
      evidenceRefs: ["periodDays"],
    });
  }

  if (oldestMin > 0) {
    dimensions.push({
      type: "SLA_TIME",
      label: "cc.impact.recent_cancellations.oldest",
      labelKey: "cc.impact.recent_cancellations.oldest",
      params: { minutes: oldestMin },
      value: oldestMin,
      unit: "minutes",
      strength: "FACTUAL",
      evidenceRefs: ["oldestCancellationMinutes"],
    });
  }

  let status: ImpactStatus = "INSUFFICIENT_EVIDENCE";
  if (dimensions.length > 0) {
    status = count > 0 ? "PARTIALLY_PROVEN" : "INFORMATIONAL";
  }

  return buildImpact(status, dimensions, "IMPACT-RECENT-CANCELLATIONS-001", "1.0.0", {
    textKey: "cc.impact.recent_cancellations.summary",
    text: `${count} cancellations`,
  });
}

function impactPendingRefunds(evidence: EvidenceItem[]): DecisionImpact {
  const count = findNum(evidence, "pendingRefundCount") ?? 0;
  const oldestMin = findNum(evidence, "oldestPendingMinutes") ?? 0;
  const amount = findNum(evidence, "totalRefundAmount") ?? 0;

  const dimensions: ImpactDimension[] = [];

  if (count > 0) {
    dimensions.push(countDimension("SCOPE", "cc.impact.pending_refunds.count", { count }, count, [
      "pendingRefundCount",
    ]));
  }

  if (amount > 0) {
    dimensions.push(numDimension("FINANCIAL", "cc.impact.pending_refunds.amount", { amount }, amount, "AZN", [
      "totalRefundAmount",
    ]));
  }

  if (oldestMin > 0) {
    dimensions.push({
      type: "SLA_TIME",
      label: "cc.impact.pending_refunds.oldest",
      labelKey: "cc.impact.pending_refunds.oldest",
      params: { minutes: oldestMin },
      value: oldestMin,
      unit: "minutes",
      strength: "FACTUAL",
      evidenceRefs: ["oldestPendingMinutes"],
    });
  }

  let status: ImpactStatus = "INSUFFICIENT_EVIDENCE";
  if (dimensions.length > 0) {
    status = count > 0 && amount > 0 ? "PROVEN" : "PARTIALLY_PROVEN";
  }

  return buildImpact(status, dimensions, "IMPACT-PENDING-REFUNDS-001", "1.0.0", {
    textKey: "cc.impact.pending_refunds.summary",
    text: `${count} pending refunds`,
  });
}

function impactUpcomingBookings(evidence: EvidenceItem[]): DecisionImpact {
  const count = findNum(evidence, "upcomingCount") ?? 0;
  const gmv = findNum(evidence, "totalUpcomingGmv") ?? 0;

  const dimensions: ImpactDimension[] = [];

  if (count > 0) {
    dimensions.push(countDimension("SCOPE", "cc.impact.upcoming_bookings.count", { count }, count, ["upcomingCount"]));
  }

  if (gmv > 0) {
    dimensions.push(
      numDimension("FINANCIAL", "cc.impact.upcoming_bookings.gmv", { amount: gmv }, gmv, "AZN", ["totalUpcomingGmv"]),
    );
  }

  let status: ImpactStatus = "INFORMATIONAL";
  if (dimensions.length === 0) {
    status = "INSUFFICIENT_EVIDENCE";
  }

  return buildImpact(status, dimensions, "IMPACT-UPCOMING-BOOKINGS-001", "1.0.0", {
    textKey: "cc.impact.upcoming_bookings.summary",
    text: `${count} upcoming bookings`,
  });
}

function impactServicesWithoutSales(evidence: EvidenceItem[]): DecisionImpact {
  const unsoldCount = findNum(evidence, "unsoldProductCount") ?? 0;
  const withAvail = findNum(evidence, "withAvailabilityCount") ?? 0;
  const withoutAvail = findNum(evidence, "withoutAvailabilityCount") ?? 0;
  const recentCount = findNum(evidence, "recentlyPublishedCount") ?? 0;
  const longTermCount = findNum(evidence, "longTermUnsoldCount") ?? 0;

  const dimensions: ImpactDimension[] = [];

  if (unsoldCount > 0) {
    dimensions.push(countDimension("SCOPE", "cc.impact.services_without_sales.count", { count: unsoldCount }, unsoldCount, [
      "unsoldProductCount",
    ]));
  }

  if (withoutAvail > 0 || withAvail > 0) {
    dimensions.push({
      type: "OPERATIONAL",
      label: "cc.impact.services_without_sales.availability",
      labelKey: "cc.impact.services_without_sales.availability",
      params: { withoutAvail, withAvail },
      value: `${withoutAvail}/${withAvail}`,
      strength: "FACTUAL",
      evidenceRefs: ["withoutAvailabilityCount", "withAvailabilityCount"],
    });
  }

  if (recentCount > 0 || longTermCount > 0) {
    dimensions.push({
      type: "OPERATIONAL",
      label: "cc.impact.services_without_sales.publication",
      labelKey: "cc.impact.services_without_sales.publication",
      params: { recentCount, longTermCount },
      value: recentCount + longTermCount,
      unit: "count",
      strength: "FACTUAL",
      evidenceRefs: ["recentlyPublishedCount", "longTermUnsoldCount"],
    });
  }

  let status: ImpactStatus = "INSUFFICIENT_EVIDENCE";
  if (dimensions.length > 0) {
    status = unsoldCount > 0 ? "PARTIALLY_PROVEN" : "INFORMATIONAL";
  }

  return buildImpact(status, dimensions, "IMPACT-SERVICES-WITHOUT-SALES-001", "1.0.0", {
    textKey: "cc.impact.services_without_sales.summary",
    text: `${unsoldCount} services without sales`,
  });
}

// ── Shared Helpers ──────────────────────────────────────────────────────────

function buildImpact(
  status: ImpactStatus,
  dimensions: ImpactDimension[],
  ruleId: string,
  ruleVersion: string,
  summary: ImpactSummary,
): DecisionImpact {
  return {
    status,
    dimensions,
    summary,
    rule: { ruleId, ruleVersion },
  };
}

// ── Main Service ────────────────────────────────────────────────────────────

export class ImpactAttributionService {
  private readonly computors = new Map<string, (evidence: EvidenceItem[]) => DecisionImpact>();

  constructor() {
    this.computors.set("PENDING_BOOKINGS", impactPendingBookings);
    this.computors.set("BOOKING_CONFIRMATION_DELAY", impactPendingBookings);
    this.computors.set("FAILED_PAYMENTS", impactFailedPayments);
    this.computors.set("RECENT_CANCELLATIONS", impactRecentCancellations);
    this.computors.set("PENDING_REFUNDS", impactPendingRefunds);
    this.computors.set("UPCOMING_BOOKINGS", impactUpcomingBookings);
    this.computors.set("SERVICES_WITHOUT_SALES", impactServicesWithoutSales);
  }

  computeImpact(signalCode: string, evidence: EvidenceItem[]): DecisionImpact | null {
    const computor = this.computors.get(signalCode);
    if (!computor) return null;
    try {
      return computor(evidence);
    } catch {
      return {
        status: "INSUFFICIENT_EVIDENCE",
        dimensions: [],
        summary: { textKey: "cc.impact.computation_error", text: "Impact computation error" },
        rule: { ruleId: "UNKNOWN", ruleVersion: "0.0.0" },
      };
    }
  }

  hasRule(signalCode: string): boolean {
    return this.computors.has(signalCode);
  }
}
