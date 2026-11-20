import { api } from "@/lib/api";

export type HotelDirectoryType =
  | "categories"
  | "room-types"
  | "placement-types"
  | "meal-types";

export interface HotelDirectoryEntry {
  id: string;
  code: string;
  names: { ru: string; en: string; az: string };
  sortOrder: number;
  status: "ACTIVE" | "INACTIVE";
  createdAt: string;
  updatedAt: string;
}

const BASE = "/hotel-directory";

export const hotelDirectoryApi = {
  list: (type: HotelDirectoryType, status?: string) => {
    const qs = status ? `?status=${encodeURIComponent(status)}` : "";
    return api.get<HotelDirectoryEntry[]>(`${BASE}/${type}${qs}`);
  },
  get: (type: HotelDirectoryType, id: string) =>
    api.get<HotelDirectoryEntry>(`${BASE}/${type}/${id}`),
  create: (
    type: HotelDirectoryType,
    body: {
      code: string;
      names: { ru: string; en: string; az: string };
      sortOrder?: number;
      status?: string;
    },
  ) => api.post<HotelDirectoryEntry>(`${BASE}/${type}`, body),
  createHotel: (body: {
    name: string;
    countryName?: string;
    countryCode?: string;
    cityName?: string;
    resortName?: string;
    stars?: number | null;
    categoryLabel?: string | null;
  }) => api.post<{
    id: string;
    name: string;
    countryCode: string;
    countryName: string;
    cityName: string;
    resortName: string;
    stars: number | null;
    categoryLabel: string | null;
    suppliers: string[];
  }>(`${BASE}/hotels`, body),
  serviceTypes: () => api.get<Array<{ id: string; code: string; names: { ru: string; en: string; az: string }; sortOrder: number; status: string }>>(`${BASE}/service-types`),
  createServiceType: (body: { names: { ru: string; en: string; az: string }; sortOrder?: number; status?: string }) =>
    api.post<{ id: string; code: string; names: { ru: string; en: string; az: string }; sortOrder: number; status: string }>(`${BASE}/service-types`, body),
  airports: () => api.get<Array<{ id: string; code: string; name: string; countryCode: string; countryName: string; cityName: string; status: string }>>(`${BASE}/airports`),
  createAirport: (body: { code: string; name?: string; countryCode?: string; countryName?: string; cityName?: string }) =>
    api.post<{ id: string; code: string; name: string; countryCode: string; countryName: string; cityName: string; status: string }>(`${BASE}/airports`, body),
  update: (type: HotelDirectoryType, id: string, body: object) =>
    api.patch<HotelDirectoryEntry>(`${BASE}/${type}/${id}`, body),
  remove: (type: HotelDirectoryType, id: string) =>
    api.del<{ deleted: boolean }>(`${BASE}/${type}/${id}`),
  search: (q: string, type?: string) => {
    const sp = new URLSearchParams({ q });
    if (type) sp.set("type", type);
    return api.get<Record<HotelDirectoryType, HotelDirectoryEntry[]>>(
      `${BASE}/search?${sp.toString()}`,
    );
  },
};

export function hotelDirectoryDisplayName(
  names: { ru: string; en: string; az: string } | null | undefined,
  fallback = "",
): string {
  if (!names) return fallback;
  return names.ru || names.en || names.az || fallback;
}
