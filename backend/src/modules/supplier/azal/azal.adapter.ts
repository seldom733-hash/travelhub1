import { BadRequestException, Injectable } from "@nestjs/common";
import { AzalHttpService } from "./azal.http.service";
import type {
  AzalCalendarRequest,
  AzalFlightSearchQuery,
  AzalHistogramRequest,
  AzalHistogramResult,
} from "./azal.types";
import type { FlightSupplier } from "./flight.supplier";
import type {
  FlightAirportPoint,
  FlightBaggage,
  FlightCalendarRequest,
  FlightCalendarResult,
  FlightDuration,
  FlightFare,
  FlightFareRule,
  FlightOffer,
  FlightRoute,
  FlightSearchQuery,
  FlightSearchResult,
  FlightSegment,
  FlightStop,
} from "./flight.types";

/**
 * Application boundary for the AZAL flight supplier.
 *
 * The HTTP service remains AZAL-specific. This adapter translates the
 * verified AZAL parser output into the supplier-neutral flight contract.
 *
 * Histogram intentionally remains AZAL-specific because it is an optional
 * diagnostic/UI capability and is not part of the normalized supplier API.
 */
@Injectable()
export class AzalAdapter implements FlightSupplier {
  readonly code = "AZAL";
  readonly name = "AZAL";

  constructor(private readonly http: AzalHttpService) {}

