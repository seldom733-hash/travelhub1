/**
 * HotelDirectoryService unit tests (MOCK-based, no database).
 */
import { ConflictException, NotFoundException } from "@nestjs/common";
import { Prisma } from "../../generated/prisma/client";
import { HotelDirectoryService } from "./hotel-directory.service";

function prismaError(code: string): unknown {
  return new Prisma.PrismaClientKnownRequestError("mock", {
    code,
    clientVersion: "test",
  });
}

function delegate() {
  return {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };
}

function createMockPrisma() {
  return {
    hotelCategory: delegate(),
    roomType: delegate(),
    placementType: delegate(),
    mealType: delegate(),
  };
}

describe("HotelDirectoryService", () => {
  const security = { audit: jest.fn().mockResolvedValue(undefined) };
  const make = (prisma: ReturnType<typeof createMockPrisma>) =>
    new HotelDirectoryService(
      prisma as unknown as never,
      security as unknown as never,
    );

  beforeEach(() => jest.clearAllMocks());

  it("routes each type to its own model", async () => {
    const prisma = createMockPrisma();
    prisma.roomType.findMany.mockResolvedValue([{ id: "r1" }]);
    const service = make(prisma);

    const result = await service.list("room-types");

    expect(result).toEqual([{ id: "r1" }]);
    expect(prisma.roomType.findMany).toHaveBeenCalled();
    expect(prisma.mealType.findMany).not.toHaveBeenCalled();
  });

  it("uppercases codes and audits creation", async () => {
    const prisma = createMockPrisma();
    prisma.mealType.create.mockResolvedValue({ id: "m1", code: "AI" });
    const service = make(prisma);

    const result = await service.create(
      "meal-types",
      { code: "ai", names: { ru: "Всё включено", en: "All inclusive", az: "Hər şey daxil" } },
      { id: "u1", username: "admin" } as never,
    );

    expect(result.code).toBe("AI");
    expect(prisma.mealType.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ code: "AI" }) }),
    );
    expect(security.audit).toHaveBeenCalledWith(
      undefined,
      expect.objectContaining({ action: "hotel_directory.meal-types.create" }),
    );
  });

  it("maps duplicate code to ConflictException", async () => {
    const prisma = createMockPrisma();
    prisma.hotelCategory.create.mockRejectedValue(prismaError("P2002"));
    const service = make(prisma);

    await expect(
      service.create(
        "categories",
        { code: "5*", names: { ru: "5*", en: "5*", az: "5*" } },
        null,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it("throws NotFoundException for unknown id", async () => {
    const prisma = createMockPrisma();
    prisma.placementType.findUnique.mockResolvedValue(null);
    const service = make(prisma);

    await expect(service.get("placement-types", "nope")).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it("returns empty buckets for short search queries", async () => {
    const prisma = createMockPrisma();
    const service = make(prisma);

    const result = await service.search("x");

    expect(result).toEqual({
      categories: [],
      "room-types": [],
      "placement-types": [],
      "meal-types": [],
    });
    expect(prisma.hotelCategory.findMany).not.toHaveBeenCalled();
  });
});
