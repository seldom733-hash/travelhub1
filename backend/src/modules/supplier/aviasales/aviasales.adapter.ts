import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import { AviasalesHttpService } from "./aviasales.http.service";
import type { FlightSupplier } from "../azal/flight.supplier";
import type {
  FlightCalendarRequest,
  FlightCalendarResult,
  FlightDuration,
  FlightFare,
  FlightOffer,
  FlightSearchQuery,
  FlightSearchResult,
} from "../azal/flight.types";

/**
 * Application boundary for the Aviasales flight supplier.
 *
 * Aviasales is a second live price source next to AZAL: same normalized
 * contract, no browser, no CDP, no Travypayouts registration. The HTTP
 * service stays Aviasales-specific and this adapter translates its parsed
 * output into the shared flight contract.
 *
 * Round trips deliberately mirror AzalAdapter: two one-way searches and a
 * combine step that emits a `_RT` offer plus the `_OW_OUT`/`_OW_IN` legs the
 * results table cross-products. That keeps the RT grid identical across
 * suppliers instead of teaching the UI two shapes.
 */
@Injectable()
export class AviasalesAdapter implements FlightSupplier {
  readonly code = "AVIASALES";
  readonly name = "Aviasales";

  private readonly logger = new Logger(AviasalesAdapter.name);

  constructor(private readonly http: AviasalesHttpService) {}

  async search(query: FlightSearchQuery): Promise<FlightSearchResult> {
    if (!query.from || !query.to || !query.departureDate) {
      throw new BadRequestException(
        "Flight search requires departure airport, arrival airport and departure date.",
      );
    }

    // RT: do two OW searches and combine cheapest outbound + inbound.
    if (query.tripType === "RT" && query.returnDate) {
      const outbound = await this.search({
        ...query,
        tripType: "OW",
        returnDate: undefined,
      });
      const inbound = await this.search({
        from: query.to,
        to: query.from,
        departureDate: query.returnDate,
        tripType: "OW",
        passengers: query.passengers,
        isStudent: query.isStudent,
      });

      return this.combineRoundTrip(query, outbound, inbound);
    }

    const requested: FlightSearchQuery = {
      ...query,
      tripType: "OW",
      returnDate: undefined,
      passengers: { ...query.passengers },
    };
    const flights = await this.http.search(requested);

    // Aviasales answers with neighbouring-day flights when the requested date
    // is sold out. Never fall back to another date.
    const flightsOnDate = flights.filter((flight) => {
      const departure = flight.segments?.[0]?.departure?.dateTime;

      return typeof departure === "string" && departure.slice(0, 10) === requested.departureDate;
    });

    if (flightsOnDate.length !== flights.length) {
      this.logger.log(
        `[AVIASALES DATE FILTER] ${requested.from}->${requested.to} requested=${requested.departureDate} kept=${flightsOnDate.length} of ${flights.length}`,
      );
    }

    return {
      source: this.code,
      collectedAt: new Date().toISOString(),
      requested,
      summary: {
        optionSets: flightsOnDate.length ? 1 : 0,
        flights: flightsOnDate.length,
        fares: flightsOnDate.reduce((sum, flight) => sum + (flight.fares?.length ?? 0), 0),
      },
      flights: flightsOnDate,
    };
  }

  /**
   * Aviasales has no month-calendar endpoint in the verified contract. The
   * UI only ever calls AZAL's calendar route, so an empty map is the honest
   * degradation for this supplier.
   */
  async calendar(request: FlightCalendarRequest): Promise<FlightCalendarResult> {
    this.logger.warn(
      `[AVIASALES CALENDAR] not supported — returning an empty price map for ${request.from}->${request.to}`,
    );

    return {
      source: this.code,
      collectedAt: new Date().toISOString(),
      from: request.from,
      to: request.to,
      passengers: request.passengers,
      prices: {},
    };
  }

