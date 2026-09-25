import { BadRequestException, Injectable, NotImplementedException } from "@nestjs/common";
import { WizzAirHttpService } from "./wizzair.http.service";
import type { FlightSupplier } from "../azal/flight.supplier";
import type {
  FlightCalendarRequest,
  FlightCalendarResult,
  FlightSearchQuery,
  FlightSearchResult,
} from "../azal/flight.types";
import { mapWizzAirToFlightSearchResult } from "./wizzair.response-parser";

@Injectable()
export class WizzAirAdapter implements FlightSupplier {
  readonly code = "WIZZAIR";
  readonly name = "Wizz Air";

  constructor(private readonly http: WizzAirHttpService) {}

  async search(query: FlightSearchQuery): Promise<FlightSearchResult> {
    if (!query.from || !query.to || !query.departureDate) {
      throw new BadRequestException(
        "Flight search requires departure airport, arrival airport and departure date.",
      );
    }

    const result = await this.http.search(query);
    return mapWizzAirToFlightSearchResult(result);
  }

  async calendar(_request: FlightCalendarRequest): Promise<FlightCalendarResult> {
    throw new NotImplementedException("Wizz Air calendar is not implemented yet.");
  }
}

