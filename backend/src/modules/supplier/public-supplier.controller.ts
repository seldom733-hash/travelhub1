import { Controller, Post, Get, Body, Query, HttpException, BadRequestException, RequestTimeoutException, BadGatewayException, Logger } from "@nestjs/common";
import { Public } from "../../security/auth/decorators";
import { SupplierOfferService } from "./supplier-offer.service";
import { TourRequestService } from "./tour-request.service";
import { KompasCaptchaRequiredException } from "./kompas/kompas-captcha.exception";
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
    try { require("fs").appendFileSync("D:\\travelhub_v1\\backend_price_chain.log", `[MAP ERR] ${msg} | stack=${stack?.slice(0,600)}\n`); } catch {}
    if (/supports nights|UNSUPPORTED/i.test(msg)) {
      throw new BadRequestException(msg);
    }
    if (/timeout|TIMEOUT/i.test(msg)) {
      throw new RequestTimeoutException(msg);
    }
    if (/DOM hard-fail|schema drift|malformed/i.test(msg)) {
      throw new BadGatewayException(msg);
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
  ) {
    const query: SupplierSearchQuery = {
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
      hotelStars: hotelStars ? hotelStars.split(",").map(Number) : undefined,
      meal,
      page: page ? parseInt(page, 10) : 1,
      hotelExternalId,
      hotel,
      tourIncValue,
      tourIncName,
    };

    return this.handleCaptcha(this.offerService.search(supplierCode, query)).catch((err) => this.mapSupplierError(err));
  }

  /** Price calendar for a configuration over a date range (anonymous). */
  @Post("public/supplier/price-calendar")
  @Public()
  async getPriceCalendar(@Body() body: PriceCalendarQuery) {
    const line = `[PriceCalendar] REQ ${JSON.stringify(body)} | ${new Date().toISOString()}\n`;
    try { require("fs").appendFileSync("D:\\travelhub_v1\\backend_price_chain.log", line); } catch {}
    this.logger.log(`[PriceCalendar] REQ ${JSON.stringify(body)}`);
    let result: any;
    try {
      result = await this.handleCaptcha(this.offerService.getPriceCalendar(body));
    } catch (e) {
      const errLine = `[PriceCalendar] ERR ${(e as Error).message} | stack=${(e as Error).stack?.slice(0,600)} | body=${JSON.stringify(body).slice(0,400)}\n`;
      try { require("fs").appendFileSync("D:\\travelhub_v1\\backend_price_chain.log", errLine); } catch {}
      throw this.mapSupplierError(e);
    }
    // Log result summary (not full entries)
    let resLine = "";
    if (result && (result as any).status === "CAPTCHA_REQUIRED") {
      resLine = `[PriceCalendar] RES CAPTCHA_REQUIRED challengeId=${(result as any).challengeId}\n`;
      this.logger.log(`[PriceCalendar] RES CAPTCHA_REQUIRED challengeId=${(result as any).challengeId}`);
    } else if (result && (result as any).entries) {
      const r = result as any;
      resLine = `[PriceCalendar] RES entries=${r.entries.length} scanned=${r.totalOffersScanned} from=${r.dateFrom} to=${r.dateTo} | ${new Date().toISOString()}\n`;
      this.logger.log(`[PriceCalendar] RES entries=${r.entries.length} scanned=${r.totalOffersScanned} from=${r.dateFrom} to=${r.dateTo}`);
    } else {
      resLine = `[PriceCalendar] RES ${JSON.stringify(result).slice(0,500)}\n`;
      this.logger.log(`[PriceCalendar] RES ${JSON.stringify(result).slice(0,500)}`);
    }
    try { require("fs").appendFileSync("D:\\travelhub_v1\\backend_price_chain.log", resLine); } catch {}
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
    },
  ) {
    return this.tourRequestService.createTourRequest(body);
  }
}
