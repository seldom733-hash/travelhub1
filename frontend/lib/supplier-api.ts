/**
 * Supplier API client — public (anonymous) access to KOMPAS/Summertour search.
 *
 * Uses /api/v1/public/supplier/* endpoints (no auth required).
 * Mirrors backend SupplierSearchQuery and SupplierOffer contracts.
 */

// ── Types ────────────────────────────────────────────────────────────────

export interface SupplierSearchQuery {
  supplierCode: string;
  country?: string;
  departureCity?: string;
  destination?: string;
  departureDateFrom?: string;
  departureDateTo?: string;
  nightsFrom?: number;
  nightsTo?: number;
  adults?: number;
  children?: number;
  childAges?: number[];
  hotelExternalId?: string;
  hotel?: string;
  hotelStars?: number[];
  room?: string;
  meal?: string;
  priceMin?: number;
  priceMax?: number;
  transport?: string;
  tourIncValue?: string;
  tourIncName?: string;
  tourIncValues?: string[];
  page?: number;
}

export interface SupplierPriceSnapshot {
  amount: number;
  currency: string;
  fetchedAt: string;
  expiresAt: string;
  source: string;
}

export type SupplierAvailability = "AVAILABLE" | "NOT_AVAILABLE" | "UNKNOWN";

export interface SupplierOffer {
  supplierCode: string;
  externalOfferId: string;
  externalClaim?: string;
  tour?: string;
  hotel: string;
  hotelExternalId?: string;
  country?: string;
  destination?: string;
  departureDate: string;
  nights: number;
  room?: string;
  meal?: string;
  adults: number;
  children: number;
  childAges: number[];
  price: SupplierPriceSnapshot;
  availability: SupplierAvailability;
  transport?: string;
  fetchedAt: string;
  expiresAt: string;
  tourIncValue?: string;
  tourIncName?: string;
  rawMetadata?: Record<string, unknown>;
}

export interface SupplierPriceCalendarQuery {
  supplierCode: string;
  hotelExternalId?: string;
  hotel?: string;
  destination?: string;
  dateFrom: string;
  dateTo: string;
  nights?: number;
  nightsFrom?: number;
  nightsTo?: number;
  adults?: number;
  children?: number;
  childAges?: number[];
  tourIncValue?: string;
  tourIncName?: string;
  tourIncValues?: string[];
  tourIncNames?: string[];
  productId?: string;
  room?: string;
  meal?: string;
}

export interface SupplierPriceCalendarEntryOffer {
  tourIncValue: string;
  tourIncName?: string;
  externalOfferId: string;
  externalClaim?: string;
  hotel: string;
  hotelExternalId?: string;
  departureDate: string;
  nights: number;
  room?: string;
  meal?: string;
  adults: number;
  children: number;
  childAges: number[];
  availability: SupplierAvailability;
  price: number;
  currency: string;
  transport?: string;
  oneWay?: boolean;
  supplierCode?: string;
  destination?: string;
}

export interface SupplierPriceCalendarEntry {
  date: string;
  price: number | null;
  currency: string | null;
  availability: SupplierAvailability;
  offers: SupplierPriceCalendarEntryOffer[];
  absenceCode?: string;
  absenceText?: string;
}

export interface SupplierPriceCalendarResult {
  entries: SupplierPriceCalendarEntry[];
  dateFrom: string;
  dateTo: string;
  fetchedAt: string;
  expiresAt: string;
}

// ── CAPTCHA Human-in-the-Loop Types ──────────────────────────────────────

export interface KompasCaptchaPayload {
  type: "image";
  mimeType: string;
  data: string; // data:image/jpeg;base64,...
}

export interface KompasCaptchaRequiredResponse {
  status: "CAPTCHA_REQUIRED";
  challengeId: string;
  supplier: "KOMPAS" | "SUMMERTOUR";
  captcha: KompasCaptchaPayload;
}

export interface KompasCaptchaVerifySuccessResponse {
  status: "SUCCESS";
  challengeId: string;
  supplier: "KOMPAS" | "SUMMERTOUR";
  data: unknown; // PriceCalendarResult | SupplierOffer[] | SupplierPriceSnapshot depending on original operation
}

export interface KompasCaptchaVerifyErrorResponse {
  status: "INVALID_ANSWER" | "EXPIRED" | "SESSION_LOST" | "KOMPAS_ERROR" | "TIMEOUT" | "CANCELLED" | "CAPTCHA_REQUIRED";
  challengeId?: string;
  supplier?: "KOMPAS" | "SUMMERTOUR";
  captcha?: KompasCaptchaPayload;
}

export function isCaptchaRequired(data: unknown): data is KompasCaptchaRequiredResponse {
  return !!data && typeof data === "object" && (data as any).status === "CAPTCHA_REQUIRED" && typeof (data as any).challengeId === "string";
}

// ── API Client ───────────────────────────────────────────────────────────

const BASE = "/api/v1/public/supplier";

