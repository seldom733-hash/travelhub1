import { Body, Controller, Get, HttpCode, HttpException, Logger, Post, Query } from "@nestjs/common";
import { Public } from "../../../security/auth/decorators";
import { AzalAdapter } from "./azal.adapter";
import { AzalLocationsService } from "./azal.locations.service";
import { PrismaService } from "../../../prisma/prisma.service";
import { IdsService } from "../../../shared/ids.service";
import { ReferenceNumberService } from "../../../shared/reference-number.service";
import { FlightSupplierRegistry } from "../flight-supplier.registry";
import { SupplierPricingService } from "../../pricing/supplier-pricing.service";
import type { FxRateInfo, ResolvedMarkup } from "../../pricing/supplier-pricing.service";
import { buildWorkingSnapshot, type CommercialSnapshot } from "../../pricing/commercial-snapshot";
import type { MarkupPricingJson } from "../../pricing/pricing.types";
import type {
  AzalHistogramRequest,
  AzalHistogramResult,
} from "./azal.types";
import type {
  FlightCalendarDay,
  FlightCalendarRequest,
  FlightFare,
  FlightPrice,
  FlightSearchQuery,
} from "./flight.types";

/** Fare/price amounts this boundary is allowed to mark up (Gate E). */
const isSellableAmount = (amount: number | null | undefined, currency: string | null | undefined): amount is number =>
  typeof amount === "number" && amount > 0 && !!currency;

/** One RT-combine breakdown leg (adapters keep per-leg amount+currency). */
interface MixedFareLeg {
  amount: number;
  currency: string;
  base?: number | null;
}

/**
 * Breakdown legs that MUST be converted per-leg: outbound+inbound present,
 * sellable, and in DIFFERENT currencies (same-currency sums are exact and
 * take the legacy single-convert path). Anything else → null (legacy path).
 */
function mixedBreakdownLegs(fare: FlightFare): { outbound: MixedFareLeg; inbound: MixedFareLeg } | null {
  const breakdown = (fare.facilities as { priceBreakdown?: { outbound?: unknown; inbound?: unknown } } | null | undefined)
    ?.priceBreakdown;
  const read = (leg: unknown): MixedFareLeg | null => {
    const l = leg as { amount?: unknown; currency?: unknown; base?: unknown } | null | undefined;
    if (typeof l?.amount !== "number" || l.amount <= 0 || typeof l?.currency !== "string" || !l.currency) return null;
    return {
      amount: l.amount,
      currency: l.currency,
      base: typeof l?.base === "number" ? l.base : null,
    };
  };
  const outbound = read(breakdown?.outbound);
  const inbound = read(breakdown?.inbound);
  if (!outbound || !inbound) return null;
  if (outbound.currency.toUpperCase() === inbound.currency.toUpperCase()) return null;
  return { outbound, inbound };
}

/**
 * AZAL flight API.
 *
 * Search and Calendar expose the supplier-neutral flight contract.
 * Histogram remains an optional AZAL-specific endpoint.
 *
 * Supplier Markup (STRICT PROMPT §16):
 *  - fan-out normalization applies the markup ONCE per fare/day price via
 *    SupplierPricingService (supplier price preserved in the `pricing` block);
 *  - POST /request derives displayedPrice SERVER-SIDE from a fresh re-search
 *    (recent response + TTL, else re-search) — body.price is never trusted.
 */
@Controller("supplier/azal")
export class AzalController {
  private readonly logger = new Logger(AzalController.name);
  /**
   * Recent search responses for the authoritative /request derivation.
   * Keyed by the normalized query; reused while younger than the TTL so a
   * search → «Подать заявка» click does not pay a second supplier round-trip;
   * an older cache forces a re-search (freshness gate).
   */
  private readonly recentSearches = new Map<
    string,
    { at: number; response: { flights?: unknown[] } & Record<string, unknown> }
  >();
  private static readonly RECENT_SEARCH_TTL_MS = 5 * 60_000;

  constructor(
    private readonly azal: AzalAdapter,
    private readonly prisma: PrismaService,
    private readonly ids: IdsService,
    private readonly refNum: ReferenceNumberService,
    private readonly flightRegistry: FlightSupplierRegistry,
    private readonly locations: AzalLocationsService,
    private readonly pricing: SupplierPricingService,
  ) {}

