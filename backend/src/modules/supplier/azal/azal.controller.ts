import { Body, Controller, Post } from "@nestjs/common";
import { Public } from "../../../security/auth/decorators";
import { AzalAdapter } from "./azal.adapter";
import { PrismaService } from "../../../prisma/prisma.service";
import { IdsService } from "../../../shared/ids.service";
import { ReferenceNumberService } from "../../../shared/reference-number.service";
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
  constructor(private readonly azal: AzalAdapter, private readonly prisma: PrismaService, private readonly ids: IdsService, private readonly refNum: ReferenceNumberService) {}

  @Post("search")
  @Public()
  search(@Body() body: FlightSearchQuery) {
    return this.azal.search(body);
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
