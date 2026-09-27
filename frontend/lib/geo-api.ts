import { api } from "@/lib/api";

export interface GeoNames {
  ru: string;
  en: string;
  az: string;
}

export interface GeoCountry {
  id: string;
  code: string;
  names: GeoNames;
  status: "ACTIVE" | "INACTIVE";
  createdAt: string;
  updatedAt: string;
  cities?: GeoCity[];
}

export interface GeoCity {
  id: string;
  countryId: string;
  code: string;
  names: GeoNames;
  latitude: number | null;
  longitude: number | null;
  status: "ACTIVE" | "INACTIVE";
  resorts?: GeoResort[];
  airports?: GeoAirport[];
}

export interface GeoResort {
  id: string;
  cityId: string;
  code: string;
  names: GeoNames;
  latitude: number | null;
  longitude: number | null;
  status: "ACTIVE" | "INACTIVE";
}

export interface GeoAirport {
  id: string;
  cityId: string;
  code: string;
  names: GeoNames;
  latitude: number | null;
  longitude: number | null;
  timeZone: string | null;
  status: "ACTIVE" | "INACTIVE";
}

export type GeoEntity = GeoCountry | GeoCity | GeoResort | GeoAirport;

const BASE = "/geo";

export const geoApi = {
  countries: {
    list: (status?: string) =>
      api.get<GeoCountry[]>(`${BASE}/countries${status ? `?status=${status}` : ""}`),
    get: (id: string) => api.get<GeoCountry>(`${BASE}/countries/${id}`),
    create: (body: { code: string; names: GeoNames; status?: string }) =>
      api.post<GeoCountry>(`${BASE}/countries`, body),
    update: (id: string, body: Partial<{ names: GeoNames; status: string }>) =>
      api.patch<GeoCountry>(`${BASE}/countries/${id}`, body),
    remove: (id: string) => api.del<{ deleted: boolean }>(`${BASE}/countries/${id}`),
  },
  cities: {
    list: (countryId?: string, status?: string) => {
      const sp = new URLSearchParams();
      if (countryId) sp.set("countryId", countryId);
      if (status) sp.set("status", status);
      const qs = sp.toString();
      return api.get<GeoCity[]>(`${BASE}/cities${qs ? `?${qs}` : ""}`);
    },
    get: (id: string) => api.get<GeoCity>(`${BASE}/cities/${id}`),
    create: (body: {
      countryId: string;
      code: string;
      names: GeoNames;
      latitude?: number;
      longitude?: number;
      status?: string;
    }) => api.post<GeoCity>(`${BASE}/cities`, body),
    update: (id: string, body: object) => api.patch<GeoCity>(`${BASE}/cities/${id}`, body),
    remove: (id: string) => api.del<{ deleted: boolean }>(`${BASE}/cities/${id}`),
  },
  resorts: {
    list: (cityId?: string, status?: string, countryId?: string) => {
      const sp = new URLSearchParams();
      if (cityId) sp.set("cityId", cityId);
      if (status) sp.set("status", status);
      if (countryId) sp.set("countryId", countryId);
      const qs = sp.toString();
      return api.get<GeoResort[]>(`${BASE}/resorts${qs ? `?${qs}` : ""}`);
    },
    create: (body: {
      cityId: string;
      code: string;
      names: GeoNames;
      latitude?: number;
      longitude?: number;
      status?: string;
    }) => api.post<GeoResort>(`${BASE}/resorts`, body),
    update: (id: string, body: object) => api.patch<GeoResort>(`${BASE}/resorts/${id}`, body),
    remove: (id: string) => api.del<{ deleted: boolean }>(`${BASE}/resorts/${id}`),
  },
  airports: {
    list: (cityId?: string, status?: string) => {
      const sp = new URLSearchParams();
      if (cityId) sp.set("cityId", cityId);
      if (status) sp.set("status", status);
      const qs = sp.toString();
      return api.get<GeoAirport[]>(`${BASE}/airports${qs ? `?${qs}` : ""}`);
    },
    create: (body: {
      cityId: string;
      code: string;
      names: GeoNames;
      latitude?: number;
      longitude?: number;
      timeZone?: string;
      status?: string;
    }) => api.post<GeoAirport>(`${BASE}/airports`, body),
    update: (id: string, body: object) => api.patch<GeoAirport>(`${BASE}/airports/${id}`, body),
    remove: (id: string) => api.del<{ deleted: boolean }>(`${BASE}/airports/${id}`),
  },
  search: (q: string, type?: string) => {
    const sp = new URLSearchParams({ q });
    if (type) sp.set("type", type);
    return api.get<{
      countries: GeoCountry[];
      cities: GeoCity[];
      resorts: GeoResort[];
      airports: GeoAirport[];
    }>(`${BASE}/search?${sp.toString()}`);
  },
};

export function geoDisplayName(names: GeoNames | null | undefined, fallback = ""): string {
  if (!names) return fallback;
  return names.ru || names.en || names.az || fallback;
}

const PUBLIC_API_BASE =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ||
  "http://localhost:4000/api/v1";

export interface GeoDirectoryEntry {
  id: string;
  code: string;
  names: GeoNames;
  status: "ACTIVE" | "INACTIVE";
  countryId?: string;
  cityId?: string;
}

let directoryPromise: Record<string, Promise<GeoDirectoryEntry[]>> = {};

/**
 * Public master directory for storefront filters (no auth).
 * Cached per parameter set for the page lifetime.
 */
export function fetchGeoDirectory(
  type: "country" | "city" | "resort",
  countryId?: string,
  cityId?: string,
): Promise<GeoDirectoryEntry[]> {
  const key = `${type}:${countryId ?? ""}:${cityId ?? ""}`;
  if (!directoryPromise[key]) {
    const sp = new URLSearchParams();
    if (type !== "country") sp.set("type", type);
    if (countryId) sp.set("countryId", countryId);
    if (cityId) sp.set("cityId", cityId);
    const qs = sp.toString();
    directoryPromise[key] = (async () => {
      const res = await fetch(`${PUBLIC_API_BASE}/geo/directory${qs ? `?${qs}` : ""}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`Geo directory failed (${res.status})`);
      const json = await res.json();
      return Array.isArray(json) ? json : [];
    })();
    directoryPromise[key].catch(() => {
      delete directoryPromise[key];
    });
  }
  return directoryPromise[key];
}
