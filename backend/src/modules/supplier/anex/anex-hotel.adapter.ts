import { Injectable, Logger } from "@nestjs/common";
import type {
  SupplierAdapter,
  SupplierSearchQuery,
  SupplierOffer,
  SupplierOfferDetail,
  SupplierOfferRef,
  SupplierPriceSnapshot,
  SupplierAvailability,
  SupplierAvailabilitySnapshot,
  PriceCalendarQuery,
  PriceCalendarResult,
} from "../supplier.types";
import {
  AnexProvider,
  addDays,
  normName,
  toCompactDate,
  toIsoDate,
  ANEX_CURRENCY_INC,
  ANEX_MAX_PAGES,
  ANEX_PAGE_SIZE,
  ANEX_SEARCH_MODE,
  type AnexState,
} from "./anex.provider";

// ru→latin transliteration key for city-name matching (see applyLocalFilters):
// the supplier writes «Гёйнюк», Master Geography «Гойнюк» — normName keeps
// them apart (гейнюк vs гойнюк), but both transliterate to "goynuk".
const RU_TO_LAT: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "o", ж: "zh", з: "z",
  и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r",
  с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "c", ч: "ch", ш: "sh", щ: "sch",
  ъ: "", ы: "y", ь: "", э: "e", ю: "u", я: "a",
};

function translitKey(s: string): string {
  let out = "";
  for (const ch of s.toLowerCase()) {
    if (RU_TO_LAT[ch] !== undefined) out += RU_TO_LAT[ch];
    else if ((ch >= "a" && ch <= "z") || (ch >= "0" && ch <= "9")) out += ch;
  }
  return out;
}

/**
 * AnexHotelAdapter — HOTELS category adapter of the ANEX provider
 * (anextour.az/search/hotels). A separate adapter per the hotels transition
 * prompt (§2): Tour Adapter is never used for Hotels; both adapters share
 * AnexProvider (HTTP client, dictionaries, STATE resolution).
 *
 * Hotel search differs from the tour search in every request-level detail
 * (verified live 2026-09 against the site's own search):
 *  - SEARCH_TYPE=PACKET_ONLY_HOTELS with STATEFROM=16 & TOWNFROM=1
 *    (omitting STATEFROM → HTTP 400);
 *  - stay bounds are checkIn/checkOut (compact YYYYMMDD) — there is no
 *    CHECKIN_BEG/CHECKIN_END/NIGHTMIN/NIGHTMAX range: one exact request per
 *    night of the requested range, merged;
 *  - AGES takes the CSV of ALL child ages («5,7»), not only the first age;
 *  - the response mixes EQUIVALENT occupancies (a 2+1 request also returns
 *    3+0 rows) — filtered to the exact (adults, children) pair here;
 *  - rows with enable=false are NOT dropped: the site renders them as-is
 *    (verified: all 34 AZ rows and 28 of 387 TR rows carry enable=false and
 *    every one of them is rendered as a bookable card) — `enable` only marks
 *    non-instant booking, not availability.
 *
 * Row → offer mapping is hotel-specific: room = roomName, placement =
 * htPlaceName (DBL), meal = mealName, category from groupStarName ("4*"),
 * price = converted_price (total in AZN — CURRENCY=26).
 */

/** Site constants for the hotels search (from the live capture). */
const SEARCH_TYPE = "PACKET_ONLY_HOTELS";
/** Departure town inc for hotels (SPA const HOTELS_TOWN_FROM_INC). */
const TOWNFROM = "1";
/** Departure state inc (AZ) — REQUIRED, requests without it answer HTTP 400. */
const STATEFROM = "16";
/** The site sends THE_BEST_AT_TOP=false for hotels (tours: true). */
const THE_BEST_AT_TOP = "false";
/** Night bounds offered by the hotels search form (1..30). */
const NIGHTS_MIN = 1;
const NIGHTS_MAX = 30;
/** Parallel exact-night requests (each may paginate). */
const NIGHT_FANOUT_CONCURRENCY = 4;

