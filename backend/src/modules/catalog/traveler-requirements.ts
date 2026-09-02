/**
 * PHASE 3 PRE-STEP 3.12 D2 — Product Traveler Requirements.
 *
 * Canonical contract for seller-defined traveler data requirements per Product.
 * States: NOT_REQUESTED | OPTIONAL | REQUIRED.
 * Storage: Product.travelerRequirements Json? (JSONB in PostgreSQL).
 * NULL = use ProductType defaults (deterministic resolution).
 *
 * D3 reads effective requirements at checkout acceptance (termsAcceptedAt)
 * and pins them for OrderTraveler / Passenger snapshot.
 */

// ── Requirement States ──────────────────────────────────────────────────────

export const TRAVELER_REQUIREMENT_STATES = ["NOT_REQUESTED", "OPTIONAL", "REQUIRED"] as const;
export type TravelerRequirementState = (typeof TRAVELER_REQUIREMENT_STATES)[number];

/** Type guard — validates string is a canonical requirement state. */
export function isTravelerRequirementState(v: unknown): v is TravelerRequirementState {
  return typeof v === "string" && (TRAVELER_REQUIREMENT_STATES as readonly string[]).includes(v);
}

// ── Traveler Field Catalog ──────────────────────────────────────────────────
// Canonical fields matching OrderTraveler / Passenger models.
// NOT adding fields beyond what OrderTraveler/Passenger currently support.

export const TRAVELER_FIELDS = [
  "firstName",
  "lastName",
  "birthDate",
  "citizenship",
  "gender",
  "passportNumber",
  "passportExpiry",
] as const;
export type TravelerField = (typeof TRAVELER_FIELDS)[number];

/** Type guard — validates string is a known traveler field. */
export function isTravelerField(v: unknown): v is TravelerField {
  return typeof v === "string" && (TRAVELER_FIELDS as readonly string[]).includes(v);
}

// ── Traveler Requirements Map ───────────────────────────────────────────────

export type TravelerRequirementsMap = Partial<Record<TravelerField, TravelerRequirementState>>;

/** Full requirements map (all fields present). */
export type TravelerFullRequirements = Record<TravelerField, TravelerRequirementState>;

// ── Validation ──────────────────────────────────────────────────────────────

export class TravelerRequirementsValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TravelerRequirementsValidationError";
  }
}

/**
 * Validates a raw traveler requirements value (from Product.travelerRequirements JSON).
 * Rejects: unknown field names, unknown requirement states, non-object shapes.
 */
export function validateTravelerRequirements(raw: unknown): TravelerRequirementsMap {
  if (raw === null || raw === undefined) return {};
  if (typeof raw !== "object" || Array.isArray(raw)) {
    throw new TravelerRequirementsValidationError("travelerRequirements must be an object");
  }
  const result: TravelerRequirementsMap = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!isTravelerField(key)) {
      throw new TravelerRequirementsValidationError(`Unknown traveler field: "${key}"`);
    }
    if (!isTravelerRequirementState(value)) {
      throw new TravelerRequirementsValidationError(
        `Invalid requirement state for "${key}": "${value}". Must be one of: NOT_REQUESTED, OPTIONAL, REQUIRED`,
      );
    }
    result[key as TravelerField] = value;
  }
  return result;
}

// ── ProductType Defaults ────────────────────────────────────────────────────
// Deterministic defaults per ProductType when Product.travelerRequirements is NULL.

const DEFAULTS_TOUR: TravelerFullRequirements = {
  firstName: "REQUIRED",
  lastName: "REQUIRED",
  birthDate: "OPTIONAL",
  citizenship: "NOT_REQUESTED",
  gender: "NOT_REQUESTED",
  passportNumber: "NOT_REQUESTED",
  passportExpiry: "NOT_REQUESTED",
};

const DEFAULTS_FLIGHT: TravelerFullRequirements = {
  firstName: "REQUIRED",
  lastName: "REQUIRED",
  birthDate: "REQUIRED",
  citizenship: "REQUIRED",
  gender: "NOT_REQUESTED",
  passportNumber: "REQUIRED",
  passportExpiry: "REQUIRED",
};

const DEFAULTS_TRAIN: TravelerFullRequirements = {
  firstName: "REQUIRED",
  lastName: "REQUIRED",
  birthDate: "OPTIONAL",
  citizenship: "NOT_REQUESTED",
  gender: "NOT_REQUESTED",
  passportNumber: "NOT_REQUESTED",
  passportExpiry: "NOT_REQUESTED",
};

const DEFAULTS_TRANSFER: TravelerFullRequirements = {
  firstName: "REQUIRED",
  lastName: "REQUIRED",
  birthDate: "NOT_REQUESTED",
  citizenship: "NOT_REQUESTED",
  gender: "NOT_REQUESTED",
  passportNumber: "NOT_REQUESTED",
  passportExpiry: "NOT_REQUESTED",
};

const DEFAULTS_EXCURSION: TravelerFullRequirements = {
  firstName: "REQUIRED",
  lastName: "REQUIRED",
  birthDate: "OPTIONAL",
  citizenship: "NOT_REQUESTED",
  gender: "NOT_REQUESTED",
  passportNumber: "NOT_REQUESTED",
  passportExpiry: "NOT_REQUESTED",
};

