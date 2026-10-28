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
 * UNIFIED FINANCE CENTER Phase 1 (FX): supplier-specific курсы «1 source = N AZN».
 * Порядок: convert supplier price → AZN, затем apply() markup в AZN
 * (convert-then-markup; markup semantics НЕ меняются — % от cost base, cost base
 * теперь AZN). Browse-границы — fail-open (нет курса → исходная валюта, fx-блок
 * отсутствует, НИКОГДА не подставляется 1); money-пути (snapshot/acceptance)
 * — strict (нет курса → контролируемая ошибка, см. assertFxPresentForMoney).
 * AZN-источник — identity без lookup. Изменение курса не мутирует frozen
 * snapshot'ы (upsert-in-place текущего курса).
 */
import { Inject, Injectable, Logger, Optional } from "@nestjs/common";
import { Prisma } from "../../generated/prisma/client";
import { MoneyInput, toMoney2 } from "../sales/sales.money";
import { SupplierFxRateService } from "../finance/supplier-fx-rate.service";
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

/** UNIFIED FINANCE CENTER Phase 1: минимальный FX-resolver-контракт
 *  (структурно совместим с SupplierFxRateService.resolveSafe). */
export interface FxRateInfo {
  rate: Prisma.Decimal;
  rateCode: string | null;
}
export interface FxRateResolver {
  resolveSafe(supplierCode: string, sourceCurrencyIso: string): Promise<FxRateInfo | null>;
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

  constructor(
    private readonly markupRules: MarkupRuleService,
    /** UNIFIED FINANCE CENTER Phase 1: опциональный FX-resolver (Finance export).
     *  @Inject по КЛАССУ обязателен: FxRateResolver — интерфейс, он стирается
     *  в рантайме, и без явного токена Nest молча инжектил undefined (в проде
     *  не конвертировалось НИЧЕГО). PricingModule уже импортирует FinanceModule
     *  (цикла нет: finance не импортирует pricing). @Optional — только для
     *  совместимости с legacy unit-тестами (ручная конструкция без резолвера
     *  → fail-open no-FX, как раньше). */
    @Optional() @Inject(SupplierFxRateService) private readonly fxRates?: FxRateResolver,
  ) {}
  /** Разовый warn, если browse-путь просит не-AZN без подключённого резолвера. */
  private fxMissingWarned = false;

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

