import * as fs from "fs";
import * as path from "path";
import { AviasalesAdapter } from "./aviasales.adapter";
import { parseAviasalesChunk } from "./aviasales.response-parser";
import type { AviasalesChunk } from "./aviasales.types";
import type { FlightOffer, FlightSearchQuery } from "../azal/flight.types";

function loadFixture(name: string): AviasalesChunk {
  return JSON.parse(
    fs.readFileSync(path.join(__dirname, "__fixtures__", name), "utf8"),
  ) as AviasalesChunk;
}

const owChunk = loadFixture("ow.chunk.json");

const passengers = { adults: 1, children: 0, infants: 0 };

const owQuery: FlightSearchQuery = {
  from: "GYD",
  to: "IST",
  departureDate: "2026-10-15",
  tripType: "OW",
  passengers,
};

const rtQuery: FlightSearchQuery = {
  ...owQuery,
  tripType: "RT",
  // Same day as the outbound so the date filter keeps both stubbed legs.
  returnDate: "2026-10-15",
};

function stub() {
  const http = { search: jest.fn() };

  return { adapter: new AviasalesAdapter(http as never), http };
}

function withFareMap(fares: FlightOffer[]) {
  return new Map(fares.flatMap((flight) => flight.fares ?? []).map((fare) => [fare.family, fare]));
}

describe("AviasalesAdapter.search (one-way)", () => {
  it("asks the transport for a one-way search and reports the source", async () => {
    const offers = parseAviasalesChunk(owChunk, owQuery);
    const { adapter, http } = stub();
    http.search.mockResolvedValue(offers);

    const result = await adapter.search(owQuery);

    expect(http.search).toHaveBeenCalledTimes(1);
    expect(http.search).toHaveBeenCalledWith(
      expect.objectContaining({ from: "GYD", to: "IST", tripType: "OW" }),
    );
    expect(result.source).toBe("AVIASALES");
    expect(result.requested.tripType).toBe("OW");
    expect(result.flights).toHaveLength(offers.length);
    expect(result.summary).toEqual({
      optionSets: 1,
      flights: offers.length,
      fares: offers.reduce((sum, offer) => sum + offer.fares.length, 0),
    });
  });

  it("drops flights that do not depart on the requested date", async () => {
    const offers = parseAviasalesChunk(owChunk, owQuery);
    const shifted = offers.map((offer, index) =>
      index === 0
        ? {
            ...offer,
            segments: offer.segments.map((segment) => ({
              ...segment,
              departure: { ...segment.departure, dateTime: "2026-10-16 12:55" },
            })),
          }
        : offer,
    );
    const { adapter, http } = stub();
    http.search.mockResolvedValue(shifted);

    const result = await adapter.search(owQuery);

    expect(result.flights).toHaveLength(offers.length - 1);
    expect(result.summary.flights).toBe(offers.length - 1);
    expect(
      result.flights.every(
        (flight) => flight.segments[0].departure.dateTime?.slice(0, 10) === "2026-10-15",
      ),
    ).toBe(true);
  });

  it("returns an empty result when the supplier answers with nothing", async () => {
    const { adapter, http } = stub();
    http.search.mockResolvedValue([]);

    const result = await adapter.search(owQuery);

    expect(result.flights).toEqual([]);
    expect(result.summary).toEqual({ optionSets: 0, flights: 0, fares: 0 });
  });

  it("rejects a query without the mandatory fields", async () => {
    const { adapter, http } = stub();

    await expect(
      adapter.search({ ...owQuery, from: "", to: "" }),
    ).rejects.toThrow(
      "Flight search requires departure airport, arrival airport and departure date.",
    );
    expect(http.search).not.toHaveBeenCalled();
  });
});

