/**
 * Supplier Markup (STRICT PROMPT Phase 1 §29/§30) — SupplierPricingService tests.
 *
 * Обязательный тест-матрица (§30):
 *  - Calculation: 1000 × 5% = 50 → public 1050;
 *  - NOT_CONFIGURED vs configured 0% (различимы, оба дают rate 0);
 *  - NO DOUBLE MARKUP — apply() считает только из supplier price (границы
 *    фазы 2 докажут «1050 не становится 1102.50»);
 *  - Gate E: supplierPrice 0 / negative / missing / NaN → REJECT;
 *  - currency pass-through (без FX, §22);
 *  - half-up округление через sales.money (единая money-математика, §8).
 */
import { Prisma } from "../../generated/prisma/client";
import { ValidationDomainError } from "../../shared/errors";
import { MarkupRuleService } from "./markup-rule.service";
import { NOT_CONFIGURED, SupplierPricingService } from "./supplier-pricing.service";
import type {
  PriceCalendarResult,
  SupplierOffer,
  SupplierPriceSnapshot,
} from "../supplier/supplier.types";

function makePricing(findMock?: jest.Mock): SupplierPricingService {
  const ruleService = {
    resolve: findMock ?? jest.fn().mockResolvedValue({ found: false }),
  } as unknown as MarkupRuleService;
  return new SupplierPricingService(ruleService);
}

function configured(rate: string, ruleCode = "MKR-00000001", ruleVersion = 1) {
  return { state: "CONFIGURED" as const, rate: new Prisma.Decimal(rate), ruleCode, ruleVersion };
}

