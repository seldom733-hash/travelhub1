// ─── WHY Attribution Service (Stage D) ───────────────────────────────────────
// Deterministic, evidence-based WHY attribution engine.
// WHY is derived on read: same evidence + same rule version = same output.
// DecisionSignal remains the single source of truth.
//
// Invariants:
// - Deterministic: DB row ordering does not affect result.
// - Tie handling: co-primary via stable alphabetical ordering of codes.
// - Missing/null/legacy evidence → INSUFFICIENT_EVIDENCE (never crash/fabricate).
// - No arbitrary confidence percentages or causal thresholds.
// - Rules are versioned with stable identity.
// - No N+1: WHY computed in batch from pre-fetched evidence.

import { Injectable } from "@nestjs/common";
import type {
  WhyAttribution,
  WhyStatus,
  EvidenceStrength,
  WhyPrimaryDriver,
  WhyContributingFactor,
  WhyRuleIdentity,
} from "./why-attribution.types";
import { WHY_RULE_CATALOG } from "./why-attribution.types";
import type { SignalEvidenceItem } from "./decision-signal.types";

@Injectable()
export class WhyAttributionService {
  /**
   * Compute deterministic WHY attribution for a signal code + evidence array.
   * Pure function: same inputs → same output (determinism invariant).
   */
  computeAttribution(
    signalCode: string,
    evidence: SignalEvidenceItem[],
  ): WhyAttribution | null {
    const rule = WHY_RULE_CATALOG.find((r) => r.signalCode === signalCode);
    if (!rule) {
      // Unknown signal code — safe fallback, not crash
      return this.insufficientEvidence(rule ?? { ruleId: "unknown", ruleVersion: "0.0.0" });
    }

    switch (signalCode) {
      case "BOOKING_CONFIRMATION_DELAY":
        return this.attrBookingConfirmationDelay(evidence, rule);
      case "FAILED_PAYMENTS":
        return this.attrFailedPayments(evidence, rule);
      case "RECENT_CANCELLATIONS":
        return this.attrRecentCancellations(evidence, rule);
      case "PENDING_REFUNDS":
        return this.attrPendingRefunds(evidence, rule);
      case "UPCOMING_BOOKINGS":
        return this.attrUpcomingBookings(evidence, rule);
      case "SERVICES_WITHOUT_SALES":
        return this.attrServicesWithoutSales(evidence, rule);
      default:
        return this.insufficientEvidence(rule);
    }
  }

  // ── BOOKING_CONFIRMATION_DELAY ──────────────────────────────────────────

  private attrBookingConfirmationDelay(
    evidence: SignalEvidenceItem[],
    rule: WhyRuleIdentity,
  ): WhyAttribution {
    const count = this.findNum(evidence, "pendingConfirmationCount");
    const oldestMinutes = this.findNum(evidence, "oldestPendingMinutes");

    // If no evidence → insufficient
    if (count === null) {
      return this.insufficientEvidence(rule);
    }

    // OBSERVED_DRIVER: factual observation of SLA breach duration
    const primaryDriver: WhyPrimaryDriver = {
      textKey: "cc.why.booking_delay.driver",
      factualValue: oldestMinutes ?? 0,
      evidenceRefs: ["pendingConfirmationCount", "oldestPendingMinutes"],
    };

    // Additional factor: total affected GMV
    const contributingFactors: WhyContributingFactor[] = [];
    const gmv = this.findNum(evidence, "affectedGmv");
    if (gmv !== null && gmv > 0) {
      contributingFactors.push({
        textKey: "cc.why.booking_delay.factor_gmv",
        factualValue: gmv,
        evidenceRefs: ["affectedGmv"],
      });
    }

    // Strength: strong if >5 bookings, moderate otherwise
    const strength: EvidenceStrength = count > 5 ? "strong" : "moderate";

    return {
      status: "OBSERVED_DRIVER",
      primaryDriver,
      contributingFactors,
      evidenceStrength: strength,
      evidenceRefs: ["pendingConfirmationCount", "oldestPendingMinutes", "affectedGmv", "slaThresholdMinutes"],
      rule,
    };
  }

