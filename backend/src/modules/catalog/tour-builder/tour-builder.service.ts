import { Injectable, Logger } from "@nestjs/common";
import { Prisma, RoleCode } from "../../../generated/prisma/client";
import { PrismaService } from "../../../prisma/prisma.service";
import { IdsService } from "../../../shared/ids.service";
import { SecurityService } from "../../../security/security.service";
import { ConflictError, NotFoundError, ValidationDomainError } from "../../../shared/errors";
import { CatalogAccessPolicy } from "../catalog-access.policy";
import { findSimilarCandidates, normalizeTypeName } from "./dictionary-similarity";
import { resolveApplicablePeriod, samePriorityOverlap } from "../period-resolution";
import type { AuthUser } from "../../../security/auth/auth.service";

/**
 * PHASE: Partner Tour Builder — конструктор пакетных туров.
 *
 * Архитектура (по промпту Partner Tour Builder, сверено с репо):
 *  - Пакетный тур = Product(type=TOUR, attributes.packageKind="PACKAGE").
 *  - Компоненты пакета — ServiceUnit-ы внутри этого же Product
 *    (attributes.kind = accommodation|flight|transfer|insurance|extra),
 *    коммерческие данные — на существующих примитивах:
 *      Tariff (Rate Plan) + CommercialPeriod (цены по датам) + Availability (квоты).
 *  - Состав пакета: ProductComponent хранится в Product.attributes.tourBuilder.components
 *    (refs на UNI-*, без копирования цен).
 *  - Цены по датам проживания: CommercialPeriod на Tariff юнита (bulk-совместимо
 *    с существующим CommercialPeriodService); квоты: Availability по датам.
 *  - Перелёт: лестница тарифа (tiers) + вылеты (departures с priceOverride) —
 *    в attributes соответствующего ServiceUnit (structure-only данные блока мест).
 *  - Трансфер: маршруты = ServiceUnit (unit=per_pax/per_vehicle) + надбавки
 *    (surcharges) в attributes юнита.
 *  - Страховка: продукт = ServiceUnit, ставки по диапазонам длительности
 *    (durationBrackets) + childCoefficient в attributes.
 *  - Расчёт (quote) — единая функция здесь (backend-authoritative); фронтенд
 *    только отображает.
 *
 * Own-scope: все операции — только по Product с partnerId == actor.partnerId
 * (CatalogAccessPolicy.assertCanManage), права — существующие
 * catalog.product.create_own / update_own_draft / read_own.
 */

const COMPONENT_KINDS = ["accommodation", "flight", "transfer", "insurance", "extra"] as const;
type ComponentKind = (typeof COMPONENT_KINDS)[number];

export interface TourComponentRef {
  componentId: string; // ServiceUnit.id (UNI-*)
  kind: ComponentKind;
  required: boolean;
}

/** Валюта пакета конструктора: партнёр выбирает USD/EUR/AZN на шаге «Основная информация». */
export type BuilderCurrency = "USD" | "EUR" | "AZN";

export const BUILDER_CURRENCIES: BuilderCurrency[] = ["USD", "EUR", "AZN"];

/** Курсы партнёра: сколько AZN за 1 единицу валюты (USD и EUR к AZN). */
export interface BuilderFx {
  usdAzn: number;
  eurAzn: number;
}

/** Дефолтные курсы (AZN ~фикс к USD), партнёр правит их в конструкторе. */
export const DEFAULT_BUILDER_FX: BuilderFx = { usdAzn: 1.7, eurAzn: 1.85 };

export interface TourBuilderAttributes {
  packageKind: "PACKAGE";
  components: TourComponentRef[];
  packageDiscountPct?: number | null;
  freeTransferFromNights?: number | null;
  grossOverride?: { amount: number; currency: string } | null;
  builderStep?: number;
  /** Валюта всех цен пакета; по умолчанию USD. */
  currency?: BuilderCurrency;
  /** Курсы партнёра для конвертации при смене валюты. */
  fx?: BuilderFx;
  /** Фикс-цена Ext.Bed/Ext.Sofa на номер; null/0 = бесплатно. */
  extraBedPrice?: number | null;
  extraSofaPrice?: number | null;
  /** Детская кровать (Baby Cot) — бесплатно, возможность предоставить; не ось матрицы. */
  babyCot?: boolean;
}

/* ── Валидация входов ─────────────────────────────────────────────────────── */

function assertKind(kind: unknown): asserts kind is ComponentKind {
  if (typeof kind !== "string" || !COMPONENT_KINDS.includes(kind as ComponentKind)) {
    throw new ValidationDomainError(`Unknown component kind: ${String(kind)}`);
  }
}

function parseDateOnly(v: unknown, field: string): Date {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) {
    throw new ValidationDomainError(`${field} must be a calendar date (YYYY-MM-DD)`);
  }
  return new Date(`${v}T00:00:00.000Z`);
}

function asNumber(v: unknown, field: string, opts: { min?: number; integer?: boolean } = {}): number {
  const n = typeof v === "string" ? Number(v) : v;
  if (typeof n !== "number" || !Number.isFinite(n)) throw new ValidationDomainError(`${field} must be a number`);
  if (opts.integer && !Number.isInteger(n)) throw new ValidationDomainError(`${field} must be an integer`);
  if (opts.min !== undefined && n < opts.min) throw new ValidationDomainError(`${field} must be >= ${opts.min}`);
  return n;
}

function numOrDec(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "number") return v;
  if (typeof v === "string") { const n = Number(v); return Number.isFinite(n) ? n : null; }
  if (typeof v === "object" && v !== null && "toNumber" in (v as Record<string, unknown>)) {
    return (v as { toNumber(): number }).toNumber();
  }
  return null;
}

/** attributes.tourBuilder компонента (структурные данные формы конкретного ресурса). */
export interface ComponentPayload {
  // accommodation
  mealSupplements?: Record<string, number>;      // план питания → надбавка/сутки взрослого
  childRules?: { freeChildren?: number; extraBedChild2_11?: number; child12?: number; extraAdult?: number };
  earlyBookingDiscountPct?: number;
  // flight
  fareLadder?: Array<{ upToSeat: number; price: number }>;
  taxesPerPax?: number;
  defaultFare?: number | null;
  departures?: Array<{ date: string; capacity: number; sold?: number; priceOverride?: number | null }>;
  childPct?: number; infantPct?: number;
  // transfer
  vehicleType?: string; unit?: "per_pax" | "per_vehicle"; capacity?: number | null;
  surcharges?: Array<{ dateFrom: string; dateTo: string; pct: number; label?: string }>;
  // insurance
  coverage?: string | null;
  durationBrackets?: Array<{ bracket: string; pricePerAdult: number }>;
  childCoefficient?: number;
  [k: string]: unknown;
}

/* ── Сервис ───────────────────────────────────────────────────────────────── */

@Injectable()
export class TourBuilderService {
  private readonly logger = new Logger(TourBuilderService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ids: IdsService,
    private readonly security: SecurityService,
    private readonly policy: CatalogAccessPolicy,
  ) {}

  /* ── Вспомогательное: продукт и доступ ─────────────────────────────────── */

