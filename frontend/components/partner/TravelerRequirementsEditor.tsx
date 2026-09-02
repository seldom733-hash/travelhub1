"use client";

/**
 * D2 — Product Traveler Requirements Editor.
 *
 * Visual editor for seller-defined traveler data requirements per Product.
 * Shows 7 traveler fields grouped into "Basic" and "Documents".
 * Each field has a 3-state selector: NOT_REQUESTED | OPTIONAL | REQUIRED.
 *
 * When travelerRequirements is null, all fields show ProductType defaults.
 * Partner can override individual fields or reset to defaults.
 */

import { useLocale } from "@/lib/i18n";
import { pt } from "@/lib/partner-i18n";

// ── Canonical Field Catalog ────────────────────────────────────────────────

export type TravelerRequirementState = "NOT_REQUESTED" | "OPTIONAL" | "REQUIRED";
export type TravelerField =
  | "firstName"
  | "lastName"
  | "birthDate"
  | "citizenship"
  | "gender"
  | "passportNumber"
  | "passportExpiry";

export const TRAVELER_FIELDS: TravelerField[] = [
  "firstName",
  "lastName",
  "birthDate",
  "citizenship",
  "gender",
  "passportNumber",
  "passportExpiry",
];

export const REQUIREMENT_STATES: TravelerRequirementState[] = [
  "NOT_REQUESTED",
  "OPTIONAL",
  "REQUIRED",
];

const FIELD_LABELS: Record<TravelerField, Record<string, string>> = {
  firstName: { ru: "Имя", az: "Ad", en: "First name" },
  lastName: { ru: "Фамилия", az: "Soyad", en: "Last name" },
  birthDate: { ru: "Дата рождения", az: "Doğum tarixi", en: "Date of birth" },
  citizenship: { ru: "Гражданство", az: "Vətəndaşlıq", en: "Citizenship" },
  gender: { ru: "Пол", az: "Cins", en: "Gender" },
  passportNumber: { ru: "Номер паспорта", az: "Passport nömrəsi", en: "Passport number" },
  passportExpiry: { ru: "Срок действия паспорта", az: "Passport müddəti", en: "Passport expiry" },
};

const STATE_LABELS: Record<TravelerRequirementState, Record<string, string>> = {
  NOT_REQUESTED: { ru: "Не запрашивать", az: "Tələb etmə", en: "Not requested" },
  OPTIONAL: { ru: "Опционально", az: "Seçim", en: "Optional" },
  REQUIRED: { ru: "Обязательно", az: "Mütləq", en: "Required" },
};

const FIELD_GROUPS = {
  basic: {
    labelKey: "partner.form.traveler_requirements_group_basic",
    fields: ["firstName", "lastName", "birthDate", "gender"] as TravelerField[],
  },
  documents: {
    labelKey: "partner.form.traveler_requirements_group_documents",
    fields: ["citizenship", "passportNumber", "passportExpiry"] as TravelerField[],
  },
};

// ── State color coding ─────────────────────────────────────────────────────

