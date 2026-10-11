/**
 * Supplier Markup (STRICT PROMPT Phase 2 §16) — AzalController boundaries.
 *
 * Proves:
 *  - search fan-out marks up every fare total ONCE per supplier source
 *    (supplier price preserved in `pricing`, base/taxes untouched);
 *  - Gate E: zero/absent fare totals are left unpriced;
 *  - POST /request derives displayedPrice SERVER-SIDE — body.price is never
 *    trusted; recent search reuse within TTL (no second supplier round-trip);
 *  - no fresh match → PRICE_UNAVAILABLE 400;
 *  - calendar day prices are marked up too.
 */
import { HttpException } from "@nestjs/common";
import { Prisma } from "../../../generated/prisma/client";
import { SupplierPricingService } from "../../pricing/supplier-pricing.service";
import type { MarkupRuleService } from "../../pricing/markup-rule.service";
import { AzalController } from "./azal.controller";
import type { FlightCalendarResult, FlightSearchResult } from "./flight.types";

const PASSENGERS = { adults: 1, children: 0, infants: 0 };

function segment(flightNumber: string, dep: string, arr: string, depAirport = "GYD", arrAirport = "IST") {
  return {
    id: null,
    departure: { airport: depAirport, dateTime: dep },
    arrival: { airport: arrAirport, dateTime: arr },
    duration: null,
    marketingAirline: { code: "J2", flightNumber },
    operatingAirline: { code: "J2", flightNumber },
    codeShare: false,
  };
}

function fare(family: string, amount: number, currency = "AZN") {
  return {
    id: `FARE-${family}`,
    family,
    total: { amount, currency },
    base: { amount: Math.round(amount * 0.9), currency },
    taxes: [],
    fees: [],
    cabin: "ECONOMY",
    available: true,
    selected: false,
    facilities: {},
    labels: [],
  };
}

function offer(segments: any[], fares: any[]) {
  return {
    optionId: "OPT-1",
    optionSetId: "SET-1",
    available: true,
    selected: false,
    userSelected: false,
    soldOut: false,
    requested: {
      from: "GYD",
      to: "IST",
      departureDate: "2026-11-01",
      tripType: "OW" as const,
      passengers: PASSENGERS,
    },
    route: {
      actualFrom: "GYD",
      actualTo: "IST",
      departureDate: "2026-11-01",
      arrivalDate: "2026-11-01",
      duration: null,
      stops: [],
    },
    segments,
    fares,
  };
}

function searchResult(flights: any[]): FlightSearchResult {
  return {
    source: "AZAL",
    collectedAt: new Date().toISOString(),
    requested: {
      from: "GYD",
      to: "IST",
      departureDate: "2026-11-01",
      tripType: "OW",
      passengers: PASSENGERS,
    },
    summary: {
      optionSets: flights.length,
      flights: flights.length,
      fares: flights.reduce((sum, f) => sum + (f.fares?.length ?? 0), 0),
    },
    flights,
  };
}

const SEARCH_BODY = {
  from: "GYD",
  to: "IST",
  departureDate: "2026-11-01",
  tripType: "OW",
  passengers: PASSENGERS,
};

function requestBody(overrides: Record<string, unknown> = {}) {
  return {
    from: "GYD",
    to: "IST",
    departureDate: "2026-11-01",
    tripType: "OW",
    passengers: PASSENGERS,
    fareFamily: "ECONOMY",
    price: 999999, // client's stale number — must be ignored
    currency: "USD",
    segments: [segment("J2123", "2026-11-01T08:00", "2026-11-01T11:00")],
    ...overrides,
  };
}

interface Harness {
  controller: AzalController;
  azal: { search: jest.Mock; calendar: jest.Mock; histograms: jest.Mock };
  prisma: { request: { create: jest.Mock } };
  ruleService: { resolve: jest.Mock };
}

