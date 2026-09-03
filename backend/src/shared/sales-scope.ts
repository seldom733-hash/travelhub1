/**
 * D4 STRICT REVIEW REMEDIATION F2 — Platform Marketplace scope enforcement.
 *
 * Hard rule: client filter ⊆ server-authorized scope. Platform Marketplace
 * operational contract (Order Center / Booking Center, staff-роли) авторизует
 * НЕ-Storefront acquisition sources; `PARTNER_STOREFRONT` — tenant партнёра
 * (Partner Workspace, не реализован) и НЕ входит в platform scope.
 *
 * Явный `?acquisitionSource=PARTNER_STOREFRONT` на platform list/export
 * эндпоинте НЕ может заменить server-authorized scope (D4SR-F2 bypass):
 * запрос вне scope → deny. Поведение выбрано как «пустой результат» —
 * invisibility-семантика, согласованная с прямыми 404-ридами Storefront-
 * объектов (D4 §10/§21): Storefront-коммерция «не существует» для platform
 * marketplace-контракта. Orders list/export, Bookings list/export и
 * drill-down consumers согласованы.
 */
export const PARTNER_STOREFRONT_SOURCE = "PARTNER_STOREFRONT";
/** Дефолтный scope platform Marketplace-контракта при отсутствии фильтра. */
export const PLATFORM_DEFAULT_SCOPE_SOURCE = "MARKETPLACE";

/** Явный Storefront-фильтр на platform-контракте — попытка подмены scope. */
export function isDeniedStorefrontScope(requestedSource?: string | null): boolean {
  return requestedSource === PARTNER_STOREFRONT_SOURCE;
}
