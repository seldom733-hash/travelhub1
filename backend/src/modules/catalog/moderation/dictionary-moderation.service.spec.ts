import { RoleCode } from "../../../generated/prisma/enums";
import { DictionaryModerationService } from "./dictionary-moderation.service";
import { ConflictError, NotFoundError, ValidationDomainError } from "../../../shared/errors";
import type { AuthUser } from "../../../security/auth/auth.service";
import type { PrismaService } from "../../../prisma/prisma.service";
import type { SecurityService } from "../../../security/security.service";

const MODERATOR: AuthUser = {
  id: "u-mod",
  code: "USR-00000011",
  username: "moderator1",
  email: null,
  fullName: null,
  status: "ACTIVE",
  role: RoleCode.MODERATOR,
  roleTitle: "Модератор",
  partnerId: null,
  customerId: null,
  permissions: ["moderation.review", "moderation.approve", "moderation.reject"],
} as AuthUser;

function makePrisma(overrides: Record<string, unknown> = {}) {
  const prisma: Record<string, any> = {
    roomType: { findUnique: jest.fn(), findMany: jest.fn().mockResolvedValue([]), update: jest.fn(), delete: jest.fn(), count: jest.fn() },
    viewType: { findUnique: jest.fn(), findMany: jest.fn().mockResolvedValue([]), update: jest.fn(), delete: jest.fn(), count: jest.fn() },
    serviceUnit: { count: jest.fn().mockResolvedValue(0), findMany: jest.fn().mockResolvedValue([]), update: jest.fn() },
    tariff: { count: jest.fn().mockResolvedValue(0), findMany: jest.fn().mockResolvedValue([]), update: jest.fn() },
    product: { findUnique: jest.fn() },
    $transaction: jest.fn(),
  };
  prisma.$transaction = jest.fn(async (fn: (tx: unknown) => unknown) => fn(prisma));
  Object.assign(prisma, overrides);
  return prisma;
}

function makeService(prisma: ReturnType<typeof makePrisma>) {
  const security = { audit: jest.fn().mockResolvedValue(undefined) } as unknown as SecurityService;
  return { service: new DictionaryModerationService(prisma as unknown as PrismaService, security), security };
}