  // ── FAILED_PAYMENTS ─────────────────────────────────────────────────────

  private attrFailedPayments(
    evidence: SignalEvidenceItem[],
    rule: WhyRuleIdentity,
  ): WhyAttribution {
    const count = this.findNum(evidence, "failedCount");

    if (count === null) {
      return this.insufficientEvidence(rule);
    }

    // Check for paymentMethodGroups — enriched evidence from detector
    const paymentMethodGroupsRaw = this.findStr(evidence, "paymentMethodGroups");

    if (paymentMethodGroupsRaw) {
      // Parse grouped payment methods (deterministic string format from detector)
      const groups = this.parseFailureCodeGroups(paymentMethodGroupsRaw);

      if (groups.length > 0) {
        // Find dominant group (largest count; ties → alphabetical by code for determinism)
        const sorted = [...groups].sort((a, b) =>
          b.count !== a.count ? b.count - a.count : a.code.localeCompare(b.code),
        );
        const dominant = sorted[0];

        const primaryDriver: WhyPrimaryDriver = {
          textKey: "cc.why.payment_failure.driver_dominant_method",
          factualValue: `${dominant.count} из ${count} — ${dominant.code}`,
          evidenceRefs: ["failedCount", "paymentMethodGroups"],
        };

        const contributingFactors: WhyContributingFactor[] = [];
        if (sorted.length > 1) {
          contributingFactors.push({
            textKey: "cc.why.payment_failure.factor_other_methods",
            factualValue: sorted.length - 1,
            evidenceRefs: ["paymentMethodGroups"],
          });
        }

        const strength: EvidenceStrength = dominant.count > count * 0.5 ? "strong" : "moderate";

        return {
          status: "OBSERVED_DRIVER",
          primaryDriver,
          contributingFactors,
          evidenceStrength: strength,
          evidenceRefs: ["failedCount", "paymentMethodGroups", "oldestFailedMinutes", "totalFailedAmount"],
          rule,
        };
      }
    }

    // No failure code grouping available → OBSERVED_DRIVER but weaker evidence
    const primaryDriver: WhyPrimaryDriver = {
      textKey: "cc.why.payment_failure.driver_count",
      factualValue: count,
      evidenceRefs: ["failedCount"],
    };

    return {
      status: "OBSERVED_DRIVER",
      primaryDriver,
      contributingFactors: [],
      evidenceStrength: "moderate",
      evidenceRefs: ["failedCount", "oldestFailedMinutes", "totalFailedAmount"],
      rule,
    };
  }

  // ── RECENT_CANCELLATIONS ────────────────────────────────────────────────

