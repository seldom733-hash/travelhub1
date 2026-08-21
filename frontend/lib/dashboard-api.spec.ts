import { describe, it, expect } from "vitest";
import {
  SUPPORTED_TREND_METRICS,
  dataSourceToTrendMetric,
  validateCustomRange,
  presetToQuery,
} from "./dashboard-api";

describe("dashboard-api", () => {
  describe("dataSourceToTrendMetric", () => {
    it("maps dashboard.trends.orders to 'orders'", () => {
      expect(dataSourceToTrendMetric("dashboard.trends.orders")).toBe("orders");
    });

    it("maps dashboard.trends.bookings to 'bookings'", () => {
      expect(dataSourceToTrendMetric("dashboard.trends.bookings")).toBe("bookings");
    });

    it("maps dashboard.trends.payments to 'payments'", () => {
      expect(dataSourceToTrendMetric("dashboard.trends.payments")).toBe("payments");
    });

    it("maps dashboard.trends.customers to 'customers'", () => {
      expect(dataSourceToTrendMetric("dashboard.trends.customers")).toBe("customers");
    });

    it("maps dashboard.trends.commissions to 'commissions'", () => {
      expect(dataSourceToTrendMetric("dashboard.trends.commissions")).toBe("commissions");
    });

    it("returns null for unsupported metric (revenue)", () => {
      expect(dataSourceToTrendMetric("dashboard.trends.revenue")).toBeNull();
    });

    it("returns null for unknown dataSource", () => {
      expect(dataSourceToTrendMetric("dashboard.trends.unknown")).toBeNull();
    });

    it("returns null for non-trend dataSource", () => {
      expect(dataSourceToTrendMetric("dashboard.summary.gmv")).toBeNull();
    });
  });

  describe("validateCustomRange", () => {
    it("returns null for valid range", () => {
      expect(validateCustomRange("2026-01-01", "2026-01-31")).toBeNull();
    });

    it("returns error when start missing", () => {
      expect(validateCustomRange("", "2026-01-31")).toContain("required");
    });

    it("returns error when end missing", () => {
      expect(validateCustomRange("2026-01-01", "")).toContain("required");
    });

    it("returns error when start > end", () => {
      expect(validateCustomRange("2026-02-01", "2026-01-01")).toContain("before");
    });

    it("allows same start and end", () => {
      expect(validateCustomRange("2026-01-01", "2026-01-01")).toBeNull();
    });
  });

  describe("presetToQuery", () => {
    it("returns correct default params", () => {
      const result = presetToQuery("MONTH");
      expect(result.preset).toBe("MONTH");
      expect(result.timezone).toBe("UTC");
      expect(result.comparison).toBe(true);
    });

    it("disables comparison when specified", () => {
      const result = presetToQuery("LAST_7_DAYS", false);
      expect(result.comparison).toBe(false);
    });
  });

  describe("SUPPORTED_TREND_METRICS", () => {
    it("does not include revenue (not supported by backend)", () => {
      expect(SUPPORTED_TREND_METRICS).not.toContain("revenue");
    });

    it("includes the 5 supported metrics", () => {
      expect(SUPPORTED_TREND_METRICS).toHaveLength(5);
    });
  });
});