describe("SupplierPricingService (Supplier Markup Phase 1)", () => {
  describe("calculation (§2/§10)", () => {
    it("1000 × 5% → markup 50 → public 1050", () => {
      const res = makePricing().apply(configured("0.05"), "1000", "USD");
      expect(res.markupAmount.toString()).toBe("50");
      expect(res.publicPrice.toString()).toBe("1050");
      expect(res.supplierPrice.toString()).toBe("1000");
      expect(res.markupRate.toString()).toBe("0.05");
      expect(res.configurationState).toBe("CONFIGURED");
      expect(res.markupRuleCode).toBe("MKR-00000001");
      expect(res.markupRuleVersion).toBe(1);
      expect(res.supplierCurrency).toBe("USD");
      expect(res.pricingCalculatedAt).toBeInstanceOf(Date);
    });

    it("NO DOUBLE MARKUP: apply() derives ONLY from the given supplier price", () => {
      const svc = makePricing();
      const first = svc.apply(configured("0.05"), "1000", "USD");
      // Граница фазы 2 обязана пробросить first (как есть), а НЕ повторить apply:
      expect(first.publicPrice.toString()).toBe("1050");
      expect(first.markupAmount.toString()).toBe("50");
      // Повторный apply от исходной supplier price — тот же результат (идемпотентность
      // функции), а НЕ 1102.50: 1102.50 возникает только при apply(publicPrice).
      const again = svc.apply(configured("0.05"), "1000", "USD");
      expect(again.publicPrice.toString()).toBe("1050");
      // Контракт границ (фаза 2): apply(publicPrice) дал бы 1102.50 — именно
      // ЭТО не должно происходить в потоке: границы пробрасывают pricing-блок
      // как есть и НЕ пересчитывают публичную цену вторым apply.
      const doubleApplied = svc.apply(configured("0.05"), "1050", "USD");
      expect(doubleApplied.publicPrice.toString()).toBe("1102.5"); // ← запрещённый путь
    });

    it("NOT_CONFIGURED → effective 0% (state distinguishable)", () => {
      const res = makePricing().apply({ ...NOT_CONFIGURED }, "1000", "USD");
      expect(res.configurationState).toBe("NOT_CONFIGURED");
      expect(res.markupRate.toString()).toBe("0");
      expect(res.markupAmount.toString()).toBe("0");
      expect(res.publicPrice.toString()).toBe("1000");
      expect(res.markupRuleCode).toBeNull();
      expect(res.markupRuleVersion).toBeNull();
    });

    it("explicit configured 0% → state CONFIGURED with rule identity", () => {
      const res = makePricing().apply(configured("0"), "1000", "USD");
      expect(res.configurationState).toBe("CONFIGURED");
      expect(res.markupRate.toString()).toBe("0");
      expect(res.publicPrice.toString()).toBe("1000");
      expect(res.markupRuleCode).toBe("MKR-00000001");
    });

    it("half-up rounding via sales.money: 999.99 × 5% → 50.00 → 1049.99", () => {
      const res = makePricing().apply(configured("0.05"), "999.99", "EUR");
      expect(res.markupAmount.toString()).toBe("50"); // 49.9995 → half-up
      expect(res.publicPrice.toString()).toBe("1049.99");
    });

    it("rate 7% (0.07): 1000 → markup 70 → 1070", () => {
      const res = makePricing().apply(configured("0.07"), "1000", "RUB");
      expect(res.publicPrice.toString()).toBe("1070");
    });
  });

  describe("Gate E — invalid supplier price never becomes commercial money (§12)", () => {
    const svc = makePricing();
    it.each(["0", "0.00", "-1", "-0.01"])("rejects supplierPrice %j", (price) => {
      expect(() => svc.apply(configured("0.05"), price, "USD")).toThrow(ValidationDomainError);
    });
    it("rejects non-numeric supplierPrice (NaN/abc/garbage)", () => {
      for (const price of ["abc", "NaN", "Infinity", ""]) {
        expect(() => svc.apply(configured("0.05"), price, "USD")).toThrow(ValidationDomainError);
      }
    });
    it("rejects overflow above DECIMAL(12,2) (422, не raw 500)", () => {
      expect(() => svc.apply(configured("0.05"), "99999999999.99", "USD")).toThrow(ValidationDomainError);
    });
    it("rejects missing/empty currency", () => {
      for (const currency of ["", "   "]) {
        expect(() => svc.apply(configured("0.05"), "1000", currency)).toThrow(ValidationDomainError);
      }
    });
    it("rejects out-of-contract rate (defense-in-depth)", () => {
      expect(() => svc.apply({ state: "CONFIGURED", rate: new Prisma.Decimal("-0.01"), ruleCode: "X", ruleVersion: 1 }, "1000", "USD")).toThrow(ValidationDomainError);
      expect(() => svc.apply({ state: "CONFIGURED", rate: new Prisma.Decimal("1.5"), ruleCode: "X", ruleVersion: 1 }, "1000", "USD")).toThrow(ValidationDomainError);
    });
  });

  describe("currency (§22 — no FX)", () => {
    it("markup calculated in supplier currency, public price same currency", () => {
      const res = makePricing().apply(configured("0.05"), "1000", "AZN");
      expect(res.supplierCurrency).toBe("AZN");
      expect(res.publicPrice.toString()).toBe("1050"); // сумма той же валюты
    });
  });

  describe("resolve/applyFor wiring", () => {
    it("resolve: MarkupRuleService.found=false → NOT_CONFIGURED ResolvedMarkup", async () => {
      const findMock = jest.fn().mockResolvedValue({ found: false });
      const res = await makePricing(findMock).resolve("SUMMERTOUR", "tours");
      expect(res.state).toBe("NOT_CONFIGURED");
      expect(res.rate.toString()).toBe("0");
      expect(findMock).toHaveBeenCalledWith("SUMMERTOUR", "tours", expect.any(Date));
    });
    it("resolve: found → CONFIGURED with rate/code/version", async () => {
      const findMock = jest.fn().mockResolvedValue({ found: true, rate: new Prisma.Decimal("0.050000"), ruleCode: "MKR-00000007", ruleVersion: 3 });
      const res = await makePricing(findMock).resolve("AZAL", "flights");
      expect(res).toMatchObject({ state: "CONFIGURED", ruleCode: "MKR-00000007", ruleVersion: 3 });
      expect(res.rate.toString()).toBe("0.05");
    });
    it("applyFor = resolve + apply", async () => {
      const findMock = jest.fn().mockResolvedValue({ found: true, rate: new Prisma.Decimal("0.050000"), ruleCode: "MKR-00000001", ruleVersion: 1 });
      const res = await makePricing(findMock).applyFor("SUMMERTOUR", "tours", "2000", "USD");
      expect(res.publicPrice.toString()).toBe("2100");
      expect(res.configurationState).toBe("CONFIGURED");
    });
    it("applyFor validates key syntax", async () => {
      await expect(makePricing().applyFor("BAD CODE", "tours", "1000", "USD")).rejects.toThrow(ValidationDomainError);
      await expect(makePricing().applyFor("SUMMERTOUR", "Tours", "1000", "USD")).rejects.toThrow(ValidationDomainError);
    });
  });
});

