import { ValidationDomainError } from "../../shared/errors";
import { validateAttributes, validateCategorySlug, validateSchemaConfig, type AttributeDef } from "./category-schema.validation";

describe("Category Schema validation (Step 1.1)", () => {
  const defs: AttributeDef[] = [
    { key: "checkIn", label: "Check-in", type: "time", required: true },
    { key: "checkOut", type: "time", required: true },
    { key: "roomType", type: "enum", required: true, options: ["standard", "deluxe", "suite"] },
    { key: "starRating", type: "number", required: true, min: 1, max: 5 },
    { key: "groupSize", type: "integer", min: 1, max: 100 },
    { key: "iataCode", type: "string", pattern: "^[A-Z]{3}$" },
    { key: "deposit", type: "currency" },
  ];

  describe("validateAttributes", () => {
    it("принимает валидные attributes", () => {
      const attrs = {
        checkIn: "14:00",
        checkOut: "12:00",
        roomType: "deluxe",
        starRating: 4,
        groupSize: 8,
        iataCode: "GYD",
        deposit: "USD 100",
      };
      expect(validateAttributes({ attributes: defs }, attrs)).toEqual(attrs);
    });

    it("отклоняет неизвестный attribute", () => {
      expect(() => validateAttributes({ attributes: defs }, { checkIn: "14:00", checkOut: "12:00", roomType: "standard", starRating: 4, hacker: "x" })).toThrow(ValidationDomainError);
    });

    it("отклоняет неверный тип (time вместо числа)", () => {
      expect(() => validateAttributes({ attributes: defs }, { checkIn: 123, checkOut: "12:00", roomType: "standard", starRating: 4 })).toThrow(/must be a string/);
    });

    it("отклоняет отсутствие обязательного attribute", () => {
      expect(() => validateAttributes({ attributes: defs }, { checkOut: "12:00", roomType: "standard" })).toThrow(/Required attribute "checkIn"/);
    });

    it("отклоняет значение вне enum options", () => {
      expect(() => validateAttributes({ attributes: defs }, { checkIn: "14:00", checkOut: "12:00", roomType: "penthouse", starRating: 4 })).toThrow(/must be one of/);
    });

    it("отклоняет выход за min/max (number)", () => {
      expect(() => validateAttributes({ attributes: defs }, { checkIn: "14:00", checkOut: "12:00", roomType: "standard", starRating: 6 })).toThrow(/<= 5/);
      expect(() => validateAttributes({ attributes: defs }, { checkIn: "14:00", checkOut: "12:00", roomType: "standard", starRating: 4, groupSize: 0 })).toThrow(/>= 1/);
    });

    it("требует integer для integer-атрибута", () => {
      expect(() => validateAttributes({ attributes: defs }, { checkIn: "14:00", checkOut: "12:00", roomType: "standard", starRating: 4, groupSize: 2.5 })).toThrow(/must be an integer/);
    });

    it("проверяет pattern для string", () => {
      expect(() => validateAttributes({ attributes: defs }, { checkIn: "14:00", checkOut: "12:00", roomType: "standard", starRating: 4, iataCode: "gy" })).toThrow(/pattern/);
    });

    it("не принимает не-объект", () => {
      expect(() => validateAttributes({ attributes: defs }, [1, 2] as unknown)).toThrow(/must be an object/);
    });
  });

  describe("validateCategorySlug", () => {
    it("принимает стабильные технические slug", () => {
      expect(validateCategorySlug("tours")).toBe("tours");
      expect(validateCategorySlug("car-rental")).toBe("car-rental");
      expect(validateCategorySlug("travel-ancillary-services")).toBe("travel-ancillary-services");
      expect(validateCategorySlug("a1-b2-c3")).toBe("a1-b2-c3");
    });

    it.each([
      "",
      "a",
      "Tours",
      "Bad Slug!",
      "-leading",
      "trailing-",
      "double--dash",
      "русский",
      "tours/x",
      "a".repeat(65),
    ])("отклоняет невалидный slug %p", (slug) => {
      expect(() => validateCategorySlug(slug)).toThrow(ValidationDomainError);
    });
  });

  describe("validateSchemaConfig", () => {
    it("нормализует валидную конфигурацию", () => {
      const cfg = validateSchemaConfig({
        attributes: [
          { key: "checkIn", type: "time", required: true, searchable: false },
          { key: "roomType", type: "enum", options: ["standard", "deluxe"] },
        ],
        mediaRequirements: { minImages: 5, maxImages: 20, primaryImageRequired: true, allowedMediaTypes: ["image/jpeg"], videoAllowed: true },
        pdpSections: ["overview", "gallery", "tariffs"],
      });
      expect(cfg.attributes).toHaveLength(2);
      expect(cfg.attributes[0].required).toBe(true);
      expect(cfg.mediaRequirements?.minImages).toBe(5);
      expect(cfg.pdpSections).toEqual(["overview", "gallery", "tariffs"]);
    });

    it("требует attributes массивом", () => {
      expect(() => validateSchemaConfig({ attributes: "nope" })).toThrow(ValidationDomainError);
    });

    it("отклоняет неизвестный тип attribute", () => {
      expect(() => validateSchemaConfig({ attributes: [{ key: "x", type: "magic" }] })).toThrow(/invalid type/);
    });

    it("требует options для enum", () => {
      expect(() => validateSchemaConfig({ attributes: [{ key: "x", type: "enum" }] })).toThrow(/enum requires non-empty options/);
    });

    it("отклоняет дубликаты key", () => {
      expect(() =>
        validateSchemaConfig({
          attributes: [
            { key: "a", type: "string" },
            { key: "a", type: "number" },
          ],
        }),
      ).toThrow(/unique keys/);
    });

    it("отклоняет mediaRequirements с minImages > maxImages", () => {
      expect(() =>
        validateSchemaConfig({
          attributes: [],
          mediaRequirements: { minImages: 10, maxImages: 3 },
        }),
      ).toThrow(/minImages must not exceed maxImages/);
    });

    it("отклоняет pdpSections с не-строками", () => {
      expect(() => validateSchemaConfig({ attributes: [], pdpSections: ["ok", 42] })).toThrow(/pdpSections/);
    });
  });
});