  private attrRecentCancellations(
    evidence: SignalEvidenceItem[],
    rule: WhyRuleIdentity,
  ): WhyAttribution {
    const count = this.findNum(evidence, "cancellationCount");

    if (count === null) {
      return this.insufficientEvidence(rule);
    }

    // Check for structured cancellation reasons
    const reasonGroupsRaw = this.findStr(evidence, "cancellationReasonGroups");
    const cancelledByRaw = this.findStr(evidence, "cancelledByGroups");

    const contributingFactors: WhyContributingFactor[] = [];
    let status: WhyStatus = "INSUFFICIENT_EVIDENCE";
    let primaryDriver: WhyPrimaryDriver | undefined;
    let strength: EvidenceStrength = "none";

    // If we have cancellation reason groups → OBSERVED_DRIVER
    if (reasonGroupsRaw) {
      const groups = this.parseReasonGroups(reasonGroupsRaw);
      if (groups.length > 0) {
        const sorted = [...groups].sort((a, b) =>
          b.count !== a.count ? b.count - a.count : a.reason.localeCompare(b.reason),
        );
        const dominant = sorted[0];

        primaryDriver = {
          textKey: "cc.why.cancellation.driver_reason",
          factualValue: `${dominant.count} из ${count} — ${dominant.reason}`,
          evidenceRefs: ["cancellationCount", "cancellationReasonGroups"],
        };
        status = "OBSERVED_DRIVER";
        strength = dominant.count > count * 0.5 ? "strong" : "moderate";
      }
    }

    // If we have cancelledBy groups → contributing factor
    if (cancelledByRaw) {
      const groups = this.parseCancelledByGroups(cancelledByRaw);
      if (groups.length > 0) {
        const sorted = [...groups].sort((a, b) =>
          b.count !== a.count ? b.count - a.count : a.by.localeCompare(b.by),
        );
        const dominant = sorted[0];
        contributingFactors.push({
          textKey: "cc.why.cancellation.factor_cancelled_by",
          factualValue: `${dominant.count} из ${count} — ${dominant.by}`,
          evidenceRefs: ["cancelledByGroups"],
        });

        // If no reason groups, cancelledBy becomes primary
        if (!primaryDriver) {
          primaryDriver = {
            textKey: "cc.why.cancellation.driver_by",
            factualValue: `${dominant.count} из ${count} — ${dominant.by}`,
            evidenceRefs: ["cancellationCount", "cancelledByGroups"],
          };
          status = "OBSERVED_DRIVER";
          strength = "moderate";
        }
      }
    }

    // No structured reason/by data → INSUFFICIENT_EVIDENCE (correct: we cannot
    // determine WHY from just count + GMV)
    if (!primaryDriver) {
      return this.insufficientEvidence(rule);
    }

    return {
      status,
      primaryDriver,
      contributingFactors,
      evidenceStrength: strength,
      evidenceRefs: ["cancellationCount", "cancellationReasonGroups", "cancelledByGroups", "oldestCancellationMinutes", "affectedGmv", "periodDays"],
      rule,
    };
  }

  // ── PENDING_REFUNDS ─────────────────────────────────────────────────────

  private attrPendingRefunds(
    evidence: SignalEvidenceItem[],
    rule: WhyRuleIdentity,
  ): WhyAttribution {
    const count = this.findNum(evidence, "pendingRefundCount");

    if (count === null) {
      return this.insufficientEvidence(rule);
    }

    // Pending refunds have no structured reason data in evidence.
    // We can only state the factual observation — no root cause.
    return this.insufficientEvidence(rule);
  }

  // ── UPCOMING_BOOKINGS ───────────────────────────────────────────────────

  private attrUpcomingBookings(
    evidence: SignalEvidenceItem[],
    rule: WhyRuleIdentity,
  ): WhyAttribution {
    const count = this.findNum(evidence, "upcomingCount");

    if (count === null) {
      return this.insufficientEvidence(rule);
    }

    // Upcoming bookings is an informational/positive signal.
    // No negative WHY — state as informational with insufficient evidence for cause.
    return this.insufficientEvidence(rule);
  }

  // ── SERVICES_WITHOUT_SALES ──────────────────────────────────────────────

