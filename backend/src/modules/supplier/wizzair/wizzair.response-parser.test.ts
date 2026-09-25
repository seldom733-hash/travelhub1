import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import assert from "node:assert/strict";
import { parseWizzAirOffers, mapWizzAirToFlightSearchResult } from "./wizzair.response-parser";

const fixture = JSON.parse(
  readFileSync(resolve(__dirname, "response_wizzair.txt"), "utf8"),
);

const query = {
  from: "GYD",
  to: "BUD",
  departureDate: "2026-10-10",
  tripType: "OW" as const,
  passengers: { adults: 1, children: 0, infants: 0 },
};

const parsed = parseWizzAirOffers(fixture, query);
assert.equal(parsed.flights.length, 1);
assert.equal(parsed.flights[0].flightNumber, "2500");
assert.equal(parsed.flights[0].duration, "04:10:00");
assert.equal(parsed.flights[0].fares.length, 8);

const normalized = mapWizzAirToFlightSearchResult(parsed);
assert.equal(normalized.flights.length, 1);
assert.equal(normalized.summary.fares, 8);
assert.equal(normalized.flights[0].route.duration?.hours, 4);
assert.equal(normalized.flights[0].route.duration?.minutes, 10);
assert.equal(normalized.flights[0].fares.some((fare) => fare.family === "Basic"), true);
assert.equal(normalized.flights[0].fares.some((fare) => fare.labels.includes("WIZZ Discount Club")), true);

console.log("Wizz Air parser fixture test: OK");

