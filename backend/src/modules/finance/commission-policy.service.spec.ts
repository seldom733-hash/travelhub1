/**
 * PHASE 2 STEP 2.14E — CommissionPolicyService unit tests (ADR-0013).
 * DB-инварианты, дополняющие e2e:
 *  - rate contract: десятичная доля 0 < rate < 1, ≤ 6 знаков (DECIMAL(18,6));
 *  - channel: vocabulary + V1 create-гейт (только MARKETPLACE);
 *  - effective interval: [from, to), to > from;
 *  - lifecycle CAS: update ТОЛЬКО в DRAFT; activate overlap-check → 409;
 *  - resolver: deterministic, NO_COMMISSION_CHANNEL / NO_POLICY / AMBIGUOUS
 *    fail-closed; boundary [effectiveFrom, effectiveTo);
 *  - server-owned version; P2002 (code collision) → controlled 409; unknown → rethrow.
 */
import { Prisma } from "../../generated/prisma/client";
import { CommissionChannel, CommissionPolicyStatus, CommissionRateType } from "../../generated/prisma/enums";
import { ConflictError, NotFoundError, ValidationDomainError } from "../../shared/errors";
import { CommissionPolicyService } from "./commission-policy.service";
import type { PrismaService } from "../../prisma/prisma.service";
import type { IdsService } from "../../shared/ids.service";
import type { SecurityService } from "../../security/security.service";

interface PrismaStub {
  commissionPolicy: {
    findUnique: jest.Mock;
    findUniqueOrThrow: jest.Mock;
    findFirst: jest.Mock;
    findMany: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    count: jest.Mock;
  };
  commissionPolicyHistory: { create: jest.Mock };
  $executeRaw: jest.Mock;
  $transaction: jest.Mock;
}

const ACTOR = { id: "u1", username: "fin1" };

function policyRow(overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    id: "cmp-1",
    code: "CMP-00000001",
    channel: CommissionChannel.MARKETPLACE,
    rateType: CommissionRateType.PERCENTAGE,
    rate: new Prisma.Decimal("0.150000"),
    status: CommissionPolicyStatus.DRAFT,
    version: 1,
    effectiveFrom: new Date("2026-09-01T00:00:00Z"),
    effectiveTo: null,
    createdAt: new Date("2026-08-14T00:00:00Z"),
    updatedAt: new Date("2026-08-14T00:00:00Z"),
    ...overrides,
  };
}

function makePrismaStub(): PrismaStub {
  const prisma: PrismaStub = {
    commissionPolicy: {
      findUnique: jest.fn().mockResolvedValue(null),
      findUniqueOrThrow: jest.fn().mockResolvedValue(policyRow()),
      findFirst: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockResolvedValue(policyRow({ createdAt: new Date() })),
      update: jest.fn().mockImplementation(async (_a: unknown, args: { data: Record<string, unknown> }) => policyRow({ ...args.data })),
      count: jest.fn().mockResolvedValue(1),
    },
    commissionPolicyHistory: { create: jest.fn().mockResolvedValue({}) },
    $executeRaw: jest.fn().mockResolvedValue(undefined),
    $transaction: jest.fn().mockImplementation(async (fn: (tx: PrismaStub) => Promise<unknown>) => fn(prisma)),
  };
  return prisma;
}

function makeService(prisma: PrismaStub): CommissionPolicyService {
  return new CommissionPolicyService(
    prisma as unknown as PrismaService,
    { nextCode: jest.fn().mockResolvedValue("CMP-00000001") } as unknown as IdsService,
    { audit: jest.fn().mockResolvedValue(undefined) } as unknown as SecurityService,
  );
}

