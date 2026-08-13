/**
 * PHASE 2 STEP 2.10B — SettlementService unit tests (P2002 edge paths).
 *
 * DB-race coverage, дополняющая e2e (реальный Postgres):
 *  - unknown P2002 (например code-key collision на ProviderFee_code_key) →
 *    controlled ConflictError 409, НЕ молчаливый no-op и НЕ raw Prisma 500;
 *  - P2002 на idempotency-constraint + identical payload → существующий факт
 *    (replay no-op) БЕЗ ложного AuditLog (аудит только в успешном create-пути);
 *  - P2002 на idempotency-constraint + divergent payload → ConflictError 409.
 */
import { Prisma } from "../../generated/prisma/client";
import { ConflictError } from "../../shared/errors";
import { SettlementService } from "./settlement.service";
import type { PrismaService } from "../../prisma/prisma.service";
import type { IdsService } from "../../shared/ids.service";
import type { SecurityService } from "../../security/security.service";

interface PrismaStub {
  currency: { findUnique: jest.Mock };
  providerFee: { findUnique: jest.Mock; create: jest.Mock };
  $transaction: jest.Mock;
}

function makePrismaStub(): PrismaStub {
  const prisma: PrismaStub = {
    currency: { findUnique: jest.fn().mockResolvedValue({ isoCode: "USD" }) },
    providerFee: { findUnique: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({ id: "fee-1" }) },
    $transaction: jest.fn(),
  };
  // По умолчанию транзакция «проходит насквозь» (tx = prisma stub).
  prisma.$transaction = jest.fn((fn: (tx: unknown) => unknown) => fn(prisma));
  return prisma;
}

function makeService(prisma: PrismaStub): SettlementService {
  const ids = { nextCode: jest.fn().mockResolvedValue("PFE-00000001") } as unknown as IdsService;
  const security = { audit: jest.fn().mockResolvedValue(undefined) } as unknown as SecurityService;
  return new SettlementService(prisma as unknown as PrismaService, ids, security);
}

const EXISTING_ROW = {
  id: "fee-1",
  code: "PFE-00000001",
  provider: "STRIPE",
  amount: new Prisma.Decimal("1.50"),
  currency: "USD",
  providerRef: null,
  sourceType: "PAYMENT",
  sourceId: "pay-1",
  correlationId: null,
  causationId: null,
  actorType: null,
  actorId: null,
  createdAt: new Date("2026-08-13T00:00:00Z"),
};

describe("SettlementService — P2002 handling (Step 2.10B)", () => {
  it("unknown P2002 (code-key collision) → controlled ConflictError 409, НЕ no-op и НЕ raw 500", async () => {
    const prisma = makePrismaStub();
    // ProviderFee_code_key — НЕ idempotency-constraint: реплей-путь не применяется.
    prisma.providerFee.create.mockRejectedValue({ code: "P2002", meta: { target: ["ProviderFee_code_key"] } });
    const service = makeService(prisma);

    await expect(
      service.createProviderFee({ provider: "STRIPE", amount: "1.50", currency: "USD", sourceType: "PAYMENT", sourceId: "pay-1" }),
    ).rejects.toThrow(ConflictError);
    // Не маскируется как success: fetchExisting (replay) НЕ вызывается для чужого constraint.
    expect(prisma.providerFee.findUnique).not.toHaveBeenCalled();
  });

  it("identical replay (P2002 на idempotency-ключ) → существующий факт, БЕЗ ложного AuditLog", async () => {
    const prisma = makePrismaStub();
    prisma.providerFee.create.mockRejectedValue({
      code: "P2002",
      meta: { target: ["ProviderFee_sourceType_sourceId_provider_key"] },
    });
    prisma.providerFee.findUnique.mockResolvedValue(EXISTING_ROW);
    const security = { audit: jest.fn().mockResolvedValue(undefined) } as unknown as SecurityService;
    const ids = { nextCode: jest.fn().mockResolvedValue("PFE-00000001") } as unknown as IdsService;
    const service = new SettlementService(prisma as unknown as PrismaService, ids, security);

    const result = await service.createProviderFee({
      provider: "STRIPE",
      amount: "1.50",
      currency: "USD",
      sourceType: "PAYMENT",
      sourceId: "pay-1",
    });

    expect(result.code).toBe("PFE-00000001");
    expect(result.id).toBe("fee-1");
    // Replay не создаёт второй аудит (аудит только в успешном create-пути).
    expect(security.audit).not.toHaveBeenCalled();
  });

  it("divergent replay (amount) → ConflictError 409, первый факт не перезаписывается", async () => {
    const prisma = makePrismaStub();
    prisma.providerFee.create.mockRejectedValue({
      code: "P2002",
      meta: { target: ["ProviderFee_sourceType_sourceId_provider_key"] },
    });
    prisma.providerFee.findUnique.mockResolvedValue(EXISTING_ROW);
    const service = makeService(prisma);

    await expect(
      service.createProviderFee({ provider: "STRIPE", amount: "2.00", currency: "USD", sourceType: "PAYMENT", sourceId: "pay-1" }),
    ).rejects.toThrow(ConflictError);
  });
});
