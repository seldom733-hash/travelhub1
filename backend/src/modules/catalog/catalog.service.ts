import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { Prisma, type ProductStatus, type ProductType } from "../../generated/prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { EventBusService } from "../../eventbus/eventbus.service";
import { DomainEvents, type ProductEventPayload } from "../../eventbus/domain-events";
import { IdsService } from "../../shared/ids.service";
import { ConflictError, NotFoundError, ValidationDomainError } from "../../shared/errors";
import { validateAttributes, validateCategorySlug, validateSchemaConfig, type AttributeDef } from "./category-schema.validation";
import { CANONICAL_CATEGORIES, DEFAULT_SCHEMA_CONFIG } from "./canonical-categories";

export interface CreateTariffDto {
  name: string;
  price: number;
  currency?: string;
}

export interface CreateProductInput {
  type: ProductType;
  title: string;
  slug?: string;
  description?: string;
  tariffs?: CreateTariffDto[];
  /** Step 1.1: категория + category-specific attributes (валидируются по ACTIVE Category Schema). */
  categoryId?: string;
  attributes?: Record<string, unknown>;
}

export interface UpdateProductInput {
  title?: string;
  description?: string;
  tariffs?: CreateTariffDto[];
  categoryId?: string;
  attributes?: Record<string, unknown>;
}

export interface ProductListQuery {
  type?: string;
  status?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

const EDITABLE_STATUSES: ProductStatus[] = ["DRAFT", "COMPLETE", "REVIEWED", "CHANGED"];
const VALID_STATUSES: ProductStatus[] = ["DRAFT", "COMPLETE", "REVIEWED", "PUBLISHED", "CHANGED", "ARCHIVED"];

/**
 * Catalog Center — единственный владелец Product/Category/Tariff/Availability.
 * Не владеет продажами, заказами, бронированиями (только productId в других доменах).
 * Публикует: ProductCreated, ProductPublished, ProductArchived.
 */
@Injectable()
export class CatalogService implements OnModuleInit {
  private readonly logger = new Logger(CatalogService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ids: IdsService,
    private readonly eventBus: EventBusService,
  ) {}

  /**
   * Step 1.1: seed канонических категорий (Master Baseline 1.5) + ACTIVE schema v1
   * для каждой. Детерминированно и идемпотентно (upsert по slug) — как seed ролей.
   */
  async onModuleInit(): Promise<void> {
    await this.seedCanonicalCategories();
  }

  // ── Product ────────────────────────────────────────────────────────────────

  async createProduct(input: CreateProductInput, actor?: string) {
    const result = await this.prisma.$transaction(async (tx) => {
      const code = await this.ids.nextCode(tx, "PRD");
      const slug = await this.uniqueSlug(tx, input.slug ?? input.title);
      // Step 1.1: категория + валидация attributes по ACTIVE Category Schema.
      const categoryData = await this.resolveCategoryData(tx, input.categoryId, input.attributes);

      const product = await tx.product.create({
        data: {
          code,
          type: input.type,
          title: input.title,
          slug,
          description: input.description ?? null,
          status: "DRAFT",
          version: 1,
          createdBy: actor ?? null,
          updatedBy: actor ?? null,
          ...categoryData,
        },
        select: { id: true, code: true, type: true, title: true, slug: true, status: true, categoryId: true, categorySchemaId: true, attributes: true },
      });

      await this.createTariffs(tx, product.id, input.tariffs ?? []);

      await tx.productHistory.create({
        data: {
          productId: product.id,
          version: 1,
          action: "created",
          to: "DRAFT",
          actorId: actor ?? null,
          actorName: actor ?? null,
          comment: "Продукт создан (Catalog Center)",
        },
      });

      const eventId = await this.eventBus.emit(tx, {
        aggregateType: "Product",
        aggregateId: product.id,
        eventType: DomainEvents.ProductCreated,
        payload: { productId: product.id, code: product.code, title: product.title, type: product.type } as ProductEventPayload,
      });

      return { product, eventId };
    });

    await this.eventBus.publishPending();
    return result;
  }

