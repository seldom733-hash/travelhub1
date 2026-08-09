/**
 * PHASE 1 STEP 1.12.3 — Storefront behavioral event contracts (canonical).
 *
 * Разделение (ADR-0008):
 *  - Publication channel (`ProductPublicationChannel`) — где Product разрешён;
 *  - AcquisitionSource — через какой пользовательский контекст возникло
 *    взаимодействие. Для Storefront events сервер authoritatively фиксирует
 *    PARTNER_STOREFRONT (endpoint storefront-scoped); DIRECT — только при
 *    будущем referral/entry-контракте; MARKETPLACE — зарезервирован (1.13B).
 *
 * Events (только реальные producers, без speculative):
 *  - STOREFRONT_VIEWED                 — посещение публичной home витрины;
 *  - STOREFRONT_PRODUCT_IMPRESSION     — карточка продукта реально отрисована
 *                                        в grid (rendered-card семантика);
 *  - STOREFRONT_PRODUCT_VIEWED         — открыт публичный Storefront PDP;
 *  - STOREFRONT_CONTACT_CLICKED        — клик по structured контакту (намерение,
 *                                        НЕ Lead/Conversion/Sale).
 *
 * Envelope: eventId (UUID, dedup), eventType, occurredAt (client UTC, skew-окно
 * на сервере), storefrontId/productId (canonical, сервер резолвит из slug),
 * sessionId (opaque non-PII), acquisitionSource (server-authoritative), locale,
 * path, минимальный per-eventType payload. НИКОГДА: contact values, email/phone/
 * URL, raw IP, tokens, User/CRM/legal/tax, произвольный JSON.
 */

/** Типы behavioral events (namespace STOREFRONT_* не конфликтует с 1.13B). */
export const STOREFRONT_BEHAVIORAL_EVENT_TYPES = [
  "STOREFRONT_VIEWED",
  "STOREFRONT_PRODUCT_IMPRESSION",
  "STOREFRONT_PRODUCT_VIEWED",
  "STOREFRONT_CONTACT_CLICKED",
] as const;
export type StorefrontBehavioralEventType = (typeof STOREFRONT_BEHAVIORAL_EVENT_TYPES)[number];

/** Типы контактов для CONTACT_CLICKED (значение контакта НЕ хранится). */
export const CONTACT_TYPES = ["PHONE", "EMAIL", "WHATSAPP", "WEBSITE", "SOCIAL"] as const;
export type StorefrontContactType = (typeof CONTACT_TYPES)[number];

/** Acquisition sources (расширяемы future values; не хардкодим коммерческую модель). */
export const ACQUISITION_SOURCES = ["MARKETPLACE", "PARTNER_STOREFRONT", "DIRECT"] as const;
export type AcquisitionSource = (typeof ACQUISITION_SOURCES)[number];

/** Locale контента (display locale, не country code). */
export const EVENT_LOCALES = ["ru", "az", "en"] as const;

/** Placement импрессии (minimal; viewport-visibility — deferred). */
export const IMPRESSION_PLACEMENTS = ["grid"] as const;

export interface StorefrontContactClickedPayload {
  contactType: StorefrontContactType;
  /** Только для SOCIAL: нормализованная платформа (whitelist) — не контактное значение. */
  platform?: string;
}

export interface StorefrontImpressionPayload {
  placement?: (typeof IMPRESSION_PLACEMENTS)[number];
}

/** Whitelist payload по eventType (никакого arbitrary JSON). */
export type StorefrontEventPayload =
  | Record<string, never> // VIEWED / PRODUCT_VIEWED
  | StorefrontImpressionPayload
  | StorefrontContactClickedPayload;

/** Форбidden поля envelope (клиент НЕ может forged) + contact values в payload. */
export const STOREFRONT_EVENT_FORBIDDEN_KEYS = [
  "id",
  "code",
  "storefrontId",
  "partnerId",
  "productId",
  "userId",
  "authenticatedUserId",
  "acquisitionSource",
  "receivedAt",
  "createdAt",
  "updatedAt",
  // Contact values (privacy): НИКОГДА не принимать значение контакта.
  "email",
  "phone",
  "whatsapp",
  "website",
  "websiteUrl",
  "url",
  "value",
  "contact",
  "rawIp",
  "ip",
  "token",
  "authorization",
] as const;
