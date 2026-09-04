/**
 * UI-C1.2D — Bookings KPI overview scope unit tests.
 *
 * Proves the server-side scope contract that keeps the 13 BookingStatus KPI
 * cards stable (Requests-style interaction): the KPI-card dimension `status`
 * (explicit filter + upcoming/overdue detector status predicates) filters the
 * TABLE only, while the OVERVIEW aggregate scope keeps every global registry
 * scope dimension — search, channel/orderId, date range, and the detectors'
 * temporal predicates (serviceDate / createdAt thresholds).
 */
import { overviewBookingWhere } from "./booking-kpi-scope";

describe("UI-C1.2D — Bookings KPI overview scope", () => {
  it("drops a top-level BookingStatus dimension (plain single status filter)", () => {
    const where = { status: "CONFIRMED" as const, orderId: { in: ["o1", "o2"] } };
    const overview = overviewBookingWhere(where);
    expect(overview).not.toHaveProperty("status");
    expect((overview as { orderId?: unknown }).orderId).toEqual({ in: ["o1", "o2"] });
  });

  it("drops the multi-value comma status form too (table-only filter)", () => {
    const overview = overviewBookingWhere({ status: { in: ["CONFIRMED", "NEW"] } } as never);
    expect(overview).not.toHaveProperty("status");
  });

  it("drops status predicates nested inside AND but keeps non-status AND clauses (channel scope)", () => {
    const where = {
      AND: [{ status: { in: ["CONFIRMED", "NEW"] } }, { orderId: "o1" }, { orderId: { in: ["o1", "o2"] } }],
    };
    const overview = overviewBookingWhere(where as never) as { AND?: unknown };
    const andClauses = Array.isArray(overview.AND) ? overview.AND : [overview.AND];
    const flat = andClauses.filter(Boolean);
    expect(flat).toHaveLength(2);
    for (const clause of flat) {
      expect(clause).not.toHaveProperty("status");
    }
  });

  it("collapses to a bare AND object (or deletes AND) when only status predicates remain", () => {
    const onlyStatus = overviewBookingWhere({ AND: [{ status: "PROBLEM" }] } as never);
    expect(onlyStatus).not.toHaveProperty("AND");
    expect(onlyStatus).not.toHaveProperty("status");
    const singleStatus = overviewBookingWhere({ status: { in: ["NEW", "CONFIRMED"] } } as never);
    expect(singleStatus).toEqual({});
  });

  it("keeps every global registry scope dimension in the overview scope", () => {
    const searchIds = { in: ["b1", "b2"] };
    const serviceDate = { gte: new Date("2026-09-01") };
    const createdAt = { lt: new Date("2026-08-01"), gte: new Date("2026-07-01") };
    const where = {
      status: "AWAITING_CONFIRMATION" as const,
      id: searchIds,
      serviceDate,
      createdAt,
      orderId: { in: ["o1"] },
      AND: [{ orderId: "o9" }, { orderId: { in: ["o1", "o9"] } }],
    };
    const overview = overviewBookingWhere(where as never) as Record<string, unknown>;
    expect(overview).not.toHaveProperty("status");
    expect(overview.id).toEqual(searchIds);
    expect(overview.serviceDate).toEqual(serviceDate);
    expect(overview.createdAt).toEqual(createdAt);
    // channel AND clauses survive the status strip
    expect(overview.AND).toEqual([{ orderId: "o9" }, { orderId: { in: ["o1", "o9"] } }]);
  });

  it("detector temporal predicates scope the overview while their status predicate is excluded", () => {
    // overdue detector: status=AWAITING_CONFIRMATION + createdAt < cutoff (global)
    const where = {
      status: "AWAITING_CONFIRMATION" as const,
      createdAt: { lt: new Date("2026-08-01T00:00:00Z") },
    };
    const overview = overviewBookingWhere(where);
    expect(overview).not.toHaveProperty("status");
    expect((overview as { createdAt?: unknown }).createdAt).toEqual({ lt: new Date("2026-08-01T00:00:00Z") });
  });

  it("does not mutate the original table `where` (shallow copy)", () => {
    const copy = { status: "CONFIRMED" as const, orderId: { in: ["o1"] } };
    overviewBookingWhere(copy);
    expect(copy).toEqual({ status: "CONFIRMED", orderId: { in: ["o1"] } });
  });

  it("with no BookingStatus dimension selected the overview scope equals the table scope", () => {
    const noKpi = { search: "x", createdAt: { gte: new Date("2026-08-01") }, orderId: { in: ["o1"] } };
    const overview = overviewBookingWhere(noKpi);
    expect(overview).toEqual(noKpi);
  });
});
