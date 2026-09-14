import { Controller, Post, Body } from "@nestjs/common";
import { Public } from "../../security/auth/decorators";
import { SupplierOfferService } from "./supplier-offer.service";
import type { PriceCalendarQuery, SupplierOfferRef, SupplierSearchQuery } from "./supplier.types";

/**
 * Public Supplier API — anonymous access to price calendar and re-check.
 *
 * Used by the product configurator for anonymous browsing.
 * Authenticated flow uses the main SupplierController.
 */
@Controller()
export class PublicSupplierController {
  constructor(private readonly offerService: SupplierOfferService) {}

  /** Price calendar for a configuration over a date range (anonymous). */
  @Post("public/supplier/price-calendar")
  @Public()
  async getPriceCalendar(@Body() body: PriceCalendarQuery) {
    return this.offerService.getPriceCalendar(body);
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