/** One price row of GET /search?SEARCH_TYPE=PACKET_ONLY_HOTELS. */
export interface AnexHotelPriceRow {
  cat_Claim?: string;
  fullNumber?: string;
  hotelInc?: number;
  hotelName?: string;
  hotelTownName?: string;
  townInc?: number;
  townName?: string;
  regionName?: string;
  starInc?: number | string;
  starName?: string;
  groupStarInc?: number | string;
  groupStarName?: string;
  mealInc?: number;
  mealName?: string;
  roomInc?: number;
  roomName?: string;
  htPlaceInc?: number;
  htPlaceName?: string;
  checkIn?: string;
  checkOut?: string;
  nights?: number;
  adult?: number;
  child?: number;
  peopleCount?: number;
  price?: number;
  converted_price?: number;
  currencyInc?: number | string;
  tourInc?: number;
  tourName?: string;
  tourTypeName?: string;
  programTypeName?: string;
  www?: string;
  slug?: string;
  enable?: unknown;
  stopSaleCheckIn?: boolean | string | null;
  stopSaleHotel?: boolean | string | null;
  stopSaleHtPlace?: boolean | string | null;
  stopSaleRoom?: boolean | string | null;
  stopSaleMeal?: boolean | string | null;
  rating?: number | null;
  review?: number | null;
  [key: string]: unknown;
}

interface AnexHotelSearchPage {
  prices?: AnexHotelPriceRow[];
  result?: {
    countTotal?: number;
    currentPage?: number;
    pageCount?: number;
    minPrice?: number;
    maxPrice?: number;
  };
}

function isStopped(row: AnexHotelPriceRow): boolean {
  return (
    row.stopSaleCheckIn === true ||
    row.stopSaleCheckIn === "1" ||
    row.stopSaleHotel === true ||
    row.stopSaleHotel === "1" ||
    row.stopSaleHtPlace === true ||
    row.stopSaleHtPlace === "1" ||
    row.stopSaleRoom === true ||
    row.stopSaleRoom === "1" ||
    row.stopSaleMeal === true ||
    row.stopSaleMeal === "1"
  );
}

@Injectable()
export class AnexHotelAdapter implements SupplierAdapter {
  readonly code = "ANEX";
  readonly name = "ANEX (anextour.az)";
  readonly enabled = true;

  private readonly logger = new Logger(AnexHotelAdapter.name);

  constructor(private readonly provider: AnexProvider) {}

  // ── SupplierAdapter: search ───────────────────────────────────────────

  async search(query: SupplierSearchQuery): Promise<SupplierOffer[]> {
    const start = Date.now();
    const state = await this.provider.resolveHotelState(query.country ?? query.destination);

    const checkIn = query.departureDateFrom ?? toIsoDate(new Date());
    const lo = Math.max(NIGHTS_MIN, Math.min(query.nightsFrom ?? 7, query.nightsTo ?? query.nightsFrom ?? 7));
    const hi = Math.min(NIGHTS_MAX, Math.max(query.nightsFrom ?? 7, query.nightsTo ?? query.nightsFrom ?? 7));
    const adults = query.adults ?? 2;
    const children = query.children ?? 0;

    const rows = await this.fetchRows({
      stateInc: String(state.id),
      checkIn,
      nightsFrom: lo,
      nightsTo: hi,
      adults,
      children,
      childAges: query.childAges,
    });

    let filtered = rows.filter(
      (r) =>
        (r.adult === undefined || r.adult === adults) &&
        (r.child === undefined || r.child === children),
    );
    const droppedOccupancy = rows.length - filtered.length;

    filtered = this.applyLocalFilters(filtered, query);
    const starIds = await this.resolveStarIdSet(query, state);
    if (starIds) {
      filtered = filtered.filter((r) => starIds.has(String(r.groupStarInc ?? "")));
    }

    const offers = filtered.map((r) => this.normalize(r, query, state));
    this.logger.log(
      `ANEX hotels ${state.name} ${checkIn} ${lo}-${hi}n: ${rows.length} rows → ` +
        `${offers.length} offers in ${Date.now() - start}ms` +
        (droppedOccupancy > 0 ? ` (${droppedOccupancy} occupancy dropped)` : ""),
    );
    return offers;
  }

  /**
   * Fetch price rows for the exact-night fan-out: ONE request per night of
   * the range (checkOut = checkIn + n), run with bounded parallelism, then
   * merged and de-duplicated. The upstream has no nights range for hotels.
   */
  private async fetchRows(params: {
    stateInc: string;
    checkIn: string;
    nightsFrom: number;
    nightsTo: number;
    adults: number;
    children: number;
    childAges?: number[];
  }): Promise<AnexHotelPriceRow[]> {
    const nights: number[] = [];
    for (let n = params.nightsFrom; n <= params.nightsTo; n++) nights.push(n);

    const merged: AnexHotelPriceRow[] = [];
    const seen = new Set<string>();
    let empty = 0;
    let cursor = 0;
    const workers = Array.from(
      { length: Math.min(NIGHT_FANOUT_CONCURRENCY, nights.length) },
      async () => {
        while (cursor < nights.length) {
          const night = nights[cursor++];
          const rows = await this.fetchExact({ ...params, night });
          if (!rows.length) empty += 1;
          for (const row of rows) {
            const key = `${this.offerIdOf(row)}|${row.nights ?? night}`;
            if (seen.has(key)) continue;
            seen.add(key);
            merged.push(row);
          }
        }
      },
    );
    await Promise.all(workers);

    if (!merged.length) {
      this.logger.warn(
        `ANEX hotels STATE=${params.stateInc} ${params.checkIn}: ` +
          `no prices for ${params.nightsFrom}-${params.nightsTo}n (${empty}/${nights.length} nights empty)`,
      );
    }
    return merged;
  }

