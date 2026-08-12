import { Injectable, Logger } from "@nestjs/common";
import { Prisma, type RatePlanPricingMode, type RatePlanStatus, type PriceBasis, type Refundability } from "../../generated/prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { IdsService } from "../../shared/ids.service";
import { SecurityService } from "../../security/security.service";
import { ConflictError, NotFoundError, ValidationDomainError } from "../../shared/errors";
import { CatalogAccessPolicy } from "./catalog-access.policy";
import { RoleCode } from "../../generated/prisma/enums";
import type { AuthUser } from "../../security/auth/auth.service";
import { baseRestrictionKeysToTypes } from "./restriction.validation";
import {
  validateCurrency,
  validateInclusions,
  validatePriceBasis,
  validatePricingMode,
  validateRatePlanName,
  validateRatePlanPrice,
  validateRatePlanValidity,
  validateRefundability,
  validateRestrictions,
  type PriceBasisValue,
} from "./rate-plan.validation";

const toJson = (v: Record<string, unknown>): Prisma.InputJsonValue => v as unknown as Prisma.InputJsonValue;

export interface CreateRatePlanInput {
  name: string;
  price: number;
  currency?: string | null;
  serviceUnitId?: string | null;
  priceBasis?: string | null;
  refundability?: string | null;
  pricingMode?: string;
  inclusions?: Record<string, unknown> | null;
  restrictions?: Record<string, unknown> | null;
  validFrom?: string | null;
  validTo?: string | null;
}

export interface UpdateRatePlanInput {
  name?: string;
  price?: number;
  serviceUnitId?: string | null;
  priceBasis?: string | null;
  refundability?: string | null;
  pricingMode?: string;
  inclusions?: Record<string, unknown> | null;
  restrictions?: Record<string, unknown> | null;
  validFrom?: string | null;
  validTo?: string | null;
}

/**
 * PHASE 1 STEP 1.8B — Rate Plan (Tariff → canonical Rate Plan foundation) — Catalog owner.
 *
 * DD-024 (Tariff IS canonical Rate Plan, extend), Universal Pricing §1/§5/§9/§17.
 * Канонический граф: Product → ServiceUnit → Tariff/Rate Plan → CommercialPeriod (1.8C, НЕ здесь).
 *
 * Инварианты:
 *  - ownership: Rate Plan принадлежит Product (partnerId наследуется из Product через
 *    object-scope CatalogAccessPolicy); PARTNER — только СВОИ Product;
 *  - ServiceUnit relation (аддитивная, nullable): unit.productId == tariff.productId И
 *    unit.partnerId == product.partnerId (ownership scope) И unit НЕ ARCHIVED;
 *    client не может привязать чужой ServiceUnit (server validates, не доверяет ID);
 *  - basis: одиночный семантический тег (STRICT REVIEW §22); category-allowlist через
 *    CategorySchema.tariffRules.allowedBases (если allowlist задан — basis обязателен и member);
 *  - одна canonical валюта на план (DD-029), immutable после создания (смена = новый план);
 *  - PRICE_ON_REQUEST — явное состояние (missing price ≠ PRICE_ON_REQUEST); legacy price
 *    остаётся base/FIXED fallback (STRICT REVIEW §50);
 *  - legacy validFrom/validTo — booking/commercial validity window, НЕ stay-period (§32);
 *  - lifecycle: status ACTIVE/ARCHIVED (soft); публикация наследуется из родительской
 *    цепочки (Product PUBLISHED + ServiceUnit PUBLISHED если attached) — без второго
 *    lifecycle engine (§24/§25); archive/activate — staff (catalog.rate_plan.publish);
 *  - PARTNER: коммерческие правки только под DRAFT Product (конвенция «PARTNER правит
 *    draft», как Product update_own_draft); staff/ADMIN — любые не-ARCHIVED;
 *  - НИКАКИХ CommercialPeriod/calendar/overrides/resolver/availability полей (1.8C/1.8D);
 *  - нет событий (нет consumers — §34); audit: TariffHistory + SecurityService.audit
 *    (без dump inclusions/restrictions в security audit).
 */
