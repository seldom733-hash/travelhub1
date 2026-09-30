import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "../../generated/prisma/client";
import { GeoStatus } from "../../generated/prisma/enums";
import { PrismaService } from "../../prisma/prisma.service";
import { SecurityService } from "../../security/security.service";
import type { AuthUser } from "../../security/auth/auth.service";
import {
  CreateAirportDto,
  CreateCityDto,
  CreateCountryDto,
  CreateResortDto,
  UpdateAirportDto,
  UpdateCityDto,
  UpdateCountryDto,
  UpdateResortDto,
} from "./geo.dto";

export interface GeoActor {
  id: string;
  username: string;
}

function toActor(actor?: AuthUser | null): GeoActor | null {
  if (!actor) return null;
  return { id: actor.id, username: actor.username };
}

function auditDetails(value: unknown): Record<string, unknown> {
  return JSON.parse(JSON.stringify(value ?? null)) as Record<string, unknown>;
}

/**
 * Master Geography service (geo.*).
 *
 * Canonical Country/City/Resort/Airport directory. Hierarchy is enforced
 * by DB FKs (RESTRICT on delete); cross-schema linkage from catalog.Product
 * uses plain ID strings validated here. Every mutation is written to
 * security.AuditLog by the caller-facing methods below.
 */
@Injectable()
export class GeoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly security: SecurityService,
  ) {}

  private async audit(
    actor: GeoActor | null,
    action: string,
    resource: string,
    resourceId: string | null,
    details?: unknown,
  ): Promise<void> {
    await this.security.audit(undefined, {
      userId: actor?.id ?? null,
      username: actor?.username ?? null,
      action,
      resource,
      resourceId,
      details: details === undefined ? undefined : auditDetails(details),
    });
  }

  private rethrowUnique(error: unknown, message: string): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new ConflictException(message);
    }
    throw error;
  }

  private rethrowRestrict(error: unknown, message: string): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2003"
    ) {
      throw new ConflictException(message);
    }
    throw error;
  }

  // ── Countries ─────────────────────────────────────────────────────

  listCountries(status?: string) {
    return this.prisma.geoCountry.findMany({
      where: status ? { status: status as GeoStatus } : undefined,
      orderBy: { code: "asc" },
    });
  }

  async getCountry(idOrCode: string) {
    const country =
      (await this.prisma.geoCountry.findUnique({
        where: { id: idOrCode },
        include: { cities: { orderBy: { code: "asc" } } },
      })) ??
      (await this.prisma.geoCountry.findUnique({
        where: { code: idOrCode.toUpperCase() },
        include: { cities: { orderBy: { code: "asc" } } },
      }));
    if (!country) throw new NotFoundException(`Country ${idOrCode} not found`);
    return country;
  }

  async createCountry(dto: CreateCountryDto, actor?: AuthUser | null) {
    try {
      const country = await this.prisma.geoCountry.create({
        data: {
          code: dto.code.toUpperCase(),
          names: dto.names as unknown as Prisma.InputJsonValue,
          status: dto.status ?? "ACTIVE",
          createdBy: actor?.id ?? null,
        },
      });
      await this.audit(toActor(actor), "geo.country.create", "GeoCountry", country.id, country);
      return country;
    } catch (error) {
      this.rethrowUnique(error, `Country code ${dto.code} already exists`);
    }
  }

  async updateCountry(
    id: string,
    dto: UpdateCountryDto,
    actor?: AuthUser | null,
  ) {
    const existing = await this.prisma.geoCountry.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Country ${id} not found`);
    const country = await this.prisma.geoCountry.update({
      where: { id },
      data: {
        ...(dto.names !== undefined
          ? { names: dto.names as unknown as Prisma.InputJsonValue }
          : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        updatedBy: actor?.id ?? null,
      },
    });
    await this.audit(toActor(actor), "geo.country.update", "GeoCountry", id, {
      before: existing,
      after: country,
    });
    return country;
  }

  async deleteCountry(id: string, actor?: AuthUser | null) {
    const existing = await this.prisma.geoCountry.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Country ${id} not found`);
    try {
      await this.prisma.geoCountry.delete({ where: { id } });
    } catch (error) {
      this.rethrowRestrict(
        error,
        `Country ${existing.code} has cities and cannot be deleted (use INACTIVE instead)`,
      );
    }
    await this.audit(toActor(actor), "geo.country.delete", "GeoCountry", id, existing);
    return { deleted: true, id };
  }

  // ── Cities ────────────────────────────────────────────────────────

  listCities(countryId?: string, status?: string) {
    return this.prisma.geoCity.findMany({
      where: {
        ...(countryId ? { countryId } : {}),
        ...(status ? { status: status as GeoStatus } : {}),
      },
      orderBy: { code: "asc" },
    });
  }

  async getCity(idOrCode: string) {
    const city =
      (await this.prisma.geoCity.findUnique({
        where: { id: idOrCode },
        include: {
          resorts: { orderBy: { code: "asc" } },
          airports: { orderBy: { code: "asc" } },
        },
      })) ??
      (await this.prisma.geoCity.findUnique({
        where: { code: idOrCode.toUpperCase() },
        include: {
          resorts: { orderBy: { code: "asc" } },
          airports: { orderBy: { code: "asc" } },
        },
      }));
    if (!city) throw new NotFoundException(`City ${idOrCode} not found`);
    return city;
  }

  async createCity(dto: CreateCityDto, actor?: AuthUser | null) {
    const country = await this.prisma.geoCountry.findUnique({
      where: { id: dto.countryId },
    });
    if (!country) {
      throw new NotFoundException(`Country ${dto.countryId} not found`);
    }
    try {
      const city = await this.prisma.geoCity.create({
        data: {
          countryId: dto.countryId,
          code: dto.code.toUpperCase(),
          names: dto.names as unknown as Prisma.InputJsonValue,
          latitude: dto.latitude ?? null,
          longitude: dto.longitude ?? null,
          status: dto.status ?? "ACTIVE",
          createdBy: actor?.id ?? null,
        },
      });
      await this.audit(toActor(actor), "geo.city.create", "GeoCity", city.id, city);
      return city;
    } catch (error) {
      this.rethrowUnique(error, `City code ${dto.code} already exists`);
    }
  }

  async updateCity(id: string, dto: UpdateCityDto, actor?: AuthUser | null) {
    const existing = await this.prisma.geoCity.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`City ${id} not found`);
    const city = await this.prisma.geoCity.update({
      where: { id },
      data: {
        ...(dto.names !== undefined
          ? { names: dto.names as unknown as Prisma.InputJsonValue }
          : {}),
        ...(dto.latitude !== undefined ? { latitude: dto.latitude } : {}),
        ...(dto.longitude !== undefined ? { longitude: dto.longitude } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        updatedBy: actor?.id ?? null,
      },
    });
    await this.audit(toActor(actor), "geo.city.update", "GeoCity", id, {
      before: existing,
      after: city,
    });
    return city;
  }

  async deleteCity(id: string, actor?: AuthUser | null) {
    const existing = await this.prisma.geoCity.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`City ${id} not found`);
    try {
      await this.prisma.geoCity.delete({ where: { id } });
    } catch (error) {
      this.rethrowRestrict(
        error,
        `City ${existing.code} has resorts/airports and cannot be deleted (use INACTIVE instead)`,
      );
    }
    await this.audit(toActor(actor), "geo.city.delete", "GeoCity", id, existing);
    return { deleted: true, id };
  }

  // ── Resorts ───────────────────────────────────────────────────────

  listResorts(cityId?: string, status?: string, countryId?: string) {
    return this.prisma.geoResort.findMany({
      where: {
        ...(cityId ? { cityId } : {}),
        ...(countryId ? { city: { countryId } } : {}),
        ...(status ? { status: status as GeoStatus } : {}),
      },
      orderBy: { code: "asc" },
    });
  }

  async getResort(idOrCode: string) {
    const resort =
      (await this.prisma.geoResort.findUnique({ where: { id: idOrCode } })) ??
      (await this.prisma.geoResort.findUnique({
        where: { code: idOrCode.toUpperCase() },
      }));
    if (!resort) throw new NotFoundException(`Resort ${idOrCode} not found`);
    return resort;
  }

  async createResort(dto: CreateResortDto, actor?: AuthUser | null) {
    const city = await this.prisma.geoCity.findUnique({
      where: { id: dto.cityId },
    });
    if (!city) throw new NotFoundException(`City ${dto.cityId} not found`);
    try {
      const resort = await this.prisma.geoResort.create({
        data: {
          cityId: dto.cityId,
          code: dto.code.toUpperCase(),
          names: dto.names as unknown as Prisma.InputJsonValue,
          latitude: dto.latitude ?? null,
          longitude: dto.longitude ?? null,
          status: dto.status ?? "ACTIVE",
          createdBy: actor?.id ?? null,
        },
      });
      await this.audit(toActor(actor), "geo.resort.create", "GeoResort", resort.id, resort);
      return resort;
    } catch (error) {
      this.rethrowUnique(error, `Resort code ${dto.code} already exists`);
    }
  }

  async updateResort(id: string, dto: UpdateResortDto, actor?: AuthUser | null) {
    const existing = await this.prisma.geoResort.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Resort ${id} not found`);
    const resort = await this.prisma.geoResort.update({
      where: { id },
      data: {
        ...(dto.names !== undefined
          ? { names: dto.names as unknown as Prisma.InputJsonValue }
          : {}),
        ...(dto.latitude !== undefined ? { latitude: dto.latitude } : {}),
        ...(dto.longitude !== undefined ? { longitude: dto.longitude } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        updatedBy: actor?.id ?? null,
      },
    });
    await this.audit(toActor(actor), "geo.resort.update", "GeoResort", id, {
      before: existing,
      after: resort,
    });
    return resort;
  }

  async deleteResort(id: string, actor?: AuthUser | null) {
    const existing = await this.prisma.geoResort.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Resort ${id} not found`);
    await this.prisma.geoResort.delete({ where: { id } });
    await this.audit(toActor(actor), "geo.resort.delete", "GeoResort", id, existing);
    return { deleted: true, id };
  }

  // ── Airports ──────────────────────────────────────────────────────

  listAirports(cityId?: string, status?: string) {
    return this.prisma.geoAirport.findMany({
      where: {
        ...(cityId ? { cityId } : {}),
        ...(status ? { status: status as GeoStatus } : {}),
      },
      orderBy: { code: "asc" },
    });
  }

  async getAirport(idOrCode: string) {
    const airport =
      (await this.prisma.geoAirport.findUnique({ where: { id: idOrCode } })) ??
      (await this.prisma.geoAirport.findUnique({
        where: { code: idOrCode.toUpperCase() },
      }));
    if (!airport) throw new NotFoundException(`Airport ${idOrCode} not found`);
    return airport;
  }

  async createAirport(dto: CreateAirportDto, actor?: AuthUser | null) {
    const city = await this.prisma.geoCity.findUnique({
      where: { id: dto.cityId },
    });
    if (!city) throw new NotFoundException(`City ${dto.cityId} not found`);
    try {
      const airport = await this.prisma.geoAirport.create({
        data: {
          cityId: dto.cityId,
          code: dto.code.toUpperCase(),
          names: dto.names as unknown as Prisma.InputJsonValue,
          latitude: dto.latitude ?? null,
          longitude: dto.longitude ?? null,
          timeZone: dto.timeZone ?? null,
          status: dto.status ?? "ACTIVE",
          createdBy: actor?.id ?? null,
        },
      });
      await this.audit(toActor(actor), "geo.airport.create", "GeoAirport", airport.id, airport);
      return airport;
    } catch (error) {
      this.rethrowUnique(error, `Airport code ${dto.code} already exists`);
    }
  }

  async updateAirport(id: string, dto: UpdateAirportDto, actor?: AuthUser | null) {
    const existing = await this.prisma.geoAirport.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Airport ${id} not found`);
    const airport = await this.prisma.geoAirport.update({
      where: { id },
      data: {
        ...(dto.names !== undefined
          ? { names: dto.names as unknown as Prisma.InputJsonValue }
          : {}),
        ...(dto.latitude !== undefined ? { latitude: dto.latitude } : {}),
        ...(dto.longitude !== undefined ? { longitude: dto.longitude } : {}),
        ...(dto.timeZone !== undefined ? { timeZone: dto.timeZone } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        updatedBy: actor?.id ?? null,
      },
    });
    await this.audit(toActor(actor), "geo.airport.update", "GeoAirport", id, {
      before: existing,
      after: airport,
    });
    return airport;
  }

  async deleteAirport(id: string, actor?: AuthUser | null) {
    const existing = await this.prisma.geoAirport.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Airport ${id} not found`);
    await this.prisma.geoAirport.delete({ where: { id } });
    await this.audit(toActor(actor), "geo.airport.delete", "GeoAirport", id, existing);
    return { deleted: true, id };
  }

  // ── Supplier dictionaries for search forms (hotel stars, hotels) ──

  /**
   * Hotel star categories ingested from supplier forms (SupplierGeoLink
   * kind=STAR). Returns distinct labels sorted by parsed star count (5* →
   * 1*, non-numeric labels like "HV-1" last). Powers the universal search
   * «Категория отеля» dropdown; the frontend maps a label back to the
   * supplier's STARS ids via /supplier-stars?countryId=.
   */
  /**
   * Resolve an ISO-2 country code to its GeoCountry id (public query-param
   * convenience: /geo/supplier-stars?countryCode=TR).
   */
  async resolveCountryIdByCode(code: string): Promise<string | undefined> {
    const country = await this.prisma.geoCountry.findUnique({
      where: { code: code.trim().toUpperCase() },
      select: { id: true },
    });
    return country?.id;
  }

  async listSupplierStars(countryId?: string): Promise<
    Array<{ label: string; stars: number | null; suppliers: string[]; externalIds: Record<string, string> }>
  > {
    const links = await this.prisma.supplierGeoLink.findMany({
      where: {
        kind: "STAR",
        // Country scope keeps per-country dictionaries distinct; links without
        // a country (global dictionary rows) always participate.
        ...(countryId ? { OR: [{ geoCountryId: countryId }, { geoCountryId: null }] } : {}),
      },
      select: { supplierCode: true, externalId: true, label: true },
    });
    const byLabel = new Map<string, { stars: number | null; suppliers: Set<string>; externalIds: Record<string, string> }>();
    for (const l of links) {
      const label = l.label.trim();
      if (!label) continue;
      let entry = byLabel.get(label);
      if (!entry) {
        const m = label.match(/^(\d)\s*\*$/);
        entry = { stars: m ? parseInt(m[1], 10) : null, suppliers: new Set(), externalIds: {} };
        byLabel.set(label, entry);
      }
      entry.suppliers.add(l.supplierCode);
      if (!entry.externalIds[l.supplierCode]) entry.externalIds[l.supplierCode] = l.externalId;
    }
    return [...byLabel.entries()]
      .map(([label, v]) => ({
        label,
        stars: v.stars,
        suppliers: [...v.suppliers],
        externalIds: v.externalIds,
      }))
      .sort((a, b) => {
        if (a.stars !== null && b.stars !== null) return b.stars - a.stars; // 5* first
        if (a.stars !== null) return -1;
        if (b.stars !== null) return 1;
        return a.label.localeCompare(b.label, "ru");
      });
  }

  /**
   * Supplier hotel directory for the search form's hotel picker. Sources:
   * SupplierGeoLink kind=HOTEL rows (supplier hotel dictionaries) grouped by
   * hotel label. Region filters (country/city/resort) restrict to hotels
   * linked to that geography; q filters by substring in the label.
   */
  async listSupplierHotels(params: {
    geoCountry?: string;
    geoCity?: string;
    geoResort?: string;
    q?: string;
    limit?: number;
  }): Promise<Array<{ id: string; name: string; suppliers: string[] }>> {
    const limit = Math.min(params.limit ?? 500, 2000);
    // Hotels geo-link through their town: a town ingested as a resort carries
    // geoResortId (city on the resort), so a city filter must cover both the
    // hotel's direct geoCityId and resorts OF that city.
    const cityCondition: Prisma.SupplierGeoLinkWhereInput[] = params.geoCity
      ? [{ geoCity: { code: params.geoCity } }, { geoResort: { city: { code: params.geoCity } } }]
      : [];
    const where: Prisma.SupplierGeoLinkWhereInput = {
      kind: "HOTEL",
      label: params.q
        ? { contains: params.q, mode: "insensitive" }
        : { not: "" },
      ...(params.geoCountry ? { geoCountry: { code: params.geoCountry } } : {}),
      ...(params.geoResort ? { geoResort: { code: params.geoResort } } : {}),
      ...(cityCondition.length ? { OR: cityCondition } : {}),
    };
    const links = await this.prisma.supplierGeoLink.findMany({
      where,
      select: { supplierCode: true, label: true },
      orderBy: { label: "asc" },
      take: limit * 4, // grouping headroom before the limit cut
    });
    // One entry per hotel NAME: external ids are per-supplier and differ, the
    // name is the only supplier-neutral identity (the picker's id).
    const byLabel = new Map<string, Set<string>>();
    for (const l of links) {
      const name = l.label.replace(/\s+/g, " ").trim();
      if (!name) continue;
      let suppliers = byLabel.get(name);
      if (!suppliers) {
        suppliers = new Set();
        byLabel.set(name, suppliers);
      }
      suppliers.add(l.supplierCode);
    }
    return [...byLabel.entries()]
      .slice(0, limit)
      .map(([name, suppliers]) => ({ id: name, name, suppliers: [...suppliers] }));
  }

  // ── Unified search (admin directory) ──────────────────────────────

  async search(query: string, type?: string, status?: string) {
    const q = query.trim();
    const empty = { countries: [], cities: [], resorts: [], airports: [] };
    if (q.length < 2) return empty;
    // NOTE: Prisma string_contains on Json is case-SENSITIVE, so "чешме"
    // would miss "Чешме". Raw SQL with ILIKE covers codes and localized
    // names case-insensitively (same pattern as public-suggest).
    const kinds =
      type && ["country", "city", "resort", "airport"].includes(type)
        ? [type]
        : ["country", "city", "resort", "airport"];
    const like = `%${q}%`;
    const statusCond =
      status && (status === "ACTIVE" || status === "INACTIVE")
        ? Prisma.sql`AND "status"::text = ${status}`
        : Prisma.empty;
    const parts: Prisma.Sql[] = [];
    if (kinds.includes("country")) {
      parts.push(Prisma.sql`
        SELECT "id", "code", "names", "status", 'country' AS "kind",
          NULL::text AS "countryId", NULL::text AS "cityId"
        FROM geo."GeoCountry"
        WHERE ("code" ILIKE ${like} OR "names"::text ILIKE ${like}) ${statusCond}`);
    }
    if (kinds.includes("city")) {
      parts.push(Prisma.sql`
        SELECT "id", "code", "names", "status", 'city' AS "kind",
          "countryId", NULL::text AS "cityId"
        FROM geo."GeoCity"
        WHERE ("code" ILIKE ${like} OR "names"::text ILIKE ${like}) ${statusCond}`);
    }
    if (kinds.includes("resort")) {
      parts.push(Prisma.sql`
        SELECT "id", "code", "names", "status", 'resort' AS "kind",
          NULL::text AS "countryId", "cityId"
        FROM geo."GeoResort"
        WHERE ("code" ILIKE ${like} OR "names"::text ILIKE ${like}) ${statusCond}`);
    }
    if (kinds.includes("airport")) {
      parts.push(Prisma.sql`
        SELECT "id", "code", "names", "status", 'airport' AS "kind",
          NULL::text AS "countryId", "cityId"
        FROM geo."GeoAirport"
        WHERE ("code" ILIKE ${like} OR "names"::text ILIKE ${like}) ${statusCond}`);
    }
    const union = parts.reduce((acc, part, index) =>
      index === 0 ? part : Prisma.sql`${acc} UNION ALL ${part}`,
    );
    const stmt = Prisma.sql`${union} ORDER BY "code" ASC LIMIT 100`;
    const rows = await this.prisma.$queryRaw<
      Array<{
        id: string;
        code: string;
        names: unknown;
        status: string;
        kind: string;
        countryId: string | null;
        cityId: string | null;
      }>
    >(stmt);
    const result: Record<string, typeof rows> = {
      countries: [],
      cities: [],
      resorts: [],
      airports: [],
    };
    for (const row of rows) {
      const bucket =
        row.kind === "country"
          ? result.countries
          : row.kind === "city"
            ? result.cities
            : row.kind === "resort"
              ? result.resorts
              : result.airports;
      const { kind: _kind, ...rest } = row;
      void _kind;
      bucket.push(rest as (typeof rows)[number]);
    }
    return {
      countries: result.countries,
      cities: result.cities,
      resorts: result.resorts,
      airports: result.airports,
    };
  }
}