const STATE_COLORS: Record<TravelerRequirementState, string> = {
  NOT_REQUESTED: "bg-slate-100 text-slate-500 border-slate-200",
  OPTIONAL: "bg-amber-50 text-amber-700 border-amber-200",
  REQUIRED: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

const STATE_ACTIVE_COLORS: Record<TravelerRequirementState, string> = {
  NOT_REQUESTED: "bg-slate-200 text-slate-700 border-slate-300",
  OPTIONAL: "bg-amber-200 text-amber-800 border-amber-300",
  REQUIRED: "bg-emerald-200 text-emerald-800 border-emerald-300",
};

// ── Default Requirements (duplicated from backend for client resolution) ────

const DEFAULTS: Record<string, Record<TravelerField, TravelerRequirementState>> = {
  TOUR: { firstName: "REQUIRED", lastName: "REQUIRED", birthDate: "OPTIONAL", citizenship: "NOT_REQUESTED", gender: "NOT_REQUESTED", passportNumber: "NOT_REQUESTED", passportExpiry: "NOT_REQUESTED" },
  HOTEL: { firstName: "REQUIRED", lastName: "REQUIRED", birthDate: "OPTIONAL", citizenship: "OPTIONAL", gender: "NOT_REQUESTED", passportNumber: "NOT_REQUESTED", passportExpiry: "NOT_REQUESTED" },
  SANATORIUM: { firstName: "REQUIRED", lastName: "REQUIRED", birthDate: "REQUIRED", citizenship: "OPTIONAL", gender: "OPTIONAL", passportNumber: "OPTIONAL", passportExpiry: "OPTIONAL" },
  FLIGHT: { firstName: "REQUIRED", lastName: "REQUIRED", birthDate: "REQUIRED", citizenship: "REQUIRED", gender: "NOT_REQUESTED", passportNumber: "REQUIRED", passportExpiry: "REQUIRED" },
  TRAIN: { firstName: "REQUIRED", lastName: "REQUIRED", birthDate: "OPTIONAL", citizenship: "NOT_REQUESTED", gender: "NOT_REQUESTED", passportNumber: "NOT_REQUESTED", passportExpiry: "NOT_REQUESTED" },
  EXCURSION: { firstName: "REQUIRED", lastName: "REQUIRED", birthDate: "OPTIONAL", citizenship: "NOT_REQUESTED", gender: "NOT_REQUESTED", passportNumber: "NOT_REQUESTED", passportExpiry: "NOT_REQUESTED" },
  GUIDE: { firstName: "REQUIRED", lastName: "REQUIRED", birthDate: "NOT_REQUESTED", citizenship: "NOT_REQUESTED", gender: "NOT_REQUESTED", passportNumber: "NOT_REQUESTED", passportExpiry: "NOT_REQUESTED" },
  TRANSFER: { firstName: "REQUIRED", lastName: "REQUIRED", birthDate: "NOT_REQUESTED", citizenship: "NOT_REQUESTED", gender: "NOT_REQUESTED", passportNumber: "NOT_REQUESTED", passportExpiry: "NOT_REQUESTED" },
  PHOTOGRAPHER: { firstName: "REQUIRED", lastName: "REQUIRED", birthDate: "NOT_REQUESTED", citizenship: "NOT_REQUESTED", gender: "NOT_REQUESTED", passportNumber: "NOT_REQUESTED", passportExpiry: "NOT_REQUESTED" },
};

function getDefaultForType(productType: string): Record<TravelerField, TravelerRequirementState> {
  return DEFAULTS[productType] ?? DEFAULTS["TOUR"];
}

// ── Component Props ────────────────────────────────────────────────────────

export interface TravelerRequirementsEditorProps {
  /** Current travelerRequirements value (null = use defaults). */
  value: Record<string, string> | null;
  /** Called when value changes. null = reset to defaults. */
  onChange: (next: Record<string, string> | null) => void;
  /** ProductType for displaying defaults. */
  productType: string;
  /** Disabled (read-only / moderation lock). */
  disabled?: boolean;
}

/**
 * Product Traveler Requirements editor.
 * Renders field groups with 3-state toggle buttons.
 * Shows whether overrides are active or defaults are used.
 */
export default function TravelerRequirementsEditor({
  value,
  onChange,
  productType,
  disabled,
}: TravelerRequirementsEditorProps) {
  const locale = useLocale();
  const defaults = getDefaultForType(productType);
  const hasOverride = value !== null && typeof value === "object" && Object.keys(value).length > 0;

  /** Resolve effective state for a field. */
  const effectiveState = (field: TravelerField): TravelerRequirementState => {
    if (hasOverride && value && field in value) {
      return (value[field] as TravelerRequirementState) ?? "NOT_REQUESTED";
    }
    return defaults[field];
  };

  /** Toggle field to next state. */
  const toggleField = (field: TravelerField) => {
    if (disabled) return;
    const current = effectiveState(field);
    const idx = REQUIREMENT_STATES.indexOf(current);
    const next = REQUIREMENT_STATES[(idx + 1) % REQUIREMENT_STATES.length];

    const newOverrides: Record<string, string> = { ...(value ?? {}) };
    newOverrides[field] = next;
    onChange(newOverrides);
  };

  /** Reset all overrides to ProductType defaults. */
  const handleReset = () => {
    if (disabled) return;
    onChange(null);
  };

  return (
    <div className="space-y-4" role="group" aria-label={pt("partner.form.traveler_requirements", locale)}>
      {/* Status indicator */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-500">
          {hasOverride
            ? pt("partner.form.traveler_requirements_overridden", locale)
            : pt("partner.form.traveler_requirements_default", locale)}
        </span>
        {hasOverride && !disabled && (
          <button
            type="button"
            onClick={handleReset}
            className="text-xs text-emerald-600 hover:text-emerald-800 underline"
            aria-label={pt("partner.form.traveler_requirements_clear", locale)}
          >
            {pt("partner.form.traveler_requirements_clear", locale)}
          </button>
        )}
      </div>

      {/* Field groups */}
      {Object.entries(FIELD_GROUPS).map(([groupKey, group]) => (
        <div key={groupKey} className="space-y-2">
          <h3 className="text-xs font-medium text-slate-500 uppercase tracking-wide">
            {pt(group.labelKey, locale)}
          </h3>
          <div className="grid gap-2 sm:grid-cols-2">
            {group.fields.map((field) => {
              const state = effectiveState(field);
              const isCustomized = hasOverride && value && field in value;

              return (
                <div
                  key={field}
                  className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2"
                >
                  <span className="text-sm text-slate-700">
                    {FIELD_LABELS[field][locale] ?? FIELD_LABELS[field].en}
                    {isCustomized && (
                      <span className="ml-1 inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" title="Custom override" />
                    )}
                  </span>
                  <div className="flex gap-1" role="radiogroup" aria-label={FIELD_LABELS[field][locale]}>
                    {REQUIREMENT_STATES.map((s) => (
                      <button
                        key={s}
                        type="button"
                        role="radio"
                        aria-checked={state === s}
                        aria-label={STATE_LABELS[s][locale]}
                        disabled={disabled}
                        onClick={() => {
                          if (disabled) return;
                          const newOverrides: Record<string, string> = { ...(value ?? {}) };
                          newOverrides[field] = s;
                          onChange(newOverrides);
                        }}
                        className={`rounded-md border px-2 py-0.5 text-[10px] font-medium transition-colors
                          ${state === s ? STATE_ACTIVE_COLORS[s] : STATE_COLORS[s]}
                          ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:opacity-80"}`}
                      >
                        {STATE_LABELS[s][locale]?.charAt(0)}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