@Injectable()
export class RatePlanService {
  private readonly logger = new Logger(RatePlanService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ids: IdsService,
    private readonly security: SecurityService,
    private readonly policy: CatalogAccessPolicy,
  ) {}

  // ── Ownership helpers ───────────────────────────────────────────────────

  private managePermission(actor: AuthUser): string {
    return actor.role === RoleCode.PARTNER ? "catalog.product.update_own_draft" : "catalog.product.write";
  }

  private readPermission(actor: AuthUser): string {
    return actor.role === RoleCode.PARTNER ? "catalog.product.read_own" : "catalog.product.read";
  }

  /** Assert manage access к Product-владельцу Rate Plan (PARTNER — только свои). */
  private async assertProductManage(
    actor: AuthUser,
    productId: string,
    permission: string,
  ): Promise<{ id: string; code: string; partnerId: string | null; status: string; categoryId: string | null }> {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, code: true, partnerId: true, status: true, categoryId: true },
    });
    if (!product) throw new NotFoundError(`Product ${productId} not found`);
    this.policy.assertCanManage(actor, product.partnerId, permission);
    return product;
  }

  /** Own-scope lookup Rate Plan (PARTNER — только свои; иначе staff read). */
  private async findRatePlan(id: string, actor: AuthUser) {
    const tariff = await this.prisma.tariff.findUnique({
      where: { id },
      include: { product: { select: { id: true, partnerId: true } } },
    });
    if (!tariff) throw new NotFoundError(`Rate plan ${id} not found`);
    if (actor.role === RoleCode.PARTNER) {
      this.policy.assertCanManage(actor, tariff.product.partnerId, this.readPermission(actor));
    } else {
      this.policy.assertCanRead(actor, tariff.product.partnerId);
    }
    return tariff;
  }

  /**
   * Валидация ServiceUnit-привязки (Step 1.8B §6/§22):
   *  - unit существует;
   *  - unit.productId == tariff.productId (не cross-Product);
   *  - unit.partnerId == product.partnerId (один Seller/ownership scope);
   *  - unit НЕ ARCHIVED (нельзя привязать к архивному/неактивному юниту).
   * Server validates — client ID не доверяется.
   */
  private async assertServiceUnitConsistency(
    tx: Prisma.TransactionClient,
    serviceUnitId: string,
    ctx: { productId: string; partnerId: string | null },
  ): Promise<void> {
    const unit = await tx.serviceUnit.findUnique({
      where: { id: serviceUnitId },
      select: { id: true, productId: true, partnerId: true, status: true },
    });
    if (!unit) {
      throw new ValidationDomainError(`Service unit ${serviceUnitId} not found; cannot attach rate plan`);
    }
    if (unit.productId !== ctx.productId) {
      throw new ValidationDomainError(
        `Service unit ${serviceUnitId} belongs to a different product; rate plan must attach to a unit of the same product`,
      );
    }
    if (unit.partnerId !== ctx.partnerId) {
      throw new ValidationDomainError(
        `Service unit ${serviceUnitId} belongs to a different seller/ownership scope; foreign service unit attachment is forbidden`,
      );
    }
    if (unit.status === "ARCHIVED") {
      throw new ValidationDomainError(
        `Service unit ${serviceUnitId} is ARCHIVED; rate plan cannot attach to an archived service unit`,
      );
    }
  }

  /**
   * Category-driven basis allowlist (Step 1.8B §12, Universal Pricing §5/§16):
   * CategorySchema.tariffRules.allowedBases (ACTIVE схема категории Product).
   * Legacy-safe семантика: basis НЕ обязателен (legacy Product-only планы без
   * basis остаются валидными — §7/§8); НО если клиент задал basis, а allowlist
   * задан непустым — basis обязан быть member (category-incompatible → 422).
   */
  private async allowedBasesOf(tx: Prisma.TransactionClient, categoryId: string | null): Promise<string[] | null> {
    if (!categoryId) return null;
    const schema = await tx.categorySchema.findFirst({
      where: { categoryId, status: "ACTIVE" },
      orderBy: { version: "desc" },
      select: { tariffRules: true },
    });
    const rules = (schema?.tariffRules ?? null) as { allowedBases?: unknown } | null;
    if (!rules || !Array.isArray(rules.allowedBases)) return null;
    const bases = rules.allowedBases.filter((b): b is string => typeof b === "string");
    return bases.length > 0 ? bases : null;
  }

  private async assertBasisAllowed(tx: Prisma.TransactionClient, categoryId: string | null, basis: PriceBasisValue | null): Promise<void> {
    if (!basis) return; // legacy: basis не задан — допустимо (не «fabricated basis»)
    const allowed = await this.allowedBasesOf(tx, categoryId);
    if (!allowed) return; // категория не ограничивает basis
    if (!allowed.includes(basis)) {
      throw new ValidationDomainError(
        `Price basis ${basis} is not allowed for this category; allowed: ${allowed.join(", ")}`,
      );
    }
  }

  /** Категорийный гейт base restriction-метаданных (1.8D §13): объявленный
   * allowlist → только member-типы; unsupported key → 422 fail loudly. */
  private async assertRestrictionsCategoryAllowed(
    tx: Prisma.TransactionClient,
    categoryId: string | null,
    restrictions: Record<string, unknown>,
    productCode: string,
  ): Promise<void> {
    const allowed = await this.allowedRestrictionTypes(tx, categoryId);
    if (!allowed) return;
    const types = baseRestrictionKeysToTypes(Object.keys(restrictions));
    for (const t of types) {
      if (!allowed.includes(t)) {
        throw new ValidationDomainError(
          `Restriction dimension ${t} is not supported by category ${productCode}; supported: ${allowed.join(", ")}`,
        );
      }
    }
  }

  /**
   * Категорийный allowlist restriction-типов (Step 1.8D §13, DD-028):
   * CategorySchema.tariffRules.allowedRestrictions (ACTIVE схема категории).
   * Legacy-safe: необъявленный/пустой allowlist = все типы разрешены (существующие
   * данные и категории без схемы НЕ ломаются); объявленный непустой список —
   * только member-типы (unsupported dimension → 422 fail loudly).
   */
  async allowedRestrictionTypes(tx: Prisma.TransactionClient, categoryId: string | null): Promise<string[] | null> {
    if (!categoryId) return null;
    const schema = await tx.categorySchema.findFirst({
      where: { categoryId, status: "ACTIVE" },
      orderBy: { version: "desc" },
      select: { tariffRules: true },
    });
    const rules = (schema?.tariffRules ?? null) as { allowedRestrictions?: unknown } | null;
    if (!rules || !Array.isArray(rules.allowedRestrictions)) return null;
    const types = rules.allowedRestrictions.filter((t): t is string => typeof t === "string");
    return types.length > 0 ? types : null;
  }

  private toView(row: {
    id: string;
    code: string;
    productId: string;
    serviceUnitId: string | null;
    name: string;
    price: Prisma.Decimal;
    currency: string;
    validFrom: Date | null;
    validTo: Date | null;
    priceBasis: PriceBasis | null;
    refundability: Refundability | null;
    pricingMode: RatePlanPricingMode;
    status: RatePlanStatus;
    inclusions: Prisma.JsonValue | null;
    restrictions: Prisma.JsonValue | null;
    version: number;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: row.id,
      code: row.code,
      productId: row.productId,
      serviceUnitId: row.serviceUnitId,
      name: row.name,
      price: row.price.toFixed(2),
      currency: row.currency,
      validFrom: row.validFrom ? row.validFrom.toISOString() : null,
      validTo: row.validTo ? row.validTo.toISOString() : null,
      priceBasis: row.priceBasis,
      refundability: row.refundability,
      pricingMode: row.pricingMode,
      status: row.status,
      inclusions: row.inclusions ?? null,
      restrictions: row.restrictions ?? null,
      version: row.version,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  // ── Create ──────────────────────────────────────────────────────────────

  /**
   * Создание Rate Plan под Product (опционально привязан к ServiceUnit).
   * PARTNER — только под СВОЙ DRAFT Product (коммерческие правки до модерации;
   * опубликованные Product — через change-proposal путь, вне 1.8B).
   * Staff/ADMIN — под любой не-ARCHIVED Product.
   * code TRF-* — IdsService (атомарный счётчик); client не контролирует.
   */
  async create(productId: string, input: CreateRatePlanInput, actor: AuthUser) {
    const name = validateRatePlanName(input.name);
    const price = validateRatePlanPrice(input.price);
    const currency = validateCurrency(input.currency) ?? "USD";
    const priceBasis = validatePriceBasis(input.priceBasis);
    const refundability = validateRefundability(input.refundability);
    const pricingMode = validatePricingMode(input.pricingMode);
    const inclusions = validateInclusions(input.inclusions);
    const restrictions = validateRestrictions(input.restrictions);
    const { validFrom, validTo } = validateRatePlanValidity(input.validFrom, input.validTo);

    const row = await this.prisma.$transaction(async (tx) => {
      const product = await tx.product.findUnique({
        where: { id: productId },
        select: { id: true, code: true, partnerId: true, status: true, categoryId: true },
      });
      if (!product) throw new NotFoundError(`Product ${productId} not found`);
      this.policy.assertCanManage(actor, product.partnerId, this.managePermission(actor));
      if (product.status === "ARCHIVED") {
        throw new ConflictError(`Product ${product.code} is ARCHIVED; cannot add rate plans`);
      }
      // PARTNER: коммерческая структура правок — только под DRAFT Product
      // (конвенция «PARTNER правит draft»; published → change proposal).
      if (actor.role === RoleCode.PARTNER && product.status !== "DRAFT") {
        throw new ConflictError(
          `Product ${product.code} is ${product.status}; PARTNER can only add rate plans to DRAFT products (published changes require moderation)`,
        );
      }

      if (input.serviceUnitId) {
        await this.assertServiceUnitConsistency(tx, input.serviceUnitId, {
          productId: product.id,
          partnerId: product.partnerId,
        });
      }
      await this.assertBasisAllowed(tx, product.categoryId, priceBasis);
      if (restrictions) {
        await this.assertRestrictionsCategoryAllowed(tx, product.categoryId, restrictions, product.code);
      }

      const code = await this.ids.nextCode(tx, "TRF");
      const created = await tx.tariff.create({
        data: {
          code,
          productId: product.id,
          serviceUnitId: input.serviceUnitId ?? null,
          name,
          price: new Prisma.Decimal(price.toFixed(2)),
          currency,
          validFrom,
          validTo,
          priceBasis,
          refundability,
          pricingMode,
          status: "ACTIVE",
          inclusions: inclusions ? toJson(inclusions) : Prisma.DbNull,
          restrictions: restrictions ? toJson(restrictions) : Prisma.DbNull,
          version: 1,
        },
      });

      await tx.tariffHistory.create({
        data: {
          tariffId: created.id,
          version: 1,
          action: "created",
          to: "ACTIVE",
          actorId: actor.id,
          actorName: actor.username,
          comment: "Rate plan created",
        },
      });
      await this.security.audit(tx, {
        userId: actor.id,
        username: actor.username,
        action: "rate_plan.created",
        resource: "Tariff",
        resourceId: created.id,
        details: { code, productId: product.id, serviceUnitId: input.serviceUnitId ?? null, currency, pricingMode },
      });
      return created;
    });

    this.logger.log(`Rate plan ${row.code} created under product ${productId} (${row.pricingMode})`);
    return this.toView(row);
  }

  // ── Reads ───────────────────────────────────────────────────────────────

  /** List Rate Plans Product (own-scope; детерминированный порядок). */
  async listForProduct(productId: string, actor: AuthUser, limit: number, offset: number) {
    await this.assertProductManage(actor, productId, this.readPermission(actor));
    const [items, total] = await this.prisma.$transaction([
      this.prisma.tariff.findMany({
        where: { productId },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        skip: offset,
        take: limit,
      }),
      this.prisma.tariff.count({ where: { productId } }),
    ]);
    return { items: items.map((r) => this.toView(r)), total };
  }

  /** Get Rate Plan по ID (own-scope). */
  async get(id: string, actor: AuthUser) {
    return this.toView(await this.findRatePlan(id, actor));
  }

  /** History Rate Plan (own-scope; без dump inclusions/restrictions). */
  async history(id: string, actor: AuthUser) {
    await this.findRatePlan(id, actor);
    const rows = await this.prisma.tariffHistory.findMany({
      where: { tariffId: id },
      orderBy: { createdAt: "desc" },
    });
    return { items: rows };
  }

  // ── Update ──────────────────────────────────────────────────────────────

  /**
   * PATCH Rate Plan: name/price/serviceUnitId/basis/refundability/pricingMode/
   * inclusions/restrictions/validFrom/validTo. currency immutable (смена = новый
   * план, DD-029). PARTNER — только СВОИ планы под DRAFT Product; staff/ADMIN —
   * любые не-ARCHIVED. Атомарный conditional update по status (TOCTOU-защита,
   * конвенция 1.8A §34/§35): параллельный archive не может быть обойдён.
   */
  async update(id: string, input: UpdateRatePlanInput, actor: AuthUser) {
    const current = await this.findRatePlan(id, actor);
    this.policy.assertCanManage(actor, current.product.partnerId, this.managePermission(actor));
    if (current.status === "ARCHIVED") {
      throw new ConflictError(`Rate plan ${current.code} is ARCHIVED; cannot update (activate first)`);
    }

    const row = await this.prisma.$transaction(async (tx) => {
      // Fresh re-read внутри tx: authoritative status/ownership (не stale current).
      const tariff = await tx.tariff.findUniqueOrThrow({
        where: { id },
        include: { product: { select: { id: true, code: true, partnerId: true, status: true, categoryId: true } } },
      });
      if (tariff.status === "ARCHIVED") {
        throw new ConflictError(`Rate plan ${tariff.code} is ARCHIVED; cannot update`);
      }
      if (tariff.product.status === "ARCHIVED") {
        throw new ConflictError(`Product ${tariff.product.code} is ARCHIVED; rate plan cannot be updated`);
      }
      if (actor.role === RoleCode.PARTNER && tariff.product.status !== "DRAFT") {
        throw new ConflictError(
          `Product ${tariff.product.code} is ${tariff.product.status}; PARTNER can only update rate plans of DRAFT products`,
        );
      }

      const next: {
        name?: string;
        price?: Prisma.Decimal;
        serviceUnitId?: string | null;
        priceBasis?: PriceBasis | null;
        refundability?: Refundability | null;
        pricingMode?: RatePlanPricingMode;
        inclusions?: Prisma.InputJsonValue | typeof Prisma.DbNull;
        restrictions?: Prisma.InputJsonValue | typeof Prisma.DbNull;
        validFrom?: Date | null;
        validTo?: Date | null;
      } = {};

      if (input.name !== undefined) next.name = validateRatePlanName(input.name);
      if (input.price !== undefined) next.price = new Prisma.Decimal(validateRatePlanPrice(input.price).toFixed(2));
      if (input.pricingMode !== undefined) next.pricingMode = validatePricingMode(input.pricingMode);
      if (input.priceBasis !== undefined) next.priceBasis = validatePriceBasis(input.priceBasis);
      if (input.refundability !== undefined) next.refundability = validateRefundability(input.refundability);
      if (input.inclusions !== undefined) {
        const inclusions = validateInclusions(input.inclusions);
        next.inclusions = inclusions ? toJson(inclusions) : Prisma.DbNull;
      }
      if (input.restrictions !== undefined) {
        const restrictions = validateRestrictions(input.restrictions);
        if (restrictions) {
          await this.assertRestrictionsCategoryAllowed(tx, tariff.product.categoryId, restrictions, tariff.product.code);
        }
        next.restrictions = restrictions ? toJson(restrictions) : Prisma.DbNull;
      }
      if (input.validFrom !== undefined || input.validTo !== undefined) {
        const validity = validateRatePlanValidity(input.validFrom, input.validTo);
        next.validFrom = validity.validFrom;
        next.validTo = validity.validTo;
      }

      // serviceUnitId: явный null — отвязка от юнита (legacy-safe); иначе — валидация.
      if (input.serviceUnitId !== undefined) {
        if (input.serviceUnitId !== null) {
          await this.assertServiceUnitConsistency(tx, input.serviceUnitId, {
            productId: tariff.product.id,
            partnerId: tariff.product.partnerId,
          });
        }
        next.serviceUnitId = input.serviceUnitId;
      }

      // basis allowlist по АКТУАЛЬНОЙ категории Product (если basis меняется или задан).
      if (input.priceBasis !== undefined || input.serviceUnitId !== undefined) {
        const basis = input.priceBasis !== undefined ? validatePriceBasis(input.priceBasis) : tariff.priceBasis;
        await this.assertBasisAllowed(tx, tariff.product.categoryId, basis);
      }

      // Атомарный conditional update: только ACTIVE (не ARCHIVED) + version-CAS.
      //  - status-gate: stale archive не может быть обойдён concurrent PATCH
      //    (TOCTOU, конвенция 1.8A §34/§35);
      //  - version-CAS (STRICT REVIEW §39): два параллельных PATCH с разными
      //    полями не могут молча перезаписать друг друга — второй получает
      //    count=0 (версия уже изменилась) → 409 (loud, не last-write-wins).
      const res = await tx.tariff.updateMany({
        where: { id, status: { not: "ARCHIVED" }, version: tariff.version },
        data: {
          ...next,
          version: { increment: 1 },
        },
      });
      if (res.count === 0) {
        const fresh = await tx.tariff.findUniqueOrThrow({ where: { id }, select: { code: true, status: true, version: true } });
        if (fresh.status === "ARCHIVED") {
          throw new ConflictError(`Rate plan ${fresh.code} is ARCHIVED; cannot update`);
        }
        throw new ConflictError(
          `Rate plan ${fresh.code} was modified concurrently; retry (version ${fresh.version} — lost-update protected)`,
        );
      }
      const updated = await tx.tariff.findUniqueOrThrow({ where: { id } });

      await tx.tariffHistory.create({
        data: {
          tariffId: id,
          version: updated.version,
          action: "updated",
          // from/to — из СВЕЖЕЙ строки внутри tx (tariff.status), а не stale
          // `current` из чтения вне транзакции (review §history-consistency).
          from: tariff.status,
          to: tariff.status,
          fields: toJson({
            name: input.name !== undefined ? next.name : undefined,
            price: input.price !== undefined ? next.price?.toString() : undefined,
            pricingMode: input.pricingMode !== undefined ? next.pricingMode : undefined,
            priceBasis: input.priceBasis !== undefined ? next.priceBasis : undefined,
            serviceUnitId: input.serviceUnitId !== undefined ? next.serviceUnitId : undefined,
          }),
          actorId: actor.id,
          actorName: actor.username,
          comment: "Rate plan updated",
        },
      });
      await this.security.audit(tx, {
        userId: actor.id,
        username: actor.username,
        action: "rate_plan.updated",
        resource: "Tariff",
        resourceId: id,
        details: { code: current.code, productId: current.productId },
      });
      return updated;
    });

    return this.toView(row);
  }

  // ── Lifecycle (soft commercial state; publication наследуется из Product/Unit) ──

  /**
   * Archive: ACTIVE → ARCHIVED (soft, staff catalog.rate_plan.publish). Idempotent.
   * НЕ удаляет (без destructive cascade — Quote/Sale history не обрываются).
   */
  async archive(id: string, actor: AuthUser) {
    const current = await this.findRatePlan(id, actor);
    this.policy.assertCanManage(actor, current.product.partnerId, "catalog.rate_plan.publish");
    if (current.status === "ARCHIVED") return this.toView(current);

    const row = await this.prisma.$transaction(async (tx) => {
      const res = await tx.tariff.updateMany({
        where: { id, status: { not: "ARCHIVED" } },
        data: { status: "ARCHIVED", version: { increment: 1 } },
      });
      if (res.count === 0) {
        // Concurrent archive → idempotent no-op (без duplicate-истории).
        return tx.tariff.findUniqueOrThrow({ where: { id } });
      }
      const updated = await tx.tariff.findUniqueOrThrow({ where: { id } });
      await tx.tariffHistory.create({
        data: {
          tariffId: id,
          version: updated.version,
          action: "archived",
          from: current.status,
          to: "ARCHIVED",
          actorId: actor.id,
          actorName: actor.username,
          comment: "Rate plan archived (soft, commercial discontinuation)",
        },
      });
      await this.security.audit(tx, {
        userId: actor.id,
        username: actor.username,
        action: "rate_plan.archived",
        resource: "Tariff",
        resourceId: id,
        details: { code: updated.code, productId: updated.productId },
      });
      return updated;
    });

    this.logger.log(`Rate plan ${row.code} archived`);
    return this.toView(row);
  }

  /**
   * Activate (resurrection): ARCHIVED → ACTIVE (staff catalog.rate_plan.publish).
   * Idempotent: уже ACTIVE → no-op. Данные сохраняются при archive → активация
   * восстанавливает коммерческое состояние (без новой модерации — publication
   * по-прежнему наследуется из родительской цепочки).
   */
  async activate(id: string, actor: AuthUser) {
    const current = await this.findRatePlan(id, actor);
    this.policy.assertCanManage(actor, current.product.partnerId, "catalog.rate_plan.publish");
    if (current.status === "ACTIVE") return this.toView(current);

    const row = await this.prisma.$transaction(async (tx) => {
      const res = await tx.tariff.updateMany({
        where: { id, status: "ARCHIVED" },
        data: { status: "ACTIVE", version: { increment: 1 } },
      });
      if (res.count === 0) {
        // Concurrent activate → idempotent no-op (без duplicate-истории).
        return tx.tariff.findUniqueOrThrow({ where: { id } });
      }
      const updated = await tx.tariff.findUniqueOrThrow({ where: { id } });
      await tx.tariffHistory.create({
        data: {
          tariffId: id,
          version: updated.version,
          action: "activated",
          from: "ARCHIVED",
          to: "ACTIVE",
          actorId: actor.id,
          actorName: actor.username,
          comment: "Rate plan re-activated",
        },
      });
      await this.security.audit(tx, {
        userId: actor.id,
        username: actor.username,
        action: "rate_plan.activated",
        resource: "Tariff",
        resourceId: id,
        details: { code: updated.code, productId: updated.productId },
      });
      return updated;
    });

    this.logger.log(`Rate plan ${row.code} activated`);
    return this.toView(row);
  }
}
