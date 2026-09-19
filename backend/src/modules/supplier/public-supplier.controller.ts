import { Controller, Post, Get, Body, Query, HttpException, BadRequestException, RequestTimeoutException, BadGatewayException, Logger } from "@nestjs/common";
import { Public } from "../../security/auth/decorators";
import { SupplierOfferService } from "./supplier-offer.service";
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

  constructor(private readonly offerService: SupplierOfferService) {}

  /**
   * Preserve supplier error classification across the HTTP boundary.
   * Without this, non-HttpException errors become generic 500 and the
   * frontend cannot distinguish UNSUPPORTED / TIMEOUT / NO_RESULT / DOM fails.
   */
  private mapSupplierError(err: unknown): never {
    const msg = err instanceof Error ? err.message : String(err);
    this.logger.error(`Public supplier API error: ${msg}`);
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
      // Genuine empty result from supplier — surfaced as empty 200, not an error.
      throw new HttpException(msg, 204);
    }
    throw err instanceof HttpException ? err : new Error(msg);
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
    };

    return this.offerService.search(supplierCode, query).catch((err) => this.mapSupplierError(err));
  }

  /** Price calendar for a configuration over a date range (anonymous). */
  @Post("public/supplier/price-calendar")
  @Public()
  async getPriceCalendar(@Body() body: PriceCalendarQuery) {
    return this.offerService.getPriceCalendar(body).catch((err) => this.mapSupplierError(err));
  }

  /** Refresh price for re-check (anonymous). */
  @Post("public/supplier/refresh-price")
  @Public()
  async refreshPrice(
    @Body() body: { supplierCode: string; offerId: string; claim?: string; searchContext: SupplierSearchQuery },
  ) {
    return this.offerService.refreshPrice({
      supplierCode: body.supplierCode,
      externalOfferId: body.offerId,
      externalClaim: body.claim,
      searchContext: body.searchContext,
    });
  }

  /** Refresh availability for re-check (anonymous). */
  @Post("public/supplier/refresh-availability")
  @Public()
  async refreshAvailability(
    @Body() body: { supplierCode: string; offerId: string; claim?: string; searchContext: SupplierSearchQuery },
  ) {
    return this.offerService.refreshAvailability({
      supplierCode: body.supplierCode,
      externalOfferId: body.offerId,
      externalClaim: body.claim,
      searchContext: body.searchContext,
    });
  }
}
