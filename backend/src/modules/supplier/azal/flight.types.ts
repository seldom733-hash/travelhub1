/**
 * Supplier-neutral flight contract.
 *
 * AZAL-specific DTOs remain in azal.types.ts and are translated by
 * AzalAdapter at the supplier boundary.
 */
import type { MarkupPricingJson } from "../../pricing/pricing.types";

export type FlightTripType = "OW" | "RT";

export interface FlightPassengerCount {
  adults: number;
  children: number;
  infants: number;
  /**
   * F1 = CARRY CHILD AGES (owner-confirmed): a data/transport field only.
   * Carried through the search body, the fresh re-search and
   * `pinnedRequirements` so the composition of record survives — TravelHUB
   * never calculates a price from it, and no flight supplier receives it
   * until its own age/DOB contract is confirmed (AZAL DOB is NOT confirmed;
   * `childrenDatesOfBirth` stays null).
   */
  childAges?: number[];
}

export interface FlightSearchQuery {
  from: string;
  to: string;
  departureDate: string;
  tripType: FlightTripType;
  passengers: FlightPassengerCount;
  isStudent?: boolean;
  returnDate?: string;
  /**
   * Supplier whitelist coming from the search form. The registry resolves it
   * in the controller — adapters always see their own query, never a filter.
   */
  supplier?: string;
}

export interface FlightDuration {
  days: number;
  hours: number;
  minutes: number;
}

export interface FlightStop {
  airport?: string | null;
  duration?: FlightDuration | null;
}

export interface FlightAirportPoint {
  airport: string | null;
  terminal?: string | null;
  dateTime: string | null;
  timezone?: string | null;
}

export interface FlightAirline {
  code: string | null;
  flightNumber: string | null;
}

export interface FlightAircraft {
  name?: string | null;
  code?: string | null;
}

export interface FlightSegment {
  id: string | null;
  departure: FlightAirportPoint;
  arrival: FlightAirportPoint;
  duration: FlightDuration | null;
  marketingAirline: FlightAirline;
  operatingAirline: FlightAirline;
  aircraft?: FlightAircraft | null;
  codeShare: boolean;
  checkinOpen?: boolean | null;
}

export interface FlightBaggage {
  amount?: number | null;
  weight?: number | null;
  unit?: string | null;
  status?: string | null;
}

export interface FlightFareRule {
  status?: string | null;
  amount?: number | null;
  currency?: string | null;
  messages?: string[] | null;
}

export interface FlightPrice {
  amount: number | null;
  currency: string | null;
  /** Markup breakdown (§20) — set by the pricing boundary (amount = public). */
  pricing?: MarkupPricingJson;
}

export interface FlightFare {
  id: string | null;
  family: string;
  total: FlightPrice;
  base: FlightPrice;
  taxes: Array<Record<string, unknown>>;
  fees: Array<Record<string, unknown>>;
  cabin: string | null;
  bookingClass?: string | null;
  fareCode?: string | null;
  available: boolean;
  selected: boolean;
  baggage?: FlightBaggage | null;
  luggage?: FlightBaggage | null;
  changes?: FlightFareRule | null;
  refund?: FlightFareRule | null;
  facilities: Record<string, unknown>;
  earnMiles?: number | null;
  earnPoints?: number | null;
  labels: string[];
  /**
   * Markup breakdown (§20) — set by the pricing boundary: `total.amount`
   * becomes the PUBLIC price, supplier price preserved in pricing.supplierAmount
   * (base/taxes/priceBreakdown stay supplier-side on purpose — §16).
   */
  pricing?: MarkupPricingJson;
}

export interface FlightRoute {
  actualFrom: string | null;
  actualTo: string | null;
  departureDate: string | null;
  arrivalDate: string | null;
  departureTimezone?: string | null;
  arrivalTimezone?: string | null;
  duration: FlightDuration | null;
  stops: FlightStop[];
  carbonEmissions?: Record<string, number> | null;
  selectedCarbonEmission?: number | null;
}

export interface FlightOffer {
  optionId: string | null;
  optionSetId: string | null;
  /** Supplier code that produced this offer (AZAL, AVIASALES, …). */
  source?: string;
  available: boolean;
  selected: boolean;
  userSelected: boolean;
  soldOut: boolean;
  cheapestEconomySolutionId?: string | null;
  cheapestBusinessSolutionId?: string | null;
  requested: FlightSearchQuery;
  route: FlightRoute;
  segments: FlightSegment[];
  fares: FlightFare[];
}

export interface FlightSearchResult {
  source: string;
  collectedAt: string;
  requested: FlightSearchQuery;
  summary: {
    optionSets: number;
    flights: number;
    fares: number;
  };
  flights: FlightOffer[];
}

export interface FlightCalendarRequest {
  from: string;
  to: string;
  passengers: FlightPassengerCount;
  citizenship?: string | null;
  promoCode?: string;
  dates?: { from: string; to: string };
}

export interface FlightCalendarDay {
  date: string;
  outbound?: { price?: FlightPrice };
  inbound?: { price?: FlightPrice };
}

export interface FlightCalendarResult {
  source: string;
  collectedAt: string;
  from: string;
  to: string;
  passengers: FlightPassengerCount;
  prices: Record<string, FlightCalendarDay>;
}