  private combineRoundTrip(
    query: FlightSearchQuery,
    outbound: FlightSearchResult,
    inbound: FlightSearchResult,
  ): FlightSearchResult {
    const cheapestOut = cheapestFare(outbound.flights);
    const cheapestIn = cheapestFare(inbound.flights);
    const outFlight =
      outbound.flights.find((flight) => flight.fares?.some((fare) => fare.id === cheapestOut?.id)) ??
      outbound.flights[0];
    const inFlight =
      inbound.flights.find((flight) => flight.fares?.some((fare) => fare.id === cheapestIn?.id)) ??
      inbound.flights[0];

    if (!cheapestOut || !cheapestIn || !outFlight || !inFlight) {
      // Same policy as AZAL: report the RT search as empty instead of
      // silently swapping in another date's flights.
      this.logger.log(
        `[AVIASALES RT EMPTY] ${query.from}->${query.to} departure=${query.departureDate} return=${query.returnDate} outboundFlights=${outbound.flights.length} inboundFlights=${inbound.flights.length}`,
      );

      return {
        source: this.code,
        collectedAt: new Date().toISOString(),
        requested: query,
        summary: { optionSets: 0, flights: 0, fares: 0 },
        flights: [],
      };
    }

    const outByFamily = new Map(
      outbound.flights
        .flatMap((flight) => flight.fares ?? [])
        .filter((fare) => fare.available)
        .map((fare) => [fare.family, fare] as const),
    );
    const inByFamily = new Map(
      inbound.flights
        .flatMap((flight) => flight.fares ?? [])
        .filter((fare) => fare.available)
        .map((fare) => [fare.family, fare] as const),
    );
    const families = [...new Set([...outByFamily.keys(), ...inByFamily.keys()])].filter(
      (family) => outByFamily.has(family) && inByFamily.has(family),
    );
    const combinedFares = families
      .map((family) => combineFare(outByFamily.get(family)!, inByFamily.get(family)!))
      .sort((a, b) => (a.total.amount ?? 999999) - (b.total.amount ?? 999999));

    if (combinedFares.length === 0) {
      combinedFares.push(combineFare(cheapestOut, cheapestIn));
    }

    const totalMinutes =
      durationMinutes(outFlight.route.duration) + durationMinutes(inFlight.route.duration);
    const combinedOffer: FlightOffer = {
      ...outFlight,
      optionId: `${outFlight.optionId}_${inFlight.optionId}_RT`,
      segments: [...(outFlight.segments ?? []), ...(inFlight.segments ?? [])],
      fares: combinedFares,
      route: {
        ...outFlight.route,
        actualTo: inFlight.route.actualTo,
        arrivalDate: inFlight.route.arrivalDate,
        arrivalTimezone: inFlight.route.arrivalTimezone,
        duration: toDuration(totalMinutes),
        stops: [...outFlight.route.stops, ...inFlight.route.stops],
      },
    };
    const outboundOnly = outbound.flights.map((flight) => ({
      ...flight,
      optionId: `${flight.optionId}_OW_OUT`,
      requested: { ...query, tripType: "OW" as const },
    }));
    const inboundOnly = inbound.flights.map((flight) => ({
      ...flight,
      optionId: `${flight.optionId}_OW_IN`,
      requested: {
        from: query.to,
        to: query.from,
        departureDate: query.returnDate!,
        tripType: "OW" as const,
        passengers: query.passengers,
        isStudent: query.isStudent,
      },
    }));
    const flights = [combinedOffer, ...outboundOnly, ...inboundOnly];

    return {
      source: this.code,
      collectedAt: new Date().toISOString(),
      requested: query,
      summary: {
        optionSets: 1,
        flights: flights.length,
        fares: flights.reduce((sum, flight) => sum + (flight.fares?.length ?? 0), 0),
      },
      flights,
    };
  }
}

function cheapestFare(flights: FlightOffer[]): FlightFare | undefined {
  return flights
    .flatMap((flight) => flight.fares ?? [])
    .filter((fare) => fare.available)
    .sort((a, b) => (a.total.amount ?? 999999) - (b.total.amount ?? 999999))[0];
}

/** Mirrors the AzalAdapter RT combine so both suppliers render one shape. */
function combineFare(outbound: FlightFare, inbound: FlightFare): FlightFare {
  const totalAmount = roundMoney((outbound.total.amount ?? 0) + (inbound.total.amount ?? 0));
  const baseAmount = roundMoney((outbound.base.amount ?? 0) + (inbound.base.amount ?? 0));
  const currency = outbound.total.currency ?? inbound.total.currency ?? "AZN";

  return {
    ...outbound,
    id: `${outbound.id}_${inbound.id}`,
    family: outbound.family,
    total: { amount: totalAmount, currency },
    base: { amount: baseAmount, currency: outbound.base.currency ?? currency },
    available: outbound.available && inbound.available,
    facilities: {
      ...outbound.facilities,
      ...inbound.facilities,
      priceBreakdown: {
        outbound: {
          amount: outbound.total.amount,
          currency: outbound.total.currency,
          base: outbound.base.amount,
        },
        inbound: {
          amount: inbound.total.amount,
          currency: inbound.total.currency,
          base: inbound.base.amount,
        },
        total: { amount: totalAmount, currency },
      },
    },
    earnMiles: (outbound.earnMiles ?? 0) + (inbound.earnMiles ?? 0),
    earnPoints: (outbound.earnPoints ?? 0) + (inbound.earnPoints ?? 0),
    labels: [],
  };
}

function durationMinutes(duration?: FlightDuration | null): number {
  if (!duration) {
    return 0;
  }

  return (duration.days ?? 0) * 1440 + (duration.hours ?? 0) * 60 + (duration.minutes ?? 0);
}

function roundMoney(amount: number): number {
  return Math.round(amount * 100) / 100;
}

function toDuration(totalMinutes: number): FlightDuration {
  return {
    days: Math.floor(totalMinutes / 1440),
    hours: Math.floor((totalMinutes % 1440) / 60),
    minutes: totalMinutes % 60,
  };
}
