import { Injectable } from "@nestjs/common";

/**
 * ANEX Provider Layer — the shared technical connection to webapi.anextour.az
 * (HTTP client, dictionary cache, STATE resolution). Category adapters
 * (AnexAdapter = tours, AnexHotelAdapter = hotels) consume this provider and
 * contain only category-specific request building and normalization — they
 * never talk to the upstream directly (prompt §2/§3: Provider = technical
 * connection, Adapter = category transformation).
 *
 * Verified live (2026-09): plain HTTPS GET, no browser session, no captcha,
 * no cookies.
 */

/** ANEX STATEINC → ISO-2 (from /samo/searchtour/States live capture). */
export const ANEX_STATEINC_TO_ISO: Record<string, string> = {
  "3": "TR", "11": "EG", "34": "AE", "134": "TH", "137": "LK", "46": "AT",
  "98": "GE", "118": "IN", "114": "ID", "92": "ES", "21": "IT", "10": "KZ",
  "73": "CN", "152": "MU", "155": "MY", "176": "MV", "85": "SC", "91": "SG",
  "7": "UZ", "32": "FR", "64": "QA",
};

export const ANEX_BASE_URL = process.env.ANEX_BASE_URL || "https://webapi.anextour.az";
export const ANEX_SITE_URL = "https://anextour.az";
/** Baku — the only departure town the AZ market serves (verified). */
export const ANEX_TOWNFROMINC = "2149";
/** Hotels SPA constants (HOTELS_TOWN_FROM_INC / HOTELS_STATE_FROM_INC). */
export const HOTEL_TOWNFROM = "1";
export const HOTEL_STATEFROM = "16";
/** CURRENCY=26 → AZN (envCurrencyAznInc on the supplier site). */
export const ANEX_CURRENCY_INC = "26";
export const ANEX_SEARCH_MODE = "b2c";
/** 500 rows per PRICE_PAGE page (verified), cap pages to bound latency. */
export const ANEX_PAGE_SIZE = 500;
export const ANEX_MAX_PAGES = 5;
const ANEX_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const DICT_TTL_MS = 30 * 60 * 1000;
const STATES_TTL_MS = 24 * 60 * 60 * 1000;

export interface AnexState {
  id: number;
  name: string;
  nameAlt: string;
  stateISO: string;
}

export interface AnexTown {
  id: number;
  name: string;
  nameAlt?: string;
  region?: string;
  regionKey?: number;
}

export interface AnexStar {
  id: number;
  name: string;
}

export interface AnexHotel {
  id: number;
  name: string;
  starKey?: number;
  star?: string;
  townKey?: number | string;
}

// ── Shared pure helpers (used by both category adapters) ────────────────

export function normName(s: string): string {
  return s.toLowerCase().replace(/ё/g, "е").replace(/[^a-zа-я0-9]/gi, "");
}

export function toCompactDate(iso: string): string {
  return iso.replace(/-/g, "").slice(0, 8);
}

export function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function addDays(iso: string, days: number): string {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return toIsoDate(d);
}

/**
 * ANEX Provider: single HTTP client + dictionary cache shared by every
 * category adapter of the ANEX provider (prompt §3: reuse auth/headers/
 * timeout/error-handling; dictionary caches are shared across categories —
 * tour and hotel searches hit the same States/Towns/Stars dictionaries).
 */
@Injectable()
export class AnexProvider {
  private readonly cache = new Map<string, { at: number; value: unknown }>();

  async fetchJson<T>(path: string, params: Record<string, string | number | undefined>): Promise<T> {
    const qs = Object.entries(params)
      .filter(([, v]) => v !== undefined && v !== null)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
      .join("&");
    const url = `${ANEX_BASE_URL}${path}?${qs}`;
    const res = await fetch(url, {
      headers: {
        "User-Agent": ANEX_USER_AGENT,
        Accept: "application/json, text/plain, */*",
        "Accept-Language": "ru-RU,ru;q=0.9,en;q=0.7",
        Referer: `${ANEX_SITE_URL}/`,
      },
      signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok) {
      throw new Error(`ANEX HTTP ${res.status} for ${path}`);
    }
    const text = await res.text();
    try {
      return JSON.parse(text) as T;
    } catch {
      throw new Error(`ANEX non-JSON response for ${path}: ${text.slice(0, 120)}`);
    }
  }

  async cached<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
    const hit = this.cache.get(key);
    if (hit && Date.now() - hit.at < ttlMs) return hit.value as T;
    const value = await load();
    this.cache.set(key, { at: Date.now(), value });
    return value;
  }

  // ── Dictionaries (shared by tours and hotels categories) ──────────────

  states(): Promise<AnexState[]> {
    return this.cached("states", STATES_TTL_MS, () =>
      this.fetchJson<AnexState[]>("/samo/searchtour/States", { TOWNFROMINC: ANEX_TOWNFROMINC }),
    );
  }

  /**
   * Hotels country dictionary — SEPARATE from the tour one (verified live):
   * /samo/searchtour/States serves 21 countries (no AZ, and every
   * /samo/searchtour/{Stars,Towns,Hotels}?STATEINC=16 answers HTTP 500),
   * while /samo/searchhotel/States serves 52 (AZ=16, CH, KE, RU, GR, CY…)
   * with the same stateISO field. Both dictionaries are shaped identically.
   */
  hotelStates(): Promise<AnexState[]> {
    return this.cached("hotelStates", STATES_TTL_MS, () =>
      this.fetchJson<AnexState[]>("/samo/searchhotel/States", {
        LANG: "ru",
        topCount: "5",
        TOWNFROMINC: HOTEL_TOWNFROM,
        STATEFROM: HOTEL_STATEFROM,
      }),
    );
  }

