import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "../../generated/prisma/client";
import { CategoryStatus } from "../../generated/prisma/enums";
import { PrismaService } from "../../prisma/prisma.service";
import { SecurityService } from "../../security/security.service";
import type { AuthUser } from "../../security/auth/auth.service";
import {
  CreateDirectoryEntryDto,
  UpdateDirectoryEntryDto,
} from "./hotel-directory.dto";
import { cleanHotelName, normalizeName } from "../catalog/hotel/hotel-identity";

export const HOTEL_DIRECTORY_TYPES = [
  "categories",
  "room-types",
  "placement-types",
  "meal-types",
  "view-types",
] as const;
export type HotelDirectoryType = (typeof HOTEL_DIRECTORY_TYPES)[number];

const MODEL_BY_TYPE: Record<HotelDirectoryType, string> = {
  categories: "hotelCategory",
  "room-types": "roomType",
  "placement-types": "placementType",
  "meal-types": "mealType",
  "view-types": "viewType",
};

const AUDIT_BY_TYPE: Record<HotelDirectoryType, string> = {
  categories: "HotelCategory",
  "room-types": "RoomType",
  "placement-types": "PlacementType",
  "meal-types": "MealType",
  "view-types": "ViewType",
};

interface DirectoryWhere {
  status?: CategoryStatus;
}

/**
 * Hotel reference directory service (Справочники → Отели).
 *
 * One generic implementation over the four classification tables
 * (categories / room-types / placement-types / meal-types). Entries are
 * standalone master data (no FK to Product); mutations go to
 * security.AuditLog. There is nothing to cascade on delete.
 */