  async search(query: FlightSearchQuery): Promise<FlightSearchResult> {
    if (!query.from || !query.to || !query.departureDate) {
      throw new BadRequestException("Flight search requires departure airport, arrival airport and departure date.");
    }
    // RT: do two OW searches and combine cheapest outbound + inbound
    if (query.tripType === "RT" && query.returnDate) {
      const outbound = await this.search({ ...query, tripType: "OW", returnDate: undefined });
      const inboundQuery: FlightSearchQuery = { from: query.to, to: query.from, departureDate: query.returnDate, tripType: "OW", passengers: query.passengers, isStudent: query.isStudent };
      const inbound = await this.search(inboundQuery);
      const cheapestOut = outbound.flights.flatMap(f => f.fares).filter(f => f.available).sort((a,b) => (a.total.amount ?? 999999) - (b.total.amount ?? 999999))[0];
      const cheapestIn = inbound.flights.flatMap(f => f.fares).filter(f => f.available).sort((a,b) => (a.total.amount ?? 999999) - (b.total.amount ?? 999999))[0];
      // Find flights that contain the cheapest fares
      const outFlight = outbound.flights.find(f => f.fares.some(ff => ff.id === cheapestOut?.id)) ?? outbound.flights[0];
      const inFlight = inbound.flights.find(f => f.fares.some(ff => ff.id === cheapestIn?.id)) ?? inbound.flights[0];
      if (cheapestOut && cheapestIn && outFlight && inFlight) {
        // Build all tariff combinations for RT first row
        const outByFamily = new Map(outbound.flights.flatMap(f => f.fares).filter(f => f.available).map(f => [f.family, f] as const));
        const inByFamily = new Map(inbound.flights.flatMap(f => f.fares).filter(f => f.available).map(f => [f.family, f] as const));
        const families = [...new Set([...outByFamily.keys(), ...inByFamily.keys()])].filter(f => outByFamily.has(f) && inByFamily.has(f));
        const combinedFares: FlightFare[] = families.map(fam => {
          const o = outByFamily.get(fam)!; const inn = inByFamily.get(fam)!;
          const totalAmt = (o.total.amount ?? 0) + (inn.total.amount ?? 0);
          const baseAmt = (o.base.amount ?? 0) + (inn.base.amount ?? 0);
          return { id: `${o.id}_${inn.id}`, family: fam, total: { amount: totalAmt, currency: o.total.currency ?? "AZN" }, base: { amount: baseAmt, currency: o.base.currency ?? "AZN" }, taxes: [], fees: [], cabin: o.cabin, bookingClass: o.bookingClass, fareCode: o.fareCode, available: o.available && inn.available, selected: false, baggage: o.baggage, luggage: o.luggage, changes: o.changes, refund: o.refund, facilities: { ...o.facilities, priceBreakdown: { outbound: { amount: o.total.amount, currency: o.total.currency, base: o.base.amount }, inbound: { amount: inn.total.amount, currency: inn.total.currency, base: inn.base.amount }, total: { amount: totalAmt, currency: o.total.currency } } }, earnMiles: (o.earnMiles ?? 0) + (inn.earnMiles ?? 0), earnPoints: (o.earnPoints ?? 0) + (inn.earnPoints ?? 0), labels: [] } as FlightFare;
        }).sort((a,b) => (a.total.amount ?? 999999) - (b.total.amount ?? 999999));
        // Fallback to cheapest if no matching families
        if (combinedFares.length === 0) {
          const totalAmount = (cheapestOut.total.amount ?? 0) + (cheapestIn.total.amount ?? 0);
          const baseAmount = (cheapestOut.base.amount ?? 0) + (cheapestIn.base.amount ?? 0);
          combinedFares.push({ id: `${cheapestOut.id}_${cheapestIn.id}`, family: cheapestOut.family, total: { amount: totalAmount, currency: cheapestOut.total.currency ?? "AZN" }, base: { amount: baseAmount, currency: cheapestOut.base.currency ?? "AZN" }, taxes: [], fees: [], cabin: cheapestOut.cabin, bookingClass: cheapestOut.bookingClass, fareCode: cheapestOut.fareCode, available: cheapestOut.available && cheapestIn.available, selected: false, baggage: cheapestOut.baggage, luggage: cheapestOut.luggage, changes: cheapestOut.changes, refund: cheapestOut.refund, facilities: { ...cheapestOut.facilities, priceBreakdown: { outbound: { amount: cheapestOut.total.amount, currency: cheapestOut.total.currency }, inbound: { amount: cheapestIn.total.amount, currency: cheapestIn.total.currency }, total: { amount: totalAmount, currency: cheapestOut.total.currency } } }, earnMiles: (cheapestOut.earnMiles ?? 0) + (cheapestIn.earnMiles ?? 0), earnPoints: (cheapestOut.earnPoints ?? 0) + (cheapestIn.earnPoints ?? 0), labels: [] } as FlightFare);
        }
        const outDur = outFlight.route.duration; const inDur = inFlight.route.duration;
        const totalMins = (outDur ? (outDur.days ?? 0)*1440 + outDur.hours*60 + outDur.minutes : 0) + (inDur ? (inDur.days ?? 0)*1440 + inDur.hours*60 + inDur.minutes : 0);
        const totalDur: FlightDuration = { days: Math.floor(totalMins/1440), hours: Math.floor((totalMins%1440)/60), minutes: totalMins%60 };
        const combinedOffer: FlightOffer = {
          ...outFlight,
          optionId: `${outFlight.optionId}_${inFlight.optionId}_RT`,
          segments: [...outFlight.segments, ...inFlight.segments],
          fares: combinedFares,
          route: { ...outFlight.route, actualTo: inFlight.route.actualTo, arrivalDate: inFlight.route.arrivalDate, arrivalTimezone: inFlight.route.arrivalTimezone, duration: totalDur, stops: [...outFlight.route.stops, ...inFlight.route.stops] },
        };
        // Return 3 flights: combined RT (all tariffs) + outbound OW + inbound OW (no Select, smaller)
        const outboundOnly: FlightOffer = { ...outFlight, optionId: `${outFlight.optionId}_OW_OUT`, requested: { ...query, tripType: "OW" as const } };
        const inboundOnly: FlightOffer = { ...inFlight, optionId: `${inFlight.optionId}_OW_IN`, requested: { from: query.to, to: query.from, departureDate: query.returnDate!, tripType: "OW" as const, passengers: query.passengers, isStudent: query.isStudent } };
        return { source: "AZAL", collectedAt: new Date().toISOString(), requested: query, summary: { optionSets: 1, flights: 3, fares: combinedFares.length + outFlight.fares.length + inFlight.fares.length }, flights: [combinedOffer, outboundOnly, inboundOnly] };
      }
    }
    const request: AzalFlightSearchQuery = {
      from: query.from,
      to: query.to,
      departureDate: query.departureDate,
      tripType: query.tripType,
      adults: query.passengers.adults,
      children: query.passengers.children,
      infants: query.passengers.infants,
      isStudent: query.isStudent,
      returnDate: query.returnDate,
    };

    const result = await this.http.search(request);

    return {
      source: result.source,
      collectedAt: result.collectedAt,
      requested: {
        from: result.requested.from,
        to: result.requested.to,
        departureDate: result.requested.departureDate,
        tripType: result.requested.tripType,
        passengers: {
          adults: query.passengers.adults,
          children: query.passengers.children,
          infants: query.passengers.infants,
        },
        isStudent: query.isStudent,
        returnDate: query.returnDate,
      },
      summary: result.summary,
      flights: result.flights.map((flight) =>
        this.mapFlight(flight, query),
      ),
    };
  }

