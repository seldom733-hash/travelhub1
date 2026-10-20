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
  PriceCalendarEntry,
  PriceCalendarResult,
  SupplierGeoOption,
} from "../supplier.types";
import { priceUnavailable } from "../supplier.types";
import {
  AnexProvider,
  addDays,
  anexStarNumber,
  normName,
  normStarLabel,
  toCompactDate,
  toIsoDate,
  ANEX_CURRENCY_INC,
  ANEX_MAX_PAGES,
  ANEX_PAGE_SIZE,
  ANEX_SEARCH_MODE,
  type AnexHotel,
  type AnexStar,
  type AnexStarFilter,
  type AnexState,
  type AnexTown,
} from "./anex.provider";

/**
 * ANEX adapter (anextour.az / webapi.anextour.az) — TOURS category adapter.
 * The hotel category has its own AnexHotelAdapter; both share AnexProvider
 * (HTTP client / dictionaries / STATE resolution).
 *
 * Search: GET /search with SAMO-style UPPER params — one request returns up
 * to 500 price rows (grouped by hotel); PRICE_PAGE paginates (pageCount in
 * the result). RECONPAGE is required (without it the API answers with an
 * empty payload).
 *
 * Geo dictionary: /samo/searchtour/{Towns,Stars,Hotels} per STATEINC.
 *
 * Hotel category: STARLIST=<dictionary ids> is the supplier's own star filter
 * (labels come from /samo/searchtour/Stars, e.g. TR 10008=3*, 10009=4*,
 * 10010=5* / HV1, 10014=Boutique). It is sent server-side AND verified
 * locally, because the upstream is not exact: STARLIST=10010 was observed
 * returning a 4* row, and its "5* / HV1" group mixes 5* hotels with HV-1.
 * The local check reads the row's precise starName ("5 *****", "4 ****+",
 * "HV-1", "2.0"), so a plain "5*" never leaks HV-1 — only an explicit
 * "5* / HV1" request does.
 *
 * City/hotel filters stay local (townInc / hotelInc) — they are not part of
 * the upstream /search contract.
 */

/** Baku — the only departure town the AZ market serves (verified). */
const TOWNFROM = "baku";
const SEARCH_TYPE = "PACKET_TOUR";
/** Nights bounds of the ANEX Nights dictionary (matches the capability matrix). */
const NIGHTS_MIN = 2;
const NIGHTS_MAX = 28;

/** One price row from GET /search (verified field subset). */
export interface AnexPriceRow {
  cat_Claim?: string;
  hotelInc?: number;
  hotelName?: string;
  hotelTownName?: string;
  townInc?: number;
  starInc?: number | string;
  starName?: string;
  groupStarInc?: number | string;
  groupStarName?: string;
  mealInc?: number;
  mealName?: string;
  roomInc?: number;
  roomName?: string;
  checkIn?: string;
  nights?: number;
  adult?: number;
  child?: number;
  agE1?: number | string;
  price?: number;
  converted_price?: number;
  priceOld?: number;
  currencyInc?: number | string;
  tourInc?: number;
  tourName?: string;
  programTypeName?: string;
  transportCodeKey?: number | string;
  www?: string;
  slug?: string;
  stopSaleCheckIn?: boolean | string | null;
  stopSaleHotel?: boolean | string | null;
  [key: string]: unknown;
}

interface AnexSearchPage {
  prices?: AnexPriceRow[];
  result?: {
    countTotal?: number;
    currentPage?: number;
    pageCount?: number;
    minPrice?: number;
    maxPrice?: number;
  };
  state?: { inc?: number; name?: string; lname?: string };
}

@Injectable()
export class AnexAdapter implements SupplierAdapter {
  readonly code = "ANEX";
  readonly name = "ANEX (anextour.az)";
  readonly enabled = true;

  private readonly logger = new Logger(AnexAdapter.name);

  constructor(private readonly provider: AnexProvider) {}

