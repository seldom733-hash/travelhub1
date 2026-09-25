import type {
  FlightAircraft,
  FlightAirportPoint,
  FlightBaggage,
  FlightDuration,
  FlightFare,
  FlightOffer,
  FlightRoute,
  FlightSearchQuery,
  FlightSearchResult,
  FlightSegment,
} from "../azal/flight.types";
import type { WizzAirFare, WizzAirFlight, WizzAirPrice, WizzAirSearchResult } from "./wizzair.types";

const BUNDLE_LABELS: Record<string, string> = {
  basic: "Basic",
  smart: "Smart",
  middletwo: "Middle Two",
  middleTwo: "Middle Two",
  plus: "Plus",
};

type RecordLike = Record<string, any>;

function record(value: unknown): RecordLike {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as RecordLike)
    : {};
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function numberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function booleanOrFalse(value: unknown): boolean {
  return value === true;
}

function price(value: unknown): WizzAirPrice | null {
  const p = record(value);
  const amount = numberOrNull(p.amount);
  const currencyCode = stringOrNull(p.currencyCode);
  if (amount === null && currencyCode === null) return null;
  return {
    amount,
    currencyCode,
    exchangedAmount: numberOrNull(p.exchangedAmount),
    exchangedCurrencyCode: stringOrNull(p.exchangedCurrencyCode),
  };
}

function duration(value: unknown): FlightDuration | null {
  if (typeof value !== "string") return null;
  // Wizz Air: "04:10:00" (HH:MM:SS) or "04:10" (HH:MM), also "1:04:10:00" (D:HH:MM:SS) if days
  const parts = value.split(":").map(Number);
  if (parts.some(isNaN)) return null;
  if (parts.length === 3) return { days: 0, hours: parts[0], minutes: parts[1] };
  if (parts.length === 4) return { days: parts[0], hours: parts[1], minutes: parts[2] };
  if (parts.length === 2) return { days: 0, hours: parts[0], minutes: parts[1] };
  return null;
}

function titleBundle(bundle: string | null): string {
  if (!bundle) return "Unknown";
  return BUNDLE_LABELS[bundle] ?? BUNDLE_LABELS[bundle.toLowerCase()] ?? bundle;
}

function bundleServices(raw: RecordLike, bundleMap: Map<string, string[]>): string[] {
  const code = stringOrNull(raw.bundle)?.toLowerCase();
  return code ? [...(bundleMap.get(code) ?? [])] : [];
}

function baggageFromServices(services: string[], checked: boolean): FlightBaggage | null {
  const needle = checked ? "checked-in-baggage" : "carry-on-bag";
  if (!services.some((service) => service.includes(needle))) return null;
  return { status: "included", amount: 1, weight: null, unit: null };
}

function buildBundleMap(raw: RecordLike, direction: "outbound" | "return"): Map<string, string[]> {
  const bundles = Array.isArray(raw[`${direction}Bundles`]) ? raw[`${direction}Bundles`] : [];
  const map = new Map<string, string[]>();
  for (const bundle of bundles) {
    const value = record(bundle);
    const code = stringOrNull(value.code)?.toLowerCase();
    if (!code) continue;
    const services = Array.isArray(value.ancillaryServices)
      ? value.ancillaryServices.filter((x: unknown): x is string => typeof x === "string")
      : [];
    map.set(code, services);
  }
  return map;
}

function normalizeWizzFare(raw: RecordLike, services: string[]): WizzAirFare {
  const detail = record(raw.flightPriceDetail);
  const totalPrice = price(raw.discountedPrice) ?? price(raw.basePrice) ?? price(raw.fullBasePrice);
  const baseFarePrice = price(raw.baseFarePrice) ?? price(detail.baseFarePrice);
  const administrationFeePrice = price(raw.administrationFeePrice);
  const bundlePrice = price(raw.discountedBundlePrice) ?? price(raw.originalBundlePrice);

  return {
    fareSellKey: stringOrNull(raw.fareSellKey),
    bundle: stringOrNull(raw.bundle),
    isWdc: booleanOrFalse(raw.isWdc),
    soldOut: booleanOrFalse(raw.soldOut),
    baseFarePrice,
    totalPrice,
    administrationFeePrice,
    bundlePrice,
    flightPriceDetail: Object.keys(detail).length ? detail : null,
    ancillaryServices: services,
    raw,
  };
}

function normalizeFlight(raw: RecordLike, bundleMap: Map<string, string[]>): WizzAirFlight {
  const fares = Array.isArray(raw.fares)
    ? raw.fares.map((fare: unknown) => normalizeWizzFare(record(fare), bundleServices(record(fare), bundleMap)))
    : [];

  return {
    departureStation: stringOrNull(raw.departureStation),
    arrivalStation: stringOrNull(raw.arrivalStation),
    aircraftName: stringOrNull(raw.aircraftName),
    carrierCode: stringOrNull(raw.carrierCode),
    operatingCarrierCode: stringOrNull(raw.operatingCarrierCode),
    flightNumber: stringOrNull(raw.flightNumber),
    flightSellKey: stringOrNull(raw.flightSellKey),
    departureDateTime: stringOrNull(raw.departureDateTime),
    departureTimeUtcOffset: stringOrNull(raw.departureTimeUtcOffset),
    arrivalDateTime: stringOrNull(raw.arrivalDateTime),
    arrivalTimeUtcOffset: stringOrNull(raw.arrivalTimeUtcOffset),
    duration: stringOrNull(raw.duration),
    fares,
    raw,
  };
}

