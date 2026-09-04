/**
 * UI-C1.2C REMEDIATION R1 — KPI overview scope unit tests.
 *
 * Proves the server-side scope contract that keeps Orders KPI overview counts
 * stable: a clicked KPI card (status / paymentStatus) filters the TABLE only;
 * the overview aggregate scope drops exactly the KPI-card dimensions and keeps
 * the global registry scope dimensions (search, period, detector, customer,
 * acquisitionSource/tenant).
 */
import { overviewOrderWhere } from "./order-kpi-scope";

describe("UI-C1.2C REMEDIATION R1 — Orders KPI overview scope", () => {
  const search = { OR: [{ code: { contains: "TH", mode: "insensitive" } }, { number: { contains: "TH", mode: "insensitive" } }] };
  const createdAt = { gte: new Date("2026-08-01"), lt: new Date("2026-09-01") };
  const detectorIds = { in: ["o1", "o2"] };
  const baseWhere: Record<string, unknown> = {
    status: "PROBLEM",
    paymentStatus: "PAID",
    search,
    customerId: "c1",
    createdAt,
    id: detectorIds,
    acquisitionSource: "MARKETPLACE",
  };

  it("drops the lifecycle status dimension from the overview scope", () => {
    const overview = overviewOrderWhere(baseWhere as never);
    expect(overview).not.toHaveProperty("status");
  });

  it("drops the paymentStatus dimension from the overview scope", () => {
    const overview = overviewOrderWhere(baseWhere as never);
    expect(overview).not.toHaveProperty("paymentStatus");
  });

  it("supports the multi-value comma status form too (table-only filter)", () => {
    const overview = overviewOrderWhere({ ...baseWhere, status: { in: ["FULFILLED", "CLOSED"] } } as never);
    expect(overview).not.toHaveProperty("status");
    expect(overview).not.toHaveProperty("paymentStatus");
  });

  it("keeps every global registry scope dimension in the overview scope", () => {
    const overview = overviewOrderWhere(baseWhere as never) as Record<string, unknown>;
    expect(overview.search).toEqual(search);
    expect(overview.customerId).toBe("c1");
    expect(overview.createdAt).toBe(createdAt);
    expect(overview.id).toBe(detectorIds);
    expect(overview.acquisitionSource).toBe("MARKETPLACE");
  });

  it("does not mutate the original table `where` (shallow copy)", () => {
    const copy = { ...baseWhere };
    overviewOrderWhere(baseWhere as never);
    expect(baseWhere).toEqual(copy);
    expect(baseWhere).toHaveProperty("status", "PROBLEM");
    expect(baseWhere).toHaveProperty("paymentStatus", "PAID");
  });

  it("with no KPI-card dimension selected the overview scope equals the table scope", () => {
    const noKpi = { search, createdAt, acquisitionSource: "MARKETPLACE" };
    const overview = overviewOrderWhere(noKpi as never);
    expect(overview).toEqual(noKpi);
  });
});