  async listProducts(query: ProductListQuery) {
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20));
    const where: Prisma.ProductWhereInput = {
      ...(query.type ? { type: query.type as ProductType } : {}),
      ...(query.status ? { status: query.status as ProductStatus } : {}),
      ...(query.search
        ? { OR: [{ title: { contains: query.search, mode: "insensitive" } }, { code: { contains: query.search, mode: "insensitive" } }] }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { tariffs: { select: { id: true, code: true, name: true, price: true, currency: true } } },
      }),
      this.prisma.product.count({ where }),
    ]);

    return { items, total, page, pageSize };
  }

  async getProduct(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: {
        tariffs: { orderBy: { createdAt: "asc" } },
        availability: { orderBy: { date: "asc" }, take: 60 },
        history: { orderBy: { createdAt: "desc" }, take: 50 },
        category: { select: { id: true, code: true, slug: true, title: true } },
        categorySchema: { select: { id: true, version: true, status: true } },
      },
    });
    if (!product) throw new NotFoundError(`Product ${id} not found`);
    return product;
  }

  async updateProduct(id: string, input: UpdateProductInput, actor?: string) {
    const result = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.product.findUnique({ where: { id } });
      if (!existing) throw new NotFoundError(`Product ${id} not found`);
      if (!EDITABLE_STATUSES.includes(existing.status)) {
        throw new ConflictError(`Product ${existing.code} is ${existing.status}; only DRAFT/COMPLETE/REVIEWED/CHANGED are editable`);
      }

      // Step 1.1: смена категории/attributes. §5-контракт: если категория НЕ меняется,
      // валидация идёт по схеме-снапшоту, на которую продукт уже ссылается
      // (existing.categorySchemaId), а не по новейшей ACTIVE — изменение Category Schema
      // не может молча перевалидировать/сломать исторический продукт.
      let categoryData: { categoryId?: string; categorySchemaId?: string; attributes?: Prisma.InputJsonValue } = {};
      if (input.categoryId !== undefined || input.attributes !== undefined) {
        const effectiveCategoryId = input.categoryId ?? existing.categoryId ?? undefined;
        if (!effectiveCategoryId) {
          throw new ValidationDomainError("Category-specific attributes require a category");
        }
        const categoryChanged = input.categoryId !== undefined && input.categoryId !== existing.categoryId;
        const preferredSchemaId = categoryChanged ? undefined : (existing.categorySchemaId ?? undefined);
        const base = input.attributes !== undefined ? input.attributes : ((existing.attributes ?? undefined) as Record<string, unknown> | undefined);
        categoryData = await this.resolveCategoryData(tx, effectiveCategoryId, base, preferredSchemaId);
      }

      const updated = await tx.product.update({
        where: { id },
        data: {
          title: input.title ?? existing.title,
          description: input.description !== undefined ? input.description : existing.description,
          version: { increment: 1 },
          updatedBy: actor ?? null,
          ...categoryData,
        },
        select: { id: true, code: true, title: true, slug: true, status: true, version: true, categoryId: true, categorySchemaId: true, attributes: true },
      });

      if (input.tariffs) {
        await tx.tariff.deleteMany({ where: { productId: id } });
        await this.createTariffs(tx, id, input.tariffs);
      }

      await tx.productHistory.create({
        data: {
          productId: id,
          version: updated.version,
          action: "update",
          from: existing.status,
          to: existing.status,
          fields: { title: input.title, description: input.description } as Prisma.InputJsonValue,
          actorId: actor ?? null,
          actorName: actor ?? null,
          comment: "Продукт обновлён",
        },
      });

      return updated;
    });

    await this.eventBus.publishPending();
    return result;
  }

  async publishProduct(id: string, actor?: string) {
    const result = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.product.findUnique({ where: { id } });
      if (!existing) throw new NotFoundError(`Product ${id} not found`);
      if (existing.status === "PUBLISHED") return { product: existing, skipped: true as const };

      const product = await tx.product.update({
        where: { id },
        data: { status: "PUBLISHED", version: { increment: 1 }, publishedAt: new Date(), updatedBy: actor ?? null },
        select: { id: true, code: true, title: true, slug: true, status: true, version: true },
      });

      await tx.productHistory.create({
        data: {
          productId: id,
          version: product.version,
          action: "publish",
          from: existing.status,
          to: "PUBLISHED",
          actorId: actor ?? null,
          actorName: actor ?? null,
          comment: "Продукт опубликован",
        },
      });

      const eventId = await this.eventBus.emit(tx, {
        aggregateType: "Product",
        aggregateId: id,
        eventType: DomainEvents.ProductPublished,
        payload: { productId: id, code: product.code, title: product.title, type: existing.type } as ProductEventPayload,
      });

      return { product, eventId, skipped: false as const };
    });

    await this.eventBus.publishPending();
    return result;
  }

  async archiveProduct(id: string, actor?: string) {
    const result = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.product.findUnique({ where: { id } });
      if (!existing) throw new NotFoundError(`Product ${id} not found`);
      if (existing.status === "ARCHIVED") return { product: existing, skipped: true as const };

      const product = await tx.product.update({
        where: { id },
        data: { status: "ARCHIVED", version: { increment: 1 }, updatedBy: actor ?? null },
        select: { id: true, code: true, title: true, slug: true, status: true, version: true },
      });

      await tx.productHistory.create({
        data: {
          productId: id,
          version: product.version,
          action: "archive",
          from: existing.status,
          to: "ARCHIVED",
          actorId: actor ?? null,
          actorName: actor ?? null,
          comment: "Продукт архивирован",
        },
      });

      const eventId = await this.eventBus.emit(tx, {
        aggregateType: "Product",
        aggregateId: id,
        eventType: DomainEvents.ProductArchived,
        payload: { productId: id, code: product.code, title: product.title, type: existing.type } as ProductEventPayload,
      });

      return { product, eventId, skipped: false as const };
    });

    await this.eventBus.publishPending();
    return result;
  }

  // ── Category / Category Schema (Step 1.1) ──────────────────────────────────

  async listCategories() {
    return this.prisma.category.findMany({ orderBy: { title: "asc" } });
  }

  /**
   * Создание custom Category (Step 1.1 review fix): slug передаётся ЯВНО и
   * валидируется как стабильный технический identifier — display title НЕ
   * является источником identity, авто-генерация slug из title запрещена.
   */
  async createCategory(title: string, slug: string) {
    validateCategorySlug(slug);
    const existing = await this.prisma.category.findUnique({ where: { slug } });
    if (existing) throw new ConflictError(`Category slug "${slug}" already exists`);
    return this.prisma.$transaction(async (tx) => {
      const code = await this.ids.nextCode(tx, "CAT");
      try {
        return await tx.category.create({ data: { code, slug, title } });
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
          throw new ConflictError(`Category slug "${slug}" already exists`);
        }
        throw err;
      }
    });
  }

  /** Изменение title категории — slug остаётся прежним (title не источник identity). */
  async updateCategoryTitle(id: string, title: string) {
    const existing = await this.prisma.category.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError(`Category ${id} not found`);
    return this.prisma.category.update({ where: { id }, data: { title } });
  }

  async listCategorySchemas(categoryId?: string) {
    return this.prisma.categorySchema.findMany({
      where: categoryId ? { categoryId } : undefined,
      include: { category: { select: { id: true, code: true, slug: true, title: true } } },
      orderBy: [{ categoryId: "asc" }, { version: "desc" }],
    });
  }

  async getCategorySchema(id: string) {
    const schema = await this.prisma.categorySchema.findUnique({
      where: { id },
      include: { category: { select: { id: true, code: true, slug: true, title: true } } },
    });
    if (!schema) throw new NotFoundError(`CategorySchema ${id} not found`);
    return schema;
  }

  async createCategorySchema(input: { categoryId: string; config: Record<string, unknown>; actorId?: string }) {
    const category = await this.prisma.category.findUnique({ where: { id: input.categoryId }, select: { id: true } });
    if (!category) throw new NotFoundError(`Category ${input.categoryId} not found`);
    const config = validateSchemaConfig(input.config);
    return this.prisma.$transaction(async (tx) => {
      const max = await tx.categorySchema.aggregate({
        where: { categoryId: input.categoryId },
        _max: { version: true },
      });
      const version = (max._max.version ?? 0) + 1;
      return tx.categorySchema.create({
        data: {
          categoryId: input.categoryId,
          version,
          status: "DRAFT",
          attributes: config.attributes as unknown as Prisma.InputJsonValue,
          availability: this.json(config.availability),
          tariffRules: this.json(config.tariffRules),
          mediaRequirements: this.json(config.mediaRequirements),
          pdpSections: this.json(config.pdpSections),
          createdById: input.actorId ?? null,
        },
      });
    });
  }

  async updateCategorySchema(id: string, input: { config: Record<string, unknown>; actorId?: string }) {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.categorySchema.findUnique({ where: { id } });
      if (!existing) throw new NotFoundError(`CategorySchema ${id} not found`);
      if (existing.status !== "DRAFT") {
        throw new ConflictError(`CategorySchema ${id} is ${existing.status}; only DRAFT schemas are editable`);
      }
      const config = validateSchemaConfig(input.config);
      return tx.categorySchema.update({
        where: { id },
        data: {
          attributes: config.attributes as unknown as Prisma.InputJsonValue,
          availability: this.json(config.availability),
          tariffRules: this.json(config.tariffRules),
          mediaRequirements: this.json(config.mediaRequirements),
          pdpSections: this.json(config.pdpSections),
          createdById: input.actorId ?? null,
        },
      });
    });
  }

  async activateCategorySchema(id: string) {
    return this.prisma.$transaction(async (tx) => {
      const schema = await tx.categorySchema.findUnique({ where: { id } });
      if (!schema) throw new NotFoundError(`CategorySchema ${id} not found`);
      if (schema.status === "ACTIVE") return schema;
      if (schema.status === "DEPRECATED") {
        throw new ConflictError(`CategorySchema ${id} is DEPRECATED; cannot activate`);
      }
      // Одна ACTIVE на категорию: прежние ACTIVE → DEPRECATED.
      await tx.categorySchema.updateMany({
        where: { categoryId: schema.categoryId, status: "ACTIVE" },
        data: { status: "DEPRECATED" },
      });
      return tx.categorySchema.update({ where: { id }, data: { status: "ACTIVE" } });
    });
  }

  async deprecateCategorySchema(id: string) {
    const schema = await this.prisma.categorySchema.findUnique({ where: { id } });
    if (!schema) throw new NotFoundError(`CategorySchema ${id} not found`);
    if (schema.status !== "ACTIVE") {
      throw new ConflictError(`CategorySchema ${id} is ${schema.status}; only ACTIVE can be deprecated`);
    }
    return this.prisma.categorySchema.update({ where: { id }, data: { status: "DEPRECATED" } });
  }

  async listAvailability(productId: string) {
    await this.requireProduct(productId);
    return this.prisma.availability.findMany({ where: { productId }, orderBy: { date: "asc" } });
  }

  async upsertAvailability(productId: string, input: { tariffId?: string; date: string; slotsTotal: number }) {
    await this.requireProduct(productId);
    const date = new Date(input.date);
    // tariffId опционален (NULL в unique-составном ключе не сравнивается в SQLite/Postgres),
    // поэтому upsert выполняется явным поиском + create/update.
    const existing = await this.prisma.availability.findFirst({
      where: { productId, tariffId: input.tariffId ?? null, date },
      select: { id: true },
    });
    if (existing) {
      return this.prisma.availability.update({
        where: { id: existing.id },
        data: { slotsTotal: input.slotsTotal },
      });
    }
    return this.prisma.availability.create({
      data: {
        productId,
        tariffId: input.tariffId ?? null,
        date,
        slotsTotal: input.slotsTotal,
        slotsBooked: 0,
        slotsReserved: 0,
      },
    });
  }

  // ── helpers ────────────────────────────────────────────────────────────────

  /** JSON-значение для nullable Json-поля: null/undefined → SQL NULL (Prisma.DbNull). */
  private json(v: unknown): Prisma.InputJsonValue {
    return (v ?? Prisma.DbNull) as Prisma.InputJsonValue;
  }

  /**
   * Step 1.1: resolve категории + Category Schema и валидировать attributes.
   * attributes БЕЗ категории (непустые) — ошибка; категория без ACTIVE schema — ошибка.
   *
   * preferredSchemaId: схема-снапшот, на которую продукт уже ссылается (§5-контракт).
   * Если передана и принадлежит той же категории (ACTIVE или DEPRECATED) — валидируем
   * по ней (исторический продукт не ломается при изменении schema). Иначе — ACTIVE.
   */
  private async resolveCategoryData(
    tx: Prisma.TransactionClient,
    categoryId: string | undefined,
    attributes: Record<string, unknown> | undefined,
    preferredSchemaId?: string,
  ): Promise<{ categoryId?: string; categorySchemaId?: string; attributes?: Prisma.InputJsonValue }> {
    if (!categoryId) {
      if (attributes !== undefined && Object.keys(attributes).length > 0) {
        throw new ValidationDomainError("Category-specific attributes require a category");
      }
      return {};
    }
    let schema: { id: string; attributes: unknown } | null = null;
    if (preferredSchemaId) {
      schema = await tx.categorySchema.findFirst({
        where: { id: preferredSchemaId, categoryId, status: { in: ["ACTIVE", "DEPRECATED"] } },
        select: { id: true, attributes: true },
      });
    }
    if (!schema) {
      schema = await tx.categorySchema.findFirst({
        where: { categoryId, status: "ACTIVE" },
        orderBy: { version: "desc" },
        select: { id: true, attributes: true },
      });
    }
    if (!schema) {
      throw new ValidationDomainError(`No ACTIVE Category Schema for category "${categoryId}"`);
    }
    const validated = validateAttributes({ attributes: schema.attributes as unknown as AttributeDef[] }, attributes);
    return {
      categoryId,
      categorySchemaId: schema.id,
      attributes: validated as Prisma.InputJsonValue,
    };
  }

  /** Детерминированный seed канонических категорий + ACTIVE schema v1 (идемпотентно). */
  private async seedCanonicalCategories(): Promise<void> {
    for (const seed of CANONICAL_CATEGORIES) {
      const existing = await this.prisma.category.findUnique({ where: { slug: seed.slug }, select: { id: true } });
      let categoryId: string;
      if (existing) {
        categoryId = existing.id;
      } else {
        categoryId = await this.prisma.$transaction(async (tx) => {
          const code = await this.ids.nextCode(tx, "CAT");
          const row = await tx.category.create({ data: { code, slug: seed.slug, title: seed.title } });
          return row.id;
        });
        this.logger.log(`Seeded canonical category '${seed.slug}'`);
      }

      const schemaCount = await this.prisma.categorySchema.count({ where: { categoryId } });
      if (schemaCount === 0) {
        const config = seed.schema ?? DEFAULT_SCHEMA_CONFIG;
        await this.prisma.categorySchema.create({
          data: {
            categoryId,
            version: 1,
            status: "ACTIVE",
            attributes: config.attributes as unknown as Prisma.InputJsonValue,
            availability: this.json(config.availability),
            tariffRules: this.json(config.tariffRules),
            mediaRequirements: this.json(config.mediaRequirements),
            pdpSections: this.json(config.pdpSections),
          },
        });
        this.logger.log(`Seeded ACTIVE Category Schema v1 for '${seed.slug}'`);
      }
    }
  }

  private async createTariffs(tx: Prisma.TransactionClient, productId: string, tariffs: CreateTariffDto[]): Promise<void> {
    for (const t of tariffs) {
      const code = await this.ids.nextCode(tx, "TRF");
      await tx.tariff.create({
        data: { code, productId, name: t.name, price: t.price, currency: t.currency ?? "USD" },
      });
    }
  }

  private async uniqueSlug(tx: Prisma.TransactionClient, base: string): Promise<string> {
    const slug = base
      .toLowerCase()
      .replace(/[^a-z0-9а-яё\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .slice(0, 80) || "product";
    const existing = await tx.product.findUnique({ where: { slug }, select: { id: true } });
    if (!existing) return slug;
    return `${slug}-${Math.random().toString(36).slice(2, 6)}`;
  }

  private async requireProduct(id: string) {
    const p = await this.prisma.product.findUnique({ where: { id }, select: { id: true } });
    if (!p) throw new NotFoundError(`Product ${id} not found`);
  }

  static readonly VALID_STATUSES = VALID_STATUSES;
}
