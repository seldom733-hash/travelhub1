import type { GeoDirectoryEntry } from "@/lib/geo-api";

/**
 * HotelSearch draft — the last state of every hotel-search picker.
 *
 * Same contract as the tour draft (tour-search-store): the hotels form
 * unmounts between the home page (HeroSearch) and the results page
 * (CompactSearch), which used to wipe the user's picks on every navigation.
 * The draft survives remounts (module memory) and full reloads
 * (sessionStorage) so returning to the form always shows what was searched
 * last. «Сбросить все» clears it.
 */
export interface HotelSearchDraft {
  toCountry: GeoDirectoryEntry | null;
  toCity: GeoDirectoryEntry | null;
  toResort: GeoDirectoryEntry | null;
  hotelId: string;
  hotelName: string;
  checkIn: string;
  nightsFrom: number;
  nightsTo: number;
  adults: number;
  children: number;
  childAges: number[];
  /** Выбранные поставщики (коды адаптеров); пусто = все поставщики отеля. */
  selectedSuppliers: string[];
}

const BASE_KEY = "th.hotelSearchDraft.v1";
// Per-namespace drafts: separate mounts of the search form must not restore
// each other's picks. undefined = not read yet; null = no draft.
const mem = new Map<string, HotelSearchDraft | null | undefined>();

const storageKey = (ns: string) => (ns ? `${BASE_KEY}.${ns}` : BASE_KEY);

export function readHotelDraft(ns = ""): HotelSearchDraft | null {
  const cached = mem.get(ns);
  if (cached !== undefined) return cached;
  let value: HotelSearchDraft | null = null;
  try {
    const raw =
      typeof window !== "undefined"
        ? window.sessionStorage.getItem(storageKey(ns))
        : null;
    value = raw ? (JSON.parse(raw) as HotelSearchDraft) : null;
  } catch {
    value = null;
  }
  mem.set(ns, value);
  return value;
}

export function writeHotelDraft(draft: HotelSearchDraft, ns = ""): void {
  mem.set(ns, draft);
  try {
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem(storageKey(ns), JSON.stringify(draft));
    }
  } catch {
    // storage unavailable (private mode/quota) — module memory still works
  }
}

export function clearHotelDraft(ns = ""): void {
  mem.set(ns, null);
  try {
    if (typeof window !== "undefined") window.sessionStorage.removeItem(storageKey(ns));
  } catch {
    // ignore
  }
}