@Injectable()
export class HotelDirectoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly security: SecurityService,
  ) {}

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private model(type: HotelDirectoryType): any {
    return (this.prisma as unknown as Record<string, unknown>)[
      MODEL_BY_TYPE[type]
    ];
  }

  private async audit(
    actor: AuthUser | null | undefined,
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
      details:
        details === undefined
          ? undefined
          : (JSON.parse(JSON.stringify(details)) as Record<string, unknown>),
    });
  }

  async listHotels(query: { q?: string; country?: string; limit?: number }) {
    const where: Prisma.HotelWhereInput = {};
    if (query.q?.trim()) where.name = { contains: query.q.trim(), mode: "insensitive" };
    if (query.country?.trim()) {
      where.OR = [
        { countryCode: query.country.trim() },
        { countryName: { equals: query.country.trim(), mode: "insensitive" } },
      ];
    }
    const rows = await this.prisma.hotel.findMany({
      where,
      orderBy: [{ countryName: "asc" }, { cityName: "asc" }, { name: "asc" }],
      take: Math.min(query.limit ?? 5000, 20000),
      select: { id: true, name: true, countryCode: true, countryName: true, cityName: true, resortName: true, stars: true, categoryLabel: true },
    });
    return rows.map((row) => ({ ...row, suppliers: [] as string[] }));
  }

  async listAirports(status?: string) {
    const rows = await this.prisma.geoAirport.findMany({
      where: status ? { status: status as never } : undefined,
      include: { city: { include: { country: true } } },
    });
    return rows
      .map((row) => {
        const names = (row.names ?? {}) as Record<string, string>;
        const cityNames = (row.city?.names ?? {}) as Record<string, string>;
        const countryNames = (row.city?.country?.names ?? {}) as Record<string, string>;
        return {
          id: row.id,
          code: row.code,
          name: names.en || names.ru || row.code,
          countryCode: row.city?.country?.code ?? "",
          countryName: countryNames.en || countryNames.ru || "",
          cityName: cityNames.en || cityNames.ru || "",
          countryNameRu: countryNames.ru || countryNames.en || "",
          countryNameEn: countryNames.en || countryNames.ru || "",
          cityNameRu: cityNames.ru || cityNames.en || "",
          cityNameEn: cityNames.en || cityNames.ru || "",
          status: row.status,
        };
      })
      .sort((a, b) => a.countryName.localeCompare(b.countryName) || a.cityName.localeCompare(b.cityName) || a.code.localeCompare(b.code));
  }

  async createAirport(
    input: { code: string; name?: string; countryCode?: string; countryName?: string; cityName?: string; countryNameRu?: string; countryNameEn?: string; cityNameRu?: string; cityNameEn?: string },
    actor?: AuthUser | null,
  ) {
    const code = String(input.code ?? "").trim().toUpperCase();
    if (!code) throw new ConflictException("Airport code is required");
    const countryName = String(input.countryName ?? "").trim();
    const cityName = String(input.cityName ?? "").trim();
    const row = await this.prisma.airport.create({
      data: {
        code,
        name: String(input.name ?? code).trim() || code,
        countryCode: String(input.countryCode ?? "").trim().toUpperCase(),
        countryName,
        cityName,
        countryNameRu: String(input.countryNameRu ?? countryName).trim(),
        countryNameEn: String(input.countryNameEn ?? countryName).trim(),
        cityNameRu: String(input.cityNameRu ?? cityName).trim(),
        cityNameEn: String(input.cityNameEn ?? cityName).trim(),
      },
    });
    await this.audit(actor, "hotel_directory.airports.create", "Airport", row.id, row);
    return row;
  }

  listServiceTypes(status?: string) {
    return this.prisma.serviceType.findMany({
      where: status ? { status: status as never } : undefined,
      orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
    });
  }

  async createServiceType(
    input: { code?: string; names?: { ru?: string; en?: string; az?: string }; name?: string; lang?: string; sortOrder?: number; status?: string },
    actor?: AuthUser | null,
  ) {
    const names: Record<string, string> = { ...(input.names ?? {}) } as Record<string, string>;
    const fallback = String(input.name ?? "").trim();
    if (fallback) names[(input.lang === "az" ? "az" : input.lang === "en" ? "en" : "ru")] = fallback;
    if (!names.ru && !names.en && !names.az) throw new ConflictException("Service type name is required");
    const code = (input.code?.trim() || `ST-${Date.now().toString(36)}`).toUpperCase();
    const row = await this.prisma.serviceType.create({
      data: {
        code,
        names: names as Prisma.InputJsonValue,
        sortOrder: input.sortOrder ?? 0,
        status: (input.status ?? "ACTIVE") as never,
      },
    });
    await this.audit(actor, "hotel_directory.service_types.create", "ServiceType", row.id, row);
    return row;
  }

  async createHotel(
    input: {
      name: string;
      countryName?: string;
      countryCode?: string;
      cityName?: string;
      resortName?: string;
      stars?: number | null;
      categoryLabel?: string | null;
    },
    actor?: AuthUser | null,
  ) {
    const name = cleanHotelName(String(input.name ?? "").trim());
    if (!name) throw new ConflictException("Hotel name is required");
    const normalizedName = normalizeName(name);
    const countryCode = String(input.countryCode ?? "").trim().toUpperCase();
    const countryName = String(input.countryName ?? "").trim();
    const cityName = String(input.cityName ?? "").trim();
    const hotel = await this.prisma.hotel.create({
      data: {
        name,
        normalizedName,
        countryCode,
        countryName,
        cityName,
        resortName: String(input.resortName ?? "").trim(),
        stars: typeof input.stars === "number" ? input.stars : null,
        categoryLabel: input.categoryLabel ?? null,
      },
      select: { id: true, name: true, countryCode: true, countryName: true, cityName: true, resortName: true, stars: true, categoryLabel: true },
    });
    await this.audit(actor, "hotel_directory.hotels.create", "Hotel", hotel.id, hotel);
    return { ...hotel, suppliers: [] as string[] };
  }

  list(type: HotelDirectoryType, status?: string) {
    return this.model(type).findMany({
      where: status ? { status: status as CategoryStatus } : undefined,
      orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
    });
  }

  async get(type: HotelDirectoryType, idOrCode: string) {
    const delegate = this.model(type);
    const entry =
      (await delegate.findUnique({ where: { id: idOrCode } })) ??
      (await delegate.findUnique({
        where: { code: idOrCode.toUpperCase() },
      }));
    if (!entry) {
      throw new NotFoundException(`${AUDIT_BY_TYPE[type]} ${idOrCode} not found`);
    }
    return entry;
  }

  async create(
    type: HotelDirectoryType,
    dto: CreateDirectoryEntryDto,
    actor?: AuthUser | null,
  ) {
    try {
      const entry = await this.model(type).create({
        data: {
          code: dto.code.toUpperCase(),
          names: dto.names as unknown as Prisma.InputJsonValue,
          sortOrder: dto.sortOrder ?? 0,
          status: dto.status ?? "ACTIVE",
          createdBy: actor?.id ?? null,
        },
      });
      await this.audit(
        actor,
        `hotel_directory.${type}.create`,
        AUDIT_BY_TYPE[type],
        entry.id,
        entry,
      );
      return entry;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new ConflictException(
          `${AUDIT_BY_TYPE[type]} code ${dto.code} already exists`,
        );
      }
      throw error;
    }
  }

  async update(
    type: HotelDirectoryType,
    id: string,
    dto: UpdateDirectoryEntryDto,
    actor?: AuthUser | null,
  ) {
    const delegate = this.model(type);
    const existing = await delegate.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`${AUDIT_BY_TYPE[type]} ${id} not found`);
    }
    const entry = await delegate.update({
      where: { id },
      data: {
        ...(dto.names !== undefined
          ? { names: dto.names as unknown as Prisma.InputJsonValue }
          : {}),
        ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        updatedBy: actor?.id ?? null,
      },
    });
    await this.audit(
      actor,
      `hotel_directory.${type}.update`,
      AUDIT_BY_TYPE[type],
      id,
      { before: existing, after: entry },
    );
    return entry;
  }

  async remove(
    type: HotelDirectoryType,
    id: string,
    actor?: AuthUser | null,
  ) {
    const delegate = this.model(type);
    const existing = await delegate.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`${AUDIT_BY_TYPE[type]} ${id} not found`);
    }
    await delegate.delete({ where: { id } });
    await this.audit(
      actor,
      `hotel_directory.${type}.delete`,
      AUDIT_BY_TYPE[type],
      id,
      existing,
    );
    return { deleted: true, id };
  }

  async search(query: string, type?: string, status?: string) {
    const q = query.trim();
    if (q.length < 2) {
      return { categories: [], "room-types": [], "placement-types": [], "meal-types": [] };
    }
    const types: HotelDirectoryType[] =
      type && (HOTEL_DIRECTORY_TYPES as readonly string[]).includes(type)
        ? [type as HotelDirectoryType]
        : [...HOTEL_DIRECTORY_TYPES];
    const where = {
      ...(status ? { status: status as CategoryStatus } : {}),
      OR: [
        { code: { contains: q.toUpperCase() } },
        { names: { string_contains: q } },
      ],
    };
    const out: Record<string, unknown[]> = {};
    await Promise.all(
      types.map(async (t) => {
        out[t] = await this.model(t).findMany({
          where,
          take: 25,
          orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
        });
      }),
    );
    return {
      categories: out.categories ?? [],
      "room-types": out["room-types"] ?? [],
      "placement-types": out["placement-types"] ?? [],
      "meal-types": out["meal-types"] ?? [],
    };
  }
}