async function get<T>(path: string, params: Record<string, string | number | undefined>): Promise<T> {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") {
      searchParams.set(key, String(value));
    }
  }
  const url = `${BASE}${path}?${searchParams.toString()}`;
  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supplier API ${res.status}: ${text}`);
  }
  return res.json();
}

async function post<T>(path: string, body: unknown, signal?: AbortSignal): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok) {
    const text = await res.text();
    console.error(`[supplier-api] POST ${BASE}${path} FAILED ${res.status} body=${JSON.stringify(body).slice(0,800)} resp=${text.slice(0,1000)}`);
    throw new Error(`Supplier API ${res.status}: ${text}`);
  }
  return res.json();
}

async function postCaptcha<T>(path: string, body: unknown): Promise<T> {
  // Dedicated helper for kompas/captcha endpoints (base is /api/v1, not /api/v1/public/supplier)
  const url = `/api/v1${path}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Captcha API ${res.status}: ${text}`);
  }
  return res.json();
}

/** Search supplier offers (anonymous). */
export async function searchSupplierOffers(
  query: SupplierSearchQuery,
): Promise<SupplierOffer[]> {
  return get<SupplierOffer[]>("/search", {
    supplier: query.supplierCode,
    country: query.country,
    departureCity: query.departureCity,
    destination: query.destination,
    departureDateFrom: query.departureDateFrom,
    departureDateTo: query.departureDateTo,
    nightsFrom: query.nightsFrom,
    nightsTo: query.nightsTo,
    adults: query.adults,
    children: query.children,
    childAges: query.childAges?.join(","),
    hotelStars: query.hotelStars?.join(","),
    meal: query.meal,
    page: query.page,
    hotelExternalId: query.hotelExternalId,
    hotel: query.hotel,
    tourIncValue: query.tourIncValue,
    tourIncName: query.tourIncName,
  });
}

/** Get price calendar (anonymous) — may return CAPTCHA_REQUIRED. */
export async function getPriceCalendar(
  query: SupplierPriceCalendarQuery,
  signal?: AbortSignal,
): Promise<SupplierPriceCalendarResult | KompasCaptchaRequiredResponse> {
  return post<SupplierPriceCalendarResult | KompasCaptchaRequiredResponse>("/price-calendar", query, signal);
}

export async function verifyKompasCaptcha(
  challengeId: string,
  answer: string,
): Promise<KompasCaptchaVerifySuccessResponse | KompasCaptchaVerifyErrorResponse> {
  return postCaptcha<KompasCaptchaVerifySuccessResponse | KompasCaptchaVerifyErrorResponse>("/public/supplier/kompas/captcha/verify", {
    challengeId,
    answer,
  });
}

export async function refreshKompasCaptcha(
  challengeId: string,
): Promise<{ status: string; challengeId: string; supplier: string; captcha: KompasCaptchaPayload } | KompasCaptchaVerifyErrorResponse> {
  return postCaptcha("/public/supplier/kompas/captcha/refresh", { challengeId });
}

export async function cancelKompasCaptcha(challengeId: string): Promise<{ status: string }> {
  return postCaptcha("/public/supplier/kompas/captcha/cancel", { challengeId });
}

export async function verifySummertourCaptcha(
  challengeId: string,
  answer: string,
): Promise<KompasCaptchaVerifySuccessResponse | KompasCaptchaVerifyErrorResponse> {
  return postCaptcha<KompasCaptchaVerifySuccessResponse | KompasCaptchaVerifyErrorResponse>("/public/supplier/summertour/captcha/verify", {
    challengeId,
    answer,
  });
}

export async function refreshSummertourCaptcha(
  challengeId: string,
): Promise<{ status: string; challengeId: string; supplier: string; captcha: KompasCaptchaPayload } | KompasCaptchaVerifyErrorResponse> {
  return postCaptcha("/public/supplier/summertour/captcha/refresh", { challengeId });
}

export async function cancelSummertourCaptcha(challengeId: string): Promise<{ status: string }> {
  return postCaptcha("/public/supplier/summertour/captcha/cancel", { challengeId });
}

/** Refresh price for re-check (anonymous) — may return CAPTCHA_REQUIRED. */
export async function refreshSupplierPrice(
  supplierCode: string,
  offerId: string,
  claim: string | undefined,
  searchContext: SupplierSearchQuery,
): Promise<SupplierPriceSnapshot | KompasCaptchaRequiredResponse> {
  return post<SupplierPriceSnapshot | KompasCaptchaRequiredResponse>("/refresh-price", {
    supplierCode,
    offerId,
    claim,
    searchContext,
  });
}

/** Refresh availability for re-check (anonymous). */
export async function refreshSupplierAvailability(
  supplierCode: string,
  offerId: string,
  claim: string | undefined,
  searchContext: SupplierSearchQuery,
): Promise<{ availability: SupplierAvailability; fetchedAt: string; expiresAt: string } | KompasCaptchaRequiredResponse> {
  return post("/refresh-availability", {
    supplierCode,
    offerId,
    claim,
    searchContext,
  });
}

/** Create a tour request from verified offer (anonymous). */
export interface TourRequestInput {
  supplierCode: string;
  externalOfferId: string;
  hotel: string;
  hotelExternalId?: string;
  departureDate: string;
  nights: number;
  adults: number;
  children: number;
  childAges?: number[];
  room?: string;
  meal?: string;
  price: number;
  currency: string;
  destination?: string;
  departureCity?: string;
}

export interface TourRequestResult {
  id: string;
  code: string;
  referenceNumber: string;
  status: string;
  displayedPrice: number;
  displayedCurrency: string;
  createdAt: string;
}

export async function createTourRequest(
  input: TourRequestInput,
): Promise<TourRequestResult> {
  return post<TourRequestResult>("/create-request", input);
}
