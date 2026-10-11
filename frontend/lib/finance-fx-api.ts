"use client";

/**
 * UNIFIED FINANCE CENTER Phase 1 — SupplierFxRate frontend клиент.
 *
 * Контракт GET/POST /api/v1/finance/supplier-fx-rates (finance.fx_rate.read /
 * finance.fx_rate.manage). «1 <sourceCurrency> = rate AZN» по паре
 * (supplierCode, sourceCurrency). AZN→AZN всегда 1 (строка не хранится).
 * Изменение курса влияет только на будущее — frozen snapshot'ы не мутируют.
 *
 * Server-owned поля (id/code/targetCurrencyIso/updatedBy-поля/timestamps) клиент
 * НИКОГДА не отправляет — только белый список SetSupplierFxRateInput.
 */

import { api, type Page } from "./api";

/** Management currency: V1 API фиксирует AZN. */
export const FX_TARGET_CURRENCY = "AZN";

/** Текущий курс supplier × sourceCurrency (GET list item). */
export interface SupplierFxRate {
  id: string;
  code: string;
  supplierCode: string;
  /** CRM Partner.code (PAR-*) — резолвится из CRM по data-driven связи; null если не привязан. */
  partnerCode: string | null;
  /** CRM Partner.name — для отображения; null если не привязан. */
  partnerName: string | null;
  sourceCurrencyIso: string;
  targetCurrencyIso: string;
  /** «1 source = rate AZN» (строковый Decimal, canonical toString). */
  rate: string;
  createdAt: string;
  updatedAt: string;
  updatedById: string | null;
  updatedByName: string | null;
}

/** Append-only запись истории курса (GET history item). */
export interface SupplierFxRateHistoryItem {
  id: string;
  rateId: string;
  action: "CREATE" | "UPDATE";
  /** null только у CREATE (предыдущего значения не было). */
  oldRate: string | null;
  newRate: string;
  changedAt: string;
  actorId: string | null;
  actorName: string | null;
}

/** Write-body: только белый список (server-owned поля запрещены 422). */
export interface SetSupplierFxRateInput {
  supplierCode: string;
  sourceCurrencyIso: string;
  /** «1 source = rate AZN», > 0, ≤ 6 decimals. */
  rate: string;
}

/** Элемент реестра поставщиков для FX-админки (GET suppliers). */
export interface FxSupplier {
  supplierCode: string;
  partnerCode: string | null;
  partnerName: string | null;
}

const BASE = "/finance/supplier-fx-rates";

export const financeFxApi = {
  list: (filter?: { supplierCode?: string; sourceCurrencyIso?: string }): Promise<SupplierFxRate[]> => {
    const qs = new URLSearchParams();
    if (filter?.supplierCode) qs.set("supplierCode", filter.supplierCode);
    if (filter?.sourceCurrencyIso) qs.set("sourceCurrencyIso", filter.sourceCurrencyIso);
    const q = qs.toString();
    return api.get<SupplierFxRate[]>(`${BASE}${q ? `?${q}` : ""}`);
  },

  get: (code: string): Promise<SupplierFxRate> => api.get<SupplierFxRate>(`${BASE}/${encodeURIComponent(code)}`),

  set: (input: SetSupplierFxRateInput): Promise<SupplierFxRate> => api.post<SupplierFxRate>(BASE, input),

  /** Реестр поставщиков (∪ настроенные), НЕ из строк — дропдаун не пустеет. */
  suppliers: (): Promise<FxSupplier[]> => api.get<FxSupplier[]>(`${BASE}/suppliers`),

  history: (filter?: {
    code?: string;
    supplierCode?: string;
    sourceCurrencyIso?: string;
    page?: number;
    pageSize?: number;
  }): Promise<Page<SupplierFxRateHistoryItem>> => {
    const qs = new URLSearchParams();
    if (filter?.code) qs.set("code", filter.code);
    if (filter?.supplierCode) qs.set("supplierCode", filter.supplierCode);
    if (filter?.sourceCurrencyIso) qs.set("sourceCurrencyIso", filter.sourceCurrencyIso);
    if (filter?.page) qs.set("page", String(filter.page));
    if (filter?.pageSize) qs.set("pageSize", String(filter.pageSize));
    const q = qs.toString();
    return api.get<Page<SupplierFxRateHistoryItem>>(`${BASE}/history${q ? `?${q}` : ""}`);
  },
};

/** > 0, ≤ 6 decimals (зеркалит backend validateRate; клиентская подсказка). */
export const FX_RATE_RE = /^\d+(\.\d{1,6})?$/;

export const isValidFxRate = (rate: string): boolean => {
  const r = rate.trim();
  if (!FX_RATE_RE.test(r)) return false;
  const n = Number(r);
  return Number.isFinite(n) && n > 0;
};
