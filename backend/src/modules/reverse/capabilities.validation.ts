/**
 * PHASE 2 STEP 2.2A — Seller Commercial Capabilities: чистые валидаторы.
 *
 * - destinations: структурная валидация + нормализация (детерминированный
 *   порядок); worldwide — эксклюзивная запись, НЕ fake country;
 * - countryCode — структурный ISO (^[A-Z]{2}$), БЕЗ заморозки словаря стран
 *   (DD-028: иерархия Country→Region→City НЕ фиксируется здесь);
 * - cityCode — из канонического справочника CITY_REF (catalog, read-only)
 *   ПРИ НАЛИЧИИ; отсутствие города в справочнике → coverage только
 *   country-level (документированное ограничение);
 * - правовая страна Seller НЕ участвует в нормализации (никакого implicit
 *   coverage из legal location).
 */
import { ValidationDomainError } from "../../shared/errors";
import { CITY_REF } from "../catalog/seller/locations";

export interface CapabilityDestination {
  countryCode?: string;
  cityCode?: string;
  worldwide?: boolean;
}

export const MAX_DESTINATIONS = 50;
const COUNTRY_RE = /^[A-Z]{2}$/;
const CITY_RE = /^[A-Z0-9_]{2,16}$/;
/// Зарезервированный псевдокод broad-coverage: НЕ страна. Используется только
/// как явная запись { worldwide: true }; код "WW" в countryCode запрещён
/// (fake country).
export const RESERVED_COUNTRY_CODES = ["WW"] as const;

const DEST_KEYS = new Set(["countryCode", "cityCode", "worldwide"]);

/** Сортировка для детерминированного хранения: countryCode, затем cityCode. */
function destKey(d: CapabilityDestination): string {
  return `${d.countryCode ?? "WW"}:${d.cityCode ?? ""}`;
}

function sameDest(a: CapabilityDestination, b: CapabilityDestination): boolean {
  return destKey(a) === destKey(b);
}

/**
 * Валидация + нормализация destinations.
 * Вход — сырое значение из DTO. Кидает ValidationDomainError (422) при любой
 * структурной ошибке. Возвращает нормализованный массив (read-only по смыслу).
 */
export function normalizeDestinations(raw: unknown): CapabilityDestination[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new ValidationDomainError("destinations must be a non-empty array");
  }
  if (raw.length > MAX_DESTINATIONS) {
    throw new ValidationDomainError(`destinations must contain at most ${MAX_DESTINATIONS} entries`);
  }

  const out: CapabilityDestination[] = [];
  for (const item of raw) {
    if (item === null || typeof item !== "object" || Array.isArray(item)) {
      throw new ValidationDomainError("each destination must be an object");
    }
    const keys = Object.keys(item as Record<string, unknown>);
    const unknown = keys.filter((k) => !DEST_KEYS.has(k));
    if (unknown.length > 0) {
      throw new ValidationDomainError(`destination has unknown keys: ${unknown.join(", ")}`);
    }
    const d = item as CapabilityDestination;

    if (d.worldwide === true) {
      if (d.countryCode !== undefined || d.cityCode !== undefined) {
        throw new ValidationDomainError("worldwide destination must not combine countryCode/cityCode");
      }
      out.push({ worldwide: true });
      continue;
    }
    if (d.worldwide !== undefined) {
      throw new ValidationDomainError("worldwide must be boolean true when present");
    }

    if (typeof d.countryCode !== "string" || !COUNTRY_RE.test(d.countryCode)) {
      throw new ValidationDomainError("countryCode must be a 2-letter ISO code (A-Z)");
    }
    if ((RESERVED_COUNTRY_CODES as readonly string[]).includes(d.countryCode)) {
      throw new ValidationDomainError("countryCode is reserved for broad coverage; use { worldwide: true } instead");
    }
    const normalized: CapabilityDestination = { countryCode: d.countryCode };
    if (d.cityCode !== undefined) {
      if (typeof d.cityCode !== "string" || !CITY_RE.test(d.cityCode)) {
        throw new ValidationDomainError("cityCode format is invalid");
      }
      const city = CITY_REF[d.cityCode];
      if (!city) {
        throw new ValidationDomainError(
          `cityCode '${d.cityCode}' is not in the canonical city reference (use country-level coverage for now)`,
        );
      }
      if (city.countryCode !== d.countryCode) {
        throw new ValidationDomainError(`cityCode '${d.cityCode}' does not belong to country '${d.countryCode}'`);
      }
      normalized.cityCode = d.cityCode;
    }
    out.push(normalized);
  }

  // Worldwide — эксклюзивная запись.
  if (out.some((d) => d.worldwide === true)) {
    if (out.length !== 1) {
      throw new ValidationDomainError("worldwide coverage must be the only destination");
    }
    return out;
  }

  // Дубликаты (countryCode, cityCode) — deterministic reject.
  for (let i = 0; i < out.length; i++) {
    for (let j = i + 1; j < out.length; j++) {
      if (sameDest(out[i], out[j])) {
        throw new ValidationDomainError("duplicate destination entry is not allowed");
      }
    }
  }

  out.sort((a, b) => destKey(a).localeCompare(destKey(b)));
  return out;
}
