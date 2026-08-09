import { ValidationDomainError } from "../../../shared/errors";
import {
  CONTACT_TYPES,
  EVENT_LOCALES,
  IMPRESSION_PLACEMENTS,
  STOREFRONT_BEHAVIORAL_EVENT_TYPES,
  type StorefrontBehavioralEventType,
  type StorefrontContactType,
} from "./storefront-behavioral.contracts";

/**
 * PHASE 1 STEP 1.12.3 — чистые валидаторы behavioral events (unit-тестируемы).
 * Серверная валидация ПОВЕРХ class-validator DTO: semantic checks (skew, path,
 * payload whitelist), которые DTO-декораторами выражаются не полностью.
 */

/** Opaque anonymous sessionId: 8-64 символов, без PII, без пробелов/спецсимволов. */
const SESSION_ID_RE = /^[A-Za-z0-9_-]{8,64}$/;

/** path публичной Storefront: /store/<slug>[/products/<slug>], без ?/#/.. */
const STOREFRONT_PATH_RE = /^\/store\/[a-z0-9]+(?:-[a-z0-9]+)*(?:\/products\/[^/?#]+)?$/;

/** Допустимое clock-skew окно для client occurredAt (UTC). */
export const OCCURRED_AT_SKEW_MS = 10 * 60 * 1000; // ±10 минут

export function validateSessionId(sessionId: unknown): string {
  if (typeof sessionId !== "string" || !SESSION_ID_RE.test(sessionId)) {
    throw new ValidationDomainError(
      "Invalid sessionId: use 8-64 chars of letters/digits/underscore/hyphen (opaque non-PII)",
    );
  }
  return sessionId;
}

/**
 * occurredAt — фактическое UTC-время действия пользователя. Сервер отклоняет
 * таймстемпы за пределами clock-skew окна (forged далеко прошлое/будущее).
 */
export function validateOccurredAt(value: unknown, now: Date = new Date()): Date {
  const ts = typeof value === "string" ? Date.parse(value) : Number.NaN;
  if (!Number.isFinite(ts)) {
    throw new ValidationDomainError("occurredAt must be a valid ISO-8601 UTC timestamp");
  }
  const skew = Math.abs(ts - now.getTime());
  if (skew > OCCURRED_AT_SKEW_MS) {
    throw new ValidationDomainError(
      `occurredAt is outside the allowed clock-skew window (±${OCCURRED_AT_SKEW_MS / 60000} min)`,
    );
  }
  return new Date(ts);
}

/** path должен принадлежать этой витрине (slug) и быть публичным Storefront path. */
export function validateEventPath(path: unknown, slug: string): string {
  if (typeof path !== "string" || path.length === 0 || path.length > 300) {
    throw new ValidationDomainError("path must be a non-empty string (max 300 chars)");
  }
  if (!STOREFRONT_PATH_RE.test(path)) {
    throw new ValidationDomainError("path must match /store/<slug>[/products/<slug>] (no query/hash/traversal)");
  }
  if (!(path === `/store/${slug}` || path.startsWith(`/store/${slug}/products/`))) {
    throw new ValidationDomainError(`path does not belong to storefront "${slug}"`);
  }
  return path;
}

export function validateEventLocale(locale: unknown): string {
  if (typeof locale !== "string" || !(EVENT_LOCALES as readonly string[]).includes(locale)) {
    throw new ValidationDomainError(`locale must be one of: ${EVENT_LOCALES.join(", ")}`);
  }
  return locale;
}

export function validateEventType(eventType: unknown): StorefrontBehavioralEventType {
  if (typeof eventType !== "string" || !(STOREFRONT_BEHAVIORAL_EVENT_TYPES as readonly string[]).includes(eventType)) {
    throw new ValidationDomainError(
      `eventType must be one of: ${STOREFRONT_BEHAVIORAL_EVENT_TYPES.join(", ")}`,
    );
  }
  return eventType as StorefrontBehavioralEventType;
}

/** Product-related события требуют productSlug. */
export function requiresProduct(eventType: StorefrontBehavioralEventType): boolean {
  return eventType === "STOREFRONT_PRODUCT_IMPRESSION" || eventType === "STOREFRONT_PRODUCT_VIEWED";
}

/**
 * Строгий whitelist payload по eventType. Никакого arbitrary JSON:
 *  - VIEWED / PRODUCT_VIEWED → пустой payload;
 *  - PRODUCT_IMPRESSION → { placement?: "grid" };
 *  - CONTACT_CLICKED → { contactType, platform? } — platform обязательна ТОЛЬКО
 *    для SOCIAL; контактные значения запрещены (форбidden ключи).
 */
export function validateEventPayload(
  eventType: StorefrontBehavioralEventType,
  payload: unknown,
  socialPlatforms: readonly string[],
): Record<string, unknown> | null {
  const empty = (): null => {
    if (payload === undefined || payload === null) return null;
    if (typeof payload !== "object" || Array.isArray(payload) || Object.keys(payload as object).length !== 0) {
      throw new ValidationDomainError(`eventType ${eventType} does not accept a payload`);
    }
    return null;
  };

  switch (eventType) {
    case "STOREFRONT_VIEWED":
    case "STOREFRONT_PRODUCT_VIEWED":
      return empty();
    case "STOREFRONT_PRODUCT_IMPRESSION": {
      if (payload === undefined || payload === null) return null;
      if (typeof payload !== "object" || Array.isArray(payload)) {
        throw new ValidationDomainError("impression payload must be an object");
      }
      const p = payload as Record<string, unknown>;
      const keys = Object.keys(p);
      if (keys.length > 1 || (keys.length === 1 && keys[0] !== "placement")) {
        throw new ValidationDomainError("impression payload allows only optional placement");
      }
      if (p.placement !== undefined) {
        if (typeof p.placement !== "string" || !(IMPRESSION_PLACEMENTS as readonly string[]).includes(p.placement)) {
          throw new ValidationDomainError(`placement must be one of: ${IMPRESSION_PLACEMENTS.join(", ")}`);
        }
      }
      return keys.length === 0 ? null : { placement: p.placement as string };
    }
    case "STOREFRONT_CONTACT_CLICKED": {
      if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
        throw new ValidationDomainError("contact click requires a payload object with contactType");
      }
      const p = payload as Record<string, unknown>;
      const contactType = p.contactType;
      if (typeof contactType !== "string" || !(CONTACT_TYPES as readonly string[]).includes(contactType)) {
        throw new ValidationDomainError(`contactType must be one of: ${CONTACT_TYPES.join(", ")}`);
      }
      const result: Record<string, unknown> = { contactType };
      if (contactType === "SOCIAL") {
        const platform = p.platform;
        if (typeof platform !== "string" || !socialPlatforms.includes(platform)) {
          throw new ValidationDomainError(
            `SOCIAL click requires platform from: ${socialPlatforms.join(", ")}`,
          );
        }
        result.platform = platform;
      } else {
        if (p.platform !== undefined) {
          throw new ValidationDomainError("platform is allowed only for SOCIAL contact clicks");
        }
      }
      const allowed = new Set(["contactType", "platform"]);
      for (const key of Object.keys(p)) {
        if (!allowed.has(key)) {
          throw new ValidationDomainError(`unexpected contact payload field "${key}"`);
        }
      }
      return result;
    }
  }
}

/** Нормализация contactType payload → строгое значение. */
export function toContactType(value: string): StorefrontContactType {
  return value as StorefrontContactType;
}
