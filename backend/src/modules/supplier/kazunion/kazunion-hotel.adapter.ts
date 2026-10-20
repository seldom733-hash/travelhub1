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
import { priceUnavailable } from "../supplier.types";
import { KazunionHttpService, type KazunionHotelRow } from "./kazunion-http.service";
import {
  KAZUNION_HOTEL_COUNTRIES,
  resolveHotelStateInc,
  hotelStateIncToIso,
  hotelStateIncToRu,
} from "./kazunion-hotel-countries";

/**
 * KazUnion HOTEL category adapter — stay-only search via the SAMO
 * `search_hotel` endpoint.
 *
 * §2 Provider → Category-Adapter: this is a SEPARATE adapter from
 * `KazunionAdapter` (tours). Both share `KazunionHttpService`, but the hotel
 * form is a different upstream product:
 *  • no departure city (TOWNFROMINC does not exist on the hotel form);
 *  • a SEPARATE country dictionary (22 states, see kazunion-hotel-countries);
 *  • TOURINC holds hotel programs ("Грузия. Только Отель"), not tour programs.
 *
 * Verified live 2026-10-19: `search_hotel?samo_action=PRICES` answers a plain
 * GET with the results table inline — no Playwright session is needed (unlike
 * KOMPAS). Captcha is handled by the shared HTTP service; a captcha response
 * throws, so a blocked country is never reported as "0 hotels".
 */

/** Stay-nights bounds of the hotel form (soft clamp, not a hard reject). */
const HOTEL_NIGHTS_MIN = 1;
const HOTEL_NIGHTS_MAX = 30;
/** Offer cache TTL (hotel prices move slower than flights). */
const HOTEL_TTL_MS = 5 * 60 * 1000;
/** Price-calendar window: one PRICES request per 31 days. */
const HOTEL_CALENDAR_WINDOW_DAYS = 31;
/**
 * Live-search page cap.
 *
 * A full PRICEPAGE sweep of one country returns ~3 000 rows (verified AZ:
 * 35 pages) and took 82s — unusable for a user-facing search. Live requests
 * stop after this many pages (~500 rows, ~15s); the CATALOG sync passes its
 * own `maxPages` and still walks every page.
 */
const HOTEL_LIVE_MAX_PAGES = 5;
/** AZN — the currency KazUnion quotes hotel prices in (form value 10). */
const KAZUNION_HOTEL_CURRENCY_INC = "10";

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function compactToIso(compact: string): string {
  if (!/^\d{8}$/.test(compact)) return compact;
  return `${compact.slice(0, 4)}-${compact.slice(4, 6)}-${compact.slice(6, 8)}`;
}

@Injectable()
export class KazunionHotelAdapter implements SupplierAdapter {
  readonly code = "KAZUNION";
  readonly name = "KazUnion (online.kazunion.com) hotels";
  readonly enabled = true;

  private readonly logger = new Logger(KazunionHotelAdapter.name);

  constructor(private readonly http: KazunionHttpService) {}

  // ── SupplierAdapter: search ───────────────────────────────────────────

