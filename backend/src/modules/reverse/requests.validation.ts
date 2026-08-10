/**
 * PHASE 2 STEP 2.2B — BuyerRequest: чистые валидаторы.
 *
 * - даты: date-only (YYYY-MM-DD → UTC midnight), не в прошлом, from <= to
 *   (reuse канонического parseServiceDate из Sales — чистая функция); оба
 *   nullable = открытые даты; никакого timezone/time-slot (2.8A);
 * - PAX: минимум 1 взрослый, без PII;
 * - budget: не-binding demand hint {currency, min?, max?} (НЕ цена Quote/Sale);
 * - preferences: free-form demand hints (объект, размер ограничен, без
 *   контактов/PII — сервер не принимает contact-поля);
 * - destinations: та же структурная representation, что у capability
 *   (normalizeDestinations из capabilities.validation).
 */
import { ValidationDomainError } from "../../shared/errors";
import { parseServiceDate } from "../sales/sales.checkout";
import { normalizeDestinations, type CapabilityDestination } from "./capabilities.validation";

export type { CapabilityDestination };

export const MAX_ADULTS = 50;
export const MAX_CHILDREN = 50;
export const MAX_INFANTS = 50;
const CURRENCY_RE = /^[A-Z]{3}$/;
const MAX_PREFERENCES_KEYS = 20;
const MAX_PREFERENCES_JSON = 8192;

export interface RequestDates {
  serviceDateFrom?: Date;
  serviceDateTo?: Date;
}

/** Валидация date-only диапазона. Оба опциональны (открытые даты). */
export function normalizeRequestDates(fromRaw: string | undefined, toRaw: string | undefined, now = new Date()): RequestDates {
  const from = fromRaw === undefined ? undefined : parseServiceDate(fromRaw, now);
  const to = toRaw === undefined ? undefined : parseServiceDate(toRaw, now);
  if (from && to && from.getTime() > to.getTime()) {
    throw new ValidationDomainError("serviceDateFrom must not be after serviceDateTo");
  }
  return { serviceDateFrom: from, serviceDateTo: to };
}

export interface Pax {
  adults: number;
  children: number;
  infants: number;
}

export function normalizePax(adults: number, children: number, infants: number): Pax {
  if (!Number.isInteger(adults) || adults < 1 || adults > MAX_ADULTS) {
    throw new ValidationDomainError(`adults must be an integer between 1 and ${MAX_ADULTS}`);
  }
  if (!Number.isInteger(children) || children < 0 || children > MAX_CHILDREN) {
    throw new ValidationDomainError(`children must be an integer between 0 and ${MAX_CHILDREN}`);
  }
  if (!Number.isInteger(infants) || infants < 0 || infants > MAX_INFANTS) {
    throw new ValidationDomainError(`infants must be an integer between 0 and ${MAX_INFANTS}`);
  }
  return { adults, children, infants };
}

export interface BudgetHint {
  currency: string;
  min?: number;
  max?: number;
}

/** Не-binding demand hint: {currency, min?, max?}. Валидация сервером. */
export function normalizeBudget(raw: unknown): BudgetHint | undefined {
  if (raw === undefined || raw === null) return undefined;
  if (typeof raw !== "object" || Array.isArray(raw)) {
    throw new ValidationDomainError("budget must be an object { currency, min?, max? }");
  }
  const b = raw as Record<string, unknown>;
  const keys = Object.keys(b);
  const unknown = keys.filter((k) => !["currency", "min", "max"].includes(k));
  if (unknown.length > 0) {
    throw new ValidationDomainError(`budget has unknown keys: ${unknown.join(", ")}`);
  }
  if (typeof b.currency !== "string" || !CURRENCY_RE.test(b.currency)) {
    throw new ValidationDomainError("budget.currency must be a 3-letter ISO code (A-Z)");
  }
  const min = b.min === undefined ? undefined : b.min;
  const max = b.max === undefined ? undefined : b.max;
  for (const [name, v] of [["min", min], ["max", max]] as const) {
    if (v !== undefined && (typeof v !== "number" || !Number.isFinite(v) || v < 0)) {
      throw new ValidationDomainError(`budget.${name} must be a non-negative number`);
    }
  }
  const minNum = min as number | undefined;
  const maxNum = max as number | undefined;
  if (minNum !== undefined && maxNum !== undefined && minNum > maxNum) {
    throw new ValidationDomainError("budget.min must not exceed budget.max");
  }
  const out: BudgetHint = { currency: b.currency };
  if (minNum !== undefined) out.min = minNum;
  if (maxNum !== undefined) out.max = maxNum;
  return out;
}

