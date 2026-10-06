/**
 * Supplier registry (PHASE 4 §4.7) — registry SSOT spec.
 *
 * 1) Unit: listSuppliers() fetches /api/v1/public/supplier/suppliers?service=,
 *    normalizes {code,name} (name→code fallback, sorted), dedupes in-flight
 *    requests, caches successes and retries failures; supplierLabel() falls
 *    back to the raw code.
 * 2) Source-guard (static): the UI carries NO hardcoded supplier label maps,
 *    label ternaries, or supplier option lists — labels/options come only from
 *    the registry helper. Captcha unions/KompasCaptchaModal stay (by design).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { supplierLabel, type SupplierOption } from "./supplier-registry";

const ROOT = join(__dirname, "..");
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");

const TOUR_RESULTS = read("components/supplier/TourResultsTable.tsx");
const OFFER_DETAILS = read("components/supplier/OfferDetailsModal.tsx");
const TOUR_DETAIL = read("components/supplier/TourDetail.tsx");
const OFFER_MODAL = read("components/supplier/OfferModal.tsx");
const FLIGHT_SEARCH = read("components/marketplace/search/FlightSearch.tsx");
const FLIGHT_RESULTS = read("components/marketplace/search/FlightResults.tsx");
const REGISTRY_LIB = read("lib/supplier-registry.ts");
const SUPPLIER_API = read("lib/supplier-api.ts");

describe("supplierLabel — registry name with raw-code fallback", () => {
  const options: SupplierOption[] = [
    { code: "ANEX", name: "ANEX (anextour.az)" },
    { code: "KOMPAS", name: "KOMPAS (SAMO)" },
  ];

  it("resolves the registry name for a known code", () => {
    expect(supplierLabel(options, "KOMPAS")).toBe("KOMPAS (SAMO)");
  });

  it("falls back to the raw code when the registry has no entry", () => {
    expect(supplierLabel(options, "NEWWITHOUT")).toBe("NEWWITHOUT");
  });

  it("returns '' for missing/empty codes (no fabricated supplier)", () => {
    expect(supplierLabel(options, undefined)).toBe("");
    expect(supplierLabel(options, null)).toBe("");
    expect(supplierLabel(options, "")).toBe("");
  });
});

describe("listSuppliers — fetch / cache / normalization", () => {
  const fetchMock = vi.fn();
  const ORIGINAL_FETCH = globalThis.fetch;

  beforeEach(() => {
    vi.resetModules(); // fresh module → fresh cache per test
    fetchMock.mockReset();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = ORIGINAL_FETCH;
  });

  const load = () => import("./supplier-registry");

  it("requests the public suppliers endpoint with ?service=", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => [{ code: "AZAL", name: "AZAL" }],
    });
    const { listSuppliers } = await load();
    const list = await listSuppliers("flights");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toBe(
      "/api/v1/public/supplier/suppliers?service=flights",
    );
    expect(list).toEqual([{ code: "AZAL", name: "AZAL" }]);
  });

  it("normalizes: name→code fallback, drops malformed entries, sorts by code", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => [
        { code: "SUMMERTOUR", name: "Summertour (summertour.az)" },
        { code: "KOMPAS" }, // name missing → code
        { name: "no-code" }, // dropped
        null, // dropped
        "garbage", // dropped
      ],
    });
    const { listSuppliers } = await load();
    const list = await listSuppliers("tours");
    expect(list).toEqual([
      { code: "KOMPAS", name: "KOMPAS" },
      { code: "SUMMERTOUR", name: "Summertour (summertour.az)" },
    ]);
  });

  it("caches successes (one fetch per service) and dedupes in-flight calls", async () => {
    let resolveJson: ((v: unknown) => void) | null = null;
    fetchMock.mockResolvedValue({
      ok: true,
      json: () =>
        new Promise((res) => {
          resolveJson = res;
        }),
    });
    const { listSuppliers } = await load();
    const first = listSuppliers("tours");
    const second = listSuppliers("tours"); // in-flight dedupe
    await vi.waitFor(() => {
      if (!resolveJson) throw new Error("json() not started yet");
    });
    resolveJson!([{ code: "KOMPAS", name: "KOMPAS (SAMO)" }]);
    expect(await first).toEqual(await second);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await listSuppliers("tours"); // cached
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does NOT cache failures — the next call retries", async () => {
    fetchMock.mockRejectedValueOnce(new Error("network down"));
    const { listSuppliers } = await load();
    await expect(listSuppliers("tours")).rejects.toThrow("network down");

    fetchMock.mockResolvedValue({ ok: false, status: 500, json: async () => [] });
    expect(await listSuppliers("tours")).toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe("§4.7 source-guard — no hardcoded supplier lists in the UI", () => {
  it("TourResultsTable: SUPPLIER_LABELS removed, labels from useSupplierLabels", () => {
    expect(TOUR_RESULTS).not.toContain("SUPPLIER_LABELS");
    expect(TOUR_RESULTS).not.toMatch(/KOMPAS:\s*"/);
    expect(TOUR_RESULTS).toContain('useSupplierLabels("tours")');
  });

  it("OfferDetailsModal: label ternary removed, labels from useSupplierLabels", () => {
    expect(OFFER_DETAILS).not.toContain('supplierCode === "SUMMERTOUR"');
    expect(OFFER_DETAILS).not.toContain('"Компас"');
    expect(OFFER_DETAILS).toContain('useSupplierLabels("tours")');
  });

  it("TourDetail: no KOMPAS default — supplier from attribute/registry, passed to OfferModal", () => {
    expect(TOUR_DETAIL).not.toContain('?? "KOMPAS"');
    expect(TOUR_DETAIL).toContain('useSupplierOptions("tours")');
    expect(TOUR_DETAIL).toContain("supplierCode={supplierCode}");
    expect(TOUR_DETAIL).not.toContain("Summer ID:");
  });

  it("OfferModal: no KOMPAS default — supplier from calendar query prop", () => {
    expect(OFFER_MODAL).not.toContain('?? "KOMPAS"');
    expect(OFFER_MODAL).toContain("supplierCode: string");
    expect(OFFER_MODAL).toContain("resolvedSupplier");
    // captcha modal stays by design
    expect(OFFER_MODAL).toContain("KompasCaptchaModal");
  });

  it("FlightSearch: no hardcoded supplier options — options from registry", () => {
    expect(FLIGHT_SEARCH).not.toContain('value="AZAL"');
    expect(FLIGHT_SEARCH).not.toContain('value="AVIASALES"');
    expect(FLIGHT_SEARCH).toContain('useSupplierOptions("flights")');
    expect(FLIGHT_SEARCH).toContain('value="ALL"'); // sentinel stays
  });

  it("FlightResults: no AZAL default — labels from registry", () => {
    expect(FLIGHT_RESULTS).not.toContain('|| "AZAL"');
    expect(FLIGHT_RESULTS).toContain('useSupplierLabels("flights")');
  });

  it("registry lib targets the backend public suppliers endpoint (registry SSOT)", () => {
    expect(REGISTRY_LIB).toContain("public/supplier");
    expect(REGISTRY_LIB).toContain("listSuppliers");
    expect(REGISTRY_LIB).toContain("useSupplierLabels");
  });

  it("captcha supplier unions + KompasCaptchaModal imports stay untouched (by design)", () => {
    expect(SUPPLIER_API).toContain('supplier: "KOMPAS" | "SUMMERTOUR"');
    expect(OFFER_MODAL).toContain("KompasCaptchaModal");
    expect(read("components/supplier/MonthlyCalendar.tsx")).toContain("KompasCaptchaModal");
  });
});