  async search(query: SupplierSearchQuery): Promise<SupplierOffer[]> {
    const start = Date.now();
    const stateInc = resolveHotelStateInc(query.country ?? query.destination);
    if (!stateInc) {
      this.logger.warn(
        `KazUnion hotels: country "${query.country ?? query.destination}" not in the hotel dictionary ` +
          `(${KAZUNION_HOTEL_COUNTRIES.length} countries)`,
      );
      return [];
    }

    const checkInBeg = (query.departureDateFrom ?? todayIso()).slice(0, 10);
    const checkInEnd = (query.departureDateTo ?? query.departureDateFrom ?? todayIso()).slice(0, 10);
    const nightsFrom = Math.max(
      HOTEL_NIGHTS_MIN,
      Math.min(query.nightsFrom ?? 7, query.nightsTo ?? query.nightsFrom ?? 7),
    );
    const nightsTo = Math.min(
      HOTEL_NIGHTS_MAX,
      Math.max(query.nightsFrom ?? 7, query.nightsTo ?? query.nightsFrom ?? 7),
    );
    const adults = query.adults ?? 2;
    const children = query.children ?? 0;

    const rows = await this.http.fetchHotelPrices({
      stateInc,
      // An explicit hotel program narrows the search; otherwise "0" = any.
      tourInc: query.tourIncValue ?? "0",
      checkInBeg,
      checkInEnd,
      nightsFrom,
      nightsTill: nightsTo,
      adults,
      children,
      childAges: query.childAges,
      currency: KAZUNION_HOTEL_CURRENCY_INC,
      townsCsv: query.towns,
      // A hotel-specific search (calendar/detail) filters UPSTREAM by hotelKey:
      // without it, 5 pages of the whole country would be fetched per window.
      hotelsCsv: /^-?\d+$/.test(query.hotelExternalId ?? "")
        ? query.hotelExternalId
        : undefined,
      // Live search is capped (a full country sweep is ~3 000 rows / 82s);
      // the catalog sync passes an explicit, larger `maxPages`.
      maxPages: (query as { maxPages?: number }).maxPages ?? HOTEL_LIVE_MAX_PAGES,
    });

    // Occupancy must match the request (rows carry adult-/child- class tokens).
    let filtered = rows.filter(
      (r) => (r.adults === 0 || r.adults === adults) && (r.children === 0 || r.children === children),
    );
    const droppedOccupancy = rows.length - filtered.length;

    filtered = this.applyLocalFilters(filtered, query, stateInc);

    // §5.7: rows without a positive supplier price are dropped — `amount: 0`
    // must never be synthesized as a valid price.
    const priced = filtered.filter((r) => r.price > 0 && isFinite(r.price));
    const offers = priced.map((r) => this.normalize(r, query, stateInc));

    this.logger.log(
      `KazUnion hotels STATEINC=${stateInc} ${checkInBeg}..${checkInEnd} ${nightsFrom}-${nightsTo}n: ` +
        `${rows.length} rows → ${offers.length} offers in ${Date.now() - start}ms` +
        (droppedOccupancy > 0 ? ` (${droppedOccupancy} occupancy dropped)` : ""),
    );
    return offers;
  }

