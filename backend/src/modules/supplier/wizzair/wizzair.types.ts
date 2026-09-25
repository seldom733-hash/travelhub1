import type { FlightSearchQuery } from "../azal/flight.types";

export interface WizzAirPrice {
  amount: number | null;
  currencyCode: string | null;
  exchangedAmount?: number | null;
  exchangedCurrencyCode?: string | null;
}

export interface WizzAirFare {
  fareSellKey: string | null;
  bundle: string | null;
  isWdc: boolean;
  soldOut: boolean;
  baseFarePrice: WizzAirPrice | null;
  totalPrice: WizzAirPrice | null;
  administrationFeePrice: WizzAirPrice | null;
  bundlePrice: WizzAirPrice | null;
  flightPriceDetail: Record<string, unknown> | null;
  ancillaryServices: string[];
  raw: Record<string, unknown>;
}

export interface WizzAirFlight {
  departureStation: string | null;
  arrivalStation: string | null;
  aircraftName: string | null;
  carrierCode: string | null;
  operatingCarrierCode: string | null;
  flightNumber: string | null;
  flightSellKey: string | null;
  departureDateTime: string | null;
  departureTimeUtcOffset: string | null;
  arrivalDateTime: string | null;
  arrivalTimeUtcOffset: string | null;
  duration: string | null;
  fares: WizzAirFare[];
  raw: Record<string, unknown>;
}

export interface WizzAirDiscount {
  amount: number | null;
  currencyCode: string | null;
  exchangedAmount?: number | null;
  exchangedCurrencyCode?: string | null;
}

export interface WizzAirDiscountFareRule {
  discount: WizzAirDiscount | null;
  minimumFare: WizzAirDiscount | null;
}

export interface WizzAirDiscountClubMembership {
  membership: string | null;
  membershipPrice: WizzAirDiscount | null;
  promotedMembershipPrice: WizzAirDiscount | null;
  code: string | null;
  minimumDiscounts: {
    fares: WizzAirDiscountFareRule[];
    baggage: WizzAirDiscount | null;
    prb: WizzAirDiscount | null;
    seat: WizzAirDiscount | null;
  };
  promotionDetails: unknown;
}

export interface WizzAirDiscountClubResponse {
  wdcMemberships: WizzAirDiscountClubMembership[];
  isAnyCustomerProgramChanges: boolean;
}

export interface WizzAirSearchResult {
  source: "WIZZAIR";
  collectedAt: string;
  requested: FlightSearchQuery;
  currencyCode: string | null;
  flights: WizzAirFlight[];
  discountClub?: WizzAirDiscountClubResponse | null;
  raw: Record<string, unknown>;
  rawDiscountClub?: Record<string, unknown> | null;
}

