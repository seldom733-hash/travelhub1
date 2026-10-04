import * as fs from "fs";
import * as path from "path";
import {
  aviasalesTariffFamily,
  parseAviasalesChunk,
} from "./aviasales.response-parser";
import type { AviasalesChunk } from "./aviasales.types";
import type { FlightSearchQuery } from "../azal/flight.types";

function loadFixture(name: string): AviasalesChunk {
  return JSON.parse(
    fs.readFileSync(path.join(__dirname, "__fixtures__", name), "utf8"),
  ) as AviasalesChunk;
}

const owChunk = loadFixture("ow.chunk.json");
const rtChunk = loadFixture("rt.chunk.json");

const query: FlightSearchQuery = {
  from: "GYD",
  to: "IST",
  departureDate: "2026-10-15",
  tripType: "OW",
  passengers: { adults: 1, children: 0, infants: 0 },
};

describe("parseAviasalesChunk", () => {
  const offers = parseAviasalesChunk(owChunk, query);

  it("returns one offer per one-way ticket", () => {
    expect(offers).toHaveLength(owChunk.tickets!.length);
    expect(offers).toHaveLength(4);
  });

  it("stamps the source and a unique option id on every offer", () => {
    const optionIds = offers.map((offer) => offer.optionId);

    expect(new Set(optionIds).size).toBe(optionIds.length);
    expect(optionIds.every((id) => id?.startsWith("AVIASALES-"))).toBe(true);
    expect(offers.every((offer) => offer.requested.departureDate === "2026-10-15")).toBe(true);
    expect(offers.every((offer) => offer.available && !offer.soldOut)).toBe(true);
  });

  it("flattens a connecting itinerary into one segment per leg", () => {
    const direct = offers.filter((offer) => offer.segments.length === 1);
    const connecting = offers.find((offer) => offer.segments.length > 1);

    expect(direct).toHaveLength(3);
    expect(connecting).toBeDefined();
    expect(connecting!.route.stops).toHaveLength(1);
    expect(connecting!.route.stops[0].airport).toBe("ESB");
    expect(connecting!.segments.map((segment) => segment.departure.airport)).toEqual([
      "GYD",
      "ESB",
    ]);
    expect(connecting!.segments.map((segment) => segment.arrival.airport)).toEqual([
      "ESB",
      "SAW",
    ]);
  });

  it("derives route dates and a positive duration from the legs", () => {
    for (const offer of offers) {
      expect(offer.route.departureDate).toBe("2026-10-15");
      expect(offer.route.actualFrom).toBe("GYD");
      expect(offer.route.duration?.days).toBe(0);
      expect(
        (offer.route.duration?.hours ?? 0) * 60 + (offer.route.duration?.minutes ?? 0),
      ).toBeGreaterThan(0);
    }
  });

  it("collapses proposals to the cheapest fare per tariff family", () => {
    for (const offer of offers) {
      const families = offer.fares.map((fare) => fare.family);

      expect(new Set(families).size).toBe(families.length);
      expect(offer.fares.length).toBeLessThan(
        owChunk.tickets![offers.indexOf(offer)].proposals!.length,
      );

      const amounts = offer.fares.map((fare) => fare.total.amount ?? Number.MAX_SAFE_INTEGER);
      expect([...amounts].sort((a, b) => a - b)).toEqual(amounts);
    }
  });

  it("normalises fares into the shared AZAL tariff taxonomy", () => {
    const families = new Set(offers.flatMap((offer) => offer.fares.map((fare) => fare.family)));

    expect([...families].sort()).toEqual(
      expect.arrayContaining(["BUDGET", "CLASSIC"]),
    );
    for (const family of families) {
      expect(["BUDGET", "CLASSIC", "PLUS", "COMFORT", "BUSINESS"]).toContain(family);
    }
  });

  it("reports baggage without inventing a checked-bag weight", () => {
    const fares = offers.flatMap((offer) => offer.fares);
    const budget = fares.find((fare) => fare.family === "BUDGET");
    const withBag = fares.find((fare) => fare.family === "CLASSIC");

    expect(budget?.baggage).toMatchObject({
      status: "unavailable",
      amount: 0,
      weight: null,
    });
    expect(withBag?.baggage).toMatchObject({
      status: "available",
      amount: 1,
      weight: null,
    });

    const handCarry = fares.find((fare) => fare.luggage?.weight);
    expect(handCarry?.luggage).toMatchObject({ status: "available", unit: "kg" });
    expect(typeof handCarry?.luggage?.weight).toBe("number");
  });

  it("keeps the AZN currency and exposes the agent behind the cheapest fare", () => {
    for (const offer of offers) {
      for (const fare of offer.fares) {
        expect(fare.total.currency).toBe("AZN");
        expect(fare.base.amount).toBe(fare.total.amount);
        expect(fare.taxes).toEqual([]);
        expect(fare.fees).toEqual([]);
        expect(typeof fare.facilities.agentId).toBe("number");
      }
    }
  });

  it("maps refund/change rules onto the fare rule contract", () => {
    const fares = offers.flatMap((offer) => offer.fares);

    for (const fare of fares) {
      for (const rule of [fare.changes, fare.refund]) {
        if (rule) {
          expect(["available", "unavailable"]).toContain(rule.status);
        }
      }
    }

    expect(fares.some((fare) => fare.changes !== null)).toBe(true);
  });

  it("rounds the fractional AZN quote to two decimals", () => {
    // Live quotes come back as 207.2284656… — money has qəpik.
    const source = owChunk.tickets![0];
    const proposal = source.proposals![0];
    const chunk: AviasalesChunk = {
      ...owChunk,
      tickets: [
        {
          ...source,
          proposals: [
            {
              ...proposal,
              id: "fractional",
              price: { currency_code: "AZN", value: 207.2284656353174 },
            },
          ],
        },
      ],
    };
    const [offer] = parseAviasalesChunk(chunk, query);

    expect(offer.fares[0].total).toEqual({ amount: 207.23, currency: "AZN" });
    expect(offer.fares[0].base).toEqual({ amount: 207.23, currency: "AZN" });
  });

  it("drops multi-segment tickets — RT is decomposed by the adapter", () => {
    expect(parseAviasalesChunk(rtChunk, query)).toEqual([]);
  });

  it("tolerates an empty or malformed chunk", () => {
    expect(parseAviasalesChunk({}, query)).toEqual([]);
    expect(parseAviasalesChunk({ tickets: [], flight_legs: [] }, query)).toEqual([]);
    expect(
      parseAviasalesChunk({ tickets: [{ id: "no-legs", segments: [] }] }, query),
    ).toEqual([]);
  });
});

describe("aviasalesTariffFamily", () => {
  it("maps cabin and checked-bag count onto the shared taxonomy", () => {
    expect(aviasalesTariffFamily("Y", 0)).toBe("BUDGET");
    expect(aviasalesTariffFamily("Y", 1)).toBe("CLASSIC");
    expect(aviasalesTariffFamily("Y", 2)).toBe("COMFORT");
    expect(aviasalesTariffFamily("C", 0)).toBe("BUSINESS");
    expect(aviasalesTariffFamily(undefined, 0)).toBe("BUDGET");
  });
});
