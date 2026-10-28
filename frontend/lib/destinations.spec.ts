import { describe, expect, it } from "vitest";
import { countryFlag, countryFlagUrl, countryName, destinationLabel } from "./destinations";

describe("destinations helpers", () => {
  it("builds an ISO flag URL and emoji", () => {
    expect(countryFlagUrl("th")).toBe("https://flagcdn.com/w160/th.png");
    expect(countryFlagUrl("bad")).toBe("");
    expect(countryFlag("AZ")).toBe("🇦🇿");
  });

  it("localizes names with a deterministic fallback chain", () => {
    const names = { ru: "Таиланд", az: "Tayland", en: "Thailand" };
    expect(countryName(names, "az")).toBe("Tayland");
    expect(countryName(names, "de")).toBe("Таиланд");
    expect(countryName(null, "ru")).toBe("");
  });

  it("falls back to the country code when the name is absent", () => {
    expect(destinationLabel({ code: "TH", names: {}, tours: 1, hotels: 1 }, "ru")).toBe("TH");
  });
});
