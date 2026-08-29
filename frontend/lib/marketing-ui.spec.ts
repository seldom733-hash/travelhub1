import { describe, expect, it } from "vitest";
import { t } from "./i18n";

/**
 * Step 3.9 — Strict Review Findings Remediation — Regression Tests
 *
 * F3: Objective bounded select — all canonical enum values have i18n labels
 * F1: Status localization — all Marketing lifecycle statuses have i18n keys
 * F2: Audience criteria labels — all whitelisted criteria have i18n labels
 */

// ── Canonical Marketing Objective enum (from Prisma) ──────────────────
const MARKETING_OBJECTIVES = [
  "AWARENESS",
  "ENGAGEMENT",
  "CONVERSION",
  "RETENTION",
  "REACTIVATION",
] as const;

// ── Canonical Marketing lifecycle statuses ────────────────────────────
const MARKETING_STATUSES = [
  "DRAFT",
  "SCHEDULED",
  "ACTIVE",
  "PAUSED",
  "COMPLETED",
  "CANCELLED",
] as const;

// ── Whitelisted Audience criteria keys ────────────────────────────────
const CRITERIA_KEYS = ["lifecycle", "leadSource", "tags", "status", "customerType"] as const;

describe("Marketing UI — i18n keys (F3/F1/F2 regression)", () => {
  it("all canonical objectives have RU/AZ/EN translations", () => {
    for (const obj of MARKETING_OBJECTIVES) {
      const key = `marketing.objective.${obj.toLowerCase()}`;
      expect(t(key, "ru")).not.toBe(key);
      expect(t(key, "az")).not.toBe(key);
      expect(t(key, "en")).not.toBe(key);
    }
  });

  it("all Marketing lifecycle statuses have translations (DRAFT, SCHEDULED, etc.)", () => {
    for (const status of MARKETING_STATUSES) {
      const key = `marketing.status.${status.toLowerCase()}`;
      expect(t(key, "ru")).not.toBe(key);
      expect(t(key, "az")).not.toBe(key);
      expect(t(key, "en")).not.toBe(key);
    }
  });

  it("all whitelisted criteria keys have translations", () => {
    for (const ck of CRITERIA_KEYS) {
      const key = `marketing.criteria.${ck}`;
      expect(t(key, "ru")).not.toBe(key);
      expect(t(key, "az")).not.toBe(key);
      expect(t(key, "en")).not.toBe(key);
    }
  });

  it("localized labels are human-readable (not raw enums)", () => {
    expect(t("marketing.objective.awareness", "ru")).toBe("Узнаваемость");
    expect(t("marketing.objective.conversion", "en")).toBe("Conversion");
    expect(t("marketing.status.scheduled", "ru")).toBe("Запланировано");
    expect(t("marketing.status.paused", "ru")).toBe("Приостановлено");
    expect(t("marketing.criteria.lifecycle", "ru")).toBe("Жизненный цикл");
    expect(t("marketing.criteria.tags", "ru")).toBe("Теги");
  });
});

describe("Marketing UI — canonical constants (F3 regression)", () => {
  it("OBJECTIVE_OPTIONS map covers all 5 canonical values", () => {
    // This mirrors the OBJECTIVE_OPTIONS constant in the marketing page
    const OBJECTIVE_OPTIONS: Record<string, string> = {
      AWARENESS: "marketing.objective.awareness",
      ENGAGEMENT: "marketing.objective.engagement",
      CONVERSION: "marketing.objective.conversion",
      RETENTION: "marketing.objective.retention",
      REACTIVATION: "marketing.objective.reactivation",
    };

    expect(Object.keys(OBJECTIVE_OPTIONS).sort()).toEqual([...MARKETING_OBJECTIVES].sort());
    for (const [val, i18nKey] of Object.entries(OBJECTIVE_OPTIONS)) {
      expect(MARKETING_OBJECTIVES).toContain(val);
      expect(t(i18nKey, "en")).not.toBe(i18nKey);
    }
  });
});
