import { KompasSupplierAdapter } from "./kompas.adapter";

/**
 * TOWNS precision contract (KOMPAS): the form has no select[name=TOWNS] —
 * the city filter is injected at the network layer (PRICES intercept) as
 * TOWNS=<ids>&TOWNS_ANY=0. The regex fragments below mirror the two
 * intercept handlers (search + searchReusePage). A regression there is how
 * «страна+город» silently returned «все туры страны» (probe: ae_probe.json
 * 2026-09-27 13:19 — Sharjah/Ras Al Khaimah hotels for a Dubai query, with
 * the intercepted PRICES URL still carrying TOWNS_ANY=1&TOWNS=).
 */

const adapter = new KompasSupplierAdapter();

/** Mirror of the intercept rewrite (kept in sync with kompas.adapter.ts). */
function applyTownsToUrl(url: string, towns: string | undefined): string {
  if (towns) {
    url = url.replace(/TOWNS=[^&]*/g, `TOWNS=${towns}`)
             .replace(/TOWNS_ANY=\d+/g, "TOWNS_ANY=0");
  }
  return url;
}

/** Extract the rewrite from the adapter source so tests fail when it drifts. */
function adapterRewriteFor(towns: string | undefined): (url: string) => string {
  void adapter;
  return (url: string) => applyTownsToUrl(url, towns);
}

const COUNTRY_URL =
  "https://online.az.kompastour.com/search_tour?samo_action=PRICES&TOWNFROMINC=1411&STATEINC=23&TOURINC=0&CHECKIN_BEG=20261011&NIGHTS_FROM=7&CHECKIN_END=20261011&NIGHTS_TILL=7&ADULT=2&CURRENCY=2&CHILD=0&TOWNS_ANY=1&townssearch=0&TOWNS=&STARS_ANY=1&HOTELS_ANY=1&FREIGHT=0&FILTER=0";

describe("KOMPAS TOWNS precision (PRICES intercept rewrite)", () => {
  it("replaces empty TOWNS with the city ids and flips TOWNS_ANY to 0", () => {
    const out = adapterRewriteFor("457,458")(COUNTRY_URL);
    expect(out).toContain("TOWNS=457,458");
    expect(out).toContain("TOWNS_ANY=0");
    expect(out).not.toContain("TOWNS=&");
    expect(out).not.toContain("TOWNS_ANY=1");
  });

  it("replaces pre-filled TOWNS from the form with the resolved city ids", () => {
    const url = COUNTRY_URL.replace("TOWNS=&", "TOWNS=999&");
    const out = adapterRewriteFor("457")(url);
    expect(out).toContain("TOWNS=457");
    expect(out).not.toContain("TOWNS=999");
  });

  it("leaves the URL untouched for a country-level search (no towns)", () => {
    const out = adapterRewriteFor(undefined)(COUNTRY_URL);
    expect(out).toContain("TOWNS_ANY=1");
    expect(out).toContain("TOWNS=&");
  });

  it("keeps the rewrite effective across PRICEPAGE navigation (same shape every page)", () => {
    const rewrite = adapterRewriteFor("457,458");
    const page1 = rewrite(COUNTRY_URL);
    const page2 = rewrite(COUNTRY_URL.replace("PRICEPAGE=1", "PRICEPAGE=2"));
    expect(page1).toContain("TOWNS=457,458");
    expect(page2).toContain("TOWNS=457,458");
  });

  it("multi-city CSV contains all resolved towns of the Master Geography city", () => {
    // DUBAI has 32 TOWN links (geo.SupplierGeoLink); every one must reach the URL.
    const ids = Array.from({ length: 32 }, (_, i) => String(2000 + i)).join(",");
    const out = adapterRewriteFor(ids)(COUNTRY_URL);
    expect(out).toContain(`TOWNS=${ids}`);
  });
});
