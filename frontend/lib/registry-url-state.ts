/**
 * UI-C1.2F.1C — Shared URL state helpers for Operations Center registries.
 *
 * Canonical contracts:
 *
 * SORTING:
 *   URL params: sortBy=<field>&sortOrder=asc|desc
 *   Server: buildSortClause with allowlist (backend/src/shared/sort.ts)
 *   Behavior: page=1 on sort change, period preserved
 *
 * FILTERING (table-only):
 *   URL params: status=<value>, paymentStatus=<value>, etc.
 *   Server: server-side filtering, KPI overview stays static
 *   Behavior: page=1 on filter change, period preserved
 *
 * RESET:
 *   Clears: search, all table-only filters, sort, page → 1
 *   Preserves: dateFrom, dateTo (Header Period)
 *
 * TAB SWITCH:
 *   Keeps: dateFrom, dateTo
 *   Resets: search, all table-only filters, sort, page, selected KPI
 */

import { useCallback } from "react";

/** Canonical sort URL params */
export const SORT_PARAM_KEYS = {
  sortBy: "sortBy",
  sortOrder: "sortOrder", // "asc" | "desc" — canonical name
} as const;

/**
 * Read current sort state from URL search params.
 */
export function readSortFromUrl(sp: URLSearchParams): {
  sortBy: string;
  sortOrder: "asc" | "desc";
} | null {
  const sortBy = sp.get(SORT_PARAM_KEYS.sortBy);
  if (!sortBy) return null;
  const sortOrder = sp.get(SORT_PARAM_KEYS.sortOrder) === "asc" ? "asc" : "desc";
  return { sortBy, sortOrder };
}

/**
 * Write sort state to URL via replaceState.
 * If clearing sort, removes sort params entirely.
 */
export function writeSortToUrl(
  field: string | null,
  direction: "asc" | "desc" | null,
): void {
  const sp = new URLSearchParams(window.location.search);
  if (field && direction) {
    sp.set(SORT_PARAM_KEYS.sortBy, field);
    sp.set(SORT_PARAM_KEYS.sortOrder, direction);
  } else {
    sp.delete(SORT_PARAM_KEYS.sortBy);
    sp.delete(SORT_PARAM_KEYS.sortOrder);
  }
  sp.delete("page"); // sort change resets pagination
  const qs = sp.toString();
  window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
}

/**
 * Registry-specific table-only filter params.
 * Each registry defines its own mapping of filter keys to URL params.
 */
export interface FilterParamMapping {
  /** Local state key → URL param name */
  [localKey: string]: string;
}

/**
 * Read table-only filter values from URL.
 */
export function readFiltersFromUrl(
  sp: URLSearchParams,
  mapping: FilterParamMapping,
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [localKey, urlParam] of Object.entries(mapping)) {
    result[localKey] = sp.get(urlParam) ?? "";
  }
  return result;
}

/**
 * Write a single table-only filter to URL.
 * Clears page=1. Preserves period and other unrelated filters.
 */
export function writeFilterToUrl(
  urlParam: string,
  value: string | null,
): void {
  const sp = new URLSearchParams(window.location.search);
  if (value) {
    sp.set(urlParam, value);
  } else {
    sp.delete(urlParam);
  }
  sp.delete("page"); // filter change resets pagination
  const qs = sp.toString();
  window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
}

/**
 * Reset all registry-specific state while preserving Header Period.
 * Clears: search, all table-only filters, sort, page.
 * Preserves: dateFrom, dateTo.
 */
export function resetRegistryState(
  filterKeys: string[],
): void {
  const sp = new URLSearchParams(window.location.search);
  // Clear registry-specific filters
  for (const key of filterKeys) {
    sp.delete(key);
  }
  // Clear sort
  sp.delete(SORT_PARAM_KEYS.sortBy);
  sp.delete(SORT_PARAM_KEYS.sortOrder);
  // Clear search
  sp.delete("search");
  // Reset page
  sp.delete("page");
  const qs = sp.toString();
  window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
}

/**
 * Tab switch: keep only Header Period, reset everything else.
 */
export function tabSwitchReset(): void {
  const sp = new URLSearchParams(window.location.search);
  const dateFrom = sp.get("dateFrom");
  const dateTo = sp.get("dateTo");
  sp.forEach((_, key) => sp.delete(key));
  if (dateFrom) sp.set("dateFrom", dateFrom);
  if (dateTo) sp.set("dateTo", dateTo);
  const qs = sp.toString();
  window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
}

/**
 * Preset filter param mappings for each registry.
 * These define which URL params correspond to which table-only filter dimensions.
 */
export const REGISTRY_FILTER_MAPPINGS: Record<string, FilterParamMapping> = {
  requests: {
    statusFilter: "status",
  },
  orders: {
    statusFilter: "status",
    paymentStatusFilter: "paymentStatus",
  },
  bookings: {
    statusFilter: "status",
  },
  payments: {
    paymentStatusFilter: "paymentStatus",
    refundStatusFilter: "refundStatus",
    currencyCardFilter: "currencyCard",
  },
};
