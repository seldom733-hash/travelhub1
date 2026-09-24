/**
 * AZAL flight supplier contract.
 *
 * AZAL is intentionally kept outside SupplierAdapter/SupplierOffer because
 * the existing supplier abstraction is tour/hotel oriented.
 *
 * Confirmed AZAL endpoints:
 *  - POST /book/api/flights/search/calendar
 *  - GET  /book/api/flights/search/by-deeplink/offers
 *  - POST /book/api/flights/search/histograms
 */

export type AzalTripType = "OW" | "RT";

export interface AzalPassengerCount {
  adults: number;
  children: number;
  infants: number;
}

export interface AzalFlightSearchQuery {
  from: string;
  to: string;
  departureDate: string;
  tripType: AzalTripType;
  adults: number;
  children?: number;
  infants?: number;
  isStudent?: boolean;
  /** Retained for the public contract; the currently confirmed offers request does not use it. */
  returnDate?: string;
}

export interface AzalDuration {
  days: number;
  hours: number;
  minutes: number;
}

export interface AzalStop {
  airport?: string;
  duration?: AzalDuration;
}

export interface AzalAirportPoint {
  airport: string;
  terminal?: string | null;
  dateTime: string;
  timezone?: string;
}

export interface AzalAirlineFlight {
  code: string;
  flightNumber: string;
}

export interface AzalAircraft {
  name?: string;
  code?: string;
}

export interface AzalFlightSegment {
  id: string;
  departure: AzalAirportPoint;
  arrival: AzalAirportPoint;
  duration: AzalDuration;
  marketingAirline: AzalAirlineFlight;
  operatingAirline: AzalAirlineFlight;
  aircraft?: AzalAircraft;
  codeShare: boolean;
  checkinOpen?: boolean;
}

export interface AzalBaggage {
  amount?: number;
  weight?: number;
  unit?: string;
  status?: string;
}

export interface AzalFareRule {
  status?: string;
  amount?: number;
  currency?: string;
  messages?: string[];
}

export interface AzalFare {
  id: string;
  family: string;
  total: { amount: number; currency: string };
  base: { amount: number; currency: string };
  taxes: { amount: number; currency: string };
  cabin: string;
  bookingClass?: string;
  fareCode?: string;
  available: boolean;
  baggage?: AzalBaggage;
  luggage?: AzalBaggage;
  changes?: AzalFareRule;
  refund?: AzalFareRule;
  earnMiles?: number;
  earnPoints?: number;
}

export interface AzalFlight {
  optionId: string;
  optionSetId: string;
  requested: {
    from: string;
    to: string;
  };
  route: {
    actualFrom: string;
    actualTo: string;
    departureDate: string;
    arrivalDate: string;
    departureTimezone?: string;
    arrivalTimezone?: string;
    duration: AzalDuration;
    stops: AzalStop[];
    carbonEmissions?: Record<string, number>;
    selectedCarbonEmission?: number;
  };
  segments: AzalFlightSegment[];
  fares: AzalFare[];
  soldOut: boolean;
}

export interface AzalFlightSearchResult {
  source: "AZAL";
  collectedAt: string;
  requested: {
    from: string;
    to: string;
    departureDate: string;
    tripType: AzalTripType;
    passengers: AzalPassengerCount;
  };
  summary: {
    optionSets: number;
    flights: number;
    fares: number;
  };
  flights: AzalFlight[];
}

export interface AzalCalendarRequest {
  from: string;
  to: string;
  adults: number;
  children?: number;
  infants?: number;
  citizenship?: string | null;
  promoCode?: string;
  dates?: {
    from: string;
    to: string;
  };
}

export interface AzalCalendarPrice {
  amount: number;
  currency: string;
}

export interface AzalCalendarDay {
  date: string;
  outbound?: { price?: AzalCalendarPrice };
  inbound?: { price?: AzalCalendarPrice };
}

export interface AzalCalendarResult {
  source: "AZAL";
  collectedAt: string;
  prices: Record<string, AzalCalendarDay>;
  raw?: unknown;
}

export interface AzalHistogramRequest {
  startDate: string;
  endDate: string;
  optionSetId: string;
  citizenship?: string | null;
  fareGroup?: string;
}

export interface AzalHistogramResult {
  source: "AZAL";
  collectedAt: string;
  optionSetId: string;
  raw: unknown;
}
