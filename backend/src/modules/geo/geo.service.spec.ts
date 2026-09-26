/**
 * GeoService unit tests (Master Geography, Phase 3).
 *
 * MOCK-based: verifies service contract (validation, error mapping, audit)
 * without touching the database.
 */
import { ConflictException, NotFoundException } from "@nestjs/common";
import { Prisma } from "../../generated/prisma/client";
import { GeoService } from "./geo.service";

function prismaError(code: string): unknown {
  return new Prisma.PrismaClientKnownRequestError("mock", {
    code,
    clientVersion: "test",
  });
}

function createMockPrisma() {
  return {
    geoCountry: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    geoCity: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    geoResort: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    geoAirport: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };
}

function createMockSecurity() {
  return { audit: jest.fn().mockResolvedValue(undefined) };
}

describe("GeoService", () => {
  let prisma: ReturnType<typeof createMockPrisma>;
  let security: ReturnType<typeof createMockSecurity>;
  let service: GeoService;

  beforeEach(() => {
    prisma = createMockPrisma();
    security = createMockSecurity();
    service = new GeoService(
      prisma as unknown as never,
      security as unknown as never,
    );
    jest.clearAllMocks();
  });

  it("creates a country and writes an audit record", async () => {
    const created = { id: "c1", code: "GR", names: {} };
    prisma.geoCountry.create.mockResolvedValue(created);

    const result = await service.createCountry(
      { code: "gr", names: { ru: "Греция", en: "Greece", az: "Yunanıstan" } },
      { id: "u1", username: "admin" } as never,
    );

    expect(result).toBe(created);
    expect(prisma.geoCountry.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ code: "GR" }) }),
    );
    expect(security.audit).toHaveBeenCalledWith(
      undefined,
      expect.objectContaining({
        action: "geo.country.create",
        resource: "GeoCountry",
        resourceId: "c1",
      }),
    );
  });

  it("maps duplicate country code to ConflictException", async () => {
    prisma.geoCountry.create.mockRejectedValue(prismaError("P2002"));

    await expect(
      service.createCountry(
        { code: "GR", names: { ru: "x", en: "x", az: "x" } },
        null,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it("rejects city creation for unknown country", async () => {
    prisma.geoCountry.findUnique.mockResolvedValue(null);

    await expect(
      service.createCity(
        {
          countryId: "nope",
          code: "ATH",
          names: { ru: "Афины", en: "Athens", az: "Afina" },
        },
        null,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.geoCity.create).not.toHaveBeenCalled();
  });

  it("maps restricted country delete to ConflictException (use INACTIVE)", async () => {
    prisma.geoCountry.findUnique.mockResolvedValue({ id: "c1", code: "GR" });
    prisma.geoCountry.delete.mockRejectedValue(prismaError("P2003"));

    await expect(service.deleteCountry("c1", null)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(security.audit).not.toHaveBeenCalled();
  });

  it("resolves city by code (case-insensitive)", async () => {
    prisma.geoCity.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: "city1", code: "ATH" });

    const result = await service.getCity("ath");

    expect(result.code).toBe("ATH");
    expect(prisma.geoCity.findUnique).toHaveBeenCalledTimes(2);
  });

  it("creates and deletes an airport", async () => {
    prisma.geoCity.findUnique.mockResolvedValue({ id: "city1" });
    prisma.geoAirport.create.mockResolvedValue({ id: "a1", code: "ATH" });
    prisma.geoAirport.findUnique.mockResolvedValue({ id: "a1", code: "ATH" });
    prisma.geoAirport.delete.mockResolvedValue({ id: "a1" });

    const created = await service.createAirport(
      {
        cityId: "city1",
        code: "ath",
        names: { ru: "Афины", en: "Athens", az: "Afina" },
      },
      null,
    );
    expect(created.code).toBe("ATH");

    const deleted = await service.deleteAirport("a1", null);
    expect(deleted).toEqual({ deleted: true, id: "a1" });
  });
});
