import { Injectable, Logger } from "@nestjs/common";
import { Prisma, type ServiceUnitStatus } from "../../generated/prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { IdsService } from "../../shared/ids.service";
import { SecurityService } from "../../security/security.service";
import { ConflictError, ForbiddenError, NotFoundError, ValidationDomainError } from "../../shared/errors";
import { uniqueConstraintNames } from "../../shared/prisma-errors";
import { CatalogAccessPolicy } from "./catalog-access.policy";
import { RoleCode } from "../../generated/prisma/enums";
import type { AuthUser } from "../../security/auth/auth.service";
import {
  assertImportIdentityConsistency,
  validateExternalKey,
  validateImportSource,
  validateServiceUnitName,
  validateUnitAttributes,
} from "./service-unit.validation";
import type { AttributeDef } from "./category-schema.validation";

/** CategorySchema.attributes хранится как JSONB — приводим к AttributeDef[] при валидации. */
type SchemaRow = { id: string; attributes: Prisma.JsonValue };
const toDefs = (row: SchemaRow): { id: string; attributes: AttributeDef[] } => ({
  id: row.id,
  attributes: (Array.isArray(row.attributes) ? row.attributes : []) as unknown as AttributeDef[],
});

const toJson = (v: Record<string, unknown>): Prisma.InputJsonValue => v as unknown as Prisma.InputJsonValue;

/**
 * PHASE 1 STEP 1.8A — Service Unit (Seller Commercial Unit) — Catalog owner.
 *
 * DD-025 B: персистентная Seller-определённая коммерческая/сервисная единица
 * ВНУТРИ Product. Owner — catalog.* (как Product/Tariff; ADR-0001 owner-service
 * contract — никаких cross-domain writers).
 *
 * Инварианты:
 *  - ownership: юнит принадлежит Product; partnerId наследуется из Product
 *    (server-derived, НЕ из body), immutable; PARTNER — только СВОИ Product
 *    (CatalogAccessPolicy object scope);
 *  - category/schema-контекст наследуется из Product (categoryId/categorySchemaId
 *    — snapshot refs): attributes валидируются по схеме-снапшоту (§5-контракт как
 *    у Product), а не по новейшей ACTIVE — изменение CategorySchema не
 *    переинтерпретирует исторические unit-данные (§13);
 *  - Seller-название verbatim (валидатор сохраняет case/порядок слов);
 *  - lifecycle DRAFT → PUBLISHED → ARCHIVED; PUBLISHED — только если родительский
 *    Product PUBLISHED (§15: юнит не может сделать неопубликованный Product
 *    публично bookable); idempotent no-op при том же состоянии;
 *  - PARTNER правит ТОЛЬКО СВОЙ DRAFT (update_own_draft); staff/ADMIN — любые
 *    не-ARCHIVED (catalog.product.write / catalog.service_unit.publish);
 *  - import identity (source, externalKey) — trusted (staff/ADMIN), immutable;
 *    уникальность в ownership scope (partnerId+productId+source+externalKey);
 *    P2002 → controlled 409;
 *  - никаких price/availability полей; никаких событий (нет consumer — §37);
 *  - audit: ServiceUnitHistory + SecurityService.audit (без dump атрибутов в
 *    security audit — только refs/lifecycle).
 */
@Injectable()
export class ServiceUnitService {
  private readonly logger = new Logger(ServiceUnitService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ids: IdsService,
    private readonly security: SecurityService,
    private readonly policy: CatalogAccessPolicy,
  ) {}

  // ── Ownership helpers ───────────────────────────────────────────────────

  /** PARTNER может управлять юнитами только СВОИХ Product (object scope). */
  private managePermission(actor: AuthUser): string {
    return actor.role === RoleCode.PARTNER ? "catalog.product.update_own_draft" : "catalog.product.write";
  }

  /** Read scope: PARTNER — только свои; staff/ADMIN — catalog.product.read. */
  private readPermission(actor: AuthUser): string {
    return actor.role === RoleCode.PARTNER ? "catalog.product.read_own" : "catalog.product.read";
  }

