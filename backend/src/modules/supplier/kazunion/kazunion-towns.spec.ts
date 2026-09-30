import { KazunionHttpService } from "./kazunion-http.service";

/**
 * TOWNS precision contract (KazUnion): a city-level search MUST send
 * TOWNS=<ids>&TOWNS_ANY=0; a country-level search MUST send TOWNS_ANY=1
 * with an empty TOWNS. Bug this locks down: an empty/whitespace townsCsv
 * used to flip TOWNS_ANY to 0 with no towns — or drop the filter entirely.
 */

function makeService(): KazunionHttpService {
  const svc = new KazunionHttpService();
  return svc;
}

const baseParams = {
  townFromInc: "849",
  stateInc: "6",
  tourInc: "2791",
  checkInBeg: "2026-10-05",
  checkInEnd: "2026-10-05",
  nightsFrom: 7,
  nightsTill: 7,
  adults: 2,
  children: 0,
  maxPages: 1,
};

function queryOf(url: string): URLSearchParams {
  const qs = url.slice(url.indexOf("?") + 1);
  return new URLSearchParams(qs);
}

describe("KazUnion TOWNS precision (PRICES URL builder)", () => {
  it("sends TOWNS=<csv>&TOWNS_ANY=0 when townsCsv is provided", () => {
    const svc = makeService();
    const url = (svc as unknown as { buildPricesUrl: (p: object, page: number) => string }).buildPricesUrl(
      { ...baseParams, townsCsv: "174,1718" },
      1,
    );
    const q = queryOf(url);
    expect(q.get("TOWNS")).toBe("174,1718");
    expect(q.get("TOWNS_ANY")).toBe("0");
  });

  it("sends TOWNS_ANY=1 with empty TOWNS for a country-level search", () => {
    const svc = makeService();
    const url = (svc as unknown as { buildPricesUrl: (p: object, page: number) => string }).buildPricesUrl(
      baseParams,
      1,
    );
    const q = queryOf(url);
    expect(q.get("TOWNS")).toBe("");
    expect(q.get("TOWNS_ANY")).toBe("1");
  });

  it("whitespace-only townsCsv must NOT enable the town filter", () => {
    const svc = makeService();
    const url = (svc as unknown as { buildPricesUrl: (p: object, page: number) => string }).buildPricesUrl(
      { ...baseParams, townsCsv: "   " },
      1,
    );
    const q = queryOf(url);
    // Adapter strips whitespace before building params; a blank CSV reaching
    // the builder must behave like no filter (TOWNS_ANY=1), never like a
    // broken TOWNS=&TOWNS_ANY=0 pair.
    expect(q.get("TOWNS_ANY")).toBe("1");
  });

  it("falls back to townKey when townsCsv is absent (fuzzy destination match)", () => {
    const svc = makeService();
    const url = (svc as unknown as { buildPricesUrl: (p: object, page: number) => string }).buildPricesUrl(
      { ...baseParams, townKey: "174" },
      1,
    );
    const q = queryOf(url);
    expect(q.get("TOWNS")).toBe("174");
    expect(q.get("TOWNS_ANY")).toBe("0");
  });

  it("keeps TOWNS filter across PRICEPAGE pagination", () => {
    const svc = makeService();
    const build = (svc as unknown as { buildPricesUrl: (p: object, page: number) => string }).buildPricesUrl.bind(svc);
    const p1 = queryOf(build({ ...baseParams, townsCsv: "174" }, 1));
    const p2 = queryOf(build({ ...baseParams, townsCsv: "174" }, 2));
    expect(p1.get("TOWNS")).toBe("174");
    expect(p2.get("TOWNS")).toBe("174");
    expect(p1.get("TOWNS_ANY")).toBe("0");
    expect(p2.get("TOWNS_ANY")).toBe("0");
  });
});