  @Get("locations")
  @Public()
  async directory(@Query("refresh") refresh?: string) {
    return this.locations.getLocations(refresh === "true");
  }

  @Post("search")
  @HttpCode(200)
  @Public()
  async search(@Body() body: FlightSearchQuery) {
    const requestedSupplier = (body.supplier ?? "").trim().toUpperCase();
    const registry = this.flightRegistry.list();
    // "ALL"/absent = every registered supplier; otherwise only the picked one
    // is queried, so the request costs one supplier round-trip instead of two.
    const suppliers =
      requestedSupplier && requestedSupplier !== "ALL"
        ? registry.filter((code) => code.toUpperCase() === requestedSupplier)
        : registry;
    suppliers.forEach(s => this.logger.log(`[FlightSearch] supplier ${s} called for ${body.from}->${body.to} ${body.departureDate}`));
    const results = await Promise.allSettled(
      suppliers.map((code) => this.flightRegistry.get(code).search(body)),
    );

    const successful = results
      .filter((result): result is PromiseFulfilledResult<Awaited<ReturnType<AzalAdapter["search"]>>> => result.status === "fulfilled")
      .map((result) => result.value);

    const failed = results
      .map((result, index) => ({ result, code: suppliers[index] }))
      .filter((item): item is { result: PromiseRejectedResult; code: string } => item.result.status === "rejected");

    for (const failure of failed) {
      this.logger.warn(`[FlightSearch] supplier ${failure.code} failed: ${failure.result.reason}`);
    }

    const flattened = successful.flatMap((result) =>
      result.flights.map((flight) => ({
        ...flight,
        // Stamped here rather than in every adapter so a new supplier only
        // has to report a `source` on its FlightSearchResult.
        source: flight.source ?? result.source,
      })),
    );
    // Markup boundary (§16): fare totals become PUBLIC prices, the supplier
    // price stays in the fare's `pricing` block — applied exactly once here,
    // so /request can reuse the same numbers without double-markup (§9).
    const flights = await this.applyFlightMarkup(flattened);
    const fares = successful.reduce((sum, result) => sum + result.summary.fares, 0);

    const perSupplier = suppliers.map((code, index) => {
      const r = results[index];
      const count = r.status === "fulfilled" ? r.value.summary.flights : 0;
      return `${code} flights=${count}`;
    });
    this.logger.log(
      `[SUPPLIER AGGREGATOR] ${perSupplier.join(" ")} TOTAL flights=${flights.length}`,
    );

    return {
      source: successful.map((result) => result.source).join(",") || "FLIGHTS",
      collectedAt: new Date().toISOString(),
      requested: body,
      summary: {
        optionSets: successful.reduce((sum, result) => sum + result.summary.optionSets, 0),
        flights: flights.length,
        fares,
      },
      flights,
      suppliers: successful.map((result) => ({
        source: result.source,
        summary: result.summary,
      })),
      errors: failed.map((failure) => ({
        source: failure.code,
        message: failure.result.reason instanceof Error
          ? failure.result.reason.message
          : String(failure.result.reason),
      })),
    };
  }

