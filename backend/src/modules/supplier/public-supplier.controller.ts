import { Controller, Post, Get, Body, Query, Res, HttpException, BadRequestException, RequestTimeoutException, BadGatewayException, Logger } from "@nestjs/common";
import type { Response } from "express";
import { Public } from "../../security/auth/decorators";
import { SupplierOfferService } from "./supplier-offer.service";
import { SupplierAggregatorService } from "./supplier-aggregator.service";
import { TourRequestService } from "./tour-request.service";
import { KompasCaptchaRequiredException } from "./kompas/kompas-captcha.exception";
import { DomainError } from "../../shared/errors";
import type { PriceCalendarQuery, SupplierOfferRef, SupplierSearchQuery } from "./supplier.types";

/**
 * Public Supplier API — anonymous access to search, price calendar, and re-check.
 *
 * Used by the product configurator and Vitrina for anonymous browsing.
 * Authenticated flow uses the main SupplierController.
 */
@Controller()
export class PublicSupplierController {
  private readonly logger = new Logger(PublicSupplierController.name);

  constructor(
    private readonly offerService: SupplierOfferService,
    private readonly tourRequestService: TourRequestService,
    private readonly aggregatorService: SupplierAggregatorService,
  ) {}

  /**
   * Preserve supplier error classification across the HTTP boundary.
   * Without this, non-HttpException errors become generic 500 and the
   * frontend cannot distinguish UNSUPPORTED / TIMEOUT / NO_RESULT / DOM fails.
   */
  private mapSupplierError(err: unknown): never {
    if (err instanceof KompasCaptchaRequiredException) {
      throw new HttpException(
        {
          status: "CAPTCHA_REQUIRED",
          challengeId: err.challengeId,
          supplier: err.supplier,
          captcha: { type: "image", mimeType: err.mimeType, data: err.captchaImage },
        } as unknown as string,
        200,
      );
    }
    const msg = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack?.slice(0,1200) : "";
    this.logger.error(`Public supplier API error: ${msg} | stack=${stack}`);
    if (/supports nights|UNSUPPORTED/i.test(msg)) {
      throw new BadRequestException(msg);
    }
    if (/timeout|TIMEOUT/i.test(msg)) {
      throw new RequestTimeoutException(msg);
    }
    if (/DOM hard-fail|schema drift|malformed/i.test(msg)) {
      throw new BadGatewayException(msg);
    }
    if (/PRICE_UNAVAILABLE/i.test(msg)) {
      // Supplier re-check returned no valid price — reject the booking input.
      throw new HttpException(msg, 400);
    }
    if (/no price_info|NO_RESULT/i.test(msg)) {
      throw new HttpException(msg, 204);
    }
    if (/Rate limit exceeded|Concurrency limit exceeded|circuit is OPEN/i.test(msg)) {
      // Return 429/503 so frontend can show retry, not generic 500
      throw new HttpException(msg, 503);
    }
    // Preserve original error status if already HttpException
    if (err instanceof HttpException) throw err;
    // Domain errors (ValidationDomainError 422, ConflictError 409, ...) carry
    // their own httpStatus — let the global AppExceptionFilter map them
    // (§4.8: customer validation must reach the client as 422/409, not 500).
    if (err instanceof DomainError) throw err;
    // Expose 500 with message so frontend can see cause (instead of generic Internal Server Error)
    throw new HttpException(msg, 500);
  }

  private async handleCaptcha<T>(promise: Promise<T>): Promise<T> {
    try {
      return await promise;
    } catch (err) {
      if (err instanceof KompasCaptchaRequiredException) {
        // Return CAPTCHA_REQUIRED as 200 payload — not an error.
        return {
          status: "CAPTCHA_REQUIRED",
          challengeId: err.challengeId,
          supplier: err.supplier,
          captcha: { type: "image", mimeType: err.mimeType, data: err.captchaImage },
        } as unknown as T;
      }
      throw err;
    }
  }

