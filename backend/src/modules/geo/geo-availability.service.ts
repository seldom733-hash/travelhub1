import { BadRequestException, Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

/**
 * Service categories exposed to user search (prompt §5).
 * Extensible: adding a category = one entry here + ProductType mapping.
 */
export const GEO_SERVICE_CATEGORIES = ["tours", "hotels", "flights"] as const;
export type GeoServiceCategory = (typeof GEO_SERVICE_CATEGORIES)[number];

const SERVICE_PRODUCT_TYPE: Record<GeoServiceCategory, string> = {
  tours: "TOUR",
  hotels: "HOTEL",
  flights: "FLIGHT",
};

export interface GeoAvailabilityEntry {
  id: string;
  code: string;
  names: unknown;
  parentId: string | null;
  productCount: number;
}

export interface GeoAvailabilityResult {
  service: GeoServiceCategory;
  countries: GeoAvailabilityEntry[];
  cities: GeoAvailabilityEntry[];
  resorts: GeoAvailabilityEntry[];
  airports: GeoAvailabilityEntry[];
}

/**
 * GeographyAvailabilityService (prompt §23).
 *
 * availability(category, geography) = EXISTS at least one ACTUAL catalog
 * offer linked to the geography. ACTUAL (Marketplace contour, mirrors
 * PublicCatalogService.marketplaceWhere): Product PUBLISHED + publishedAt
 * set + MARKETPLACE channel + ACTIVE category. Master status INACTIVE
 * always hides the geography regardless of inventory (prompt §5D).
 *
 * NOTE (v1 scope): tariff-level states (all tariffs ARCHIVED) do not revoke
 * availability; product-level lifecycle is the authority. Supplier-live
 * searches (KOMPAS/Summer/AZAL) use supplier directories, not this service.
 */
@Injectable()
export class GeographyAvailabilityService {
  constructor(private readonly prisma: PrismaService) {}

  async getAvailability(service: string): Promise<GeoAvailabilityResult> {
    if (
      !(GEO_SERVICE_CATEGORIES as readonly string[]).includes(service)
    ) {
      throw new BadRequestException(
        `Unknown service '${service}'. Expected one of: ${GEO_SERVICE_CATEGORIES.join(", ")}`,
      );
    }
    const category = service as GeoServiceCategory;

    const links = await this.prisma.product.findMany({
      where: {
        type: SERVICE_PRODUCT_TYPE[category] as never,
        status: "PUBLISHED",
        publishedAt: { not: null },
        publicationChannels: { some: { channel: "MARKETPLACE" } },
        category: { is: { status: "ACTIVE" } },
        OR: [
          { geoCountryId: { not: null } },
          { geoCityId: { not: null } },
          { geoResortId: { not: null } },
          { geoAirportId: { not: null } },
        ],
      },
      select: {
        geoCountryId: true,
        geoCityId: true,
        geoResortId: true,
        geoAirportId: true,
      },
    });

    const countBy = (pick: (link: (typeof links)[number]) => string | null) => {
      const map = new Map<string, number>();
      for (const link of links) {
        const id = pick(link);
        if (id) map.set(id, (map.get(id) ?? 0) + 1);
      }
      return map;
    };
    const countryCounts = countBy((link) => link.geoCountryId);
    const cityCounts = countBy((link) => link.geoCityId);
    const resortCounts = countBy((link) => link.geoResortId);
    const airportCounts = countBy((link) => link.geoAirportId);

    const [countries, cities, resorts, airports] = await Promise.all([
      countryCounts.size > 0
        ? this.prisma.geoCountry.findMany({
          where: { id: { in: [...countryCounts.keys()] }, status: "ACTIVE" },
          orderBy: { code: "asc" },
        })
        : [],
      cityCounts.size > 0
        ? this.prisma.geoCity.findMany({
          where: { id: { in: [...cityCounts.keys()] }, status: "ACTIVE" },
          orderBy: { code: "asc" },
        })
        : [],
      resortCounts.size > 0
        ? this.prisma.geoResort.findMany({
          where: { id: { in: [...resortCounts.keys()] }, status: "ACTIVE" },
          orderBy: { code: "asc" },
        })
        : [],
      airportCounts.size > 0
        ? this.prisma.geoAirport.findMany({
          where: { id: { in: [...airportCounts.keys()] }, status: "ACTIVE" },
          orderBy: { code: "asc" },
        })
        : [],
    ]);

    // Hierarchy guard: a city whose country is INACTIVE (or missing) must not
    // leak into search even if linked directly (prompt §5D/§7).
    const activeCountryIds = new Set(countries.map((c) => c.id));
    const visibleCities = cities.filter((c) => activeCountryIds.has(c.countryId));
    const visibleCityIds = new Set(visibleCities.map((c) => c.id));

    return {
      service: category,
      countries: countries.map((c) => ({
        id: c.id,
        code: c.code,
        names: c.names,
        parentId: null,
        productCount: countryCounts.get(c.id) ?? 0,
      })),
      cities: visibleCities.map((c) => ({
        id: c.id,
        code: c.code,
        names: c.names,
        parentId: c.countryId,
        productCount: cityCounts.get(c.id) ?? 0,
      })),
      resorts: resorts
        .filter((r) => visibleCityIds.has(r.cityId))
        .map((r) => ({
          id: r.id,
          code: r.code,
          names: r.names,
          parentId: r.cityId,
          productCount: resortCounts.get(r.id) ?? 0,
        })),
      airports: airports
        .filter((a) => visibleCityIds.has(a.cityId))
        .map((a) => ({
          id: a.id,
          code: a.code,
          names: a.names,
          parentId: a.cityId,
          productCount: airportCounts.get(a.id) ?? 0,
        })),
    };
  }
}
