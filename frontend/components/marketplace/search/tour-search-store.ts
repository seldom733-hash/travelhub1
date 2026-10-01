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

const BASE_KEY = "th.tourSearchDraft.v1";
// Per-namespace drafts: separate mounts of the search form must not restore
// each other's picks. undefined = not read yet; null = no draft.
const mem = new Map<string, TourSearchDraft | null | undefined>();

const storageKey = (ns: string) => (ns ? `${BASE_KEY}.${ns}` : BASE_KEY);

export function readTourDraft(ns = ""): TourSearchDraft | null {
  const cached = mem.get(ns);
  if (cached !== undefined) return cached;
  let value: TourSearchDraft | null = null;
  try {
    const raw =
      typeof window !== "undefined"
        ? window.sessionStorage.getItem(storageKey(ns))
        : null;
    value = raw ? (JSON.parse(raw) as TourSearchDraft) : null;
  } catch {
    value = null;
  }
  mem.set(ns, value);
  return value;
}

export function writeTourDraft(draft: TourSearchDraft, ns = ""): void {
  mem.set(ns, draft);
  try {
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem(storageKey(ns), JSON.stringify(draft));
    }
  } catch {
    // storage unavailable (private mode/quota) — module memory still works
  }
}

export function clearTourDraft(ns = ""): void {
  mem.set(ns, null);
  try {
    if (typeof window !== "undefined") window.sessionStorage.removeItem(storageKey(ns));
  } catch {
    // ignore
  }
}