  /** Search supplier offers (anonymous). */
  @Get("public/supplier/search")
  @Public()
  async search(
    @Query("supplier") supplierCode: string,
    @Query("country") country?: string,
    @Query("departureCity") departureCity?: string,
    @Query("destination") destination?: string,
    @Query("departureDateFrom") departureDateFrom?: string,
    @Query("departureDateTo") departureDateTo?: string,
    @Query("nightsFrom") nightsFrom?: string,
    @Query("nightsTo") nightsTo?: string,
    @Query("adults") adults?: string,
    @Query("children") children?: string,
    @Query("childAges") childAges?: string,
    @Query("hotelStars") hotelStars?: string,
    @Query("meal") meal?: string,
    @Query("page") page?: string,
    @Query("hotelExternalId") hotelExternalId?: string,
    @Query("hotel") hotel?: string,
    @Query("tourIncValue") tourIncValue?: string,
    @Query("tourIncName") tourIncName?: string,
    @Query("towns") towns?: string,
    @Query("service") service?: string,
  ) {
    const query: SupplierSearchQuery = {
      // Category context: selects the right adapter when one provider code
      // registers several (ANEX tours / ANEX hotels) — prompt §2.
      service,
      country,
      departureCity,
      destination,
      departureDateFrom,
      departureDateTo,
      nightsFrom: nightsFrom ? parseInt(nightsFrom, 10) : undefined,
      nightsTo: nightsTo ? parseInt(nightsTo, 10) : undefined,
      adults: adults ? parseInt(adults, 10) : 2,
      children: children ? parseInt(children, 10) : 0,
      childAges: childAges ? childAges.split(",").map(Number) : undefined,
      hotelStars: hotelStars ? hotelStars.split(",").map((s) => s.trim()).filter(Boolean) : undefined,
      meal,
      page: page ? parseInt(page, 10) : 1,
      hotelExternalId,
      hotel,
      tourIncValue,
      tourIncName,
      // Supplier-town filter (e.g. KOMPAS TOWNS=<ids>) — normally resolved from
      // Master Geography by the aggregator; usable directly on a single-supplier
      // search as well.
      towns,
    };

    return this.handleCaptcha(this.offerService.search(supplierCode, query)).catch((err) => this.mapSupplierError(err));
  }

