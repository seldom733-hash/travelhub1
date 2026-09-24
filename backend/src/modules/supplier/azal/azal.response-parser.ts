import type {
  AzalFlightSearchQuery,
  AzalFlightSearchResult,
} from "./azal.types";

/**
 * Parse the confirmed AZAL offers response.
 *
 * Important AZAL response shape:
 *   root.search.optionSets[]
 *     optionSet.options[]
 *       option.route.segments[]
 *       option.solutions -> object keyed by fare family
 *
 * The previous parser was reading optionSets from the root and therefore
 * returned zero flights even though AZAL returned HTTP 200 with real offers.
 */
export function parseAzalOffers(
  raw: unknown,
  query: AzalFlightSearchQuery,
): AzalFlightSearchResult {
  const root =
    raw && typeof raw === "object"
      ? (raw as Record<string, any>)
      : {};

  const search =
    root.search && typeof root.search === "object"
      ? (root.search as Record<string, any>)
      : {};

  const optionSets = Array.isArray(search.optionSets)
    ? search.optionSets
    : [];

  const flights: any[] = [];

  for (const optionSet of optionSets) {
    const options = Array.isArray(optionSet?.options)
      ? optionSet.options
      : [];

    for (const option of options) {
      const route = option?.route ?? {};
      const segments = Array.isArray(route?.segments)
        ? route.segments
        : [];

      const normalizedSegments = segments.map((segment: any) => {
        const departureAirport = segment?.departureAirport ?? {};
        const arrivalAirport = segment?.arrivalAirport ?? {};
        const marketing = segment?.marketingAirline ?? {};
        const operating = segment?.operatingAirline ?? {};
        const aircraft = segment?.aircraft ?? {};

        return {
          id: segment?.id ?? null,

          departure: {
            airport:
              departureAirport?.code ??
              departureAirport?.iataCode ??
              null,
            terminal: departureAirport?.terminal ?? null,
            dateTime: segment?.departureDate ?? null,
            timezone:
              segment?.departureTimeZone ??
              departureAirport?.timezone ??
              null,
          },

          arrival: {
            airport:
              arrivalAirport?.code ??
              arrivalAirport?.iataCode ??
              null,
            terminal: arrivalAirport?.terminal ?? null,
            dateTime: segment?.arrivalDate ?? null,
            timezone:
              segment?.arrivalTimeZone ??
              arrivalAirport?.timezone ??
              null,
          },

          marketingAirline: {
            code: marketing?.code ?? null,
            flightNumber: marketing?.flightNumber ?? null,
          },

          operatingAirline: {
            code: operating?.code ?? null,
            flightNumber: operating?.flightNumber ?? null,
          },

          aircraft: {
            code: aircraft?.code ?? null,
            name: aircraft?.name ?? null,
          },

          duration: segment?.duration ?? null,
          codeShare: segment?.codeShare ?? false,
        };
      });

      const solutions =
        option?.solutions &&
        typeof option.solutions === "object" &&
        !Array.isArray(option.solutions)
          ? option.solutions
          : {};

      const fares: any[] = [];

      for (const [fareFamilyKey, solution] of Object.entries(solutions)) {
        const solutionAny = solution as any;
        const pricing = solutionAny?.pricing ?? {};

        const total =
          pricing?.total?.salePrice ??
          pricing?.total?.price ??
          pricing?.total ??
          {};

        const base =
          pricing?.base?.salePrice ??
          pricing?.base?.price ??
          pricing?.base ??
          {};

        const passengerBreakdown =
          Array.isArray(solutionAny?.passengerBreakdowns)
            ? solutionAny.passengerBreakdowns[0]
            : null;

        const segmentBreakdown =
          Array.isArray(passengerBreakdown?.segmentBreakdowns)
            ? passengerBreakdown.segmentBreakdowns[0]
            : null;

        const fare = segmentBreakdown?.fare ?? {};

        const facilities = Array.isArray(fare?.facilities)
          ? fare.facilities
          : [];

        const facilityMap: Record<string, any> = {};

        for (const facility of facilities) {
          if (facility?.name) {
            facilityMap[facility.name] = {
              name: facility.name,
              group: facility.group ?? null,
              status: facility.status ?? null,
              amount: facility.amount ?? null,
              weight: facility.weight ?? null,
              price: facility.price ?? null,
              messages: facility.messages ?? null,
            };
          }
        }

        fares.push({
          id: solutionAny?.id ?? null,
          fareFamily:
            solutionAny?.fareFamily ??
            fare?.fareFamily ??
            fareFamilyKey,

          cabin:
            solutionAny?.cabin ??
            fare?.cabin ??
            null,

          available: solutionAny?.available ?? false,
          selected: solutionAny?.selected ?? false,

          price: {
            total: total?.amount ?? null,
            base: base?.amount ?? null,
            currency:
              total?.currency ??
              base?.currency ??
              null,
            taxes: Array.isArray(pricing?.taxes)
              ? pricing.taxes
              : [],
            fees: Array.isArray(pricing?.fees)
              ? pricing.fees
              : [],
          },

          baggage: facilityMap.baggage ?? null,
          luggage: facilityMap.luggage ?? null,
          changes: facilityMap.changes ?? null,
          refund: facilityMap.refund ?? null,

          facilities: facilityMap,

          rbd: fare?.rbd ?? null,
          fareCode: fare?.fareCode ?? null,

          segmentId:
            segmentBreakdown?.segmentId ??
            null,

          earnMiles:
            segmentBreakdown?.earnMiles ??
            null,

          earnPoints:
            segmentBreakdown?.earnPoints ??
            null,

          labels: Array.isArray(solutionAny?.labels)
            ? solutionAny.labels
            : [],
        });
      }

      flights.push({
        optionId: option?.id ?? null,
        optionSetId: optionSet?.id ?? null,

        available: option?.available ?? false,
        selected: option?.selected ?? false,
        userSelected: option?.userSelected ?? false,
        soldOut: option?.soldOut ?? false,

        cheapestEconomySolutionId:
          option?.cheapestEconomySolutionId ?? null,

        cheapestBusinessSolutionId:
          option?.cheapestBusinessSolutionId ?? null,

        requested: {
          from: query.from,
          to: query.to,
          departureDate: query.departureDate,
          tripType: query.tripType,
          passengers: {
            adults: query.adults,
            children: query.children ?? 0,
            infants: query.infants ?? 0,
          },
        },

        route: {
          actualFrom: route?.departure ?? null,
          actualTo: route?.arrival ?? null,
          departureDate:
            route?.departureDate ?? null,
          arrivalDate:
            route?.arrivalDate ?? null,
          departureTimezone:
            route?.departureTimeZone ?? null,
          arrivalTimezone:
            route?.arrivalTimeZone ?? null,
          duration: route?.duration ?? null,
          stops: Array.isArray(route?.stops)
            ? route.stops
            : [],
          carbonEmissions:
            route?.carbonEmissions ?? null,
          selectedCarbonEmission:
            route?.selectedCarbonEmission ?? null,
        },

        segments: normalizedSegments,
        fares,
      });
    }
  }

  const fareCount = flights.reduce(
    (count, flight) =>
      count +
      (Array.isArray(flight.fares)
        ? flight.fares.length
        : 0),
    0,
  );

  return {
    source: "AZAL",
    collectedAt: new Date().toISOString(),

    requested: {
      from: query.from,
      to: query.to,
      departureDate: query.departureDate,
      tripType: query.tripType,
      passengers: {
        adults: query.adults,
        children: query.children ?? 0,
        infants: query.infants ?? 0,
      },
    },

    summary: {
      optionSets: optionSets.length,
      flights: flights.length,
      fares: fareCount,
    },

    flights,
  } as AzalFlightSearchResult;
}
