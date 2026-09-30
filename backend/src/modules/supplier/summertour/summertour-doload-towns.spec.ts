import { buildSummerDoloadTownsParam } from "./summertour-new.adapter";

/**
 * DOLOAD navigation URLs are built by string concatenation (unlike the XHR
 * path that goes through buildSummerXhrUrl). A regression there omitted
 * TOWNS entirely, so a city search silently widened to the whole country.
 * These tests lock the towns fragment for both DOLOAD URL shapes
 * (init URL and per-date URL share the same builder).
 */
describe("Summertour DOLOAD towns param (страна+город precision)", () => {
  it("appends TOWNS=<csv>&TOWNS_ANY=0 when the request carries towns", () => {
    expect(buildSummerDoloadTownsParam("1433,1434")).toBe(
      "&TOWNS=1433%2C1434&TOWNS_ANY=0",
    );
  });

  it("appends a single-town filter without CSV separators", () => {
    expect(buildSummerDoloadTownsParam("1959")).toBe("&TOWNS=1959&TOWNS_ANY=0");
  });

  it("appends nothing for a country-level search (no towns)", () => {
    expect(buildSummerDoloadTownsParam(undefined)).toBe("");
    expect(buildSummerDoloadTownsParam("")).toBe("");
  });
});
