/**
 * PHASE 1 STEP 1.13B — Marketplace behavioral event contracts (canonical).
 *
 * Расширение behavioral foundation (Step 1.12.3) до Marketplace scope — та же
 * semantic discipline, что у Storefront, отдельная narrow-таблица
 * `MarketplaceBehavioralEvent` (Storefront-события не трогаются).
 *
 * Publication ≠ acquisition ≠ behavioral context:
 *  - PublicationChannel (MARKETPLACE/PARTNER_STOREFRONT) — где Product разрешён;
 *  - AcquisitionSource — через какой пользовательский контекст возникло
 *    взаимодействие; для Marketplace events сервер authoritatively фиксирует
 *    MARKETPLACE (endpoint marketplace-scoped). Каналы публикации Product из
 *    behavioral events НЕ мутируют.
 *
 * Events (только реальные producers — UI Marketplace):
 *  - MARKETPLACE_VIEWED              — публичная Marketplace home открыта;
 *  - MARKETPLACE_PRODUCT_IMPRESSION  — карточка Product отрисована в grid
 *                                      (rendered-card; viewport — deferred);
 *  - MARKETPLACE_PRODUCT_VIEWED      — открыт публичный Marketplace PDP;
 *  - MARKETPLACE_SEARCH_PERFORMED    — committed search (submit/URL state);
 *  - MARKETPLACE_CATEGORY_VIEWED     — открыта публичная category surface;
 *  - MARKETPLACE_FILTER_APPLIED      — применён фильтр (whitelist key+value);
 *  - MARKETPLACE_SORT_CHANGED        — изменена сортировка (whitelist enum);
 *  - MARKETPLACE_CTA_CLICKED         — клик по CTA Marketplace PDP (намерение).
 *
 * Envelope: eventId (UUID, dedup), eventType, occurredAt (client UTC, skew-окно),
 * productId/categoryId (canonical, сервер резолвит из slug), sessionId (opaque
 * non-PII), acquisitionSource (server-authoritative MARKETPLACE), locale, path,
 * строгий per-eventType payload. НИКОГДА: contact values, email/phone/URL, raw IP,
 * tokens, User/CRM/legal/tax, произвольный JSON, raw search query без guard.
 */

/** Типы behavioral events (namespace MARKETPLACE_* — не конфликтует с 1.12.3). */
export const MARKETPLACE_BEHAVIORAL_EVENT_TYPES = [
  "MARKETPLACE_VIEWED",
  "MARKETPLACE_PRODUCT_IMPRESSION",
  "MARKETPLACE_PRODUCT_VIEWED",
  "MARKETPLACE_SEARCH_PERFORMED",
  "MARKETPLACE_CATEGORY_VIEWED",
  "MARKETPLACE_FILTER_APPLIED",
  "MARKETPLACE_SORT_CHANGED",
  "MARKETPLACE_CTA_CLICKED",
] as const;
export type MarketplaceBehavioralEventType = (typeof MARKETPLACE_BEHAVIORAL_EVENT_TYPES)[number];

/** Locale контента (display locale, не country code) — общий с Storefront. */
export { EVENT_LOCALES } from "./storefront-behavioral.contracts";

/** Acquisition sources (server-authoritative). */
export { ACQUISITION_SOURCES, type AcquisitionSource } from "./storefront-behavioral.contracts";

/** Placement импрессии (rendered-card в grid; viewport-visibility — deferred). */
export const MARKETPLACE_IMPRESSION_PLACEMENTS = ["grid"] as const;

/** Сортировки Marketplace (whitelist, соответствует UI-опциям sort). */
export const MARKETPLACE_SORT_VALUES = ["newest", "price_asc", "price_desc"] as const;

/**
 * Search privacy guard (§15, вариант A): query хранится только нормализованная
 * и усечённая, с запретом contact-like контента (email/phone/URL). НИКОГДА не
 * raw произвольный текст из поля поиска без guard.
 */
export const SEARCH_QUERY_MAX_LENGTH = 80;

/** Ключ фильтра: нормализованный schema attribute key (lowercase snake). */
export const MARKETPLACE_FILTER_PAYLOAD_KEY_RE = /^[a-z][a-z0-9_]{0,31}$/;

export interface MarketplaceImpressionPayload {
  placement?: (typeof MARKETPLACE_IMPRESSION_PLACEMENTS)[number];
  /** 0-based позиция карточки в отрисованном grid (детерминирована по порядку
   *  карточек, НЕ глобальный рейтинг). */
  position?: number;
}

export interface MarketplaceSearchPayload {
  /** Нормализованная/усечённая query (privacy guard). Отсутствует, если search
   *  был без текста (например, category-only). */
  query?: string;
}

export interface MarketplaceFilterPayload {
  key: string;
  value: string;
}

export interface MarketplaceSortPayload {
  sort: (typeof MARKETPLACE_SORT_VALUES)[number];
}

/** Whitelist payload по eventType (никакого arbitrary JSON). */
export type MarketplaceEventPayload =
  | Record<string, never> // VIEWED / PRODUCT_VIEWED / CATEGORY_VIEWED / CTA_CLICKED
  | MarketplaceImpressionPayload
  | MarketplaceSearchPayload
  | MarketplaceFilterPayload
  | MarketplaceSortPayload;

/**
 * Forbidden поля envelope (клиент не может forged) + contact values в payload.
 * Расширяет Storefront-список: productId/categoryId/partnerId/sellerId/
 * storefrontId/authenticatedUserId/acquisitionSource/actor и т.п.
 */
export const MARKETPLACE_EVENT_FORBIDDEN_KEYS = [
  "id",
  "code",
  "productId",
  "categoryId",
  "partnerId",
  "sellerId",
  "storefrontId",
  "userId",
  "authenticatedUserId",
  "customerId",
  "actorId",
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