  /** One exact-night request (checkIn → checkOut) with pagination. */
  private async fetchExact(params: {
    stateInc: string;
    checkIn: string;
    night: number;
    adults: number;
    children: number;
    childAges?: number[];
  }): Promise<AnexHotelPriceRow[]> {
    const rows: AnexHotelPriceRow[] = [];
    const ages =
      params.children > 0
        ? Array.from({ length: params.children }, (_, i) => params.childAges?.[i] ?? 0).join(",")
        : "";
    let page = 1;
    let pageCount = 1;
    do {
      let body: AnexHotelSearchPage[];
      try {
        body = await this.provider.fetchJson<AnexHotelSearchPage[]>("/search", {
          CHARTER: "True",
          REGULAR: "True",
          FILTER: "1",
          FREIGHT: "1",
          ADULT: params.adults,
          CHILD: params.children,
          AGES: ages,
          // STATEFROM is REQUIRED for the hotels search (HTTP 400 without),
          // TOWNFROM=1 is the SPA's departure-town const (HOTELS_TOWN_FROM_INC).
          STATEFROM,
          TOWNFROM,
          STATE: params.stateInc,
          checkIn: toCompactDate(params.checkIn),
          checkOut: toCompactDate(addDays(params.checkIn, params.night)),
          // Empty bounds are REQUIRED (same contract as the tour search:
          // without COSTMIN/COSTMAX the API answers a state-only stub).
          COSTMIN: "",
          COSTMAX: "",
          CURRENCY: ANEX_CURRENCY_INC,
          PARTITION_PRICE: "32",
          PRICE_PAGE: page,
          RECONPAGE: String(ANEX_PAGE_SIZE),
          SEARCH_MODE: ANEX_SEARCH_MODE,
          SEARCH_TYPE,
          SORT_TYPE: "0",
          THE_BEST_AT_TOP,
        });
      } catch (err) {
        // HTTP 424 is how ANEX says "no combinations for these params" —
        // an honest empty answer, not an error (same as the tours adapter).
        if (err instanceof Error && err.message.includes("HTTP 424")) {
          break;
        }
        throw err;
      }
      const payload = body?.[0];
      if (!payload?.prices?.length) break;
      rows.push(...payload.prices);
      pageCount = payload.result?.pageCount ?? 1;
      page += 1;
    } while (page <= pageCount && page <= ANEX_MAX_PAGES);
    return rows;
  }

  /**
   * Local post-filters: city (towns id CSV + townNames) and hotel (id or name).
   *
   * The city filter has TWO channels because the id one is not reliable:
   * ANEX answers the no-flight packets (`tourName "Austria (no flight) AZE"`)
   * with a NEGATIVE townInc/hotelInc hash (`-767422` Vienna, `-911035`
   * Singapore — 0 positive ids for AT/FR/IT/SG, verified live), while TOWN
   * link ids are positive. There is no upstream TOWNS param either (any
   * TOWNS/TOWN/TOWNSINC value makes /search return 0 rows). So a row passes
   * when its townInc matches an id OR its townName/hotelTownName matches a
   * requested town name. The name match runs on TWO keys: normName
   * (lowercase, ё→е, alphanumerics) and a ru→latin transliteration key —
   * «Гёйнюк» (supplier) vs «Гойнюк» (Master Geography) normalize to
   * different strings but transliterate to the same "goynuk".
   */
  private applyLocalFilters(rows: AnexHotelPriceRow[], query: SupplierSearchQuery): AnexHotelPriceRow[] {
    let out = rows;

    const townsCsv = query.towns?.replace(/\s+/g, "");
    const wantedKeys = new Set<string>();
    for (const n of query.townNames ?? []) {
      const a = normName(n);
      if (a) wantedKeys.add(a);
      const b = translitKey(n);
      if (b) wantedKeys.add(b);
    }
    if (townsCsv || wantedKeys.size > 0) {
      const ids = townsCsv ? new Set(townsCsv.split(",").filter(Boolean)) : null;
      out = out.filter((r) => {
        if (ids && ids.size > 0 && r.townInc !== undefined && ids.has(String(r.townInc))) {
          return true;
        }
        if (wantedKeys.size > 0) {
          for (const raw of [r.townName, r.hotelTownName]) {
            if (!raw) continue;
            const a = normName(raw);
            if (a && wantedKeys.has(a)) return true;
            const b = translitKey(raw);
            if (b && wantedKeys.has(b)) return true;
          }
        }
        return false;
      });
    }

    if (query.hotelExternalId) {
      const id = query.hotelExternalId.trim();
      out = out.filter((r) => String(r.hotelInc ?? "") === id);
    } else if (query.hotel?.trim()) {
      const wanted = normName(query.hotel.trim());
      out = out.filter((r) => {
        const n = normName(r.hotelName ?? "");
        if (!n) return false;
        if (n === wanted) return true;
        if (n.length >= 4 && wanted.includes(n)) return true;
        if (wanted.length >= 4 && n.includes(wanted)) return true;
        return false;
      });
    }

    return out;
  }

