import { AnexHotelAdapter, type AnexHotelPriceRow } from "./anex-hotel.adapter";
import type { SupplierSearchQuery } from "../supplier.types";

/**
 * Unit tests for the local city filter of the ANEX hotel adapter — the two
 * channels that make city searches work when the supplier answers with a
 * NEGATIVE townInc (no-flight packets) and with its own spelling of the town
 * («Гёйнюк» vs Master Geography «Гойнюк»).
 */
describe("AnexHotelAdapter applyLocalFilters", () => {
  const adapter = new AnexHotelAdapter({} as never);
  const filter = (rows: AnexHotelPriceRow[], query: Partial<SupplierSearchQuery>) =>
    (adapter as never as {
      applyLocalFilters(r: AnexHotelPriceRow[], q: SupplierSearchQuery): AnexHotelPriceRow[];
    }).applyLocalFilters(rows, { adults: 2, ...query });

  const vienna: AnexHotelPriceRow = { townInc: -767422, townName: "Vienna", hotelTownName: "Vienna" };
  const goynuk: AnexHotelPriceRow = { townInc: 16, townName: "Гёйнюк", hotelTownName: "Гёйнюк" };
  const beldibi: AnexHotelPriceRow = { townInc: 21, townName: "Белдиби", hotelTownName: "Белдиби" };

  it("keeps all rows when no city filter is set", () => {
    expect(filter([vienna, goynuk, beldibi], {})).toHaveLength(3);
  });

  it("matches by id channel when townInc is positive (legacy behaviour)", () => {
    expect(filter([goynuk, beldibi], { towns: "16" })).toEqual([goynuk]);
  });

  it("matches by name when the id channel is dead (negative townInc)", () => {
    // ANEX no-flight rows: townInc is a negative hash, never the link id.
    const out = filter([vienna], { towns: "1150", townNames: ["Вена", "Vienna"] });
    expect(out).toEqual([vienna]);
  });

  it("matches the supplier's «Гёйнюк» against «Гойнюк» via the translit key", () => {
    const out = filter([goynuk, beldibi], { townNames: ["Гойнюк", "Goynuk"] });
    expect(out).toEqual([goynuk]);
  });

  it("matches via hotelTownName when townName is absent", () => {
    const row: AnexHotelPriceRow = { townInc: -1, hotelTownName: "Гёйнюк" };
    expect(filter([row], { townNames: ["Goynuk"] })).toEqual([row]);
  });

  it("rejects other towns once a city filter is active", () => {
    expect(filter([vienna, goynuk, beldibi], { townNames: ["Гойнюк"] })).toEqual([goynuk]);
  });
});