  @Post("request")
  @Public()
  async createRequest(@Body() body: { from: string; to: string; departureDate: string; returnDate?: string; tripType: string; passengers: any; fareFamily: string; price: number; currency: string; segments: any[]; supplierCode?: string }) {
    // Server-authoritative price (§16): body.price is NEVER trusted — the
    // displayed price is re-derived from a fresh search of the same query.
    const authoritative = await this.deriveAuthoritativePrice(body);
    const code = await this.ids.nextCode(null as any, "REQ");
    const commerceSequence = await this.refNum.nextCommerceSequence(null as any);
    const referenceNumber = this.refNum.commerceRequestRef(commerceSequence);
    const now = new Date();
    // Supplier Markup Phase 3 (§20): working commercial snapshot from the
    // matched fare's pricing block; supplier price evidence = response
    // collectedAt, expires with the recent-search TTL (Gate I). No pricing
    // block (unpriced fare) → legacy request (acceptance money-gate only).
    // UNIFIED FINANCE CENTER Phase 1 (strict money-path FX gate): pricing-блок
    // с валютой ≠ AZN обязан нести fx-блок; нет курса → контролируемая ошибка
    // до записи request (AZAL-источники обычно AZN → gate пропускает).
    if (authoritative.pricing) {
      SupplierPricingService.assertFxPresentForMoney(authoritative.pricing, authoritative.supplierCode);
    }
    const commercialSnapshot: CommercialSnapshot | null = authoritative.pricing
      ? buildWorkingSnapshot({
          supplierCode: authoritative.supplierCode,
          serviceType: "flights",
          pricing: authoritative.pricing,
          priceSource: "PUBLIC",
          supplierPriceFetchedAt: authoritative.collectedAt,
          supplierPriceExpiresAt: authoritative.collectedAt
            ? new Date(Date.parse(authoritative.collectedAt) + AzalController.RECENT_SEARCH_TTL_MS)
            : null,
        })
      : null;
    const request = await (this.prisma as any).request.create({
      data: {
        code, commerceSequence, referenceNumber, customerId: null, productId: null, partnerId: null, status: "NEW",
        requestedServiceDate: new Date(body.departureDate), quantity: 1, travelerCount: body.passengers?.adults ?? 1,
        productSnapshot: { type: "FLIGHT", from: body.from, to: body.to, fareFamily: body.fareFamily },
        displayedPrice: authoritative.amount, displayedCurrency: authoritative.currency,
        ...(commercialSnapshot ? { commercialSnapshot: commercialSnapshot as never } : {}),
        confirmedPrice: null, confirmedCurrency: null,
        pinnedRequirements: { ...body, supplierCode: body.supplierCode || "AZAL" },
        supplierResponseDeadline: new Date(now.getTime() + 24*60*60*1000),
      },
    });
    return { id: request.id, code: request.code, referenceNumber: request.referenceNumber, status: request.status };
  }

  @Post("calendar")
  @Public()
  async calendar(@Body() body: FlightCalendarRequest) {
    const result = await this.azal.calendar(body);
    // Markup boundary (§16): per-day min prices become PUBLIC (§9 — the same
    // SupplierPricingService rule the search fan-out uses). Phase 1 FX:
    // курс источника → convert-then-markup (fail-open browse).
    const source = result.source || "AZAL";
    const resolution = await this.pricing.resolveSafe(source, "flights");
    const fxByCurrency = new Map<string, FxRateInfo | null>();
    const fxFor = async (currency: string | null | undefined): Promise<FxRateInfo | null> => {
      if (!currency) return null;
      if (!fxByCurrency.has(currency)) {
        fxByCurrency.set(currency, await this.pricing.resolveFxSafe(source, currency));
      }
      return fxByCurrency.get(currency) ?? null;
    };
    const prices: Record<string, FlightCalendarDay> = {};
    for (const [date, day] of Object.entries(result.prices ?? {})) {
      prices[date] = {
        ...day,
        outbound: day.outbound
          ? { ...day.outbound, price: this.markupFlightPrice(day.outbound.price, resolution, await fxFor(day.outbound.price?.currency)) }
          : day.outbound,
        inbound: day.inbound
          ? { ...day.inbound, price: this.markupFlightPrice(day.inbound.price, resolution, await fxFor(day.inbound.price?.currency)) }
          : day.inbound,
      };
    }
    return { ...result, prices };
  }

  @Post("histograms")
  @Public()
  histograms(@Body() body: AzalHistogramRequest): Promise<AzalHistogramResult> {
    return this.azal.histograms(body);
  }

  // ── Markup boundary helpers (§16 / §9) ─────────────────────────────

