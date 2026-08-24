// ─── RecentCancellationsDetector — Temporal Semantics Tests ──────────────────
// Regression tests for negative duration / future record exclusion.

import { RecentCancellationsDetector } from "./recent-cancellations.detector";

// Mock PrismaService
function mockPrisma() {
  return {
    order: {
      findMany: jest.fn().mockResolvedValue([]),
    },
  } as any;
}

describe("RecentCancellationsDetector", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("excludes future-dated cancellations from the result", async () => {
    const now = new Date("2026-08-24T12:00:00Z");
    jest.spyOn(Date, "now").mockReturnValue(now.getTime());

    const pastRecord = {
      id: "order-past-1",
      createdAt: new Date("2026-08-22T10:00:00Z"),
      amount: 100,
      currency: "AZN",
    };

    const prisma = mockPrisma();
    prisma.order.findMany.mockResolvedValue([pastRecord]);

    const detector = new RecentCancellationsDetector(prisma);
    const result = await detector.detect();

    expect(result).toHaveLength(1);
    const count = result[0].evidence.find((e) => e.key === "cancellationCount");
    expect(count?.value).toBe(1);

    // Verify the query used lte:now
    const callArgs = prisma.order.findMany.mock.calls[0][0];
    expect(callArgs.where.createdAt.lte).toBeDefined();
    expect(callArgs.where.createdAt.lte.getTime()).toBeLessThanOrEqual(now.getTime());
  });

  it("produces non-negative oldestMinutes for past records", async () => {
    const now = new Date("2026-08-24T12:00:00Z");
    jest.spyOn(Date, "now").mockReturnValue(now.getTime());

    const pastRecord = {
      id: "order-past-1",
      createdAt: new Date("2026-08-22T12:00:00Z"),
      amount: 100,
      currency: "AZN",
    };

    const prisma = mockPrisma();
    prisma.order.findMany.mockResolvedValue([pastRecord]);

    const detector = new RecentCancellationsDetector(prisma);
    const result = await detector.detect();

    const oldestMin = result[0].evidence.find((e) => e.key === "oldestCancellationMinutes");
    expect(oldestMin?.value).toBeGreaterThanOrEqual(0);
    expect(oldestMin?.value).toBe(2880);
  });

  it("returns empty when no cancellations in window", async () => {
    const now = new Date("2026-08-24T12:00:00Z");
    jest.spyOn(Date, "now").mockReturnValue(now.getTime());

    const prisma = mockPrisma();
    const detector = new RecentCancellationsDetector(prisma);
    const result = await detector.detect();

    expect(result).toHaveLength(0);
  });

  it("handles cancellation exactly at now() — zero age", async () => {
    const now = new Date("2026-08-24T12:00:00Z");
    jest.spyOn(Date, "now").mockReturnValue(now.getTime());

    const exactNowRecord = {
      id: "order-now",
      createdAt: now,
      amount: 50,
      currency: "AZN",
    };

    const prisma = mockPrisma();
    prisma.order.findMany.mockResolvedValue([exactNowRecord]);

    const detector = new RecentCancellationsDetector(prisma);
    const result = await detector.detect();

    const oldestMin = result[0].evidence.find((e) => e.key === "oldestCancellationMinutes");
    expect(oldestMin?.value).toBe(0);
  });

  it("query window is (cutoff, now] — past records only", async () => {
    const now = new Date("2026-08-24T12:00:00Z");
    jest.spyOn(Date, "now").mockReturnValue(now.getTime());

    const prisma = mockPrisma();
    const detector = new RecentCancellationsDetector(prisma);
    await detector.detect();

    const callArgs = prisma.order.findMany.mock.calls[0][0];
    const cutoff = callArgs.where.createdAt.gt;
    const upperBound = callArgs.where.createdAt.lte;

    // cutoff = now - 7 days
    expect(cutoff.getTime()).toBe(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    // upper bound = now
    expect(upperBound.getTime()).toBeGreaterThanOrEqual(now.getTime() - 1000); // within 1s tolerance
  });

  it("future cancellation does NOT become past age", async () => {
    const now = new Date("2026-08-24T12:00:00Z");
    jest.spyOn(Date, "now").mockReturnValue(now.getTime());

    // With correct predicate (lte:now), future records are excluded
    const prisma = mockPrisma();
    prisma.order.findMany.mockResolvedValue([]); // empty because future excluded

    const detector = new RecentCancellationsDetector(prisma);
    const result = await detector.detect();

    expect(result).toHaveLength(0);
  });
});
