"use client";

import { useEffect, useRef } from "react";
import { useLocale } from "@/lib/i18n";
import { usePathname } from "next/navigation";

/**
 * PHASE 1 STEP 1.12.3 — privacy-safe behavioral event client (public Storefront).
 *
 * Инварианты:
 *  - ТОЛЬКО public endpoint /api/v1/public/storefronts/:slug/events, БЕЗ
 *    Authorization by construction (даже при залогиненном пользователе);
 *  - sessionId — opaque non-PII (случайный, 8-64 [A-Za-z0-9_-]), без
 *    fingerprinting / cross-device graph; malformed → пересоздаётся;
 *  - eventId — crypto.randomUUID() на ОДНО намеренное действие; retry того же
 *    eventId deduplicated сервером (unique constraint);
 *  - occurredAt — фактическое UTC-время действия (клиент); сервер проверяет
 *    clock-skew окно;
 *  - payload — только contactType/platform/placement; НИКОГДА contact value /
 *    email/phone/URL из DOM;
 *  - keepalive: отправка не блокирует навигацию (phone/mailto/wa.me/внешние
 *    ссылки); сбой tracking НЕ ломает UI (fire-and-forget, bounded — без retry
 *    loop); страница недоступна из-за analytics никогда не становится;
 *  - preview: enabled=false → события не отправляются (preview не считается
 *    public StorefrontViewed).
 */

const SESSION_KEY = "travelhub.sf.sessionId";
const SESSION_RE = /^[A-Za-z0-9_-]{8,64}$/;

export type StorefrontBehavioralEventType =
  | "STOREFRONT_VIEWED"
  | "STOREFRONT_PRODUCT_IMPRESSION"
  | "STOREFRONT_PRODUCT_VIEWED"
  | "STOREFRONT_CONTACT_CLICKED";

export type StorefrontContactType = "PHONE" | "EMAIL" | "WHATSAPP" | "WEBSITE" | "SOCIAL";

export interface TrackStorefrontEventInput {
  slug: string;
  eventType: StorefrontBehavioralEventType;
  path: string;
  productSlug?: string;
  payload?: Record<string, unknown>;
}

/** Opaque anonymous sessionId (8-64 chars, без PII). SSR-safe. */
export function getOrCreateSessionId(): string {
  if (typeof window === "undefined") return "ssr_noop_session";
  let sid = window.localStorage.getItem(SESSION_KEY);
  if (!sid || !SESSION_RE.test(sid)) {
    sid = `sf_${crypto.randomUUID().replace(/-/g, "").slice(0, 32)}`;
    window.localStorage.setItem(SESSION_KEY, sid);
  }
  return sid;
}