function makeController(flights: any[], rate = "0.05", fxRates?: { resolveSafe: (code: string, cur: string) => Promise<{ rate: Prisma.Decimal; rateCode: string | null } | null> }): Harness {
  // One collectedAt shared by every search call: createRequest may invoke
  // search more than once, and per-call new Date() races the ms boundary
  // under full-suite load (snapshot vs results[0] comparison at §20).
  const collectedAt = new Date().toISOString();
  const azal = {
    search: jest
      .fn()
      .mockImplementation(async () => ({ ...searchResult(flights), collectedAt })),
    calendar: jest.fn(),
    histograms: jest.fn(),
  };
  const flightRegistry = {
    list: jest.fn().mockReturnValue(["AZAL"]),
    get: jest.fn().mockReturnValue(azal),
  };
  const prisma = {
    request: {
      create: jest.fn().mockResolvedValue({ id: "r1", code: "REQ-1", referenceNumber: "R-1", status: "NEW" }),
    },
  };
  const ids = { nextCode: jest.fn().mockResolvedValue("REQ-1") };
  const refNum = {
    nextCommerceSequence: jest.fn().mockResolvedValue(1),
    commerceRequestRef: jest.fn().mockReturnValue("R-1"),
  };
  const ruleService = {
    resolve: jest.fn().mockResolvedValue({
      found: true,
      rate: new Prisma.Decimal(rate),
      ruleCode: "MKR-00000001",
      ruleVersion: 1,
    }),
  } as unknown as MarkupRuleService;
  const pricing = new SupplierPricingService(ruleService, fxRates as never);
  const controller = new AzalController(
    azal as never,
    prisma as never,
    ids as never,
    refNum as never,
    flightRegistry as never,
    {} as never,
    pricing,
  );
  return { controller, azal, prisma, ruleService: ruleService as never };
}

const OW_FLIGHT = () =>
  offer(
    [segment("J2123", "2026-11-01T08:00", "2026-11-01T11:00")],
    [fare("ECONOMY", 1000), fare("BUSINESS", 3000)],
  );

