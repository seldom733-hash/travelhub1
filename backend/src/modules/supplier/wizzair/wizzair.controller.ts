import { Body, Controller, Post } from "@nestjs/common";
import { Public } from "../../../security/auth/decorators";
import { WizzAirAdapter } from "./wizzair.adapter";
import type { FlightSearchQuery } from "../azal/flight.types";

/** First verified Wizz Air search endpoint. */
@Controller("supplier/wizzair")
export class WizzAirController {
  constructor(private readonly wizzAir: WizzAirAdapter) {}

  @Post("search")
  @Public()
  search(@Body() body: FlightSearchQuery) {
    return this.wizzAir.search(body);
  }
}

