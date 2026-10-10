import {
  validateTravelerRequirements,
  getEffectiveTravelerRequirements,
  getPinnedRequirementsShape,
  getDefaultTravelerRequirements,
  isTravelerRequirementState,
  isTravelerField,
  TRAVELER_FIELDS,
  TRAVELER_REQUIREMENT_STATES,
  TRAVELER_FIELD_LABELS,
  REQUIREMENT_STATE_LABELS,
  TRAVELER_FIELD_GROUPS,
  TravelerRequirementsValidationError,
} from "./traveler-requirements";

describe("Traveler Requirements (D2)", () => {
  // ── Type Guards ──────────────────────────────────────────────────────────

  describe("isTravelerRequirementState", () => {
    it("accepts all valid states", () => {
      for (const state of TRAVELER_REQUIREMENT_STATES) {
        expect(isTravelerRequirementState(state)).toBe(true);
      }
    });

    it("rejects unknown states", () => {
      expect(isTravelerRequirementState("OPTIONAL")).toBe(true);
      expect(isTravelerRequirementState("OPTIONAL!!!")).toBe(false);
      expect(isTravelerRequirementState("")).toBe(false);
      expect(isTravelerRequirementState(null)).toBe(false);
      expect(isTravelerRequirementState(42)).toBe(false);
    });
  });

  describe("isTravelerField", () => {
    it("accepts all canonical fields", () => {
      for (const field of TRAVELER_FIELDS) {
        expect(isTravelerField(field)).toBe(true);
      }
    });

    it("rejects unknown fields", () => {
      expect(isTravelerField("firstName")).toBe(true);
      expect(isTravelerField("email")).toBe(false);
      expect(isTravelerField("")).toBe(false);
      expect(isTravelerField(null)).toBe(false);
    });
  });

  // ── Validation ───────────────────────────────────────────────────────────

  describe("validateTravelerRequirements", () => {
    it("returns empty map for null/undefined", () => {
      expect(validateTravelerRequirements(null)).toEqual({});
      expect(validateTravelerRequirements(undefined)).toEqual({});
    });

    it("accepts valid partial map", () => {
      expect(
        validateTravelerRequirements({
          firstName: "REQUIRED",
          lastName: "OPTIONAL",
        }),
      ).toEqual({
        firstName: "REQUIRED",
        lastName: "OPTIONAL",
      });
    });

    it("accepts valid full map", () => {
      const full = {
        firstName: "REQUIRED",
        lastName: "REQUIRED",
        birthDate: "OPTIONAL",
        citizenship: "NOT_REQUESTED",
        gender: "NOT_REQUESTED",
        passportNumber: "REQUIRED",
        passportExpiry: "REQUIRED",
      };
      expect(validateTravelerRequirements(full)).toEqual(full);
    });

    it("rejects non-object shapes", () => {
      expect(() => validateTravelerRequirements("string")).toThrow(TravelerRequirementsValidationError);
      expect(() => validateTravelerRequirements(42)).toThrow(TravelerRequirementsValidationError);
      expect(() => validateTravelerRequirements([1, 2])).toThrow(TravelerRequirementsValidationError);
    });

    it("rejects unknown field names", () => {
      expect(() =>
        validateTravelerRequirements({ unknownField: "REQUIRED" }),
      ).toThrow(/Unknown traveler field/);
    });

    it("rejects invalid requirement states", () => {
      expect(() =>
        validateTravelerRequirements({ firstName: "MUST" }),
      ).toThrow(/Invalid requirement state/);
    });

    it("rejects non-string values for field keys in raw object", () => {
      // Mixed types
      expect(() => validateTravelerRequirements(123)).toThrow(TravelerRequirementsValidationError);
    });

    it("accepts empty object", () => {
      expect(validateTravelerRequirements({})).toEqual({});
    });
  });

  // ── ProductType Defaults ──────────────────────────────────────────────────

  describe("getDefaultTravelerRequirements", () => {
    it("returns TOUR defaults for TOUR (two-stage §3)", () => {
      const defaults = getDefaultTravelerRequirements("TOUR");
      expect(defaults.firstName).toBe("REQUIRED");
      expect(defaults.lastName).toBe("REQUIRED");
      expect(defaults.birthDate).toBe("REQUIRED");
      expect(defaults.citizenship).toBe("REQUIRED");
      expect(defaults.gender).toBe("NOT_REQUESTED");
      expect(defaults.passportSeries).toBe("REQUIRED");
      expect(defaults.passportNumber).toBe("REQUIRED");
      expect(defaults.passportExpiry).toBe("REQUIRED");
    });

    it("returns FLIGHT defaults (more strict)", () => {
      const defaults = getDefaultTravelerRequirements("FLIGHT");
      expect(defaults.firstName).toBe("REQUIRED");
      expect(defaults.birthDate).toBe("REQUIRED");
      expect(defaults.citizenship).toBe("REQUIRED");
      expect(defaults.passportNumber).toBe("REQUIRED");
      expect(defaults.passportExpiry).toBe("REQUIRED");
    });

    it("returns TRAIN defaults", () => {
      const defaults = getDefaultTravelerRequirements("TRAIN");
      expect(defaults.firstName).toBe("REQUIRED");
      expect(defaults.passportNumber).toBe("NOT_REQUESTED");
    });

    it("returns EXCURSION defaults", () => {
      const defaults = getDefaultTravelerRequirements("EXCURSION");
      expect(defaults.firstName).toBe("REQUIRED");
      expect(defaults.birthDate).toBe("OPTIONAL");
      expect(defaults.passportNumber).toBe("NOT_REQUESTED");
    });

    it("returns HOTEL defaults", () => {
      const defaults = getDefaultTravelerRequirements("HOTEL");
      expect(defaults.firstName).toBe("REQUIRED");
      expect(defaults.citizenship).toBe("OPTIONAL");
    });

    it("returns SANATORIUM defaults (stricter)", () => {
      const defaults = getDefaultTravelerRequirements("SANATORIUM");
      expect(defaults.birthDate).toBe("REQUIRED");
      expect(defaults.gender).toBe("OPTIONAL");
      expect(defaults.passportNumber).toBe("OPTIONAL");
    });

    it("returns TRANSFER defaults", () => {
      const defaults = getDefaultTravelerRequirements("TRANSFER");
      expect(defaults.firstName).toBe("REQUIRED");
      expect(defaults.birthDate).toBe("NOT_REQUESTED");
    });

    it("returns GUIDE defaults", () => {
      const defaults = getDefaultTravelerRequirements("GUIDE");
      expect(defaults.firstName).toBe("REQUIRED");
      expect(defaults.birthDate).toBe("NOT_REQUESTED");
    });

    it("returns PHOTOGRAPHER defaults", () => {
      const defaults = getDefaultTravelerRequirements("PHOTOGRAPHER");
      expect(defaults.firstName).toBe("REQUIRED");
      expect(defaults.birthDate).toBe("NOT_REQUESTED");
    });

    it("returns TOUR-like defaults for unknown types", () => {
      const defaults = getDefaultTravelerRequirements("UNKNOWN_TYPE");
      expect(defaults.firstName).toBe("REQUIRED");
      expect(defaults.birthDate).toBe("REQUIRED");
      expect(defaults.passportSeries).toBe("REQUIRED");
      expect(defaults.passportNumber).toBe("REQUIRED");
    });

    it("always returns all 8 fields", () => {
      const defaults = getDefaultTravelerRequirements("TOUR");
      expect(Object.keys(defaults).sort()).toEqual(
        [...TRAVELER_FIELDS].sort(),
      );
    });

    it("returns a copy (not the same reference)", () => {
      const a = getDefaultTravelerRequirements("TOUR");
      const b = getDefaultTravelerRequirements("TOUR");
      expect(a).toEqual(b);
      expect(a).not.toBe(b);
    });
  });

  // ── Effective Requirements ────────────────────────────────────────────────

  describe("getEffectiveTravelerRequirements", () => {
    it("returns defaults when requirements is null", () => {
      const result = getEffectiveTravelerRequirements("TOUR", null);
      expect(result).toEqual(getDefaultTravelerRequirements("TOUR"));
    });

    it("returns defaults when requirements is undefined", () => {
      const result = getEffectiveTravelerRequirements("TOUR", undefined);
      expect(result).toEqual(getDefaultTravelerRequirements("TOUR"));
    });

    it("returns defaults when requirements is non-object", () => {
      const result = getEffectiveTravelerRequirements("TOUR", "invalid");
      expect(result).toEqual(getDefaultTravelerRequirements("TOUR"));
    });

    it("merges overrides on top of defaults", () => {
      const result = getEffectiveTravelerRequirements("TOUR", {
        passportNumber: "REQUIRED",
        citizenship: "OPTIONAL",
      });
      expect(result.firstName).toBe("REQUIRED"); // from TOUR defaults
      expect(result.passportNumber).toBe("REQUIRED"); // overridden
      expect(result.citizenship).toBe("OPTIONAL"); // overridden
    });

    it("partial override preserves remaining defaults", () => {
      const defaults = getDefaultTravelerRequirements("FLIGHT");
      const result = getEffectiveTravelerRequirements("FLIGHT", {
        gender: "REQUIRED",
      });
      expect(result.gender).toBe("REQUIRED");
      expect(result.firstName).toBe(defaults.firstName);
      expect(result.passportNumber).toBe(defaults.passportNumber);
    });

    it("FLIGHT override can relax a strict field", () => {
      const result = getEffectiveTravelerRequirements("FLIGHT", {
        passportExpiry: "NOT_REQUESTED",
      });
      expect(result.passportExpiry).toBe("NOT_REQUESTED");
      // Other FLIGHT strict fields remain
      expect(result.passportNumber).toBe("REQUIRED");
      expect(result.birthDate).toBe("REQUIRED");
    });

    it("returns all 8 fields regardless of partial override", () => {
      const result = getEffectiveTravelerRequirements("TOUR", {
        firstName: "OPTIONAL",
      });
      expect(Object.keys(result).sort()).toEqual(
        [...TRAVELER_FIELDS].sort(),
      );
    });

    it("throws for invalid override values", () => {
      expect(() =>
        getEffectiveTravelerRequirements("TOUR", {
          firstName: "BANANA",
        }),
      ).toThrow(TravelerRequirementsValidationError);
    });

    it("throws for unknown fields in override", () => {
      expect(() =>
        getEffectiveTravelerRequirements("TOUR", {
          email: "REQUIRED",
        }),
      ).toThrow(TravelerRequirementsValidationError);
    });
  });

  // ── Labels ───────────────────────────────────────────────────────────────

  describe("Labels", () => {
    it("has labels for all requirement states", () => {
      for (const state of TRAVELER_REQUIREMENT_STATES) {
        expect(REQUIREMENT_STATE_LABELS[state]).toBeDefined();
        expect(REQUIREMENT_STATE_LABELS[state].ru).toBeTruthy();
        expect(REQUIREMENT_STATE_LABELS[state].en).toBeTruthy();
        expect(REQUIREMENT_STATE_LABELS[state].az).toBeTruthy();
      }
    });

    it("has labels for all traveler fields", () => {
      for (const field of TRAVELER_FIELDS) {
        expect(TRAVELER_FIELD_LABELS[field]).toBeDefined();
        expect(TRAVELER_FIELD_LABELS[field].ru).toBeTruthy();
        expect(TRAVELER_FIELD_LABELS[field].en).toBeTruthy();
        expect(TRAVELER_FIELD_LABELS[field].az).toBeTruthy();
      }
    });

    it("has 2 field groups (basic + documents)", () => {
      expect(Object.keys(TRAVELER_FIELD_GROUPS)).toEqual(
        expect.arrayContaining(["basic", "documents"]),
      );
    });

    it("basic group covers first/last/birth/gender", () => {
      expect(TRAVELER_FIELD_GROUPS.basic.fields).toEqual(
        ["firstName", "lastName", "birthDate", "gender"],
      );
    });

    it("documents group covers citizenship/passport", () => {
      expect(TRAVELER_FIELD_GROUPS.documents.fields).toEqual(
        ["citizenship", "passportSeries", "passportNumber", "passportExpiry"],
      );
    });

    it("all groups have trilingual labels", () => {
      for (const group of Object.values(TRAVELER_FIELD_GROUPS)) {
        expect(group.label.ru).toBeTruthy();
        expect(group.label.en).toBeTruthy();
        expect(group.label.az).toBeTruthy();
      }
    });
  });

  // ── Field Catalog ─────────────────────────────────────────────────────────

  describe("Field Catalog", () => {
    it("contains exactly 8 fields", () => {
      expect(TRAVELER_FIELDS.length).toBe(8);
    });

    it("includes all expected fields", () => {
      expect(TRAVELER_FIELDS).toContain("firstName");
      expect(TRAVELER_FIELDS).toContain("lastName");
      expect(TRAVELER_FIELDS).toContain("birthDate");
      expect(TRAVELER_FIELDS).toContain("citizenship");
      expect(TRAVELER_FIELDS).toContain("gender");
      expect(TRAVELER_FIELDS).toContain("passportSeries");
      expect(TRAVELER_FIELDS).toContain("passportNumber");
      expect(TRAVELER_FIELDS).toContain("passportExpiry");
    });
  });

  // ── Pinned-shape diagnostics (DATA-SHAPE FIX §11, P2) ─────────────────────

  describe("getPinnedRequirementsShape", () => {
    it("canonical TravelerFullRequirements → traveler_requirements", () => {
      expect(
        getPinnedRequirementsShape({
          firstName: "REQUIRED",
          lastName: "REQUIRED",
          birthDate: "OPTIONAL",
          citizenship: "NOT_REQUESTED",
          gender: "NOT_REQUESTED",
          passportNumber: "NOT_REQUESTED",
          passportExpiry: "NOT_REQUESTED",
        }),
      ).toBe("traveler_requirements");
      // …even a partial map is traveler-shaped (≥1 known field)
      expect(getPinnedRequirementsShape({ firstName: "REQUIRED" })).toBe("traveler_requirements");
    });

    it("legacy tour/flight offer snapshot → offer_snapshot (the defect this fix repairs)", () => {
      expect(
        getPinnedRequirementsShape({
          supplierCode: "KAZUNION",
          externalOfferId: "35000",
          hotel: "Rixos",
          room: "DBL",
          meal: "AI",
          nights: 7,
          adults: 2,
        }),
      ).toBe("offer_snapshot");
    });

    it("null / empty / unrelated object → unknown (no false positives)", () => {
      expect(getPinnedRequirementsShape(null)).toBe("unknown");
      expect(getPinnedRequirementsShape(undefined)).toBe("unknown");
      expect(getPinnedRequirementsShape({})).toBe("unknown");
      expect(getPinnedRequirementsShape([])).toBe("unknown");
      expect(getPinnedRequirementsShape("REQUIRED")).toBe("unknown");
      expect(getPinnedRequirementsShape({ doc: "passport" })).toBe("unknown");
    });
  });
});
