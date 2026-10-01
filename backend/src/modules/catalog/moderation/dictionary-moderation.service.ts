import { Injectable } from "@nestjs/common";
import { type CategoryStatus, Prisma } from "../../../generated/prisma/client";
import { PrismaService } from "../../../prisma/prisma.service";
import { SecurityService } from "../../../security/security.service";
import { ConflictError, NotFoundError, ValidationDomainError } from "../../../shared/errors";
import type { AuthUser } from "../../../security/auth/auth.service";

/**
 * Очередь модерации справочников конструктора (решения №1/№3/№4 плана):
 * партнёр предлагает тип номера/вида → PENDING; модератор утверждает (→ACTIVE),
 * сливает с существующим ACTIVE (переписывает ссылки в продуктах) или отклоняет.
 *
 * Ссылки, которые пере-пишет merge:
 *  - ServiceUnit.attributes.payload.roomTypeId → RoomType.id (шаг «Проживание»);
 *  - Tariff.inclusions.viewCode → ViewType.code.
 *
 * Гейт публикации: approve продукта падает 422, пока продукт ссылается на
 * не-ACTIVE запись справочника (модератор сначала решает её в очереди).
 */

export const DICTIONARY_TYPES = ["room-types", "view-types"] as const;
export type DictionaryType = (typeof DICTIONARY_TYPES)[number];

const DICTIONARY_STATUSES: CategoryStatus[] = ["ACTIVE", "PENDING", "INACTIVE"];

export interface DictionaryEntryView {
  id: string;
  code: string;
  names: unknown;
  sortOrder: number;
  status: CategoryStatus;
  createdAt: Date;
  createdBy: string | null;
  /** Сколько продуктов уже используют запись (для решений merge/reject). */
  usage: { units: number; tariffs: number };
}

