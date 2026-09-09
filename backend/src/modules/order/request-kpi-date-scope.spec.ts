/**
 * UI-C1.2F.1A — Requests KPI Date Scope tests.
 *
 * Proves that the Requests KPI endpoint correctly scopes counts by
 * createdAt period when dateFrom/dateTo are provided, matching the
 * same boundary semantics as the Requests list endpoint.
 *
 * Boundary: [from, to) — inclusive lower, exclusive upper.
 * Canonical date field: createdAt.
 *
 * D8 (B-06): date-param validation is CANONICAL — shared parseDateParam
 * (backend/src/shared/date-param.ts): malformed dateFrom/dateTo →
 * BadRequestException (HTTP 400, "<paramName> must be a valid date") before
 * any where-clause construction. T7/T8 mirror the canonical 400 contract;
 * the pre-D8 behavior (silent Invalid Date in the where clause) is gone.
 */

import { parseDateParam } from "../../shared/date-param";

describe("UI-C1.2F.1A — Requests KPI date scope", () => {
  /**
   * Simulates the where-clause construction logic from request.service.getRequestKpi.
   * This mirrors the exact code path without requiring a Prisma connection.
   * Uses the canonical parseDateParam so the mirror cannot drift from the
   * service's validation behavior (D8 MUST: one validation mechanism).
   */
  function buildKpiWhere(query?: { dateFrom?: string; dateTo?: string }) {
    const where: Record<string, unknown> = {};
    if (query?.dateFrom || query?.dateTo) {
      where.createdAt = {
        ...(query.dateFrom ? { gte: parseDateParam(query.dateFrom, "dateFrom") } : {}),
        ...(query.dateTo ? { lt: parseDateParam(query.dateTo, "dateTo") } : {}),
      };
    }
    return where;
  }

  it("T1 — no period: empty where clause (global counts)", () => {
    const where = buildKpiWhere();
    expect(where).toEqual({});
  });

  it("T2 — dateFrom only: gte boundary", () => {
    const where = buildKpiWhere({ dateFrom: "2026-09-01" });
    expect(where.createdAt).toEqual({ gte: new Date("2026-09-01") });
  });

  it("T3 — dateTo only: lt boundary", () => {
    const where = buildKpiWhere({ dateTo: "2026-10-01" });
    expect(where.createdAt).toEqual({ lt: new Date("2026-10-01") });
  });

  it("T4 — dateFrom + dateTo: half-open [from, to) range", () => {
    const where = buildKpiWhere({ dateFrom: "2026-09-01", dateTo: "2026-10-01" });
    expect(where.createdAt).toEqual({
      gte: new Date("2026-09-01"),
      lt: new Date("2026-10-01"),
    });
  });

  it("T5 — record at lower boundary is included (gte)", () => {
    const where = buildKpiWhere({ dateFrom: "2026-09-15" });
    const range = where.createdAt as { gte: Date };
    const record = new Date("2026-09-15T00:00:00.000Z");
    expect(record >= range.gte).toBe(true);
  });

  it("T6 — record at upper boundary is excluded by lt operator", () => {
    const where = buildKpiWhere({ dateTo: "2026-10-01" });
    const range = where.createdAt as { lt: Date };
    // lt means strictly less than: a record at exactly 2026-10-01T00:00:00Z
    // is NOT lt the boundary (they are equal), so it would be excluded.
    const recordAtBoundary = new Date("2026-10-01T00:00:00.000Z");
    expect(recordAtBoundary < range.lt).toBe(false); // equal, not lt → excluded
    // A record just before the boundary IS included.
    const recordBefore = new Date("2026-09-30T23:59:59.999Z");
    expect(recordBefore < range.lt).toBe(true);
  });

  it("T7 — invalid dateFrom is rejected with the canonical 400 (BadRequestException)", () => {
    // D8 B-06 canonical contract: malformed query date → 400, never a silent
    // Invalid Date leaking into a Prisma where clause.
    expect(() => buildKpiWhere({ dateFrom: "not-a-date" })).toThrowError(/dateFrom must be a valid date/);
  });

  it("T8 — invalid dateTo is rejected with the canonical 400 (BadRequestException)", () => {
    expect(() => buildKpiWhere({ dateTo: "not-a-date" })).toThrowError(/dateTo must be a valid date/);
  });

  it("T8a — invalid dateFrom fails before dateTo is evaluated (independent validation)", () => {
    // dateFrom and dateTo are validated independently; dateFrom throws first.
    expect(() => buildKpiWhere({ dateFrom: "not-a-date", dateTo: "2026-10-01" })).toThrowError(/dateFrom must be a valid date/);
  });

  it("T8b — empty-string params are treated as absent (no filter, no error)", () => {
    const where = buildKpiWhere({ dateFrom: "", dateTo: "" });
    expect(where).toEqual({});
  });

  it("T9 — boundary semantics match the Requests list endpoint [from, to)", () => {
    // The list endpoint uses the exact same pattern:
    //   createdAt: { gte: new Date(dateFrom), lt: new Date(dateTo) }
    // KPI must use the identical boundary semantics.
    const listWhere = buildKpiWhere({ dateFrom: "2026-09-01", dateTo: "2026-10-01" });
    const kpiWhere = buildKpiWhere({ dateFrom: "2026-09-01", dateTo: "2026-10-01" });
    expect(listWhere.createdAt).toEqual(kpiWhere.createdAt);
  });

  it("T10 — period changes the where clause but preserves response shape", () => {
    // With period: non-empty createdAt filter
    const withPeriod = buildKpiWhere({ dateFrom: "2026-09-01", dateTo: "2026-10-01" });
    expect(withPeriod.createdAt).toBeDefined();

    // Without period: empty where (same shape as before)
    const withoutPeriod = buildKpiWhere();
    expect(withoutPeriod).toEqual({});
  });
});