  /** Public price for one fare/price object — supplier price preserved in `pricing`.
   *  Phase 1 FX: fx present → convert-then-markup (amount → AZN); нет fx → легаси.
   *  Mixed-currency RT combine: breakdown legs in DIFFERENT currencies are each
   *  converted to AZN by the supplier's own rate BEFORE summing
   *  (x AZN + y USD × rate) — never added raw — then ONE markup on the AZN
   *  total. Same-currency legs keep the adapter sum (exact) + single convert.
   *  Any non-AZN leg without a rate → legacy whole-fare path (fail-open
   *  browse; the money gate blocks commercial use of unconverted prices). */
  private async markupFlightFare(
    fare: FlightFare,
    resolution: ResolvedMarkup,
    fxFor: (currency: string | null | undefined) => Promise<FxRateInfo | null>,
  ): Promise<FlightFare> {
    if (fare.pricing) return fare;
    const legs = mixedBreakdownLegs(fare);
    if (legs) {
      const converted = await this.convertMixedLegsToAzn(legs, fxFor);
      if (converted) {
        const { pricing } = this.pricing.applyWithFx(resolution, converted.totalAzn, "AZN", null);
        return {
          ...fare,
          total: { ...fare.total, amount: Number(pricing.publicPrice.toString()), currency: "AZN" },
          base:
            converted.baseAzn != null
              ? { ...fare.base, amount: converted.baseAzn, currency: "AZN" }
              : fare.base,
          facilities: { ...fare.facilities, fxApplied: converted.fxApplied },
          pricing: this.pricing.toPricingJson(pricing, null),
        };
      }
    }
    const amount = fare.total?.amount;
    const currency = fare.total?.currency;
    // Gate E: zero/absent prices are not commercial money — left untouched.
    if (typeof amount !== "number" || amount <= 0 || !currency) return fare;
    const { pricing, fxJson } = this.pricing.applyWithFx(resolution, amount, currency, (await fxFor(currency)) ?? null);
    return {
      ...fare,
      total: { ...fare.total, amount: Number(pricing.publicPrice.toString()), currency: fxJson ? "AZN" : currency },
      pricing: this.pricing.toPricingJson(pricing, fxJson),
    };
  }

  /**
   * Convert each mixed-currency breakdown leg to AZN with the supplier's own
   * rate (cached per currency by the caller). Returns null when any non-AZN
   * leg has no rate — caller falls back to the legacy whole-fare path.
   */
  private async convertMixedLegsToAzn(
    legs: { outbound: MixedFareLeg; inbound: MixedFareLeg },
    fxFor: (currency: string | null | undefined) => Promise<FxRateInfo | null>,
  ): Promise<{
    totalAzn: number;
    baseAzn: number | null;
    fxApplied: Record<string, { sourceCurrency: string; rate: string; rateCode: string | null } | null>;
  } | null> {
    const r2 = (n: number) => Math.round(n * 100) / 100;
    const distinct = [...new Set([legs.outbound.currency, legs.inbound.currency].map((c) => c.toUpperCase()))].filter(
      (c) => c !== "AZN",
    );
    const rates = new Map<string, FxRateInfo>();
    for (const cur of distinct) {
      const fx = await fxFor(legs.outbound.currency.toUpperCase() === cur ? legs.outbound.currency : legs.inbound.currency);
      if (!fx) return null;
      rates.set(cur, fx);
    }
    const toAzn = (amount: number, currency: string): number => {
      const cur = currency.toUpperCase();
      if (cur === "AZN") return amount;
      return r2(amount * Number(rates.get(cur)!.rate));
    };
    const fxApplied: Record<string, { sourceCurrency: string; rate: string; rateCode: string | null } | null> = {};
    for (const [key, leg] of Object.entries(legs) as Array<[string, MixedFareLeg]>) {
      const cur = leg.currency.toUpperCase();
      fxApplied[key] =
        cur === "AZN" ? null : { sourceCurrency: leg.currency, rate: rates.get(cur)!.rate.toString(), rateCode: rates.get(cur)!.rateCode };
    }
    const totalAzn = r2(toAzn(legs.outbound.amount, legs.outbound.currency) + toAzn(legs.inbound.amount, legs.inbound.currency));
    const ob = legs.outbound.base;
    const ib = legs.inbound.base;
    const baseAzn = ob != null && ob > 0 && ib != null && ib > 0
      ? r2(toAzn(ob, legs.outbound.currency) + toAzn(ib, legs.inbound.currency))
      : null;
    return { totalAzn, baseAzn, fxApplied };
  }

  private markupFlightPrice(price: FlightPrice | undefined, resolution: ResolvedMarkup, fx?: FxRateInfo | null): FlightPrice | undefined {
    if (!price || price.pricing) return price;
    const amount = price.amount;
    const currency = price.currency;
    if (typeof amount !== "number" || amount <= 0 || !currency) return price;
    const { pricing, fxJson } = this.pricing.applyWithFx(resolution, amount, currency, fx ?? null);
    return {
      ...price,
      amount: Number(pricing.publicPrice.toString()),
      currency: fxJson ? "AZN" : currency,
      pricing: this.pricing.toPricingJson(pricing, fxJson),
    };
  }