describe("AzalController — markup + server-authoritative /request (Phase 2 §16)", () => {
  describe("POST search", () => {
    it("fare totals become PUBLIC with §20 pricing block; base stays supplier-side", async () => {
      const h = makeController([OW_FLIGHT()]);

      const res = await h.controller.search(SEARCH_BODY as never);

      const fares = (res.flights as any[])[0].fares;
      expect(fares[0].total.amount).toBe(1050);
      expect(fares[0].pricing).toMatchObject({ supplierAmount: 1000, publicAmount: 1050, markupRate: "0.05" });
      expect(fares[0].base.amount).toBe(900); // preserved supplier breakdown
      expect(fares[1].total.amount).toBe(3150);
      expect(fares[1].pricing!.supplierAmount).toBe(3000);
      expect(h.ruleService.resolve).toHaveBeenCalledWith("AZAL", "flights", expect.any(Date));
    });

    it("one rule resolution per supplier source (N fares share it)", async () => {
      const h = makeController([OW_FLIGHT(), OW_FLIGHT()]);
      await h.controller.search(SEARCH_BODY as never);
      expect(h.ruleService.resolve).toHaveBeenCalledTimes(1);
    });

    it("zero/absent fare totals are not commercial money — left untouched (Gate E)", async () => {
      const flight = offer(
        [segment("J2123", "2026-11-01T08:00", "2026-11-01T11:00")],
        [{ ...fare("ECONOMY", 0), total: { amount: 0, currency: "AZN" } }],
      );
      const h = makeController([flight]);

      const res = await h.controller.search(SEARCH_BODY as never);
      const zero = (res.flights as any[])[0].fares[0];
      expect(zero.total.amount).toBe(0);
      expect(zero.pricing).toBeUndefined();
    });

    it("no flights → resolveSafe is never called", async () => {
      const h = makeController([]);
      await h.controller.search(SEARCH_BODY as never);
      expect(h.ruleService.resolve).not.toHaveBeenCalled();
    });

    it("mixed-currency RT combine: each leg converted by the supplier rate BEFORE summing (x + y*rate)", async () => {
      // Adapter's raw combine: 100 AZN + 100 USD summed into 200 "AZN".
      const rtFare = {
        ...fare("ECONOMY", 200, "AZN"),
        facilities: {
          priceBreakdown: {
            outbound: { amount: 100, currency: "AZN", base: 90 },
            inbound: { amount: 100, currency: "USD", base: 90 },
            total: { amount: 200, currency: "AZN" },
          },
        },
      };
      const flight = offer(
        [
          segment("J2123", "2026-11-01T08:00", "2026-11-01T11:00"),
          segment("J2124", "2026-11-10T12:00", "2026-11-10T15:00", "IST", "GYD"),
        ],
        [rtFare],
      );
      const fxRates = {
        resolveSafe: jest.fn(async (_code: string, cur: string) =>
          cur === "USD" ? { rate: new Prisma.Decimal("1.7"), rateCode: "SFX-1" } : null,
        ),
      };
      const h = makeController([flight], "0.05", fxRates);

      const res = await h.controller.search(SEARCH_BODY as never);
      const marked = (res.flights as any[])[0].fares[0];

      // 100 AZN + 100 USD × 1.7 = 270 AZN supplier total, then 5% markup.
      expect(marked.total).toMatchObject({ amount: 283.5, currency: "AZN" });
      expect(marked.base).toMatchObject({ amount: 243, currency: "AZN" });
      expect(marked.pricing).toBeDefined();
      // Per-leg FX evidence kept on the fare; original legs untouched.
      expect(marked.facilities.fxApplied).toMatchObject({
        outbound: null,
        inbound: { sourceCurrency: "USD", rate: "1.7", rateCode: "SFX-1" },
      });
      expect(marked.facilities.priceBreakdown.outbound).toMatchObject({ amount: 100, currency: "AZN" });
      expect(marked.facilities.priceBreakdown.inbound).toMatchObject({ amount: 100, currency: "USD" });
    });

    it("mixed-currency RT combine without a leg rate → legacy whole-fare path (fail-open, no silent math)", async () => {
      const rtFare = {
        ...fare("ECONOMY", 200, "AZN"),
        facilities: {
          priceBreakdown: {
            outbound: { amount: 100, currency: "AZN" },
            inbound: { amount: 100, currency: "EUR" },
            total: { amount: 200, currency: "AZN" },
          },
        },
      };
      const flight = offer(
        [
          segment("J2123", "2026-11-01T08:00", "2026-11-01T11:00"),
          segment("J2124", "2026-11-10T12:00", "2026-11-10T15:00", "IST", "GYD"),
        ],
        [rtFare],
      );
      // USD-only rates: EUR leg has no rate.
      const fxRates = {
        resolveSafe: jest.fn(async (_code: string, cur: string) =>
          cur === "USD" ? { rate: new Prisma.Decimal("1.7"), rateCode: "SFX-1" } : null,
        ),
      };
      const h = makeController([flight], "0.05", fxRates);

      const res = await h.controller.search(SEARCH_BODY as never);
      const marked = (res.flights as any[])[0].fares[0];

      // Legacy: raw sum marked up in the labeled currency, no fx evidence.
      expect(marked.total).toMatchObject({ amount: 210, currency: "AZN" });
      expect(marked.facilities.fxApplied).toBeUndefined();
    });

    it("same-currency legs keep the exact adapter sum + single convert", async () => {
      const rtFare = {
        ...fare("ECONOMY", 200, "USD"),
        facilities: {
          priceBreakdown: {
            outbound: { amount: 100, currency: "USD" },
            inbound: { amount: 100, currency: "USD" },
            total: { amount: 200, currency: "USD" },
          },
        },
      };
      const flight = offer(
        [
          segment("J2123", "2026-11-01T08:00", "2026-11-01T11:00"),
          segment("J2124", "2026-11-10T12:00", "2026-11-10T15:00", "IST", "GYD"),
        ],
        [rtFare],
      );
      const fxRates = {
        resolveSafe: jest.fn(async (_code: string, cur: string) =>
          cur === "USD" ? { rate: new Prisma.Decimal("1.7"), rateCode: "SFX-1" } : null,
        ),
      };
      const h = makeController([flight], "0.05", fxRates);

      const res = await h.controller.search(SEARCH_BODY as never);
      const marked = (res.flights as any[])[0].fares[0];

      // 200 USD × 1.7 = 340 AZN, then 5% markup; no per-leg evidence needed.
      expect(marked.total).toMatchObject({ amount: 357, currency: "AZN" });
      expect(marked.facilities.fxApplied).toBeUndefined();
    });
  });

  describe("POST request — server-authoritative price", () => {
    it("ignores body.price and writes the derived public price; reuses the TTL-fresh search", async () => {
      const h = makeController([OW_FLIGHT()]);

      const first = await h.controller.createRequest(requestBody() as never);
      const second = await h.controller.createRequest(requestBody() as never);

      // displayedPrice = public fare total from the fresh search, NOT body.price
      const createArgs = h.prisma.request.create.mock.calls.map((c: any[]) => c[0].data);
      expect(createArgs).toHaveLength(2);
      expect(createArgs[0].displayedPrice).toBe(1050);
      expect(createArgs[0].displayedCurrency).toBe("AZN");
      expect(createArgs[1].displayedPrice).toBe(1050);
      // body.price (999999) never reached the request record
      expect(createArgs[0].displayedPrice).not.toBe(999999);

      // Second call reused the recent search (TTL 5 min) — one supplier round-trip
      expect(h.azal.search).toHaveBeenCalledTimes(1);
      expect(first.code).toBe("REQ-1");
      expect(second.status).toBe("NEW");
    });

    it("F1 CARRY CHILD AGES: passengers.childAges travels into pinnedRequirements (data only — no AZAL DOB)", async () => {
      const h = makeController([OW_FLIGHT()]);

      await h.controller.createRequest(
        requestBody({
          passengers: { adults: 2, children: 3, infants: 0, childAges: [2, 6, 12] },
        }) as never,
      );

      const data = h.prisma.request.create.mock.calls[0][0].data;
      // The composition of record survives on the request row …
      expect(data.pinnedRequirements.passengers.childAges).toEqual([2, 6, 12]);
      expect(data.pinnedRequirements.passengers.adults).toBe(2);
      // … while AZAL's supplier contract stays counts-only: no DOB field is
      // ever populated by the controller (childrenDatesOfBirth stays null in
      // the AZAL http body) and no price is derived from ages in TravelHUB.
      expect(data.travelerCount).toBe(2);
      expect(JSON.stringify(data.pinnedRequirements)).not.toContain("childrenDatesOfBirth");
    });

    it("stale/foreign segment keys → PRICE_UNAVAILABLE 400 (client price rejected)", async () => {
      const h = makeController([OW_FLIGHT()]);

      await expect(
        h.controller.createRequest(
          requestBody({ segments: [segment("XX999", "2026-11-01T23:00", "2026-11-01T23:59")] }) as never,
        ),
      ).rejects.toMatchObject({ status: 400, response: { error: "PRICE_UNAVAILABLE" } });
      expect(h.prisma.request.create).not.toHaveBeenCalled();
    });

    it("missing fare family → PRICE_UNAVAILABLE (cannot invent a price)", async () => {
      const h = makeController([OW_FLIGHT()]);

      await expect(
        h.controller.createRequest(requestBody({ fareFamily: "FIRST" }) as never),
      ).rejects.toMatchObject({ status: 400, response: { error: "PRICE_UNAVAILABLE" } });
      expect(h.prisma.request.create).not.toHaveBeenCalled();
    });

    it("throws HttpException (not a raw Error) so the public controller can map it", async () => {
      const h = makeController([OW_FLIGHT()]);
      const call = h.controller.createRequest(requestBody({ fareFamily: "FIRST" }) as never);
      await expect(call).rejects.toBeInstanceOf(HttpException);
    });

    it("Phase 3 §20: writes the working commercial snapshot with supplier price + TTL evidence", async () => {
      const h = makeController([OW_FLIGHT()]);

      await h.controller.createRequest(requestBody() as never);

      const data = h.prisma.request.create.mock.calls[0][0].data;
      const snap = data.commercialSnapshot;
      expect(snap).toMatchObject({
        supplierCode: "AZAL",
        serviceType: "flights",
        supplierPrice: 1000,
        supplierCurrency: "AZN",
        markupRate: "0.05",
        markupAmount: 50,
        markupRuleCode: "MKR-00000001",
        markupRuleVersion: 1,
        publicPrice: 1050,
        individualDiscount: false,
        discountType: "NONE",
        discountAmount: 0,
        customerFinalPrice: 1050,
        customerCurrency: "AZN",
        priceSource: "PUBLIC",
        customerAcceptedAt: null,
      });
      // Supplier price evidence = the aggregated response collectedAt (Gate I);
      // the snapshot expires with the recent-search TTL (5 min). The controller
      // stamps collectedAt AFTER the adapter fan-out (azal.controller.ts:125),
      // so under full-suite load it can trail the adapter's timestamp by a
      // ms — assert the same-clock bounds, not string identity.
      const searchResponse = await h.azal.search.mock.results[0].value;
      const adapterAt = Date.parse(searchResponse.collectedAt);
      const snapAt = Date.parse(snap.supplierPriceFetchedAt);
      expect(snapAt).toBeGreaterThanOrEqual(adapterAt);
      expect(snapAt - adapterAt).toBeLessThan(100);
      expect(Date.parse(snap.supplierPriceExpiresAt) - Date.parse(snap.supplierPriceFetchedAt)).toBe(
        5 * 60_000,
      );
      // working snapshot — not yet frozen
      expect(snap.customerAcceptedAt).toBeNull();
    });

    it("Phase 3 §20 (RT): two-leg row total gets one combined supplier snapshot", async () => {
      const h = makeController([
        offer([segment("J2123", "2026-11-01T08:00", "2026-11-01T11:00")], [fare("ECONOMY", 1000)]),
        offer([segment("J2124", "2026-11-08T12:00", "2026-11-08T15:00", "IST", "GYD")], [fare("ECONOMY", 500)]),
      ]);

      await h.controller.createRequest(
        requestBody({
          tripType: "RT",
          returnDate: "2026-11-08",
          segments: [
            segment("J2123", "2026-11-01T08:00", "2026-11-01T11:00"),
            segment("J2124", "2026-11-08T12:00", "2026-11-08T15:00", "IST", "GYD"),
          ],
        }) as never,
      );

      const data = h.prisma.request.create.mock.calls[0][0].data;
      expect(data.displayedPrice).toBe(1575); // 1050 + 525
      expect(data.commercialSnapshot).toMatchObject({
        supplierPrice: 1500,
        markupAmount: 75,
        publicPrice: 1575,
        supplierCurrency: "AZN",
        serviceType: "flights",
      });
    });

    it("Gate I freshness: stale recent-search entry forces a re-search (not reused)", async () => {
      const h = makeController([OW_FLIGHT()]);
      const queryKey = JSON.stringify({
        from: "GYD",
        to: "IST",
        departureDate: "2026-11-01",
        tripType: "OW",
        passengers: PASSENGERS,
      });
      // Stale (6 min old) raw response — if it were reused, displayed would be
      // the un-marked-up 1000 from the cached fare instead of the fresh 1050.
      (h.controller as any).recentSearches.set(queryKey, {
        at: Date.now() - 6 * 60_000,
        response: { flights: [OW_FLIGHT()], collectedAt: new Date(Date.now() - 6 * 60_000).toISOString() },
      });

      await h.controller.createRequest(requestBody() as never);

      expect(h.azal.search).toHaveBeenCalledTimes(1); // re-search happened
      const data = h.prisma.request.create.mock.calls[0][0].data;
      expect(data.displayedPrice).toBe(1050);
      expect(data.commercialSnapshot.supplierPrice).toBe(1000);
    });

    it("Gate I freshness: TTL-fresh recent-search entry is reused (no supplier round-trip)", async () => {
      const h = makeController([OW_FLIGHT()]);
      const queryKey = JSON.stringify({
        from: "GYD",
        to: "IST",
        departureDate: "2026-11-01",
        tripType: "OW",
        passengers: PASSENGERS,
      });
      (h.controller as any).recentSearches.set(queryKey, {
        at: Date.now(),
        response: { flights: [OW_FLIGHT()], collectedAt: new Date().toISOString() },
      });

      await h.controller.createRequest(requestBody() as never);

      expect(h.azal.search).not.toHaveBeenCalled(); // cache hit
      const data = h.prisma.request.create.mock.calls[0][0].data;
      expect(data.displayedPrice).toBe(1000); // from the cached raw fare
      // raw cached fare carries no §20 block → legacy request (money-gate only)
      expect(data.commercialSnapshot).toBeUndefined();
    });
  });

  describe("POST calendar", () => {
    it("per-day outbound prices become PUBLIC with pricing block", async () => {
      const h = makeController([]);
      h.azal.calendar.mockResolvedValue({
        source: "AZAL",
        collectedAt: new Date().toISOString(),
        from: "GYD",
        to: "IST",
        passengers: PASSENGERS,
        prices: {
          "2026-11-01": { date: "2026-11-01", outbound: { price: { amount: 1000, currency: "USD" } } },
          "2026-11-02": { date: "2026-11-02" },
        },
      } as FlightCalendarResult);

      const res = await h.controller.calendar({ from: "GYD", to: "IST", passengers: PASSENGERS } as never);

      const day1 = res.prices["2026-11-01"];
      expect(day1.outbound!.price!.amount).toBe(1050);
      expect(day1.outbound!.price!.pricing).toMatchObject({ supplierAmount: 1000, publicAmount: 1050 });
      expect(res.prices["2026-11-02"].outbound).toBeUndefined();
      expect(h.ruleService.resolve).toHaveBeenCalledWith("AZAL", "flights", expect.any(Date));
    });

    it("calendar prices with amount 0 stay untouched (Gate E)", async () => {
      const h = makeController([]);
      h.azal.calendar.mockResolvedValue({
        source: "AZAL",
        collectedAt: new Date().toISOString(),
        from: "GYD",
        to: "IST",
        passengers: PASSENGERS,
        prices: {
          "2026-11-01": { date: "2026-11-01", outbound: { price: { amount: 0, currency: "USD" } } },
        },
      } as FlightCalendarResult);

      const res = await h.controller.calendar({ from: "GYD", to: "IST", passengers: PASSENGERS } as never);
      expect(res.prices["2026-11-01"].outbound!.price!.amount).toBe(0);
      expect(res.prices["2026-11-01"].outbound!.price!.pricing).toBeUndefined();
    });
  });
});