describe("DictionaryModerationService", () => {
  it("list: неизвестный тип → 422; PENDING+ACTIVE по умолчанию", async () => {
    const prisma = makePrisma();
    const { service } = makeService(prisma);

    await expect(service.list("bogus")).rejects.toThrow(ValidationDomainError);

    prisma.roomType.findMany.mockResolvedValue([{ id: "r1", code: "X", names: { ru: "X" }, sortOrder: 1, status: "PENDING", createdAt: new Date(), createdBy: "u1" }]);
    const res = await service.list("room-types");
    expect(res.items[0].status).toBe("PENDING");
    expect(res.items[0].usage).toEqual({ units: 0, tariffs: 0 });
    expect(prisma.roomType.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { status: { in: ["ACTIVE", "PENDING"] } } }));
  });

  it("approve: PENDING → ACTIVE + аудит; не PENDING → 409", async () => {
    const prisma = makePrisma();
    prisma.roomType.findUnique.mockResolvedValue({ id: "r1", code: "PANO", names: {}, status: "PENDING" });
    prisma.roomType.update.mockResolvedValue({ id: "r1", code: "PANO", status: "ACTIVE" });
    const { service, security } = makeService(prisma);

    const updated = await service.approve("room-types", "r1", MODERATOR);
    expect(updated.status).toBe("ACTIVE");
    expect(security.audit).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: "moderation.dictionary_approved" }));

    prisma.roomType.findUnique.mockResolvedValue({ id: "r1", code: "PANO", names: {}, status: "ACTIVE" });
    await expect(service.approve("room-types", "r1", MODERATOR)).rejects.toThrow(ConflictError);
  });

  it("reject: используется продуктами → 409 (нужен merge); свободна → delete", async () => {
    const prisma = makePrisma();
    prisma.roomType.findUnique.mockResolvedValue({ id: "r1", code: "PANO", names: {}, status: "PENDING" });
    const { service, security } = makeService(prisma);

    prisma.serviceUnit.count.mockResolvedValue(3);
    await expect(service.reject("room-types", "r1", MODERATOR)).rejects.toThrow(ConflictError);

    prisma.serviceUnit.count.mockResolvedValue(0);
    const res = await service.reject("room-types", "r1", MODERATOR, "дубль");
    expect(res).toEqual({ rejected: "r1", code: "PANO" });
    expect(prisma.roomType.delete).toHaveBeenCalledWith({ where: { id: "r1" } });
    expect(security.audit).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: "moderation.dictionary_rejected" }));
  });

  it("merge: переписывает ссылки unit'ов и удаляет источник", async () => {
    const prisma = makePrisma();
    prisma.roomType.findUnique.mockImplementation(async ({ where }: any) =>
      where.id === "src"
        ? { id: "src", code: "PANO", names: {}, status: "PENDING" }
        : { id: "tgt", code: "STANDART", names: {}, status: "ACTIVE" },
    );
    prisma.serviceUnit.findMany.mockResolvedValue([
      { id: "UNI-1", attributes: { payload: { roomTypeId: "src", other: 1 } } },
      { id: "UNI-2", attributes: { payload: { roomTypeId: "src" } } },
    ]);
    const { service, security } = makeService(prisma);

    const res = await service.merge("room-types", "src", "tgt", MODERATOR);

    expect(res.updatedUnits).toBe(2);
    expect(prisma.serviceUnit.update).toHaveBeenCalledTimes(2);
    expect(prisma.serviceUnit.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "UNI-1" }, data: { attributes: { payload: { roomTypeId: "tgt", other: 1 } } } }),
    );
    expect(prisma.roomType.delete).toHaveBeenCalledWith({ where: { id: "src" } });
    expect(security.audit).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: "moderation.dictionary_merged" }));
  });

  it("merge: источник/цель одного статуса → 409; source==target → 422", async () => {
    const prisma = makePrisma();
    prisma.roomType.findUnique.mockImplementation(async ({ where }: any) =>
      where.id === "src"
        ? { id: "src", code: "A", names: {}, status: "ACTIVE" }
        : { id: "tgt", code: "B", names: {}, status: "ACTIVE" },
    );
    const { service } = makeService(prisma);

    await expect(service.merge("room-types", "src", "tgt", MODERATOR)).rejects.toThrow(ConflictError);
    await expect(service.merge("room-types", "src", "src", MODERATOR)).rejects.toThrow(ValidationDomainError);
  });

  describe("assertNoPendingDictionaryRefs (pre-publish гейт)", () => {
    it("ссылка на PENDING roomType → 422 с кодом", async () => {
      const prisma = makePrisma();
      prisma.product.findUnique.mockResolvedValue({
        code: "PRD-1",
        serviceUnits: [{ attributes: { payload: { roomTypeId: "r-pending" } }, tariffs: [] }],
      });
      prisma.roomType.findMany.mockResolvedValue([{ code: "PANO" }]);
      const { service } = makeService(prisma);

      await expect(service.assertNoPendingDictionaryRefs(prisma as never, "prod-1")).rejects.toThrow(ValidationDomainError);
    });

    it("все ссылки ACTIVE → проходит", async () => {
      const prisma = makePrisma();
      prisma.product.findUnique.mockResolvedValue({
        code: "PRD-1",
        serviceUnits: [
          {
            attributes: { payload: { roomTypeId: "r1" } },
            tariffs: [{ inclusions: { viewCode: "SEA", mealCode: "BB" } }],
          },
        ],
      });
      prisma.roomType.findMany.mockResolvedValue([]);
      prisma.viewType.findMany.mockResolvedValue([]);
      const { service } = makeService(prisma);

      await expect(service.assertNoPendingDictionaryRefs(prisma as never, "prod-1")).resolves.toBeUndefined();
      // viewCode добавлен в фильтр (только не-ACTIVE опасны)
      expect(prisma.viewType.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { code: { in: ["SEA"] }, status: { not: "ACTIVE" } } }),
      );
    });

    it("продукт без ссылок → без запросов к справочникам", async () => {
      const prisma = makePrisma();
      prisma.product.findUnique.mockResolvedValue({ code: "PRD-1", serviceUnits: [{ attributes: {}, tariffs: [] }] });
      const { service } = makeService(prisma);

      await service.assertNoPendingDictionaryRefs(prisma as never, "prod-1");
      expect(prisma.roomType.findMany).not.toHaveBeenCalled();
      expect(prisma.viewType.findMany).not.toHaveBeenCalled();
    });

    it("продукт не найден → 404", async () => {
      const prisma = makePrisma();
      prisma.product.findUnique.mockResolvedValue(null);
      const { service } = makeService(prisma);

      await expect(service.assertNoPendingDictionaryRefs(prisma as never, "prod-x")).rejects.toThrow(NotFoundError);
    });
  });
});