  /**
   * Local post-filters: city and hotel name.
   *
   * The `towns` id filter is applied UPSTREAM (TOWNS=<ids>&TOWNS_ANY=0), so a
   * local id filter is skipped — it would only false-drop rows whose city
   * label is an aggregated resort name.
   */
  private applyLocalFilters(
    rows: KazunionHotelRow[],
    query: SupplierSearchQuery,
    stateInc: string,
  ): KazunionHotelRow[] {
    let out = rows;

    if (!query.hotelExternalId) {
      const towns = query.towns?.replace(/\s+/g, "");
      if (!towns) {
        const dest = query.destination?.trim().toLowerCase().replace(/ё/g, "е");
        if (dest) {
          const countryRu = (hotelStateIncToRu(stateInc) ?? "").toLowerCase().replace(/ё/g, "е");
          const iso2 = (hotelStateIncToIso(stateInc) ?? "").toLowerCase();
          const countryParam = (query.country ?? "").trim().toLowerCase();
          const countryLevel = dest === countryRu || dest === iso2 || dest === countryParam;
          if (!countryLevel) {
            out = out.filter((r) => {
              const c = r.city?.trim().toLowerCase().replace(/ё/g, "е");
              if (!c) return true; // no city on the row — cannot disprove, keep
              return c === dest || c.includes(dest) || dest.includes(c);
            });
          }
        }
      }
    }

    if (query.hotelExternalId) {
      const id = query.hotelExternalId.trim();
      out = out.filter((r) => !r.hotelKey || r.hotelKey === id);
    } else if (query.hotel?.trim()) {
      const wanted = query.hotel.trim().toLowerCase();
      out = out.filter((r) => {
        const n = r.hotelName?.trim().toLowerCase();
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
    if (m) return { ...m };
    priceUnavailable(`KAZUNION-HOTEL offer ${ref.externalOfferId} not found for the original search context`);
  }

  async refreshPrice(ref: SupplierOfferRef): Promise<SupplierPriceSnapshot> {
    const offers = await this.search({ ...ref.searchContext, adults: ref.searchContext.adults ?? 2 });
    const m = offers.find((o) => o.externalOfferId === ref.externalOfferId);
    if (!m) priceUnavailable(`KAZUNION-HOTEL offer ${ref.externalOfferId} no longer in search results`);
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
   * The range is split into 31-day windows (one PRICES request each); every
   * date of the range gets an entry, missing dates carry an absence, never a
   * fabricated price.
   */
  async getPriceCalendar(query: PriceCalendarQuery): Promise<PriceCalendarResult> {
    const now = new Date();
    const country = query.country ?? query.destination;
    const stateInc = resolveHotelStateInc(country);

    const base = (): PriceCalendarResult => ({
      supplierCode: this.code,
      contextHash: JSON.stringify({
        category: "hotels",
        stateInc,
        hotelExternalId: query.hotelExternalId,
        hotel: query.hotel,
        adults: query.adults,
        children: query.children,
        childAges: query.childAges,
        nights: query.nights,
      }),
      entries: [],
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
      fetchedAt: now,
      expiresAt: new Date(now.getTime() + HOTEL_TTL_MS),
      totalOffersScanned: 0,
    });

    if (!stateInc) {
      this.logger.warn(`KazUnion hotels calendar: country "${country}" not in the hotel dictionary`);
      return base();
    }

    const collected: SupplierOffer[] = [];
    for (const w of this.calendarWindows(query.dateFrom, query.dateTo)) {
      try {
        const offers = await this.search({
          service: "hotels",
          country,
          destination: query.destination,
          hotel: query.hotel,
          hotelExternalId: query.hotelExternalId,
          room: query.room,
          meal: query.meal,
          adults: query.adults,
          children: query.children,
          childAges: query.childAges,
          nightsFrom: query.nights || 7,
          nightsTo: query.nights || 7,
          departureDateFrom: w.from,
          departureDateTo: w.to,
          towns: (query as PriceCalendarQuery & { towns?: string }).towns,
        });
        collected.push(...offers);
      } catch (err) {
        // CAPTCHA owns its context — never swallow it into an empty calendar.
        if (/captcha|antibot/i.test((err as Error).message)) throw err;
        this.logger.warn(
          `KazUnion hotels calendar window ${w.from}→${w.to} failed: ${(err as Error).message}`,
        );
      }
    }

    const deduped = this.deduplicateCalendarOffers(collected);
    const result = base();
    result.totalOffersScanned = collected.length;

    const byDate = new Map<string, SupplierOffer[]>();
    for (const o of deduped) {
      const list = byDate.get(o.departureDate) ?? [];
      list.push(o);
      byDate.set(o.departureDate, list);
    }

    const resultDates: string[] = [];
    const cur = new Date(`${query.dateFrom}T00:00:00Z`);
    const end = new Date(`${query.dateTo}T00:00:00Z`);
    for (let guard = 0; cur <= end && guard < 400; guard++) {
      resultDates.push(cur.toISOString().slice(0, 10));
      cur.setUTCDate(cur.getUTCDate() + 1);
    }

    for (const date of resultDates) {
      const dayOffers = (byDate.get(date) ?? []).sort((a, b) => a.price.amount - b.price.amount);
      if (dayOffers.length === 0) {
        result.entries.push({
          date,
          price: null,
          currency: null,
          availability: "NOT_AVAILABLE",
          offerCount: 0,
          absenceCode: "SUPPLIER_NO_RESULT",
          absenceText: "Цена не получена — KazUnion не предоставил предложение на эту дату",
        });
        continue;
      }
      const best = dayOffers[0];
      result.entries.push({
        date,
        price: best.price.amount,
        currency: best.price.currency,
        availability: best.availability,
        offerCount: dayOffers.length,
        offers: dayOffers.map((o) => ({
          tourIncValue: "",
          externalOfferId: o.externalOfferId,
          externalClaim: o.externalClaim,
          hotel: o.hotel,
          hotelExternalId: o.hotelExternalId,
          departureDate: o.departureDate,
          nights: o.nights,
          room: o.room,
          meal: o.meal,
          adults: o.adults,
          children: o.children,
          childAges: o.childAges,
          availability: o.availability,
          price: o.price.amount,
          currency: o.price.currency,
        })),
        bestOfferRef: {
          supplierCode: this.code,
          externalOfferId: best.externalOfferId,
          externalClaim: best.externalClaim,
          searchContext: {
            service: "hotels",
            country,
            destination: query.destination,
            hotel: query.hotel,
            hotelExternalId: query.hotelExternalId,
            room: best.room,
            meal: best.meal,
            adults: query.adults,
            children: query.children,
            childAges: query.childAges,
            nightsFrom: query.nights || 7,
            nightsTo: query.nights || 7,
            departureDateFrom: date,
            departureDateTo: date,
            towns: (query as PriceCalendarQuery & { towns?: string }).towns,
          },
        },
      });
    }

    result.entries.sort((a, b) => a.date.localeCompare(b.date));
    this.logger.log(
      `KazUnion hotels calendar ${query.dateFrom}..${query.dateTo} STATEINC=${stateInc} ` +
        `hotel=${query.hotelExternalId ?? query.hotel ?? "*"}: ` +
        `${collected.length} scanned → ${deduped.length} deduped → ${result.entries.length} days`,
    );
    return result;
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

  /** Identical to the KOMPAS hotel calendar dedupe (identity + keep-max). */
  private deduplicateCalendarOffers(offers: SupplierOffer[]): SupplierOffer[] {
    const seen = new Map<string, SupplierOffer>();
    for (const offer of offers) {
      const roomKey = (offer.rawMetadata as Record<string, unknown> | undefined)?.roomKey ?? "";
      const mealKey = (offer.rawMetadata as Record<string, unknown> | undefined)?.mealKey ?? "";
      const key = `${offer.externalOfferId}|${offer.departureDate}|${roomKey}|${mealKey}|${offer.room ?? ""}|${offer.meal ?? ""}`;
      const existing = seen.get(key);
      if (!existing || offer.price.amount > existing.price.amount) seen.set(key, offer);
    }
    return Array.from(seen.values());
  }

  // ── Normalization ─────────────────────────────────────────────────────

  private offerIdOf(row: KazunionHotelRow): string {
    const dictKey = (v: string | undefined): string => (v && /^-?\d+$/.test(v) ? v : "");
    const hotel = dictKey(row.hotelKey) || this.idToken(row.hotelName);
    const room = dictKey(row.roomKey) || this.idToken(row.room);
    const meal = dictKey(row.mealKey) || this.idToken(row.meal);
    return [
      "KAZUNIONHTL",
      row.stateInc,
      hotel,
      row.tourKey,
      row.spoKey,
      room,
      meal,
      row.checkIn,
      row.nights,
      row.adults,
      row.children,
    ].join("-");
  }

  /** ID-safe token from free text (room/meal names when no dictionary key). */
  private idToken(v: string | undefined): string {
    const t = (v ?? "")
      .toLowerCase()
      .replace(/[^a-z0-9а-яё]+/gi, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 96);
    return t || "x";
  }

  private availabilityOf(_row: KazunionHotelRow): SupplierAvailability {
    // KazUnion hotel rows expose no reliable seat/stop markers — UNKNOWN is
    // the honest state (never fabricate availability).
    return "UNKNOWN";
  }

  private normalize(row: KazunionHotelRow, query: SupplierSearchQuery, stateInc: string): SupplierOffer {
    const now = new Date();
    if (!(row.price > 0)) {
      priceUnavailable(`KAZUNION-HOTEL offer ${this.offerIdOf(row)} has no valid supplier price`);
    }
    const iso2 = hotelStateIncToIso(stateInc);
    return {
      supplierCode: this.code,
      service: "hotels",
      externalOfferId: this.offerIdOf(row),
      externalClaim: row.spoKey,
      hotel: row.hotelName,
      hotelExternalId: row.hotelKey || undefined,
      country: iso2 ?? stateInc,
      destination: row.city || query.destination,
      departureDate: compactToIso(row.checkIn),
      nights: row.nights || query.nightsFrom || 7,
      room: row.room || undefined,
      meal: row.meal || undefined,
      adults: row.adults || query.adults || 2,
      children: row.children || query.children || 0,
      childAges: query.childAges ?? [],
      price: {
        amount: row.price,
        currency: row.currency || "AZN",
        fetchedAt: now,
        expiresAt: new Date(now.getTime() + HOTEL_TTL_MS),
        queryHash: "",
        source: this.code,
      },
      availability: this.availabilityOf(row),
      fetchedAt: now,
      expiresAt: new Date(now.getTime() + HOTEL_TTL_MS),
      rawMetadata: {
        stateInc,
        hotelKey: row.hotelKey,
        tourKey: row.tourKey,
        spoKey: row.spoKey,
        mealKey: row.mealKey,
        roomKey: row.roomKey,
        checkIn: row.checkIn,
        checkOut: "",
        city: row.city,
        hotelName: row.hotelName,
        stars: row.stars,
        latitude: row.latitude,
        longitude: row.longitude,
        meal: row.meal,
        room: row.room,
        priceCurrency: row.currency,
      },
    };
  }
}
