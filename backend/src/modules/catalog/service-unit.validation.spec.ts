import { ValidationDomainError } from "../../shared/errors";
import {
  SERVICE_UNIT_CREATE_FORBIDDEN_KEYS,
  SERVICE_UNIT_UPDATE_FORBIDDEN_KEYS,
  validateServiceUnitName,
  validateImportSource,
  validateExternalKey,
  assertImportIdentityConsistency,
  validateUnitAttributes,
} from "./service-unit.validation";
import type { AttributeDef } from "./category-schema.validation";

describe("Step 1.8A — Service Unit validation", () => {
  // ── Seller-defined name (verbatim) ───────────────────────────────────────

  it("preserves commercial names verbatim (case, wording, order)", () => {
    expect(validateServiceUnitName("Deluxe Room Sea View")).toBe("Deluxe Room Sea View");
    expect(validateServiceUnitName("Premium Double Ocean Side")).toBe("Premium Double Ocean Side");
    expect(validateServiceUnitName("Superior Sea Facing Room")).toBe("Superior Sea Facing Room");
    // Внутренние пробелы/регистр НЕ нормализуются — только внешний trim.
    expect(validateServiceUnitName("  Sedan  ")).toBe("Sedan");
    expect(validateServiceUnitName("Business Van")).toBe("Business Van");
  });

  it("rejects empty/whitespace-only names", () => {
    expect(() => validateServiceUnitName("")).toThrow(ValidationDomainError);
    expect(() => validateServiceUnitName("   ")).toThrow(ValidationDomainError);
    expect(() => validateServiceUnitName(undefined)).toThrow(ValidationDomainError);
    expect(() => validateServiceUnitName(123)).toThrow(ValidationDomainError);
  });

  it("rejects over-long names", () => {
    expect(() => validateServiceUnitName("x".repeat(201))).toThrow(ValidationDomainError);
    expect(validateServiceUnitName("x".repeat(200))).toBe("x".repeat(200));
  });

  it("rejects control characters (security)", () => {
    expect(() => validateServiceUnitName("Room\u0000\nView")).toThrow(ValidationDomainError);
    expect(() => validateServiceUnitName("Room\u007f")).toThrow(ValidationDomainError);
  });

  // ── Import identity ──────────────────────────────────────────────────────

  it("validates source as enum-like trusted token", () => {
    expect(validateImportSource("CHANNEL_MANAGER")).toBe("CHANNEL_MANAGER");
    expect(validateImportSource("IMPORT")).toBe("IMPORT");
    expect(validateImportSource(undefined)).toBeNull();
    expect(validateImportSource(null)).toBeNull();
    expect(validateImportSource("")).toBeNull();
    expect(() => validateImportSource("lowercase")).toThrow(ValidationDomainError);
    expect(() => validateImportSource("has space")).toThrow(ValidationDomainError);
    expect(() => validateImportSource("x".repeat(51))).toThrow(ValidationDomainError);
  });

  it("validates externalKey format (safe chars, ≤100)", () => {
    expect(validateExternalKey("RM-101")).toBe("RM-101");
    expect(validateExternalKey("room_101.suite:AZ")).toBe("room_101.suite:AZ");
    expect(validateExternalKey(undefined)).toBeNull();
    expect(validateExternalKey(null)).toBeNull();
    expect(validateExternalKey("")).toBeNull();
    expect(() => validateExternalKey("has space")).toThrow(ValidationDomainError);
    expect(() => validateExternalKey("-starts-with-dash")).toThrow(ValidationDomainError);
    expect(() => validateExternalKey("x".repeat(101))).toThrow(ValidationDomainError);
  });

  it("rejects externalKey without source (no fabricated key for manual records)", () => {
    expect(() => assertImportIdentityConsistency(null, "RM-101")).toThrow(ValidationDomainError);
    expect(() => assertImportIdentityConsistency("IMPORT", "RM-101")).not.toThrow();
    expect(() => assertImportIdentityConsistency("CHANNEL_MANAGER", null)).not.toThrow();
    expect(() => assertImportIdentityConsistency(null, null)).not.toThrow();
  });

  // ── Unit attributes (CategorySchema-driven) ──────────────────────────────

  const hotelSchema: { attributes: AttributeDef[] } = {
    attributes: [
      { key: "occupancy", label: "Occupancy", type: "integer", required: true, min: 1, max: 10 },
      { key: "bedType", label: "Bed type", type: "enum", options: ["single", "double", "twin"] },
      { key: "view", label: "View", type: "string" },
    ],
  };

  it("validates attributes against CategorySchema whitelist", () => {
    const out = validateUnitAttributes(hotelSchema, { occupancy: 2, bedType: "double", view: "Sea" });
    expect(out).toEqual({ occupancy: 2, bedType: "double", view: "Sea" });
  });

  it("rejects unknown/forged attributes (no unbounded JSON)", () => {
    expect(() => validateUnitAttributes(hotelSchema, { occupancy: 2, forged: "x" })).toThrow(ValidationDomainError);
  });

  it("rejects invalid enum/min/max/type", () => {
    expect(() => validateUnitAttributes(hotelSchema, { occupancy: 0 })).toThrow(ValidationDomainError);
    expect(() => validateUnitAttributes(hotelSchema, { occupancy: 11 })).toThrow(ValidationDomainError);
    expect(() => validateUnitAttributes(hotelSchema, { occupancy: 2, bedType: "king" })).toThrow(ValidationDomainError);
    expect(() => validateUnitAttributes(hotelSchema, { occupancy: "two" })).toThrow(ValidationDomainError);
  });

  it("requires mandatory attributes", () => {
    expect(() => validateUnitAttributes(hotelSchema, { bedType: "double" })).toThrow(ValidationDomainError);
  });

  it("empty attributes are valid (optional)", () => {
    expect(validateUnitAttributes(hotelSchema, undefined)).toEqual({});
    expect(validateUnitAttributes(hotelSchema, null)).toEqual({});
  });

  it("rejects attributes without any schema context (Product has no category)", () => {
    expect(() => validateUnitAttributes(null, { occupancy: 2 })).toThrow(ValidationDomainError);
    expect(validateUnitAttributes(null, {})).toEqual({});
    expect(() => validateUnitAttributes(null, "not-an-object")).toThrow(ValidationDomainError);
  });

  // ── Forbidden keys (mass assignment) ─────────────────────────────────────

  it("create forbidden keys block server-owned fields", () => {
    for (const key of ["id", "code", "productId", "categoryId", "categorySchemaId", "partnerId", "ownerId", "status", "version", "publishedAt", "createdAt", "updatedAt", "createdBy", "updatedBy"]) {
      expect(SERVICE_UNIT_CREATE_FORBIDDEN_KEYS).toContain(key);
    }
    // source/externalKey отсутствуют в create (staff/ADMIN trusted provisioning),
    // но блокируются в сервисе для PARTNER.
    expect(SERVICE_UNIT_CREATE_FORBIDDEN_KEYS).not.toContain("source");
    expect(SERVICE_UNIT_CREATE_FORBIDDEN_KEYS).not.toContain("externalKey");
  });

  it("update forbidden keys add immutable import identity", () => {
    expect(SERVICE_UNIT_UPDATE_FORBIDDEN_KEYS).toContain("source");
    expect(SERVICE_UNIT_UPDATE_FORBIDDEN_KEYS).toContain("externalKey");
    expect(SERVICE_UNIT_UPDATE_FORBIDDEN_KEYS).toContain("productId");
    expect(SERVICE_UNIT_UPDATE_FORBIDDEN_KEYS).toContain("code");
  });
});
