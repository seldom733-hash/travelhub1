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

/**
 * Confirmed supplier contract (owner-supplied real request):
 * `ADULT=12&CHILD=3&AGES=2,6,12` — ONE comma-separated AGES param.
 * Locks the audit gap: ages used to be built (AGE1-3) but NEVER serialized
 * into the active XHR URL. The active path must now carry AGES and must NOT
 * carry AGE1/AGE2/AGE3.
 */
describe("Summertour AGES contract (request builder)", () => {
  it("builds AGES=<csv> for every child (children=3 → AGES=2,6,12)", () => {
    const req = buildSummerSearchRequest({
      tourIncValue: "229",
      adults: 2,
      children: 3,
      childAges: [2, 6, 12],
    });
    expect(req.ADULT).toBe("2");
    expect(req.CHILD).toBe("3");
    expect(req.AGES).toBe("2,6,12");
  });

  it("serializes AGES into the active PRICES XHR URL (the former lost-age gap)", () => {
    const req = buildSummerSearchRequest({
      tourIncValue: "229",
      adults: 2,
      children: 3,
      childAges: [2, 6, 12],
    });
    const url = buildSummerXhrUrl(req);
    expect(url).toContain("ADULT=2");
    expect(url).toContain("CHILD=3");
    expect(url).toMatch(/AGES=2(%2C|,)6(%2C|,)12/);
  });

  it("does NOT emit AGE1/AGE2/AGE3 anywhere on the active XHR", () => {
    const req = buildSummerSearchRequest({
      tourIncValue: "229",
      adults: 2,
      children: 3,
      childAges: [2, 6, 12],
    });
    const url = buildSummerXhrUrl(req);
    expect(url).not.toContain("AGE1=");
    expect(url).not.toContain("AGE2=");
    expect(url).not.toContain("AGE3=");
    const legacy = req as unknown as Record<string, unknown>;
    expect(legacy.AGE1).toBeUndefined();
    expect(legacy.AGE2).toBeUndefined();
    expect(legacy.AGE3).toBeUndefined();
  });

  it("preserves the canonical age ordering (composition order, not sorted)", () => {
    const req = buildSummerSearchRequest({
      tourIncValue: "229",
      children: 3,
      childAges: [12, 2, 6],
    });
    expect(req.AGES).toBe("12,2,6");
  });

  it("emits AGES for a single child and omits it when there are no children", () => {
    const one = buildSummerSearchRequest({ tourIncValue: "229", children: 1, childAges: [5] });
    expect(one.AGES).toBe("5");
    expect(buildSummerXhrUrl(one)).toMatch(/AGES=5/);

    const none = buildSummerSearchRequest({ tourIncValue: "229", children: 0, childAges: [] });
    expect(none.AGES).toBeUndefined();
    expect(buildSummerXhrUrl(none)).not.toContain("AGES=");
  });

  it("refresh/recheck reuses the same builder → same composition on the wire", () => {
    // refreshPrice (summertour-new.adapter) and rebuildCaptchaAction both
    // rebuild via buildSummerSearchRequest(searchContext) + buildSummerXhrUrl.
    const searchContext = { adults: 2, children: 3, childAges: [2, 6, 12] };
    const url = buildSummerXhrUrl(buildSummerSearchRequest({ tourIncValue: "229", ...searchContext }));
    expect(url).toMatch(/AGES=2(%2C|,)6(%2C|,)12/);
  });
});