// ── Phase 2 boundary helpers (§9) ────────────────────────────────────────

function makeOffer(overrides: Partial<SupplierOffer> = {}): SupplierOffer {
  return {
    supplierCode: "SUMMERTOUR",
    externalOfferId: "OFF-1",
    hotel: "Himeros Beach",
    departureDate: "2026-09-19",
    nights: 7,
    adults: 2,
    children: 0,
    childAges: [],
    price: {
      amount: 1000,
      currency: "USD",
      fetchedAt: new Date(),
      expiresAt: new Date(),
      queryHash: "h",
      source: "SUMMERTOUR",
    },
    availability: "AVAILABLE",
    fetchedAt: new Date(),
    expiresAt: new Date(),
    ...overrides,
  };
}

function makeSnapshot(overrides: Partial<SupplierPriceSnapshot> = {}): SupplierPriceSnapshot {
  return {
    amount: 1000,
    currency: "USD",
    fetchedAt: new Date(),
    expiresAt: new Date(),
    queryHash: "h",
    source: "SUMMERTOUR",
    ...overrides,
  };
}

function makeCalendar(): PriceCalendarResult {
  return {
    supplierCode: "SUMMERTOUR",
    contextHash: "ctx",
    dateFrom: "2026-09-19",
    dateTo: "2026-09-26",
    fetchedAt: new Date(),
    expiresAt: new Date(),
    totalOffersScanned: 3,
    entries: [
      {
        date: "2026-09-19",
        price: 1000,
        currency: "USD",
        availability: "AVAILABLE",
        offerCount: 1,
        offers: [
          {
            tourIncValue: "254",
            externalOfferId: "E1",
            hotel: "Himeros Beach",
            departureDate: "2026-09-19",
            nights: 7,
            adults: 2,
            children: 0,
            childAges: [],
            availability: "AVAILABLE",
            price: 1000,
            currency: "USD",
          },
        ],
      },
      { date: "2026-09-20", price: null, currency: null, availability: "AVAILABLE", offerCount: 0 },
      // Price WITHOUT currency — must be left unpriced (Gate E spirit).
      { date: "2026-09-21", price: 500, currency: null, availability: "AVAILABLE", offerCount: 1 },
    ],
  };
}

