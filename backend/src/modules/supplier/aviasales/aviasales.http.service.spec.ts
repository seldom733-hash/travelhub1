import { buildAviasalesStartBody } from "./aviasales.http.service";
import type { FlightSearchQuery } from "../azal/flight.types";

/**
 * Guards the exact `POST /search/v2/start` contract. Dropping `marker`
 * answers 400 `empty-marker`, dropping `currency_code` answers
 * `invalid-currency` — both are invisible until a live call fails.
 */
describe("buildAviasalesStartBody", () => {
  const query: FlightSearchQuery = {
    from: "gyd",
    to: "ist",
    departureDate: "2026-10-15",
    tripType: "OW",
    passengers: { adults: 2, children: 1, infants: 0 },
  };

  it("sends every mandatory search field", () => {
    const body = buildAviasalesStartBody(query);

    expect(body).toMatchObject({
      search_params: {
        passengers: { adults: 2, children: 1, infants: 0 },
        trip_class: "Y",
      },
      client_features: {
        direct_flights: true,
        brand_ticket: false,
        top_filters: true,
        badges: false,
        tour_tickets: true,
        assisted: true,
      },
      market_code: "az",
      marker: "direct",
      citizenship: "AZ",
      currency_code: "azn",
      languages: { az: 1 },
      brand: "AS",
      search_source: "search_form",
      is_internet_restricted: false,
    });
    expect(body.search_params.directions).toHaveLength(1);
    expect(body.subscription_ticket_signatures).toEqual([]);
    expect(body.experiment_groups).toEqual({});
  });

  it("uppercases the IATA codes and flags them as airports", () => {
    const body = buildAviasalesStartBody(query);

    expect(body.search_params.directions[0]).toEqual({
      origin: "GYD",
      destination: "IST",
      date: "2026-10-15",
      is_origin_airport: true,
      is_destination_airport: true,
    });
  });

  it("never lets the passenger count fall below one adult", () => {
    const body = buildAviasalesStartBody({
      ...query,
      passengers: { adults: 0, children: -1, infants: -1 },
    });

    expect(body.search_params.passengers).toEqual({
      adults: 1,
      children: 0,
      infants: 0,
    });
  });
});