describe("CommissionPolicyService (Step 2.14E, ADR-0013)", () => {
  describe("rate contract", () => {
    const svc = makeService(makePrismaStub());
    it("accepts valid decimal fraction (0.15 = 15%)", async () => {
      await expect(svc.create({ channel: "MARKETPLACE", rate: "0.15", effectiveFrom: "2026-09-01T00:00:00Z" }, ACTOR)).resolves.toBeDefined();
    });
    it("rejects rate >= 1 (percent-as-number ambiguity: 10 is NOT valid)", async () => {
      await expect(svc.create({ channel: "MARKETPLACE", rate: "10", effectiveFrom: "2026-09-01T00:00:00Z" }, ACTOR)).rejects.toThrow(ValidationDomainError);
    });
    it("rejects rate <= 0", async () => {
      await expect(svc.create({ channel: "MARKETPLACE", rate: "0", effectiveFrom: "2026-09-01T00:00:00Z" }, ACTOR)).rejects.toThrow(ValidationDomainError);
      await expect(svc.create({ channel: "MARKETPLACE", rate: "-0.05", effectiveFrom: "2026-09-01T00:00:00Z" }, ACTOR)).rejects.toThrow(ValidationDomainError);
    });
    it("rejects excessive scale (> 6 decimals)", async () => {
      await expect(svc.create({ channel: "MARKETPLACE", rate: "0.1234567", effectiveFrom: "2026-09-01T00:00:00Z" }, ACTOR)).rejects.toThrow(ValidationDomainError);
    });
    it("rejects non-numeric rate", async () => {
      await expect(svc.create({ channel: "MARKETPLACE", rate: "abc", effectiveFrom: "2026-09-01T00:00:00Z" }, ACTOR)).rejects.toThrow(ValidationDomainError);
    });
    // STRICT REVIEW 2.14E FIX: научная нотация обходила 6-знаковый предел
    // («1e-7» = 0.0000001 → DECIMAL(18,6) округлял до 0.000000 — молчаливая
    // 0%-policy). Whitespace проходил Number()-трим, но Prisma.Decimal бросал
    // DecimalError → raw 500. Все — контролируемый ValidationDomainError.
    it.each(["1e-7", "1.5e-7", "1e-2", "0.00000015", " 0.15 ", "0.15 ", " 0.15", "0.000000", "0.0", ".15", "+0.15", "0,15"])(
      "rejects adversarial rate %j (scientific/whitespace/non-canonical)",
      async (rate) => {
        await expect(svc.create({ channel: "MARKETPLACE", rate, effectiveFrom: "2026-09-01T00:00:00Z" }, ACTOR)).rejects.toThrow(ValidationDomainError);
      },
    );
    it.each(["0.000001", "0.999999", "0.1", "0.150000"])("accepts canonical boundary rate %j", async (rate) => {
      await expect(svc.create({ channel: "MARKETPLACE", rate, effectiveFrom: "2026-09-01T00:00:00Z" }, ACTOR)).resolves.toBeDefined();
    });
  });

  describe("channel contract", () => {
    const svc = makeService(makePrismaStub());
    it("rejects unknown channel value", async () => {
      await expect(svc.create({ channel: "BITCOIN", rate: "0.10", effectiveFrom: "2026-09-01T00:00:00Z" }, ACTOR)).rejects.toThrow(ValidationDomainError);
    });
    it("rejects no-commission channels in V1 (PARTNER_STOREFRONT/DIRECT/BUYER_REQUEST)", async () => {
      for (const ch of ["PARTNER_STOREFRONT", "DIRECT", "BUYER_REQUEST"]) {
        await expect(svc.create({ channel: ch, rate: "0.10", effectiveFrom: "2026-09-01T00:00:00Z" }, ACTOR)).rejects.toThrow(ValidationDomainError);
      }
    });
  });

  describe("effective interval", () => {
    const svc = makeService(makePrismaStub());
    it("rejects effectiveTo <= effectiveFrom", async () => {
      await expect(svc.create({ channel: "MARKETPLACE", rate: "0.10", effectiveFrom: "2026-09-01T00:00:00Z", effectiveTo: "2026-09-01T00:00:00Z" }, ACTOR)).rejects.toThrow(ValidationDomainError);
      await expect(svc.create({ channel: "MARKETPLACE", rate: "0.10", effectiveFrom: "2026-09-01T00:00:00Z", effectiveTo: "2026-08-01T00:00:00Z" }, ACTOR)).rejects.toThrow(ValidationDomainError);
    });
  });

  describe("P2002 handling", () => {
    it("maps expected unique collision to controlled ConflictError (not raw 500)", async () => {
      const prisma = makePrismaStub();
      prisma.commissionPolicy.create.mockRejectedValueOnce(Object.assign(new Error("P2002"), { code: "P2002" }));
      const svc = makeService(prisma);
      await expect(svc.create({ channel: "MARKETPLACE", rate: "0.10", effectiveFrom: "2026-09-01T00:00:00Z" }, ACTOR)).rejects.toThrow(ConflictError);
    });
    it("rethrows unknown DB errors", async () => {
      const prisma = makePrismaStub();
      prisma.commissionPolicy.create.mockRejectedValueOnce(new Error("connection reset"));
      const svc = makeService(prisma);
      await expect(svc.create({ channel: "MARKETPLACE", rate: "0.10", effectiveFrom: "2026-09-01T00:00:00Z" }, ACTOR)).rejects.toThrow("connection reset");
    });
  });

  describe("version semantics", () => {
    it("increments server-owned version on DRAFT update; rejects update outside DRAFT", async () => {
      const prisma = makePrismaStub();
      prisma.commissionPolicy.findUnique.mockResolvedValue(policyRow());
      prisma.commissionPolicy.findUniqueOrThrow.mockResolvedValue(policyRow({ status: CommissionPolicyStatus.ACTIVE }));
      const svc = makeService(prisma);
      await expect(svc.update("CMP-00000001", { rate: "0.20" }, ACTOR)).rejects.toThrow(ValidationDomainError);

      prisma.commissionPolicy.findUniqueOrThrow.mockResolvedValue(policyRow());
      prisma.commissionPolicy.update.mockResolvedValue(policyRow({ rate: new Prisma.Decimal("0.200000"), version: 2 }));
      const updated = await svc.update("CMP-00000001", { rate: "0.20" }, ACTOR);
      // decimal.js toString срезает хвостовые нули (канон rateDto: rate.toString()).
      expect(updated).toMatchObject({ version: 2, rate: "0.2" });
    });
  });

  describe("overlap invariant (activate)", () => {
    it("rejects activation when another ACTIVE policy overlaps the same channel window", async () => {
      const prisma = makePrismaStub();
      prisma.commissionPolicy.findUnique.mockResolvedValue(policyRow());
      prisma.commissionPolicy.findUniqueOrThrow.mockResolvedValue(policyRow());
      prisma.commissionPolicy.findFirst.mockResolvedValue(policyRow({ id: "cmp-other", code: "CMP-00000002", status: CommissionPolicyStatus.ACTIVE }));
      const svc = makeService(prisma);
      await expect(svc.activate("CMP-00000001", ACTOR)).rejects.toThrow(ConflictError);
    });
    it("activates when no overlap (findFirst = null)", async () => {
      const prisma = makePrismaStub();
      prisma.commissionPolicy.findUnique.mockResolvedValue(policyRow());
      prisma.commissionPolicy.findUniqueOrThrow.mockResolvedValue(policyRow());
      prisma.commissionPolicy.update.mockResolvedValue(policyRow({ status: CommissionPolicyStatus.ACTIVE }));
      const svc = makeService(prisma);
      const row = await svc.activate("CMP-00000001", ACTOR);
      expect(row).toMatchObject({ status: CommissionPolicyStatus.ACTIVE });
    });
  });

  describe("resolver", () => {
    it("returns NO_COMMISSION_CHANNEL for no-commission channels", async () => {
      const prisma = makePrismaStub();
      const svc = makeService(prisma);
      await expect(svc.resolve("DIRECT", "2026-10-01T00:00:00Z")).resolves.toEqual({ found: false, reason: "NO_COMMISSION_CHANNEL" });
      await expect(svc.resolve("PARTNER_STOREFRONT", "2026-10-01T00:00:00Z")).resolves.toEqual({ found: false, reason: "NO_COMMISSION_CHANNEL" });
    });
    it("rejects unknown channel", async () => {
      const svc = makeService(makePrismaStub());
      await expect(svc.resolve("NOPE", "2026-10-01T00:00:00Z")).rejects.toThrow(ValidationDomainError);
    });
    it("returns NO_POLICY when none active/applicable", async () => {
      const prisma = makePrismaStub();
      prisma.commissionPolicy.findMany.mockResolvedValue([]);
      const svc = makeService(prisma);
      await expect(svc.resolve("MARKETPLACE", "2026-10-01T00:00:00Z")).resolves.toEqual({ found: false, reason: "NO_POLICY" });
    });
    it("fail-closed on ambiguity (two applicable ACTIVE policies)", async () => {
      const prisma = makePrismaStub();
      prisma.commissionPolicy.findMany.mockResolvedValue([policyRow(), policyRow({ id: "cmp-2", code: "CMP-00000002" })]);
      const svc = makeService(prisma);
      await expect(svc.resolve("MARKETPLACE", "2026-10-01T00:00:00Z")).resolves.toEqual({ found: false, reason: "AMBIGUOUS" });
    });
    it("finds exactly one ACTIVE policy within [effectiveFrom, effectiveTo)", async () => {
      const prisma = makePrismaStub();
      const row = policyRow({ status: CommissionPolicyStatus.ACTIVE, effectiveFrom: new Date("2026-09-01T00:00:00Z"), effectiveTo: new Date("2026-12-31T00:00:00Z") });
      prisma.commissionPolicy.findMany.mockResolvedValue([row]);
      const svc = makeService(prisma);
      await expect(svc.resolve("MARKETPLACE", "2026-10-01T00:00:00Z")).resolves.toMatchObject({ found: true, reason: "POLICY_FOUND" });
    });
  });

  describe("not-found", () => {
    it("404 for unknown policy (getByCode / update / activate / archive)", async () => {
      const prisma = makePrismaStub();
      prisma.commissionPolicy.findUnique.mockResolvedValue(null);
      const svc = makeService(prisma);
      await expect(svc.getByCode("CMP-99999999")).rejects.toThrow(NotFoundError);
      await expect(svc.update("CMP-99999999", { rate: "0.10" }, ACTOR)).rejects.toThrow(NotFoundError);
      await expect(svc.activate("CMP-99999999", ACTOR)).rejects.toThrow(NotFoundError);
      await expect(svc.archive("CMP-99999999", ACTOR)).rejects.toThrow(NotFoundError);
    });
  });
});