export function parseWizzAirOffers(
  raw: unknown,
  query: FlightSearchQuery,
): WizzAirSearchResult {
  const root = record(raw);
  const bundleMap = buildBundleMap(root, "outbound");
  const outbound = Array.isArray(root.outboundFlights) ? root.outboundFlights : [];
  const flights = outbound.map((flight) => normalizeFlight(record(flight), bundleMap));

  return {
    source: "WIZZAIR",
    collectedAt: new Date().toISOString(),
    requested: query,
    currencyCode: stringOrNull(root.currencyCode),
    flights,
    raw: root,
  };
}

export function mapWizzAirToFlightSearchResult(
  parsed: WizzAirSearchResult,
): FlightSearchResult {
  const flights: FlightOffer[] = parsed.flights.map((flight) => {
    const segment: FlightSegment = {
      id: flight.flightSellKey,
      departure: airportPoint(
        flight.departureStation,
        flight.departureDateTime,
        flight.departureTimeUtcOffset,
      ),
      arrival: airportPoint(
        flight.arrivalStation,
        flight.arrivalDateTime,
        flight.arrivalTimeUtcOffset,
      ),
      duration: duration(flight.duration),
      marketingAirline: {
        code: flight.carrierCode,
        flightNumber: flight.flightNumber,
      },
      operatingAirline: {
        code: flight.operatingCarrierCode ?? flight.carrierCode,
        flightNumber: flight.flightNumber,
      },
      aircraft: flight.aircraftName
        ? ({ name: flight.aircraftName, code: null } satisfies FlightAircraft)
        : null,
      codeShare: Boolean(
        flight.operatingCarrierCode && flight.operatingCarrierCode !== flight.carrierCode,
      ),
    };

    const route: FlightRoute = {
      actualFrom: flight.departureStation,
      actualTo: flight.arrivalStation,
      departureDate: flight.departureDateTime,
      arrivalDate: flight.arrivalDateTime,
      departureTimezone: flight.departureTimeUtcOffset,
      arrivalTimezone: flight.arrivalTimeUtcOffset,
      duration: duration(flight.duration),
      stops: [],
    };

    return {
      optionId: flight.flightSellKey,
      optionSetId: "WIZZAIR-OUTBOUND",
      available: flight.fares.some((fare) => !fare.soldOut),
      selected: false,
      userSelected: false,
      soldOut: flight.fares.length > 0 && flight.fares.every((fare) => fare.soldOut),
      requested: parsed.requested,
      route,
      segments: [segment],
      fares: flight.fares.map((fare) => mapFare(fare)),
    };
  });

  const fareCount = flights.reduce((sum, flight) => sum + flight.fares.length, 0);

  return {
    source: "WIZZAIR",
    collectedAt: parsed.collectedAt,
    requested: parsed.requested,
    summary: {
      optionSets: flights.length ? 1 : 0,
      flights: flights.length,
      fares: fareCount,
    },
    flights,
  };
}

function airportPoint(
  airport: string | null,
  dateTime: string | null,
  timezone: string | null,
): FlightAirportPoint {
  return { airport, dateTime, timezone };
}

function mapFare(fare: WizzAirFare): FlightFare {
  const total = fare.totalPrice;
  const base = fare.baseFarePrice;
  const bundleLabel = titleBundle(fare.bundle);
  const labels = [bundleLabel];
  if (fare.isWdc) labels.push("WIZZ Discount Club");
  if (fare.soldOut) labels.push("Sold out");

  const checked = baggageFromServices(fare.ancillaryServices, true);
  const cabin = baggageFromServices(fare.ancillaryServices, false);

  return {
    id: fare.fareSellKey,
    family: bundleLabel,
    total: {
      amount: total?.amount ?? null,
      currency: total?.currencyCode ?? null,
    },
    base: {
      amount: base?.amount ?? null,
      currency: base?.currencyCode ?? null,
    },
    taxes: [],
    fees: fare.flightPriceDetail && Array.isArray(fare.flightPriceDetail.fees)
      ? fare.flightPriceDetail.fees as Array<Record<string, unknown>>
      : fare.administrationFeePrice
        ? [{ type: "administration", ...fare.administrationFeePrice }]
        : [],
    cabin: "economy",
    bookingClass: null,
    fareCode: fare.bundle,
    available: !fare.soldOut,
    selected: false,
    baggage: checked,
    luggage: cabin,
    facilities: {
      provider: "WIZZAIR",
      bundle: fare.bundle,
      isWdc: fare.isWdc,
      fareSellKey: fare.fareSellKey,
      ancillaryServices: fare.ancillaryServices,
      administrationFeePrice: fare.administrationFeePrice,
      bundlePrice: fare.bundlePrice,
      flightPriceDetail: fare.flightPriceDetail,
      rawFare: fare.raw,
    },
    labels,
  };
}