const DEFAULTS_HOTEL: TravelerFullRequirements = {
  firstName: "REQUIRED",
  lastName: "REQUIRED",
  birthDate: "OPTIONAL",
  citizenship: "OPTIONAL",
  gender: "NOT_REQUESTED",
  passportNumber: "NOT_REQUESTED",
  passportExpiry: "NOT_REQUESTED",
};

const DEFAULTS_SANATORIUM: TravelerFullRequirements = {
  firstName: "REQUIRED",
  lastName: "REQUIRED",
  birthDate: "REQUIRED",
  citizenship: "OPTIONAL",
  gender: "OPTIONAL",
  passportNumber: "OPTIONAL",
  passportExpiry: "OPTIONAL",
};

const DEFAULTS_GUIDE: TravelerFullRequirements = {
  firstName: "REQUIRED",
  lastName: "REQUIRED",
  birthDate: "NOT_REQUESTED",
  citizenship: "NOT_REQUESTED",
  gender: "NOT_REQUESTED",
  passportNumber: "NOT_REQUESTED",
  passportExpiry: "NOT_REQUESTED",
};

const DEFAULTS_PHOTOGRAPHER: TravelerFullRequirements = {
  firstName: "REQUIRED",
  lastName: "REQUIRED",
  birthDate: "NOT_REQUESTED",
  citizenship: "NOT_REQUESTED",
  gender: "NOT_REQUESTED",
  passportNumber: "NOT_REQUESTED",
  passportExpiry: "NOT_REQUESTED",
};

const PRODUCT_TYPE_DEFAULTS: Record<string, TravelerFullRequirements> = {
  TOUR: DEFAULTS_TOUR,
  HOTEL: DEFAULTS_HOTEL,
  SANATORIUM: DEFAULTS_SANATORIUM,
  FLIGHT: DEFAULTS_FLIGHT,
  TRAIN: DEFAULTS_TRAIN,
  EXCURSION: DEFAULTS_EXCURSION,
  GUIDE: DEFAULTS_GUIDE,
  TRANSFER: DEFAULTS_TRANSFER,
  PHOTOGRAPHER: DEFAULTS_PHOTOGRAPHER,
};

/**
 * Returns default traveler requirements for a ProductType.
 * Deterministic — same input always produces same output.
 */
export function getDefaultTravelerRequirements(productType: string): TravelerFullRequirements {
  const defaults = PRODUCT_TYPE_DEFAULTS[productType];
  if (!defaults) {
    // Unknown type → TOUR-like defaults (conservative)
    return { ...DEFAULTS_TOUR };
  }
  return { ...defaults };
}

// ── Effective Requirements ──────────────────────────────────────────────────

/**
 * Computes effective traveler requirements for a Product.
 * Priority: Product override > ProductType default.
 * Deterministic: same inputs always produce same output.
 *
 * @param productType - The ProductType enum value.
 * @param travelerRequirements - The Product.travelerRequirements JSON (may be null/undefined).
 * @returns Full requirements map with all fields present.
 */
export function getEffectiveTravelerRequirements(
  productType: string,
  travelerRequirements: unknown,
): TravelerFullRequirements {
  const defaults = getDefaultTravelerRequirements(productType);

  if (!travelerRequirements || typeof travelerRequirements !== "object" || Array.isArray(travelerRequirements)) {
    return defaults;
  }

  // Merge: overrides apply on top of defaults
  const result = { ...defaults };
  const parsed = validateTravelerRequirements(travelerRequirements);

  for (const [field, state] of Object.entries(parsed)) {
    if (state !== undefined) {
      result[field as TravelerField] = state!;
    }
  }

  return result;
}

// ── Label Helpers (for API / UI) ────────────────────────────────────────────

export const REQUIREMENT_STATE_LABELS: Record<TravelerRequirementState, Record<string, string>> = {
  NOT_REQUESTED: {
    ru: "Не запрашивать",
    az: "Tələb etmə",
    en: "Not requested",
  },
  OPTIONAL: {
    ru: "Опционально",
    az: "Seçim",
    en: "Optional",
  },
  REQUIRED: {
    ru: "Обязательно",
    az: "Mütləq",
    en: "Required",
  },
};

export const TRAVELER_FIELD_LABELS: Record<TravelerField, Record<string, string>> = {
  firstName: {
    ru: "Имя",
    az: "Ad",
    en: "First name",
  },
  lastName: {
    ru: "Фамилия",
    az: "Soyad",
    en: "Last name",
  },
  birthDate: {
    ru: "Дата рождения",
    az: "Doğum tarixi",
    en: "Date of birth",
  },
  citizenship: {
    ru: "Гражданство",
    az: "Vətəndaşlıq",
    en: "Citizenship",
  },
  gender: {
    ru: "Пол",
    az: "Cins",
    en: "Gender",
  },
  passportNumber: {
    ru: "Номер паспорта",
    az: "Passport nömrəsi",
    en: "Passport number",
  },
  passportExpiry: {
    ru: "Срок действия паспорта",
    az: "Passport müddəti",
    en: "Passport expiry",
  },
};

export const TRAVELER_FIELD_GROUPS = {
  basic: {
    label: { ru: "Основные данные", az: "Əsas məlumatlar", en: "Basic information" },
    fields: ["firstName", "lastName", "birthDate", "gender"] as TravelerField[],
  },
  documents: {
    label: { ru: "Документы", az: "Sənədlər", en: "Documents" },
    fields: ["citizenship", "passportNumber", "passportExpiry"] as TravelerField[],
  },
};