@Injectable()
export class DictionaryModerationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly security: SecurityService,
  ) {}

  private parseType(type: string): DictionaryType {
    if ((DICTIONARY_TYPES as readonly string[]).includes(type)) return type as DictionaryType;
    throw new ValidationDomainError(`Unknown dictionary type: ${type}`);
  }

  private async findEntry(type: DictionaryType, id: string) {
    const row =
      type === "room-types"
        ? await this.prisma.roomType.findUnique({ where: { id } })
        : await this.prisma.viewType.findUnique({ where: { id } });
    if (!row) throw new NotFoundError(`Dictionary entry ${id} (${type}) not found`);
    return row;
  }

  private async usage(
    type: DictionaryType,
    entry: { id: string; code: string },
  ): Promise<{ units: number; tariffs: number }> {
    if (type === "room-types") {
      const units = await this.prisma.serviceUnit.count({
        where: { attributes: { path: ["payload", "roomTypeId"], equals: entry.id } },
      });
      return { units, tariffs: 0 };
    }
    const tariffs = await this.prisma.tariff.count({
      where: { inclusions: { path: ["viewCode"], equals: entry.code } },
    });
    return { units: 0, tariffs };
  }

  /** Очередь справочника: PENDING — к решению; ACTIVE — справочная информация. */
  async list(type: string, status?: string): Promise<{ type: DictionaryType; items: DictionaryEntryView[] }> {
    const dictType = this.parseType(type);
    if (status !== undefined && !DICTIONARY_STATUSES.includes(status as CategoryStatus)) {
      throw new ValidationDomainError(`Unknown status: ${status}`);
    }
    const rows =
      dictType === "room-types"
        ? await this.prisma.roomType.findMany({
            where: status ? { status: status as CategoryStatus } : { status: { in: ["ACTIVE", "PENDING"] } },
            orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
          })
        : await this.prisma.viewType.findMany({
            where: status ? { status: status as CategoryStatus } : { status: { in: ["ACTIVE", "PENDING"] } },
            orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
          });
    const items: DictionaryEntryView[] = [];
    for (const row of rows) {
      items.push({
        id: row.id,
        code: row.code,
        names: row.names,
        sortOrder: row.sortOrder,
        status: row.status,
        createdAt: row.createdAt,
        createdBy: row.createdBy,
        usage: await this.usage(dictType, row),
      });
    }
    return { type: dictType, items };
  }

  /** PENDING → ACTIVE (запись входит в базу платформы — решение №1). */
  async approve(type: string, id: string, actor: AuthUser) {
    const dictType = this.parseType(type);
    const row = await this.findEntry(dictType, id);
    if (row.status !== "PENDING") throw new ConflictError(`Entry ${row.code} is ${row.status}; only PENDING can be approved`);
    const updated =
      dictType === "room-types"
        ? await this.prisma.roomType.update({ where: { id }, data: { status: "ACTIVE", updatedBy: actor.id } })
        : await this.prisma.viewType.update({ where: { id }, data: { status: "ACTIVE", updatedBy: actor.id } });
    await this.security.audit(this.prisma as unknown as Prisma.TransactionClient, {
      userId: actor.id,
      username: actor.username,
      action: "moderation.dictionary_approved",
      resource: dictType,
      resourceId: id,
      details: { code: row.code, names: row.names },
    });
    return updated;
  }

  /** Отклонение PENDING-записи. Если на неё уже ссылаются продукты — 409 (merge). */
  async reject(type: string, id: string, actor: AuthUser, comment?: string) {
    const dictType = this.parseType(type);
    const row = await this.findEntry(dictType, id);
    if (row.status !== "PENDING") throw new ConflictError(`Entry ${row.code} is ${row.status}; only PENDING can be rejected`);
    const use = await this.usage(dictType, row);
    if (use.units + use.tariffs > 0) {
      throw new ConflictError(`Entry ${row.code} is referenced by ${use.units + use.tariffs} product object(s) — use merge instead`);
    }
    if (dictType === "room-types") await this.prisma.roomType.delete({ where: { id } });
    else await this.prisma.viewType.delete({ where: { id } });
    await this.security.audit(this.prisma as unknown as Prisma.TransactionClient, {
      userId: actor.id,
      username: actor.username,
      action: "moderation.dictionary_rejected",
      resource: dictType,
      resourceId: id,
      details: { code: row.code, names: row.names, comment: comment ?? null },
    });
    return { rejected: id, code: row.code };
  }

  /**
   * Слияние PENDING-записи в существующую ACTIVE: ссылки продуктов
   * переписываются на target, источник удаляется (атомарно).
   */
  async merge(type: string, sourceId: string, targetId: string, actor: AuthUser) {
    const dictType = this.parseType(type);
    if (sourceId === targetId) throw new ValidationDomainError("source and target must differ");
    const source = await this.findEntry(dictType, sourceId);
    const target = await this.findEntry(dictType, targetId);
    if (source.status !== "PENDING") throw new ConflictError(`Entry ${source.code} is ${source.status}; only PENDING can be merged`);
    if (target.status !== "ACTIVE") throw new ConflictError(`Merge target ${target.code} must be ACTIVE`);

    const result = await this.prisma.$transaction(async (tx) => {
      let updatedUnits = 0;
      let updatedTariffs = 0;
      if (dictType === "room-types") {
        const units = await tx.serviceUnit.findMany({
          where: { attributes: { path: ["payload", "roomTypeId"], equals: source.id } },
          select: { id: true, attributes: true },
        });
        for (const unit of units) {
          const attrs = { ...((unit.attributes ?? {}) as Record<string, unknown>) };
          const payload = { ...((attrs.payload ?? {}) as Record<string, unknown>) };
          payload.roomTypeId = target.id;
          attrs.payload = payload;
          await tx.serviceUnit.update({ where: { id: unit.id }, data: { attributes: attrs as Prisma.InputJsonValue } });
          updatedUnits += 1;
        }
        await tx.roomType.delete({ where: { id: source.id } });
      } else {
        const tariffs = await tx.tariff.findMany({
          where: { inclusions: { path: ["viewCode"], equals: source.code } },
          select: { id: true, inclusions: true },
        });
        for (const tariff of tariffs) {
          const inclusions = { ...((tariff.inclusions ?? {}) as Record<string, unknown>) };
          inclusions.viewCode = target.code;
          await tx.tariff.update({ where: { id: tariff.id }, data: { inclusions: inclusions as Prisma.InputJsonValue } });
          updatedTariffs += 1;
        }
        await tx.viewType.delete({ where: { id: source.id } });
      }
      await this.security.audit(tx, {
        userId: actor.id,
        username: actor.username,
        action: "moderation.dictionary_merged",
        resource: dictType,
        resourceId: source.id,
        details: { sourceCode: source.code, targetId: target.id, targetCode: target.code, updatedUnits, updatedTariffs },
      });
      return { merged: sourceId, targetId, sourceCode: source.code, targetCode: target.code, updatedUnits, updatedTariffs };
    });
    return result;
  }

  /**
   * Pre-publish гейт (вызывается из ModerationService.approve внутри tx):
   * продукт не публикуется, пока ссылается на не-ACTIVE запись справочника.
   */
  async assertNoPendingDictionaryRefs(tx: Prisma.TransactionClient, productId: string): Promise<void> {
    const product = await tx.product.findUnique({
      where: { id: productId },
      select: {
        code: true,
        serviceUnits: { select: { attributes: true, tariffs: { select: { inclusions: true } } } },
      },
    });
    if (!product) throw new NotFoundError(`Product ${productId} not found`);

    const roomTypeIds = new Set<string>();
    const viewCodes = new Set<string>();
    for (const unit of product.serviceUnits) {
      const payload = ((unit.attributes ?? {}) as Record<string, unknown>).payload as Record<string, unknown> | undefined;
      const roomTypeId = payload?.roomTypeId;
      if (typeof roomTypeId === "string") roomTypeIds.add(roomTypeId);
      for (const tariff of unit.tariffs) {
        const inclusions = (tariff.inclusions ?? null) as Record<string, unknown> | null;
        const viewCode = inclusions?.viewCode;
        if (typeof viewCode === "string") viewCodes.add(viewCode);
      }
    }

    const pendingRoomTypes = roomTypeIds.size
      ? await tx.roomType.findMany({ where: { id: { in: [...roomTypeIds] }, status: { not: "ACTIVE" } }, select: { code: true } })
      : [];
    const pendingViews = viewCodes.size
      ? await tx.viewType.findMany({ where: { code: { in: [...viewCodes] }, status: { not: "ACTIVE" } }, select: { code: true } })
      : [];

    const pendingCodes = [...pendingRoomTypes.map((r) => r.code), ...pendingViews.map((v) => v.code)];
    if (pendingCodes.length) {
      throw new ValidationDomainError(
        `Product ${product.code} ссылается на записи справочника, не прошедшие модерацию: ${pendingCodes.join(", ")} — утвердите/слейте их в очереди справочников (moderation/dictionary-entries)`,
      );
    }
  }
}