  /**
   * Supplier-native group star ids for the requested hotelStars labels:
   * aggregator-resolved starKeys (SupplierGeoLink kind=STAR), else the live
   * HOTEL Stars dictionary by label (/samo/searchhotel/Stars?STATEFROM=16 —
   * verified: ids match rows' groupStarInc, 10008=3* … 10014=Boutique; the
   * tour Stars dictionary answers HTTP 500 for hotel-only countries like AZ).
   */
  private async resolveStarIdSet(query: SupplierSearchQuery, state: AnexState): Promise<Set<string> | null> {
    const keysCsv = query.starKeys?.[this.code]?.replace(/\s+/g, "");
    if (keysCsv) {
      const ids = new Set<string>();
      for (const part of keysCsv.split(",").filter(Boolean)) {
        const sep = part.indexOf(":");
        if (sep >= 0) {
          if (String(state.id) === part.slice(0, sep)) ids.add(part.slice(sep + 1));
        } else {
          ids.add(part);
        }
      }
      if (ids.size) return ids;
    }
    if (!query.hotelStars?.length) return null;

    const dict = await this.provider.hotelStars(String(state.id));
    const ids = new Set<string>();
    for (const label of query.hotelStars) {
      const wanted = label.trim().toLowerCase();
      if (!wanted) continue;
      const exact = dict.find((s) => s.name.trim().toLowerCase() === wanted);
      if (exact) {
        ids.add(String(exact.id));
        continue;
      }
      // "4" / "4*" style tokens against dictionary labels ("4*", "5*/hv1").
      const m = wanted.match(/^([1-5])\s*\*?/);
      if (m) {
        for (const s of dict) {
          const sm = s.name.trim().toLowerCase().match(/^([1-5])\s*\*+/);
          if (sm && sm[1] === m[1]) ids.add(String(s.id));
        }
      }
    }
    return ids.size ? ids : null;
  }

  // ── SupplierAdapter: detail / refresh ─────────────────────────────────

  async getOffer(ref: SupplierOfferRef): Promise<SupplierOfferDetail> {
    const offers = await this.search({ ...ref.searchContext, adults: ref.searchContext.adults ?? 2 });
    const m = offers.find((o) => o.externalOfferId === ref.externalOfferId);
    if (m) return { ...m };
    return {
      supplierCode: this.code,
      service: "hotels",
      externalOfferId: ref.externalOfferId,
      externalClaim: ref.externalClaim,
      hotel: ref.searchContext.hotel ?? "",
      departureDate: ref.searchContext.departureDateFrom ?? "",
      nights: ref.searchContext.nightsFrom ?? 0,
      adults: ref.searchContext.adults ?? 2,
      children: ref.searchContext.children ?? 0,
      childAges: ref.searchContext.childAges ?? [],
      price: {
        amount: 0,
        currency: "AZN",
        fetchedAt: new Date(),
        expiresAt: new Date(),
        queryHash: "",
        source: this.code,
      },
      availability: "NOT_AVAILABLE",
      fetchedAt: new Date(),
      expiresAt: new Date(),
    };
  }

  async refreshPrice(ref: SupplierOfferRef): Promise<SupplierPriceSnapshot> {
    const offers = await this.search({ ...ref.searchContext, adults: ref.searchContext.adults ?? 2 });
    const m = offers.find((o) => o.externalOfferId === ref.externalOfferId);
    return m
      ? m.price
      : {
          amount: 0,
          currency: "AZN",
          fetchedAt: new Date(),
          expiresAt: new Date(Date.now() + 5 * 60 * 1000),
          queryHash: JSON.stringify(ref.searchContext),
          source: this.code,
        };
  }

