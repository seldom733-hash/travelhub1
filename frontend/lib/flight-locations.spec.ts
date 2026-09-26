// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import {
  findFlightAirports,
  getFlightLocationCode,
  setRemoteAirports,
} from "./flight-locations";

describe("flight directory remote merge", () => {
  it("appends unknown remote codes after the bundled list", () => {
    const before = findFlightAirports("").length;
    setRemoteAirports([
      { code: "LON", city: "Лондон-remote", country: "", airport: "", search: "" },
      { code: "NEW", city: "Нью-Сити", country: "Тестландия", airport: "New Airport", search: "new нью-сити" },
    ]);

    const all = findFlightAirports("");
    expect(all.length).toBe(before + 1);
    // Bundled entry keeps priority on code conflict.
    expect(getFlightLocationCode("Лондон")).toBe("LON");
    expect(all.find((a) => a.code === "LON")?.city).not.toBe("Лондон-remote");
    // New remote city is searchable and resolvable.
    expect(findFlightAirports("нью-сити").map((a) => a.code)).toContain("NEW");
    expect(getFlightLocationCode("Нью-Сити")).toBe("NEW");

    setRemoteAirports([]);
  });
});