  /** One resolve per supplier source — N fares share a single rule lookup.
   *  FX — один lookup на (source, currency) (Map-кэш), convert-then-markup. */
  private async applyFlightMarkup<
    T extends { source?: string; fares?: FlightFare[] },
  >(flights: T[]): Promise<T[]> {
    const resolutions = new Map<string, ResolvedMarkup>();
    const fxByPair = new Map<string, FxRateInfo | null>();
    const out: T[] = [];
    for (const flight of flights) {
      if (!flight.fares?.length) {
        out.push(flight);
        continue;
      }
      const source = flight.source || "UNKNOWN";
      let resolution = resolutions.get(source);
      if (!resolution) {
        resolution = await this.pricing.resolveSafe(source, "flights");
        resolutions.set(source, resolution);
      }
      const fxFor = async (currency: string | null | undefined): Promise<FxRateInfo | null> => {
        if (!currency) return null;
        const pair = `${source}|${currency}`;
        if (!fxByPair.has(pair)) {
          fxByPair.set(pair, await this.pricing.resolveFxSafe(source, currency));
        }
        return fxByPair.get(pair) ?? null;
      };
      const marked = [];
      for (const fare of flight.fares) {
        marked.push(await this.markupFlightFare(fare, resolution, fxFor));
      }
      out.push({
        ...flight,
        fares: marked,
      });
    }
    return out;
  }

  // ── Server-authoritative /request derivation (§16) ────────────────

  /**
   * Re-run (or reuse a TTL-fresh) search of the same query and recompute the
   * row total the marketplace UI showed (OW: one fare; RT: out+in of the same
   * fare family — combined `_RT` offers match as a single flight).
   * No match / no sellable price → PRICE_UNAVAILABLE (the client's stale
   * price is rejected instead of silently booked).
   */
  private async deriveAuthoritativePrice(body: {
    from: string;
    to: string;
    departureDate: string;
    returnDate?: string;
    tripType: string;
    passengers: any;
    fareFamily: string;
    currency: string;
    segments: any[];
    supplierCode?: string;
  }): Promise<{
    amount: number;
    currency: string;
    pricing?: MarkupPricingJson;
    supplierCode: string;
    collectedAt: string | null;
  }> {
    const tripType = body.tripType === "RT" ? "RT" : "OW";
    const query: FlightSearchQuery = {
      from: body.from,
      to: body.to,
      departureDate: body.departureDate,
      returnDate: body.returnDate,
      tripType,
      passengers: body.passengers,
      supplier: body.supplierCode,
    };
    const response = await this.searchFresh(query);
    const derived = this.matchFareTotal((response.flights as any[]) ?? [], body, tripType);
    if (!derived || !(derived.amount > 0)) {
      throw new HttpException(
        {
          error: "PRICE_UNAVAILABLE",
          message:
            "PRICE_UNAVAILABLE: fresh flight re-search no longer contains the submitted fare — re-run the search",
        },
        400,
      );
    }
    const collectedAt =
      typeof response.collectedAt === "string" && !Number.isNaN(Date.parse(response.collectedAt))
        ? response.collectedAt
        : null;
    return { ...derived, collectedAt };
  }

  /** Fresh-by-TTL search cache: reuse the recent response, else re-search. */
  private async searchFresh(query: FlightSearchQuery): Promise<Record<string, unknown> & { flights?: unknown[] }> {
    const key = JSON.stringify(query);
    const hit = this.recentSearches.get(key);
    if (hit && Date.now() - hit.at < AzalController.RECENT_SEARCH_TTL_MS) {
      return hit.response;
    }
    const response = (await this.search(query)) as Record<string, unknown> & { flights?: unknown[] };
    this.recentSearches.set(key, { at: Date.now(), response });
    if (this.recentSearches.size > 100) {
      const oldest = this.recentSearches.keys().next().value;
      if (oldest !== undefined) this.recentSearches.delete(oldest);
    }
    return response;
  }

  /** Stable identity of a segment for re-search matching. */
  private segmentKey(seg: any): string {
    const point = (p: any): string =>
      String(
        p?.dateTime ?? (p?.date && p?.time ? `${p.date}T${p.time}` : p?.date ?? ""),
      );
    const airport = (p: any): string => String(p?.airport ?? p?.code ?? "");
    const flightNumber = String(seg?.marketingAirline?.flightNumber ?? seg?.flightNumber ?? "");
    return `${airport(seg?.departure)}|${point(seg?.departure)}|${airport(seg?.arrival)}|${point(seg?.arrival)}|${flightNumber}`;
  }

