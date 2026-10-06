/**
 * Supplier Markup (STRICT PROMPT Phase 1 §29/§30) — MarkupRuleService unit tests.
 *
 * Покрытие обязательного тест-матрица (§30 «Rule resolution»/конфликты/история):
 *  - rate contract: 0.05 = 5% (доля, НЕ «5»); explicit «0» валиден (отличим от
 *    NOT_CONFIGURED); percent-as-number/scientific/whitespace — reject;
 *  - key contract: supplierCode/serviceType — точные registry-токены;
 *  - lifecycle CAS: update ТОЛЬКО в DRAFT; activate overlap → 409;
 *  - optimistic concurrency: expectedVersion stale → 409 (§32);
 *  - resolver: 0 активных → NOT_CONFIGURED; найдено → CONFIGURED-данные;
 *    >1 → fail-closed NOT_CONFIGURED (backstop);
 *  - history на каждую мутацию; P2002 → контролируемый 409.
 */
import { Prisma } from "../../generated/prisma/client";
import { MarkupRuleStatus } from "../../generated/prisma/enums";
import { ConflictError, NotFoundError, ValidationDomainError } from "../../shared/errors";
import { MarkupRuleService } from "./markup-rule.service";
import type { PrismaService } from "../../prisma/prisma.service";
import type { IdsService } from "../../shared/ids.service";
import type { SecurityService } from "../../security/security.service";

interface PrismaStub {
  markupRule: {
    findUnique: jest.Mock;
    findUniqueOrThrow: jest.Mock;
    findFirst: jest.Mock;
    findMany: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    count: jest.Mock;
  };
  markupRuleHistory: { create: jest.Mock; findMany: jest.Mock };
  $executeRaw: jest.Mock;
  $transaction: jest.Mock;
}

const ACTOR = { id: "u1", username: "admin" };

function ruleRow(overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    id: "mkr-1",
    code: "MKR-00000001",
    supplierCode: "SUMMERTOUR",
    serviceType: "tours",
    rate: new Prisma.Decimal("0.050000"),
    status: MarkupRuleStatus.DRAFT,
    version: 1,
    effectiveFrom: new Date("2026-10-01T00:00:00Z"),
    effectiveTo: null,
    createdAt: new Date("2026-10-01T00:00:00Z"),
    updatedAt: new Date("2026-10-01T00:00:00Z"),
    ...overrides,
  };
}

function makePrismaStub(): PrismaStub {
  const prisma: PrismaStub = {
    markupRule: {
      findUnique: jest.fn().mockResolvedValue(null),
      findUniqueOrThrow: jest.fn().mockResolvedValue(ruleRow()),
      findFirst: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockResolvedValue(ruleRow({ createdAt: new Date() })),
      update: jest.fn().mockImplementation(async (opts: { data: Record<string, unknown> }) => ruleRow({ ...opts.data })),
      count: jest.fn().mockResolvedValue(1),
    },
    markupRuleHistory: {
      create: jest.fn().mockResolvedValue({}),
      findMany: jest.fn().mockResolvedValue([]),
    },
    $executeRaw: jest.fn().mockResolvedValue(undefined),
    $transaction: jest.fn().mockImplementation(async (fn: (tx: PrismaStub) => Promise<unknown>) => fn(prisma)),
  };
  return prisma;
}

function makeService(prisma: PrismaStub): MarkupRuleService {
  return new MarkupRuleService(
    prisma as unknown as PrismaService,
    { nextCode: jest.fn().mockResolvedValue("MKR-00000001") } as unknown as IdsService,
    { audit: jest.fn().mockResolvedValue(undefined) } as unknown as SecurityService,
  );
}

const CREATE_BASE = { supplierCode: "SUMMERTOUR", serviceType: "tours", effectiveFrom: "2026-10-01T00:00:00Z" };