describe("SupplierPricingService — Phase 2 boundary helpers (§9)", () => {
  it("applyToOffer: public price + §20 pricing block", async () => {
    const findMock = jest.fn().mockResolvedValue({ found: true, rate: new Prisma.Decimal("0.05"), ruleCode: "MKR-00000001", ruleVersion: 1 });
    const out = await makePricing(findMock).applyToOffer(makeOffer(), "SUMMERTOUR", "tours");
    expect(out.price.amount).toBe(1050);
    expect(out.pricing).toMatchObject({
      supplierAmount: 1000,
      currency: "USD",
      markupRate: "0.05",
      markupAmount: 50,
      publicAmount: 1050,
      configurationState: "CONFIGURED",
      markupRuleCode: "MKR-00000001",
      markupRuleVersion: 1,
    });
    expect(typeof out.pricing!.calculatedAt).toBe("string");
    expect(findMock).toHaveBeenCalledTimes(1);
  });

  it("applyToOffer: already-priced offer passes through unchanged (NO DOUBLE MARKUP)", async () => {
    const findMock = jest.fn().mockResolvedValue({ found: false });
    const pricingSvc = makePricing(findMock);
    const priced = await pricingSvc.applyToOffer(makeOffer(), "SUMMERTOUR", "tours");
    expect(priced.price.amount).toBe(1000); // NOT_CONFIGURED → 0%
    const again = await pricingSvc.applyToOffer(priced, "SUMMERTOUR", "tours");
    expect(again).toBe(priced); // same object, no re-apply
    expect(again.price.amount).toBe(1000);
    expect(findMock).toHaveBeenCalledTimes(1); // second call skipped resolve entirely
  });

  it("applyToOffers: ONE resolve for the whole list; empty list resolves nothing", async () => {
    const findMock = jest.fn().mockResolvedValue({ found: true, rate: new Prisma.Decimal("0.05"), ruleCode: "MKR-00000001", ruleVersion: 1 });
    const svc = makePricing(findMock);
    const out = await svc.applyToOffers([makeOffer({ externalOfferId: "A" }), makeOffer({ externalOfferId: "B" })], "SUMMERTOUR", "tours");
    expect(out.map((o) => o.price.amount)).toEqual([1050, 1050]);
    expect(findMock).toHaveBeenCalledTimes(1);
    const none = await svc.applyToOffers([], "SUMMERTOUR", "tours");
    expect(none).toEqual([]);
    expect(findMock).toHaveBeenCalledTimes(1);
  });

  it("applyToOffers: pre-priced entries in the list are not re-marked (NO DOUBLE MARKUP)", async () => {
    const findMock = jest.fn().mockResolvedValue({ found: true, rate: new Prisma.Decimal("0.05"), ruleCode: "MKR-00000001", ruleVersion: 1 });
    const svc = makePricing(findMock);
    const first = await svc.applyToOffers([makeOffer()], "SUMMERTOUR", "tours");
    expect(first[0].price.amount).toBe(1050);
    const second = await svc.applyToOffers(first, "SUMMERTOUR", "tours");
    expect(second[0].price.amount).toBe(1050); // NOT 1102.50
    expect(second[0].pricing!.supplierAmount).toBe(1000);
  });

  it("resolveSafe: rule lookup failure falls back to NOT_CONFIGURED instead of throwing", async () => {
    const findMock = jest.fn().mockRejectedValue(new Error("db down"));
    const res = await makePricing(findMock).resolveSafe("SUMMERTOUR", "tours");
    expect(res.state).toBe("NOT_CONFIGURED");
    expect(res.rate.toString()).toBe("0");
  });

  it("applyToOffers: browse path survives rule failure (0%, offer still returned)", async () => {
    const findMock = jest.fn().mockRejectedValue(new Error("db down"));
    const out = await makePricing(findMock).applyToOffers([makeOffer()], "SUMMERTOUR", "tours");
    expect(out).toHaveLength(1);
    expect(out[0].price.amount).toBe(1000);
    expect(out[0].pricing!.configurationState).toBe("NOT_CONFIGURED");
  });

  it("applyToPriceSnapshot: amount → public, raw preserved; pre-priced passes through", async () => {
    const findMock = jest.fn().mockResolvedValue({ found: true, rate: new Prisma.Decimal("0.05"), ruleCode: "MKR-00000001", ruleVersion: 1 });
    const svc = makePricing(findMock);
    const out = await svc.applyToPriceSnapshot(makeSnapshot(), "SUMMERTOUR", "tours");
    expect(out.amount).toBe(1050);
    expect(out.pricing!.supplierAmount).toBe(1000);
    const again = await svc.applyToPriceSnapshot(out, "SUMMERTOUR", "tours");
    expect(again).toBe(out);
    expect(again.amount).toBe(1050);
  });

  it("applyToPriceSnapshot: zero supplier amount is never commercial money (Gate E)", async () => {
    const svc = makePricing();
    await expect(svc.applyToPriceSnapshot(makeSnapshot({ amount: 0 }), "SUMMERTOUR", "tours")).rejects.toThrow(ValidationDomainError);
  });

  it("applyToPriceSnapshot: negative supplier amount is rejected (Gate E)", async () => {
    const svc = makePricing();
    await expect(svc.applyToPriceSnapshot(makeSnapshot({ amount: -100 }), "SUMMERTOUR", "tours")).rejects.toThrow(ValidationDomainError);
  });

  it("applyToCalendar: entry price + offers priced with ONE resolution; absences untouched", async () => {
    const findMock = jest.fn().mockResolvedValue({ found: true, rate: new Prisma.Decimal("0.05"), ruleCode: "MKR-00000001", ruleVersion: 1 });
    const out = await makePricing(findMock).applyToCalendar(makeCalendar(), "SUMMERTOUR", "tours");
    expect(findMock).toHaveBeenCalledTimes(1);

    const dated = out.entries[0];
    expect(dated.price).toBe(1050);
    expect(dated.pricing).toMatchObject({ supplierAmount: 1000, publicAmount: 1050, markupAmount: 50 });
    expect(dated.offers![0].price).toBe(1050);
    expect(dated.offers![0].pricing!.supplierAmount).toBe(1000);

    // No offers → no price → untouched.
    const absent = out.entries[1];
    expect(absent.price).toBeNull();
    expect(absent.pricing).toBeUndefined();

    // Price without currency → left unpriced (warn), not silently promoted to money.
    const noCurrency = out.entries[2];
    expect(noCurrency.price).toBe(500);
    expect(noCurrency.pricing).toBeUndefined();
  });

  it("applyToCalendar: idempotent on re-entry (NO DOUBLE MARKUP)", async () => {
    const findMock = jest.fn().mockResolvedValue({ found: true, rate: new Prisma.Decimal("0.05"), ruleCode: "MKR-00000001", ruleVersion: 1 });
    const svc = makePricing(findMock);
    const once = await svc.applyToCalendar(makeCalendar(), "SUMMERTOUR", "tours");
    const twice = await svc.applyToCalendar(once, "SUMMERTOUR", "tours");
    expect(twice.entries[0].price).toBe(1050); // NOT 1102.50
    expect(twice.entries[0].offers![0].price).toBe(1050);
    expect(twice.entries[0].pricing!.supplierAmount).toBe(1000);
  });

  it("publicAmountFor: strict path — rule failure rejects (sync must not write raw price)", async () => {
    const findMock = jest.fn().mockRejectedValue(new Error("db down"));
    await expect(makePricing(findMock).publicAmountFor(1000, "USD", "SUMMERTOUR", "tours")).rejects.toThrow("db down");
  });

  it("publicAmountFor: configured 5% → 1050", async () => {
    const findMock = jest.fn().mockResolvedValue({ found: true, rate: new Prisma.Decimal("0.05"), ruleCode: "MKR-00000001", ruleVersion: 1 });
    const amount = await makePricing(findMock).publicAmountFor(1000, "USD", "SUMMERTOUR", "tours");
    expect(amount).toBe(1050);
  });

  it("automatic matrix expansion: any (supplier, service) pair resolves without code changes", async () => {
    const findMock = jest.fn().mockResolvedValue({ found: true, rate: new Prisma.Decimal("0.1"), ruleCode: "MKR-00000009", ruleVersion: 2 });
    const svc = makePricing(findMock);

    // A supplier/service combination the boundary has never seen before.
    const out = await svc.applyToOffers([makeOffer({ supplierCode: "KAZUNION" })], "KAZUNION", "hotels");
    expect(findMock).toHaveBeenCalledWith("KAZUNION", "hotels", expect.any(Date));
    expect(out[0].price.amount).toBe(1100);
    expect(out[0].pricing).toMatchObject({ supplierAmount: 1000, markupAmount: 100, publicAmount: 1100, markupRuleCode: "MKR-00000009" });
  });
});

