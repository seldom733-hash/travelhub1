/**
 * PHASE 1 STEP 1.7 — чистые helper'ы marketplace (покрываются unit-тестами).
 *
 * - filterControlFor: динамическое построение контролов из filter metadata
 *   категории (PublicFilterMetadata → FilterControlSpec) БЕЗ хардкода под
 *   конкретную категорию (Step 1.7 §10);
 * - sectionsFor: группировка category attributes PDP в секции (только по
 *   реальным данным, не придумывая отсутствующие);
 * - availabilityText: локализованный текст discovery-доступности.
 */
import type { Locale } from "./i18n";
import { formatDate, formatNumber, t } from "./i18n";
import type { PublicAvailabilitySummary, PublicFilterOption } from "./public-api";

/* ── Category-specific filter controls ─────────────────────────────────────── */

export type FilterControlKind = "select" | "checkbox" | "number" | "date" | "text";

export interface FilterControlSpec {
  key: string;
  label: string;
  type: string;
  kind: FilterControlKind;
  options?: string[];
  min?: number;
  max?: number;
}

/** Какой контрол построить для типа атрибута (enum→select, boolean→checkbox, …). */
export function filterControlFor(f: PublicFilterOption): FilterControlSpec {
  const base = { key: f.key, label: f.label, type: f.type };
  switch (f.type) {
    case "enum":
    case "string":
      if (f.options && f.options.length > 0) return { ...base, kind: "select" as const, options: f.options };
      return { ...base, kind: "text" as const };
    case "boolean":
      return { ...base, kind: "checkbox" as const };
    case "number":
    case "integer":
    case "currency":
      return { ...base, kind: "number" as const, min: f.min, max: f.max };
    case "date":
    case "time":
      return { ...base, kind: "date" as const };
    default:
      return { ...base, kind: "text" as const };
  }
}

export function buildFilterControls(meta: { filters: PublicFilterOption[] }): FilterControlSpec[] {
  return meta.filters.map(filterControlFor);
}

/* ── PDP attributes: секции ────────────────────────────────────────────────── */

const SECTION_KEY_GROUPS: Record<string, string[]> = {
  location: ["location", "destination", "city", "region", "address", "meetingpoint", "meeting_point", "meeting-point", "departure", "pickup"],
  duration: ["duration", "days", "nights", "durationdays", "duration_days", "durationhours", "hours"],
  included: ["included", "inclusions", "includes"],
  excluded: ["excluded", "exclusions", "excludes", "notincluded", "not_included"],
  program: ["program", "itinerary", "schedule", "agenda", "programbyday", "itinerary_by_day"],
  conditions: ["conditions", "terms", "requirements", "age", "languagesspoken", "languages"],
  cancellation: ["cancellation", "cancel", "cancellationpolicy", "cancellation_policy", "refund", "refundpolicy"],
};

export interface AttributeSection {
  section: keyof typeof SECTION_KEY_GROUPS | "other";
  items: Array<{ key: string; label: string; value: string }>;
}

/** Нормализация ключа атрибута для сравнения (убираем регистр/подчёркивания). */
function normKey(key: string): string {
  return key.toLowerCase().replace(/[\s_-]/g, "");
}

/** Человекочитаемый ярлык ключа: camelCase/snake_case → "Days Count". */
export function humanizeKey(key: string): string {
  return key
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function formatAttributeValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "";
  if (Array.isArray(value)) {
    return value.map((v) => String(v)).join(", ");
  }
  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

/** Группировка attributes PDP в секции. Пустые значения пропускаются. */
export function sectionsFor(
  attributes: Record<string, unknown> | null | undefined,
  locale: Locale,
): AttributeSection[] {
  if (!attributes) return [];
  const grouped = new Map<AttributeSection["section"], Array<{ key: string; label: string; value: string }>>();

  for (const [key, rawValue] of Object.entries(attributes)) {
    const value = formatAttributeValue(rawValue);
    if (!value) continue;
    const item = { key, label: humanizeKey(key), value };
    const nk = normKey(key);
    // Сначала точное совпадение (safe), затем префикс — снижает ложную группировку.
    const exact = (Object.keys(SECTION_KEY_GROUPS) as Array<keyof typeof SECTION_KEY_GROUPS>).find((s) =>
      SECTION_KEY_GROUPS[s].some((k) => normKey(k) === nk),
    );
    const section =
      exact ??
      ((Object.keys(SECTION_KEY_GROUPS) as Array<keyof typeof SECTION_KEY_GROUPS>).find((s) =>
        SECTION_KEY_GROUPS[s].some((k) => nk.startsWith(normKey(k)) && normKey(k).length >= 3),
      ) ?? "other");
    if (!grouped.has(section)) grouped.set(section, []);
    grouped.get(section)!.push(item);
  }

  return [...grouped.entries()].map(([section, items]) => ({
    section,
    items: items.map((i) => ({
      key: i.key,
      label: i.label,
      value:
        typeof attributes[i.key] === "boolean"
          ? (attributes[i.key] ? t("attr.yes", locale) : t("attr.no", locale))
          : i.value,
    })),
  }));
}

export function sectionLabel(section: AttributeSection["section"], locale: Locale): string {
  return t(`attr.${section}`, locale);
}

/* ── Availability text (discovery-only, Step 1.7 §15) ──────────────────────── */

export interface AvailabilityText {
  tone: "available" | "limited" | "unknown";
  title: string;
  detail: string;
}

export function availabilityText(a: PublicAvailabilitySummary | null, locale: Locale): AvailabilityText {
  if (!a) {
    return { tone: "unknown", title: t("pdp.availability_unknown", locale), detail: "" };
  }
  const datesCount = a.datesCount;
  const totalSlots = a.totalSlots;
  const booked = a.totalBooked + a.totalReserved;
  const hasSlots = totalSlots > 0;
  const limited = hasSlots && booked >= totalSlots;

  if (limited) {
    return {
      tone: "limited",
      title: t("card.availability_limited", locale),
      detail: hasSlots ? `${formatNumber(booked, locale)} / ${formatNumber(totalSlots, locale)}` : "",
    };
  }
  const title = a.availableFrom
    ? `${t("pdp.availability_from", locale)} ${formatDate(a.availableFrom, locale)}`
    : t("search.available_from", locale);
  return {
    tone: "available",
    title,
    detail: datesCount > 0 ? `${formatNumber(datesCount, locale)} ${t("pdp.availability_dates", locale)}` : "",
  };
}