  async calendar(
    request: FlightCalendarRequest,
  ): Promise<FlightCalendarResult> {
    const azalRequest: AzalCalendarRequest = {
      from: request.from,
      to: request.to,
      adults: request.passengers.adults,
      children: request.passengers.children,
      infants: request.passengers.infants,
      citizenship: request.citizenship,
      promoCode: request.promoCode,
      dates: request.dates,
    };

    const result = await this.http.calendar(azalRequest);

    return {
      source: result.source,
      collectedAt: result.collectedAt,
      from: request.from,
      to: request.to,
      passengers: request.passengers,
      prices: result.prices,
    };
  }

  /**
   * Histogram stays AZAL-specific and outside the normalized flight contract.
   */
  histograms(request: AzalHistogramRequest): Promise<AzalHistogramResult> {
    return this.http.histograms(request);
  }

  private mapFlight(
    flight: unknown,
    query: FlightSearchQuery,
  ): FlightOffer {
    const value = record(flight);

    return {
      optionId: stringOrNull(value.optionId),
      optionSetId: stringOrNull(value.optionSetId),
      available: booleanOrFalse(value.available),
      selected: booleanOrFalse(value.selected),
      userSelected: booleanOrFalse(value.userSelected),
      soldOut: booleanOrFalse(value.soldOut),
      cheapestEconomySolutionId: stringOrNull(
        value.cheapestEconomySolutionId,
      ),
      cheapestBusinessSolutionId: stringOrNull(
        value.cheapestBusinessSolutionId,
      ),
      requested: {
        ...query,
        passengers: { ...query.passengers },
      },
      route: this.mapRoute(value.route),
      segments: array(value.segments).map((segment) =>
        this.mapSegment(segment),
      ),
      fares: array(value.fares).map((fare) => this.mapFare(fare)),
    };
  }

  private mapRoute(value: unknown): FlightRoute {
    const route = record(value);

    return {
      actualFrom: stringOrNull(route.actualFrom),
      actualTo: stringOrNull(route.actualTo),
      departureDate: stringOrNull(route.departureDate),
      arrivalDate: stringOrNull(route.arrivalDate),
      departureTimezone: stringOrNull(route.departureTimezone),
      arrivalTimezone: stringOrNull(route.arrivalTimezone),
      duration: this.mapDuration(route.duration),
      stops: array(route.stops).map((stop) => this.mapStop(stop)),
      carbonEmissions: numberRecordOrNull(route.carbonEmissions),
      selectedCarbonEmission: numberOrNull(
        route.selectedCarbonEmission,
      ),
    };
  }

  private mapStop(value: unknown): FlightStop {
    const stop = record(value);

    return {
      airport: stringOrNull(stop.airport),
      duration: this.mapDuration(stop.duration),
    };
  }

  private mapSegment(value: unknown): FlightSegment {
    const segment = record(value);
    const departure = record(segment.departure);
    const arrival = record(segment.arrival);
    const marketing = record(segment.marketingAirline);
    const operating = record(segment.operatingAirline);
    const aircraft = recordOrNull(segment.aircraft);

    return {
      id: stringOrNull(segment.id),
      departure: this.mapAirportPoint(departure),
      arrival: this.mapAirportPoint(arrival),
      duration: this.mapDuration(segment.duration),
      marketingAirline: {
        code: stringOrNull(marketing.code),
        flightNumber: stringOrNull(marketing.flightNumber),
      },
      operatingAirline: {
        code: stringOrNull(operating.code),
        flightNumber: stringOrNull(operating.flightNumber),
      },
      aircraft: aircraft
        ? {
            name: stringOrNull(aircraft.name),
            code: stringOrNull(aircraft.code),
          }
        : null,
      codeShare: booleanOrFalse(segment.codeShare),
      checkinOpen: booleanOrNull(segment.checkinOpen),
    };
  }

