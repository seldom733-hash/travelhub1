/**
 * Decision Queue Localization — Regression Tests
 *
 * Guards against:
 * - CJK characters in RU/AZ user-facing templates
 * - Raw i18n keys visible in UI
 * - Known AZ transliteration defects
 * - Raw evidence/impact keys
 */
import { describe, it, expect } from "vitest";
import { t, type Locale } from "@/lib/i18n";
import { presentEvidence } from "../signal-evidence.presenter";

// ── CJK Unicode Range ────────────────────────────────────────────────────────
// Chinese/Japanese/Korean ideographs: U+4E00–U+9FFF, U+3400–U+4DBF, U+F900–U+FAFF
const CJK_REGEX = /[\u4E00-\u9FFF\u3400-\u4DBF\uF900-\uFAFF]/;

// ── All Decision Queue i18n keys that are user-facing ────────────────────────
const QUEUE_KEYS = [
  "cc.queue.title",
  "cc.queue.active",
  "cc.queue.history",
  "cc.queue.empty",
  "cc.queue.open",
  "cc.queue.acknowledged",
  "cc.queue.resolved",
  "cc.queue.dismissed",
  "cc.queue.slaBreached",
  "cc.queue.acknowledge",
  "cc.queue.resolve",
  "cc.queue.dismiss",
  "cc.queue.detected",
  "cc.queue.lastObserved",
  "cc.queue.observations",
  "cc.queue.entities",
  "cc.signal.title.BOOKING_CONFIRMATION_DELAY",
  "cc.signal.title.FAILED_PAYMENTS",
  "cc.signal.title.RECENT_CANCELLATIONS",
  "cc.signal.title.PENDING_REFUNDS",
  "cc.signal.title.UPCOMING_BOOKINGS",
  "cc.signal.title.SERVICES_WITHOUT_SALES",
  "cc.signal.desc.BOOKING_CONFIRMATION_DELAY",
  "cc.signal.desc.FAILED_PAYMENTS",
  "cc.signal.desc.RECENT_CANCELLATIONS",
  "cc.signal.desc.PENDING_REFUNDS",
  "cc.signal.desc.UPCOMING_BOOKINGS",
  "cc.signal.desc.SERVICES_WITHOUT_SALES",
  "cc.why.title",
  "cc.why.insufficient",
  "cc.impact.title",
  "cc.impact.insufficient",
];

// ── Known AZ bad transliterations that must NOT appear ───────────────────────
const AZ_BAD_TRANSLITERATIONS = [
  "Aciq",        // should be Açıq
  "Qeyde alindi", // should be Qeydə alındı
  "Hell edildi",  // should be Həll edildi
  "Hell et",      // should be Həll et
  "Gözlem",       // should be Müdahidələr or similar
  "Katalog",      // should be Kataloq
  "Satis",        // should be Satış
  "Ugursuz",      // should be Uğursuz
  "odenisler",    // should be ödənişlər
];

// ── Known CJK fragments that must NOT appear in RU/AZ ───────────────────────
const CJK_FRAGMENTS = ["等待", "最老", "确认", "bronları"];

describe("Decision Queue Localization Guards", () => {
  // ── CJK Guard: RU ──────────────────────────────────────────────────────

  it("RU queue keys contain no CJK characters", () => {
    for (const key of QUEUE_KEYS) {
      const val = t(key, "ru");
      expect(val).not.toMatch(CJK_REGEX);
    }
  });

  it("RU signal descriptions with params contain no CJK", () => {
    const descKeys = QUEUE_KEYS.filter((k) => k.startsWith("cc.signal.desc."));
    for (const key of descKeys) {
      const val = t(key, "ru");
      expect(val).not.toMatch(CJK_REGEX);
    }
  });

  // ── CJK Guard: AZ ──────────────────────────────────────────────────────

  it("AZ queue keys contain no CJK characters", () => {
    for (const key of QUEUE_KEYS) {
      const val = t(key, "az");
      expect(val).not.toMatch(CJK_REGEX);
    }
  });

  // ── CJK Guard: EN ──────────────────────────────────────────────────────

  it("EN queue keys contain no CJK characters", () => {
    for (const key of QUEUE_KEYS) {
      const val = t(key, "en");
      expect(val).not.toMatch(CJK_REGEX);
    }
  });

  // ── AZ Known-Bad Transliterations ──────────────────────────────────────

  it("AZ queue keys do not contain known bad transliterations", () => {
    for (const key of QUEUE_KEYS) {
      const val = t(key, "az");
      for (const bad of AZ_BAD_TRANSLITERATIONS) {
        expect(val).not.toContain(bad);
      }
    }
  });

  // ── No Raw i18n Keys ──────────────────────────────────────────────────

  it("no queue key returns its own key (missing translation)", () => {
    for (const key of QUEUE_KEYS) {
      for (const locale of ["ru", "az", "en"] as Locale[]) {
        const val = t(key, locale);
        expect(val).not.toBe(key);
      }
    }
  });

  // ── No Raw Evidence Keys in Presentation ──────────────────────────────

  it("presented evidence contains no raw system field names", () => {
    const rawKeys = [
      "unsoldProductCount", "productNames", "withAvailabilityCount",
      "withoutAvailabilityCount", "pendingConfirmationCount", "oldestPendingMinutes",
      "affectedGmv", "slaThresholdMinutes", "failedCount", "oldestFailedMinutes",
      "totalFailedAmount", "paymentMethodGroups", "cancellationCount",
      "oldestCancellationMinutes", "periodDays", "pendingRefundCount",
      "totalRefundAmount", "upcomingCount", "daysUntilNearest", "totalUpcomingGmv",
    ];
    const allEvidence = [
      "PENDING_BOOKINGS", "FAILED_PAYMENTS", "RECENT_CANCELLATIONS",
      "PENDING_REFUNDS", "UPCOMING_BOOKINGS", "SERVICES_WITHOUT_SALES",
    ].map((code) => presentEvidence(code, rawKeys.map((k) => ({ key: k, value: 1 })), "ru"));

    for (const evidence of allEvidence) {
      for (const item of evidence) {
        for (const rawKey of rawKeys) {
          expect(item.label).not.toBe(rawKey);
        }
      }
    }
  });

  // ── AZ Transliteration Quality ─────────────────────────────────────────

  it("AZ uses proper Azerbaijani diacritics (not Turkish)", () => {
    // Check that AZ uses ş/ı/ğ/ç/ö/ü properly
    const azOpen = t("cc.queue.open", "az");
    expect(azOpen).toContain("ı"); // Açıq uses ı, not i
    expect(azOpen).toContain("ç"); // Açıq uses ç, not c

    const azAcknowledged = t("cc.queue.acknowledged", "az");
    expect(azAcknowledged).toContain("ə"); // Qeydə uses ə, not e
  });

  // ── RU does not contain AZ/EN fragments ────────────────────────────────

  it("RU queue keys do not contain Azerbaijani or English fragments", () => {
    for (const key of QUEUE_KEYS) {
      const val = t(key, "ru");
      // Should not contain Latin-only words (except proper nouns/technical terms)
      // Simple heuristic: if the value is mostly Latin, it's likely not translated
      const latinChars = (val.match(/[a-zA-Z]/g) || []).length;
      const totalChars = val.length;
      if (totalChars > 3) {
        // Allow up to 30% Latin (for words like "SLA", "GMV", etc.)
        expect(latinChars / totalChars).toBeLessThan(0.3);
      }
    }
  });
});
