import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { Prisma, type ProductStatus, type ProductType, type PublicationChannel } from "../../generated/prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { EventBusService } from "../../eventbus/eventbus.service";
import { DomainEvents, type ProductEventPayload } from "../../eventbus/domain-events";
import { IdsService } from "../../shared/ids.service";
import { ConflictError, ForbiddenError, NotFoundError, ValidationDomainError } from "../../shared/errors";
import { uniqueConstraintNames } from "../../shared/prisma-errors";
import { validateAttributes, validateCategorySlug, validateSchemaConfig, toCategoryEditorContract, type AttributeDef, type CategoryEditorSchemaContract } from "./category-schema.validation";
import { CANONICAL_CATEGORIES, DEFAULT_SCHEMA_CONFIG } from "./canonical-categories";
import { CatalogAccessPolicy } from "./catalog-access.policy";
import { PublicSellerProfileService } from "./seller/seller-profile.service";
import type { AuthUser } from "../../security/auth/auth.service";
import { RoleCode } from "../../generated/prisma/enums";
import type { PartnerEventPayload } from "../../eventbus/domain-events";

/**
 * Immutable moderation snapshot (Step 1.4 §4/§14): копия проверяемой версии Product.
 * Не включает storage keys/secrets — только поля + ссылки + media metadata.
 */
export interface ModerationSnapshot {
  schemaVersion: 1;
  product: {
    id: string;
    code: string;
    type: string;
    title: string;
    slug: string;
    description: string | null;
    version: number;
    /** Step 1.4 review fix 1: целевая версия после approve (live N + 1 для change proposal). */
    targetVersion: number;
    status: string;
    categoryId: string | null;
    categorySlug: string | null;
    categorySchemaId: string | null;
    attributes: Prisma.JsonValue | null;
    partnerId: string | null;
    /** true — change proposal PUBLISHED Product (content N+1 из ProductDraft). */
    changeProposal: boolean;
    /** Ревизия ProductDraft, проверяемая этой submission (null для нового Product). */
    draftVersion: number | null;
  };
  tariffs: Array<{ id: string; name: string; price: string; currency: string; validFrom: Date | null; validTo: Date | null }>;
  availability: Array<{ id: string; tariffId: string | null; date: Date; slotsTotal: number; slotsBooked: number; slotsReserved: number }>;
  media: Array<{
    id: string;
    type: string;
    mimeType: string;
    size: number;
    width: number | null;
    height: number | null;
    sortOrder: number;
    isPrimary: boolean;
    caption: string | null;
    altText: string | null;
    status: string;
    originalFileName: string;
  }>;
  primaryMediaId: string | null;
  submittedBy: string | null;
}

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
  /** Step 1.2/1.3: владелец-партнёр (object scope). Для PARTNER заполняется СЕРВЕРОМ
   *  из актора — body-значение игнорируется. Для staff/ADMIN — explicit ownership
   *  override (аудируется) при наличии catalog.product.write. */
  partnerId?: string | null;
  /** Причина ownership override (админ-действие, аудируется). */
  ownershipReason?: string;
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
  /** Step 1.8 (Partner Cabinet): фильтры/сортировка My Products. */
  categoryId?: string;
  /** draft | in_moderation | changes_requested | published | archived. */
  filter?: string;
  /** updated_desc (default) | updated_asc | created_desc | title_asc. */
  sort?: string;
}

/**
 * Канонические каналы публикации Product (Step 1.12.1 REVIEW FIX 3/4).
 * Один canonical Product может быть включён в любое подмножество каналов.
 */
export const PUBLICATION_CHANNELS = ["MARKETPLACE", "PARTNER_STOREFRONT"] as const;
export type PublicationChannelCode = (typeof PUBLICATION_CHANNELS)[number];

const EDITABLE_STATUSES: ProductStatus[] = ["DRAFT", "COMPLETE", "REVIEWED", "CHANGED"];
/**
 * Step 1.3 fix: PARTNER edit только DRAFT (permission update_own_draft соответствует
 * названию). COMPLETE/REVIEWED/CHANGED — post-submit/review состояния: direct edit
 * не должен обходить future re-moderation workflow (publish — только через
 * controlled Catalog publish transition после moderation decision).
 */