describe("AviasalesAdapter.search (round trip)", () => {
  it("runs two one-way searches and emits _RT plus both one-way legs", async () => {
    const outbound = parseAviasalesChunk(owChunk, owQuery);
    const inbound = parseAviasalesChunk(owChunk, {
      ...owQuery,
      from: "IST",
      to: "GYD",
    });
    const { adapter, http } = stub();
    http.search
      .mockResolvedValueOnce(outbound)
      .mockResolvedValueOnce(inbound);

    const result = await adapter.search(rtQuery);

    expect(http.search).toHaveBeenCalledTimes(2);
    expect(http.search).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        from: "IST",
        to: "GYD",
        departureDate: "2026-10-15",
        tripType: "OW",
      }),
    );

    const combined = result.flights.filter((flight) => flight.optionId?.endsWith("_RT"));
    const outboundOnly = result.flights.filter((flight) =>
      flight.optionId?.endsWith("_OW_OUT"),
    );
    const inboundOnly = result.flights.filter((flight) =>
      flight.optionId?.endsWith("_OW_IN"),
    );

    expect(result.requested.tripType).toBe("RT");
    expect(combined).toHaveLength(1);
    expect(outboundOnly).toHaveLength(outbound.length);
    expect(inboundOnly).toHaveLength(inbound.length);
    expect(result.flights).toHaveLength(1 + outbound.length + inbound.length);
    expect(result.summary).toEqual({
      optionSets: 1,
      flights: result.flights.length,
      fares: result.flights.reduce((sum, flight) => sum + flight.fares.length, 0),
    });

    const optionIds = result.flights.map((flight) => flight.optionId);
    expect(new Set(optionIds).size).toBe(optionIds.length);

    expect(outboundOnly.every((flight) => flight.requested.tripType === "OW")).toBe(true);
    expect(
      inboundOnly.every(
        (flight) =>
          flight.requested.tripType === "OW" &&
          flight.requested.departureDate === rtQuery.returnDate &&
          flight.requested.from === "IST",
      ),
    ).toBe(true);
    expect(combined[0].segments.length).toBeGreaterThanOrEqual(2);
  });

  it("combines only the tariff families present on both legs, at out + in price", async () => {
    const outbound = parseAviasalesChunk(owChunk, owQuery);
    const inbound = parseAviasalesChunk(owChunk, {
      ...owQuery,
      from: "IST",
      to: "GYD",
    });
    const { adapter, http } = stub();
    http.search
      .mockResolvedValueOnce(outbound)
      .mockResolvedValueOnce(inbound);

    const result = await adapter.search(rtQuery);
    const combined = result.flights.find((flight) => flight.optionId?.endsWith("_RT"))!;
    const outByFamily = withFareMap(outbound);
    const inByFamily = withFareMap(inbound);
    const expectedFamilies = [...outByFamily.keys()].filter((family) =>
      inByFamily.has(family),
    );

    expect(expectedFamilies.length).toBeGreaterThan(0);
    expect(combined.fares.map((fare) => fare.family).sort()).toEqual(
      [...expectedFamilies].sort(),
    );

    for (const fare of combined.fares) {
      const outFare = outByFamily.get(fare.family)!;
      const inFare = inByFamily.get(fare.family)!;

      expect(fare.total.amount).toBe(
        (outFare.total.amount ?? 0) + (inFare.total.amount ?? 0),
      );
      expect(fare.facilities.priceBreakdown).toMatchObject({
        outbound: { amount: outFare.total.amount },
        inbound: { amount: inFare.total.amount },
      });
      // out + in must not leak binary float noise into the money column.
      expect(Math.round((fare.total.amount ?? 0) * 100) / 100).toBe(fare.total.amount);
    }

    expect([...combined.fares].map((fare) => fare.total.amount)).toEqual(
      [...combined.fares]
        .map((fare) => fare.total.amount ?? 0)
        .sort((a, b) => a - b),
    );
  });

  it("reports an empty round trip instead of falling back to another date", async () => {
    const { adapter, http } = stub();
    http.search.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

    const result = await adapter.search(rtQuery);

    expect(result.flights).toEqual([]);
    expect(result.summary).toEqual({ optionSets: 0, flights: 0, fares: 0 });
  });
});

describe("AviasalesAdapter.calendar", () => {
  it("degrades to an empty price map", async () => {
    const { adapter } = stub();

    const result = await adapter.calendar({
      from: "GYD",
      to: "IST",
      passengers,
    });

    expect(result.source).toBe("AVIASALES");
    expect(result.prices).toEqual({});
    expect(result.passengers).toEqual(passengers);
  });
});
