/**
 * Phase 1 Step 1.13A — unit tests: temporal helpers.
 *
 * §30 Unit: UTC serialization, null semantics, temporal invariants.
 */
import { assertNonDecreasing, isoOrNull, isoUtc } from "./temporal";

describe("temporal helpers (Step 1.13A)", () => {
  describe("isoUtc — UTC serialization (§20)", () => {
    it("serializes as ISO-8601 UTC (Z suffix), not local time", () => {
      const d = new Date("2026-08-01T10:00:00.000Z");
      expect(isoUtc(d)).toBe("2026-08-01T10:00:00.000Z");
      // Local-timezone naive would produce +03:00 etc.; toISOString is always Z.
      expect(isoUtc(d).endsWith("Z")).toBe(true);
    });

    it("round-trips through Date", () => {
      const d = new Date(1_700_000_000_000);
      expect(new Date(isoUtc(d)).getTime()).toBe(d.getTime());
    });
  });

  describe("isoOrNull — null semantics (§24)", () => {
    it("null/undefined → null (milestone not happened / legacy unknown)", () => {
      expect(isoOrNull(null)).toBeNull();
      expect(isoOrNull(undefined)).toBeNull();
    });

    it("Date → UTC string", () => {
      expect(isoOrNull(new Date("2026-07-01T00:00:00.000Z"))).toBe("2026-07-01T00:00:00.000Z");
    });

    it("no fake timestamps: never fabricates a value for unknown", () => {
      expect(isoOrNull(null)).toBeNull();
      expect(isoOrNull(undefined)).toBeNull();
    });
  });

  describe("assertNonDecreasing — temporal invariants (§19)", () => {
    it("accepts strictly increasing sequence", () => {
      const a = new Date("2026-08-01T00:00:00Z");
      const b = new Date("2026-08-02T00:00:00Z");
      expect(() => assertNonDecreasing("t", a, b)).not.toThrow();
    });

    it("accepts equal timestamps (non-decreasing)", () => {
      const a = new Date("2026-08-01T00:00:00Z");
      expect(() => assertNonDecreasing("t", a, a)).not.toThrow();
    });

    it("throws on decreasing sequence", () => {
      const a = new Date("2026-08-02T00:00:00Z");
      const b = new Date("2026-08-01T00:00:00Z");
      expect(() => assertNonDecreasing("activatedAt<=deprecatedAt", a, b)).toThrow(/chronological order/);
    });

    it("skips null values (semantics do not constrain them)", () => {
      const a = new Date("2026-08-02T00:00:00Z");
      expect(() => assertNonDecreasing("t", null, a, undefined)).not.toThrow();
      expect(() => assertNonDecreasing("t", a, null, undefined)).not.toThrow();
    });
  });
});
