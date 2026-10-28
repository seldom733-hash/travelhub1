import { Injectable, Logger } from "@nestjs/common";
import {
  VoyagerHttpService,
  type VoyagerState,
} from "./voyager-http.service";
import {
  VOYAGER_HOTEL_STATEINC_BY_ISO,
  VOYAGER_HOTEL_COUNTRY_ALIASES,
  VOYAGER_HOTEL_STATE_NAMES,
  VOYAGER_STARS_KEY,
  VOYAGER_MEALS_KEY,
} from "./voyager-countries";
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
  PriceCalendarEntryOffer,
  PriceCalendarResult,
  SupplierGeoOption,
} from "../supplier.types";
import { priceUnavailable } from "../supplier.types";
import type { VoyagerOfferRow } from "./voyager.response-parser";

/**
 * Voyager HOTEL category adapter — stay-only search via the SAMO
 * `search_hotel` endpoint (verified live 2026-10-22 with the owner's own
 * request example: STATEINC=33/MY + TOURINC=641, plain HTTP GET, no captcha).
 *
 * §2 Provider → Category-Adapter: a SEPARATE adapter from `VoyagerAdapter`
 * (tours). Both share `VoyagerHttpService`, but the stay form is a different
 * upstream product:
 *  • no departure city (TOWNFROMINC does not exist on the stay form);
 *  • a SEPARATE country dictionary — 16 states (vs 10 on the tour form):
 *    + AZ, GE, ID, KG, MU, UZ (verified live from the form select);
 *  • TOURINC holds hotel programs («Малайзия. Только проживание»), "0" = the
 *    engine fans out every program of the country (verified live).
 *  • NIGHTS_FROM/TILL options 1..30 (verified live).
 *
 * Currency: CURRENCY=2 (USD) is the only code Voyager prices in; AZN is
 * computed on our side via SupplierFxRateService (§FX — never invented).
 */

/** Stay-nights bounds of the stay form (soft clamp, verified options 1..30). */
const HOTEL_NIGHTS_MIN = 1;
const HOTEL_NIGHTS_MAX = 30;
/** Offer cache TTL (hotel prices move slower than tour packages). */
const HOTEL_TTL_MS = 5 * 60 * 1000;
/** Price-calendar window: one PRICES request per 30 days. */
const HOTEL_CALENDAR_WINDOW_DAYS = 30;
/**
 * Диапазон заезда в одном PRICES-запросе отелей.
 *
 * Движок отвечает модалкой «Поиск по выбранному направлению временно недоступен»,
 * когда объём выборки велик: диапазон дат × диапазон ночей. Проверено live
 * 2026-10-22 (AE): 30 дат + ночи 3..14 → 0 офферов (модалка), те же 30 дат +
 * одна ночь → 453 оффера, 15 дат + ночи 3..14 → 374 оффера. Поэтому широкий
 * диапазон дат режется на окна по 15 дней (как в туровом адаптере).
 */
const HOTEL_SEARCH_WINDOW_DAYS = 15;

function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Voyager-specific hotel search extensions (contract stays generic). */
export interface VoyagerHotelSearchQuery extends SupplierSearchQuery {
  /** Max PRICES pages per request (100 rows/page). Default 5 for UI. */
  maxPages?: number;
}

/** Parse trailing «5*» of a hotel name (card enrichment; never a filter). */
export function parseHotelStars(name: string): number | null {
  const m = name.match(/(\d)\s*\*\s*$/);
  return m ? parseInt(m[1], 10) : null;
}

@Injectable()
export class VoyagerHotelAdapter implements SupplierAdapter {
  readonly code = "VOYAGER";
  readonly name = "Voyager (online.voyagergroup.az) hotels";
  readonly enabled = true;

  private readonly logger = new Logger(VoyagerHotelAdapter.name);

  constructor(private readonly http: VoyagerHttpService) {}

  // ── Resolution helpers ────────────────────────────────────────────────

