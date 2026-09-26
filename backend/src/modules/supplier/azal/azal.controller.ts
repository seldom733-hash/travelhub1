import { Body, Controller, Get, HttpCode, Post, Query } from "@nestjs/common";
import { Public } from "../../../security/auth/decorators";
import { AzalAdapter } from "./azal.adapter";
import { AzalLocationsService } from "./azal.locations.service";
import { PrismaService } from "../../../prisma/prisma.service";
import { IdsService } from "../../../shared/ids.service";
import { ReferenceNumberService } from "../../../shared/reference-number.service";
import { FlightSupplierRegistry } from "../flight-supplier.registry";
import type {
  AzalHistogramRequest,
  AzalHistogramResult,
} from "./azal.types";
import type {
  FlightCalendarRequest,
  FlightSearchQuery,
} from "./flight.types";

/**
 * AZAL flight API.
 *
 * Search and Calendar expose the supplier-neutral flight contract.
 * Histogram remains an optional AZAL-specific endpoint.
 */
@Controller("supplier/azal")
export class AzalController {
  constructor(
    private readonly azal: AzalAdapter,
    private readonly prisma: PrismaService,
    private readonly ids: IdsService,
    private readonly refNum: ReferenceNumberService,
    private readonly flightRegistry: FlightSupplierRegistry,
    private readonly locations: AzalLocationsService,
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
    this.flightRegistry.list().forEach(s => console.log(`[FlightSearch] supplier ${s} called for ${body.from}->${body.to} ${body.departureDate}`));
    const suppliers = this.flightRegistry.list();
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
      console.warn(`[FlightSearch] supplier ${failure.code} failed:`, failure.result.reason);
    }

    const flights = successful.flatMap((result) => result.flights);
    const fares = successful.reduce((sum, result) => sum + result.summary.fares, 0);

    const perSupplier = suppliers.map((code, index) => {
      const r = results[index];
      const count = r.status === "fulfilled" ? r.value.summary.flights : 0;
      return `${code} flights=${count}`;
    });
    console.log(
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
  async createRequest(@Body() body: { from: string; to: string; departureDate: string; returnDate?: string; tripType: string; passengers: any; fareFamily: string; price: number; currency: string; segments: any[] }) {
    const code = await this.ids.nextCode(null as any, "REQ");
    const commerceSequence = await this.refNum.nextCommerceSequence(null as any);
    const referenceNumber = this.refNum.commerceRequestRef(commerceSequence);
    const now = new Date();
    const request = await (this.prisma as any).request.create({
      data: {
        code, commerceSequence, referenceNumber, customerId: null, productId: null, partnerId: null, status: "NEW",
        requestedServiceDate: new Date(body.departureDate), quantity: 1, travelerCount: body.passengers?.adults ?? 1,
        productSnapshot: { type: "FLIGHT", from: body.from, to: body.to, fareFamily: body.fareFamily },
        displayedPrice: body.price, displayedCurrency: body.currency, confirmedPrice: null, confirmedCurrency: null,
        pinnedRequirements: { ...body, supplierCode: "AZAL" },
        supplierResponseDeadline: new Date(now.getTime() + 24*60*60*1000),
      },
    });
    return { id: request.id, code: request.code, referenceNumber: request.referenceNumber, status: request.status };
  }

  @Post("calendar")
  @Public()
  calendar(@Body() body: FlightCalendarRequest) {
    return this.azal.calendar(body);
  }

  @Post("histograms")
  @Public()
  histograms(@Body() body: AzalHistogramRequest): Promise<AzalHistogramResult> {
    return this.azal.histograms(body);
  }
}
