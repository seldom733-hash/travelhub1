/**
 * GeographyAvailabilityService unit tests (Master Geography, Phase 4).
 *
 * MOCK-based: verifies derivation rules (actual inventory, master ACTIVE,
 * hierarchy guard, unknown service) without a database.
 */
import { BadRequestException } from "@nestjs/common";
import { GeographyAvailabilityService } from "./geo-availability.service";

function createMockPrisma(links: unknown[] = []) {
  return {
    product: { findMany: jest.fn().mockResolvedValue(links) },
    geoCountry: { findMany: jest.fn().mockResolvedValue([]) },
    geoCity: { findMany: jest.fn().mockResolvedValue([]) },
    geoResort: { findMany: jest.fn().mockResolvedValue([]) },
    geoAirport: { findMany: jest.fn().mockResolvedValue([]) },
  };
}

describe("GeographyAvailabilityService", () => {
  it("rejects unknown service", async () => {
    const service = new GeographyAvailabilityService(
      createMockPrisma() as unknown as never,
    );
    await expect(service.getAvailability("taxis")).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it("queries only actual inventory (PUBLISHED + channel + ACTIVE category)", async () => {
    const prisma = createMockPrisma();
    const service = new GeographyAvailabilityService(
      prisma as unknown as never,
    );

    const result = await service.getAvailability("tours");

    expect(prisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          type: "TOUR",
          status: "PUBLISHED",
          publishedAt: { not: null },
          publicationChannels: { some: { channel: "MARKETPLACE" } },
          category: { is: { status: "ACTIVE" } },
        }),
      }),
    );
    expect(result).toEqual({
      service: "tours",
      countries: [],
      cities: [],
      resorts: [],
      airports: [],
    });
  });

  it("hides cities whose country is INACTIVE (hierarchy guard)", async () => {
    const prisma = createMockPrisma([
      { geoCountryId: "c1", geoCityId: "city1", geoResortId: null, geoAirportId: null },
    ]);
    // Country c1 missing from ACTIVE fetch (INACTIVE) — city must not leak.
    prisma.geoCountry.findMany.mockResolvedValue([]);
    prisma.geoCity.findMany.mockResolvedValue([
      { id: "city1", code: "ATH", names: {}, countryId: "c1" },
    ]);
    const service = new GeographyAvailabilityService(
      prisma as unknown as never,
    );

    const result = await service.getAvailability("hotels");

    expect(result.countries).toEqual([]);
    expect(result.cities).toEqual([]);
  });

  it("returns available entries with product counts", async () => {
    const prisma = createMockPrisma([
      { geoCountryId: "c1", geoCityId: "city1", geoResortId: null, geoAirportId: null },
      { geoCountryId: "c1", geoCityId: "city1", geoResortId: null, geoAirportId: null },
    ]);
    prisma.geoCountry.findMany.mockResolvedValue([
      { id: "c1", code: "GR", names: { ru: "Греция" } },
    ]);
    prisma.geoCity.findMany.mockResolvedValue([
      { id: "city1", code: "ATH", names: { ru: "Афины" }, countryId: "c1" },
    ]);
    const service = new GeographyAvailabilityService(
      prisma as unknown as never,
    );

    const result = await service.getAvailability("tours");

    expect(result.countries).toEqual([
      { id: "c1", code: "GR", names: { ru: "Греция" }, parentId: null, productCount: 2 },
    ]);
    expect(result.cities).toEqual([
      { id: "city1", code: "ATH", names: { ru: "Афины" }, parentId: "c1", productCount: 2 },
    ]);
  });
});
