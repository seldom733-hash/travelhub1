/**
 * Aviasales `tickets-api` wire format.
 *
 * Only the fields the parser reads are typed. A live chunk also carries UI
 * state (`filters`, `direct_flights_v2`, badges, `merged_terms_info` diff
 * metadata) that has no meaning for the supplier-neutral flight contract, so
 * those keys are intentionally absent here.
 *
 * Empirical notes (verified against live responses 2026-10-02):
 *  - `flight_terms` is keyed by the ABSOLUTE index into `flight_legs`, the
 *    same values that appear in `ticket.segments[].flights`;
 *  - `total_baggage_count` is the only checked-baggage signal — the checked
 *    bag weight is never exposed;
 *  - prices are AZN (`market_code: "az"`).
 */

/**
 * Tariff families shared with the AZAL taxonomy. The UI «Тариф (багаж)»
 * filter and the «Тариф+багаж» column group rows by exactly these values, so
 * every supplier has to normalise into the same set.
 */
export type AviasalesTariffFamily =
  | "BUDGET"
  | "CLASSIC"
  | "PLUS"
  | "COMFORT"
  | "BUSINESS";

export interface AviasalesMoney {
  currency_code?: string;
  value?: number;
}

export interface AviasalesHandbags {
  count?: number;
  weight?: number;
}

export interface AviasalesCarrierDesignator {
  carrier?: string;
  airline_id?: string;
  number?: string;
}

export interface AviasalesTariffRule {
  available?: boolean;
}

export interface AviasalesAdditionalTariffInfo {
  return_before_flight?: AviasalesTariffRule;
  return_after_flight?: AviasalesTariffRule;
  change_before_flight?: AviasalesTariffRule;
  change_after_flight?: AviasalesTariffRule;
}

export interface AviasalesFlightTerms {
  fare_code?: string;
  trip_class?: string;
  marketing_carrier_designator?: AviasalesCarrierDesignator;
  total_baggage_count?: number;
  handbags?: AviasalesHandbags;
  additional_tariff_info?: AviasalesAdditionalTariffInfo;
  is_charter?: boolean;
}

export interface AviasalesProposal {
  id?: string;
  itinerary_key?: string;
  price?: AviasalesMoney;
  price_per_person?: AviasalesMoney;
  agent_id?: number;
  flight_terms?: Record<string, AviasalesFlightTerms>;
  unified_price?: AviasalesMoney;
  from_main_airline?: boolean;
  tags?: string[];
}

export interface AviasalesTicketSegment {
  flights?: number[];
  transfers?: unknown[];
}

export interface AviasalesTicket {
  id?: string;
  segments?: AviasalesTicketSegment[];
  proposals?: AviasalesProposal[];
  signature?: string;
  tags?: string[];
}

export interface AviasalesFlightLeg {
  origin?: string;
  destination?: string;
  local_departure_date_time?: string;
  local_arrival_date_time?: string;
  departure_unix_timestamp?: number;
  arrival_unix_timestamp?: number;
  operating_carrier_designator?: AviasalesCarrierDesignator;
  equipment?: { code?: string; type?: string; name?: string };
  technical_stops?: unknown[];
  signature?: string;
}

export interface AviasalesAirline {
  iata?: string;
  name?: Record<string, { default?: string }>;
}

export interface AviasalesAirport {
  code?: string;
  name?: Record<string, { default?: string }>;
  city_code?: string;
}

export interface AviasalesAgent {
  id?: number;
  label?: Record<string, { default?: string }>;
}

export interface AviasalesMeta {
  total_tickets_count?: number;
  direct_tickets_count?: number;
  cheapest_direct_ticket_price?: number;
  first_ticket_price?: number;
}

export interface AviasalesChunk {
  chunk_id?: string;
  tickets?: AviasalesTicket[];
  flight_legs?: AviasalesFlightLeg[];
  airlines?: Record<string, AviasalesAirline>;
  agents?: Record<string, AviasalesAgent>;
  meta?: AviasalesMeta;
}

export interface AviasalesDirection {
  origin: string;
  destination: string;
  date: string;
  is_origin_airport: boolean;
  is_destination_airport: boolean;
}

export interface AviasalesStartBody {
  search_params: {
    directions: AviasalesDirection[];
    passengers: { adults: number; children: number; infants: number };
    trip_class: string;
  };
  client_features: {
    direct_flights: boolean;
    brand_ticket: boolean;
    top_filters: boolean;
    badges: boolean;
    tour_tickets: boolean;
    assisted: boolean;
  };
  market_code: string;
  marker: string;
  citizenship: string;
  currency_code: string;
  languages: Record<string, number>;
  experiment_groups: Record<string, never>;
  brand: string;
  search_source: string;
  subscription_ticket_signatures: never[];
  is_internet_restricted: boolean;
}
