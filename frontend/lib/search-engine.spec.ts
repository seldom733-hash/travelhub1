import { describe, expect, it } from "vitest";
import { searchGeoAvailability } from "./search-engine";

const DIRECTORY = {
  service: "tours",
  countries: [
    { id: "c1", code: "GR", names: { ru: "Греция", en: "Greece", az: "Yunanıstan" }, parentId: null, productCount: 2 },
  ],
  cities: [
    { id: "city1", code: "ATH", names: { ru: "Афины", en: "Athens", az: "Afina" }, parentId: "c1", productCount: 2 },
    { id: "city2", code: "SKG", names: { ru: "Салоники", en: "Thessaloniki", az: "Saloniki" }, parentId: "c1", productCount: 0 },
  ],
  resorts: [],
  airports: [],
};

describe("searchGeoAvailability", () => {
  it("matches by code and localized names", () => {
    expect(searchGeoAvailability(DIRECTORY, "афи").map((r) => r.id)).toEqual(["ATH"]);
    expect(searchGeoAvailability(DIRECTORY, "ATH").map((r) => r.id)).toEqual(["ATH"]);
    expect(searchGeoAvailability(DIRECTORY, "грец").map((r) => r.id)).toEqual(["GR"]);
  });

  it("returns stable geo codes as ids with parent subtitle", () => {
    const [city] = searchGeoAvailability(DIRECTORY, "салоники");
    expect(city.id).toBe("SKG");
    expect(city.name).toBe("Салоники");
    expect(city.subtitle).toBe("SKG · GR");
  });

  it("requires at least 2 chars", () => {
    expect(searchGeoAvailability(DIRECTORY, "а")).toEqual([]);
  });
});