  private mapAirportPoint(value: Record<string, unknown>): FlightAirportPoint {
    return {
      airport: stringOrNull(value.airport),
      terminal: stringOrNull(value.terminal),
      dateTime: stringOrNull(value.dateTime),
      timezone: stringOrNull(value.timezone),
    };
  }

  private mapDuration(value: unknown): FlightDuration | null {
    const duration = recordOrNull(value);

    if (!duration) {
      return null;
    }

    return {
      days: numberOrZero(duration.days),
      hours: numberOrZero(duration.hours),
      minutes: numberOrZero(duration.minutes),
    };
  }

  private mapFare(value: unknown): FlightFare {
    const fare = record(value);
    const price = record(fare.price);

    return {
      id: stringOrNull(fare.id),
      family:
        stringOrNull(fare.fareFamily) ??
        stringOrNull(fare.family) ??
        "UNKNOWN",
      total: {
        amount: numberOrNull(price.total),
        currency: stringOrNull(price.currency),
      },
      base: {
        amount: numberOrNull(price.base),
        currency: stringOrNull(price.currency),
      },
      taxes: recordArray(price.taxes),
      fees: recordArray(price.fees),
      cabin: stringOrNull(fare.cabin),
      bookingClass:
        stringOrNull(fare.rbd) ??
        stringOrNull(fare.bookingClass),
      fareCode: stringOrNull(fare.fareCode),
      available: booleanOrFalse(fare.available),
      selected: booleanOrFalse(fare.selected),
      baggage: this.mapBaggage(fare.baggage),
      luggage: this.mapBaggage(fare.luggage),
      changes: this.mapFareRule(fare.changes),
      refund: this.mapFareRule(fare.refund),
      facilities: record(fare.facilities),
      earnMiles: numberOrNull(fare.earnMiles),
      earnPoints: numberOrNull(fare.earnPoints),
      labels: stringArray(fare.labels),
    };
  }

  private mapBaggage(value: unknown): FlightBaggage | null {
    const baggage = recordOrNull(value);

    if (!baggage) {
      return null;
    }

    return {
      amount: numberOrNull(baggage.amount),
      weight: numberOrNull(baggage.weight),
      unit: stringOrNull(baggage.unit),
      status: stringOrNull(baggage.status),
    };
  }

  private mapFareRule(value: unknown): FlightFareRule | null {
    const rule = recordOrNull(value);

    if (!rule) {
      return null;
    }

    return {
      status: stringOrNull(rule.status),
      amount: numberOrNull(rule.amount),
      currency: stringOrNull(rule.currency),
      messages: stringArrayOrNull(rule.messages),
    };
  }
}

function record(value: unknown): Record<string, unknown> {
  return recordOrNull(value) ?? {};
}

function recordOrNull(
  value: unknown,
): Record<string, unknown> | null {
  if (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  ) {
    return value as Record<string, unknown>;
  }

  return null;
}

function array(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function recordArray(value: unknown): Array<Record<string, unknown>> {
  return array(value).filter(isRecord);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function stringArray(value: unknown): string[] {
  return array(value).filter(
    (item): item is string => typeof item === "string",
  );
}

function stringArrayOrNull(value: unknown): string[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  return stringArray(value);
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function numberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : null;
}

function numberOrZero(value: unknown): number {
  return numberOrNull(value) ?? 0;
}

function booleanOrFalse(value: unknown): boolean {
  return typeof value === "boolean" ? value : false;
}

function booleanOrNull(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function numberRecordOrNull(
  value: unknown,
): Record<string, number> | null {
  const source = recordOrNull(value);

  if (!source) {
    return null;
  }

  const result: Record<string, number> = {};

  for (const [key, item] of Object.entries(source)) {
    const number = numberOrNull(item);

    if (number !== null) {
      result[key] = number;
    }
  }

  return result;
}