/** Отправка одного behavioral event. Fire-and-forget, без Authorization, без retry. */
export function trackStorefrontEvent(input: TrackStorefrontEventInput): void {
  try {
    if (typeof window === "undefined") return;
    const body = {
      eventId: crypto.randomUUID(),
      eventType: input.eventType,
      occurredAt: new Date().toISOString(),
      sessionId: getOrCreateSessionId(),
      locale: window.localStorage.getItem("travelhub.locale") ?? "ru",
      path: input.path,
      productSlug: input.productSlug,
      payload: input.payload,
    };
    // keepalive: запрос завершается даже при уходе со страницы; НЕ ждём ответа.
    void fetch(`/api/v1/public/storefronts/${encodeURIComponent(input.slug)}/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      keepalive: true,
    }).catch(() => {
      /* tracking failure никогда не ломает UI/navigation */
    });
  } catch {
    /* noop */
  }
}

/** Клик по structured контакту: тип (и platform для SOCIAL), БЕЗ значения. */
export function fireContactClick(
  slug: string,
  contactType: StorefrontContactType,
  platform?: string,
): void {
  trackStorefrontEvent({
    slug,
    eventType: "STOREFRONT_CONTACT_CLICKED",
    path: typeof window !== "undefined" ? window.location.pathname : `/store/${slug}`,
    payload: contactType === "SOCIAL" && platform ? { contactType, platform } : { contactType },
  });
}

/**
 * Fire-once хук (StrictMode-safe): событие отправляется один раз на ключ за
 * жизнь компонента. Повторный mount того же компонента (StrictMode dev
 * double-invoke) — не дублирует; новый заход на страницу (новый mount) —
 * создаёт корректное новое событие.
 */
export function useFireOnce(key: string, enabled: boolean, fn: () => void): void {
  const fired = useRef<Set<string>>(new Set());
  const fnRef = useRef(fn);
  fnRef.current = fn;
  useEffect(() => {
    if (!enabled) return;
    if (fired.current.has(key)) return;
    fired.current.add(key);
    fnRef.current();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled]);
}

/** Хук для Storefront home: STOREFRONT_VIEWED один раз за посещение. */
export function useStorefrontViewed(slug: string, enabled: boolean): void {
  const path = `/store/${slug}`;
  useFireOnce(`viewed:${slug}`, enabled, () => trackStorefrontEvent({ slug, eventType: "STOREFRONT_VIEWED", path }));
}

/** Хук для Storefront PDP: STOREFRONT_PRODUCT_VIEWED один раз за открытие. */
export function useStorefrontProductViewed(slug: string, productSlug: string, enabled: boolean): void {
  const path = `/store/${slug}/products/${productSlug}`;
  useFireOnce(`pviewed:${slug}:${productSlug}`, enabled, () =>
    trackStorefrontEvent({ slug, eventType: "STOREFRONT_PRODUCT_VIEWED", path, productSlug }),
  );
}

/**
 * Импрессия карточки: rendered-card семантика (карточка реально отрисована в
 * grid; viewport-visibility — deferred). Одна импрессия на карточку за mount;
 * API-fetch сам по себе импрессией НЕ является.
 */
export function useStorefrontCardImpression(slug: string, productSlug: string, enabled: boolean): void {
  const path = `/store/${slug}`;
  useFireOnce(`impression:${slug}:${productSlug}`, enabled, () =>
    trackStorefrontEvent({ slug, eventType: "STOREFRONT_PRODUCT_IMPRESSION", path, productSlug, payload: { placement: "grid" } }),
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PHASE 1 STEP 1.13B — Marketplace behavioral events (public Marketplace).
//
// Та же semantic discipline, что у Storefront (Step 1.12.3):
//  - ТОЛЬКО public endpoint /api/v1/public/marketplace/events, БЕЗ Authorization;
//  - sessionId — отдельный opaque non-PII namespace (travelhub.mp.sessionId),
//    НЕ трогает существующий Storefront контракт; тот же формат 8-64 [A-Za-z0-9_-];
//  - eventId — crypto.randomUUID() на одно намеренное действие; сервер dedup;
//  - occurredAt — UTC время действия; сервер проверяет clock-skew окно;
//  - payload — строгий per-eventType whitelist (placement/position/query/key/value/
//    sort); НИКОГДА email/phone/URL/contact из DOM; search query — только
//    нормализованная (сервер также применяет privacy guard);
//  - keepalive + fire-and-forget: tracking никогда не блокирует навигацию/UI;
//  - preview/internal surface НЕ инструментируются этим контрактом.
// ─────────────────────────────────────────────────────────────────────────────

const MARKETPLACE_SESSION_KEY = "travelhub.mp.sessionId";

export type MarketplaceBehavioralEventType =
  | "MARKETPLACE_VIEWED"
  | "MARKETPLACE_PRODUCT_IMPRESSION"
  | "MARKETPLACE_PRODUCT_VIEWED"
  | "MARKETPLACE_SEARCH_PERFORMED"
  | "MARKETPLACE_CATEGORY_VIEWED"
  | "MARKETPLACE_FILTER_APPLIED"
  | "MARKETPLACE_SORT_CHANGED"
  | "MARKETPLACE_CTA_CLICKED";

export interface TrackMarketplaceEventInput {
  eventType: MarketplaceBehavioralEventType;
  path: string;
  productSlug?: string;
  categorySlug?: string;
  payload?: Record<string, unknown>;
}

/** Opaque anonymous Marketplace sessionId (8-64 chars, без PII). SSR-safe. */
export function getOrCreateMarketplaceSessionId(): string {
  if (typeof window === "undefined") return "ssr_noop_session";
  let sid = window.localStorage.getItem(MARKETPLACE_SESSION_KEY);
  if (!sid || !SESSION_RE.test(sid)) {
    sid = `mp_${crypto.randomUUID().replace(/-/g, "").slice(0, 32)}`;
    window.localStorage.setItem(MARKETPLACE_SESSION_KEY, sid);
  }
  return sid;
}

/** Отправка одного Marketplace behavioral event. Fire-and-forget, без Authorization. */
export function trackMarketplaceEvent(input: TrackMarketplaceEventInput): void {
  try {
    if (typeof window === "undefined") return;
    const body = {
      eventId: crypto.randomUUID(),
      eventType: input.eventType,
      occurredAt: new Date().toISOString(),
      sessionId: getOrCreateMarketplaceSessionId(),
      locale: window.localStorage.getItem("travelhub.locale") ?? "ru",
      path: input.path,
      productSlug: input.productSlug,
      categorySlug: input.categorySlug,
      payload: input.payload,
    };
    void fetch("/api/v1/public/marketplace/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      keepalive: true,
    }).catch(() => {
      /* tracking failure никогда не ломает UI/navigation */
    });
  } catch {
    /* noop */
  }
}

/** Хук Marketplace home: MARKETPLACE_VIEWED один раз за посещение. */
export function useMarketplaceViewed(enabled: boolean): void {
  useFireOnce("mp-viewed", enabled, () => trackMarketplaceEvent({ eventType: "MARKETPLACE_VIEWED", path: "/" }));
}

/** Хук Marketplace PDP: MARKETPLACE_PRODUCT_VIEWED один раз за открытие. */
export function useMarketplaceProductViewed(productSlug: string, enabled: boolean): void {
  const path = `/products/${productSlug}`;
  useFireOnce(`mp-pviewed:${productSlug}`, enabled, () =>
    trackMarketplaceEvent({ eventType: "MARKETPLACE_PRODUCT_VIEWED", path, productSlug }),
  );
}

/** Хук категории: MARKETPLACE_CATEGORY_VIEWED один раз за открытие. */
export function useMarketplaceCategoryViewed(categorySlug: string, enabled: boolean): void {
  const path = `/categories/${categorySlug}`;
  useFireOnce(`mp-cviewed:${categorySlug}`, enabled, () =>
    trackMarketplaceEvent({ eventType: "MARKETPLACE_CATEGORY_VIEWED", path, categorySlug }),
  );
}

/**
 * Импрессия карточки (rendered-card): одна на карточку за mount; StrictMode-safe.
 * position — 0-based индекс в отрисованном grid (детерминирован по порядку карточек).
 */
export function useMarketplaceCardImpression(productSlug: string, position: number, enabled: boolean): void {
  // Ключ fire-once — по productSlug (одна импрессия на карточку за mount);
  // position передаётся только как payload (0-based индекс в grid).
  useFireOnce(`mp-impression:${productSlug}`, enabled, () =>
    trackMarketplaceEvent({
      eventType: "MARKETPLACE_PRODUCT_IMPRESSION",
      path: typeof window !== "undefined" ? window.location.pathname : "/",
      productSlug,
      payload: { placement: "grid", position },
    }),
  );
}

/** Committed search (submit / URL-переход): НЕ каждый keystroke. */
export function fireMarketplaceSearch(query: string, categorySlug?: string): void {
  trackMarketplaceEvent({
    eventType: "MARKETPLACE_SEARCH_PERFORMED",
    path: "/search",
    categorySlug: categorySlug || undefined,
    payload: query.trim() ? { query: query.trim() } : undefined,
  });
}

/** Применение фильтра: whitelist key/value (без DOM-дампов). */
export function fireMarketplaceFilter(categorySlug: string, key: string, value: string): void {
  trackMarketplaceEvent({
    eventType: "MARKETPLACE_FILTER_APPLIED",
    path: `/categories/${categorySlug}`,
    categorySlug,
    payload: { key, value },
  });
}

/** Изменение сортировки: whitelist enum. */
export function fireMarketplaceSort(sort: string): void {
  trackMarketplaceEvent({
    eventType: "MARKETPLACE_SORT_CHANGED",
    path: typeof window !== "undefined" ? window.location.pathname : "/search",
    payload: { sort },
  });
}

/** Клик по CTA Marketplace PDP (намерение; НЕ Order/Booking/Payment). */
export function fireMarketplaceCta(productSlug: string): void {
  trackMarketplaceEvent({
    eventType: "MARKETPLACE_CTA_CLICKED",
    path: `/products/${productSlug}`,
    productSlug,
  });
}

