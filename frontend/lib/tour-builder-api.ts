import { api } from "@/lib/api";

/**
 * Partner Tour Builder API client (конструктор пакетных туров).
 * Backend: /api/v1/tour-builder/products/:productId/...
 * Разбивка/UI-логика — в компонентах конструктора; здесь только транспорт.
 */

export type ComponentKind = "accommodation" | "flight" | "transfer" | "insurance" | "extra";

export interface ComponentPayload {
  // accommodation
  mealSupplements?: Record<string, number>;
  childRules?: { freeChildren?: number; extraBedChild2_11?: number; child12?: number; extraAdult?: number };
  earlyBookingDiscountPct?: number;
  // flight
  fareLadder?: Array<{ upToSeat: number; price: number }>;
  taxesPerPax?: number;
  defaultFare?: number | null;
  departures?: Array<{ date: string; capacity: number; sold?: number; priceOverride?: number | null }>;
  childPct?: number;
  infantPct?: number;
  // transfer
  vehicleType?: string;
  unit?: "per_pax" | "per_vehicle";
  capacity?: number | null;
  surcharges?: Array<{ dateFrom: string; dateTo: string; pct: number; label?: string }>;
  // insurance
  coverage?: string | null;
  durationBrackets?: Array<{ bracket: string; pricePerAdult: number }>;
  childCoefficient?: number;
  [k: string]: unknown;
}

export interface ComponentTariff {
  id: string;
  code: string;
  name: string;
  price: number | null;
  currency: string;
  priceBasis: string | null;
  /** Фасеты варианта (Tariff.inclusions): mealCode/placementCode/viewCode. */
  inclusions: Record<string, unknown> | null;
  periods: Array<{
    id: string;
    code: string;
    kind: "PERIOD" | "DATE_OVERRIDE";
    startDate: string;
    endDate: string;
    dayOfWeek: number[];
    price: number | null;
    sellable: boolean;
  }>;
  availability: Array<{ date: string; slotsTotal: number; slotsBooked: number; slotsReserved: number }>;
}

export interface BuilderComponent {
  componentId: string;
  unitCode: string;
  name: string;
  kind: ComponentKind;
  required: boolean;
  payload: ComponentPayload;
  tariffs: ComponentTariff[];
}

export interface BuilderState {
  product: { id: string; code: string; title: string; description: string | null; status: string };
  package: {
    components: BuilderComponent[];
    packageDiscountPct: number | null;
    freeTransferFromNights: number | null;
    grossOverride: { amount: number; currency: string } | null;
    /** Фикс-цена Ext.Bed/Ext.Sofa, в валюте пакета/сут (null/0 = бесплатно). */
    extraBedPrice: number | null;
    extraSofaPrice: number | null;
    /** Детская кровать (Baby Cot) — бесплатно, возможность предоставить; не ось матрицы. */
    babyCot: boolean;
    /** Валюта всех цен пакета (USD/EUR/AZN). */
    currency: string;
    /** Курсы партнёра: сколько AZN за 1 USD / 1 EUR (для конвертации при смене валюты). */
    fx: { usdAzn: number; eurAzn: number };
  };
}

/** Выбранный вариант (комната) в quote-листе + альтернативы (другие варианты). */
export interface QuoteVariant {
  variantId: string;
  name: string;
  placementCode: string | null;
  mealCode: string | null;
  viewCode: string | null;
  extraBed: boolean;
  extraSofa: boolean;
  capacity: number;
  rooms: number;
  amount?: number;
  formulas?: string[];
}

export interface QuoteLine {
  kind: ComponentKind;
  name: string;
  amount: number;
  required: boolean;
  formulas: string[];
  /** Только accommodation: выбранный (дешёвый) вариант. */
  variant?: QuoteVariant;
  /** Только accommodation: остальные варианты (по возрастанию цены). */
  alternatives?: QuoteVariant[];
}

export interface BuilderQuote {
  input: { departureDate: string; nights: number; adults: number; children: number[] };
  /** Валюта расчёта (валюта пакета). */
  currency: string;
  lines: QuoteLine[];
  availability: {
    perComponent: Array<{ componentId: string; name: string; available: number | null }>;
    bottleneck: { componentId: string; name: string; available: number | null } | null;
  };
  totals: {
    net: number;
    packageDiscountPct: number;
    packageDiscount: number;
    partnerNet: number;
    commissionPct: number;
    commission: number;
    grossCalculated: number;
    grossOverride: number | null;
    gross: number;
  };
  warnings: string[];
}

/* ── Справочники (квартиры/виды/питание/размещение) ──────────────────────── */

export type DictionaryType = "room-types" | "view-types" | "meal-types" | "placement-types";

export interface DictionaryEntry {
  id: string;
  code: string;
  names: Record<string, string>;
  sortOrder?: number;
  syn?: string[];
  status?: "ACTIVE" | "PENDING" | "MERGED" | "REJECTED";
  source?: "SEED" | "MODERATION" | "PARTNER" | "IMPORT";
}

export interface DictionariesResponse {
  roomTypes: DictionaryEntry[];
  viewTypes: DictionaryEntry[];
  mealTypes: DictionaryEntry[];
  placementTypes: DictionaryEntry[];
  /** PENDING-типы номеров (модерация очереди) — для бейджей «на модерации». */
  pendingRoomTypes: DictionaryEntry[];
}

