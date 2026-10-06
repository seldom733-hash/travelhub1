/**
 * Supplier Markup (STRICT PROMPT §8/§9/§10) — SupplierPricingService.
 *
 * ЕДИНСТВЕННЫЙ централизованный pricing-сервис: resolve(правило) + apply(наценка).
 * Вся денежная математика — через существующие sales.money-примитивы
 * (toMoney2, ROUND_HALF_UP, DECIMAL(12,2) range guard); ВТОРАЯ реализация
 * money-arithmetic запрещена (§8).
 *
 * Формула (§2/§10):
 *   markupAmount = supplierLivePrice × markupRate   (half-up до 2dp)
 *   publicPrice  = supplierLivePrice + markupAmount
 *
 * NOT_CONFIGURED (§7): нет активной rule → rate = 0, state = NOT_CONFIGURED
 * (runtime 0%, но НЕ маскируется как сконфигурированный 0% — UI различает).
 *
 * Gate E (§12): supplierPrice <= 0 / missing / invalid → НИКОГДА не валиден
 * как коммерческие деньги — apply() бросает ValidationDomainError.
 *
 * NO DOUBLE MARKUP (§9): apply() считает ТОЛЬКО из supplier price по
 * разрешённому правилу; границы (aggregator/refresh/sync/azal/Request) обязаны
 * либо вызвать apply() один раз, либо пробросить уже-рассчитанный результат
 * (pricing-блок) без повторного применения.
 *
 * Валюта (§22): FX нет — markup считается в валюте supplier-оффера,
 * publicPrice той же валюты.
 */
import { Injectable, Logger } from "@nestjs/common";
import { Prisma } from "../../generated/prisma/client";
import { MoneyInput, toMoney2 } from "../sales/sales.money";
import { ValidationDomainError } from "../../shared/errors";
import { MarkupRuleService, MarkupRuleResolution } from "./markup-rule.service";
import { validateServiceType, validateSupplierCode } from "./pricing.validation";
import type { MarkupPricingJson } from "./pricing.types";
import type {
  PriceCalendarEntry,
  PriceCalendarResult,
  SupplierOffer,
  SupplierPriceSnapshot,
} from "../supplier/supplier.types";

/** Результат resolve: configured-правило отличим от NOT_CONFIGURED (§7). */
export interface ResolvedMarkup {
  state: "CONFIGURED" | "NOT_CONFIGURED";
  rate: Prisma.Decimal;
  ruleCode: string | null;
  ruleVersion: number | null;
}

/** Структурированный результат apply — достаточно для frozen snapshot (§20). */
export interface MarkupPricingResult {
  supplierPrice: Prisma.Decimal;
  supplierCurrency: string;
  markupRate: Prisma.Decimal;
  markupAmount: Prisma.Decimal;
  publicPrice: Prisma.Decimal;
  markupRuleCode: string | null;
  markupRuleVersion: number | null;
  configurationState: "CONFIGURED" | "NOT_CONFIGURED";
  pricingCalculatedAt: Date;
}

export const NOT_CONFIGURED: Readonly<ResolvedMarkup> = Object.freeze({
  state: "NOT_CONFIGURED" as const,
  rate: new Prisma.Decimal(0),
  ruleCode: null,
  ruleVersion: null,
});

@Injectable()
export class SupplierPricingService {
  private readonly logger = new Logger(SupplierPricingService.name);

  constructor(private readonly markupRules: MarkupRuleService) {}

  /** Разрешить активное правило для key (supplierCode + serviceType) на instant. */
  async resolve(supplierCode: string, serviceType: string, at: Date = new Date()): Promise<ResolvedMarkup> {
    const resolution: MarkupRuleResolution = await this.markupRules.resolve(supplierCode, serviceType, at);
    if (!resolution.found) return { ...NOT_CONFIGURED };
    return {
      state: "CONFIGURED",
      rate: resolution.rate,
      ruleCode: resolution.ruleCode,
      ruleVersion: resolution.ruleVersion,
    };
  }