  private async ownDraftProduct(productId: string, actor: AuthUser, opts: { allowModeration?: boolean } = {}) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, code: true, title: true, type: true, status: true, partnerId: true, attributes: true },
    });
    if (!product) throw new NotFoundError(`Product ${productId} not found`);
    this.policy.assertCanManage(actor, product.partnerId, actor.role === RoleCode.PARTNER ? "catalog.product.update_own_draft" : "catalog.product.write");
    if (actor.role === RoleCode.PARTNER && product.status !== "DRAFT" && !opts.allowModeration) {
      throw new ConflictError(`Product ${product.code} is ${product.status}; PARTNER edits only DRAFT (published changes require moderation)`);
    }
    return product;
  }

  private builderAttrs(product: { attributes: Prisma.JsonValue | null }): TourBuilderAttributes {
    const a = (product.attributes ?? null) as Record<string, unknown> | null;
    const tb = a?.tourBuilder as TourBuilderAttributes | undefined;
    if (tb && Array.isArray(tb.components)) return tb;
    return { packageKind: "PACKAGE", components: [] };
  }

  private async writeBuilderAttrs(productId: string, tb: TourBuilderAttributes) {
    const current = (await this.prisma.product.findUnique({ where: { id: productId }, select: { attributes: true } }))?.attributes ?? null;
    const merged = { ...((current ?? {}) as Record<string, unknown>), tourBuilder: tb, packageKind: "PACKAGE" };
    await this.prisma.product.update({ where: { id: productId }, data: { attributes: merged as unknown as Prisma.InputJsonValue } });
  }

  private async audit(actor: AuthUser, action: string, resource: string, resourceId: string, details: Record<string, unknown>) {
    await this.security.audit(undefined, {
      userId: actor.id,
      username: actor.username,
      action,
      resource,
      resourceId,
      details,
    });
  }

  /* ── 1. Компоненты (ServiceUnit + опциональный Rate Plan) ─────────────── */

  /**
   * Добавить компонент пакета. Создаёт ServiceUnit (UNI-*) в составе продукта;
   * для accommodation/transfer/insurance сразу создаёт базовый Rate Plan (TRF-*),
   * для flight — план создаётся с базовой ценой GDS (defaultFare).
   * Структурные данные формы (лестница, вылеты, надбавки, brackets) — в
   * componentPayload.attributes.
   */
  async addComponent(
    productId: string,
    input: {
      kind: ComponentKind;
      name: string;
      required?: boolean;
      basePrice?: number;          // база Rate Plan (для accommodation — цена ночи без питания; flight — defaultFare; transfer — цена маршрута; insurance — не обязателен)
      componentPayload?: ComponentPayload;
    },
    actor: AuthUser,
  ) {
    assertKind(input.kind);
    const name = input.name?.trim();
    if (!name || name.length > 200) throw new ValidationDomainError("name must be 1..200 chars");
    const product = await this.ownDraftProduct(productId, actor);

    const payload = input.componentPayload ?? {};
    const unitAttributes: Record<string, unknown> = { tourBuilderKind: input.kind, payload };
    // Валюта тарифа — валюта пакета (выбирается на шаге «Основная информация»).
    const currency = this.builderAttrs(product).currency ?? "USD";

    const result = await this.prisma.$transaction(async (tx) => {
      const unitCode = await this.ids.nextCode(tx, "UNI");
      const unit = await tx.serviceUnit.create({
        data: {
          code: unitCode,
          productId: product.id,
          name,
          // Product без категории → attributes юнита ограничены; tourBuilder-данные
          // кладём только если у продукта есть schema-контекст, иначе хранить негде —
          // поэтому компонент требует categoryId у PACKAGE-тура (см. validate ниже).
          attributes: unitAttributes as unknown as Prisma.InputJsonValue,
          partnerId: product.partnerId ?? undefined,
        },
      });

      let tariffId: string | null = null;
      const needsTariff = input.kind === "accommodation" || input.kind === "flight" || input.kind === "transfer" || input.kind === "insurance";
      if (needsTariff) {
        const basis = input.kind === "accommodation" ? "PER_ROOM" : input.kind === "transfer" ? (payload.unit === "per_vehicle" ? "PER_UNIT" : "PER_PERSON") : "PER_PERSON";
        const tariffCode = await this.ids.nextCode(tx, "TRF");
        const tariff = await tx.tariff.create({
          data: {
            code: tariffCode,
            productId: product.id,
            serviceUnitId: unit.id,
            name: `${name} — base`,
            price: new Prisma.Decimal((input.basePrice ?? 0).toFixed(2)),
            currency,
            priceBasis: basis as never,
          },
        });
        tariffId = tariff.id;
      }

      return { unitId: unit.id, unitCode, tariffId };
    });

    // Регистрируем в составе пакета.
    const tb = this.builderAttrs(product);
    if (tb.components.some((c) => c.componentId === result.unitId)) {
      throw new ConflictError("Component already in package");
    }
    tb.components.push({ componentId: result.unitId, kind: input.kind, required: input.required ?? true });
    await this.writeBuilderAttrs(product.id, tb);

    await this.audit(actor, "tour_builder.component_added", "Product", product.id, {
      kind: input.kind, unitCode: result.unitCode, name,
    });
    return result;
  }

  async updateComponentPayload(productId: string, componentId: string, payload: ComponentPayload, actor: AuthUser) {
    const product = await this.ownDraftProduct(productId, actor);
    const tb = this.builderAttrs(product);
    if (!tb.components.some((c) => c.componentId === componentId)) {
      throw new NotFoundError(`Component ${componentId} is not part of package ${product.code}`);
    }
    const unit = await this.prisma.serviceUnit.findUnique({ where: { id: componentId }, select: { id: true, attributes: true } });
    if (!unit) throw new NotFoundError(`ServiceUnit ${componentId} not found`);
    const currentAttrs = (unit.attributes ?? {}) as Record<string, unknown>;
    const merged = { ...currentAttrs, payload };
    await this.prisma.serviceUnit.update({ where: { id: componentId }, data: { attributes: merged as Prisma.InputJsonValue } });
    await this.audit(actor, "tour_builder.component_updated", "Product", product.id, { componentId });
    return { ok: true };
  }

  async removeComponent(productId: string, componentId: string, actor: AuthUser) {
    const product = await this.ownDraftProduct(productId, actor);
    const tb = this.builderAttrs(product);
    if (!tb.components.some((c) => c.componentId === componentId)) {
      throw new NotFoundError(`Component ${componentId} is not part of package ${product.code}`);
    }
    const unit = await this.prisma.serviceUnit.findUnique({ where: { id: componentId }, select: { tariffs: { select: { id: true } } } });
    const tariffIds = unit?.tariffs.map((t) => t.id) ?? [];
    await this.prisma.$transaction(async (tx) => {
      if (tariffIds.length > 0) {
        await tx.availability.deleteMany({ where: { productId: product.id, tariffId: { in: tariffIds } } });
        await tx.commercialPeriod.deleteMany({ where: { tariffId: { in: tariffIds } } });
        await tx.tariff.deleteMany({ where: { id: { in: tariffIds } } });
      }
      await tx.serviceUnit.delete({ where: { id: componentId } });
    });
    tb.components = tb.components.filter((c) => c.componentId !== componentId);
    await this.writeBuilderAttrs(product.id, tb);
    await this.audit(actor, "tour_builder.component_removed", "Product", product.id, { componentId });
    return { ok: true };
  }

  async setRequired(productId: string, componentId: string, required: boolean, actor: AuthUser) {
    const product = await this.ownDraftProduct(productId, actor);
    const tb = this.builderAttrs(product);
    const comp = tb.components.find((c) => c.componentId === componentId);
    if (!comp) throw new NotFoundError(`Component ${componentId} is not part of package ${product.code}`);
    comp.required = required;
    await this.writeBuilderAttrs(product.id, tb);
    return { ok: true };
  }

  /* ── 1b. Варианты проживания (Tariff = вариант юнита-типа номера) ──────── */

  private async assertAccommodationComponent(productId: string, componentId: string, actor: AuthUser) {
    const product = await this.ownDraftProduct(productId, actor);
    const tb = this.builderAttrs(product);
    const comp = tb.components.find((c) => c.componentId === componentId && c.kind === "accommodation");
    if (!comp) throw new NotFoundError(`Accommodation component ${componentId} is not part of package ${product.code}`);
    return product;
  }

  /** Фасеты варианта: коды обязаны существовать в ACTIVE справочнике (решение №1). */
  private async validateFacetCodes(facets: { viewCode?: string | null; mealCode?: string | null; placementCode?: string | null }) {
    if (facets.viewCode) {
      const row = await this.prisma.viewType.findFirst({ where: { code: facets.viewCode, status: "ACTIVE" } });
      if (!row) throw new ValidationDomainError(`viewCode «${facets.viewCode}»: нет ACTIVE записи в справочнике видов`);
    }
    if (facets.mealCode) {
      const row = await this.prisma.mealType.findFirst({ where: { code: facets.mealCode, status: "ACTIVE" } });
      if (!row) throw new ValidationDomainError(`mealCode «${facets.mealCode}»: нет ACTIVE записи в справочнике питания`);
    }
    if (facets.placementCode) {
      const row = await this.prisma.placementType.findFirst({ where: { code: facets.placementCode, status: "ACTIVE" } });
      if (!row) throw new ValidationDomainError(`placementCode «${facets.placementCode}»: нет ACTIVE записи в справочнике размещений`);
    }
  }

  async createVariant(
    productId: string,
    componentId: string,
    input: { viewCode?: string; mealCode: string; placementCode: string; extraBed?: boolean; extraSofa?: boolean; name?: string; basePrice?: number },
    actor: AuthUser,
  ) {
    const product = await this.assertAccommodationComponent(productId, componentId, actor);
    await this.validateFacetCodes({ viewCode: input.viewCode, mealCode: input.mealCode, placementCode: input.placementCode });
    const currency = this.builderAttrs(product).currency ?? "USD";
    const name =
      input.name?.trim() ||
      [input.placementCode, input.viewCode, input.mealCode, input.extraBed ? "Ext.Bed" : null, input.extraSofa ? "Ext.Sofa" : null]
        .filter(Boolean)
        .join(" ");

    const tariff = await this.prisma.$transaction(async (tx) => {
      const code = await this.ids.nextCode(tx, "TRF");
      return tx.tariff.create({
        data: {
          code,
          productId: product.id,
          serviceUnitId: componentId,
          name,
          price: new Prisma.Decimal((input.basePrice ?? 0).toFixed(2)),
          currency,
          priceBasis: "PER_ROOM" as never,
          inclusions: {
            mealCode: input.mealCode,
            placementCode: input.placementCode,
            ...(input.viewCode ? { viewCode: input.viewCode } : {}),
            ...(input.extraBed ? { extraBed: true } : {}),
            ...(input.extraSofa ? { extraSofa: true } : {}),
          } as Prisma.InputJsonValue,
        },
      });
    });
    await this.audit(actor, "tour_builder.variant_created", "Product", product.id, {
      componentId, variantId: tariff.id, name,
    });
    return tariff;
  }

  async updateVariant(
    productId: string,
    componentId: string,
    variantId: string,
    input: { viewCode?: string; mealCode?: string; placementCode?: string; extraBed?: boolean; extraSofa?: boolean; name?: string; basePrice?: number },
    actor: AuthUser,
  ) {
    const product = await this.assertAccommodationComponent(productId, componentId, actor);
    const tariff = await this.prisma.tariff.findFirst({ where: { id: variantId, productId: product.id, serviceUnitId: componentId } });
    if (!tariff) throw new NotFoundError(`Variant ${variantId} not found in component ${componentId}`);

    const current = { ...((tariff.inclusions ?? {}) as Record<string, unknown>) };
    const next = { ...current };
    if (input.viewCode !== undefined) {
      if (input.viewCode) next.viewCode = input.viewCode;
      else delete next.viewCode;
    }
    if (input.mealCode !== undefined) next.mealCode = input.mealCode;
    if (input.placementCode !== undefined) next.placementCode = input.placementCode;
    if (input.extraBed !== undefined) {
      if (input.extraBed) next.extraBed = true;
      else delete next.extraBed;
    }
    if (input.extraSofa !== undefined) {
      if (input.extraSofa) next.extraSofa = true;
      else delete next.extraSofa;
    }
    await this.validateFacetCodes({
      viewCode: typeof next.viewCode === "string" ? next.viewCode : null,
      mealCode: typeof next.mealCode === "string" ? next.mealCode : null,
      placementCode: typeof next.placementCode === "string" ? next.placementCode : null,
    });

    const updated = await this.prisma.tariff.update({
      where: { id: tariff.id },
      data: {
        name: input.name?.trim() || tariff.name,
        ...(input.basePrice !== undefined ? { price: new Prisma.Decimal(input.basePrice.toFixed(2)) } : {}),
        inclusions: next as Prisma.InputJsonValue,
        version: { increment: 1 },
      },
    });
    await this.audit(actor, "tour_builder.variant_updated", "Product", product.id, { componentId, variantId: tariff.id });
    return updated;
  }

  async removeVariant(productId: string, componentId: string, variantId: string, actor: AuthUser) {
    const product = await this.assertAccommodationComponent(productId, componentId, actor);
    const tariff = await this.prisma.tariff.findFirst({ where: { id: variantId, productId: product.id, serviceUnitId: componentId } });
    if (!tariff) throw new NotFoundError(`Variant ${variantId} not found in component ${componentId}`);
    const total = await this.prisma.tariff.count({ where: { productId: product.id, serviceUnitId: componentId, status: "ACTIVE" } });
    if (total <= 1) throw new ConflictError("Cannot remove the last variant of the room type");

    await this.prisma.$transaction(async (tx) => {
      await tx.availability.deleteMany({ where: { productId: product.id, tariffId: tariff.id } });
      await tx.commercialPeriod.deleteMany({ where: { tariffId: tariff.id } });
      await tx.tariff.delete({ where: { id: tariff.id } });
    });
    await this.audit(actor, "tour_builder.variant_removed", "Product", product.id, { componentId, variantId });
    return { ok: true };
  }

  /* ── 2. Цены по датам (CommercialPeriod) и квоты (Availability) ───────── */

  /**
   * Сохранить календарь проживания: слои «дата-с…дата-по → цена» на Rate Plan
   * компонента + квоты по датам. Заменяет ACTIVE-периоды тарифа.
   * Слои: PERIOD (опционально dayOfWeek) и DATE_OVERRIDE (конкретные даты);
   * precedence — канонический period-resolution (write-валидация same-priority
   * overlap → 422, как в CommercialPeriodService). Даты — UTC midnight.
   */
  async saveAccommodationCalendar(
    productId: string,
    componentId: string,
    input: {
      tariffId: string;
      periods: Array<{ startDate: string; endDate: string; price: number; kind?: "PERIOD" | "DATE_OVERRIDE"; dayOfWeek?: number[] }>;
      clearPeriods?: boolean;
      allotment: Array<{ date: string; rooms: number }>;
    },
    actor: AuthUser,
  ) {
    const product = await this.ownDraftProduct(productId, actor);
    const tb = this.builderAttrs(product);
    const comp = tb.components.find((c) => c.componentId === componentId && c.kind === "accommodation");
    if (!comp) throw new NotFoundError(`Accommodation component ${componentId} is not part of package ${product.code}`);

    // Валидация слоёв.
    const periods = input.periods.map((p) => {
      const kind: "DATE_OVERRIDE" | "PERIOD" = p.kind === "DATE_OVERRIDE" ? "DATE_OVERRIDE" : "PERIOD";
      const dayOfWeek =
        kind === "DATE_OVERRIDE"
          ? []
          : [...new Set((p.dayOfWeek ?? []).map((d) => asNumber(d, "dayOfWeek", { integer: true, min: 0 })))].filter((d) => d <= 6).sort((a, b) => a - b);
      return {
        startDate: parseDateOnly(p.startDate, "startDate"),
        endDate: parseDateOnly(p.endDate, "endDate"),
        price: asNumber(p.price, "price", { min: 0 }),
        kind,
        dayOfWeek,
      };
    });
    for (const p of periods) {
      if (p.startDate > p.endDate) throw new ValidationDomainError(`Period ${p.startDate.toISOString().slice(0, 10)}..${p.endDate.toISOString().slice(0, 10)}: start after end`);
    }
    // Same-priority overlap — недетерминированный выбор цены (DD-026 §3.6 → 422).
    for (let i = 0; i < periods.length; i++) {
      for (let j = i + 1; j < periods.length; j++) {
        const a = periods[i];
        const b = periods[j];
        if (samePriorityOverlap(
          { id: `${i}`, code: "", kind: a.kind, startDate: a.startDate, endDate: a.endDate, dayOfWeek: a.dayOfWeek, price: { toNumber: () => a.price, toString: () => String(a.price) }, sellable: true, createdAt: new Date(0) },
          { id: `${j}`, code: "", kind: b.kind, startDate: b.startDate, endDate: b.endDate, dayOfWeek: b.dayOfWeek, price: { toNumber: () => b.price, toString: () => String(b.price) }, sellable: true, createdAt: new Date(0) },
        )) {
          throw new ValidationDomainError(
            `Layers ${i + 1} and ${j + 1} overlap with the same priority (kind/dayCount/dayOfWeek) — уточните диапазоны или дни недели`,
          );
        }
      }
    }

    // Замена ACTIVE-периодов тарифа (calendar-replace семантика конструктора).
    // Пустой periods БЕЗ clearPeriods = no-op: квота-сохранение или клиент,
    // не знающий слоёв, не должен стирать цены (иначе REPLACE молча обнуляет
    // календарь). Явное стирание — только clearPeriods=true.
    const replacePeriods = periods.length > 0 || input.clearPeriods === true;
    await this.prisma.$transaction(async (tx) => {
      const tariff = await tx.tariff.findFirst({ where: { id: input.tariffId, productId: product.id, serviceUnitId: componentId } });
      if (!tariff) throw new NotFoundError(`Rate plan ${input.tariffId} not found for component`);
      if (!replacePeriods) return;
      await tx.commercialPeriod.updateMany({ where: { tariffId: tariff.id, status: "ACTIVE" }, data: { status: "ARCHIVED" } });
      for (const p of periods) {
        const code = await this.ids.nextCode(tx, "CPR");
        await tx.commercialPeriod.create({
          data: {
            code,
            tariffId: tariff.id,
            kind: p.kind,
            startDate: p.startDate,
            endDate: p.endDate,
            dayOfWeek: p.dayOfWeek,
            price: new Prisma.Decimal(p.price.toFixed(2)),
            sellable: true,
          },
        });
      }
    });

    // Квоты (allotment): одна на тип номера — синхронизируются на ВСЕ тарифы
    // (варианты) юнита, чтобы view/meal/placement-варианты делили квоту
    // (решение №2 плана; цены при этом независимы).
    const unitTariffIds = (
      await this.prisma.tariff.findMany({ where: { productId: product.id, serviceUnitId: componentId }, select: { id: true } })
    ).map((t) => t.id);
    const allotmentTariffIds = unitTariffIds.length ? unitTariffIds : [input.tariffId];
    for (const a of input.allotment) {
      const date = parseDateOnly(a.date, "allotment.date");
      const rooms = asNumber(a.rooms, "allotment.rooms", { min: 0, integer: true });
      for (const tariffId of allotmentTariffIds) {
        const existing = await this.prisma.availability.findFirst({ where: { productId: product.id, tariffId, date } });
        if (existing) {
          await this.prisma.availability.update({ where: { id: existing.id }, data: { slotsTotal: rooms } });
        } else {
          await this.prisma.availability.create({ data: { productId: product.id, tariffId, date, slotsTotal: rooms } });
        }
      }
    }

    await this.audit(actor, "tour_builder.accommodation_calendar_saved", "Product", product.id, {
      componentId, tariffId: input.tariffId, periods: periods.length, replaced: replacePeriods, allotmentDays: input.allotment.length, allotmentTariffs: allotmentTariffIds.length,
    });
    return { ok: true };
  }

  /* ── 3. Состав пакета / правила ───────────────────────────────────────── */

  /**
   * Правила пакета. Порядок: сначала курсы (по ним конвертируем), затем —
   * смена валюты (конвертация всех денежных полей по курсам партнёра),
   * затем — остальные поля (входящие значения уже в текущей валюте).
   * Все поля undefined = не трогать.
   */
  async setPackageRules(
    productId: string,
    input: {
      packageDiscountPct?: number | null;
      freeTransferFromNights?: number | null;
      grossOverrideAmount?: number | null;
      extraBedPrice?: number | null;
      extraSofaPrice?: number | null;
      babyCot?: boolean;
      currency?: BuilderCurrency;
      fxUsdAzn?: number;
      fxEurAzn?: number;
    },
    actor: AuthUser,
  ) {
    const product = await this.ownDraftProduct(productId, actor);
    const tb = this.builderAttrs(product);

    // 1) Курсы партнёра (USD/EUR к AZN) — применяются до конвертации.
    const fx: BuilderFx = {
      usdAzn: input.fxUsdAzn ?? tb.fx?.usdAzn ?? DEFAULT_BUILDER_FX.usdAzn,
      eurAzn: input.fxEurAzn ?? tb.fx?.eurAzn ?? DEFAULT_BUILDER_FX.eurAzn,
    };
    if (!(fx.usdAzn > 0) || !(fx.eurAzn > 0)) throw new ValidationDomainError("Курсы должны быть > 0");
    tb.fx = fx;

    // 2) Смена валюты → конвертация всех цен (тарифы, периоды, payload, доп.опции).
    const from = tb.currency ?? "USD";
    let converted: { from: BuilderCurrency; to: BuilderCurrency; factor: number } | null = null;
    if (input.currency !== undefined && input.currency !== from) {
      if (!BUILDER_CURRENCIES.includes(input.currency)) throw new ValidationDomainError(`Неизвестная валюта: ${input.currency}`);
      const factor = priceFactor(from, input.currency, fx);
      const counts = await this.convertProductPrices(product.id, from, input.currency, fx, tb);
      tb.currency = input.currency;
      converted = { from, to: input.currency, factor: Math.round(factor * 1e6) / 1e6 };
      await this.audit(actor, "tour_builder.currency_changed", "Product", product.id, {
        from, to: input.currency, factor: converted.factor, fx, ...counts,
      });
    } else if (input.currency !== undefined) {
      tb.currency = input.currency;
    }

    // 3) Прочие правила (значения — в текущей валюте).
    if (input.packageDiscountPct !== undefined) tb.packageDiscountPct = input.packageDiscountPct;
    if (input.freeTransferFromNights !== undefined) tb.freeTransferFromNights = input.freeTransferFromNights;
    if (input.grossOverrideAmount !== undefined) {
      tb.grossOverride = input.grossOverrideAmount != null ? { amount: input.grossOverrideAmount, currency: tb.currency ?? "USD" } : null;
    }
    if (input.extraBedPrice !== undefined) tb.extraBedPrice = input.extraBedPrice;
    if (input.extraSofaPrice !== undefined) tb.extraSofaPrice = input.extraSofaPrice;
    if (input.babyCot !== undefined) tb.babyCot = input.babyCot;
    await this.writeBuilderAttrs(product.id, tb);
    await this.audit(actor, "tour_builder.package_rules_set", "Product", product.id, { ...input, ...(converted ? { converted } : {}) });
    return { ok: true, ...(converted ? { converted } : {}) };
  }

  /**
   * Конвертация всех денежных полей пакета из валюты `from` в `to` по курсам
   * партнёра: тарифы (+их валюта), слои календаря, денежные поля payload-ов
   * (лестница GDS, таксы, brackets, надбавки питания) и доп.опции пакета
   * (extraBedPrice/extraSofaPrice/grossOverride — мутируются в tb).
   * Проценты/коэффициенты не трогаются. Возвращает счётчики для аудита.
   */
  private async convertProductPrices(
    productId: string,
    from: BuilderCurrency,
    to: BuilderCurrency,
    fx: BuilderFx,
    tb: TourBuilderAttributes,
  ): Promise<{ tariffs: number; periods: number; units: number }> {
    const factor = priceFactor(from, to, fx);
    if (factor === 1) return { tariffs: 0, periods: 0, units: 0 };
    const money = (n: number) => round2(n * factor);

    const tariffs = await this.prisma.tariff.findMany({ where: { productId }, select: { id: true, price: true } });
    const periods = await this.prisma.commercialPeriod.findMany({
      where: { tariff: { productId } },
      select: { id: true, price: true },
    });
    const units = await this.prisma.serviceUnit.findMany({ where: { productId }, select: { id: true, attributes: true } });

    await this.prisma.$transaction(async (tx) => {
      for (const t of tariffs) {
        const p = numOrDec(t.price) ?? 0;
        await tx.tariff.update({ where: { id: t.id }, data: { price: new Prisma.Decimal(money(p).toFixed(2)), currency: to } });
      }
      for (const p of periods) {
        const v = numOrDec(p.price) ?? 0;
        await tx.commercialPeriod.update({ where: { id: p.id }, data: { price: new Prisma.Decimal(money(v).toFixed(2)) } });
      }
      for (const u of units) {
        const attrs = (u.attributes ?? {}) as Record<string, unknown>;
        const payload = (attrs.payload ?? null) as ComponentPayload | null;
        if (!payload) continue;
        const next = convertPayloadMoney(payload, money);
        if (!next) continue;
        await tx.serviceUnit.update({
          where: { id: u.id },
          data: { attributes: { ...attrs, payload: next } as unknown as Prisma.InputJsonValue },
        });
      }
    });

    // Доп.опции и grossOverride пакета — в tb (пишется вызывающим методом).
    if (tb.extraBedPrice != null) tb.extraBedPrice = money(tb.extraBedPrice);
    if (tb.extraSofaPrice != null) tb.extraSofaPrice = money(tb.extraSofaPrice);
    if (tb.grossOverride?.amount != null) {
      tb.grossOverride = { amount: money(tb.grossOverride.amount), currency: to };
    }

    return { tariffs: tariffs.length, periods: periods.length, units: units.filter((u) => u.attributes != null).length };
  }

  /* ── 4. Чтение состояния конструктора ─────────────────────────────────── */

  async getState(productId: string, actor: AuthUser) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: {
        id: true, code: true, title: true, description: true, type: true, status: true,
        partnerId: true, attributes: true,
        serviceUnits: {
          select: {
            id: true, code: true, name: true, attributes: true, status: true,
            tariffs: {
              select: {
                id: true, code: true, name: true, price: true, currency: true, priceBasis: true, inclusions: true,
                periods: { where: { status: "ACTIVE" }, select: { id: true, code: true, kind: true, startDate: true, endDate: true, dayOfWeek: true, price: true, sellable: true }, orderBy: { startDate: "asc" } },
              },
            },
          },
          orderBy: { createdAt: "asc" },
        },
      },
    });
    if (!product) throw new NotFoundError(`Product ${productId} not found`);
    this.policy.assertCanManage(actor, product.partnerId, actor.role === RoleCode.PARTNER ? "catalog.product.read_own" : "catalog.product.read");
    // Квоты: Availability привязана к Product (tariffId — атрибут строки),
    // поэтому отдельная загрузка по всем тарифам юнитов.
    const unitIds = product.serviceUnits.map((u) => u.id);
    const tariffIds = product.serviceUnits.flatMap((u) => u.tariffs.map((t) => t.id));
    const availRows = tariffIds.length
      ? await this.prisma.availability.findMany({
          where: { productId, tariffId: { in: tariffIds } },
          select: { tariffId: true, date: true, slotsTotal: true, slotsBooked: true, slotsReserved: true },
          orderBy: { date: "asc" },
        })
      : [];
    const availByTariff = new Map<string, Array<{ date: string; slotsTotal: number; slotsBooked: number; slotsReserved: number }>>();
    for (const a of availRows) {
      if (!a.tariffId) continue;
      const list = availByTariff.get(a.tariffId) ?? [];
      list.push({ date: a.date.toISOString().slice(0, 10), slotsTotal: a.slotsTotal, slotsBooked: a.slotsBooked, slotsReserved: a.slotsReserved });
      availByTariff.set(a.tariffId, list);
    }
    const tb = this.builderAttrs(product);
    const units = product.serviceUnits
      .filter((u) => {
        const a = (u.attributes ?? {}) as Record<string, unknown>;
        return typeof a.tourBuilderKind === "string";
      })
      .map((u) => {
        const a = (u.attributes ?? {}) as Record<string, unknown>;
        const comp = tb.components.find((c) => c.componentId === u.id);
        return {
          componentId: u.id,
          unitCode: u.code,
          name: u.name,
          kind: a.tourBuilderKind as ComponentKind,
          required: comp?.required ?? true,
          payload: (a.payload ?? {}) as ComponentPayload,
          tariffs: u.tariffs.map((t) => ({
            id: t.id, code: t.code, name: t.name, price: numOrDec(t.price), currency: t.currency, priceBasis: t.priceBasis, inclusions: t.inclusions,
            periods: t.periods.map((p) => ({ id: p.id, code: p.code, kind: p.kind, startDate: p.startDate.toISOString().slice(0, 10), endDate: p.endDate.toISOString().slice(0, 10), dayOfWeek: p.dayOfWeek, price: numOrDec(p.price), sellable: p.sellable })),
            availability: availByTariff.get(t.id) ?? [],
          })),
        };
      });
    return {
      product: { id: product.id, code: product.code, title: product.title, description: product.description, status: product.status },
      package: {
        components: units,
        packageDiscountPct: tb.packageDiscountPct ?? null,
        freeTransferFromNights: tb.freeTransferFromNights ?? null,
        grossOverride: tb.grossOverride ?? null,
        extraBedPrice: tb.extraBedPrice ?? null,
        extraSofaPrice: tb.extraSofaPrice ?? null,
        babyCot: tb.babyCot === true,
        currency: tb.currency ?? "USD",
        fx: tb.fx ?? DEFAULT_BUILDER_FX,
      },
    };
  }

  /* ── 5. Расчёт (единая функция, backend-authoritative) ────────────────── */

  /**
   * Тестовый расчёт: дата вылета, ночи, туристы → разбивка по компонентам с
   * формулами. Источник цен — CommercialPeriod/лестница/надбавки/brackets.
   */
  async quote(
    productId: string,
    input: { departureDate: string; nights: number; adults: number; children: Array<{ age: number }> },
    actor: AuthUser,
  ) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, code: true, title: true, partnerId: true, attributes: true, serviceUnits: { select: { id: true, name: true, attributes: true, tariffs: { select: { id: true, code: true, name: true, price: true, currency: true, inclusions: true, periods: { where: { status: "ACTIVE" } } } } } } },
    });
    if (!product) throw new NotFoundError(`Product ${productId} not found`);
    this.policy.assertCanManage(actor, product.partnerId, actor.role === RoleCode.PARTNER ? "catalog.product.read_own" : "catalog.product.read");

    const departure = parseDateOnly(input.departureDate, "departureDate");
    const nights = asNumber(input.nights, "nights", { min: 1, integer: true });
    const adults = asNumber(input.adults, "adults", { min: 1, integer: true });
    const children = (input.children ?? []).map((c) => asNumber(c?.age, "children.age", { min: 0, integer: true }));

    const tb = this.builderAttrs(product);
    const lines: unknown[] = [];
    const warnings: string[] = [];
    let netTotal = 0;
    // Выбранный (primary) тариф-вариант по accommodation-компонентам —
    // для availability-расчёта ниже.
    const accommodationChosen = new Map<string, string>();

    for (const ref of tb.components) {
      const unit = product.serviceUnits.find((u) => u.id === ref.componentId);
      if (!unit) continue;
      const ua = (unit.attributes ?? {}) as Record<string, unknown>;
      const payload = (ua.payload ?? {}) as ComponentPayload;
      const tariff = unit.tariffs[0];
      if (!tariff) { warnings.push(`${unit.name}: нет Rate Plan — компонент пропущен`); continue; }
      const base = numOrDec(tariff.price) ?? 0;

      if (ref.kind === "accommodation") {
        // Варианты = тарифы юнита-типа номера. Для группы перебираем варианты
        // (view×meal×placement): rooms = ceil(гости / capacity(размещения)),
        // rate по слоям (канонический precedence), питание — по mealCode варианта.
        // Альтернативы: все варианты кроме выбранного (дешёвый — primary).
        const guests = adults + children.length;
        const candidates: Array<{
          variant: (typeof unit.tariffs)[number];
          capacity: number;
          placementCode: string | null;
          rooms: number;
          amount: number;
          formulas: string[];
        }> = [];
        for (const variant of unit.tariffs) {
          const inc = (variant.inclusions ?? null) as Record<string, unknown> | null;
          const placementCode = typeof inc?.placementCode === "string" ? inc.placementCode : null;
          const capacity = placementCapacity(placementCode);
          const variantBase = numOrDec(variant.price) ?? base;
          const rooms = Math.ceil(guests / capacity);
          const stays: Array<{ from: string; to: string; nights: number; rate: number }> = [];
          let idx = new Date(departure);
          for (let i = 0; i < nights; i++) {
            const dayIso = idx.toISOString().slice(0, 10);
            // Канонический precedence (DD-026): DATE_OVERRIDE > уже́й период >
            // период с dayOfWeek > голый период > base price.
            const period = resolveApplicablePeriod(variant.periods, idx);
            const rate = period ? numOrDec(period.price) ?? variantBase : variantBase;
            const last = stays[stays.length - 1];
            if (last && last.rate === rate) { last.to = dayIso; last.nights += 1; }
            else stays.push({ from: dayIso, to: dayIso, nights: 1, rate });
            idx = new Date(idx.getTime() + 86_400_000);
          }
          let amount = 0;
          const formulas: string[] = [
            `${variant.name}${placementCode ? ` · ${placementCode} (до ${capacity} гост.)` : ""} · ${rooms} номер(ов) × ${guests} гостей`,
          ];
          for (const s of stays) {
            const line = s.rate * s.nights * rooms;
            amount += line;
            formulas.push(`${s.from === s.to ? s.from : `${s.from}–${s.to}`} · ${s.nights} ноч. × ${s.rate} × ${rooms} номер(ов) = ${round2(line)}`);
          }
          // Питание: по mealCode варианта; у legacy-тарифа без фасет — сумма всех.
          const mealCode = typeof inc?.mealCode === "string" ? inc.mealCode : null;
          const meal = payload.mealSupplements ?? {};
          const mealPct = mealCode ? numOrDec(meal[mealCode]) ?? 0 : Object.values(meal).reduce((acc, v) => acc + (numOrDec(v) ?? 0), 0);
          if (mealPct > 0) {
            const mealLine = mealPct * nights * adults;
            amount += mealLine;
            formulas.push(`${mealCode ? `Питание ${mealCode}` : "Питание"}: +${mealPct}/сутки взр. × ${nights} × ${adults} = ${round2(mealLine)}`);
          }
          // Доп. опции: фикс-цена пакета за ночь на номер (0 = бесплатно).
          for (const [flag, label, priceRaw] of [
            [inc?.extraBed, "Ext. Bed", tb.extraBedPrice],
            [inc?.extraSofa, "Ext. Sofa", tb.extraSofaPrice],
          ] as Array<[unknown, string, number | null | undefined]>) {
            if (flag !== true) continue;
            const price = typeof priceRaw === "number" ? priceRaw : 0;
            if (price > 0) {
              const line2 = price * nights * rooms;
              amount += line2;
              formulas.push(`${label}: +${price}/сут × ${nights} ноч. × ${rooms} номер(ов) = ${round2(line2)}`);
            } else {
              formulas.push(`${label}: бесплатно`);
            }
          }
          const eb = payload.earlyBookingDiscountPct ?? 0;
          if (eb > 0) {
            const d = amount * (eb / 100);
            amount -= d;
            formulas.push(`Раннее бронирование −${eb}% = −${round2(d)}`);
          }
          candidates.push({ variant, capacity, placementCode, rooms, amount, formulas });
        }
        if (!candidates.length) { warnings.push(`${unit.name}: нет Rate Plan — компонент пропущен`); continue; }
        candidates.sort((a, b) => a.amount - b.amount);
        const chosen = candidates[0];
        accommodationChosen.set(ref.componentId, chosen.variant.id);
        netTotal += chosen.amount;
        const viewOf = (v: (typeof unit.tariffs)[number]) => {
          const i = (v.inclusions ?? null) as Record<string, unknown> | null;
          return {
            variantId: v.id,
            name: v.name,
            placementCode: typeof i?.placementCode === "string" ? i.placementCode : null,
            mealCode: typeof i?.mealCode === "string" ? i.mealCode : null,
            viewCode: typeof i?.viewCode === "string" ? i.viewCode : null,
            extraBed: i?.extraBed === true,
            extraSofa: i?.extraSofa === true,
          };
        };
        lines.push({
          kind: ref.kind,
          name: unit.name,
          amount: round2(chosen.amount),
          formulas: chosen.formulas,
          required: ref.required,
          variant: { ...viewOf(chosen.variant), capacity: chosen.capacity, rooms: chosen.rooms },
          alternatives: candidates.slice(1, 6).map((c) => ({ ...viewOf(c.variant), capacity: c.capacity, rooms: c.rooms, amount: round2(c.amount), formulas: c.formulas })),
        });
      } else if (ref.kind === "flight") {
        const ladder = (payload.fareLadder ?? []).slice().sort((a, b) => a.upToSeat - b.upToSeat);
        const dep = (payload.departures ?? []).find((d) => d.date === departure.toISOString().slice(0, 10));
        const sold = asNumber(dep?.sold ?? 0, "sold", { min: 0, integer: true });
        const seatsNeeded = adults + children.length;
        if (dep && dep.capacity - sold < seatsNeeded) warnings.push(`Перелёт «${unit.name}»: мест ${dep.capacity - sold} < нужно ${seatsNeeded}`);
        let paxPrice: number;
        let source: string;
        if (dep?.priceOverride != null) { paxPrice = dep.priceOverride; source = "точечная цена даты"; }
        else {
          const seatNo = sold + 1; // первое свободное место блока
          const tier = ladder.find((t) => seatNo <= t.upToSeat);
          if (tier) { paxPrice = tier.price; source = `лестница (до места ${tier.upToSeat})`; }
          else { paxPrice = payload.defaultFare ?? base; source = "GDS base (блок исчерпан)"; }
        }
        const taxes = payload.taxesPerPax ?? 0;
        const childPct = (payload.childPct ?? 75) / 100;
        const infantPct = (payload.infantPct ?? 10) / 100;
        const infants = children.filter((a) => a < 2).length;
        const kids = children.filter((a) => a >= 2 && a < 12).length;
        const amount = adults * (paxPrice + taxes) + kids * (paxPrice * childPct + taxes) + infants * (paxPrice * infantPct);
        const formulas = [
          `Взрослые ×${adults}: ${paxPrice} (${source}) + таксы ${taxes} «без комиссии» = ${round2(adults * (paxPrice + taxes))}`,
          kids > 0 ? `Дети 2–11 ×${kids}: ${paxPrice}×${payload.childPct ?? 75}% + таксы = ${round2(kids * (paxPrice * childPct + taxes))}` : null,
          infants > 0 ? `Инфанты ×${infants}: ${paxPrice}×${payload.infantPct ?? 10}% = ${round2(infants * paxPrice * infantPct)}` : null,
        ].filter(Boolean);
        netTotal += amount;
        lines.push({ kind: ref.kind, name: unit.name, amount: round2(amount), formulas, required: ref.required });
      } else if (ref.kind === "transfer") {
        const perVehicle = payload.unit === "per_vehicle";
        const surcharge = (payload.surcharges ?? []).find((s) => {
          const from = parseDateOnly(s.dateFrom, "surcharge.dateFrom");
          const to = parseDateOnly(s.dateTo, "surcharge.dateTo");
          return from.getTime() <= departure.getTime() && departure.getTime() <= to.getTime();
        });
        const unitsNeeded = perVehicle ? Math.ceil((adults + children.length) / Math.max(1, payload.capacity ?? 4)) : adults + children.length;
        let amount = base * unitsNeeded;
        const formulas = [`${perVehicle ? "За машину" : "С человека"}: ${base} × ${unitsNeeded} = ${round2(amount)}`];
        if (surcharge) {
          const add = amount * (surcharge.pct / 100);
          amount += add;
          formulas.push(`Надбавка «${surcharge.label ?? ""}» +${surcharge.pct}% = +${round2(add)}`);
        }
        const freeFrom = tb.freeTransferFromNights ?? 0;
        if (freeFrom > 0 && nights >= freeFrom) {
          formulas.push(`Бесплатный трансфер от ${freeFrom} ноч. — зачтён (зачёркнуто: ${round2(amount)})`);
          amount = 0;
        }
        netTotal += amount;
        lines.push({ kind: ref.kind, name: unit.name, amount: round2(amount), formulas, required: ref.required });
      } else if (ref.kind === "insurance") {
        const brackets = payload.durationBrackets ?? [];
        const br = brackets.find((b) => matchBracket(b.bracket, nights));
        if (!br) { warnings.push(`Страховка «${unit.name}»: нет ставки для ${nights} ноч.`); continue; }
        const coeff = payload.childCoefficient ?? 0.6;
        const kids = children.filter((a) => a < 12).length;
        const amount = adults * br.pricePerAdult + kids * br.pricePerAdult * coeff;
        netTotal += amount;
        lines.push({
          kind: ref.kind, name: unit.name, amount: round2(amount), required: ref.required,
          formulas: [`Диапазон ${br.bracket}: ${br.pricePerAdult} × ${adults} взр.${kids > 0 ? ` + ${kids} дет. × ${coeff}` : ""} = ${round2(amount)}`],
        });
      } else {
        // extra — фиксированная цена юнита за весь пакет.
        const amount = base;
        netTotal += amount;
        lines.push({ kind: ref.kind, name: unit.name, amount: round2(amount), formulas: [`Фиксированная допуслуга = ${round2(base)}`], required: ref.required });
      }
    }

    // Доступность пакета = min по обязательным компонентам; узкое место — явно.
    // Квоты (Availability) привязаны к Product + tariffId — загружаем отдельным запросом.
    const packageTariffIds = product.serviceUnits.flatMap((u) => u.tariffs.map((t) => t.id));
    const availRows = packageTariffIds.length
      ? await this.prisma.availability.findMany({ where: { productId: product.id, tariffId: { in: packageTariffIds } }, select: { tariffId: true, date: true, slotsTotal: true, slotsBooked: true, slotsReserved: true } })
      : [];
    const availabilityPerComponent: Array<{ componentId: string; name: string; available: number | null }> = [];
    for (const ref of tb.components) {
      if (!ref.required) continue;
      const unit = product.serviceUnits.find((u) => u.id === ref.componentId);
      const tariff = unit?.tariffs[0];
      if (!tariff) { availabilityPerComponent.push({ componentId: ref.componentId, name: unit?.name ?? ref.componentId, available: null }); continue; }
      if (ref.kind === "accommodation") {
        // Квоты считаем по выбранному варианту (все варианты делят одну квоту,
        // строки Availability синхронизированы — fallback на первый тариф).
        // Конвенция платформы (sales.checkout.classifyAvailability): нет строки
        // на дату → NOT_CONFIGURED (null), а НЕ 0 — не изобретаем «нет мест».
        const rows = availRows.filter((a) => a.tariffId === (accommodationChosen.get(ref.componentId) ?? tariff.id));
        const perDay: Array<number | null> = [];
        let idx = new Date(departure);
        for (let i = 0; i < nights; i++) {
          const av = rows.find((a) => a.date.getTime() === idx.getTime());
          perDay.push(av ? Math.max(0, av.slotsTotal - av.slotsBooked - av.slotsReserved) : null);
          idx = new Date(idx.getTime() + 86_400_000);
        }
        // Любая ночь без строки → квота не настроена целиком; иначе минимум.
        const configured = perDay.every((d) => d != null);
        availabilityPerComponent.push({ componentId: ref.componentId, name: unit!.name, available: configured ? Math.min(...(perDay as number[])) : null });
      } else if (ref.kind === "flight") {
        const payload = ((unit!.attributes ?? {}) as Record<string, unknown>).payload as ComponentPayload;
        const dep = (payload?.departures ?? []).find((d) => d.date === departure.toISOString().slice(0, 10));
        availabilityPerComponent.push({ componentId: ref.componentId, name: unit!.name, available: dep ? Math.max(0, dep.capacity - (dep.sold ?? 0)) : 0 });
      } else if (ref.kind === "transfer") {
        const payload = ((unit!.attributes ?? {}) as Record<string, unknown>).payload as ComponentPayload;
        availabilityPerComponent.push({ componentId: ref.componentId, name: unit!.name, available: payload.unit === "per_vehicle" ? (payload.capacity ?? 0) : null });
      } else {
        availabilityPerComponent.push({ componentId: ref.componentId, name: unit!.name, available: null });
      }
    }
    const finite = availabilityPerComponent.filter((a) => a.available != null);
    const bottleneck = finite.length ? finite.reduce((m, a) => (a.available! < m.available! ? a : m)) : null;

    const discountPct = tb.packageDiscountPct ?? 0;
    const discount = netTotal * (discountPct / 100);
    const net = netTotal - discount;
    const commissionPct = 10; // база комиссии платформы (конвенция демо); таксы/топливо не входят
    const commission = net * (commissionPct / 100);
    const grossCalculated = net + commission;
    const grossOverride = tb.grossOverride?.amount ?? null;
    const gross = grossOverride ?? grossCalculated;

    return {
      input: { departureDate: departure.toISOString().slice(0, 10), nights, adults, children },
      currency: tb.currency ?? "USD",
      lines,
      availability: { perComponent: availabilityPerComponent, bottleneck },
      totals: {
        net: round2(netTotal),
        packageDiscountPct: discountPct,
        packageDiscount: round2(discount),
        partnerNet: round2(net),
        commissionPct,
        commission: round2(commission),
        grossCalculated: round2(grossCalculated),
        grossOverride: grossOverride != null ? round2(grossOverride) : null,
        gross: round2(gross),
      },
      warnings,
    };
  }

  /* ── 6. Справочники (типы номеров/видов) для шага «Проживание» ─────────── */

  private parseDictionaryType(type: string): "room-types" | "view-types" {
    if (type === "room-types" || type === "view-types") return type;
    throw new ValidationDomainError(`Unknown dictionary type: ${type}`);
  }

  private async dictionaryEntries(type: "room-types" | "view-types", statuses: Array<"ACTIVE" | "PENDING">) {
    const where = { status: { in: statuses } };
    const orderBy = [{ sortOrder: "asc" as const }, { code: "asc" as const }];
    const select = { id: true, code: true, names: true, sortOrder: true } as const;
    if (type === "room-types") return this.prisma.roomType.findMany({ where, orderBy, select });
    return this.prisma.viewType.findMany({ where, orderBy, select });
  }

  private async dictionaryCodeTaken(type: "room-types" | "view-types", code: string): Promise<boolean> {
    if (type === "room-types") return !!(await this.prisma.roomType.findUnique({ where: { code }, select: { id: true } }));
    return !!(await this.prisma.viewType.findUnique({ where: { code }, select: { id: true } }));
  }

  /** ACTIVE-записи справочников для форм шага «Проживание» (и UI-выпадашек). */
  async getDictionaries() {
    const select = { id: true, code: true, names: true, sortOrder: true } as const;
    const orderBy = [{ sortOrder: "asc" as const }, { code: "asc" as const }];
    const [roomTypes, viewTypes, mealTypes, placementTypes, pendingRoomTypes] = await Promise.all([
      this.prisma.roomType.findMany({ where: { status: "ACTIVE" }, orderBy, select }),
      this.prisma.viewType.findMany({ where: { status: "ACTIVE" }, orderBy, select }),
      this.prisma.mealType.findMany({ where: { status: "ACTIVE" }, orderBy, select }),
      this.prisma.placementType.findMany({ where: { status: "ACTIVE" }, orderBy, select }),
      this.prisma.roomType.findMany({ where: { status: "PENDING" }, orderBy, select }),
    ]);
    return { roomTypes, viewTypes, mealTypes, placementTypes, pendingRoomTypes };
  }

  /** Похожие записи (ACTIVE+PENDING) — ответ на дубль/подсказку ввода. */
  async similarDictionaryEntries(type: string, q: string) {
    const dictType = this.parseDictionaryType(type);
    if (!q?.trim()) throw new ValidationDomainError("q is required");
    const entries = await this.dictionaryEntries(dictType, ["ACTIVE", "PENDING"]);
    return { type: dictType, query: q, candidates: findSimilarCandidates(q, entries) };
  }

  /**
   * Предложение новой записи справочника (тип номера/вида) от партнёра:
   * точный normalized-дубль → 409 (фронт подтягивает /similar), иначе
   * запись со статусом PENDING — утверждает модератор.
   */
  async proposeDictionaryEntry(
    actor: AuthUser,
    input: { type: string; name: string; lang?: string | null },
  ) {
    const dictType = this.parseDictionaryType(input.type);
    const name = (input.name ?? "").trim();
    if (name.length < 2) throw new ValidationDomainError("name: минимум 2 символа");
    const lang = input.lang && ["ru", "en", "az"].includes(input.lang) ? input.lang : "ru";

    const entries = await this.dictionaryEntries(dictType, ["ACTIVE", "PENDING"]);
    const [exact] = findSimilarCandidates(name, entries, { minScore: 1, limit: 1 });
    if (exact) {
      throw new ConflictError(`Такая запись уже есть в справочнике: ${exact.code} — используйте существующую (см. похожие)`);
    }

    let code = normalizeTypeName(name);
    if (code) {
      const base = code;
      for (let suffix = 2; suffix <= 50; suffix++) {
        if (!(await this.dictionaryCodeTaken(dictType, code))) break;
        code = `${base}-${suffix}`;
        if (suffix === 50) code = "";
      }
    }
    if (!code) {
      code = await this.ids.nextCode(this.prisma, dictType === "room-types" ? "RT" : "VW");
    }

    const sortOrder = entries.length ? Math.max(...entries.map((e) => e.sortOrder ?? 0)) + 1 : 0;
    const names = { [lang]: name };
    const entry =
      dictType === "room-types"
        ? await this.prisma.roomType.create({ data: { code, names, sortOrder, status: "PENDING", createdBy: actor.id } })
        : await this.prisma.viewType.create({ data: { code, names, sortOrder, status: "PENDING", createdBy: actor.id } });

    await this.audit(actor, "tour_builder.dictionary_entry_proposed", dictType, entry.id, { type: dictType, name, lang, code });
    return entry;
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Фактор конвертации from→to по курсам партнёра (aznPer(AZN)=1):
 * factor = aznPer(to) / aznPer(from).
 */
function priceFactor(from: BuilderCurrency, to: BuilderCurrency, fx: BuilderFx): number {
  if (from === to) return 1;
  const aznPer = (c: BuilderCurrency) => (c === "AZN" ? 1 : c === "USD" ? fx.usdAzn : fx.eurAzn);
  return aznPer(to) / aznPer(from);
}

/**
 * Конвертация денежных полей payload-а компонента. Проценты/коэффициенты/
 * capacity не трогаем. Возвращает новый payload или null, если менять нечего.
 */
function convertPayloadMoney(payload: ComponentPayload, money: (n: number) => number): ComponentPayload | null {
  let changed = false;
  const next: ComponentPayload = { ...payload };

  if (payload.mealSupplements) {
    const meals: Record<string, number> = {};
    for (const [plan, v] of Object.entries(payload.mealSupplements)) meals[plan] = money(v);
    next.mealSupplements = meals;
    changed = true;
  }
  if (payload.fareLadder?.length) {
    next.fareLadder = payload.fareLadder.map((f) => ({ ...f, price: money(f.price) }));
    changed = true;
  }
  if (payload.taxesPerPax != null) {
    next.taxesPerPax = money(payload.taxesPerPax);
    changed = true;
  }
  if (payload.defaultFare != null) {
    next.defaultFare = money(payload.defaultFare);
    changed = true;
  }
  if (payload.departures?.length) {
    next.departures = payload.departures.map((d) => (d.priceOverride != null ? { ...d, priceOverride: money(d.priceOverride) } : d));
    changed = true;
  }
  if (payload.durationBrackets?.length) {
    next.durationBrackets = payload.durationBrackets.map((b) => ({ ...b, pricePerAdult: money(b.pricePerAdult) }));
    changed = true;
  }

  return changed ? next : null;
}

/**
 * Capacity номера по коду размещения (SNGL1/DBL2/TWIN2/TRPL3/QDPL4 из seed).
 * null/legacy-тариф без фасет → 2 (базовое «2 взрослых/номер»).
 */
function placementCapacity(code: string | null): number {
  switch (code) {
    case "SNGL": return 1;
    case "DBL": return 2;
    case "TWIN": return 2;
    case "TRPL": return 3;
    case "QDPL": return 4;
    default: return 2;
  }
}

/** '1-7' | '8-14' | '15-21' | '22+' → матч по числу ночей. */
function matchBracket(bracket: string, nights: number): boolean {
  const m = /^(\d+)\+?$/.exec(bracket);
  if (bracket.endsWith("+")) {
    const from = Number(bracket.slice(0, -1));
    return nights >= from;
  }
  const parts = bracket.split("-").map(Number);
  if (parts.length === 2 && parts.every(Number.isFinite)) {
    return nights >= parts[0] && nights <= parts[1];
  }
  if (m) return nights >= Number(m[1]);
  return false;
}