  /** Parse the shared search query params once (search-all / search-suppliers). */
  private buildSearchQuery(params: Record<string, unknown>): SupplierSearchQuery {
    const str = (key: string): string | undefined => {
      const v = params[key];
      if (v === undefined || v === "") return undefined;
      return String(Array.isArray(v) ? v[0] : v);
    };
    const num = (key: string): number | undefined => {
      const v = str(key);
      return v === undefined ? undefined : parseInt(v, 10);
    };
    const childAges = str("childAges");
    const suppliersRaw = str("suppliers");
    return {
      // Category context (searchByService re-stamps it with its serviceType).
      service: str("service"),
      country: str("country"),
      departureCity: str("departureCity"),
      destination: str("destination"),
      geoCity: str("geoCity"),
      geoResort: str("geoResort"),
      suppliers: suppliersRaw
        ? suppliersRaw.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean)
        : undefined,
      departureDateFrom: str("departureDateFrom"),
      departureDateTo: str("departureDateTo"),
      nightsFrom: num("nightsFrom"),
      nightsTo: num("nightsTo"),
      adults: num("adults") ?? 2,
      children: num("children") ?? 0,
      childAges: childAges ? childAges.split(",").map(Number) : undefined,
      meal: str("meal"),
      hotel: str("hotel"),
      hotelStars: str("hotelStars")
        ? str("hotelStars")!.split(",").map((s) => s.trim()).filter(Boolean)
        : undefined,
      page: num("page") ?? 1,
    };
  }

  /**
   * Aggregate search across enabled suppliers OF THE REQUESTED SERVICE
   * (service=tours → tour suppliers only). Capability-filtered; suppliers
   * are isolated: failures degrade to perSupplier[code].error.
   */
  @Get("public/supplier/search-all")
  @Public()
  async searchAll(
    @Query() params: Record<string, unknown>,
    @Res({ passthrough: true }) res: Response,
  ) {
    const query = this.buildSearchQuery(params);
    const serviceType = String(params.service ?? "") || "tours";
    // request-id связывает логи этого запроса с логами агрегатора; фронт
    // шлёт свой sid (searchId), иначе — короткий id на сервере.
    const requestId =
      String(params.requestId ?? "").trim() ||
      `SRCH-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;

    // Клиент отключился до ответа (закрыл вкладку / перезапустил поиск) —
    // фиксируем причину: результат не доставлен, поставщики отработали
    // впустую (реальный abort — отдельный шаг: общий in-flight промис
    // делится параллельными клиентами, см. supplier-aggregator/дедлайн).
    let responseSent = false;
    res.on("finish", () => {
      responseSent = true;
    });
    res.on("close", () => {
      if (!responseSent) {
        this.logger.warn(
          `[SEARCH ${requestId}] clientClosed — отключение до ответа, результат не доставлен`,
        );
      }
    });

    return this.aggregatorService.searchByService(serviceType, query, { requestId });
  }

  /**
   * Resolve which suppliers WILL answer this direction (country/city/resort)
   * without performing the search — lets the UI show "Определяем поставщиков…"
   * → "Найдены поставщики: …" while search-all runs in parallel.
   */
  @Get("public/supplier/search-suppliers")
  @Public()
  async searchSuppliers(@Query() params: Record<string, unknown>) {
    try {
      const query = this.buildSearchQuery(params);
      const serviceType = String(params.service ?? "") || "tours";
      const suppliers = await this.aggregatorService.resolveSuppliers(serviceType, query);
      return { suppliers };
    } catch (err) {
      throw this.mapSupplierError(err);
    }
  }

  /**
   * Registered supplier adapters of a service (default: tours) for the search
   * form's «Поставщики» picker. No auth — the codes are not sensitive.
   * GET /public/supplier/suppliers?service=tours
   */
  @Get("public/supplier/suppliers")
  @Public()
  listSuppliers(@Query("service") service?: string) {
    return this.aggregatorService.listSuppliersOfService(service ?? "tours");
  }

  /** Price calendar for a configuration over a date range (anonymous). */
  @Post("public/supplier/price-calendar")
  @Public()
  async getPriceCalendar(@Body() body: PriceCalendarQuery) {
    this.logger.log(`[PriceCalendar] REQ ${JSON.stringify(body)}`);
    let result: any;
    try {
      result = await this.handleCaptcha(this.offerService.getPriceCalendar(body));
    } catch (e) {
      throw this.mapSupplierError(e);
    }
    // Log result summary (not full entries)
    if (result && (result as any).status === "CAPTCHA_REQUIRED") {
      this.logger.log(`[PriceCalendar] RES CAPTCHA_REQUIRED challengeId=${(result as any).challengeId}`);
    } else if (result && (result as any).entries) {
      const r = result as any;
      this.logger.log(`[PriceCalendar] RES entries=${r.entries.length} scanned=${r.totalOffersScanned} from=${r.dateFrom} to=${r.dateTo}`);
    } else {
      this.logger.log(`[PriceCalendar] RES ${JSON.stringify(result).slice(0,500)}`);
    }
    return result;
  }

  /** Refresh price for re-check (anonymous). */
  @Post("public/supplier/refresh-price")
  @Public()
  async refreshPrice(
    @Body() body: { supplierCode: string; offerId: string; claim?: string; searchContext: SupplierSearchQuery },
  ) {
    return this.handleCaptcha(
      this.offerService.refreshPrice({
        supplierCode: body.supplierCode,
        externalOfferId: body.offerId,
        externalClaim: body.claim,
        searchContext: body.searchContext,
      }),
    ).catch((err) => this.mapSupplierError(err));
  }

  /** Refresh availability for re-check (anonymous). */
  @Post("public/supplier/refresh-availability")
  @Public()
  async refreshAvailability(
    @Body() body: { supplierCode: string; offerId: string; claim?: string; searchContext: SupplierSearchQuery },
  ) {
    return this.handleCaptcha(
      this.offerService.refreshAvailability({
        supplierCode: body.supplierCode,
        externalOfferId: body.offerId,
        externalClaim: body.claim,
        searchContext: body.searchContext,
      }),
    ).catch((err) => this.mapSupplierError(err));
  }

  /** Create a tour request from verified offer (anonymous). */
  @Post("public/supplier/create-request")
  @Public()
  async createTourRequest(
    @Body() body: {
      supplierCode: string;
      externalOfferId: string;
      /** Service category ("tours" | "hotels") — selects the re-check adapter. */
      service?: string;
      hotel: string;
      hotelExternalId?: string;
      departureDate: string;
      nights: number;
      adults: number;
      children: number;
      childAges?: number[];
      room?: string;
      meal?: string;
      price: number;
      currency: string;
      destination?: string;
      departureCity?: string;
      country?: string;
      tourIncValue?: string;
      tourIncName?: string;
      customer?: {
        phone?: string;
        email?: string;
        country?: string;
        firstName?: string;
        lastName?: string;
      };
    },
  ) {
    // displayedPrice is derived server-side from a supplier re-check
    // (TourRequestService) — body.price is accepted but never trusted.
    return this.handleCaptcha(this.tourRequestService.createTourRequest(body)).catch(
      (err) => this.mapSupplierError(err),
    );
  }
}