const PARTNER_EDITABLE_STATUSES: ProductStatus[] = ["DRAFT"];
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
    private readonly policy: CatalogAccessPolicy,
    private readonly sellerProfiles: PublicSellerProfileService,
  ) {}

  /**
   * Step 1.1: seed канонических категорий (Master Baseline 1.5) + ACTIVE schema v1
   * для каждой. Детерминированно и идемпотентно (upsert по slug) — как seed ролей.
   *
   * Step 1.11: PublicSellerProfile — conservative ANONYMOUS projection для продавцов.
   * REVIEW FIX 1: НЕТ runtime startup reconciliation (backfill legacy убран из
   * lifecycle). Новый Partner после onboarding approve получает профиль СОБЫТИЙНО
   * (PartnerCreated → ensure ANONYMOUS, ADR-0001: события + чтение по ID; Catalog
   * пишет ТОЛЬКО в свою schema catalog.*). Идемпотентность — unique partnerId.
   * Legacy repair — отдельная one-time команда (seller-profile-repair.cli.ts).
   */
  async onModuleInit(): Promise<void> {
    await this.seedCanonicalCategories();
    this.eventBus.on(DomainEvents.PartnerCreated, async (envelope) => {
      const payload = envelope.payload as unknown as PartnerEventPayload | null;
      if (!payload?.partnerId) return;
      // FIX 2: профиль с рождения несёт системную country identity партнёра
      // (crm.Partner.countryCode; cross-schema read разрешён ADR-0001).
      const partner = await this.prisma.partner.findUnique({
        where: { id: payload.partnerId },
        select: { countryCode: true },
      });
      await this.sellerProfiles.ensureProfileForPartner(
        this.prisma as unknown as Prisma.TransactionClient,
        payload.partnerId,
        partner?.countryCode ?? null,
      );
    });
  }

  // ── Product ────────────────────────────────────────────────────────────────

  async createProduct(input: CreateProductInput, actor?: AuthUser) {
    const result = await this.prisma.$transaction(async (tx) => {
      const code = await this.ids.nextCode(tx, "PRD");
      const slug = await this.uniqueSlug(tx, input.slug ?? input.title);
      // Step 1.1: категория + валидация attributes по ACTIVE Category Schema.
      const categoryData = await this.resolveCategoryData(tx, input.categoryId, input.attributes);

      // Step 1.2/1.3: ownership устанавливается СЕРВЕРОМ из actor context, не из тела.
      //  - PARTNER → partnerId из actor.partnerId; body partnerId ИГНОРИРУЕТСЯ;
      //  - staff/ADMIN → partnerId можно задать ЯВНО (ownership override, аудируется,
      //    требует catalog.product.write — guard); иначе product = system/admin-owned;
      //  - legacy/unowned Product НЕ привязываются к Partner «наугад».
      // Step 1.10 gate: PARTNER без partnerId (pending onboarding / сломанная
      // связь) НЕ может создавать Product — «pending cannot sell» (invariant:
      // selling capabilities ⇒ approved onboarding ⇒ valid User.partnerId).
      if (actor?.role === RoleCode.PARTNER && !actor.partnerId) {
        throw new ForbiddenError(
          "Partner onboarding is not approved: product creation is not allowed until User.partnerId is assigned",
        );
      }

      let partnerId: string | null = null;
      let ownershipOverride = false;
      const partnerScope = this.policy.partnerScopeOf(actor);
      if (partnerScope) {
        if (input.partnerId && input.partnerId !== partnerScope) {
          // PARTNER пытался подменить ownership — игнорируем (scope из актора).
          this.logger.warn(`[ownership] PARTNER ${actor?.username} tried to set partnerId=${input.partnerId}; using actor scope ${partnerScope}`);
        }
        partnerId = partnerScope;
      } else if (input.partnerId) {
        await this.assertPartnerExists(input.partnerId);
        partnerId = input.partnerId;
        ownershipOverride = true;
      }

      const product = await tx.product.create({
        data: {
          code,
          type: input.type,
          title: input.title,
          slug,
          description: input.description ?? null,
          status: "DRAFT",
          version: 1,
          createdBy: actor?.username ?? null,
          updatedBy: actor?.username ?? null,
          partnerId,
          ...categoryData,
        },
        select: { id: true, code: true, type: true, title: true, slug: true, status: true, categoryId: true, categorySchemaId: true, attributes: true, partnerId: true },
      });

      // Step 1.12.1 REVIEW FIX 3/4: default publication channel — MARKETPLACE
      // (обратная совместимость; legacy Product получили MARKETPLACE backfill'ом
      // в миграции). PARTNER_STOREFRONT включается ЯВНО через PUT /products/:id/channels
      // (own-scope, аудит). Publication channel отделён от lifecycle Product.
      await tx.productPublicationChannel.create({
        data: { productId: product.id, channel: "MARKETPLACE", createdById: actor?.id ?? null },
      });

      // Admin ownership override аудитируется (Step 1.3 §4/§17: actor + reason).
      if (ownershipOverride) {
        await tx.productHistory.create({
          data: {
            productId: product.id,
            version: 1,
            action: "ownership.override",
            fields: { partnerId, reason: input.ownershipReason ?? null } as Prisma.InputJsonValue,
            actorId: actor?.id ?? null,
            actorName: actor?.username ?? null,
            comment: "Admin ownership override (explicit partnerId)",
          },
        });
      }

      await this.createTariffs(tx, product.id, input.tariffs ?? []);

      await tx.productHistory.create({
        data: {
          productId: product.id,
          version: 1,
          action: "created",
          to: "DRAFT",
          actorId: actor?.id ?? null,
          actorName: actor?.username ?? null,
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

  /**
   * Step 1.3: server-side object scope. PARTNER получает ТОЛЬКО свои Product;
   * total/count/pagination считаются по тому же scoped where (никакого leakage).
   * Scope применяется ДО filter/sort/pagination — saved filters не расширяют scope.
   */
  /**
   * Step 1.3: server-side object scope. PARTNER получает ТОЛЬКО свои Product;
   * total/count/pagination считаются по тому же scoped where (никакого leakage).
   * Scope применяется ДО filter/sort/pagination — saved filters не расширяют scope.
   *
   * Step 1.8 (Partner Cabinet): My Products — server-side фильтры (categoryId +
   * lifecycle filter: draft/in_moderation/changes_requested/published/archived),
   * сортировка (updated/created/title), обогащение списка: thumbnail (primary
   * PUBLISHED media), moderation (последняя submission продукта), priceFrom/currency.
   * filter=changes_requested семантически = «последняя submission продукта —
   * CHANGES_REQUESTED» (parameterized DISTINCT ON SQL, без false positives).
   */
  async listProducts(query: ProductListQuery, actor?: AuthUser) {
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20));
    const where: Prisma.ProductWhereInput = {
      ...this.policy.productListScope(actor),
      ...(query.type ? { type: query.type as ProductType } : {}),
      ...(query.status ? { status: query.status as ProductStatus } : {}),
      ...(query.categoryId ? { categoryId: query.categoryId } : {}),
      ...(query.search
        ? { OR: [{ title: { contains: query.search, mode: "insensitive" } }, { code: { contains: query.search, mode: "insensitive" } }] }
        : {}),
    };

    if (query.filter) {
      const hasMatches = await this.applyLifecycleFilter(query.filter, where, actor);
      if (!hasMatches) {
        // Пустое пересечение — не «молча обрезанный» список, а корректный пустой результат.
        return { items: [], total: 0, page, pageSize };
      }
    }

    const [items, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        orderBy: this.listOrderBy(query.sort),
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          category: { select: { id: true, slug: true, title: true } },
          // Step 1.8B: priceFrom из ACTIVE Rate Plans (ARCHIVED не участвует);
          // PRICE_ON_REQUEST (inquiry-only, НЕ bindable) исключается из priceFrom
          // (Universal §9/§13) — см. reduce ниже; в списке план остаётся видим.
          tariffs: { where: { status: "ACTIVE" }, select: { id: true, code: true, name: true, price: true, currency: true, pricingMode: true } },
        },
      }),
      this.prisma.product.count({ where }),
    ]);

    // Обогащение: thumbnail (primary PUBLISHED), последняя submission, priceFrom.
    const [media, submissions] = await Promise.all([
      this.prisma.productMedia.findMany({
        where: { productId: { in: items.map((i) => i.id) }, isPrimary: true, status: "PUBLISHED" },
        select: { id: true, productId: true, mimeType: true, width: true, height: true },
      }),
      this.prisma.moderationSubmission.findMany({
        where: { productId: { in: items.map((i) => i.id) } },
        orderBy: { submittedAt: "asc" },
        select: {
          productId: true,
          status: true,
          isActiveSubmission: true,
          submittedAt: true,
          decidedAt: true,
          reasonCode: true,
          comment: true,
          draftVersion: true,
          productVersion: true,
        },
      }),
    ]);
    const thumbByProduct = new Map(media.map((m) => [m.productId, m]));
    // submittedAt asc → последняя запись в map = последняя (latest) submission продукта.
    const lastSub = new Map<string, (typeof submissions)[number]>();
    for (const s of submissions) lastSub.set(s.productId, s);

    const rows = items.map((p) => {
      const thumb = thumbByProduct.get(p.id);
      const sub = lastSub.get(p.id);
      // priceFrom: только FIXED планы (POR — inquiry-only, цена не bindable).
      const bindable = p.tariffs.filter((t) => t.pricingMode === "FIXED");
      const minTariff = bindable.length > 0 ? bindable.reduce((m, t) => (Number(t.price) < Number(m.price) ? t : m)) : null;
      return {
        ...p,
        thumbnail: thumb ? { id: thumb.id, mimeType: thumb.mimeType, width: thumb.width, height: thumb.height } : null,
        moderation: sub
          ? {
              status: sub.status,
              isActive: sub.isActiveSubmission,
              submittedAt: sub.submittedAt,
              decidedAt: sub.decidedAt,
              reasonCode: sub.reasonCode,
              comment: sub.comment,
              draftVersion: sub.draftVersion,
              productVersion: sub.productVersion,
            }
          : null,
        priceFrom: minTariff ? String(minTariff.price) : null,
        currency: minTariff?.currency ?? null,
      };
    });

    return { items: rows, total, page, pageSize };
  }

  /**
   * Step 1.8: lifecycle-фильтр My Products. Мутирует where (добавляет условия),
   * возвращает false, если пересечение заведомо пустое (корректный пустой список).
   */
  private async applyLifecycleFilter(filter: string, where: Prisma.ProductWhereInput, actor?: AuthUser): Promise<boolean> {
    switch (filter) {
      case "draft":
        where.status = "DRAFT";
        return true;
      case "in_moderation":
        // Активная submission (SUBMITTED/IN_REVIEW) — DB-флаг, уникален на продукт.
        where.moderation = { some: { isActiveSubmission: true } };
        return true;
      case "published":
        where.status = "PUBLISHED";
        return true;
      case "archived":
        where.status = "ARCHIVED";
        return true;
      case "changes_requested": {
        // Последняя submission продукта = CHANGES_REQUESTED (точная семантика).
        const ids = await this.latestSubmissionProductIds("CHANGES_REQUESTED", this.policy.partnerScopeOf(actor));
        if (ids.length === 0) return false;
        where.id = { in: ids };
        return true;
      }
      default:
        throw new ValidationDomainError(
          `Invalid filter; allowed: draft, in_moderation, changes_requested, published, archived`,
        );
    }
  }

  /**
   * Step 1.8: productId продуктов, чья ПОСЛЕДНЯЯ submission имеет данный статус.
   * Parameterized DISTINCT ON (latest submission per product) — без raw string
   * interpolation пользовательских значений (SQL injection исключён).
   */
  private async latestSubmissionProductIds(status: string, partnerScope: string | null): Promise<string[]> {
    const rows = await this.prisma.$queryRaw<Array<{ productId: string }>>`
      SELECT t."productId" FROM (
        SELECT DISTINCT ON (ms."productId") ms."productId" AS "productId", ms.status AS status
        FROM catalog."ModerationSubmission" ms
        JOIN catalog."Product" p ON p.id = ms."productId"
        WHERE (${partnerScope}::text IS NULL OR p."partnerId" = ${partnerScope})
        ORDER BY ms."productId", ms."submittedAt" DESC
      ) t
      WHERE t.status = ${status}
    `;
    return rows.map((r) => r.productId);
  }

  /** Step 1.8: orderBy для My Products (updated_desc — по умолчанию). */
  private listOrderBy(sort?: string): Prisma.ProductOrderByWithRelationInput[] {
    switch (sort) {
      case "updated_asc":
        return [{ updatedAt: "asc" }];
      case "created_desc":
        return [{ createdAt: "desc" }];
      case "title_asc":
        return [{ title: "asc" }];
      case "updated_desc":
      default:
        return [{ updatedAt: "desc" }];
    }
  }

  /** Step 1.3: direct-by-ID protected — PARTNER чужого владельца получает 403 (controlled deny). */
  async getProduct(id: string, actor?: AuthUser) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: {
        tariffs: { orderBy: { createdAt: "asc" } },
        availability: { orderBy: { date: "asc" }, take: 60 },
        history: { orderBy: { createdAt: "desc" }, take: 50 },
        category: { select: { id: true, code: true, slug: true, title: true } },
        categorySchema: { select: { id: true, version: true, status: true } },
        // Step 1.12.2: каналы публикации в partner-контракте (distribution UX).
        publicationChannels: { select: { channel: true } },
        media: { orderBy: { sortOrder: "asc" }, where: { status: "PUBLISHED" }, select: { id: true, mimeType: true, size: true, width: true, height: true, sortOrder: true, isPrimary: true, caption: true, altText: true, status: true, originalFileName: true, createdAt: true } },
        // Step 1.4 review fix 1: owner видит draft/change proposal N+1 отдельно от live N.
        draft: { select: { id: true, title: true, description: true, categoryId: true, categorySchemaId: true, attributes: true, tariffs: true, version: true, updatedAt: true } },
      },
    });
    if (!product) throw new NotFoundError(`Product ${id} not found`);
    this.policy.assertCanRead(actor, product.partnerId);
    // Step 1.4 review fix 1: draft (change proposal N+1) виден ТОЛЬКО владельцу-PARTNER.
    // MODERATOR/staff читают проверяемое содержимое через snapshot submission, а не через
    // неопубликованный draft (unreviewed N+1 не раскрывается вне owner-контекста).
    if (actor && !this.policy.isOwner(actor, product.partnerId)) {
      const { draft: _draft, ...rest } = product;
      return rest;
    }
    return product;
  }

  async updateProduct(id: string, input: UpdateProductInput, actor: AuthUser) {
    const result = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.product.findUnique({ where: { id } });
      if (!existing) throw new NotFoundError(`Product ${id} not found`);
      // Step 1.3: object scope — PARTNER редактирует только СВОИ Product
      // (permission update_own_draft); ADMIN — через explicit permission (catalog.product.write);
      // MODERATOR — 403. partnerId НЕ может быть изменён (DTO его не содержит).
      const managePermission = actor.role === RoleCode.PARTNER ? "catalog.product.update_own_draft" : "catalog.product.write";
      this.policy.assertCanManage(actor, existing.partnerId, managePermission);
      // partnerId НЕ может быть изменён (DTO его не содержит, сервис не трогает).

      // Step 1.4 review fix 1 (change proposal): PARTNER правит PUBLISHED Product через
      // draft/version N+1 (ProductDraft) — live approved N не изменяется, public N остаётся.
      if (actor.role === RoleCode.PARTNER && existing.status === "PUBLISHED") {
        return this.updatePublishedDraft(tx, existing, input, actor);
      }

      // Step 1.3 review fix: PARTNER (update_own_draft) напрямую редактирует ТОЛЬКО DRAFT —
      // post-submit/review состояния закрыты для direct edit (не обходят re-moderation).
      // Staff/ADMIN — полный lifecycle EDITABLE_STATUSES.
      const allowedStatuses = actor.role === RoleCode.PARTNER ? PARTNER_EDITABLE_STATUSES : EDITABLE_STATUSES;
      if (!allowedStatuses.includes(existing.status)) {
        throw new ConflictError(
          `Product ${existing.code} is ${existing.status}; ` +
            (actor.role === RoleCode.PARTNER
              ? "PARTNER can only edit DRAFT (re-moderation required after submit/review/publish)"
              : `only ${allowedStatuses.join("/")} are editable`),
        );
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
          updatedBy: actor.username,
          ...categoryData,
        },
        select: { id: true, code: true, title: true, slug: true, status: true, version: true, categoryId: true, categorySchemaId: true, attributes: true, partnerId: true },
      });

      if (input.tariffs) {
        // STRICT REVIEW §52: legacy tariffs-replacement не может физически стереть
        // Rate Plans с аудит-историей (TariffHistory.onDelete Restrict + явный гейт).
        await this.assertNoAuditedRatePlans(tx, id, "legacy tariffs replacement");
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
          actorId: actor.id,
          actorName: actor.username,
          comment: "Продукт обновлён",
        },
      });

      return updated;
    });

    await this.eventBus.publishPending();
    return result;
  }

  /**
   * Step 1.4 review fix 1: change proposal — PARTNER готовит изменения контента N+1
   * PUBLISHED Product в ОТДЕЛЬНОЙ строке ProductDraft. Live approved N НЕ изменяется
   * (public N остаётся). Draft-правки заморожены, пока активна submission (submitted
   * proposal нельзя silent-edit). Версия Product не растёт — растёт draft.version.
   */
  private async updatePublishedDraft(
    tx: Prisma.TransactionClient,
    existing: { id: string; code: string; status: string; title: string; description: string | null; categoryId: string | null; categorySchemaId: string | null; attributes: Prisma.JsonValue | null; partnerId: string | null; version: number },
    input: UpdateProductInput,
    actor: AuthUser,
  ) {
    // Нельзя править draft, пока активна submission (submitted/in-review proposal immutable).
    const active = await tx.moderationSubmission.count({
      where: { productId: existing.id, status: { in: ["SUBMITTED", "IN_REVIEW"] } },
    });
    if (active > 0) {
      throw new ConflictError(
        `Product ${existing.code} has an active moderation submission; submitted change proposal cannot be silently edited`,
      );
    }

    const draft = await tx.productDraft.findUnique({ where: { productId: existing.id } });

    // Категория/attributes N+1: валидируются по категории-цели. Если категория меняется —
    // по ACTIVE схеме новой категории; если остаётся — по снапшоту live-схемы (или draft).
    let categoryData: { categoryId?: string; categorySchemaId?: string; attributes?: Prisma.InputJsonValue } = {};
    if (input.categoryId !== undefined || input.attributes !== undefined) {
      const effectiveCategoryId = input.categoryId ?? draft?.categoryId ?? existing.categoryId ?? undefined;
      if (!effectiveCategoryId) {
        throw new ValidationDomainError("Category-specific attributes require a category");
      }
      const categoryChanged = input.categoryId !== undefined && input.categoryId !== (draft?.categoryId ?? existing.categoryId);
      const preferredSchemaId = categoryChanged ? undefined : (draft?.categorySchemaId ?? existing.categorySchemaId ?? undefined);
      const base =
        input.attributes !== undefined
          ? input.attributes
          : ((draft?.attributes ?? existing.attributes ?? undefined) as Record<string, unknown> | undefined);
      categoryData = await this.resolveCategoryData(tx, effectiveCategoryId, base, preferredSchemaId);
    }

    const nextTitle = input.title ?? draft?.title ?? existing.title;
    const nextDescription = input.description !== undefined ? input.description : (draft?.description ?? existing.description ?? null);

    if (draft) {
      await tx.productDraft.update({
        where: { id: draft.id },
        data: {
          title: nextTitle,
          description: nextDescription,
          version: { increment: 1 },
          updatedById: actor.id,
          ...categoryData,
          ...(input.tariffs !== undefined ? { tariffs: input.tariffs as unknown as Prisma.InputJsonValue } : {}),
        },
      });
    } else {
      await tx.productDraft.create({
        data: {
          productId: existing.id,
          title: nextTitle,
          description: nextDescription,
          version: 1,
          createdById: actor.id,
          updatedById: actor.id,
          ...categoryData,
          ...(input.tariffs !== undefined ? { tariffs: input.tariffs as unknown as Prisma.InputJsonValue } : {}),
        },
      });
    }

    await tx.productHistory.create({
      data: {
        productId: existing.id,
        version: existing.version, // live N НЕ растёт
        action: "change_proposal.edited",
        from: "PUBLISHED",
        to: "PUBLISHED",
        fields: { title: input.title, description: input.description } as Prisma.InputJsonValue,
        actorId: actor.id,
        actorName: actor.username,
        comment: "Change proposal (N+1) content updated; live approved N unchanged",
      },
    });

    return {
      product: { id: existing.id, code: existing.code, title: existing.title, status: existing.status, version: existing.version, partnerId: existing.partnerId },
      draft: { title: nextTitle, description: nextDescription, version: (draft?.version ?? 0) + 1 },
      changeProposal: true,
    };
  }

  async publishProduct(id: string, actor?: string) {
    const result = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.product.findUnique({ where: { id } });
      if (!existing) throw new NotFoundError(`Product ${id} not found`);

      // Step 1.2: повторный publish (re-publish) разрешён, когда есть DRAFT media
      // (неопубликованная замена) — промоут их в PUBLISHED. Если опубликованный
      // продукт не имеет DRAFT media — пропускаем (идемпотентность).
      const draftCount = await tx.productMedia.count({ where: { productId: id, status: "DRAFT" } });
      if (existing.status === "PUBLISHED" && draftCount === 0) {
        return { product: existing, skipped: true as const };
      }

      // Step 1.2: media requirements category schema валидируются перед публикацией.
      // DRAFT media продукта промоутятся в PUBLISHED (разрешённый publish transition),
      // затем проверяются policy-требования.
      if (draftCount > 0) {
        await tx.productMedia.updateMany({ where: { productId: id, status: "DRAFT" }, data: { status: "PUBLISHED" } });
      }
      const policy = await this.mediaRequirementsOf(tx, existing);
      if (policy) {
        const published = await tx.productMedia.findMany({ where: { productId: id, status: "PUBLISHED" } });
        if (policy.primaryImageRequired) {
          const primary = published.find((m) => m.isPrimary);
          if (!primary) {
            throw new ValidationDomainError(
              "Cannot publish: category policy requires a primary image (mediaRequirements.primaryImageRequired)",
            );
          }
        }
        if (policy.minImages !== undefined && policy.minImages > 0 && published.length < policy.minImages) {
          throw new ValidationDomainError(
            `Cannot publish: category policy requires at least ${policy.minImages} published image(s), got ${published.length}`,
          );
        }
      }

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

  // ── Moderation transitions (Step 1.4) ─────────────────────────────────────
  // Catalog остаётся владельцем Product: Moderation принимает решение, а эти
  // команды выполняют РАЗРЕШЁННЫЕ transition'ы (submit-lock / release / publish).

  /**
   * Step 1.4 §6/§9: submit-lock — валидация eligibility + перевод в COMPLETE.
   * Вызывается ModerationService внутри его транзакции (tx). Только из DRAFT
   * (новая submission) или PUBLISHED (change proposal published-версии N+1).
   * PUBLIC-версия при PUBLISHED-изменении НЕ меняется (остаётся PUBLISHED).
   */
  async lockProductForModeration(
    tx: Prisma.TransactionClient,
    productId: string,
    actor: AuthUser,
    submissionId: string,
  ): Promise<{ product: { id: string; status: ProductStatus; version: number }; skipped: boolean }> {
    const product = await tx.product.findUnique({ where: { id: productId }, include: { draft: true } });
    if (!product) throw new NotFoundError(`Product ${productId} not found`);
    // Валидация содержимого перед submit (§6): category attributes + tariffs +
    // availability + media requirements. Для change proposal валидируется ЭФФЕКТИВНОЕ
    // содержимое N+1 (draft поверх live), а не live N.
    await this.validateSubmissionEligibility(tx, { ...product, ...this.effectiveDraftContent(product) });
    if (product.status === "COMPLETE") {
      throw new ConflictError(`Product ${product.code} is already submitted for moderation`);
    }
    const from = product.status;
    if (from === "PUBLISHED") {
      // Change proposal published-версии: публичная версия N остаётся, submission
      // фиксирует проверяемую версию N+1 (snapshot = draft поверх live). Публикация
      // N+1 — только на approve.
      await tx.productHistory.create({
        data: {
          productId,
          version: product.version,
          action: "moderation.submitted",
          from,
          to: from,
          fields: { submissionId, changeProposalVersion: (product.draft?.version ?? 0) + 1 } as Prisma.InputJsonValue,
          actorId: actor.id,
          actorName: actor.username,
          comment: "Product change proposal (N+1) submitted for moderation (published N unchanged)",
        },
      });
      return { product: { id: product.id, status: product.status, version: product.version }, skipped: true };
    }
    // DRAFT (или иной pre-public) → COMPLETE (submitted, ожидает review).
    const updated = await tx.product.update({
      where: { id: productId },
      data: { status: "COMPLETE", version: { increment: 1 }, updatedBy: actor.username },
      select: { id: true, status: true, version: true },
    });
    await tx.productHistory.create({
      data: {
        productId,
        version: updated.version,
        action: "moderation.submitted",
        from,
        to: "COMPLETE",
        fields: { submissionId } as Prisma.InputJsonValue,
        actorId: actor.id,
        actorName: actor.username,
        comment: "Product submitted for moderation",
      },
    });
    return { product: updated, skipped: false };
  }

  /**
   * Step 1.4 §10/§11: release — после reject/request_changes продукт возвращается
   * в DRAFT (снова редактируем PARTNER-ом). PUBLISHED-версия (change proposal)
   * НЕ откатывается: публичная N остаётся до нового approve.
   */
  async releaseProductForModeration(
    tx: Prisma.TransactionClient,
    productId: string,
    actor: AuthUser,
    submissionId: string,
    action: "moderation.rejected" | "moderation.changes_requested",
    comment?: string,
  ): Promise<void> {
    const product = await tx.product.findUnique({ where: { id: productId }, select: { id: true, status: true, version: true } });
    if (!product) throw new NotFoundError(`Product ${productId} not found`);
    if (product.status === "COMPLETE") {
      const updated = await tx.product.update({
        where: { id: productId },
        data: { status: "DRAFT", version: { increment: 1 }, updatedBy: actor.username },
        select: { version: true },
      });
      await tx.productHistory.create({
        data: {
          productId,
          version: updated.version,
          action,
          from: "COMPLETE",
          to: "DRAFT",
          fields: { submissionId, comment: comment ?? null } as Prisma.InputJsonValue,
          actorId: actor.id,
          actorName: actor.username,
          comment: comment ?? "Moderation released product back to DRAFT",
        },
      });
    } else {
      // PUBLISHED change proposal: записываем решение, публичная версия не меняется.
      await tx.productHistory.create({
        data: {
          productId,
          version: product.version,
          action,
          from: product.status,
          to: product.status,
          fields: { submissionId, comment: comment ?? null } as Prisma.InputJsonValue,
          actorId: actor.id,
          actorName: actor.username,
          comment: comment ?? "Moderation decision recorded (published version unchanged)",
        },
      });
    }
  }

  /**
   * Step 1.4 §9: controlled Catalog publish transition ПОСЛЕ approve.
   * Промоутит DRAFT media (проверенные в snapshot) в PUBLISHED, валидирует policy,
   * ставит PUBLISHED + version N+1 + publishedAt. Вызывается только из approve.
   */
  async publishAfterModerationApproval(
    tx: Prisma.TransactionClient,
    productId: string,
    actor: AuthUser,
    submissionId: string,
  ): Promise<{ product: { id: string; code: string; title: string; slug: string; status: string; version: number } }> {
    const existing = await tx.product.findUnique({ where: { id: productId }, include: { draft: true } });
    if (!existing) throw new NotFoundError(`Product ${productId} not found`);

    // Promoут DRAFT media (все проверяемые в snapshot) → PUBLISHED ДО policy-валидации
    // (policy смотрит на PUBLISHED-набор, как в исходном controlled publish).
    const draftCount = await tx.productMedia.count({ where: { productId, status: "DRAFT" } });
    if (draftCount > 0) {
      await tx.productMedia.updateMany({ where: { productId, status: "DRAFT" }, data: { status: "PUBLISHED" } });
    }

    // Change proposal (draft N+1) → применяем draft к live Product: content fields +
    // tariffs. Live N до approve не менялся — после approve N+1 становится published.
    const draft = existing.draft;
    if (draft) {
      if (draft.tariffs) {
        // STRICT REVIEW §52: publish change-proposal не может физически стереть
        // Rate Plans с аудит-историей (TariffHistory.onDelete Restrict + гейт).
        await this.assertNoAuditedRatePlans(tx, productId, "change-proposal publish tariffs replacement");
        await tx.tariff.deleteMany({ where: { productId } });
        await this.createTariffs(tx, productId, draft.tariffs as unknown as CreateTariffDto[]);
      }
      // Draft удаляется ПОСЛЕ успешного publish (ниже); при ошибке политики tx откатится.
    }

    // Policy валидируется по ЭФФЕКТИВНОЙ категории (draft N+1 поверх live N).
    const policy = await this.mediaRequirementsOf(tx, {
      categoryId: draft?.categoryId !== undefined ? draft.categoryId : existing.categoryId,
      categorySchemaId: draft?.categorySchemaId !== undefined ? draft.categorySchemaId : existing.categorySchemaId,
    });
    if (policy) {
      const published = await tx.productMedia.findMany({ where: { productId, status: "PUBLISHED" } });
      if (policy.primaryImageRequired) {
        const primary = published.find((m) => m.isPrimary);
        if (!primary) {
          throw new ValidationDomainError(
            "Cannot publish: category policy requires a primary image (mediaRequirements.primaryImageRequired)",
          );
        }
      }
      if (policy.minImages !== undefined && policy.minImages > 0 && published.length < policy.minImages) {
        throw new ValidationDomainError(
          `Cannot publish: category policy requires at least ${policy.minImages} published image(s), got ${published.length}`,
        );
      }
    }

    const apply = draft
      ? {
          title: draft.title,
          description: draft.description,
          categoryId: draft.categoryId ?? null,
          categorySchemaId: draft.categorySchemaId ?? null,
          attributes: (draft.attributes ?? Prisma.DbNull) as Prisma.InputJsonValue,
        }
      : {};

    const product = await tx.product.update({
      where: { id: productId },
      data: { status: "PUBLISHED", version: { increment: 1 }, publishedAt: new Date(), updatedBy: actor.username, ...apply },
      select: { id: true, code: true, title: true, slug: true, status: true, version: true },
    });

    // Draft удаляется только после успешного publish (атомарно с ним).
    if (draft) {
      await tx.productDraft.delete({ where: { id: draft.id } });
    }

    await tx.productHistory.create({
      data: {
        productId,
        version: product.version,
        action: "publish",
        from: existing.status,
        to: "PUBLISHED",
        fields: { submissionId, source: "moderation", changeProposal: existing.draft !== null } as Prisma.InputJsonValue,
        actorId: actor.id,
        actorName: actor.username,
        comment: existing.draft
          ? `Change proposal N+1 applied and published after approval (moderation)`
          : "Продукт опубликован после approval (moderation)",
      },
    });

    // Step 1.15: correlation НЕ является business entity ID (submissionId) —
    // наследуется из request context (moderation approve HTTP-запроса).
    await this.eventBus.emit(tx, {
      aggregateType: "Product",
      aggregateId: productId,
      eventType: DomainEvents.ProductPublished,
      payload: { productId, code: product.code, title: product.title, type: existing.type } as ProductEventPayload,
    });

    return { product };
  }

  /**
   * Step 1.4 review fix 1: эффективное содержимое N+1 для eligibility-валидации и
   * snapshot: draft (если есть) поверх live Product. draft null ⇒ live как есть.
   */
  private effectiveDraftContent(product: {
    draft?: {
      title?: string;
      description?: string | null;
      categoryId?: string | null;
      categorySchemaId?: string | null;
      attributes?: Prisma.JsonValue | null;
      tariffs?: Prisma.JsonValue | null;
    } | null;
    title?: string;
    description?: string | null;
    categoryId?: string | null;
    categorySchemaId?: string | null;
    attributes?: Prisma.JsonValue | null;
  }): {
    title?: string;
    description?: string | null;
    categoryId?: string | null;
    categorySchemaId?: string | null;
    attributes?: Prisma.JsonValue | null;
    tariffs?: Prisma.JsonValue | null;
  } {
    if (!product.draft) return {};
    return {
      title: product.draft.title ?? product.title,
      description: product.draft.description !== undefined ? product.draft.description : product.description,
      categoryId: product.draft.categoryId !== undefined ? product.draft.categoryId : product.categoryId,
      categorySchemaId: product.draft.categorySchemaId !== undefined ? product.draft.categorySchemaId : product.categorySchemaId,
      attributes: product.draft.attributes !== undefined ? product.draft.attributes : product.attributes,
      tariffs: product.draft.tariffs ?? null,
    };
  }

  /**
   * Step 1.4: публикация pending-событий (outbox), созданных в транзакции
   * ModerationService (submit-lock / publish-after-approval). Catalog владеет
   * событийной шиной Product — Moderation вызывает её через эту команду.
   */
  async publishPendingEvents(): Promise<void> {
    await this.eventBus.publishPending();
  }

  /**
   * Step 1.4 §6: валидация eligibility перед submit (вызывается внутри tx submit-lock).
   * Проверяет: category attributes, tariff/availability requirements (если схема требует),
   * media requirements (minImages/primaryImageRequired/allowed).
   */
  private async validateSubmissionEligibility(
    tx: Prisma.TransactionClient,
    product: { id: string; categoryId: string | null; categorySchemaId: string | null; attributes: Prisma.JsonValue | null; status: ProductStatus },
  ): Promise<void> {
    // Category attributes: валидируются по схеме-снапшоту (как при updateProduct §5-контракт).
    const attributes = (product.attributes ?? undefined) as Record<string, unknown> | undefined;
    if (product.categoryId) {
      await this.resolveCategoryData(tx, product.categoryId, attributes, product.categorySchemaId ?? undefined);
    } else if (attributes && Object.keys(attributes).length > 0) {
      throw new ValidationDomainError("Category-specific attributes require a category");
    }

    const schema = product.categorySchemaId
      ? await tx.categorySchema.findUnique({ where: { id: product.categorySchemaId } })
      : product.categoryId
        ? await tx.categorySchema.findFirst({ where: { categoryId: product.categoryId, status: "ACTIVE" }, orderBy: { version: "desc" } })
        : null;

    const tariffRules = (schema?.tariffRules ?? null) as { required?: boolean; minTariffs?: number } | null;
    if (tariffRules?.required) {
      // Для change proposal учитываем tariffs из draft (N+1), а не только live N.
      const draftTariffs = (product as { tariffs?: unknown }).tariffs;
      const tariffCount = draftTariffs
        ? (draftTariffs as unknown[]).length
        : await tx.tariff.count({ where: { productId: product.id } });
      const min = tariffRules.minTariffs ?? 1;
      if (tariffCount < min) {
        throw new ValidationDomainError(`Submission requires at least ${min} tariff(s), got ${tariffCount}`);
      }
    }

    const availabilityRules = (schema?.availability ?? null) as { required?: boolean } | null;
    if (availabilityRules?.required) {
      const count = await tx.availability.count({ where: { productId: product.id } });
      if (count === 0) {
        throw new ValidationDomainError("Submission requires availability data (schema availability.required)");
      }
    }

    const policy = await this.mediaRequirementsOf(tx, product);
    if (policy) {
      const media = await tx.productMedia.findMany({ where: { productId: product.id, status: { not: "ARCHIVED" } } });
      if (policy.primaryImageRequired && !media.some((m) => m.isPrimary)) {
        throw new ValidationDomainError("Submission requires a primary image (mediaRequirements.primaryImageRequired)");
      }
      if (policy.minImages !== undefined && policy.minImages > 0 && media.length < policy.minImages) {
        throw new ValidationDomainError(
          `Submission requires at least ${policy.minImages} image(s), got ${media.length}`,
        );
      }
      if (policy.allowedMediaTypes && media.some((m) => !policy.allowedMediaTypes!.includes(m.mimeType))) {
        throw new ValidationDomainError("Submission contains media of a type not allowed by the category policy");
      }
    }
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
        return await tx.category.create({
          data: { code, slug, title, createdAt: new Date() },
        });
      } catch (err) {
        // REVIEW FIX 10: единый P2002-normalization (любой Prisma shape → controlled 409).
        if (uniqueConstraintNames(err).some((n) => n.toLowerCase().includes("slug"))) {
          throw new ConflictError(`Category slug "${slug}" already exists`);
        }
        throw err;
      }
    });
  }

  // ── Product publication channels (Step 1.12.1 REVIEW FIX 3/4) ────────────

  /**
   * Явное управление каналами публикации canonical Product (own-scope).
   * PARTNER меняет каналы ТОЛЬКО своих Product (object scope + permission
   * catalog.product.channels_own); ADMIN — через catalog.product.write.
   * Каналы отделены от lifecycle: не зависят от status Product (влияют на
   * публичную видимость только при PUBLISHED). Изменение аудируется.
   */
  async setProductChannels(id: string, channels: string[], actor: AuthUser) {
    const product = await this.prisma.product.findUnique({ where: { id } });
    if (!product) throw new NotFoundError(`Product ${id} not found`);
    const managePermission = actor.role === RoleCode.PARTNER ? "catalog.product.channels_own" : "catalog.product.write";
    this.policy.assertCanManage(actor, product.partnerId, managePermission);

    const unique = [...new Set(channels.map((c) => c.trim()).filter(Boolean))];
    for (const c of unique) {
      if (!(PUBLICATION_CHANNELS as readonly string[]).includes(c)) {
        throw new ValidationDomainError(`Invalid channel "${c}"; allowed: ${PUBLICATION_CHANNELS.join(", ")}`);
      }
    }
    if (unique.length === 0) {
      throw new ValidationDomainError("At least one publication channel is required (or use an explicit empty set is not allowed — product would have no public channel)");
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.productPublicationChannel.deleteMany({ where: { productId: id } });
      if (unique.length > 0) {
        await tx.productPublicationChannel.createMany({
          data: unique.map((channel) => ({ productId: id, channel: channel as PublicationChannel, createdById: actor.id })),
        });
      }
      await tx.productHistory.create({
        data: {
          productId: id,
          version: product.version,
          action: "channels.updated",
          from: "",
          to: unique.join(","),
          fields: { channels: unique } as Prisma.InputJsonValue,
          actorId: actor.id,
          actorName: actor.username,
          comment: "Product publication channels updated (own-scope)",
        },
      });
      return { id, channels: unique };
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
      // Одна ACTIVE на категорию: прежние ACTIVE → DEPRECATED (с реальным
      // deprecatedAt — Step 1.13A: lifecycle timestamp, НЕ updatedAt).
      await tx.categorySchema.updateMany({
        where: { categoryId: schema.categoryId, status: "ACTIVE" },
        data: { status: "DEPRECATED", deprecatedAt: new Date() },
      });
      return tx.categorySchema.update({ where: { id }, data: { status: "ACTIVE", activatedAt: new Date() } });
    });
  }

  async deprecateCategorySchema(id: string) {
    const schema = await this.prisma.categorySchema.findUnique({ where: { id } });
    if (!schema) throw new NotFoundError(`CategorySchema ${id} not found`);
    if (schema.status !== "ACTIVE") {
      throw new ConflictError(`CategorySchema ${id} is ${schema.status}; only ACTIVE can be deprecated`);
    }
    return this.prisma.categorySchema.update({ where: { id }, data: { status: "DEPRECATED", deprecatedAt: new Date() } });
  }

  /**
   * Step 1.8 (clarification): Partner-safe read — ACTIVE Category Schema для dynamic
   * Product form/editor. Отдельный контракт (НЕ внутренний category_schema.read):
   * только данные редактора; DRAFT/DEPRECATED схемы и admin/audit-поля не
   * возвращаются. Read НЕ требует Product ownership (PARTNER получает schema
   * категории ещё до создания Product).
   *
   * Neutral 404: категория не существует / категория не разрешена для Product
   * creation (status != ACTIVE) / нет ACTIVE схемы — без раскрытия внутренних деталей.
   */
  async getActiveCategorySchemaForProductEdit(categorySlug: string): Promise<CategoryEditorSchemaContract> {
    const category = await this.prisma.category.findUnique({
      where: { slug: categorySlug },
      select: { id: true, code: true, slug: true, title: true, status: true },
    });
    if (!category || category.status !== "ACTIVE") {
      throw new NotFoundError(`Category "${categorySlug}" is not available for product creation`);
    }
    const schema = await this.prisma.categorySchema.findFirst({
      where: { categoryId: category.id, status: "ACTIVE" },
      orderBy: { version: "desc" },
    });
    if (!schema) {
      throw new NotFoundError(`No ACTIVE Category Schema for category "${categorySlug}"`);
    }
    return toCategoryEditorContract({
      category: { id: category.id, code: category.code, slug: category.slug, title: category.title },
      schema: {
        id: schema.id,
        version: schema.version,
        attributes: schema.attributes,
        availability: schema.availability,
        tariffRules: schema.tariffRules,
        mediaRequirements: schema.mediaRequirements,
        pdpSections: schema.pdpSections,
      },
    });
  }

  /** Step 1.3: read availability server-side scoped (PARTNER — только свои Product). */
  async listAvailability(productId: string, actor?: AuthUser) {
    const product = await this.prisma.product.findUnique({ where: { id: productId }, select: { id: true, partnerId: true } });
    if (!product) throw new NotFoundError(`Product ${productId} not found`);
    this.policy.assertCanRead(actor, product.partnerId);
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

  /**
   * Step 2.4 — owner command: atomic availability reserve (DD-022 closure).
   *
   * Единственный canonical способ зарезервировать inventory capacity (ADR-0001:
   * Sales вызывает ЭТОТ owner-сервис, а не пишет в catalog.Availability).
   * Атомарный last-slot: conditional UPDATE slotsReserved += quantity WHERE
   * slotsTotal - slotsBooked - slotsReserved >= quantity — два concurrent
   * резервирования одного последнего слота → ровно один успех.
   *
   * Вызывается ВНУТРИ транзакции домена (tx передаётся извне — общая
   * PostgreSQL-транзакция с Sale completion; rollback откатывает и hold).
   * После committed Sale + FAILED outbox hold НЕ освобождается автоматически
   * (OrderRequested может быть retried) — release принадлежит owner-step.
   *
   * Без строки Availability (productId/tariffId/date не настроены) → 422
   * (NOT_CONFIGURED — честно, не «безлимит по умолчанию»).
   */
  async reserveAvailability(
    tx: Prisma.TransactionClient,
    input: { productId: string; tariffId?: string | null; date: Date; quantity: number; sourceSaleId: string; createdById?: string | null },
  ): Promise<{ reservationId: string; code: string }> {
    if (!Number.isInteger(input.quantity) || input.quantity < 1) {
      throw new ValidationDomainError("reservation quantity must be a positive integer");
    }
    const date = new Date(input.date);
    date.setUTCHours(0, 0, 0, 0);

    // Атомарный last-slot guard — ОДИН conditional UPDATE (raw): инкремент только
    // если доступно >= quantity. Один statement ⇒ два concurrent резервирования
    // последнего слота: ровно один получает count=1, второй count=0 (нет TOCTOU).
    const updated = await tx.$executeRaw`
      UPDATE "catalog"."Availability"
      SET "slotsReserved" = "slotsReserved" + ${input.quantity}
      WHERE "productId" = ${input.productId}
        AND "tariffId" IS NOT DISTINCT FROM ${input.tariffId ?? null}
        AND "date" = ${date}
        AND "slotsTotal" - "slotsBooked" - "slotsReserved" >= ${input.quantity}
    `;

    if (updated !== 1) {
      // count=0: строка отсутствует ИЛИ capacity недостаточна. Различаем честно.
      const row = await tx.availability.findFirst({
        where: { productId: input.productId, tariffId: input.tariffId ?? null, date },
        select: { id: true, slotsTotal: true, slotsBooked: true, slotsReserved: true },
      });
      if (!row) {
        throw new ValidationDomainError(`Availability for product ${input.productId} on ${date.toISOString()} is not configured`);
      }
      const available = row.slotsTotal - row.slotsBooked - row.slotsReserved;
      if (available < input.quantity) {
        throw new ConflictError(`Not enough availability for product ${input.productId} on ${date.toISOString()}`);
      }
      // Недостижимо (условие guard совпало бы), defensive.
      throw new ConflictError(`Availability reservation for product ${input.productId} failed`);
    }

    const code = await this.ids.nextCode(tx, "RSR");
    const reservation = await tx.availabilityReservation.create({
      data: {
        code,
        productId: input.productId,
        tariffId: input.tariffId ?? null,
        date,
        quantity: input.quantity,
        sourceSaleId: input.sourceSaleId,
        createdById: input.createdById ?? null,
        status: "HELD",
      },
      select: { id: true, code: true },
    });
    return { reservationId: reservation.id, code: reservation.code };
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
          const row = await tx.category.create({ data: { code, slug: seed.slug, title: seed.title, createdAt: new Date() } });
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
            activatedAt: new Date(),
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

  /**
   * STRICT REVIEW §52: legacy delete-пути (Product PATCH tariffs / change-proposal
   * publish) НЕ могут физически удалить Rate Plans, у которых есть аудит-история
   * (TariffHistory) — история коммерческих фактов не стирается. Канонический путь
   * управления такими планами — Rate Plan API (archive/activate/update), а не
   * legacy tariffs-replacement. Гейт дублирует DB-level Restrict и даёт 409 (loud).
   */
  private async assertNoAuditedRatePlans(
    tx: Prisma.TransactionClient,
    productId: string,
    operation: string,
  ): Promise<void> {
    const audited = await tx.tariffHistory.count({
      where: { tariff: { productId } },
    });
    if (audited > 0) {
      throw new ConflictError(
        `Cannot ${operation}: ${audited} rate plan(s) have audit history and cannot be physically deleted; use the Rate Plan API (archive/activate/update) instead`,
      );
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

  /** Проверка существования Partner (crm.*, READ) — орфанные ссылки не создаются. */
  private async assertPartnerExists(partnerId: string): Promise<void> {
    const p = await this.prisma.partner.findUnique({ where: { id: partnerId }, select: { id: true } });
    if (!p) throw new ValidationDomainError(`Partner ${partnerId} does not exist`);
  }

  private async requireProduct(id: string) {
    const p = await this.prisma.product.findUnique({ where: { id }, select: { id: true } });
    if (!p) throw new NotFoundError(`Product ${id} not found`);
  }

  /** Step 1.2: mediaRequirements category schema продукта (снапшот schema либо ACTIVE). */
  private async mediaRequirementsOf(
    tx: Prisma.TransactionClient,
    product: { categoryId: string | null; categorySchemaId: string | null },
  ): Promise<{ minImages?: number; primaryImageRequired?: boolean; allowedMediaTypes?: string[] } | null> {
    const schema = product.categorySchemaId
      ? await tx.categorySchema.findUnique({ where: { id: product.categorySchemaId }, select: { mediaRequirements: true } })
      : null;
    const mediaRequirements = (schema?.mediaRequirements ??
      (product.categoryId
        ? (
            await tx.categorySchema.findFirst({
              where: { categoryId: product.categoryId, status: "ACTIVE" },
              orderBy: { version: "desc" },
              select: { mediaRequirements: true },
            })
          )?.mediaRequirements
        : null)) as { minImages?: number; primaryImageRequired?: boolean } | null;
    return mediaRequirements ?? null;
  }

  static readonly VALID_STATUSES = VALID_STATUSES;
}