  async refreshAvailability(ref: SupplierOfferRef): Promise<SupplierAvailabilitySnapshot> {
    const offers = await this.search({ ...ref.searchContext, adults: ref.searchContext.adults ?? 2 });
    const m = offers.find((o) => o.externalOfferId === ref.externalOfferId);
    return {
      availability: m ? m.availability : "NOT_AVAILABLE",
      fetchedAt: new Date(),
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    };
  }

  /**
   * Hotels price calendar is not implemented for this provider — an honest
   * empty result (no fabricated min/max prices).
   */
  async getPriceCalendar(query: PriceCalendarQuery): Promise<PriceCalendarResult> {
    const now = new Date();
    return {
      supplierCode: this.code,
      contextHash: JSON.stringify({
        category: "hotels",
        destination: query.destination,
        hotel: query.hotel,
        adults: query.adults,
        children: query.children,
        nights: query.nights,
      }),
      entries: [],
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
      fetchedAt: now,
      expiresAt: new Date(now.getTime() + 5 * 60 * 1000),
      totalOffersScanned: 0,
    };
  }

  // ── Normalization (hotel-specific mapping) ────────────────────────────

  private offerIdOf(row: AnexHotelPriceRow): string {
    if (row.cat_Claim) return row.cat_Claim;
    return [
      "HOTEL",
      row.hotelInc ?? "",
      (row.checkIn ?? "").slice(0, 10),
      (row.checkOut ?? "").slice(0, 10),
      row.roomInc ?? "",
      row.mealInc ?? "",
      row.converted_price ?? row.price ?? "",
    ].join("-");
  }

  private availabilityOf(row: AnexHotelPriceRow): SupplierAvailability {
    // Supplier sends no seat markers — UNKNOWN is the honest state; only an
    // explicit stop-sale is promoted to NOT_AVAILABLE.
    return isStopped(row) ? "NOT_AVAILABLE" : "UNKNOWN";
  }

  private normalize(
    raw: AnexHotelPriceRow,
    query: SupplierSearchQuery,
    state: AnexState,
  ): SupplierOffer {
    const now = new Date();
    const departureDate = (raw.checkIn ?? "").slice(0, 10);
    return {
      supplierCode: this.code,
      service: "hotels",
      externalOfferId: this.offerIdOf(raw),
      externalClaim: raw.cat_Claim,
      // «Только отель» (tourTypeName) — the hotel-only program of the row.
      tour: raw.tourTypeName,
      hotel: raw.hotelName ?? "",
      hotelExternalId: raw.hotelInc !== undefined ? String(raw.hotelInc) : undefined,
      country: state.name,
      destination: raw.regionName || raw.hotelTownName || raw.townName || query.destination,
      departureDate,
      nights: raw.nights ?? query.nightsFrom ?? 7,
      room: raw.roomName,
      meal: raw.mealName,
      adults: raw.adult ?? query.adults ?? 2,
      children: raw.child ?? query.children ?? 0,
      childAges: query.childAges ?? [],
      price: {
        // converted_price is the total in the requested currency
        // (CURRENCY=26 → AZN); plain `price` is in the hotel's own currency
        // (USD/EUR, verified by constant ratios 1.7055 / 1.964).
        amount: raw.converted_price ?? raw.price ?? 0,
        currency: "AZN",
        fetchedAt: now,
        expiresAt: new Date(now.getTime() + 5 * 60 * 1000),
        queryHash: "",
        source: this.code,
      },
      availability: this.availabilityOf(raw),
      fetchedAt: now,
      expiresAt: new Date(now.getTime() + 5 * 60 * 1000),
      rawMetadata: {
        starName: raw.starName,
        groupStarName: raw.groupStarName,
        starInc: raw.starInc,
        groupStarInc: raw.groupStarInc,
        mealInc: raw.mealInc,
        mealName: raw.mealName,
        roomInc: raw.roomInc,
        roomName: raw.roomName,
        htPlaceInc: raw.htPlaceInc,
        htPlaceName: raw.htPlaceName,
        regionName: raw.regionName,
        townName: raw.townName,
        hotelTownName: raw.hotelTownName,
        townInc: raw.townInc,
        tourInc: raw.tourInc,
        tourName: raw.tourName,
        tourTypeName: raw.tourTypeName,
        programName: raw.programTypeName,
        fullNumber: raw.fullNumber,
        checkOut: raw.checkOut,
        peopleCount: raw.peopleCount,
        priceLocal: raw.price,
        convertedPrice: raw.converted_price,
        www: raw.www,
        slug: raw.slug,
        rating: raw.rating,
        review: raw.review,
      },
    };
  }
}
