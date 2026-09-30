import type { GeoDirectoryEntry } from "@/lib/geo-api";

/**
 * TourSearch draft — the last state of every tour-search picker.
 *
 * The search form lives on the home page (HeroSearch) and in the collapsed
 * CompactSearch bar of the results page; it unmounts on every navigation
 * between them, which used to wipe the user's picks. The draft survives
 * remounts (module memory) and full reloads (sessionStorage) so returning to
 * the search form always shows what was searched last. «Сбросить все» clears
 * it.
 */
export interface TourSearchDraft {
  from: GeoDirectoryEntry | null;
  toCountry: GeoDirectoryEntry | null;
  toCity: GeoDirectoryEntry | null;
  toResort: GeoDirectoryEntry | null;
  startDate: string;
  endDate: string;
  nightsFrom: number;
  nightsTo: number;
  adults: number;
  children: number;
  childAges: number[];
  selectHotel: boolean;
  hotelId: string;
  hotelName: string;
  hotelStars: string[];
  selectedSuppliers: string[];
}

const KEY = "th.tourSearchDraft.v1";
// undefined = not read yet; null = no draft.
let mem: TourSearchDraft | null | undefined;

export function readTourDraft(): TourSearchDraft | null {
  if (mem !== undefined) return mem;
  try {
    const raw =
      typeof window !== "undefined" ? window.sessionStorage.getItem(KEY) : null;
    mem = raw ? (JSON.parse(raw) as TourSearchDraft) : null;
  } catch {
    mem = null;
  }
  return mem;
}

export function writeTourDraft(draft: TourSearchDraft): void {
  mem = draft;
  try {
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem(KEY, JSON.stringify(draft));
    }
  } catch {
    // storage unavailable (private mode/quota) — module memory still works
  }
}

export function clearTourDraft(): void {
  mem = null;
  try {
    if (typeof window !== "undefined") window.sessionStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
