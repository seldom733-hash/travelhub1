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

export const HOTEL_DIRECTORY_TYPES = [
  "categories",
  "room-types",
  "placement-types",
  "meal-types",
] as const;
export type HotelDirectoryType = (typeof HOTEL_DIRECTORY_TYPES)[number];

const MODEL_BY_TYPE: Record<HotelDirectoryType, string> = {
  categories: "hotelCategory",
  "room-types": "roomType",
  "placement-types": "placementType",
  "meal-types": "mealType",
};

const AUDIT_BY_TYPE: Record<HotelDirectoryType, string> = {
  categories: "HotelCategory",
  "room-types": "RoomType",
  "placement-types": "PlacementType",
  "meal-types": "MealType",
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
