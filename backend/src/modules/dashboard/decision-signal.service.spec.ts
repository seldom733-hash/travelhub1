// ─── Decision Signal Service — Unit Tests ────────────────────────────────────
// Stage B Foundation: fingerprint, dedup, lifecycle, transitions, RBAC.

import { Test, TestingModule } from "@nestjs/testing";
import { NotFoundException, ForbiddenException, BadRequestException } from "@nestjs/common";
import { DecisionSignalService } from "./decision-signal.service";
import { PrismaService } from "../../prisma/prisma.service";

// ── Mock Prisma ─────────────────────────────────────────────────────────────

const createMockPrisma = () => ({
  decisionSignal: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
});

// ── Helper: mock signal row ──────────────────────────────────────────────────

const mockSignalRow = (overrides: Record<string, any> = {}) => ({
  id: "signal-1",
  code: "BOOKING_CONFIRMATION_DELAY",
  category: "OPERATIONAL",
  status: "OPEN",
  source: "pending_booking_confirmation_sla",
  fingerprint: "ds:pending_booking_confirmation_sla:BOOKING:_all_pending",
  affectedEntities: [{ entityType: "BOOKING", entityId: "BKG-0001" }],
  evidence: [{ key: "pendingConfirmationCount", value: 12, source: "booking.BOOKING", observedAt: new Date().toISOString() }],
  firstDetectedAt: new Date("2026-08-23T10:00:00Z"),
  lastDetectedAt: new Date("2026-08-23T10:00:00Z"),
  observationCount: 1,
  acknowledgedAt: null,
  acknowledgedBy: null,
  resolvedAt: null,
  resolvedBy: null,
  dismissedAt: null,
  dismissedBy: null,
  createdAt: new Date("2026-08-23T10:00:00Z"),
  updatedAt: new Date("2026-08-23T10:00:00Z"),
  ...overrides,
});

// ── Tests ───────────────────────────────────────────────────────────────────

