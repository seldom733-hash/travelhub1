/**
 * Signal Evidence Presentation — Regression Tests
 *
 * Ensures raw system field names never appear as user-visible text.
 * Each signal code has a typed presenter that maps evidence to human-readable labels.
 */
import { describe, it, expect } from "vitest";
import { presentEvidence, hasPresenter } from "../signal-evidence.presenter";
import type { Locale } from "@/lib/i18n";

// ── Raw keys that must NEVER appear in user-facing output ────────────────────

const RAW_KEYS_TO_GUARD = [
  "unsoldProductCount",
  "productNames",
  "withAvailabilityCount",
  "withoutAvailabilityCount",
  "pendingConfirmationCount",
  "oldestPendingMinutes",
  "affectedGmv",
  "slaThresholdMinutes",
  "failedCount",
  "oldestFailedMinutes",
  "totalFailedAmount",
  "failureCodeGroups",
  "cancellationCount",
  "oldestCancellationMinutes",
  "periodDays",
  "pendingRefundCount",
  "totalRefundAmount",
  "upcomingCount",
  "daysUntilNearest",
  "totalUpcomingGmv",
  "recentlyPublishedCount",
  "longTermUnsoldCount",
];

// ── All 6 signal codes must have presenters ──────────────────────────────────

describe("Signal Evidence Presenters", () => {
  it("all 6 signal codes have typed presenters", () => {
    const codes = [
      "PENDING_BOOKINGS",
      "FAILED_PAYMENTS",
      "RECENT_CANCELLATIONS",
      "PENDING_REFUNDS",
      "UPCOMING_BOOKINGS",
      "SERVICES_WITHOUT_SALES",
    ];
    for (const code of codes) {
      expect(hasPresenter(code)).toBe(true);
    }
  });

  // ── SERVICES_WITHOUT_SALES ────────────────────────────────────────────────

  it("ServicesWithoutSales: renders human-readable labels (RU)", () => {
    const evidence = [
      { key: "unsoldProductCount", value: 31 },
      { key: "productNames", value: ["Baku Night Market", "Sheki Silk Road", "Tea Ceremony", "Sunset Yacht", "Palace Tour"] },
      { key: "withAvailabilityCount", value: 0 },
      { key: "withoutAvailabilityCount", value: 31 },
    ];
    const result = presentEvidence("SERVICES_WITHOUT_SALES", evidence, "ru");
    const labels = result.map((r) => r.label);

    expect(labels).toContain("Услуг без заказов");
    expect(labels).toContain("Доступность");
    expect(labels).toContain("Примеры услуг");

    // Must NOT contain raw keys
    for (const item of result) {
      expect(item.label).not.toMatch(/^unsoldProductCount$/);
      expect(item.label).not.toMatch(/^productNames$/);
      expect(item.label).not.toMatch(/^withAvailabilityCount$/);
      expect(item.label).not.toMatch(/^withoutAvailabilityCount$/);
    }
  });

  it("ServicesWithoutSales: arrays compacted to first 3 + 'and more'", () => {
    const names = Array.from({ length: 20 }, (_, i) => `Service ${i + 1}`);
    const evidence = [
      { key: "unsoldProductCount", value: 20 },
      { key: "productNames", value: names },
    ];
    const result = presentEvidence("SERVICES_WITHOUT_SALES", evidence, "ru");
    const namesItem = result.find((r) => r.label === "Примеры услуг");
    expect(namesItem).toBeDefined();
    // Should contain first 3 + "...and X more"
    expect(namesItem!.value).toContain("Service 1");
    expect(namesItem!.value).toContain("Service 3");
    expect(namesItem!.value).toContain("и ещё 17");
  });

  // ── PENDING_BOOKINGS ──────────────────────────────────────────────────────

  it("PendingBookings: renders human-readable labels", () => {
    const evidence = [
      { key: "pendingConfirmationCount", value: 5 },
      { key: "oldestPendingMinutes", value: 345 },
      { key: "affectedGmv", value: 2500 },
      { key: "slaThresholdMinutes", value: 240 },
    ];
    const result = presentEvidence("PENDING_BOOKINGS", evidence, "ru");
    const labels = result.map((r) => r.label);

    expect(labels).toContain("Ожидают подтверждения");
    expect(labels).toContain("Самое длительное ожидание");
    expect(labels).toContain("Затронутый объём");
    expect(labels).toContain("Порог SLA");

    // Duration formatted
    const oldestItem = result.find((r) => r.label === "Самое длительное ожидание");
    expect(oldestItem!.value).toContain("5 ч");
  });

  // ── FAILED_PAYMENTS ───────────────────────────────────────────────────────

  it("FailedPayments: renders human-readable labels", () => {
    const evidence = [
      { key: "failedCount", value: 4 },
      { key: "oldestFailedMinutes", value: 120 },
      { key: "totalFailedAmount", value: 500 },
      { key: "failureCodeGroups", value: "CARD:3, BANK:1" },
    ];
    const result = presentEvidence("FAILED_PAYMENTS", evidence, "ru");
    const labels = result.map((r) => r.label);

    expect(labels).toContain("Неуспешных платежей");
    expect(labels).toContain("Самый старый сбой");
    expect(labels).toContain("Сумма неуспешных");
    expect(labels).toContain("Группы ошибок");
  });

  // ── PENDING_REFUNDS ───────────────────────────────────────────────────────

  it("PendingRefunds: renders human-readable labels", () => {
    const evidence = [
      { key: "pendingRefundCount", value: 20 },
      { key: "oldestPendingMinutes", value: 600 },
      { key: "totalRefundAmount", value: 3000 },
    ];
    const result = presentEvidence("PENDING_REFUNDS", evidence, "ru");
    const labels = result.map((r) => r.label);

    expect(labels).toContain("Ожидают возврата");
    expect(labels).toContain("Самое длительное ожидание");
    expect(labels).toContain("Сумма возвратов");
  });

  // ── RECENT_CANCELLATIONS ──────────────────────────────────────────────────

  it("RecentCancellations: renders human-readable labels", () => {
    const evidence = [
      { key: "cancellationCount", value: 3 },
      { key: "oldestCancellationMinutes", value: 480 },
      { key: "affectedGmv", value: 1500 },
      { key: "periodDays", value: 7 },
    ];
    const result = presentEvidence("RECENT_CANCELLATIONS", evidence, "ru");
    const labels = result.map((r) => r.label);

    expect(labels).toContain("Отмен");
    expect(labels).toContain("Самая старая отмена");
    expect(labels).toContain("Затронутый объём");
    expect(labels).toContain("За период");
  });

  // ── UPCOMING_BOOKINGS ─────────────────────────────────────────────────────

  it("UpcomingBookings: renders human-readable labels", () => {
    const evidence = [
      { key: "upcomingCount", value: 8 },
      { key: "daysUntilNearest", value: 3 },
      { key: "totalUpcomingGmv", value: 4000 },
    ];
    const result = presentEvidence("UPCOMING_BOOKINGS", evidence, "ru");
    const labels = result.map((r) => r.label);

    expect(labels).toContain("Предстоящих бронирований");
    expect(labels).toContain("До ближайшего");
    expect(labels).toContain("Объём предстоящих");
  });

  // ── NO RAW KEYS IN ANY SIGNAL ────────────────────────────────────────────

  it("no raw system field names appear as labels for any signal code", () => {
    const allEvidence: Record<string, Array<{ key: string; value: string | number }>> = {
      PENDING_BOOKINGS: [
        { key: "pendingConfirmationCount", value: 5 },
        { key: "oldestPendingMinutes", value: 300 },
        { key: "affectedGmv", value: 2000 },
        { key: "slaThresholdMinutes", value: 240 },
      ],
      FAILED_PAYMENTS: [
        { key: "failedCount", value: 3 },
        { key: "oldestFailedMinutes", value: 120 },
        { key: "totalFailedAmount", value: 500 },
        { key: "failureCodeGroups", value: "CARD:2" },
      ],
      RECENT_CANCELLATIONS: [
        { key: "cancellationCount", value: 2 },
        { key: "oldestCancellationMinutes", value: 600 },
        { key: "affectedGmv", value: 1000 },
        { key: "periodDays", value: 7 },
      ],
      PENDING_REFUNDS: [
        { key: "pendingRefundCount", value: 10 },
        { key: "oldestPendingMinutes", value: 400 },
        { key: "totalRefundAmount", value: 2000 },
      ],
      UPCOMING_BOOKINGS: [
        { key: "upcomingCount", value: 5 },
        { key: "daysUntilNearest", value: 2 },
        { key: "totalUpcomingGmv", value: 3000 },
      ],
      SERVICES_WITHOUT_SALES: [
        { key: "unsoldProductCount", value: 10 },
        { key: "productNames", value: ["A", "B", "C"] } as any,
        { key: "withAvailabilityCount", value: 3 },
        { key: "withoutAvailabilityCount", value: 7 },
        { key: "recentlyPublishedCount", value: 2 },
        { key: "longTermUnsoldCount", value: 5 },
      ],
    };

    for (const [code, evidence] of Object.entries(allEvidence)) {
      for (const locale of ["ru", "az", "en"] as Locale[]) {
        const result = presentEvidence(code, evidence, locale);
        for (const item of result) {
          // Label must not be a raw system key
          for (const rawKey of RAW_KEYS_TO_GUARD) {
            expect(item.label).not.toBe(rawKey);
          }
        }
      }
    }
  });

  // ── AZN in monetary values ────────────────────────────────────────────────

  it("monetary values include AZN symbol", () => {
    const evidence = [{ key: "affectedGmv", value: 2500 }];
    const result = presentEvidence("PENDING_BOOKINGS", evidence, "ru");
    const gmvItem = result.find((r) => r.label === "Затронутый объём");
    expect(gmvItem!.value).toContain("₼");
    expect(gmvItem!.value).not.toContain("$");
  });

  // ── EN locale ─────────────────────────────────────────────────────────────

  it("EN labels resolve for all signal codes", () => {
    const samples: Array<{ code: string; evidence: Array<{ key: string; value: string | number }> }> = [
      { code: "PENDING_BOOKINGS", evidence: [{ key: "pendingConfirmationCount", value: 3 }] },
      { code: "FAILED_PAYMENTS", evidence: [{ key: "failedCount", value: 2 }] },
      { code: "RECENT_CANCELLATIONS", evidence: [{ key: "cancellationCount", value: 1 }] },
      { code: "PENDING_REFUNDS", evidence: [{ key: "pendingRefundCount", value: 5 }] },
      { code: "UPCOMING_BOOKINGS", evidence: [{ key: "upcomingCount", value: 4 }] },
      { code: "SERVICES_WITHOUT_SALES", evidence: [{ key: "unsoldProductCount", value: 10 }] },
    ];
    for (const { code, evidence } of samples) {
      const result = presentEvidence(code, evidence, "en");
      expect(result.length).toBeGreaterThan(0);
      // EN labels should not contain raw keys
      for (const item of result) {
        expect(item.label).not.toMatch(/^cc\./);
      }
    }
  });
});