  private attrServicesWithoutSales(
    evidence: SignalEvidenceItem[],
    rule: WhyRuleIdentity,
  ): WhyAttribution {
    const count = this.findNum(evidence, "unsoldProductCount");

    if (count === null) {
      return this.insufficientEvidence(rule);
    }

    // Check for enriched catalog state evidence
    const withAvail = this.findNum(evidence, "withAvailabilityCount");
    const withoutAvail = this.findNum(evidence, "withoutAvailabilityCount");
    const longTerm = this.findNum(evidence, "longTermUnsoldCount");
    const recent = this.findNum(evidence, "recentlyPublishedCount");

    const contributingFactors: WhyContributingFactor[] = [];
    let primaryDriver: WhyPrimaryDriver | undefined;
    let strength: EvidenceStrength = "none";

    // If we have availability data → derive meaningful driver
    if (withoutAvail !== null && withAvail !== null) {
      if (withoutAvail > 0) {
        primaryDriver = {
          textKey: "cc.why.unsold.driver_no_availability",
          factualValue: `${withoutAvail} из ${count} — без настроенной доступности`,
          evidenceRefs: ["unsoldProductCount", "withoutAvailabilityCount"],
        };
        strength = withoutAvail > count * 0.5 ? "strong" : "moderate";
      } else {
        primaryDriver = {
          textKey: "cc.why.unsold.driver_has_availability",
          factualValue: `${count} опубликованы с настроенной доступностью`,
          evidenceRefs: ["unsoldProductCount", "withAvailabilityCount"],
        };
        strength = "weak";
      }
    }

    // Time-based factor
    if (longTerm !== null && recent !== null) {
      if (longTerm > 0) {
        contributingFactors.push({
          textKey: "cc.why.unsold.factor_long_term",
          factualValue: `${longTerm} опубликованы >30 дней без продаж`,
          evidenceRefs: ["longTermUnsoldCount"],
        });
      }
      if (recent > 0) {
        contributingFactors.push({
          textKey: "cc.why.unsold.factor_recent",
          factualValue: `${recent} опубликованы недавно`,
          evidenceRefs: ["recentlyPublishedCount"],
        });
      }
    }

    // Without enriched data → INSUFFICIENT_EVIDENCE
    // (correct: "no sales" ≠ "no demand" ≠ "bad pricing")
    if (!primaryDriver) {
      return this.insufficientEvidence(rule);
    }

    return {
      status: "OBSERVED_DRIVER",
      primaryDriver,
      contributingFactors,
      evidenceStrength: strength,
      evidenceRefs: ["unsoldProductCount", "withAvailabilityCount", "withoutAvailabilityCount", "longTermUnsoldCount", "recentlyPublishedCount"],
      rule,
    };
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  private findNum(evidence: SignalEvidenceItem[], key: string): number | null {
    const item = evidence.find((e) => e.key === key);
    if (!item || item.value === null || item.value === undefined) return null;
    const n = Number(item.value);
    return Number.isFinite(n) ? n : null;
  }

  private findStr(evidence: SignalEvidenceItem[], key: string): string | null {
    const item = evidence.find((e) => e.key === key);
    if (!item || item.value === null || item.value === undefined) return null;
    return String(item.value);
  }

  /**
   * Parse failureCodeGroups from deterministic string format:
   * "CODE1:3;CODE2:1" → [{code:"CODE1",count:3},{code:"CODE2",count:1}]
   * Sorted by code for determinism.
   */
  private parseFailureCodeGroups(raw: string): Array<{ code: string; count: number }> {
    if (!raw) return [];
    return raw
      .split(";")
      .map((pair) => {
        const [code, countStr] = pair.split(":");
        const count = Number(countStr);
        return code && Number.isFinite(count) ? { code: code.trim(), count } : null;
      })
      .filter((x): x is { code: string; count: number } => x !== null)
      .sort((a, b) => a.code.localeCompare(b.code));
  }

  /**
   * Parse cancellationReasonGroups from deterministic string format.
   */
  private parseReasonGroups(raw: string): Array<{ reason: string; count: number }> {
    if (!raw) return [];
    return raw
      .split(";")
      .map((pair) => {
        const [reason, countStr] = pair.split(":");
        const count = Number(countStr);
        return reason && Number.isFinite(count) ? { reason: reason.trim(), count } : null;
      })
      .filter((x): x is { reason: string; count: number } => x !== null)
      .sort((a, b) => a.reason.localeCompare(b.reason));
  }

  /**
   * Parse cancelledByGroups from deterministic string format.
   */
  private parseCancelledByGroups(raw: string): Array<{ by: string; count: number }> {
    if (!raw) return [];
    return raw
      .split(";")
      .map((pair) => {
        const [by, countStr] = pair.split(":");
        const count = Number(countStr);
        return by && Number.isFinite(count) ? { by: by.trim(), count } : null;
      })
      .filter((x): x is { by: string; count: number } => x !== null)
      .sort((a, b) => a.by.localeCompare(b.by));
  }

  private insufficientEvidence(rule: WhyRuleIdentity): WhyAttribution {
    return {
      status: "INSUFFICIENT_EVIDENCE",
      primaryDriver: undefined,
      contributingFactors: [],
      evidenceStrength: "none",
      evidenceRefs: [],
      rule,
    };
  }
}