/**
 * Free-form demand hints (не-binding). Ограничения: plain object, ограниченный
 * размер/глубина, без контактных полей НА ЛЮБОЙ ГЛУБИНЕ (email/phone/
 * whatsapp/telegram/social/url/wa/tel/mail — reject: demand-стадия PII-minimal).
 *
 * ЧЕСТНАЯ ГРАНИЦА (не DLP-движок): сканируются СТРУКТУРНЫЕ КЛЮЧИ на любой
 * глубине вложенности (включая ключи объектов внутри массивов). Значения НЕ
 * контент-сканируются (free-form текст, напр. `{ note: "позвоните +994..." }`
 * не детектируется) — это задокументированное ограничение, а не обещание DLP.
 * Деманд-стадия не хранит контакты; раскрытие preferences Seller-ам — решение
 * 2.2E/2.2F, не 2.2B.
 */
const CONTACT_TOKENS = ["email", "phone", "whatsapp", "telegram", "social", "url", "website", "passport"];
/// Слабые токены — только как целые слова (word-boundary), чтобы НЕ ловить
/// легитимные ключи: "travel" (tel), "automobile" (mobile), "roomNumber".
const CONTACT_WORD_TOKENS = ["contact", "document", "wa", "tel", "mail", "mobile"];
const MAX_PREFERENCES_DEPTH = 6;

function hasContactWord(key: string): boolean {
  return CONTACT_WORD_TOKENS.some((t) => new RegExp(`\\b${t}\\b`).test(key));
}

/** Рекурсивный структурный скан ключей на любой глубине (bounded depth). */
function findContactKeys(value: unknown, path: string, depth: number): string[] {
  if (depth > MAX_PREFERENCES_DEPTH) return [];
  if (Array.isArray(value)) {
    const hits: string[] = [];
    for (const item of value) hits.push(...findContactKeys(item, `${path}[]`, depth + 1));
    return hits;
  }
  if (value && typeof value === "object") {
    const hits: string[] = [];
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      const lower = k.toLowerCase();
      if (CONTACT_TOKENS.some((t) => lower.includes(t)) || hasContactWord(lower)) {
        hits.push(`${path}.${k}`);
      }
      hits.push(...findContactKeys(v, `${path}.${k}`, depth + 1));
    }
    return hits;
  }
  return [];
}

export function normalizePreferences(raw: unknown): Record<string, unknown> | undefined {
  if (raw === undefined || raw === null) return undefined;
  if (typeof raw !== "object" || Array.isArray(raw)) {
    throw new ValidationDomainError("preferences must be an object");
  }
  const p = raw as Record<string, unknown>;
  const keys = Object.keys(p);
  if (keys.length > MAX_PREFERENCES_KEYS) {
    throw new ValidationDomainError(`preferences must contain at most ${MAX_PREFERENCES_KEYS} keys`);
  }
  const contactHits = findContactKeys(p, "$", 0);
  if (contactHits.length > 0) {
    throw new ValidationDomainError(`preferences must not contain contact/PII keys: ${contactHits.slice(0, 5).join(", ")}`);
  }
  try {
    const json = JSON.stringify(p);
    if (json.length > MAX_PREFERENCES_JSON) {
      throw new ValidationDomainError(`preferences payload is too large (max ${MAX_PREFERENCES_JSON} bytes)`);
    }
  } catch {
    throw new ValidationDomainError("preferences must be JSON-serializable");
  }
  return p;
}

export { normalizeDestinations };
