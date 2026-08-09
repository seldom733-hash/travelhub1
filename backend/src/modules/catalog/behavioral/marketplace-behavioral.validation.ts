import { ValidationDomainError } from "../../../shared/errors";
import {
  MARKETPLACE_BEHAVIORAL_EVENT_TYPES,
  MARKETPLACE_FILTER_PAYLOAD_KEY_RE,
  MARKETPLACE_IMPRESSION_PLACEMENTS,
  MARKETPLACE_SORT_VALUES,
} from "./marketplace-behavioral.contracts";
import {
  validateEventLocale,
  validateOccurredAt,
  validateSessionId,
} from "./storefront-behavioral.validation";

/**
 * PHASE 1 STEP 1.13B — чистые валидаторы Marketplace behavioral events.
 * Переиспользует общие helpers Storefront (sessionId/occurredAt/locale) —
 * та же semantic discipline, без расходящейся копии.
 */

/** path публичного Marketplace: /, /search, /categories/<slug>, /products/<slug>. */
const MARKETPLACE_PATH_RE = /^\/(search|categories\/[a-z0-9]+(?:-[a-z0-9]+)*|products\/[^/?#]+)?$/;

/** Search privacy guard: query НЕ должна содержать contact-like контент. */
const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{1,}/i;
const PHONE_RE = /\+?[0-9][0-9\s()-]{7,}/;
const URL_RE = /(https?:\/\/|www\.)\S+/i;
// Messaging-хендлы без схемы (strict review §4): t.me/wa.me/Telegram/WhatsApp —
// недвусмысленные contact-ссылки, хранить нельзя даже без http(s). Generic
// bare domain (booking.com и т.п.) НЕ блокируем — легитимный поисковый термин.
const MESSAGING_RE = /(?:t\.me|wa\.me|telegram|whatsapp)\b/i;

export function validateMarketplaceEventType(eventType: unknown): string {
  if (typeof eventType !== "string" || !(MARKETPLACE_BEHAVIORAL_EVENT_TYPES as readonly string[]).includes(eventType)) {
    throw new ValidationDomainError(
      `eventType must be one of: ${MARKETPLACE_BEHAVIORAL_EVENT_TYPES.join(", ")}`,
    );
  }
  return eventType;
}

export function validateMarketplacePath(path: unknown): string {
  if (typeof path !== "string" || path.length === 0 || path.length > 300) {
    throw new ValidationDomainError("path must be a non-empty string (max 300 chars)");
  }
  if (!MARKETPLACE_PATH_RE.test(path)) {
    throw new ValidationDomainError("path must match /, /search, /categories/<slug> or /products/<slug>");
  }
  return path;
}

/** Product-related события требуют productSlug (IMPRESSION/VIEWED). */
export function requiresMarketplaceProduct(eventType: string): boolean {
  return eventType === "MARKETPLACE_PRODUCT_IMPRESSION" || eventType === "MARKETPLACE_PRODUCT_VIEWED";
}

/** Category-related события требуют categorySlug (CATEGORY_VIEWED/FILTER_APPLIED). */
export function requiresMarketplaceCategory(eventType: string): boolean {
  return eventType === "MARKETPLACE_CATEGORY_VIEWED" || eventType === "MARKETPLACE_FILTER_APPLIED";
}

/**
 * Нормализация search query (§15 вариант A): trim + collapse whitespace +
 * усечение до SEARCH_QUERY_MAX_LENGTH + запрет contact-like контента.
 * Возвращает null для пустой query (search без текста — валиден, query не хранится).
 */
export function normalizeSearchQuery(raw: unknown): string | null {
  if (raw === undefined || raw === null) return null;
  if (typeof raw !== "string") {
    throw new ValidationDomainError("search query must be a string");
  }
  let q = raw.trim().replace(/\s+/g, " ");
  if (q.length === 0) return null;
  // Порядок: guard ПЕРЕД truncate — усечение не скрывает опасную часть original input.
  if (EMAIL_RE.test(q) || PHONE_RE.test(q) || URL_RE.test(q) || MESSAGING_RE.test(q)) {
    throw new ValidationDomainError("search query must not contain email/phone/URL/messaging content (privacy guard)");
  }
  if (q.length > 80) q = q.slice(0, 80);
  return q;
}

/**
 * Строгий whitelist payload по eventType. Никакого arbitrary JSON:
 *  - VIEWED / PRODUCT_VIEWED / CATEGORY_VIEWED / CTA_CLICKED → пустой payload;
 *  - IMPRESSION → { placement?: "grid", position?: number (0-based) };
 *  - SEARCH → { query?: нормализованная строка (privacy guard) };
 *  - FILTER → { key, value } (whitelist-ключи, значения нормализованные);
 *  - SORT → { sort } (whitelist enum).
 */
export function validateMarketplacePayload(
  eventType: string,
  payload: unknown,
): Record<string, unknown> | null {
  const empty = (): null => {
    if (payload === undefined || payload === null) return null;
    if (typeof payload !== "object" || Array.isArray(payload) || Object.keys(payload as object).length !== 0) {
      throw new ValidationDomainError(`eventType ${eventType} does not accept a payload`);
    }
    return null;
  };

  switch (eventType) {
    case "MARKETPLACE_VIEWED":
    case "MARKETPLACE_PRODUCT_VIEWED":
    case "MARKETPLACE_CATEGORY_VIEWED":
    case "MARKETPLACE_CTA_CLICKED":
      return empty();
    case "MARKETPLACE_PRODUCT_IMPRESSION": {
      if (payload === undefined || payload === null) return null;
      if (typeof payload !== "object" || Array.isArray(payload)) {
        throw new ValidationDomainError("impression payload must be an object");
      }
      const p = payload as Record<string, unknown>;
      const keys = Object.keys(p);
      for (const k of keys) {
        if (k !== "placement" && k !== "position") {
          throw new ValidationDomainError(`unexpected impression payload field "${k}"`);
        }
      }
      const result: Record<string, unknown> = {};
      if (p.placement !== undefined) {
        if (typeof p.placement !== "string" || !(MARKETPLACE_IMPRESSION_PLACEMENTS as readonly string[]).includes(p.placement)) {
          throw new ValidationDomainError("placement must be \"grid\"");
        }
        result.placement = p.placement;
      }
      if (p.position !== undefined) {
        if (typeof p.position !== "number" || !Number.isInteger(p.position) || p.position < 0 || p.position > 1000) {
          throw new ValidationDomainError("position must be a non-negative integer (0-based)");
        }
        result.position = p.position;
      }
      return Object.keys(result).length === 0 ? null : result;
    }
    case "MARKETPLACE_SEARCH_PERFORMED": {
      if (payload === undefined || payload === null) return null;
      if (typeof payload !== "object" || Array.isArray(payload)) {
        throw new ValidationDomainError("search payload must be an object");
      }
      const p = payload as Record<string, unknown>;
      for (const k of Object.keys(p)) {
        if (k !== "query") throw new ValidationDomainError(`unexpected search payload field "${k}"`);
      }
      const query = normalizeSearchQuery(p.query);
      return query === null ? null : { query };
    }
    case "MARKETPLACE_FILTER_APPLIED": {
      if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
        throw new ValidationDomainError("filter payload requires an object with key and value");
      }
      const p = payload as Record<string, unknown>;
      if (typeof p.key !== "string" || !MARKETPLACE_FILTER_PAYLOAD_KEY_RE.test(p.key)) {
        throw new ValidationDomainError("filter key must match [a-z][a-z0-9_]{0,31}");
      }
      if (typeof p.value !== "string" || p.value.length === 0 || p.value.length > 80) {
        throw new ValidationDomainError("filter value must be a non-empty string (max 80 chars)");
      }
      if (EMAIL_RE.test(p.value) || URL_RE.test(p.value) || MESSAGING_RE.test(p.value)) {
        throw new ValidationDomainError("filter value must not contain email/URL/messaging content (privacy guard)");
      }
      for (const k of Object.keys(p)) {
        if (k !== "key" && k !== "value") throw new ValidationDomainError(`unexpected filter payload field "${k}"`);
      }
      return { key: p.key, value: p.value };
    }
    case "MARKETPLACE_SORT_CHANGED": {
      if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
        throw new ValidationDomainError("sort payload requires an object with sort");
      }
      const p = payload as Record<string, unknown>;
      if (typeof p.sort !== "string" || !(MARKETPLACE_SORT_VALUES as readonly string[]).includes(p.sort)) {
        throw new ValidationDomainError(`sort must be one of: ${MARKETPLACE_SORT_VALUES.join(", ")}`);
      }
      for (const k of Object.keys(p)) {
        if (k !== "sort") throw new ValidationDomainError(`unexpected sort payload field "${k}"`);
      }
      return { sort: p.sort };
    }
    default:
      throw new ValidationDomainError(`unknown eventType ${eventType}`);
  }
}
