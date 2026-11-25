import { api } from "./api";

/** Очередь ручной проверки дубликатов отелей (catalog.hotel-matching). */
export interface HotelMatchSide {
  id: string;
  name: string;
  countryCode: string;
  cityName: string;
  stars: number | null;
  photoFile: string | null;
  refCount: number;
  suppliers: string[];
}

export interface HotelMatchCandidate {
  hotelA: HotelMatchSide;
  hotelB: HotelMatchSide;
  similarity: number;
  reason: string;
}

export interface HotelMatchCandidatePage {
  items: HotelMatchCandidate[];
  total: number;
  limit: number;
  offset: number;
}

export interface HotelSupplierRefRow {
  id: string;
  supplierCode: string;
  externalKey: string;
  name: string;
  countryCode: string;
  cityName: string;
  stars: number | null;
  source: string;
  firstSeenAt: string;
  lastSeenAt: string;
}

export interface HotelMutationResult {
  ok: boolean;
  message: string;
  hotelId?: string;
}

const BASE = "/catalog/hotel-matching";

export const hotelMatchingApi = {
  candidates: (limit: number, offset: number) =>
    api.get<HotelMatchCandidatePage>(`${BASE}/candidates?limit=${limit}&offset=${offset}`),
  refs: (hotelId: string) =>
    api.get<{ hotelId: string; refs: HotelSupplierRefRow[] }>(`${BASE}/hotels/${encodeURIComponent(hotelId)}/refs`),
  merge: (canonicalId: string, duplicateId: string) =>
    api.post<HotelMutationResult>(`${BASE}/merge`, { canonicalId, duplicateId }),
  split: (refId: string) => api.post<HotelMutationResult>(`${BASE}/split`, { refId }),
};
