import { Injectable } from "@nestjs/common";
import type { Prisma, ProductStatus, ProductType } from "../../generated/prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { EventBusService } from "../../eventbus/eventbus.service";
import { DomainEvents, type ProductEventPayload } from "../../eventbus/domain-events";
import { IdsService } from "../../shared/ids.service";
import { ConflictError, NotFoundError } from "../../shared/errors";

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
}

export interface UpdateProductInput {
  title?: string;
  description?: string;
  tariffs?: CreateTariffDto[];
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
export class CatalogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ids: IdsService,
    private readonly eventBus: EventBusService,
  ) {}

  // ── Product ────────────────────────────────────────────────────────────────

  async createProduct(input: CreateProductInput, actor?: string) {
    const result = await this.prisma.$transaction(async (tx) => {
      const code = await this.ids.nextCode(tx, "PRD");
      const slug = await this.uniqueSlug(tx, input.slug ?? input.title);

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
        },
        select: { id: true, code: true, type: true, title: true, slug: true, status: true },
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

      const updated = await tx.product.update({
        where: { id },
        data: {
          title: input.title ?? existing.title,
          description: input.description !== undefined ? input.description : existing.description,
          version: { increment: 1 },
          updatedBy: actor ?? null,
        },
        select: { id: true, code: true, title: true, slug: true, status: true, version: true },
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

  // ── Category / Availability ─────────────────────────────────────────────────

  async listCategories() {
    return this.prisma.category.findMany({ orderBy: { title: "asc" } });
  }

  async createCategory(title: string) {
    return this.prisma.$transaction(async (tx) => {
      const code = await this.ids.nextCode(tx, "CAT");
      return tx.category.create({ data: { code, title } });
    });
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