  towns(stateInc: string): Promise<AnexTown[]> {
    return this.cached(`towns:${stateInc}`, DICT_TTL_MS, () =>
      this.fetchJson<AnexTown[]>("/samo/searchtour/Towns", {
        STATEINC: stateInc,
        TOWNFROMINC: ANEX_TOWNFROMINC,
        LANG: "ru",
      }),
    );
  }

  stars(stateInc: string): Promise<AnexStar[]> {
    return this.cached(`stars:${stateInc}`, DICT_TTL_MS, () =>
      this.fetchJson<AnexStar[]>("/samo/searchtour/Stars", {
        STATEINC: stateInc,
        TOWNFROMINC: ANEX_TOWNFROMINC,
        LANG: "ru",
      }),
    );
  }

  /**
   * Hotels star dictionary (/samo/searchhotel/Stars?STATEFROM=16&STATEINC=…):
   * the tour Stars dictionary answers HTTP 500 for hotel-only countries
   * (AZ) and — even where it answers — carries different group ids than the
   * hotels rows' groupStarInc. Verified: TR → 8 groups (2..5*, -), AZ → 3.
   */
  hotelStars(stateInc: string): Promise<AnexStar[]> {
    return this.cached(`hotelStars:${stateInc}`, DICT_TTL_MS, () =>
      this.fetchJson<AnexStar[]>("/samo/searchhotel/Stars", {
        LANG: "ru",
        topCount: "5",
        TOWNFROMINC: HOTEL_TOWNFROM,
        STATEFROM: HOTEL_STATEFROM,
        STATEINC: stateInc,
      }),
    );
  }

  /**
   * Hotels town dictionary (/samo/searchhotel/Towns?STATEFROM=16&STATEINC=…)
   * — same reason as hotelStars: /samo/searchtour/Towns is tour-scoped.
   */
  hotelTowns(stateInc: string): Promise<AnexTown[]> {
    return this.cached(`hotelTowns:${stateInc}`, DICT_TTL_MS, () =>
      this.fetchJson<AnexTown[]>("/samo/searchhotel/Towns", {
        LANG: "ru",
        topCount: "5",
        TOWNFROMINC: HOTEL_TOWNFROM,
        STATEFROM: HOTEL_STATEFROM,
        STATEINC: stateInc,
      }),
    );
  }

  hotels(stateInc: string): Promise<AnexHotel[]> {
    return this.cached(`hotels:${stateInc}`, DICT_TTL_MS, () =>
      this.fetchJson<AnexHotel[]>("/samo/searchtour/Hotels", {
        SEARCH_MODE: ANEX_SEARCH_MODE,
        STATEINC: stateInc,
        TOWNFROMINC: ANEX_TOWNFROMINC,
        LANG: "ru",
      }),
    );
  }

  // ── STATE resolution (shared geography mapping) ───────────────────────

  /** Resolve a supplier-neutral country (ISO-2 or ru/en name) → STATEINC. */
  async resolveState(candidate?: string): Promise<AnexState> {
    return this.resolveStateIn(await this.states(), candidate);
  }

  /**
   * Same resolution against the HOTELS country dictionary. The hotel
   * adapter must never call resolveState() (tour dictionary): for AZ it
   * throws "supplier serves: Турция, Египет, …" — 52 hotel countries vs 21
   * tour countries, disjoint id spaces in places (verified live).
   */
  async resolveHotelState(candidate?: string): Promise<AnexState> {
    return this.resolveStateIn(await this.hotelStates(), candidate);
  }

  private resolveStateIn(states: AnexState[], candidate?: string): AnexState {
    if (!candidate?.trim()) {
      throw new Error(
        `ANEX: UNSUPPORTED query — country/destination is required (serves: ${states
          .map((s) => s.name)
          .join(", ")})`,
      );
    }
    const raw = candidate.trim();
    if (/^[A-Za-z]{2}$/.test(raw)) {
      const iso = raw.toUpperCase();
      const hit = states.find((s) => s.stateISO === iso);
      if (hit) return hit;
    }
    const wanted = normName(raw);
    const hit =
      states.find((s) => normName(s.name) === wanted) ??
      states.find((s) => normName(s.nameAlt ?? "") === wanted) ??
      states.find((s) => normName(s.name).includes(wanted) || wanted.includes(normName(s.name)));
    if (!hit) {
      throw new Error(
        `ANEX: UNSUPPORTED destination "${candidate}" — supplier serves: ${states
          .map((s) => s.name)
          .join(", ")}`,
      );
    }
    return hit;
  }

  /**
   * resolveState that also accepts a resort/city label ("Султанахмет-Фатих",
   * "Бодрум" — what price-calendar carries as destination). Falls back to
   * probing the (cached) per-state Towns dictionaries until the town matches.
   */
  async resolveStateFlexible(candidate?: string): Promise<AnexState> {
    if (!candidate?.trim()) return this.resolveState(candidate);
    try {
      return await this.resolveState(candidate);
    } catch {
      // not a country — fall through to the town probe
    }
    const wanted = normName(candidate);
    const states = await this.states();
    for (const s of states) {
      const towns = await this.towns(String(s.id)).catch(() => [] as AnexTown[]);
      const hit = towns.find(
        (t) => normName(t.name) === wanted || normName(t.region ?? "") === wanted,
      );
      if (hit) return s;
    }
    return this.resolveState(candidate); // rethrow the descriptive error
  }
}