  /**
   * Country → STATEINC of the STAY form: ISO-2 / ru / en aliases (verified
   * 16-state dictionary). Unknown input → undefined (skip honestly).
   */
  private resolveStateInc(query: SupplierSearchQuery): VoyagerState | undefined {
    const raw = query.country ?? query.destination;
    if (!raw) return undefined;
    const byAlias = VOYAGER_HOTEL_COUNTRY_ALIASES[raw.trim().toLowerCase()];
    if (byAlias) {
      return {
        value: byAlias,
        name: VOYAGER_HOTEL_STATE_NAMES[byAlias] ?? raw.trim(),
      };
    }
    return undefined;
  }

  /** Supplier-neutral stars ("5*" / 5) → Voyager STARS id. */
  private resolveStarsKey(query: VoyagerHotelSearchQuery): string | undefined {
    const native = query.starKeys?.[this.code];
    if (native) return native.replace(/\s+/g, "").split(",")[0];

    for (const label of query.hotelStars ?? []) {
      const t = label.trim();
      if (/^\d+$/.test(t)) return VOYAGER_STARS_KEY[parseInt(t, 10)];
      const m = t.match(/^(\d)\s*\*?$/);
      if (m) return VOYAGER_STARS_KEY[parseInt(m[1], 10)];
      // «HV-1», «Бутик», «SPECIAL» — no Voyager equivalent: an unmatched
      // label must NOT be sent as a wrong id; treat as "any".
      this.logger.warn(`Voyager hotels: star label "${label}" has no STARS id — no star filter`);
    }
    return undefined;
  }

  /** Meal code (AI/BB/…) → MEALS id. Unknown → dictionary match → warn. */
  private resolveMealKey(meal: string | undefined, meals: Array<{ value: string; name: string }>): string | undefined {
    if (!meal) return undefined;
    if (/^\d+$/.test(meal)) return meal;
    const wanted = meal.trim().toUpperCase();
    const direct = VOYAGER_MEALS_KEY[wanted];
    if (direct) return direct;
    const hit = meals.find((m) => m.name.trim().toUpperCase() === wanted);
    if (hit) return hit.value;
    this.logger.warn(`Voyager hotels: meal "${meal}" not in dictionary — no meal filter`);
    return undefined;
  }

  // ── SupplierAdapter: search ───────────────────────────────────────────