  /**
   * State resolution for search/refresh/calendar (§4.8 Request Modal re-check):
   * the re-check rebuilds the query from the offer, which may carry a
   * resort/town label as destination (calendar offers) and no country at all
   * (hotel-scoped calendars). Mirrors the calendar's flexible resolution and
   * adds a hotel dictionary scan as the last resort — explicit country/
   * destination (country match, then town probe) → hotel dictionary scan →
   * the original descriptive UNSUPPORTED error.
   */
  private async resolveStateForQuery(
    candidate: string | undefined,
    hotelExternalId?: string,
  ): Promise<AnexState> {
    let firstErr: unknown;
    try {
      return await this.provider.resolveStateFlexible(candidate);
    } catch (err) {
      firstErr = err;
    }
    if (hotelExternalId) {
      const states = await this.provider.states().catch(() => [] as AnexState[]);
      for (const s of states) {
        try {
          const hotels = await this.provider.hotels(String(s.id));
          if (hotels.some((h) => String(h.id) === String(hotelExternalId))) {
            this.logger.log(
              `ANEX: resolved state ${s.name} for hotel ${hotelExternalId} (no usable country/destination)`,
            );
            return s;
          }
        } catch (err) {
          this.logger.warn(
            `ANEX: hotel dictionary scan ${s.name} failed: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      }
    }
    throw firstErr instanceof Error
      ? firstErr
      : new Error("ANEX: UNSUPPORTED query — country/destination is required");
  }

  // ── SupplierAdapter: search ───────────────────────────────────────────

  async search(query: SupplierSearchQuery): Promise<SupplierOffer[]> {
    const start = Date.now();
    const state = await this.resolveStateForQuery(
      query.country ?? query.destination,
      query.hotelExternalId,
    );

    const dateFrom = query.departureDateFrom ?? toIsoDate(new Date());
    const dateTo = query.departureDateTo && query.departureDateTo >= dateFrom ? query.departureDateTo : dateFrom;
    const nightsFrom = query.nightsFrom ?? 7;
    const nightsTo = query.nightsTo ?? nightsFrom;

    const starFilter = await this.resolveStarFilter(query, state);
    const rows = await this.fetchPriceRows({
      stateInc: String(state.id),
      checkInBeg: dateFrom,
      checkInEnd: dateTo,
      nightsFrom,
      nightsTo,
      adults: query.adults ?? 2,
      children: query.children ?? 0,
      childAges: query.childAges,
      starList: starFilter?.ids.join(",") || undefined,
    });

    let filtered = this.applyLocalFilters(rows, query);
    if (starFilter) {
      const before = filtered.length;
      filtered = filtered.filter((r) => this.rowMatchesStarFilter(r, starFilter));
      this.logger.debug(
        `ANEX star filter ${[...starFilter.numbers].map((n) => `${n}*`).join(", ") || "-"}` +
          `${starFilter.labels.size ? ` [${[...starFilter.labels].join(", ")}]` : ""}: ` +
          `${before - filtered.length} rows dropped locally`,
      );
    }
    // §5.7: rows without a positive supplier price are dropped here — they
    // are NOT offer-shaped (`normalizeRow` fails closed via priceUnavailable),
    // and `amount: 0` must never be synthesized as a valid price.
    const pricedRows = filtered.filter((r) => this.rowPrice(r) !== null);
    const offers = pricedRows.map((r) => this.normalizeRow(r, query, state));
    this.logger.log(
      `ANEX search ${state.name} ${dateFrom}→${dateTo} ${nightsFrom}-${nightsTo}n: ` +
        `${rows.length} rows → ${offers.length} offers in ${Date.now() - start}ms` +
        (filtered.length - pricedRows.length > 0
          ? ` (${filtered.length - pricedRows.length} priceless rows dropped)`
          : ""),
    );
    return offers;
  }

  /**
   * Fetch price rows for a NIGHTS RANGE.
   *
   * The upstream has no working range: NIGHTMAX is silently ignored
   * (NIGHTMIN=3&NIGHTMAX=7 returns ONLY 3-night rows — verified live for
   * STATE=85 on 2026-10-05), while empty/missing NIGHT* params return
   * nothing at all. So each night of the range gets its own exact-night
   * request (NIGHTMIN=NIGHTMAX=n) and the results are merged.
   */
  private async fetchPriceRows(params: {
    stateInc: string;
    checkInBeg: string;
    checkInEnd: string;
    nightsFrom: number;
    nightsTo: number;
    adults: number;
    children: number;
    childAges?: number[];
    /** STARLIST — supplier-native category ids (see AnexStarFilter). */
    starList?: string;
  }): Promise<AnexPriceRow[]> {
    const lo = Math.max(NIGHTS_MIN, Math.min(params.nightsFrom, params.nightsTo));
    const hi = Math.min(NIGHTS_MAX, Math.max(params.nightsFrom, params.nightsTo));
    const merged: AnexPriceRow[] = [];
    const seen = new Set<string>();
    let emptyNights = 0;
    for (let night = lo; night <= hi; night++) {
      const rows = await this.fetchPriceRowsExact({ ...params, night });
      if (!rows.length) emptyNights += 1;
      for (const row of rows) {
        const key = `${this.offerIdOf(row)}|${row.nights ?? night}`;
        if (seen.has(key)) continue;
        seen.add(key);
        merged.push(row);
      }
    }
    if (!merged.length) {
      this.logger.warn(
        `ANEX search STATE=${params.stateInc} ${params.checkInBeg}→${params.checkInEnd}: ` +
          `no prices for ${lo}-${hi}n (${emptyNights}/${hi - lo + 1} nights empty)`,
      );
    }
    return merged;
  }

  /** Exact-night request (NIGHTMIN=NIGHTMAX) with pagination. */
  private async fetchPriceRowsExact(
    params: {
      stateInc: string;
      checkInBeg: string;
      checkInEnd: string;
      night: number;
      adults: number;
      children: number;
      childAges?: number[];
      starList?: string;
      /** Set after a STARLIST request was rejected — retried without it. */
      starListFallback?: boolean;
    },
    splitDepth = 0,
  ): Promise<AnexPriceRow[]> {
    const rows: AnexPriceRow[] = [];
    let page = 1;
    let pageCount = 1;
    do {
      let body: AnexSearchPage[];
      try {
        body = await this.provider.fetchJson<AnexSearchPage[]>("/search", {
        CHARTER: "True",
        REGULAR: "True",
        FILTER: "1",
        FREIGHT: "1",
        // Supplier-native category filter (dictionary ids, comma-separated).
        STARLIST: params.starList ?? "",
        ADULT: params.adults,
        CHILD: params.children,
        // Confirmed supplier contract (owner-supplied real request):
        // AGES=<comma-separated ages of ALL children> (AGES=1,6,13) — same
        // CSV shape the Anex Hotels endpoint takes (anex-hotel.adapter).
        // Driven by the CHILD count; shorter age lists pad with 0 there too.
        AGES: params.children > 0
          ? Array.from({ length: params.children }, (_, i) => params.childAges?.[i] ?? 0).join(",")
          : "",
        CHECKIN_BEG: toCompactDate(params.checkInBeg),
        CHECKIN_END: toCompactDate(params.checkInEnd),
        // Empty bounds are REQUIRED: without COSTMIN/COSTMAX the API answers
        // a state-only stub [{state:...}] with no prices (verified live).
        // (It can also answer HTTP 424/500 for some state/date combos — those
        // surface as supplier errors, isolated per supplier by the aggregator.)
        COSTMIN: "",
        COSTMAX: "",
        CURRENCY: ANEX_CURRENCY_INC,
        PARTITION_PRICE: "32",
        PRICE_PAGE: page,
        RECONPAGE: String(ANEX_PAGE_SIZE),
        SEARCH_MODE: ANEX_SEARCH_MODE,
        SEARCH_TYPE,
        SORT_TYPE: "0",
        THE_BEST_AT_TOP: "true",
        TOWNFROM,
        STATE: params.stateInc,
        // Exact night: NIGHTMAX is ignored upstream, a range returns only
        // the NIGHTMIN night (verified live) — ranges are expanded in
        // fetchPriceRows().
        NIGHTMIN: String(params.night),
        NIGHTMAX: String(params.night),
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        // A STARLIST request the upstream refuses (424/500 on a single date)
        // must not turn into a silent empty: retry once without the native
        // filter — the local precise check (rowMatchesStarFilter) still
        // enforces the category, only the payload gets bigger.
        if (
          params.starList &&
          !params.starListFallback &&
          params.checkInBeg === params.checkInEnd &&
          (message.includes("HTTP 424") || message.includes("HTTP 500"))
        ) {
          this.logger.warn(
            `ANEX STARLIST=${params.starList} rejected (${message}) — retrying without it`,
          );
          return this.fetchPriceRowsExact(
            { ...params, starList: undefined, starListFallback: true },
            splitDepth,
          );
        }
        // HTTP 424 {"code":-1,"message":"Обработаны не все данные…"} is how
        // ANEX says "cannot process this request". Live probing (2026-09-30)
        // showed the upstream has NO working CHECKIN range for tours: any
        // window ≥9 days, or with empty days inside, gets 424 — while every
        // SINGLE date answers 200 (even with countTotal=0). The site itself
        // only ever sends CHECKIN_BEG = CHECKIN_END. So on 424 we bisect the
        // window down to single dates and merge the parts; a single-date 424
        // is an honest empty (aggregated into one warn by fetchPriceRows()).
        if (err instanceof Error && err.message.includes("HTTP 424")) {
          const beg = params.checkInBeg;
          const end = params.checkInEnd;
          const days = Math.round(
            (Date.parse(`${end}T00:00:00Z`) - Date.parse(`${beg}T00:00:00Z`)) / (24 * 60 * 60 * 1000),
          );
          if (page === 1 && beg < end && days >= 1 && splitDepth < 10) {
            const mid = addDays(beg, Math.floor(days / 2));
            const rightBeg = addDays(mid, 1);
            const [left, right] = await Promise.all([
              this.fetchPriceRowsExact({ ...params, checkInEnd: mid }, splitDepth + 1),
              this.fetchPriceRowsExact({ ...params, checkInBeg: rightBeg }, splitDepth + 1),
            ]);
            rows.push(...left, ...right);
            this.logger.debug(
              `ANEX 424-bisect ${beg}→${end} ${params.night}n: ${mid} / ${rightBeg} → ${rows.length} rows`,
            );
            break;
          }
          break;
        }
        throw err;
      }
      const payload = body?.[0];
      if (!payload?.prices?.length) {
        // Multi-day windows LIE with HTTP 200: live probe (2026-10-18) showed
        // CHECKIN 2026-10-26..10-31 answers countTotal=0 while the single date
        // 2026-10-27 inside it answers 128 prices. Same for 5-day windows —
        // the upstream only tells the truth for CHECKIN_BEG = CHECKIN_END
        // (the site itself only ever sends single dates). So an empty window
        // is NOT an honest empty: bisect it down to single dates exactly like
        // a 424; only a single-date empty is trusted (fetchPriceRows aggregates
        // those into one warn).
        const beg = params.checkInBeg;
        const end = params.checkInEnd;
        const days = Math.round(
          (Date.parse(`${end}T00:00:00Z`) - Date.parse(`${beg}T00:00:00Z`)) / (24 * 60 * 60 * 1000),
        );
        if (page === 1 && beg < end && days >= 1 && splitDepth < 10) {
          const mid = addDays(beg, Math.floor(days / 2));
          const rightBeg = addDays(mid, 1);
          const [left, right] = await Promise.all([
            this.fetchPriceRowsExact({ ...params, checkInEnd: mid }, splitDepth + 1),
            this.fetchPriceRowsExact({ ...params, checkInBeg: rightBeg }, splitDepth + 1),
          ]);
          rows.push(...left, ...right);
          this.logger.debug(
            `ANEX empty-window bisect ${beg}→${end} ${params.night}n: ${mid} / ${rightBeg} → ${rows.length} rows`,
          );
          break;
        }
        // Single date with no prices — an honest empty answer, not an error.
        break;
      }
      rows.push(...payload.prices);
      pageCount = payload.result?.pageCount ?? 1;
      page += 1;
    } while (page <= pageCount && page <= ANEX_MAX_PAGES);
    return rows;
  }

  /** Local post-filters: city (towns CSV) and hotel (id or name). */
  private applyLocalFilters(rows: AnexPriceRow[], query: SupplierSearchQuery): AnexPriceRow[] {
    let out = rows;

    const townsCsv = query.towns?.replace(/\s+/g, "");
    if (townsCsv) {
      const ids = new Set(townsCsv.split(",").filter(Boolean));
      out = out.filter((r) => r.townInc !== undefined && ids.has(String(r.townInc)));
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
   * Resolve the requested hotelStars labels to the supplier's category ids
   * and to a precise local matcher:
   * 1) aggregator-resolved starKeys (SupplierGeoLink kind=STAR, ingested as
   *    "stateInc:id" — a key from another state is ignored), and
   * 2) the live Stars dictionary of the state (label → id + exact label).
   * Returns null when no star filter applies.
   *
   * The local matcher matters because the supplier is not exact:
   * - STARLIST=10010 (5* / HV1) returned a 4* row (groupStarInc=10009);
   * - the same group mixes "5 *****" hotels with "HV-1".
   * A plain "5*" must keep only starName 5 (no HV-1); an explicit
   * "5* / HV1" keeps the whole group.
   */
  private async resolveStarFilter(
    query: SupplierSearchQuery,
    state: AnexState,
  ): Promise<AnexStarFilter | null> {
    const labels = (query.hotelStars ?? []).map((l) => l.trim()).filter(Boolean);
    const filter: AnexStarFilter = {
      ids: [],
      numbers: new Set<number>(),
      labels: new Set<string>(),
      hv1: false,
    };
    const ids = new Set<string>();

    const keysCsv = query.starKeys?.[this.code]?.replace(/\s+/g, "");
    if (keysCsv) {
      for (const part of keysCsv.split(",").filter(Boolean)) {
        const sep = part.indexOf(":");
        if (sep >= 0) {
          if (String(state.id) === part.slice(0, sep)) ids.add(part.slice(sep + 1));
        } else {
          ids.add(part);
        }
      }
    }

    if (labels.length) {
      let dict: AnexStar[] = [];
      try {
        dict = await this.provider.stars(String(state.id));
      } catch (err) {
        // Without the dictionary we cannot verify the label precisely; keep
        // the starKeys ids (if any) rather than failing the whole search.
        this.logger.warn(
          `ANEX stars dictionary STATE=${state.id} unavailable: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
      for (const label of labels) {
        const wanted = normStarLabel(label);
        if (!wanted) continue;
        const exact = dict.find((s) => normStarLabel(s.name) === wanted);
        if (exact) ids.add(String(exact.id));
        const num = wanted.match(/^([1-5])\s*\*/);
        if (num) {
          filter.numbers.add(parseInt(num[1], 10));
          if (!exact) {
            // Plain numeric label ("5*", "4*+") — first dictionary group of
            // that rating is the native filter id, but the local matcher
            // stays strictly numeric.
            const hit = dict.find((s) => normStarLabel(s.name).startsWith(`${num[1]}*`));
            if (hit) ids.add(String(hit.id));
          }
        }
        // Exact dictionary label: match the supplier's own group name
        // ("5*/HV1", "Boutique", "APART").
        if (exact) filter.labels.add(wanted);
        if (/hv[\s-]?1/i.test(wanted)) filter.hv1 = true;
      }
    }

    if (!ids.size && !filter.numbers.size && !filter.labels.size && !filter.hv1) return null;
    filter.ids = [...ids];
    return filter;
  }

  /** Precise star count from ANEX's own row field, or null ("HV-1", "SPECIAL CLASS"). */
  private rowStarNumber(row: AnexPriceRow): number | null {
    const precise = (row.starName ?? "").trim();
    if (precise) return anexStarNumber(precise);
    // No precise starName — fall back to the group label ("5*").
    return anexStarNumber(row.groupStarName);
  }

  private rowMatchesStarFilter(row: AnexPriceRow, filter: AnexStarFilter): boolean {
    // starKeys without any requested label (offer re-check / refresh): there
    // is nothing to verify precisely, so fall back to the supplier group id.
    const precise = filter.numbers.size > 0 || filter.labels.size > 0 || filter.hv1;
    if (!precise) return filter.ids.includes(String(row.groupStarInc ?? ""));

    const number = this.rowStarNumber(row);
    if (number !== null && filter.numbers.has(number)) return true;

    const group = normStarLabel(row.groupStarName ?? "");
    if (group && filter.labels.has(group)) return true;

    if (filter.hv1) {
      const starName = (row.starName ?? "").trim();
      if (/^hv[\s-]?1$/i.test(starName) || /hv[\s-]?1/i.test(group)) return true;
    }
    return false;
  }

  // ── SupplierAdapter: detail / refresh ─────────────────────────────────

  async getOffer(ref: SupplierOfferRef): Promise<SupplierOfferDetail> {
    const offers = await this.search({ ...ref.searchContext, adults: ref.searchContext.adults ?? 2 });
    const m = offers.find((o) => o.externalOfferId === ref.externalOfferId);
    if (m) return { ...m };
    // §5.5: no synthetic zero snapshot — established PRICE_UNAVAILABLE model.
    priceUnavailable(`ANEX offer ${ref.externalOfferId} not found for the original search context`);
  }

  async refreshPrice(ref: SupplierOfferRef): Promise<SupplierPriceSnapshot> {
    const offers = await this.search({ ...ref.searchContext, adults: ref.searchContext.adults ?? 2 });
    const m = offers.find((o) => o.externalOfferId === ref.externalOfferId);
    if (!m) {
      priceUnavailable(`ANEX offer ${ref.externalOfferId} no longer in search results`);
    }
    return m.price;
  }

  async refreshAvailability(ref: SupplierOfferRef): Promise<SupplierAvailabilitySnapshot> {
    const offers = await this.search({ ...ref.searchContext, adults: ref.searchContext.adults ?? 2 });
    const m = offers.find((o) => o.externalOfferId === ref.externalOfferId);
    return {
      availability: m ? "AVAILABLE" : "NOT_AVAILABLE",
      fetchedAt: new Date(),
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    };
  }

  // ── SupplierAdapter: price calendar ───────────────────────────────────

  async getPriceCalendar(query: PriceCalendarQuery): Promise<PriceCalendarResult> {
    const now = new Date();
    const state = await this.resolveStateForQuery(query.destination, query.hotelExternalId);

    const collected: AnexPriceRow[] = [];
    const sizeDays = 30;
    let cursor = query.dateFrom;
    while (cursor <= query.dateTo) {
      const windowEnd = addDays(cursor, sizeDays - 1) > query.dateTo ? query.dateTo : addDays(cursor, sizeDays - 1);
      try {
        const rows = await this.fetchPriceRows({
          stateInc: String(state.id),
          checkInBeg: cursor,
          checkInEnd: windowEnd,
          nightsFrom: query.nights,
          nightsTo: query.nights,
          adults: query.adults ?? 2,
          children: query.children ?? 0,
          childAges: query.childAges,
        });
        collected.push(...rows);
      } catch (err) {
        this.logger.warn(
          `ANEX calendar window ${cursor}→${windowEnd}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
      cursor = addDays(windowEnd, 1);
    }

    let filtered = collected;
    if (query.hotelExternalId) {
      filtered = filtered.filter((r) => String(r.hotelInc ?? "") === query.hotelExternalId!.trim());
    } else if (query.hotel?.trim()) {
      const wanted = normName(query.hotel.trim());
      filtered = filtered.filter((r) => {
        const n = normName(r.hotelName ?? "");
        return n === wanted || (n.length >= 4 && wanted.includes(n)) || (wanted.length >= 4 && n.includes(wanted));
      });
    }

    const byDate = new Map<string, AnexPriceRow[]>();
    for (const row of filtered) {
      const iso = (row.checkIn ?? "").slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) continue;
      // §5.7: rows without a positive price never enter the calendar — the
      // honest shape for a missing price is PriceCalendarEntry.price = null,
      // NOT 0 (a synthesized 0 crashes the pricing boundary / lies to buyers).
      if (this.rowPrice(row) === null) continue;
      const arr = byDate.get(iso) ?? [];
      arr.push(row);
      byDate.set(iso, arr);
    }

    const entries: PriceCalendarEntry[] = [];
    let cursorDate = query.dateFrom;
    while (cursorDate <= query.dateTo) {
      const arr = (byDate.get(cursorDate) ?? []).sort(
        (a, b) => (this.rowPrice(a) ?? Infinity) - (this.rowPrice(b) ?? Infinity),
      );
      const best = arr.length > 0 ? arr[0] : null;
      const price = best === null ? null : this.rowPrice(best);
      if (best !== null && price !== null) {
        entries.push({
          date: cursorDate,
          price,
          currency: "AZN",
          availability: "UNKNOWN",
          offerCount: arr.length,
          offers: arr.map((r) => this.toCalendarOffer(r, query, state)),
          bestOfferRef: {
            supplierCode: this.code,
            externalOfferId: this.offerIdOf(best),
            externalClaim: best.cat_Claim,
            searchContext: {
              adults: query.adults ?? 2,
              children: query.children,
              childAges: query.childAges,
              hotel: query.hotel,
              hotelExternalId: query.hotelExternalId,
              room: query.room,
              meal: query.meal,
              nightsFrom: query.nights,
              nightsTo: query.nights,
              departureDateFrom: cursorDate,
              departureDateTo: cursorDate,
              country: query.destination,
              destination: query.destination,
            },
          },
        });
      } else {
        entries.push({
          date: cursorDate,
          price: null,
          currency: null,
          availability: "NOT_AVAILABLE",
          offerCount: arr.length,
          absenceCode: "SUPPLIER_NO_RESULT",
          absenceText: `Цена не получена — ANEX не предоставил предложение на ${cursorDate}`,
        });
      }
      cursorDate = addDays(cursorDate, 1);
    }

    entries.sort((a, b) => a.date.localeCompare(b.date));
    return {
      supplierCode: this.code,
      contextHash: JSON.stringify({
        hotel: query.hotel,
        hotelExternalId: query.hotelExternalId,
        room: query.room,
        meal: query.meal,
        adults: query.adults,
        children: query.children,
        nights: query.nights,
        destination: query.destination,
      }),
      entries,
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
      fetchedAt: now,
      expiresAt: new Date(now.getTime() + 5 * 60 * 1000),
      totalOffersScanned: filtered.length,
    };
  }

  private toCalendarOffer(
    row: AnexPriceRow,
    query: PriceCalendarQuery,
    state: AnexState,
  ): {
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
  } {
    const price = this.rowPrice(row);
    if (price === null) {
      priceUnavailable(`ANEX calendar offer ${this.offerIdOf(row)} has no valid supplier price`);
    }
    return {
      tourIncValue: row.tourInc !== undefined ? String(row.tourInc) : "",
      tourIncName: row.tourName,
      externalOfferId: this.offerIdOf(row),
      externalClaim: row.cat_Claim,
      hotel: row.hotelName ?? "",
      hotelExternalId: row.hotelInc !== undefined ? String(row.hotelInc) : undefined,
      departureDate: (row.checkIn ?? "").slice(0, 10),
      nights: row.nights ?? query.nights,
      room: row.roomName,
      meal: row.mealName,
      adults: row.adult ?? query.adults ?? 2,
      children: row.child ?? 0,
      childAges: query.childAges ?? [],
      availability: this.availabilityOf(row),
      price,
      currency: "AZN",
      transport: row.programTypeName,
    };
  }

  // ── SupplierAdapter: geo discovery ────────────────────────────────────

  /**
   * Discover geo options for ingest. With a STATEINC: the country's towns
   * (kind=TOWN, region as parent), hotel categories (kind=STAR) and the hotel
   * dictionary (kind=HOTEL, townKey for geo-linking). Order matters: TOWN
   * entries must precede HOTEL ones so ingest can link hotels through their
   * town. Without an argument: union across every state ANEX serves.
   */
  async discoverGeoOptions(countryExternalId?: string): Promise<SupplierGeoOption[]> {
    if (countryExternalId) {
      return this.discoverForState(countryExternalId);
    }
    const states = await this.provider.states();
    const out: SupplierGeoOption[] = [];
    for (const s of states) {
      out.push(...(await this.discoverForState(String(s.id))));
    }
    return out;
  }

  private async discoverForState(stateInc: string): Promise<SupplierGeoOption[]> {
    const out: SupplierGeoOption[] = [];
    const [towns, starList, hotels] = await Promise.all([
      this.provider.towns(stateInc).catch((e) => {
        this.logger.warn(`ANEX towns STATEINC=${stateInc}: ${e instanceof Error ? e.message : e}`);
        return [] as AnexTown[];
      }),
      this.provider.stars(stateInc).catch((e) => {
        this.logger.warn(`ANEX stars STATEINC=${stateInc}: ${e instanceof Error ? e.message : e}`);
        return [] as AnexStar[];
      }),
      this.provider.hotels(stateInc).catch((e) => {
        this.logger.warn(`ANEX hotels STATEINC=${stateInc}: ${e instanceof Error ? e.message : e}`);
        return [] as AnexHotel[];
      }),
    ]);

    for (const t of towns) {
      out.push({
        externalId: String(t.id),
        label: t.name,
        kind: "TOWN",
        countryExternalId: stateInc,
        // A town under a region is a resort of that region city
        // ("Авсаллар" → регион "Аланья"), same hierarchy as KOMPAS TOWNS.
        ...(t.region && t.region !== t.name ? { parentLabel: t.region } : {}),
      });
    }
    for (const s of starList) {
      out.push({
        // STAR ids are only unique per state (different states reuse ids like
        // "1"/"2"), and SupplierGeoLink is unique on (supplier,kind,externalId)
        // — prefix with the state so every country keeps its own dictionary
        // (UI «Категория отеля» + aggregator starKeys both consume these).
        externalId: `${stateInc}:${s.id}`,
        label: s.name,
        kind: "STAR",
        countryExternalId: stateInc,
      });
    }
    for (const h of hotels) {
      out.push({
        externalId: String(h.id),
        label: h.name,
        kind: "HOTEL",
        countryExternalId: stateInc,
        ...(h.townKey !== undefined && h.townKey !== null && String(h.townKey) !== ""
          ? { townKey: String(h.townKey) }
          : {}),
      });
    }
    return out;
  }

  // ── Normalization ─────────────────────────────────────────────────────

  /** Positive supplier price for a row, or null when absent/non-positive (§5.7). */
  private rowPrice(row: AnexPriceRow): number | null {
    const p = row.converted_price ?? row.price;
    return typeof p === "number" && Number.isFinite(p) && p > 0 ? p : null;
  }

  private offerIdOf(row: AnexPriceRow): string {
    if (row.cat_Claim) return row.cat_Claim;
    return [
      row.hotelInc ?? "",
      (row.checkIn ?? "").slice(0, 10),
      row.roomInc ?? "",
      row.mealInc ?? "",
      row.converted_price ?? row.price ?? "",
    ].join("-");
  }

  private availabilityOf(row: AnexPriceRow): SupplierAvailability {
    const stopped =
      row.stopSaleCheckIn === true ||
      row.stopSaleCheckIn === "1" ||
      row.stopSaleHotel === true ||
      row.stopSaleHotel === "1";
    // Supplier sends no seat markers — UNKNOWN is the honest state.
    return stopped ? "NOT_AVAILABLE" : "UNKNOWN";
  }

  private normalizeRow(raw: AnexPriceRow, query: SupplierSearchQuery, state: AnexState): SupplierOffer {
    const now = new Date();
    const departureDate = (raw.checkIn ?? "").slice(0, 10);
    const amount = this.rowPrice(raw);
    if (amount === null) {
      priceUnavailable(`ANEX search offer ${this.offerIdOf(raw)} has no valid supplier price`);
    }
    return {
      supplierCode: this.code,
      externalOfferId: this.offerIdOf(raw),
      externalClaim: raw.cat_Claim,
      tour: raw.tourName,
      hotel: raw.hotelName ?? "",
      hotelExternalId: raw.hotelInc !== undefined ? String(raw.hotelInc) : undefined,
      country: state.name,
      destination: raw.hotelTownName || query.destination,
      departureDate,
      nights: raw.nights ?? query.nightsFrom ?? 7,
      room: raw.roomName,
      meal: raw.mealName,
      adults: raw.adult ?? query.adults ?? 2,
      children: raw.child ?? query.children ?? 0,
      childAges: query.childAges ?? [],
      price: {
        // converted_price is the total in the requested currency (CURRENCY=26 → AZN);
        // plain `price` is in the hotel's own currency (USD/EUR) — verified by
        // constant ratios 1.7055 (USD→AZN) and 1.964 (EUR→AZN).
        // §5.7: missing/non-positive values are filtered upstream (search) and
        // fail closed here — `amount: 0` is never a valid price.
        amount,
        currency: "AZN",
        fetchedAt: now,
        expiresAt: new Date(now.getTime() + 5 * 60 * 1000),
        queryHash: "",
        source: this.code,
      },
      availability: this.availabilityOf(raw),
      transport: raw.programTypeName,
      fetchedAt: now,
      expiresAt: new Date(now.getTime() + 5 * 60 * 1000),
      rawMetadata: {
        catClaim: raw.cat_Claim,
        hotelInc: raw.hotelInc,
        townInc: raw.townInc,
        townFrom: TOWNFROM,
        stateInc: String(state.id),
        starInc: raw.starInc,
        starName: raw.starName,
        groupStarInc: raw.groupStarInc,
        groupStarName: raw.groupStarName,
        mealInc: raw.mealInc,
        mealName: raw.mealName,
        roomInc: raw.roomInc,
        roomName: raw.roomName,
        tourInc: raw.tourInc,
        tourName: raw.tourName,
        priceLocal: raw.price,
        convertedPrice: raw.converted_price,
        www: raw.www,
        slug: raw.slug,
      },
    };
  }
}
