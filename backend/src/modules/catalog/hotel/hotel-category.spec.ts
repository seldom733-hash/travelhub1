import { canonicalHotelCategory } from "./hotel-category";

describe("canonicalHotelCategory", () => {
  it.each([
    ["4*", "STAR", "4*", 4],
    ["5*", "STAR", "5*", 5],
    ["5* DELUXE", "STAR", "5*", 5],
    ["4*/HV1", "STAR", "4*", 4],
    ["5*+", "STAR", "5*", 5],
    ["Boutique", "PROPERTY_TYPE", "Boutique", null],
    ["Boutique Hotel", "PROPERTY_TYPE", "Boutique", null],
    ["GUEST HOUSE", "PROPERTY_TYPE", "Guest House", null],
    ["Guesthouse", "PROPERTY_TYPE", "Guest House", null],
    ["Deluxe", "PROPERTY_TYPE", "Deluxe", null],
    ["Apart", "PROPERTY_TYPE", "Apart", null],
    ["Apart Hotel", "PROPERTY_TYPE", "Apart", null],
    ["Apartments", "PROPERTY_TYPE", "Apart", null],
  ])("keeps %s", (raw, kind, label, stars) => {
    expect(canonicalHotelCategory(raw)).toEqual(
      stars === null
        ? { kind, label, stars: null }
        : { kind, label, stars },
    );
  });

  it.each(["1*", "2*", "3*", "Adults only", "Family", "HALAL", "Kids Go Free", "Recommend", "HV-1"])(
    "drops %s",
    (raw) => {
      expect(canonicalHotelCategory(raw)).toBeNull();
    },
  );
});