  /** JSON-safe breakdown для HTTP-ответов (никаких Decimal в теле ответа).
   *  fxJson present → supplier-факты перекрываются SOURCE-значениями, public
   *  цепочка остаётся в AZN (publicCurrency = "AZN"), fx-блок прикладывается. */
  toPricingJson(result: MarkupPricingResult, fxJson?: MarkupPricingJson["fx"] | null): MarkupPricingJson {
    const base: MarkupPricingJson = {
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
    if (fxJson) {
      return {
        ...base,
        // SOURCE-факты (immutable) поверх AZN-результата apply():
        supplierAmount: fxJson.sourceAmount,
        currency: fxJson.sourceCurrency,
        publicCurrency: "AZN",
        fx: fxJson,
      };
    }
    return base;
  }

  // ── FX (UNIFIED FINANCE CENTER Phase 1) ─────────────────────────────────

  /** Fail-open FX resolve (browse): курса нет → null (исходная валюта).
   *  AZN-источник / fx-resolver не подключён → null (без конвертации).
   *  Публичный: используется azal-границей (fares/prices) напрямую. */
  async resolveFxSafe(supplierCode: string, currency: string): Promise<FxRateInfo | null> {
    if (!this.fxRates) {
      if (typeof currency === "string" && currency.trim().toUpperCase() !== "AZN" && !this.fxMissingWarned) {
        this.fxMissingWarned = true;
        this.logger.error(
          `FX resolver is NOT wired (SupplierFxRateService not injected) — ${supplierCode}/${currency} left unconverted. ` +
            `Проверьте @Inject в SupplierPricingService: молчаливый undefined отключает ВСЮ конвертацию в AZN.`,
        );
      }
      return null;
    }
    if (typeof currency !== "string" || currency.trim().toUpperCase() === "AZN") return null;
    try {
      return await this.fxRates.resolveSafe(supplierCode, currency.trim());
    } catch (err) {
      this.logger.warn(
        `FX resolve failed for ${supplierCode}/${currency} — falling back to no conversion: ${(err as Error).message}`,
      );
      return null;
    }
  }

  /**
   * Convert-then-markup (Phase 1): fx present → supplier price × rate → AZN
   * (half-up 2dp), затем apply() markup в AZN. fx absent → легаси-поведение
   * (markup в исходной валюте, §22). Чистая функция от (resolution, amount,
   * currency, fx) — без БД.
   */
  applyWithFx(
    resolution: ResolvedMarkup,
    sourceAmount: MoneyInput,
    sourceCurrency: string,
    fx: FxRateInfo | null,
  ): { pricing: MarkupPricingResult; fxJson: MarkupPricingJson["fx"] | null } {
    if (fx == null) {
      return { pricing: this.apply(resolution, sourceAmount, sourceCurrency), fxJson: null };
    }
    const source = toMoney2(sourceAmount, "fx.sourceAmount");
    const aznAmount = toMoney2(source.mul(fx.rate), "fx.aznAmount");
    const pricing = this.apply(resolution, aznAmount, "AZN");
    return {
      pricing,
      fxJson: {
        sourceAmount: Number(source.toString()),
        sourceCurrency,
        rate: fx.rate.toString(),
        rateCode: fx.rateCode,
        aznAmount: Number(aznAmount.toString()),
        convertedAt: new Date().toISOString(),
      },
    };
  }

  /**
   * Money-пути (request creation / acceptance): pricing-блок с валютой ≠ AZN
   * обязан нести fx-блок (convert уже применён на boundary). Нет fx →
   * контролируемая ошибка (никогда silent-substitute 1 или чужой курс).
   * AZN-блок / отсутствие pricing (нет supplier-цены) — пропуск (Gate E
   * snapshot-билдера отдельно отвечает за missing price).
   */
  static assertFxPresentForMoney(pricing: MarkupPricingJson | null | undefined, supplierCode: string): void {
    if (pricing == null) return;
    const currency = typeof pricing.currency === "string" ? pricing.currency.trim().toUpperCase() : "";
    if (currency === "" || currency === "AZN") return;
    if (!pricing.fx) {
      throw new ValidationDomainError(
        `missing FX rate: supplier "${supplierCode}" price is in ${pricing.currency} but no FX conversion to AZN was applied — configure a SupplierFxRate for this supplier before accepting the price commercially (never substitute 1 or another supplier's rate)`,
      );
    }
  }

  /**
   * Оффер из search-списка: price.amount → public, supplier price сохраняется
   * в pricing-блоке. Уже priced-оффер не трогаем (идемпотентность).
   * supplierPrice <= 0 / пустая валюта → apply() бросает (Gate E, fail-closed).
   * Phase 1 FX: курс поставщика есть → convert-then-markup (price → AZN);
   * нет → легаси (исходная валюта, fail-open browse).
   */
  async applyToOffer(
    offer: SupplierOffer,
    supplierCode: string,
    serviceType: string,
    resolution?: ResolvedMarkup,
    fxOverride?: FxRateInfo | null,
  ): Promise<SupplierOffer> {
    if (offer.pricing) return offer;
    const res = resolution ?? (await this.resolveSafe(supplierCode, serviceType));
    const fx = fxOverride !== undefined ? fxOverride : await this.resolveFxSafe(supplierCode, offer.price.currency);
    const { pricing, fxJson } = this.applyWithFx(res, offer.price.amount, offer.price.currency, fx);
    return {
      ...offer,
      price: {
        ...offer.price,
        amount: Number(pricing.publicPrice.toString()),
        currency: fxJson ? "AZN" : offer.price.currency,
      },
      pricing: this.toPricingJson(pricing, fxJson),
    };
  }

  /** Весь список одним resolve (один поиск = один DB-lookup на supplier).
   *  FX — один lookup на distinct source-currency списка (кэш в Map). */
  async applyToOffers(
    offers: SupplierOffer[],
    supplierCode: string,
    serviceType: string,
  ): Promise<SupplierOffer[]> {
    if (offers.length === 0) return offers;
    const resolution = await this.resolveSafe(supplierCode, serviceType);
    const fxByCurrency = new Map<string, FxRateInfo | null>();
    for (const offer of offers) {
      const cur = offer.price.currency;
      if (!fxByCurrency.has(cur)) {
        fxByCurrency.set(cur, await this.resolveFxSafe(supplierCode, cur));
      }
    }
    const out: SupplierOffer[] = [];
    for (const offer of offers) {
      out.push(await this.applyToOffer(offer, supplierCode, serviceType, resolution, fxByCurrency.get(offer.price.currency) ?? null));
    }
    return out;
  }

  /**
   * Re-check snapshot (refreshPrice / captcha-resume): amount → public,
   * сырой supplier amount — в pricing-блоке. amount <= 0 → Gate E throw.
   * Phase 1 FX: курс есть → convert-then-markup (amount → AZN, currency → AZN).
   */
  async applyToPriceSnapshot(
    snapshot: SupplierPriceSnapshot,
    supplierCode: string,
    serviceType: string,
  ): Promise<SupplierPriceSnapshot> {
    if (snapshot.pricing) return snapshot;
    const resolution = await this.resolveSafe(supplierCode, serviceType);
    const fx = await this.resolveFxSafe(supplierCode, snapshot.currency);
    const { pricing, fxJson } = this.applyWithFx(resolution, snapshot.amount, snapshot.currency, fx);
    return {
      ...snapshot,
      amount: Number(pricing.publicPrice.toString()),
      currency: fxJson ? "AZN" : snapshot.currency,
      pricing: this.toPricingJson(pricing, fxJson),
    };
  }

  /**
   * Price calendar: каждый offer-entry и сам entry.price считаются из
   * supplier-минимума ОДНИМ resolution (rate одинаков — монотонность
   * сохраняет argmin). entry.price === null (нет цены) — пропускается.
   * Phase 1 FX: FX-resolve один на distinct currency (Map-кэш), convert-then-markup.
   */
  async applyToCalendar(
    result: PriceCalendarResult,
    supplierCode: string,
    serviceType: string,
  ): Promise<PriceCalendarResult> {
    const resolution = await this.resolveSafe(supplierCode, serviceType);
    const fxByCurrency = new Map<string, FxRateInfo | null>();
    const fxFor = async (currency: string | undefined | null): Promise<FxRateInfo | null> => {
      if (!currency) return null;
      if (!fxByCurrency.has(currency)) {
        fxByCurrency.set(currency, await this.resolveFxSafe(supplierCode, currency));
      }
      return fxByCurrency.get(currency) ?? null;
    };
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
          const fx = await fxFor(o.currency);
          const { pricing, fxJson } = this.applyWithFx(resolution, o.price, o.currency, fx);
          offers.push({
            ...o,
            price: Number(pricing.publicPrice.toString()),
            currency: fxJson ? "AZN" : o.currency,
            pricing: this.toPricingJson(pricing, fxJson),
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
          const fx = await fxFor(entry.currency);
          const { pricing, fxJson } = this.applyWithFx(resolution, entry.price, entry.currency, fx);
          next = {
            ...next,
            price: Number(pricing.publicPrice.toString()),
            currency: fxJson ? "AZN" : entry.currency,
            pricing: this.toPricingJson(pricing, fxJson),
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
   *
   * ВНИМАНИЕ: НЕ конвертирует валюту. Результат записывается в валюте
   * поставщика — вызывающий обязан сохранить `supplierCurrency` рядом с ценой.
   * Нужна AZN-сумма в каталоге → publicAmountWithFxFor (иначе метка валюты
   * разойдётся с суммой и витрина занизит цену).
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

  /**
   * Sync/catalog-запись С конвертацией: convert-then-markup (Phase 1 FX).
   *
   * Отличие от publicAmountFor: тот возвращает только число и НЕ конвертирует,
   * поэтому вызывающий обязан писать исходную валюту. Если синк хочет писать
   * AZN (Voyager), он обязан взять сумму И валюту из этого метода — иначе
   * USD-сумма попадёт в каталог с меткой "AZN" и витрина занизит цену на
   * величину курса (реальный дефект Voyager до этого метода).
   *
   * Курс есть → amount в AZN, currency = "AZN"; курса нет → исходная валюта
   * (fail-open browse-контракт, без подстановки 1).
   */
  async publicAmountWithFxFor(
    supplierPrice: MoneyInput,
    supplierCurrency: string,
    supplierCode: string,
    serviceType: string,
  ): Promise<{ amount: number; currency: string }> {
    const resolution = await this.resolve(validateSupplierCode(supplierCode), validateServiceType(serviceType));
    const fx = await this.resolveFxSafe(supplierCode, supplierCurrency);
    const { pricing, fxJson } = this.applyWithFx(resolution, supplierPrice, supplierCurrency, fx);
    return {
      amount: Number(pricing.publicPrice.toString()),
      currency: fxJson ? "AZN" : supplierCurrency,
    };
  }
}
