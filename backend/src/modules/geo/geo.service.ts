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

  listResorts(cityId?: string, status?: string) {
    return this.prisma.geoResort.findMany({
      where: {
        ...(cityId ? { cityId } : {}),
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
    if (q.length < 2) return { countries: [], cities: [], resorts: [], airports: [] };
    const statusFilter = status ? { status: status as GeoStatus } : {};
    // NOTE: names is JSONB — code matched via Prisma, localized names via
    // JSON text search.
    const namesMatch = {
      names: { string_contains: q },
    };
    const [countries, cities, resorts, airports] = await Promise.all([
      type && type !== "country"
        ? []
        : this.prisma.geoCountry.findMany({
          where: { ...statusFilter, OR: [{ code: { contains: q.toUpperCase() } }, namesMatch] },
          take: 25,
          orderBy: { code: "asc" },
        }),
      type && type !== "city"
        ? []
        : this.prisma.geoCity.findMany({
          where: { ...statusFilter, OR: [{ code: { contains: q.toUpperCase() } }, namesMatch] },
          take: 25,
          orderBy: { code: "asc" },
        }),
      type && type !== "resort"
        ? []
        : this.prisma.geoResort.findMany({
          where: { ...statusFilter, OR: [{ code: { contains: q.toUpperCase() } }, namesMatch] },
          take: 25,
          orderBy: { code: "asc" },
        }),
      type && type !== "airport"
        ? []
        : this.prisma.geoAirport.findMany({
          where: { ...statusFilter, OR: [{ code: { contains: q.toUpperCase() } }, namesMatch] },
          take: 25,
          orderBy: { code: "asc" },
        }),
    ]);
    return { countries, cities, resorts, airports };
  }
}