  async search(query: VoyagerHotelSearchQuery): Promise<SupplierOffer[]> {
    const start = Date.now();
    const state = this.resolveStateInc(query);
    if (!state) {
      this.logger.warn(
        `Voyager hotels: UNSUPPORTED country "${query.country ?? query.destination ?? "?"}" ` +
          `(serves: ${Object.keys(VOYAGER_HOTEL_STATEINC_BY_ISO).join(", ")}) — skipping supplier`,
      );
      return [];
    }

    const dict = await this.http.fetchHotelDictionary(state.value);
    const starsKey = this.resolveStarsKey(query);
    const mealKey = this.resolveMealKey(query.meal, dict.meals);

    const dateFrom = query.departureDateFrom ?? toIsoDate(new Date());
    const dateTo = query.departureDateTo
      ? query.departureDateTo < dateFrom ? dateFrom : query.departureDateTo
      : dateFrom;
    const rawFrom = query.nightsFrom ?? 7;
    const rawTo = query.nightsTo ?? rawFrom;
    // Clamp both bounds to the form's verified options (1..30) and keep
    // the order (lo ≤ hi) regardless of how the bounds were given.
    const clampNight = (v: number) =>
      Math.max(HOTEL_NIGHTS_MIN, Math.min(v, HOTEL_NIGHTS_MAX));
    const nightsFrom = clampNight(Math.min(rawFrom, rawTo));
    const nightsTo = clampNight(Math.max(rawFrom, rawTo));

    const rows: Awaited<ReturnType<VoyagerHttpService["fetchHotelPrices"]>> = [];
    // Диапазон дат режется на окна: широкая выборка (даты × ночи) упирается в
    // модалку поставщика (см. HOTEL_SEARCH_WINDOW_DAYS).
    for (const window of this.searchWindows(dateFrom, dateTo)) {
      rows.push(
        ...(await this.http.fetchHotelPrices(
          {
            stateInc: state.value,
            tourInc: query.tourIncValue,
            checkInBeg: window.from,
            checkInEnd: window.to,
            nightsFrom,
            nightsTill: nightsTo,
            adults: query.adults ?? 2,
            children: query.children,
            childAges: query.childAges,
            starsKey,
            townsCsv: query.towns,
            hotelsCsv: query.hotelExternalId,
            mealKey,
          },
          query.maxPages ?? 5,
        )),
      );
    }

    // Occupancy must match the request (rows carry adult-/child- class tokens).
    let filtered = rows.filter(
      (r) => (r.adults === 0 || r.adults === (query.adults ?? 2)) &&
        (r.children === 0 || r.children === (query.children ?? 0)),
    );
    const droppedOccupancy = rows.length - filtered.length;

    filtered = this.applyLocalFilters(filtered, query);

    // §5.7: rows without a positive supplier price are dropped upstream by
    // the parser — `amount: 0` must never be synthesized as a valid price.
    const offers = this.normalizeRows(filtered, query, state);
    this.logger.log(
      `Voyager hotels ${state.name} ${dateFrom}→${dateTo} ${nightsFrom}-${nightsTo}n: ` +
        `${offers.length} offers in ${Date.now() - start}ms` +
        (droppedOccupancy > 0 ? ` (${droppedOccupancy} occupancy dropped)` : ""),
    );
    return offers;
  }

  /**
   * Local post-filters: hotel name. The id/hotel filters are applied
   * UPSTREAM (HOTELS=<ids>&HOTELS_ANY=0, verified), so a local id filter is
   * only a safety net.
   */
  private applyLocalFilters(
    rows: VoyagerOfferRow[],
    query: VoyagerHotelSearchQuery,
  ): VoyagerOfferRow[] {
    let out = rows;

    if (query.hotelExternalId) {
      const id = query.hotelExternalId.trim();
      out = out.filter((r) => !r.hotelKey || r.hotelKey === id);
    } else if (query.hotel?.trim()) {
      const wanted = query.hotel.trim().toLowerCase();
      out = out.filter((r) => {
        const n = r.hotel?.trim().toLowerCase();
        if (!n) return false;
        if (n === wanted) return true;
        if (n.length >= 4 && wanted.includes(n)) return true;
        if (wanted.length >= 4 && n.includes(wanted)) return true;
        return false;
      });
    }

    return out;
  }

  // ── SupplierAdapter: detail / refresh ─────────────────────────────────

  async getOffer(ref: SupplierOfferRef): Promise<SupplierOfferDetail> {
    const offers = await this.search({ ...ref.searchContext, adults: ref.searchContext.adults ?? 2 });
    const m = offers.find((o) => o.externalOfferId === ref.externalOfferId);
    if (!m) {
      priceUnavailable(`VOYAGER-HOTEL offer ${ref.externalOfferId} not found for the original search context`);
    }
    return { ...m };
  }

  async refreshPrice(ref: SupplierOfferRef): Promise<SupplierPriceSnapshot> {
    const offers = await this.search({ ...ref.searchContext, adults: ref.searchContext.adults ?? 2 });
    const m = offers.find((o) => o.externalOfferId === ref.externalOfferId);
    if (!m) {
      priceUnavailable(`VOYAGER-HOTEL offer ${ref.externalOfferId} no longer in search results`);
    }
    return m.price;
  }