  private segmentsMatch(flightSegments: any[] | undefined, keys: string[]): boolean {
    if (!flightSegments || flightSegments.length !== keys.length) return false;
    return flightSegments.every((seg, i) => this.segmentKey(seg) === keys[i]);
  }

  /** Cheapest sellable fare of the family (UI row = one family per fare). */
  private fareOfFamily(fares: FlightFare[] | undefined, family: string): FlightFare | undefined {
    const candidates = (fares ?? []).filter(
      (f) => f.family === family && isSellableAmount(f.total?.amount, f.total?.currency),
    );
    if (!candidates.length) return undefined;
    return candidates.reduce((min, f) =>
      (f.total.amount as number) < (min.total.amount as number) ? f : min,
    );
  }

  private matchFareTotal(
    flights: any[],
    body: { fareFamily: string; segments: any[]; currency: string },
    tripType: "OW" | "RT",
  ): { amount: number; currency: string; pricing?: MarkupPricingJson; supplierCode: string } | null {
    const keys = (body.segments ?? []).map((s) => this.segmentKey(s));
    if (!keys.length) return null;

    // 1) One offer carries every submitted segment (OW, or a combined _RT offer).
    const whole = flights.find((f) => this.segmentsMatch(f.segments, keys));
    if (whole) {
      const fare = this.fareOfFamily(whole.fares, body.fareFamily);
      if (fare) {
        return {
          amount: fare.total.amount as number,
          currency: fare.total.currency ?? body.currency,
          pricing: fare.pricing,
          supplierCode: String(whole.source || "AZAL"),
        };
      }
    }

    // 2) RT table: separate _OW_OUT + _OW_IN offers (out leg + in leg).
    if (tripType === "RT") {
      for (let split = 1; split < keys.length; split++) {
        const outFlight = flights.find((f) => this.segmentsMatch(f.segments, keys.slice(0, split)));
        const innFlight = flights.find((f) => this.segmentsMatch(f.segments, keys.slice(split)));
        if (!outFlight || !innFlight) continue;
        const outFare = this.fareOfFamily(outFlight.fares, body.fareFamily);
        const innFare = this.fareOfFamily(innFlight.fares, body.fareFamily);
        if (outFare && innFare) {
          return {
            amount: (outFare.total.amount as number) + (innFare.total.amount as number),
            currency: outFare.total.currency ?? body.currency,
            pricing: this.combinePricingBlocks(outFare.pricing, innFare.pricing),
            supplierCode: String(outFlight.source || innFlight.source || "AZAL"),
          };
        }
        // UI fallback (no common family): the row carries the cheapest OUT fare's family.
        const outFares = ((outFlight.fares ?? []) as FlightFare[]).filter((f) =>
          isSellableAmount(f.total?.amount, f.total?.currency),
        );
        const innFares = ((innFlight.fares ?? []) as FlightFare[]).filter((f) =>
          isSellableAmount(f.total?.amount, f.total?.currency),
        );
        if (!outFares.length || !innFares.length) continue;
        const minOut = outFares.reduce((min, f) => ((f.total.amount as number) < (min.total.amount as number) ? f : min));
        const minIn = innFares.reduce((min, f) => ((f.total.amount as number) < (min.total.amount as number) ? f : min));
        if (minOut.family === body.fareFamily) {
          return {
            amount: (minOut.total.amount as number) + (minIn.total.amount as number),
            currency: minOut.total.currency ?? body.currency,
            pricing: this.combinePricingBlocks(minOut.pricing, minIn.pricing),
            supplierCode: String(outFlight.source || innFlight.source || "AZAL"),
          };
        }
      }
    }
    return null;
  }

  /**
   * RT sum: one §20 block for the combined row total (both legs share the
   * same supplier + serviceType → the same MarkupRule). Only combines when
   * BOTH legs carry a block; otherwise the caller falls back to legacy money.
   */
  private combinePricingBlocks(
    a?: MarkupPricingJson,
    b?: MarkupPricingJson,
  ): MarkupPricingJson | undefined {
    if (!a || !b) return a ?? b;
    const r2 = (n: number) => Math.round(n * 100) / 100;
    return {
      ...a,
      supplierAmount: r2(a.supplierAmount + b.supplierAmount),
      markupAmount: r2(a.markupAmount + b.markupAmount),
      publicAmount: r2(a.publicAmount + b.publicAmount),
    };
  }
}
