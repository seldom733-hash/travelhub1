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