  /**
   * Единственный расчёт наценки. Чистая функция от (resolution, supplierPrice,
   * currency) — без БД, детерминированная, unit-testable.
   *
   * Gate E: supplierPrice <= 0 → reject (0/отрицательный/нечисловой supplier
   * price не может стать коммерческими деньгами).
   */
  apply(resolution: ResolvedMarkup, supplierPrice: MoneyInput, supplierCurrency: string): MarkupPricingResult {
    const price = toMoney2(supplierPrice, "supplierPrice");
    if (price.lessThanOrEqualTo(0)) {
      throw new ValidationDomainError("supplierPrice must be greater than 0 — zero/negative supplier price is not a valid commercial price");
    }
    if (typeof supplierCurrency !== "string" || supplierCurrency.trim().length === 0 || supplierCurrency.trim().length > 16) {
      throw new ValidationDomainError("supplierCurrency must be a non-empty currency code (max 16 chars)");
    }
    const rate = resolution.rate;
    if (rate.isNegative() || rate.greaterThanOrEqualTo(1)) {
      throw new ValidationDomainError(`markup rate out of contract [0, 1): ${rate.toString()}`);
    }

    const markupAmount = toMoney2(price.mul(rate), "markupAmount");
    const publicPrice = toMoney2(price.plus(markupAmount), "publicPrice");

    return {
      supplierPrice: price,
      supplierCurrency: supplierCurrency.trim(),
      markupRate: rate,
      markupAmount,
      publicPrice,
      markupRuleCode: resolution.ruleCode,
      markupRuleVersion: resolution.ruleVersion,
      configurationState: resolution.state,
      pricingCalculatedAt: new Date(),
    };
  }

  /** Удобство для одиночных boundary-вызовов: resolve + apply. */
  async applyFor(supplierCode: string, serviceType: string, supplierPrice: MoneyInput, supplierCurrency: string): Promise<MarkupPricingResult> {
    const key = validateSupplierCode(supplierCode);
    const svc = validateServiceType(serviceType);
    const resolution = await this.resolve(key, svc);
    return this.apply(resolution, supplierPrice, supplierCurrency);
  }

  // ── Boundary helpers (§9) ──────────────────────────────────────────
  //
  // Единственный способ применить маркап к supplier-shape ответам
  // (search-список / refresh-snapshot / price-calendar). Всегда идемпотентны:
  // объект с уже прикреплённым pricing-блоком возвращается как есть
  // (NO DOUBLE MARKUP, §9). Browse-пути (search/calendar/refresh) используют
  // resolveSafe: сбой чтения правила из БД НЕ роняет выдачу — это не
  // «маскировка сконфигурированного 0%» (§7): состояние помечается
  // NOT_CONFIGURED, поиск идёт с 0%, деньги-входы (Request/sync) на таком
  // resolveSafe НЕ работают — они зовут строгие applyFor/apply.

  /** Fail-open resolve для browse-границ: warn + NOT_CONFIGURED вместо throw. */
  async resolveSafe(supplierCode: string, serviceType: string): Promise<ResolvedMarkup> {
    try {
      return await this.resolve(supplierCode, serviceType);
    } catch (err) {
      this.logger.warn(
        `Markup rule resolution failed for ${supplierCode}/${serviceType} — falling back to NOT_CONFIGURED (0%): ${(err as Error).message}`,
      );
      return { ...NOT_CONFIGURED };
    }
  }

  /** JSON-safe breakdown для HTTP-ответов (никаких Decimal в теле ответа). */
  toPricingJson(result: MarkupPricingResult): MarkupPricingJson {
    return {
      supplierAmount: Number(result.supplierPrice.toString()),
      currency: result.supplierCurrency,
      markupRate: result.markupRate.toString(),
      markupAmount: Number(result.markupAmount.toString()),
      publicAmount: Number(result.publicPrice.toString()),
      markupRuleCode: result.markupRuleCode,
      markupRuleVersion: result.markupRuleVersion,
      configurationState: result.configurationState,
      calculatedAt: result.pricingCalculatedAt.toISOString(),
    };
  }

