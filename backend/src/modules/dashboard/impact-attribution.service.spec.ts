/**
 * Stage E — Deterministic Evidence-Based Impact — Unit Tests
 *
 * Tests cover:
 * - Determinism (same input → same output)
 * - All 6 signal codes
 * - Missing/partial evidence handling
 * - No fabricated monetary impact
 * - No arbitrary severity
 * - Rule identity/version traceability
 * - Financial semantics (GMV ≠ revenue, failed ≠ lost, refund ≠ cash outflow)
 */

import { ImpactAttributionService } from "./impact-attribution.service";

function ev(key: string, value: string | number): { key: string; value: string | number } {
  return { key, value };
}

describe("ImpactAttributionService", () => {
  let service: ImpactAttributionService;

  beforeEach(() => {
    service = new ImpactAttributionService();
  });

  // ── Determinism ──────────────────────────────────────────────────────────

  describe("determinism", () => {
    it("same inputs produce same output", () => {
      const evidence = [
        ev("pendingConfirmationCount", 5),
        ev("oldestPendingMinutes", 300),
        ev("affectedGmv", 2500),
        ev("slaThresholdMinutes", 240),
      ];
      const result1 = service.computeImpact("PENDING_BOOKINGS", evidence);
      const result2 = service.computeImpact("PENDING_BOOKINGS", evidence);
      expect(result1).toEqual(result2);
    });

    it("different inputs produce different output", () => {
      const evidence1 = [ev("pendingConfirmationCount", 1)];
      const evidence2 = [ev("pendingConfirmationCount", 10)];
      const result1 = service.computeImpact("PENDING_BOOKINGS", evidence1);
      const result2 = service.computeImpact("PENDING_BOOKINGS", evidence2);
      expect(result1!.dimensions[0].value).not.toBe(result2!.dimensions[0].value);
    });
  });

  // ── All 6 Signal Codes ───────────────────────────────────────────────────

  describe("all 6 signal codes have impact rules", () => {
    it.each([
      "PENDING_BOOKINGS",
      "FAILED_PAYMENTS",
      "RECENT_CANCELLATIONS",
      "PENDING_REFUNDS",
      "UPCOMING_BOOKINGS",
      "SERVICES_WITHOUT_SALES",
    ])("has rule for %s", (code) => {
      expect(service.hasRule(code)).toBe(true);
    });

    it("returns null for unknown signal code", () => {
      expect(service.computeImpact("UNKNOWN_CODE", [])).toBeNull();
    });
  });

  // ── PENDING BOOKINGS ────────────────────────────────────────────────────

  describe("PENDING_BOOKINGS", () => {
    it("computes scope + financial + SLA dimensions", () => {
      const evidence = [
        ev("pendingConfirmationCount", 5),
        ev("oldestPendingMinutes", 300),
        ev("affectedGmv", 2500),
        ev("slaThresholdMinutes", 240),
      ];
      const result = service.computeImpact("PENDING_BOOKINGS", evidence);
      expect(result).not.toBeNull();
      expect(result!.status).toBe("PROVEN");
      expect(result!.dimensions.length).toBeGreaterThanOrEqual(3);

      const scope = result!.dimensions.find((d) => d.type === "SCOPE");
      expect(scope).toBeDefined();
      expect(scope!.value).toBe(5);

      const financial = result!.dimensions.find((d) => d.type === "FINANCIAL");
      expect(financial).toBeDefined();
      expect(financial!.value).toBe(2500);
      expect(financial!.unit).toBe("AZN");

      const sla = result!.dimensions.find((d) => d.type === "SLA_TIME");
      expect(sla).toBeDefined();
    });

    it("does NOT claim lost revenue from affected GMV", () => {
      const evidence = [
        ev("pendingConfirmationCount", 5),
        ev("affectedGmv", 2500),
        ev("oldestPendingMinutes", 300),
        ev("slaThresholdMinutes", 240),
      ];
      const result = service.computeImpact("PENDING_BOOKINGS", evidence);
      const financial = result!.dimensions.find((d) => d.type === "FINANCIAL");
      // Label should say "GMV затронутых заказов", NOT "Lost revenue"
      expect(financial!.labelKey).toContain("gmv");
      // label now uses i18n key — no hardcoded text to check;
      ;
    });
  });

  // ── FAILED PAYMENTS ─────────────────────────────────────────────────────

  describe("FAILED_PAYMENTS", () => {
    it("computes scope + financial dimensions", () => {
      const evidence = [
        ev("failedCount", 4),
        ev("oldestFailedMinutes", 120),
        ev("totalFailedAmount", 500),
        ev("paymentMethodGroups", "CARD:3, BANK:1"),
      ];
      const result = service.computeImpact("FAILED_PAYMENTS", evidence);
      expect(result).not.toBeNull();
      expect(result!.status).toBe("PROVEN");

      const scope = result!.dimensions.find((d) => d.type === "SCOPE");
      expect(scope!.value).toBe(4);

      const financial = result!.dimensions.find((d) => d.type === "FINANCIAL");
      expect(financial!.value).toBe(500);
    });

    it("does NOT claim lost revenue from failed amount", () => {
      const evidence = [ev("failedCount", 3), ev("totalFailedAmount", 1000), ev("oldestFailedMinutes", 60)];
      const result = service.computeImpact("FAILED_PAYMENTS", evidence);
      const financial = result!.dimensions.find((d) => d.type === "FINANCIAL");
      // Should say "Сумма неуспешных попыток", NOT "Lost revenue"
      expect(financial!.labelKey).toContain("failed_payments.amount");
      // label now uses i18n key — no hardcoded text to check;
    });
  });

  // ── RECENT CANCELLATIONS ────────────────────────────────────────────────

  describe("RECENT_CANCELLATIONS", () => {
    it("computes scope + financial dimensions", () => {
      const evidence = [
        ev("cancellationCount", 3),
        ev("oldestCancellationMinutes", 480),
        ev("affectedGmv", 1500),
        ev("periodDays", 7),
      ];
      const result = service.computeImpact("RECENT_CANCELLATIONS", evidence);
      expect(result).not.toBeNull();
      expect(result!.status).toBe("PARTIALLY_PROVEN");

      const financial = result!.dimensions.find((d) => d.type === "FINANCIAL");
      expect(financial!.labelKey).toContain("recent_cancellations.gmv");
    });
  });

  // ── PENDING REFUNDS ─────────────────────────────────────────────────────

  describe("PENDING_REFUNDS", () => {
    it("does NOT claim cash outflow from pending amount", () => {
      const evidence = [
        ev("pendingRefundCount", 10),
        ev("oldestPendingMinutes", 400),
        ev("totalRefundAmount", 2000),
      ];
      const result = service.computeImpact("PENDING_REFUNDS", evidence);
      const financial = result!.dimensions.find((d) => d.type === "FINANCIAL");
      // Should say "Запрошенная сумма", NOT "cash outflow" or "processed"
      expect(financial!.labelKey).toContain("pending_refunds.amount");
      ;
      ;
    });
  });

  // ── UPCOMING BOOKINGS ──────────────────────────────────────────────────

  describe("UPCOMING_BOOKINGS", () => {
    it("is INFORMATIONAL (not negative impact)", () => {
      const evidence = [
        ev("upcomingCount", 51),
        ev("daysUntilNearest", 3),
        ev("totalUpcomingGmv", 5792),
      ];
      const result = service.computeImpact("UPCOMING_BOOKINGS", evidence);
      expect(result!.status).toBe("INFORMATIONAL");
    });
  });

  // ── SERVICES WITHOUT SALES ──────────────────────────────────────────────

  describe("SERVICES_WITHOUT_SALES", () => {
    it("does NOT produce monetary impact from unsold count", () => {
      const evidence = [
        ev("unsoldProductCount", 31),
        { key: "productNames", value: ["A", "B", "C"] },
        ev("withAvailabilityCount", 0),
        ev("withoutAvailabilityCount", 31),
      ];
      const result = service.computeImpact("SERVICES_WITHOUT_SALES", evidence);
      // No FINANCIAL dimension
      const financial = result!.dimensions.find((d) => d.type === "FINANCIAL");
      expect(financial).toBeUndefined();
    });

    it("shows operational + scope dimensions", () => {
      const evidence = [
        ev("unsoldProductCount", 31),
        ev("withAvailabilityCount", 0),
        ev("withoutAvailabilityCount", 31),
      ];
      const result = service.computeImpact("SERVICES_WITHOUT_SALES", evidence);
      const scope = result!.dimensions.find((d) => d.type === "SCOPE");
      expect(scope!.value).toBe(31);

      const operational = result!.dimensions.find((d) => d.type === "OPERATIONAL");
      expect(operational).toBeDefined();
      expect(operational!.labelKey).toContain("availability");
    });
  });

  // ── Missing Evidence ────────────────────────────────────────────────────

  describe("missing evidence", () => {
    it("returns INSUFFICIENT_EVIDENCE when all evidence missing", () => {
      const result = service.computeImpact("PENDING_BOOKINGS", []);
      expect(result!.status).toBe("INSUFFICIENT_EVIDENCE");
      expect(result!.dimensions.length).toBe(0);
    });

    it("returns partial when some evidence present", () => {
      const result = service.computeImpact("PENDING_BOOKINGS", [ev("pendingConfirmationCount", 3)]);
      expect(result!.status).toBe("PARTIALLY_PROVEN");
      expect(result!.dimensions.length).toBe(1);
    });
  });

  // ── Rule Identity ───────────────────────────────────────────────────────

  describe("rule identity", () => {
    it("all results have rule identity", () => {
      const codes = [
        "PENDING_BOOKINGS",
        "FAILED_PAYMENTS",
        "RECENT_CANCELLATIONS",
        "PENDING_REFUNDS",
        "UPCOMING_BOOKINGS",
        "SERVICES_WITHOUT_SALES",
      ];
      for (const code of codes) {
        const result = service.computeImpact(code, [ev("dummy", 1)]);
        expect(result!.rule).toBeDefined();
        expect(result!.rule.ruleId).toContain("IMPACT");
        expect(result!.rule.ruleVersion).toMatch(/^\d+\.\d+\.\d+$/);
      }
    });
  });

  // ── No Fabricated Impact ────────────────────────────────────────────────

  describe("no fabricated impact", () => {
    it("no count × coefficient formula", () => {
      const evidence = [
        ev("unsoldProductCount", 31),
        { key: "productNames", value: ["A"] },
        ev("withoutAvailabilityCount", 31),
      ];
      const result = service.computeImpact("SERVICES_WITHOUT_SALES", evidence);
      // No financial dimension at all
      expect(result!.dimensions.find((d) => d.type === "FINANCIAL")).toBeUndefined();
    });

    it("no arbitrary severity threshold", () => {
      // Even with high count, should not auto-assign severity
      const evidence = [ev("pendingConfirmationCount", 100), ev("oldestPendingMinutes", 500), ev("affectedGmv", 50000), ev("slaThresholdMinutes", 240)];
      const result = service.computeImpact("PENDING_BOOKINGS", evidence);
      // Status should be PROVEN (all dimensions factual), not HIGH/CRITICAL
      expect(["PROVEN", "PARTIALLY_PROVEN"]).toContain(result!.status);
    });
  });
});