  async refreshAvailability(ref: SupplierOfferRef): Promise<SupplierAvailabilitySnapshot> {
    const offers = await this.search({ ...ref.searchContext, adults: ref.searchContext.adults ?? 2 });
    const m = offers.find((o) => o.externalOfferId === ref.externalOfferId);
    return {
      availability: m ? m.availability : "NOT_AVAILABLE",
      fetchedAt: new Date(),
      expiresAt: new Date(Date.now() + HOTEL_TTL_MS),
    };
  }

  /**
   * Hotels price calendar — REAL data from the `search_hotel` PRICES feed.
   * The range is split into 30-day windows (one PRICES request each); every
   * date of the range gets an entry, missing dates carry an absence, never a
   * fabricated price.
   */
  async getPriceCalendar(query: PriceCalendarQuery): Promise<PriceCalendarResult> {
    const now = new Date();
    const country = query.country ?? query.destination;
    const state = this.resolveStateInc({ adults: query.adults, country });

    const base = (): PriceCalendarResult => ({
      supplierCode: this.code,
      contextHash: JSON.stringify({
        service: "hotels",
        country,
        hotel: query.hotel,
        nights: query.nights,
      }),
      entries: [],
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
      fetchedAt: now,
      expiresAt: new Date(now.getTime() + HOTEL_TTL_MS),
      totalOffersScanned: 0,
    });

    if (!state) {
      this.logger.warn(`Voyager hotels calendar: UNSUPPORTED country "${country ?? "?"}"`);
      return base();
    }

    const collected: VoyagerOfferRow[] = [];
    const windows = this.calendarWindows(query.dateFrom, query.dateTo);
    for (const window of windows) {
      try {
        const rows = await this.http.fetchHotelPrices({
          stateInc: state.value,
          tourInc: query.tourIncValue,
          checkInBeg: window.from,
          checkInEnd: window.to,
          nightsFrom: query.nights,
          nightsTill: query.nights,
          adults: query.adults ?? 2,
          children: query.children,
          childAges: query.childAges,
          hotelsCsv: query.hotelExternalId,
        }, 10);
        collected.push(...rows);
      } catch (err) {
        this.logger.warn(
          `Voyager hotels calendar window ${window.from}→${window.to}: ${(err as Error).message}`,
        );
      }
    }

    // Group by departure date → entries.
    const byDate = new Map<string, VoyagerOfferRow[]>();
    for (const row of collected) {
      const departure = this.parseDepartureDate(row);
      if (!departure) continue;
      const list = byDate.get(departure) ?? [];
      list.push(row);
      byDate.set(departure, list);
    }

    const entries: PriceCalendarEntry[] = [];
    for (const [date, rows] of [...byDate.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
      rows.sort((a, b) => a.price - b.price);
      const best = rows[0];
      const offers: PriceCalendarEntryOffer[] = rows.slice(0, 20).map((r) => ({
        tourIncValue: r.tourKey,
        tourIncName: r.tourText || undefined,
        externalOfferId: this.offerIdOf(r, state.value),
        externalClaim: r.claim || undefined,
        hotel: r.hotel,
        hotelExternalId: r.hotelKey || undefined,
        departureDate: date,
        nights: r.nights,
        room: r.roomText || undefined,
        meal: r.mealText || undefined,
        adults: r.adults || query.adults || 2,
        children: r.children || query.children || 0,
        childAges: query.childAges ?? [],
        availability: this.availabilityOf(r),
        price: r.price,
        currency: r.currency,
      }));

      entries.push({
        date,
        price: best.price,
        currency: best.currency,
        availability: this.availabilityOf(best),
        offerCount: rows.length,
        offers,
        bestOfferRef: {
          supplierCode: this.code,
          externalOfferId: this.offerIdOf(best, state.value),
          externalClaim: best.claim || undefined,
          searchContext: {
            service: "hotels",
            country: state.name,
            destination: query.destination,
            hotel: query.hotel,
            hotelExternalId: query.hotelExternalId,
            room: best.roomText || undefined,
            meal: best.mealText || undefined,
            adults: query.adults,
            children: query.children,
            childAges: query.childAges,
            nightsFrom: query.nights || 7,
            nightsTo: query.nights || 7,
            departureDateFrom: date,
            departureDateTo: date,
          },
        },
      });
    }

    const result = base();
    result.entries = entries.sort((a, b) => a.date.localeCompare(b.date));
    result.totalOffersScanned = collected.length;
    this.logger.log(
      `Voyager hotels calendar ${query.dateFrom}..${query.dateTo} STATEINC=${state.value} ` +
        `hotel=${query.hotelExternalId ?? query.hotel ?? "*"}: ` +
        `${collected.length} scanned → ${entries.length} dated entries`,
    );
    return result;
  }

  /**
   * Окна дат для поиска отелей: не более `HOTEL_SEARCH_WINDOW_DAYS` дат в
   * каждом запросе (движок отвечает модалкой на широкую выборку).
   */
  private searchWindows(from: string, to: string): Array<{ from: string; to: string }> {
    const windows: Array<{ from: string; to: string }> = [];
    const start = new Date(`${from}T00:00:00Z`);
    const end = new Date(`${to}T00:00:00Z`);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return windows;
    const cursor = new Date(start);
    for (let guard = 0; cursor <= end && guard < 40; guard++) {
      const windowEnd = new Date(cursor);
      windowEnd.setUTCDate(windowEnd.getUTCDate() + HOTEL_SEARCH_WINDOW_DAYS - 1);
      const capped = windowEnd > end ? end : windowEnd;
      windows.push({
        from: cursor.toISOString().slice(0, 10),
        to: capped.toISOString().slice(0, 10),
      });
      const next = new Date(capped);
      next.setUTCDate(next.getUTCDate() + 1);
      cursor.setTime(next.getTime());
    }
    return windows;
  }

  /** ISO date windows of at most `HOTEL_CALENDAR_WINDOW_DAYS` days each. */
  private calendarWindows(from: string, to: string): Array<{ from: string; to: string }> {
    const windows: Array<{ from: string; to: string }> = [];
    const start = new Date(`${from}T00:00:00Z`);
    const end = new Date(`${to}T00:00:00Z`);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return windows;
    const cursor = new Date(start);
    for (let guard = 0; cursor <= end && guard < 40; guard++) {
      const windowEnd = new Date(cursor);
      windowEnd.setUTCDate(windowEnd.getUTCDate() + HOTEL_CALENDAR_WINDOW_DAYS - 1);
      const capped = windowEnd > end ? end : windowEnd;
      windows.push({
        from: cursor.toISOString().slice(0, 10),
        to: capped.toISOString().slice(0, 10),
      });
      const next = new Date(capped);
      next.setUTCDate(next.getUTCDate() + 1);
      cursor.setTime(next.getTime());
    }
    return windows;
  }

  /**
   * Discover Voyager HOTEL geo options for a country: TOWNS + STAR + HOTEL
   * from the stay-form dictionary (plain HTTP, no browser).
   */
  async discoverCountries(): Promise<Array<{ countryId: string; countryName: string }>> {
    return (await this.http.discoverHotelStates()).map((state) => ({
      countryId: state.value,
      countryName: state.name,
    }));
  }

  async discoverHotelGeoOptions(countryExternalId?: string): Promise<SupplierGeoOption[]> {
    const stateInc =
      countryExternalId ??
      VOYAGER_HOTEL_STATEINC_BY_ISO[
        Object.keys(VOYAGER_HOTEL_STATEINC_BY_ISO)[0]
      ];
    const dict = await this.http.fetchHotelDictionary(stateInc);
    const out: SupplierGeoOption[] = dict.towns.map((t) => ({
      externalId: t.value,
      label: t.name,
      kind: "TOWN",
      countryExternalId: stateInc,
    }));
    for (const s of dict.stars) {
      out.push({
        externalId: s.value,
        label: s.name,
        kind: "STAR",
        countryExternalId: stateInc,
      });
    }
    for (const h of dict.hotels) {
      out.push({
        externalId: h.id,
        label: h.name,
        kind: "HOTEL",
        countryExternalId: stateInc,
        townKey: h.townKey,
      });
    }
    return out;
  }

  // ── Normalization ─────────────────────────────────────────────────────

  private offerIdOf(raw: VoyagerOfferRow, stateInc: string): string {
    return [
      "VOYAGERHTL",
      stateInc,
      raw.hotelKey || "x",
      raw.spoKey || "x",
      raw.roomKey || "x",
      raw.mealKey || "x",
      raw.checkIn,
      raw.nights,
      raw.adults,
      raw.children,
    ].join("-");
  }

  private normalizeRows(
    rows: VoyagerOfferRow[],
    query: VoyagerHotelSearchQuery,
    state: VoyagerState,
  ): SupplierOffer[] {
    const now = new Date();
    const seen = new Set<string>();
    const out: SupplierOffer[] = [];

    for (const raw of rows) {
      if (!raw.hotel) continue;
      const departureDate = this.parseDepartureDate(raw);
      if (!departureDate) continue;
      if (!(raw.price > 0)) continue;

      const id = this.offerIdOf(raw, state.value);
      if (seen.has(id)) continue;
      seen.add(id);

      out.push({
        supplierCode: this.code,
        service: "hotels",
        externalOfferId: id,
        externalClaim: raw.claim || raw.spoKey || undefined,
        hotel: raw.hotel,
        hotelExternalId: raw.hotelKey || undefined,
        country: state.name,
        destination: raw.hotelCity || query.destination,
        departureDate,
        nights: raw.nights || query.nightsFrom || 7,
        room: raw.roomText || raw.roomKey || undefined,
        meal: raw.mealText || undefined,
        adults: raw.adults || query.adults || 2,
        children: raw.children || query.children || 0,
        childAges: query.childAges ?? [],
        price: {
          amount: raw.price,
          currency: raw.currency,
          fetchedAt: now,
          expiresAt: new Date(now.getTime() + HOTEL_TTL_MS),
          queryHash: "",
          source: this.code,
        },
        availability: this.availabilityOf(raw),
        fetchedAt: now,
        expiresAt: new Date(now.getTime() + HOTEL_TTL_MS),
        rawMetadata: {
          stateInc: state.value,
          country: state.name,
          hotelKey: raw.hotelKey,
          tourKey: raw.tourKey,
          spoKey: raw.spoKey,
          mealKey: raw.mealKey,
          roomKey: raw.roomKey,
          roomText: raw.roomText,
          mealText: raw.mealText,
          city: raw.hotelCity ?? "",
          stars: parseHotelStars(raw.hotel),
          catClaim: raw.claim,
          seatsAvailable: raw.seatsAvailable,
          stopSale: raw.stopSale,
        },
      });
    }

    return out;
  }

  /** Honest availability: stop-sale → NOT_AVAILABLE, otherwise UNKNOWN. */
  private availabilityOf(row: VoyagerOfferRow): SupplierAvailability {
    return (row.stopSale
      ? "NOT_AVAILABLE"
      : row.seatsAvailable
        ? "AVAILABLE"
        : "UNKNOWN") as SupplierAvailability;
  }

  /** "22.10.2026" / "22.10.2026, Ср" → "2026-10-22" (fallback: class checkIn). */
  private parseDepartureDate(raw: VoyagerOfferRow): string {
    const m = raw.departureDateText.match(/(\d{2})\.(\d{2})\.(\d{4})/);
    if (m) return `${m[3]}-${m[2]}-${m[1]}`;
    if (/^\d{8}$/.test(raw.checkIn)) {
      return `${raw.checkIn.slice(0, 4)}-${raw.checkIn.slice(4, 6)}-${raw.checkIn.slice(6, 8)}`;
    }
    return "";
  }
}
