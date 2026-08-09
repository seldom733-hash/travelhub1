import { describe, expect, it } from "vitest";
import {
  availabilityText,
  buildFilterControls,
  filterControlFor,
  formatAttributeValue,
  humanizeKey,
  sectionsFor,
} from "./marketplace-utils";
import type { PublicFilterOption } from "./public-api";

describe("marketplace-utils (Step 1.7 §10/§12/§15)", () => {
  it("filterControlFor: enum с опциями → select, boolean → checkbox, integer → number, date → date, string без опций → text", () => {
    const enumF: PublicFilterOption = { key: "level", label: "Level", type: "enum", options: ["easy", "hard"] };
    const boolF: PublicFilterOption = { key: "family", label: "Family", type: "boolean" };
    const intF: PublicFilterOption = { key: "days", label: "Days", type: "integer", min: 1 };
    const dateF: PublicFilterOption = { key: "start", label: "Start", type: "date" };
    const strF: PublicFilterOption = { key: "city", label: "City", type: "string" };

    expect(filterControlFor(enumF)).toMatchObject({ kind: "select", options: ["easy", "hard"] });
    expect(filterControlFor(boolF)).toMatchObject({ kind: "checkbox" });
    expect(filterControlFor(intF)).toMatchObject({ kind: "number", min: 1 });
    expect(filterControlFor(dateF)).toMatchObject({ kind: "date" });
    expect(filterControlFor(strF)).toMatchObject({ kind: "text" });
  });

  it("buildFilterControls: маппит весь metadata", () => {
    const controls = buildFilterControls({
      filters: [
        { key: "days", label: "Days", type: "integer" },
        { key: "family", label: "Family", type: "boolean" },
      ],
    });
    expect(controls.map((c) => c.kind)).toEqual(["number", "checkbox"]);
  });

  it("humanizeKey: camelCase/snake_case → слова с заглавной", () => {
    expect(humanizeKey("meetingPoint")).toBe("Meeting Point");
    expect(humanizeKey("cancellation_policy")).toBe("Cancellation Policy");
    expect(humanizeKey("days")).toBe("Days");
  });

  it("formatAttributeValue: массив → join, объект → JSON, null → пусто", () => {
    expect(formatAttributeValue(["a", "b"])).toBe("a, b");
    expect(formatAttributeValue(null)).toBe("");
    expect(formatAttributeValue(undefined)).toBe("");
    expect(formatAttributeValue({ a: 1 })).toBe('{"a":1}');
    expect(formatAttributeValue(7)).toBe("7");
  });

  it("sectionsFor: группировка по известным секциям, boolean → Да/Нет, пустые пропускаются", () => {
    const sections = sectionsFor(
      { days: 5, meetingPoint: "Baku Center", included: ["Hotel", "Guide"], familyFriendly: true, internalNote: "" },
      "ru",
    );
    const bySection = Object.fromEntries(sections.map((s) => [s.section, s.items]));
    expect(bySection["duration"]).toEqual([{ key: "days", label: "Days", value: "5" }]);
    expect(bySection["location"]).toHaveLength(1);
    expect(bySection["included"]![0].value).toBe("Hotel, Guide");
    expect(bySection["other"]).toEqual([{ key: "familyFriendly", label: "Family Friendly", value: "Да" }]);
    // internalNote пустой — пропущен
    expect(sections.every((s) => !s.items.some((i) => i.key === "internalNote"))).toBe(true);
  });

  it("sectionsFor: null/empty → пустой массив", () => {
    expect(sectionsFor(null, "ru")).toEqual([]);
    expect(sectionsFor({}, "ru")).toEqual([]);
  });

  it("availabilityText: null → unknown; данные → available; booked>=slots → limited", () => {
    expect(availabilityText(null, "en").tone).toBe("unknown");
    expect(availabilityText({ availableFrom: null, datesCount: 3, totalSlots: 20, totalBooked: 2, totalReserved: 1 }, "en").tone).toBe("available");
    expect(availabilityText({ availableFrom: null, datesCount: 3, totalSlots: 4, totalBooked: 3, totalReserved: 1 }, "en").tone).toBe("limited");
  });
});