export interface SimilarResponse {
  type: string;
  query: string;
  /** score 1 = точное совпадение (normalize), 0.92 = токен-совпадение. */
  candidates: Array<{ id: string; code: string; names: Record<string, string>; score: number }>;
}

export const tourBuilderApi = {
  getState: (productId: string): Promise<BuilderState> =>
    api.get(`/tour-builder/products/${encodeURIComponent(productId)}`),
  addComponent: (
    productId: string,
    body: { kind: ComponentKind; name: string; required?: boolean; basePrice?: number; componentPayload?: ComponentPayload },
  ): Promise<{ unitId: string; unitCode: string; tariffId: string | null }> =>
    api.post(`/tour-builder/products/${encodeURIComponent(productId)}/components`, body),

  updateComponentPayload: (productId: string, componentId: string, payload: ComponentPayload): Promise<unknown> =>
    api.patch(`/tour-builder/products/${encodeURIComponent(productId)}/components/${encodeURIComponent(componentId)}/payload`, { payload }),

  setRequired: (productId: string, componentId: string, required: boolean): Promise<unknown> =>
    api.patch(`/tour-builder/products/${encodeURIComponent(productId)}/components/${encodeURIComponent(componentId)}/required`, { required }),

  removeComponent: (productId: string, componentId: string): Promise<unknown> =>
    api.del(`/tour-builder/products/${encodeURIComponent(productId)}/components/${encodeURIComponent(componentId)}`),

  /**
   * Тело = слои календаря: kind PERIOD|DATE_OVERRIDE, dayOfWeek 0..6 (пусто у DATE_OVERRIDE).
   * `periods` — полный набор (replace). Пустой массив без `clearPeriods` — no-op
   * (сохранение квоты не стирает цены); явное стирание всех слоёв — clearPeriods: true.
   */
  saveAccommodationCalendar: (
    productId: string,
    componentId: string,
    body: {
      tariffId: string;
      periods: Array<{
        startDate: string;
        endDate: string;
        price: number;
        kind?: "PERIOD" | "DATE_OVERRIDE";
        dayOfWeek?: number[];
      }>;
      clearPeriods?: boolean;
      allotment: Array<{ date: string; rooms: number }>;
    },
  ): Promise<unknown> =>
    api.post(`/tour-builder/products/${encodeURIComponent(productId)}/components/${encodeURIComponent(componentId)}/calendar`, body),

  /* ── Справочники и варианты ─────────────────────────────────────────────── */

  getDictionaries: (): Promise<DictionariesResponse> =>
    api.get(`/tour-builder/dictionaries`),

  getSimilarDictionaryEntries: (type: DictionaryType, q: string): Promise<SimilarResponse> => {
    const qs = new URLSearchParams({ type, q });
    return api.get(`/tour-builder/dictionaries/similar?${qs.toString()}`);
  },

  proposeDictionaryEntry: (body: { type: DictionaryType; name: string; lang?: "ru" | "en" | "az" }): Promise<DictionaryEntry> =>
    api.post(`/tour-builder/dictionaries/entries`, body),

  createVariant: (
    productId: string,
    componentId: string,
    body: { name?: string; viewCode?: string | null; mealCode?: string; placementCode?: string; extraBed?: boolean; extraSofa?: boolean; basePrice?: number },
  ): Promise<unknown> =>
    api.post(`/tour-builder/products/${encodeURIComponent(productId)}/components/${encodeURIComponent(componentId)}/variants`, body),

  updateVariant: (
    productId: string,
    componentId: string,
    variantId: string,
    body: { name?: string; viewCode?: string | null; mealCode?: string; placementCode?: string; extraBed?: boolean; extraSofa?: boolean; basePrice?: number },
  ): Promise<unknown> =>
    api.patch(
      `/tour-builder/products/${encodeURIComponent(productId)}/components/${encodeURIComponent(componentId)}/variants/${encodeURIComponent(variantId)}`,
      body,
    ),

  removeVariant: (productId: string, componentId: string, variantId: string): Promise<unknown> =>
    api.del(
      `/tour-builder/products/${encodeURIComponent(productId)}/components/${encodeURIComponent(componentId)}/variants/${encodeURIComponent(variantId)}`,
    ),

  setPackageRules: (
    productId: string,
    body: {
      packageDiscountPct?: number | null;
      freeTransferFromNights?: number | null;
      grossOverrideAmount?: number | null;
      /** Фикс-цена Ext.Bed/Ext.Sofa (в валюте пакета/сут, 0 = бесплатно); undefined = не менять. */
      extraBedPrice?: number | null;
      extraSofaPrice?: number | null;
      /** Baby Cot (бесплатно); undefined = не менять. */
      babyCot?: boolean;
      /** Валюта пакета; смена конвертирует все цены по fx. */
      currency?: "USD" | "EUR" | "AZN";
      /** Курс AZN за 1 USD (>0); undefined = не менять. */
      fxUsdAzn?: number;
      /** Курс AZN за 1 EUR (>0); undefined = не менять. */
      fxEurAzn?: number;
    },
  ): Promise<unknown> =>
    api.patch(`/tour-builder/products/${encodeURIComponent(productId)}/package-rules`, body),

  quote: (
    productId: string,
    body: { departureDate: string; nights: number; adults: number; children?: Array<{ age: number }> },
  ): Promise<BuilderQuote> =>
    api.post(`/tour-builder/products/${encodeURIComponent(productId)}/quote`, body),
};