  /**
   * Assert manage access к Product (владелец юнита). PARTNER — только свои
   * (ForbiddenException 403 на чужой); staff/ADMIN — explicit permission.
   */
  private async assertProductManage(actor: AuthUser, productId: string): Promise<{ partnerId: string | null; status: string }> {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, partnerId: true, status: true },
    });
    if (!product) throw new NotFoundError(`Product ${productId} not found`);
    this.policy.assertCanManage(actor, product.partnerId, this.managePermission(actor));
    return { partnerId: product.partnerId, status: product.status };
  }

  /** Own-scope lookup юнита (PARTNER — только свои; иначе staff read). */
  private async findUnit(id: string, actor: AuthUser) {
    const unit = await this.prisma.serviceUnit.findUnique({
      where: { id },
      include: { product: { select: { id: true, partnerId: true } } },
    });
    if (!unit) throw new NotFoundError(`Service unit ${id} not found`);
    if (actor.role === RoleCode.PARTNER) {
      this.policy.assertCanManage(actor, unit.product.partnerId, this.readPermission(actor));
    } else {
      this.policy.assertCanRead(actor, unit.product.partnerId);
    }
    return unit;
  }

  private toView(row: {
    id: string;
    code: string;
    productId: string;
    name: string;
    categoryId: string | null;
    categorySchemaId: string | null;
    attributes: unknown;
    source: string | null;
    externalKey: string | null;
    partnerId: string | null;
    status: string;
    version: number;
    publishedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    createdBy: string | null;
    updatedBy: string | null;
  }) {
    return {
      id: row.id,
      code: row.code,
      productId: row.productId,
      name: row.name,
      categoryId: row.categoryId,
      categorySchemaId: row.categorySchemaId,
      attributes: row.attributes ?? {},
      source: row.source,
      externalKey: row.externalKey,
      partnerId: row.partnerId,
      status: row.status,
      version: row.version,
      publishedAt: row.publishedAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      createdBy: row.createdBy,
      updatedBy: row.updatedBy,
    };
  }

  /**
   * Category/schema-контекст юнита наследуется из Product (snapshot refs).
   * attributes валидируются по схеме-снапшоту (§5-контракт как у Product):
   *  - create: снапшот Product (categoryId/categorySchemaId на момент создания);
   *  - update: снапшот САМОГО юнита (unit.categoryId/unit.categorySchemaId),
   *    а не текущий Product-снапшот — изменение CategorySchema/Product не
   *    переинтерпретирует исторические unit-данные без явного переиздания
   *    attributes (STRICT REVIEW §13); fallback на Product-снапшот — только
   *    если unit-снапшот отсутствует.
   */
  private async resolveUnitCategoryData(
    tx: Prisma.TransactionClient,
    ctx: { categoryId: string | null; categorySchemaId: string | null },
    attributes: Record<string, unknown>,
  ): Promise<{ categoryId: string | null; categorySchemaId: string | null; attributes: Prisma.InputJsonValue }> {
    if (!ctx.categoryId) {
      const validated = validateUnitAttributes(null, attributes);
      return { categoryId: null, categorySchemaId: null, attributes: toJson(validated) };
    }
    let schema: SchemaRow | null = null;
    if (ctx.categorySchemaId) {
      schema = await tx.categorySchema.findFirst({
        where: { id: ctx.categorySchemaId, categoryId: ctx.categoryId, status: { in: ["ACTIVE", "DEPRECATED"] } },
        select: { id: true, attributes: true },
      });
    }
    if (!schema) {
      schema = await tx.categorySchema.findFirst({
        where: { categoryId: ctx.categoryId, status: "ACTIVE" },
        orderBy: { version: "desc" },
        select: { id: true, attributes: true },
      });
    }
    if (!schema) {
      throw new ValidationDomainError(`No ACTIVE Category Schema for category "${ctx.categoryId}"`);
    }
    const defs = toDefs(schema);
    const validated = validateUnitAttributes(defs, attributes);
    return { categoryId: ctx.categoryId, categorySchemaId: schema.id, attributes: toJson(validated) };
  }

  // ── Create ──────────────────────────────────────────────────────────────

  /**
   * Создание юнита под СВОИМ Product (PARTNER — create_own; staff/ADMIN — write).
   * - Seller-название verbatim (обязательное);
   * - attributes валидируются по CategorySchema-снапшоту Product;
   * - import identity (source/externalKey) — ТОЛЬКО staff/ADMIN (trusted);
   *   PARTNER, передавший source/externalKey → 422 (forged authority);
   * - code UNI-* — IdsService (атомарный счётчик); client не контролирует;
   * - уникальность import identity (P2002) → controlled 409;
   * - никаких Tariff/Availability/Reservation/Quote/Order/Booking побочных
   *   эффектов; событий нет (§37).
   */
  async create(
    productId: string,
    input: { name: string; attributes?: Record<string, unknown>; source?: string | null; externalKey?: string | null },
    actor: AuthUser,
  ) {
    const name = validateServiceUnitName(input.name);
    const source = validateImportSource(input.source);
    const externalKey = validateExternalKey(input.externalKey);
    assertImportIdentityConsistency(source, externalKey);

    // Import identity — server/trusted (staff/ADMIN trusted provisioning).
    // PARTNER НЕ имеет authority на source/externalKey (§17).
    if (actor.role === RoleCode.PARTNER && (source !== null || externalKey !== null)) {
      throw new ValidationDomainError(
        "Import identity (source/externalKey) is server/trusted and cannot be set by a PARTNER",
      );
    }

    const row = await this.prisma.$transaction(async (tx) => {
      const product = await tx.product.findUnique({
        where: { id: productId },
        select: { id: true, code: true, partnerId: true, status: true, categoryId: true, categorySchemaId: true },
      });
      if (!product) throw new NotFoundError(`Product ${productId} not found`);
      this.policy.assertCanManage(actor, product.partnerId, this.managePermission(actor));
      // §15: юнит нельзя добавить в ARCHIVED Product (коммерческая структура
      // архивированного продукта не расширяется).
      if (product.status === "ARCHIVED") {
        throw new ConflictError(`Product ${product.code} is ARCHIVED; cannot add service units`);
      }

      const categoryData = await this.resolveUnitCategoryData(tx, product, input.attributes ?? {});

      const code = await this.ids.nextCode(tx, "UNI");
      let created;
      try {
        created = await tx.serviceUnit.create({
          data: {
            code,
            productId: product.id,
            name,
            partnerId: product.partnerId,
            status: "DRAFT",
            version: 1,
            createdBy: actor.username,
            updatedBy: actor.username,
            source,
            externalKey,
            ...categoryData,
          },
        });
      } catch (err) {
        const names = uniqueConstraintNames(err);
        if (names.some((n) => n.toLowerCase().includes("externalkey"))) {
          throw new ConflictError(
            "A service unit with this import identity (source+externalKey) already exists under this product (import reconcile)",
          );
        }
        throw err;
      }

      await tx.serviceUnitHistory.create({
        data: {
          unitId: created.id,
          version: 1,
          action: "created",
          to: "DRAFT",
          actorId: actor.id,
          actorName: actor.username,
          comment: "Service unit created (structure-only)",
        },
      });
      await this.security.audit(tx, {
        userId: actor.id,
        username: actor.username,
        action: "service_unit.created",
        resource: "ServiceUnit",
        resourceId: created.id,
        details: { productId: product.id, partnerId: product.partnerId, code, source },
      });
      return created;
    });

    this.logger.log(`Service unit ${row.code} created under product ${productId} (DRAFT)`);
    return this.toView(row);
  }

  // ── Reads ───────────────────────────────────────────────────────────────

  /** List юнитов Product (PARTNER — только свои Product; детерминированный order). */
  async listForProduct(productId: string, actor: AuthUser, limit: number, offset: number) {
    await this.assertProductManage(actor, productId);
    const [items, total] = await this.prisma.$transaction([
      this.prisma.serviceUnit.findMany({
        where: { productId },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        skip: offset,
        take: limit,
      }),
      this.prisma.serviceUnit.count({ where: { productId } }),
    ]);
    return { items: items.map((r) => this.toView(r)), total };
  }

  /** Get юнита по ID (PARTNER — только свой; staff/ADMIN — read). */
  async get(id: string, actor: AuthUser) {
    return this.toView(await this.findUnit(id, actor));
  }

  /** History юнита (own-scope; без dump атрибутов). */
  async history(id: string, actor: AuthUser) {
    await this.findUnit(id, actor);
    const rows = await this.prisma.serviceUnitHistory.findMany({
      where: { unitId: id },
      orderBy: { createdAt: "desc" },
    });
    return { items: rows };
  }

  // ── Update ──────────────────────────────────────────────────────────────

  /**
   * PATCH юнита: name/attributes (PARTNER — ТОЛЬКО свой DRAFT; staff/ADMIN —
   * любые не-ARCHIVED). productId/categoryId/schema/partnerId/code/status/
   * version/source/externalKey immutable (forbidden keys → 422).
   * Attributes перевалидируются по схеме-снапшоту (как create).
   */
  async update(
    id: string,
    input: { name?: string; attributes?: Record<string, unknown> },
    actor: AuthUser,
  ) {
    const current = await this.findUnit(id, actor);
    this.policy.assertCanManage(actor, current.product.partnerId, this.managePermission(actor));

    if (current.status === "ARCHIVED") {
      throw new ConflictError(`Service unit ${current.code} is ARCHIVED; cannot update`);
    }
    if (actor.role === RoleCode.PARTNER && current.status !== "DRAFT") {
      throw new ConflictError(
        `Service unit ${current.code} is ${current.status}; PARTNER can only edit DRAFT units`,
      );
    }

    const attributesChanged = input.attributes !== undefined;

    const row = await this.prisma.$transaction(async (tx) => {
      const unit = await tx.serviceUnit.findUniqueOrThrow({
        where: { id },
        include: { product: { select: { categoryId: true, categorySchemaId: true } } },
      });
      // STRICT REVIEW FIX §34: name-fallback резолвится из СВЕЖЕЙ строки внутри tx
      // (unit.name), а не из stale `current` (вне tx) — concurrent PATCH не может
      // откатить чужое переименование через потерянное обновление (lost update).
      const name = input.name !== undefined ? validateServiceUnitName(input.name) : unit.name;
      // STRICT REVIEW §13: перевалидация attributes идёт по снапшоту САМОГО юнита
      // (unit.categoryId/categorySchemaId), а не по текущему Product-снапшоту —
      // изменение CategorySchema/Product НЕ переинтерпретирует исторические
      // unit-данные (fallback на Product-контекст только при отсутствии unit-снапшота).
      const unitCtx = {
        categoryId: unit.categoryId ?? unit.product.categoryId,
        categorySchemaId: unit.categorySchemaId ?? unit.product.categorySchemaId,
      };
      let categoryData: { categoryId?: string | null; categorySchemaId?: string | null; attributes?: Prisma.InputJsonValue } = {};
      if (attributesChanged) {
        const resolved = await this.resolveUnitCategoryData(tx, unitCtx, input.attributes ?? {});
        categoryData = {
          categoryId: resolved.categoryId,
          categorySchemaId: resolved.categorySchemaId,
          attributes: resolved.attributes,
        };
      }

      // STRICT REVIEW §34/§35: атомарный stale-state guard — conditional update
      // применяется только если статус всё ещё удовлетворяет гейту (PARTNER —
      // только DRAFT; staff/ADMIN — не ARCHIVED). Параллельный publish/archive
      // НЕ может обойти гейт через stale read (TOCTOU).
      const statusGate =
        actor.role === RoleCode.PARTNER ? { status: "DRAFT" as const } : { status: { not: "ARCHIVED" as const } };
      const res = await tx.serviceUnit.updateMany({
        where: { id, ...statusGate },
        data: {
          name,
          version: { increment: 1 },
          updatedBy: actor.username,
          ...categoryData,
        },
      });
      if (res.count === 0) {
        const fresh = await tx.serviceUnit.findUniqueOrThrow({ where: { id }, select: { code: true, status: true } });
        if (fresh.status === "ARCHIVED") {
          throw new ConflictError(`Service unit ${fresh.code} is ARCHIVED; cannot update`);
        }
        throw new ConflictError(
          `Service unit ${fresh.code} is ${fresh.status}; PARTNER can only edit DRAFT units`,
        );
      }
      const updated = await tx.serviceUnit.findUniqueOrThrow({ where: { id } });

      await tx.serviceUnitHistory.create({
        data: {
          unitId: id,
          version: updated.version,
          action: "updated",
          from: current.status,
          to: current.status,
          fields: toJson({ name: input.name !== undefined ? name : undefined }),
          actorId: actor.id,
          actorName: actor.username,
          comment: "Service unit updated",
        },
      });
      await this.security.audit(tx, {
        userId: actor.id,
        username: actor.username,
        action: "service_unit.updated",
        resource: "ServiceUnit",
        resourceId: id,
        details: { code: current.code, productId: current.productId },
      });
      return updated;
    });

    return this.toView(row);
  }

  // ── Lifecycle (Catalog publication authority) ───────────────────────────

  /**
   * Publish: DRAFT → PUBLISHED (staff/ADMIN — catalog.service_unit.publish).
   * Гейт §15: родительский Product должен быть PUBLISHED — юнит не может сделать
   * неопубликованный Product публично bookable. Idempotent: уже PUBLISHED → no-op.
   */
  async publish(id: string, actor: AuthUser) {
    const current = await this.findUnit(id, actor);
    this.policy.assertCanManage(actor, current.product.partnerId, "catalog.service_unit.publish");
    if (current.status === "PUBLISHED") return this.toView(current);

    const row = await this.prisma.$transaction(async (tx) => {
      // STRICT REVIEW §16: authoritative Product status re-read ВНУТРИ tx.
      const unit = await tx.serviceUnit.findUniqueOrThrow({
        where: { id },
        select: { id: true, code: true, productId: true, status: true },
      });
      const product = await tx.product.findUniqueOrThrow({
        where: { id: unit.productId },
        select: { status: true, code: true },
      });
      if (product.status !== "PUBLISHED") {
        throw new ConflictError(
          `Cannot publish service unit ${unit.code}: parent Product ${product.code} is ${product.status}; unit publication requires a PUBLISHED product`,
        );
      }
      // Атомарный transition: только DRAFT/ARCHIVED → PUBLISHED (re-publish из
      // ARCHIVED разрешён — конвенция re-publish Product). Параллельный archive,
      // уже закоммитивший ARCHIVED, НЕ даёт publish проскочить по stale read.
      const res = await tx.serviceUnit.updateMany({
        where: { id, status: { in: ["DRAFT", "ARCHIVED"] } },
        data: { status: "PUBLISHED", publishedAt: new Date(), version: { increment: 1 }, updatedBy: actor.username },
      });
      if (res.count === 0) {
        // Уже PUBLISHED конкурентно → idempotent no-op (без истории/аудита).
        const fresh = await tx.serviceUnit.findUniqueOrThrow({ where: { id } });
        if (fresh.status === "PUBLISHED") return this.toView(fresh);
        throw new ConflictError(`Service unit ${unit.code} is ${fresh.status}; cannot publish`);
      }
      const updated = await tx.serviceUnit.findUniqueOrThrow({ where: { id } });
      await tx.serviceUnitHistory.create({
        data: {
          unitId: id,
          version: updated.version,
          action: "published",
          from: current.status,
          to: "PUBLISHED",
          actorId: actor.id,
          actorName: actor.username,
          comment: "Service unit published (Catalog publication authority)",
        },
      });
      await this.security.audit(tx, {
        userId: actor.id,
        username: actor.username,
        action: "service_unit.published",
        resource: "ServiceUnit",
        resourceId: id,
        details: { code: unit.code, productId: unit.productId },
      });
      return updated;
    });

    this.logger.log(`Service unit ${row.code} published`);
    return this.toView(row);
  }

  /**
   * Archive: DRAFT/PUBLISHED → ARCHIVED (soft, как Product — данные сохраняются).
   * Idempotent: уже ARCHIVED → no-op. Не удаляет (нет destructive cascade —
   * §35): будущие Tariff/Quote history не обрываются.
   */
  async archive(id: string, actor: AuthUser) {
    const current = await this.findUnit(id, actor);
    this.policy.assertCanManage(actor, current.product.partnerId, "catalog.service_unit.publish");
    if (current.status === "ARCHIVED") return this.toView(current);

    const row = await this.prisma.$transaction(async (tx) => {
      // Атомарный transition: DRAFT/PUBLISHED → ARCHIVED; уже ARCHIVED → no-op.
      const res = await tx.serviceUnit.updateMany({
        where: { id, status: { not: "ARCHIVED" } },
        data: { status: "ARCHIVED", version: { increment: 1 }, updatedBy: actor.username },
      });
      if (res.count === 0) {
        // Уже ARCHIVED конкурентно → idempotent no-op (без истории/аудита).
        const fresh = await tx.serviceUnit.findUniqueOrThrow({ where: { id } });
        return this.toView(fresh);
      }
      const updated = await tx.serviceUnit.findUniqueOrThrow({ where: { id } });
      await tx.serviceUnitHistory.create({
        data: {
          unitId: id,
          version: updated.version,
          action: "archived",
          from: current.status,
          to: "ARCHIVED",
          actorId: actor.id,
          actorName: actor.username,
          comment: "Service unit archived (soft)",
        },
      });
      await this.security.audit(tx, {
        userId: actor.id,
        username: actor.username,
        action: "service_unit.archived",
        resource: "ServiceUnit",
        resourceId: id,
        details: { code: updated.code, productId: updated.productId },
      });
      return updated;
    });

    this.logger.log(`Service unit ${row.code} archived`);
    return this.toView(row);
  }
}
