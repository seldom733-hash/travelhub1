import type {
  FlightCalendarRequest,
  FlightCalendarResult,
  FlightSearchQuery,
  FlightSearchResult,
} from "./flight.types";

export interface FlightSupplier {
  readonly code: string;
  readonly name: string;

  search(query: FlightSearchQuery): Promise<FlightSearchResult>;

  calendar(
    request: FlightCalendarRequest,
  ): Promise<FlightCalendarResult>;
}
