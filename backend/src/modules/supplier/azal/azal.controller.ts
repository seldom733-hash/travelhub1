import { Body, Controller, Post } from "@nestjs/common";
import { Public } from "../../../security/auth/decorators";
import { AzalAdapter } from "./azal.adapter";
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
  constructor(private readonly azal: AzalAdapter) {}

  @Post("search")
  @Public()
  search(@Body() body: FlightSearchQuery) {
    return this.azal.search(body);
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
