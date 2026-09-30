import {
  buildSummerSearchRequest,
  buildSummerXhrUrl,
} from "./summertour.request-builder";

/**
 * TOWNS precision contract (SAMO): a city-level search MUST send
 * TOWNS=<ids>&TOWNS_ANY=0; a country-level search must NOT restrict towns.
 * Bug this locks down: omitting TOWNS from DOLOAD/XHR URLs silently widened
 * «страна+город» to «все туры страны».
 */

describe("Summertour TOWNS precision (request builder)", () => {
  it("sets TOWNS=<csv>&TOWNS_ANY=0 when towns are provided", () => {
    const req = buildSummerSearchRequest({ tourIncValue: "229", towns: "1433,1434" });
    expect(req.TOWNS).toBe("1433,1434");
    expect(req.TOWNS_ANY).toBe("0");
  });

  it("leaves TOWNS unset for a country-level search", () => {
    const req = buildSummerSearchRequest({ tourIncValue: "229" });
    expect(req.TOWNS).toBeUndefined();
    expect(req.TOWNS_ANY).toBeUndefined();
  });

  it("includes TOWNS + TOWNS_ANY=0 in the built PRICES XHR URL", () => {
    const req = buildSummerSearchRequest({ tourIncValue: "229", towns: "1433,1434" });
    const url = buildSummerXhrUrl(req);
    expect(url).toContain("TOWNS=1433%2C1434");
    expect(url).toContain("TOWNS_ANY=0");
  });

  it("does NOT include TOWNS in the XHR URL for a country-level search", () => {
    const req = buildSummerSearchRequest({ tourIncValue: "229" });
    const url = buildSummerXhrUrl(req);
    expect(url).not.toContain("TOWNS=");
    expect(url).not.toContain("TOWNS_ANY");
  });

  it("keeps TOWNS in a TOWNS-action URL (calendar/town-discovery flow)", () => {
    const req: ReturnType<typeof buildSummerSearchRequest> = buildSummerSearchRequest({
      tourIncValue: "229",
      towns: "1433",
    });
    const url = buildSummerXhrUrl({ ...req, useTownsAction: true });
    expect(url).toContain("samo_action=TOWNS");
    expect(url).toContain("TOWNS=1433");
    expect(url).toContain("TOWNS_ANY=0");
  });

  it("encodes multi-town CSV safely (no raw commas break the param)", () => {
    const req = buildSummerSearchRequest({ tourIncValue: "254", towns: "1959,1965,1967" });
    const url = buildSummerXhrUrl(req);
    // URLSearchParams encodes the CSV commas as %2C — supplier accepts both forms.
    expect(url).toMatch(/TOWNS=1959(%2C|,)1965(%2C|,)1967/);
    expect(url).toContain("TOWNS_ANY=0");
  });
});