// ── UNIFIED FINANCE CENTER Phase 1 — FX (convert-then-markup) ────────────────

function makePricingWithFx(
  findMock: jest.Mock,
  resolveFx: jest.Mock,
): SupplierPricingService {
  const ruleService = {
    resolve: findMock ?? jest.fn().mockResolvedValue({ found: false }),
  } as unknown as MarkupRuleService;
  const fxRates = { resolveSafe: resolveFx } as never;
  return new SupplierPricingService(ruleService, fxRates);
}

const FX_USD = { rate: new Prisma.Decimal("1.70"), rateCode: "SFX-00000001" };

describe("SupplierPricingService — FX convert-then-markup (Phase 1)", () => {
  const configured5 = jest.fn().mockResolvedValue({
    found: true,
    rate: new Prisma.Decimal("0.05"),
    ruleCode: "MKR-00000001",
    ruleVersion: 1,
  });

  beforeEach(() => configured5.mockClear());

  it("applyWithFx: 1000 USD × 1.70 → 1700 AZN, then 5% → public 1785 AZN; SOURCE preserved in fx", () => {
    const svc = makePricingWithFx(configured5, jest.fn());
    const { pricing, fxJson } = svc.applyWithFx(
      { state: "CONFIGURED", rate: new Prisma.Decimal("0.05"), ruleCode: "MKR-00000001", ruleVersion: 1 },
      1000,
      "USD",
      FX_USD,
    );
    expect(pricing.supplierPrice.toString()).toBe("1700"); // AZN cost base
    expect(pricing.supplierCurrency).toBe("AZN");
    expect(pricing.markupAmount.toString()).toBe("85"); // 1700 × 5%
    expect(pricing.publicPrice.toString()).toBe("1785");
    // decimal.js toString срезает хвостовые нули (канон платформы: rate.toString()).
    expect(fxJson).toMatchObject({
      sourceAmount: 1000,
      sourceCurrency: "USD",
      rate: "1.7",
      rateCode: "SFX-00000001",
      aznAmount: 1700,
    });
    expect(fxJson!.convertedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("applyWithFx: fx null → legacy same-currency behaviour (no fx block)", () => {
    const svc = makePricingWithFx(configured5, jest.fn());
    const { pricing, fxJson } = svc.applyWithFx(
      { state: "CONFIGURED", rate: new Prisma.Decimal("0.05"), ruleCode: "MKR-00000001", ruleVersion: 1 },
      1000,
      "USD",
      null,
    );
    expect(pricing.publicPrice.toString()).toBe("1050");
    expect(pricing.supplierCurrency).toBe("USD");
    expect(fxJson).toBeNull();
  });

  it("applyToOffer with fx: price → AZN, currency → AZN, pricing keeps SOURCE + fx block", async () => {
    const svc = makePricingWithFx(configured5, jest.fn().mockResolvedValue(FX_USD));
    const out = await svc.applyToOffer(makeOffer(), "SUMMERTOUR", "tours");
    expect(out.price.amount).toBe(1785);
    expect(out.price.currency).toBe("AZN");
    expect(out.pricing).toMatchObject({
      supplierAmount: 1000, // SOURCE
      currency: "USD", // SOURCE
      publicCurrency: "AZN",
      markupAmount: 85,
      publicAmount: 1785,
      fx: { sourceAmount: 1000, sourceCurrency: "USD", rate: "1.7", aznAmount: 1700 },
    });
  });

  it("applyToOffer without rate (fail-open browse): исходная валюта, fx отсутствует", async () => {
    const svc = makePricingWithFx(configured5, jest.fn().mockResolvedValue(null));
    const out = await svc.applyToOffer(makeOffer(), "SUMMERTOUR", "tours");
    expect(out.price.amount).toBe(1050);
    expect(out.price.currency).toBe("USD");
    expect(out.pricing!.fx).toBeUndefined();
    expect(out.pricing!.publicCurrency).toBeUndefined();
  });

  // §SYNC-FX: catалог хранит И сумму, И валюту; метод обязан вернуть их парой,
  // иначе USD-сумма попадёт в Tariff с меткой AZN (дефект Voyager).
  it("publicAmountWithFxFor: 1000 USD ×1.70 +5% → 1785 AZN (сумма и валюта согласованы)", async () => {
    const svc = makePricingWithFx(configured5, jest.fn().mockResolvedValue(FX_USD));
    await expect(svc.publicAmountWithFxFor(1000, "USD", "VOYAGER", "hotels")).resolves.toEqual({
      amount: 1785,
      currency: "AZN",
    });
  });

  it("publicAmountWithFxFor: нет курса → исходная валюта и сумма (fail-open, без метки AZN)", async () => {
    const svc = makePricingWithFx(configured5, jest.fn().mockResolvedValue(null));
    await expect(svc.publicAmountWithFxFor(1000, "USD", "VOYAGER", "tours")).resolves.toEqual({
      amount: 1050,
      currency: "USD",
    });
  });

  it("publicAmountWithFxFor: AZN-источник → identity без FX, валюта AZN", async () => {
    const fx = jest.fn();
    const svc = makePricingWithFx(configured5, fx);
    await expect(svc.publicAmountWithFxFor(1000, "AZN", "KOMPAS", "hotels")).resolves.toEqual({
      amount: 1050,
      currency: "AZN",
    });
    expect(fx).not.toHaveBeenCalled();
  });

  it("publicAmountWithFxFor: сбой правила → sync падает, а не пишет 0%", async () => {
    const svc = makePricingWithFx(jest.fn().mockRejectedValue(new Error("db down")), jest.fn());
    await expect(svc.publicAmountWithFxFor(1000, "USD", "VOYAGER", "hotels")).rejects.toThrow("db down");
  });

  it("applyToPriceSnapshot with fx: amount → AZN", async () => {
    const svc = makePricingWithFx(configured5, jest.fn().mockResolvedValue(FX_USD));
    const out = await svc.applyToPriceSnapshot(makeSnapshot(), "SUMMERTOUR", "tours");
    expect(out.amount).toBe(1785);
    expect(out.currency).toBe("AZN");
    expect(out.pricing!.fx!.aznAmount).toBe(1700);
  });

  it("applyToOffers: FX lookup once per distinct source currency", async () => {
    const resolveFx = jest.fn().mockResolvedValue(FX_USD);
    const svc = makePricingWithFx(configured5, resolveFx);
    await svc.applyToOffers(
      [makeOffer({ externalOfferId: "A" }), makeOffer({ externalOfferId: "B" })],
      "SUMMERTOUR",
      "tours",
    );
    expect(resolveFx).toHaveBeenCalledTimes(1);
    expect(resolveFx).toHaveBeenCalledWith("SUMMERTOUR", "USD");
  });

  it("AZN-источник: fx-resolver не вызывается (identity без lookup)", async () => {
    const resolveFx = jest.fn();
    const svc = makePricingWithFx(configured5, resolveFx);
    const out = await svc.applyToOffer(
      makeOffer({ price: { ...makeOffer().price, currency: "AZN" } }),
      "SUMMERTOUR",
      "tours",
    );
    expect(resolveFx).not.toHaveBeenCalled();
    expect(out.price.amount).toBe(1050);
    expect(out.price.currency).toBe("AZN");
  });

  it("assertFxPresentForMoney: AZN-блок проходит; USD без fx → controlled error", () => {
    const aznBlock = { currency: "AZN", publicAmount: 1050 } as never;
    expect(() => SupplierPricingService.assertFxPresentForMoney(aznBlock, "KOMPAS")).not.toThrow();

    const usdNoFx = { currency: "USD", publicAmount: 1050 } as never;
    expect(() => SupplierPricingService.assertFxPresentForMoney(usdNoFx, "KOMPAS")).toThrow(/missing FX rate/);

    const usdWithFx = {
      currency: "USD",
      publicAmount: 1785,
      fx: { sourceAmount: 1000, sourceCurrency: "USD", rate: "1.7", rateCode: null, aznAmount: 1700, convertedAt: "2026-10-10T00:00:00Z" },
    } as never;
    expect(() => SupplierPricingService.assertFxPresentForMoney(usdWithFx, "KOMPAS")).not.toThrow();

    // Нет pricing-блока — Gate E snapshot-билдера отвечает отдельно.
    expect(() => SupplierPricingService.assertFxPresentForMoney(null, "KOMPAS")).not.toThrow();
  });

  it("toPricingJson с fx: SOURCE-факты поверх AZN-результата", () => {
    const svc = makePricingWithFx(configured5, jest.fn());
    const { pricing, fxJson } = svc.applyWithFx(
      { state: "CONFIGURED", rate: new Prisma.Decimal("0.05"), ruleCode: "MKR-00000001", ruleVersion: 1 },
      1000,
      "USD",
      FX_USD,
    );
    const json = svc.toPricingJson(pricing, fxJson);
    expect(json).toMatchObject({
      supplierAmount: 1000,
      currency: "USD",
      publicCurrency: "AZN",
      markupAmount: 85,
      publicAmount: 1785,
    });
  });
});