describe("DecisionSignalService", () => {
  let service: DecisionSignalService;
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeEach(async () => {
    prisma = createMockPrisma();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DecisionSignalService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(DecisionSignalService);
  });

  // ── Fingerprint ─────────────────────────────────────────────────────────

  describe("generateFingerprint", () => {
    it("generates deterministic fingerprint", () => {
      const fp1 = DecisionSignalService.generateFingerprint("detector-a", [
        { entityType: "BOOKING", entityId: "BKG-001" },
      ]);
      const fp2 = DecisionSignalService.generateFingerprint("detector-a", [
        { entityType: "BOOKING", entityId: "BKG-001" },
      ]);
      expect(fp1).toBe(fp2);
    });

    it("different detectors produce different fingerprints", () => {
      const fp1 = DecisionSignalService.generateFingerprint("detector-a", []);
      const fp2 = DecisionSignalService.generateFingerprint("detector-b", []);
      expect(fp1).not.toBe(fp2);
    });

    it("different entities produce different fingerprints", () => {
      const fp1 = DecisionSignalService.generateFingerprint("det", [
        { entityType: "BOOKING", entityId: "A" },
      ]);
      const fp2 = DecisionSignalService.generateFingerprint("det", [
        { entityType: "BOOKING", entityId: "B" },
      ]);
      expect(fp1).not.toBe(fp2);
    });

    it("order of entities does not matter", () => {
      const fp1 = DecisionSignalService.generateFingerprint("det", [
        { entityType: "BOOKING", entityId: "B" },
        { entityType: "ORDER", entityId: "A" },
      ]);
      const fp2 = DecisionSignalService.generateFingerprint("det", [
        { entityType: "ORDER", entityId: "A" },
        { entityType: "BOOKING", entityId: "B" },
      ]);
      expect(fp1).toBe(fp2);
    });

    it("empty entities produce global fingerprint", () => {
      const fp = DecisionSignalService.generateFingerprint("det", []);
      expect(fp).toBe("ds:det:_global");
    });
  });

  // ── List / RBAC ────────────────────────────────────────────────────────

  describe("listSignals", () => {
    it("returns empty for user with no section permissions", async () => {
      prisma.decisionSignal.findMany.mockResolvedValue([]);
      prisma.decisionSignal.count.mockResolvedValue(0);

      const result = await service.listSignals({}, ["analytics.read"]);
      expect(result.signals).toEqual([]);
      expect(prisma.decisionSignal.findMany).not.toHaveBeenCalled();
    });

    it("returns signals for OPERATIONAL category user", async () => {
      const row = mockSignalRow();
      prisma.decisionSignal.findMany.mockResolvedValue([row]);
      prisma.decisionSignal.count.mockResolvedValue(1);

      const result = await service.listSignals({}, ["dashboard.operational.read"]);
      expect(result.signals).toHaveLength(1);
      expect(result.signals[0].code).toBe("BOOKING_CONFIRMATION_DELAY");
    });

    it("filters by status when provided", async () => {
      prisma.decisionSignal.findMany.mockResolvedValue([]);
      prisma.decisionSignal.count.mockResolvedValue(0);

      await service.listSignals({ status: "OPEN" }, ["dashboard.financial.read"]);
      const where = prisma.decisionSignal.findMany.mock.calls[0][0].where;
      expect(where.status).toBe("OPEN");
    });

    it("throws ForbiddenException for unauthorized category filter", async () => {
      await expect(
        service.listSignals({ category: "FINANCIAL" }, ["dashboard.operational.read"]),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ── Get ────────────────────────────────────────────────────────────────

  describe("getSignal", () => {
    it("returns signal for authorized user", async () => {
      prisma.decisionSignal.findUnique.mockResolvedValue(mockSignalRow());

      const result = await service.getSignal("signal-1", ["dashboard.operational.read"]);
      expect(result.id).toBe("signal-1");
    });

    it("throws NotFoundException for missing signal", async () => {
      prisma.decisionSignal.findUnique.mockResolvedValue(null);

      await expect(
        service.getSignal("missing", ["dashboard.operational.read"]),
      ).rejects.toThrow(NotFoundException);
    });

    it("throws ForbiddenException for unauthorized category", async () => {
      prisma.decisionSignal.findUnique.mockResolvedValue(
        mockSignalRow({ category: "FINANCIAL" }),
      );

      await expect(
        service.getSignal("signal-1", ["dashboard.operational.read"]),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ── Lifecycle Transitions ──────────────────────────────────────────────

  describe("acknowledge", () => {
    it("transitions OPEN → ACKNOWLEDGED", async () => {
      prisma.decisionSignal.findUnique.mockResolvedValue(mockSignalRow());
      prisma.decisionSignal.update.mockResolvedValue(
        mockSignalRow({ status: "ACKNOWLEDGED", acknowledgedAt: new Date(), acknowledgedBy: "admin" }),
      );

      const result = await service.acknowledge(
        "signal-1",
        {},
        "user-1",
        "admin",
        ["dashboard.operational.read"],
      );
      expect(result.status).toBe("ACKNOWLEDGED");
      expect(result.acknowledgedBy).toBe("admin");
    });

    it("rejects ACKNOWLEDGED on non-OPEN signal", async () => {
      prisma.decisionSignal.findUnique.mockResolvedValue(
        mockSignalRow({ status: "ACKNOWLEDGED" }),
      );

      await expect(
        service.acknowledge("signal-1", {}, "user-1", "admin", ["dashboard.operational.read"]),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe("resolve", () => {
    it("transitions OPEN → RESOLVED", async () => {
      prisma.decisionSignal.findUnique.mockResolvedValue(mockSignalRow());
      prisma.decisionSignal.update.mockResolvedValue(
        mockSignalRow({ status: "RESOLVED", resolvedAt: new Date(), resolvedBy: "admin" }),
      );

      const result = await service.resolve(
        "signal-1",
        {},
        "user-1",
        "admin",
        ["dashboard.operational.read"],
      );
      expect(result.status).toBe("RESOLVED");
      expect(result.resolvedBy).toBe("admin");
    });

    it("transitions ACKNOWLEDGED → RESOLVED", async () => {
      prisma.decisionSignal.findUnique.mockResolvedValue(
        mockSignalRow({ status: "ACKNOWLEDGED" }),
      );
      prisma.decisionSignal.update.mockResolvedValue(
        mockSignalRow({ status: "RESOLVED", resolvedAt: new Date(), resolvedBy: "admin" }),
      );

      const result = await service.resolve(
        "signal-1",
        {},
        "user-1",
        "admin",
        ["dashboard.operational.read"],
      );
      expect(result.status).toBe("RESOLVED");
    });

    it("rejects RESOLVED on DISMISSED signal", async () => {
      prisma.decisionSignal.findUnique.mockResolvedValue(
        mockSignalRow({ status: "DISMISSED" }),
      );

      await expect(
        service.resolve("signal-1", {}, "user-1", "admin", ["dashboard.operational.read"]),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe("dismiss", () => {
    it("transitions OPEN → DISMISSED", async () => {
      prisma.decisionSignal.findUnique.mockResolvedValue(mockSignalRow());
      prisma.decisionSignal.update.mockResolvedValue(
        mockSignalRow({ status: "DISMISSED", dismissedAt: new Date(), dismissedBy: "admin" }),
      );

      const result = await service.dismiss(
        "signal-1",
        {},
        "user-1",
        "admin",
        ["dashboard.operational.read"],
      );
      expect(result.status).toBe("DISMISSED");
      expect(result.dismissedBy).toBe("admin");
    });
  });

  // ── RBAC enforcement on mutations ──────────────────────────────────────

  describe("RBAC on mutations", () => {
    it("rejects acknowledge for wrong category", async () => {
      prisma.decisionSignal.findUnique.mockResolvedValue(
        mockSignalRow({ category: "CATALOG" }),
      );

      await expect(
        service.acknowledge("signal-1", {}, "user-1", "admin", ["dashboard.operational.read"]),
      ).rejects.toThrow(ForbiddenException);
    });

    it("rejects resolve for missing signal", async () => {
      prisma.decisionSignal.findUnique.mockResolvedValue(null);

      await expect(
        service.resolve("signal-1", {}, "user-1", "admin", ["dashboard.operational.read"]),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── Detector Orchestration ─────────────────────────────────────────────

  describe("runDetector", () => {
    it("creates new signal from detection", async () => {
      prisma.decisionSignal.findUnique.mockResolvedValue(null);
      prisma.decisionSignal.create.mockResolvedValue(mockSignalRow());

      const detector = {
        key: "test-detector",
        detect: jest.fn().mockResolvedValue([
          {
            code: "TEST_SIGNAL",
            category: "OPERATIONAL",
            fingerprint: "ds:test-detector:BOOKING:BKG-001",
            affectedEntities: [{ entityType: "BOOKING", entityId: "BKG-001" }],
            evidence: [{ key: "count", value: 5, source: "test", observedAt: new Date().toISOString() }],
          },
        ]),
      };

      const results = await service.runDetector(detector);
      expect(results).toHaveLength(1);
      expect(prisma.decisionSignal.create).toHaveBeenCalled();
    });

    it("reobserves same fingerprint without duplicating", async () => {
      const existing = mockSignalRow({ observationCount: 1 });
      prisma.decisionSignal.findUnique.mockResolvedValue(existing);
      prisma.decisionSignal.update.mockResolvedValue(
        mockSignalRow({ observationCount: 2 }),
      );

      const detector = {
        key: "test-detector",
        detect: jest.fn().mockResolvedValue([
          {
            code: "TEST_SIGNAL",
            category: "OPERATIONAL",
            fingerprint: existing.fingerprint,
            affectedEntities: [{ entityType: "BOOKING", entityId: "BKG-001" }],
            evidence: [{ key: "count", value: 5, source: "test", observedAt: new Date().toISOString() }],
          },
        ]),
      };

      const results = await service.runDetector(detector);
      expect(results).toHaveLength(1);
      expect(prisma.decisionSignal.create).not.toHaveBeenCalled();
      expect(prisma.decisionSignal.update).toHaveBeenCalled();
    });

    it("reopens RESOLVED signals when condition re-detected", async () => {
      const resolved = mockSignalRow({ status: "RESOLVED" });
      prisma.decisionSignal.findUnique.mockResolvedValue(resolved);
      prisma.decisionSignal.update.mockResolvedValue({ ...resolved, status: "OPEN" });

      const detector = {
        key: "test-detector",
        detect: jest.fn().mockResolvedValue([
          {
            code: "TEST_SIGNAL",
            category: "OPERATIONAL",
            fingerprint: resolved.fingerprint,
            affectedEntities: [{ entityType: "BOOKING", entityId: "BKG-001" }],
            evidence: [{ key: "count", value: 5, source: "test", observedAt: new Date().toISOString() }],
          },
        ]),
      };

      const results = await service.runDetector(detector);
      expect(results).toHaveLength(1);
      // Reopens existing RESOLVED signal (canonical re-observation)
      expect(prisma.decisionSignal.update).toHaveBeenCalled();
      expect(prisma.decisionSignal.create).not.toHaveBeenCalled();
    });
  });

  // ── Direct list calls Prisma ───────────────────────────────────────────

  describe("listSignals actual Prisma calls", () => {
    it("calls findMany with correct where for OPERATIONAL user", async () => {
      prisma.decisionSignal.findMany.mockResolvedValue([]);
      prisma.decisionSignal.count.mockResolvedValue(0);

      await service.listSignals({}, ["dashboard.operational.read"]);
      const call = prisma.decisionSignal.findMany.mock.calls[0][0];
      expect(call.where.category).toEqual({ in: expect.arrayContaining(["OPERATIONAL"]) });
    });

    it("Admin sees all categories", async () => {
      prisma.decisionSignal.findMany.mockResolvedValue([]);
      prisma.decisionSignal.count.mockResolvedValue(0);

      await service.listSignals({}, [
        "dashboard.executive.read",
        "dashboard.operational.read",
        "dashboard.financial.read",
        "dashboard.marketplace.read",
        "dashboard.catalog.read",
        "dashboard.channels.read",
        "dashboard.attention.read",
        "dashboard.insights.read",
      ]);
      const call = prisma.decisionSignal.findMany.mock.calls[0][0];
      expect(call.where.category.in).toHaveLength(4); // all categories
    });
  });
});