  /**
   * Оффер из search-списка: price.amount → public, supplier price сохраняется
   * в pricing-блоке. Уже priced-оффер не трогаем (идемпотентность).
   * supplierPrice <= 0 / пустая валюта → apply() бросает (Gate E, fail-closed).
   */
  async applyToOffer(
    offer: SupplierOffer,
    supplierCode: string,
    serviceType: string,
    resolution?: ResolvedMarkup,
  ): Promise<SupplierOffer> {
    if (offer.pricing) return offer;
    const res = resolution ?? (await this.resolveSafe(supplierCode, serviceType));
    const pricing = this.apply(res, offer.price.amount, offer.price.currency);
    return {
      ...offer,
      price: { ...offer.price, amount: Number(pricing.publicPrice.toString()) },
      pricing: this.toPricingJson(pricing),
    };
  }

  /** Весь список одним resolve (один поиск = один DB-lookup на supplier). */
  async applyToOffers(
    offers: SupplierOffer[],
    supplierCode: string,
    serviceType: string,
  ): Promise<SupplierOffer[]> {
    if (offers.length === 0) return offers;
    const resolution = await this.resolveSafe(supplierCode, serviceType);
    const out: SupplierOffer[] = [];
    for (const offer of offers) {
      out.push(await this.applyToOffer(offer, supplierCode, serviceType, resolution));
    }
    return out;
  }

  /**
   * Re-check snapshot (refreshPrice / captcha-resume): amount → public,
   * сырой supplier amount — в pricing-блоке. amount <= 0 → Gate E throw.
   */
  async applyToPriceSnapshot(
    snapshot: SupplierPriceSnapshot,
    supplierCode: string,
    serviceType: string,
  ): Promise<SupplierPriceSnapshot> {
    if (snapshot.pricing) return snapshot;
    const resolution = await this.resolveSafe(supplierCode, serviceType);
    const pricing = this.apply(resolution, snapshot.amount, snapshot.currency);
    return {
      ...snapshot,
      amount: Number(pricing.publicPrice.toString()),
      pricing: this.toPricingJson(pricing),
    };
  }

  /**
   * Price calendar: каждый offer-entry и сам entry.price считаются из
   * supplier-минимума ОДНИМ resolution (rate одинаков — монотонность
   * сохраняет argmin). entry.price === null (нет цены) — пропускается.
   */
  async applyToCalendar(
    result: PriceCalendarResult,
    supplierCode: string,
    serviceType: string,
  ): Promise<PriceCalendarResult> {
    const resolution = await this.resolveSafe(supplierCode, serviceType);
    const entries: PriceCalendarEntry[] = [];
    for (const entry of result.entries) {
      if (entry.pricing) {
        entries.push(entry);
        continue;
      }
      let next: PriceCalendarEntry = entry;
      if (entry.offers?.length) {
        const offers = [];
        for (const o of entry.offers) {
          if (o.pricing) {
            offers.push(o);
            continue;
          }
          const p = this.apply(resolution, o.price, o.currency);
          offers.push({
            ...o,
            price: Number(p.publicPrice.toString()),
            pricing: this.toPricingJson(p),
          });
        }
        next = { ...next, offers };
      }
      if (typeof entry.price === "number" && entry.price !== null) {
        if (!entry.currency) {
          // Прайс без валюты не может быть деньгами (Gate E spirit) — не трогаем.
          this.logger.warn(
            `Calendar entry ${entry.date} of ${supplierCode} has a price without currency — left unpriced`,
          );
        } else {
          const p = this.apply(resolution, entry.price, entry.currency);
          next = {
            ...next,
            price: Number(p.publicPrice.toString()),
            pricing: this.toPricingJson(p),
          };
        }
      }
      entries.push(next);
    }
    return { ...result, entries };
  }

  /**
   * Sync/catalog-запись (Tariff/startingPrice): public-цена как число.
   * Строгий путь (applyFor) — сбой правила роняет sync, а не пишет
   * незамаркапленную цену в каталог.
   */
  async publicAmountFor(
    supplierPrice: MoneyInput,
    supplierCurrency: string,
    supplierCode: string,
    serviceType: string,
  ): Promise<number> {
    const pricing = await this.applyFor(supplierCode, serviceType, supplierPrice, supplierCurrency);
    return Number(pricing.publicPrice.toString());
  }
}