describe("MarkupRuleService (Supplier Markup Phase 1)", () => {
  describe("rate contract (0.05 = 5%, explicit 0 allowed)", () => {
    const svc = makeService(makePrismaStub());
    it("accepts canonical fraction 0.05 = 5%", async () => {
      await expect(svc.create({ ...CREATE_BASE, rate: "0.05" }, ACTOR)).resolves.toBeDefined();
    });
    it("accepts explicit 0 (configured 0%, distinct from NOT_CONFIGURED)", async () => {
      await expect(svc.create({ ...CREATE_BASE, rate: "0" }, ACTOR)).resolves.toBeDefined();
      await expect(svc.create({ ...CREATE_BASE, rate: "0.00" }, ACTOR)).resolves.toBeDefined();
    });
    it("rejects percent-as-number («5» is NOT valid)", async () => {
      await expect(svc.create({ ...CREATE_BASE, rate: "5" }, ACTOR)).rejects.toThrow(ValidationDomainError);
      await expect(svc.create({ ...CREATE_BASE, rate: "10" }, ACTOR)).rejects.toThrow(ValidationDomainError);
    });
    it("rejects negative rate", async () => {
      await expect(svc.create({ ...CREATE_BASE, rate: "-0.05" }, ACTOR)).rejects.toThrow(ValidationDomainError);
    });
    it("rejects excessive scale (> 6 decimals)", async () => {
      await expect(svc.create({ ...CREATE_BASE, rate: "0.1234567" }, ACTOR)).rejects.toThrow(ValidationDomainError);
    });
    it.each(["1e-2", "0.00000015", " 0.05 ", "0.05 ", ".05", "+0.05", "0,05", "abc", ""])(
      "rejects adversarial rate %j (scientific/whitespace/non-canonical)",
      async (rate) => {
        await expect(svc.create({ ...CREATE_BASE, rate }, ACTOR)).rejects.toThrow(ValidationDomainError);
      },
    );
    it.each(["0.000001", "0.999999", "0.5", "0.150000"])("accepts canonical boundary rate %j", async (rate) => {
      await expect(svc.create({ ...CREATE_BASE, rate }, ACTOR)).resolves.toBeDefined();
    });
  });

  describe("key contract (registry supplierCode + serviceType)", () => {
    const svc = makeService(makePrismaStub());
    it("rejects empty/malformed supplierCode", async () => {
      for (const supplierCode of ["", "BAD CODE", "SUMMERTOUR; DROP", "@@"]) {
        await expect(svc.create({ ...CREATE_BASE, supplierCode, rate: "0.05" }, ACTOR)).rejects.toThrow(ValidationDomainError);
      }
    });
    it("rejects uppercase/non-token serviceType (must be registry capability token)", async () => {
      for (const serviceType of ["Tours", "Tour S", ""]) {
        await expect(svc.create({ ...CREATE_BASE, serviceType, rate: "0.05" }, ACTOR)).rejects.toThrow(ValidationDomainError);
      }
    });
    it("accepts future capability tokens without migration (Gate A groundwork)", async () => {
      await expect(svc.create({ supplierCode: "NEWSUP", serviceType: "transfers", rate: "0.07" }, ACTOR)).resolves.toBeDefined();
    });
  });

  describe("effective period + lifecycle CAS", () => {
    it("rejects effectiveTo <= effectiveFrom", async () => {
      const svc = makeService(makePrismaStub());
      await expect(
        svc.create({ ...CREATE_BASE, rate: "0.05", effectiveFrom: "2026-10-02T00:00:00Z", effectiveTo: "2026-10-01T00:00:00Z" }, ACTOR),
      ).rejects.toThrow(ValidationDomainError);
    });
    it("update only in DRAFT (ACTIVE immutable → new rule)", async () => {
      const prisma = makePrismaStub();
      prisma.markupRule.findUnique.mockResolvedValue(ruleRow({ status: MarkupRuleStatus.ACTIVE }));
      prisma.markupRule.findUniqueOrThrow.mockResolvedValue(ruleRow({ status: MarkupRuleStatus.ACTIVE }));
      const svc = makeService(prisma);
      await expect(svc.update("MKR-00000001", { rate: "0.07" }, ACTOR)).rejects.toThrow(ValidationDomainError);
    });
    it("stale expectedVersion → controlled ConflictError (§32)", async () => {
      const prisma = makePrismaStub();
      prisma.markupRule.findUnique.mockResolvedValue(ruleRow());
      prisma.markupRule.findUniqueOrThrow.mockResolvedValue(ruleRow({ version: 3 }));
      const svc = makeService(prisma);
      await expect(svc.update("MKR-00000001", { rate: "0.07", expectedVersion: 1 }, ACTOR)).rejects.toThrow(ConflictError);
    });
    it("activate: overlapping ACTIVE rule for same key → 409 (fail-closed)", async () => {
      const prisma = makePrismaStub();
      prisma.markupRule.findUnique.mockResolvedValue(ruleRow());
      prisma.markupRule.findUniqueOrThrow.mockResolvedValue(ruleRow());
      prisma.markupRule.findFirst.mockResolvedValue(ruleRow({ id: "mkr-2", code: "MKR-00000002" }));
      const svc = makeService(prisma);
      await expect(svc.activate("MKR-00000001", ACTOR)).rejects.toThrow(ConflictError);
    });
    it("activate ACTIVE is idempotent no-op", async () => {
      const prisma = makePrismaStub();
      prisma.markupRule.findUnique.mockResolvedValue(ruleRow({ status: MarkupRuleStatus.ACTIVE }));
      prisma.markupRule.findUniqueOrThrow.mockResolvedValue(ruleRow({ status: MarkupRuleStatus.ACTIVE }));
      const svc = makeService(prisma);
      await expect(svc.activate("MKR-00000001", ACTOR)).resolves.toBeDefined();
      expect(prisma.markupRule.update).not.toHaveBeenCalled();
    });
    it("unknown code → NotFoundError", async () => {
      const svc = makeService(makePrismaStub());
      await expect(svc.activate("MKR-99999999", ACTOR)).rejects.toThrow(NotFoundError);
    });
    it("code collision (P2002) → controlled ConflictError", async () => {
      const prisma = makePrismaStub();
      const err = new Error("Unique constraint") as Error & { code: string };
      err.code = "P2002";
      prisma.markupRule.create.mockRejectedValue(err);
      const svc = makeService(prisma);
      await expect(svc.create({ ...CREATE_BASE, rate: "0.05" }, ACTOR)).rejects.toThrow(ConflictError);
    });
  });

  describe("resolver (NOT_CONFIGURED vs configured)", () => {
    it("no active rule → NOT_CONFIGURED (runtime 0%)", async () => {
      const prisma = makePrismaStub();
      prisma.markupRule.findMany.mockResolvedValue([]);
      const svc = makeService(prisma);
      await expect(svc.resolve("SUMMERTOUR", "tours")).resolves.toEqual({ found: false });
    });
    it("single active rule → CONFIGURED with rate/code/version", async () => {
      const prisma = makePrismaStub();
      prisma.markupRule.findMany.mockResolvedValue([
        ruleRow({ rate: new Prisma.Decimal("0.050000"), code: "MKR-00000001", version: 2 }),
      ]);
      const svc = makeService(prisma);
      const res = await svc.resolve("SUMMERTOUR", "tours", new Date("2026-10-05T00:00:00Z"));
      expect(res).toMatchObject({ found: true, ruleCode: "MKR-00000001", ruleVersion: 2 });
      expect((res as { rate: Prisma.Decimal }).rate.toString()).toBe("0.05");
    });
    it("ambiguous (overlapping ACTIVE backstop) → fail-closed NOT_CONFIGURED", async () => {
      const prisma = makePrismaStub();
      prisma.markupRule.findMany.mockResolvedValue([ruleRow({ code: "MKR-00000001" }), ruleRow({ code: "MKR-00000002" })]);
      const svc = makeService(prisma);
      await expect(svc.resolve("SUMMERTOUR", "tours")).resolves.toEqual({ found: false });
    });
    it("effective window: query is bounded by ACTIVE + [effectiveFrom, effectiveTo)", async () => {
      const prisma = makePrismaStub();
      prisma.markupRule.findMany.mockResolvedValue([]);
      const svc = makeService(prisma);
      const at = new Date("2026-10-05T12:00:00Z");
      await svc.resolve("KOMPAS", "tours", at);
      const where = prisma.markupRule.findMany.mock.calls[0][0].where;
      expect(where.status).toBe(MarkupRuleStatus.ACTIVE);
      expect(where.effectiveFrom.lte).toBe(at);
      expect(where.OR).toEqual([{ effectiveTo: null }, { effectiveTo: { gt: at } }]);
    });
    it("validates key syntax (rejects malformed)", async () => {
      const svc = makeService(makePrismaStub());
      await expect(svc.resolve("BAD CODE", "tours")).rejects.toThrow(ValidationDomainError);
      await expect(svc.resolve("SUMMERTOUR", "Tours")).rejects.toThrow(ValidationDomainError);
    });
  });

  describe("history + audit", () => {
    it("create writes MarkupRuleHistory + audit", async () => {
      const prisma = makePrismaStub();
      const audit = jest.fn();
      const svc = new MarkupRuleService(
        prisma as unknown as PrismaService,
        { nextCode: jest.fn().mockResolvedValue("MKR-00000001") } as unknown as IdsService,
        { audit } as unknown as SecurityService,
      );
      await svc.create({ ...CREATE_BASE, rate: "0.05" }, ACTOR);
      expect(prisma.markupRuleHistory.create).toHaveBeenCalledTimes(1);
      expect(audit).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: "pricing.markup_rule.created", resource: "MarkupRule" }));
    });
    it("activate writes history with action=activated", async () => {
      const prisma = makePrismaStub();
      prisma.markupRule.findUnique.mockResolvedValue(ruleRow());
      prisma.markupRule.findUniqueOrThrow.mockResolvedValue(ruleRow());
      const svc = makeService(prisma);
      await svc.activate("MKR-00000001", ACTOR);
      expect(prisma.markupRuleHistory.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ action: "activated" }) }),
      );
    });
    it("history() lists snapshots newest-first", async () => {
      const prisma = makePrismaStub();
      prisma.markupRule.findUnique.mockResolvedValue({ id: "mkr-1" });
      prisma.markupRuleHistory.findMany.mockResolvedValue([
        { id: "h2", action: "activated", version: 2, fields: {}, actorId: "u1", actorName: "admin", comment: "", createdAt: new Date("2026-10-02T00:00:00Z") },
      ]);
      const svc = makeService(prisma);
      const res = await svc.history("MKR-00000001");
      expect(res.items).toHaveLength(1);
      expect(prisma.markupRuleHistory.findMany).toHaveBeenCalledWith(expect.objectContaining({ orderBy: { createdAt: "desc" } }));
    });
  });
});
