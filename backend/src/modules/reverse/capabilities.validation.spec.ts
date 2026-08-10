import { normalizeDestinations } from "./capabilities.validation";
import { ValidationDomainError } from "../../shared/errors";

describe("reverse.capabilities.validation — normalizeDestinations", () => {
  it("accepts country-only coverage", () => {
    expect(normalizeDestinations([{ countryCode: "TR" }])).toEqual([{ countryCode: "TR" }]);
  });

  it("accepts country+city from canonical reference", () => {
    expect(normalizeDestinations([{ countryCode: "TR", cityCode: "ANTALYA" }])).toEqual([
      { countryCode: "TR", cityCode: "ANTALYA" },
    ]);
  });

  it("accepts worldwide as exclusive entry", () => {
    expect(normalizeDestinations([{ worldwide: true }])).toEqual([{ worldwide: true }]);
  });

  it("rejects worldwide combined with concrete destination", () => {
    expect(() => normalizeDestinations([{ worldwide: true }, { countryCode: "TR" }])).toThrow(ValidationDomainError);
  });

  it("rejects invalid country format", () => {
    expect(() => normalizeDestinations([{ countryCode: "tr" }])).toThrow(ValidationDomainError);
    expect(() => normalizeDestinations([{ countryCode: "TUR" }])).toThrow(ValidationDomainError);
    expect(() => normalizeDestinations([{ countryCode: "" }])).toThrow(ValidationDomainError);
  });

  it("rejects reserved pseudo-code WW as fake country", () => {
    expect(() => normalizeDestinations([{ countryCode: "WW" }])).toThrow(ValidationDomainError);
  });

  it("rejects unknown city code", () => {
    expect(() => normalizeDestinations([{ countryCode: "TR", cityCode: "ZZZ" }])).toThrow(ValidationDomainError);
  });

  it("rejects city belonging to another country", () => {
    expect(() => normalizeDestinations([{ countryCode: "AZ", cityCode: "ANTALYA" }])).toThrow(ValidationDomainError);
  });

  it("rejects empty array", () => {
    expect(() => normalizeDestinations([])).toThrow(ValidationDomainError);
  });

  it("rejects duplicate entries", () => {
    expect(() =>
      normalizeDestinations([{ countryCode: "TR" }, { countryCode: "TR", cityCode: "ANTALYA" }, { countryCode: "TR" }]),
    ).toThrow(ValidationDomainError);
  });

  it("rejects unknown keys", () => {
    expect(() => normalizeDestinations([{ countryCode: "TR", region: "Med" } as never])).toThrow(
      ValidationDomainError,
    );
  });

  it("rejects non-array / oversized input", () => {
    expect(() => normalizeDestinations({ countryCode: "TR" } as never)).toThrow(ValidationDomainError);
    const many = Array.from({ length: 51 }, (_, i) => ({ countryCode: `T${i}` }));
    expect(() => normalizeDestinations(many)).toThrow(ValidationDomainError);
  });

  it("sorts deterministically", () => {
    expect(normalizeDestinations([{ countryCode: "GE" }, { countryCode: "AZ" }])).toEqual([
      { countryCode: "AZ" },
      { countryCode: "GE" },
    ]);
  });
});
