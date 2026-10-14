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
import {
  KompasSupplierAdapter,
  type KompasHotelRawRow,
} from "./kompas.adapter";
import { KompasCaptchaRequiredException } from "./kompas-captcha.exception";
import {
  KOMPAS_HOTEL_STATEINC_TO_ISO,
  resolveHotelStateInc,
  hotelStateIncToIso,
  hotelStateIncToRu,
} from "./kompas-hotel-countries";
// Shared pure name-match helpers (same channel the ANEX hotel adapter uses).
import { normName } from "../anex/anex.provider";
import { translitKey } from "../anex/anex-hotel.adapter";

/** Stay-nights bounds for a KOMPAS hotel search (soft clamp, not a hard reject). */
const HOTEL_NIGHTS_MIN = 1;
const HOTEL_NIGHTS_MAX = 30;
/** Search results cached for a re-check (matches the tour adapter's 5 min). */
const HOTEL_TTL_MS = 5 * 60 * 1000;
/** Max days per price-calendar PRICES request (mirrors the tour adapter). */
const HOTEL_CALENDAR_WINDOW_DAYS = 31;

/** YYYYMMDD (SAMO) → ISO YYYY-MM-DD. */
function compactToIso(compact: string): string {
  const m = /^(\d{4})(\d{2})(\d{2})$/.exec(compact || "");
  return m ? `${m[1]}-${m[2]}-${m[3]}` : compact;
}

/** Today in SAMO compact form (YYYYMMDD). */
function todayCompact(): string {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * KOMPAS HOTEL category adapter — stay-only search via the SAMO `search_hotel`.
 *
 * Mirrors `AnexHotelAdapter` (the provider's own hotels integration) but drives
 * the KOMPAS Playwright machinery: the tour adapter's `searchHotelRows()` opens
 * an anonymous `samo` session on `/search_hotel`, captures the raw PRICES
 * response, and parses the `tr.price_info` rows (identical structure to the tour
 * search). No departure city, TOURINC=0 (stay-only).
 *
 * Registered under code KOMPAS / service "hotels" (alongside the tour adapter).
 * Prices are returned in the supplier's own currency (USD — data-currency_title)
 * and converted to AZN downstream by SupplierPricingService through the KOMPAS
 * SupplierFxRate, exactly like the tour offers.
 */
@Injectable()
export class KompasHotelAdapter implements SupplierAdapter {
  readonly code = "KOMPAS";
  readonly name = "Kompas (kompastour.com) hotels";
  readonly enabled = true;

  private readonly logger = new Logger(KompasHotelAdapter.name);

  constructor(private readonly tours: KompasSupplierAdapter) {}

  // ── SupplierAdapter: search ───────────────────────────────────────────

  async search(query: SupplierSearchQuery): Promise<SupplierOffer[]> {
    const start = Date.now();
    const stateInc = resolveHotelStateInc(query.country ?? query.destination);
    if (!stateInc) {
      this.logger.warn(
        `KOMPAS hotels: country "${query.country ?? query.destination}" not in the hotel dictionary (${Object.keys(
          KOMPAS_HOTEL_STATEINC_TO_ISO,
        ).length} countries)`,
      );
      return [];
    }

    const checkInBeg = (query.departureDateFrom ?? todayCompact()).replace(/-/g, "").slice(0, 8);
    const checkInEnd = (query.departureDateTo ?? query.departureDateFrom ?? todayCompact())
      .replace(/-/g, "")
      .slice(0, 8);
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

    const rows = await this.tours.searchHotelRows({
      stateInc,
      checkInBeg,
      checkInEnd,
      nightsFrom,
      nightsTo,
      adults,
      children,
      childAges: query.childAges,
      hotelExternalId: query.hotelExternalId?.trim() || undefined,
      towns: query.towns,
    });

    // Occupancy must match the request (rows carry adult-/child- class tokens).
    let filtered = rows.filter(
      (r) =>
        (r.adults === 0 || r.adults === adults) &&
        (r.children === 0 || r.children === children),
    );
    const droppedOccupancy = rows.length - filtered.length;

    filtered = this.applyLocalFilters(filtered, query, stateInc);

    // §5.7: rows without a positive supplier price are dropped before
    // normalization — `amount: 0` must never be synthesized as a valid price.
    const pricedRows = filtered.filter((r) => this.rowPrice(r) !== null);
    const offers = pricedRows.map((r) => this.normalize(r, query, stateInc));
    this.logger.log(
      `KOMPAS hotels STATEINC=${stateInc} ${checkInBeg}..${checkInEnd} ${nightsFrom}-${nightsTo}n: ` +
        `${rows.length} rows → ${offers.length} offers in ${Date.now() - start}ms` +
        (droppedOccupancy > 0 ? ` (${droppedOccupancy} occupancy dropped)` : ""),
    );
    return offers;
  }

  /** Positive supplier price for a row, or null when absent/non-positive (§5.7). */
  private rowPrice(row: KompasHotelRawRow): number | null {
    return typeof row.price === "number" && Number.isFinite(row.price) && row.price > 0
      ? row.price
      : null;
  }

  /**
   * Local post-filters: city (three channels, in precedence order) and hotel
   * (id or name). KOMPAS hotel rows carry the city in the `.link-hotel` suffix
   * («(Бодрум)») and the hotel name from the link.
   *
   * City channels:
   *  1. `towns` ids → already applied UPSTREAM by the PRICES URL
   *     (TOWNS=<ids>&TOWNS_ANY=0, verified probe) — a local filter would only
   *     false-drop rows (aggregated group labels like «Аджария» are not row
   *     cities), so it is skipped here;
   *  2. `townNames` (entity names + supplier TOWN labels) — the name channel,
   *     same norm+translit match the ANEX hotel adapter uses;
   *  3. free-text `destination` — form display name; skipped when it is the
   *     COUNTRY name/ISO (country-level search: comparing «Грузия» against row
   *     cities drops every row — observed 100 rows → 0 offers for GE).
   */
  private applyLocalFilters(
    rows: KompasHotelRawRow[],
    query: SupplierSearchQuery,
    stateInc: string,
  ): KompasHotelRawRow[] {
    let out = rows;

    if (!query.hotelExternalId) {
      const towns = query.towns?.replace(/\s+/g, "");
      if (towns) {
        // Upstream TOWNS filter already narrowed the rows — nothing to do.
      } else if (query.townNames?.length) {
        const keys = new Set<string>();
        for (const n of query.townNames) {
          const a = normName(n);
          if (a) keys.add(a);
          const b = translitKey(n);
          if (b) keys.add(b);
        }
        if (keys.size > 0) {
          out = out.filter((r) => {
            const c = r.city ?? "";
            if (!c) return true; // no city on the row — cannot disprove, keep
            const a = normName(c);
            if (a && keys.has(a)) return true;
            const b = translitKey(c);
            if (b && keys.has(b)) return true;
            return false;
          });
        }
      } else {
        const dest = query.destination?.trim().toLowerCase().replace(/ё/g, "е");
        if (dest) {
          const countryRu = (hotelStateIncToRu(stateInc) ?? "").toLowerCase().replace(/ё/g, "е");
          const iso2 = (hotelStateIncToIso(stateInc) ?? "").toLowerCase();
          const countryParam = (query.country ?? "").trim().toLowerCase();
          const countryLevel = dest === countryRu || dest === iso2 || dest === countryParam;
          if (!countryLevel) {
            out = out.filter((r) => {
              const c = r.city?.trim().toLowerCase().replace(/ё/g, "е");
              if (!c) return true; // no city on the row — cannot filter, keep
              return c === dest || c.includes(dest) || dest.includes(c);
            });
          }
        }
      }
    }

    if (query.hotelExternalId) {
      const id = query.hotelExternalId.trim();
      // Upstream HOTELS=<id> already narrowed the request; rows with a
      // non-dictionary key (dynamic/DOLOAD: synthetic negative or sentinel)
      // can never equal the id and must not be false-dropped.
      out = out.filter(
        (r) => !r.hotelKey || r.hotelKey.startsWith("-") || r.hotelKey === id,
      );
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
    priceUnavailable(`KOMPAS-HOTEL offer ${ref.externalOfferId} not found for the original search context`);
  }

  async refreshPrice(ref: SupplierOfferRef): Promise<SupplierPriceSnapshot> {
    const offers = await this.search({ ...ref.searchContext, adults: ref.searchContext.adults ?? 2 });
    const m = offers.find((o) => o.externalOfferId === ref.externalOfferId);
    if (!m) priceUnavailable(`KOMPAS-HOTEL offer ${ref.externalOfferId} no longer in search results`);
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
   * Hotels price calendar — REAL data from the KOMPAS `search_hotel` PRICES
   * feed. Mirrors `KompasSupplierAdapter.getPriceCalendar`: the range is split
   * into 31-day windows (one PRICES request each — verified: a 32-day range
   * over one hotel returns every check-in date in a single pull), offers are
   * deduplicated and grouped by check-in date, and every date of the range gets
   * an entry (missing dates carry an §10 absence, never a fabricated price).
   *
   * `country` (not `destination`) selects the STATEINC: a hotel PDP carries the
   * CITY in `destination`, and the hotel dictionary only resolves countries.
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
      this.logger.warn(
        `KOMPAS hotels calendar: country "${country}" not in the hotel dictionary`,
      );
      return base();
    }

    const collected: SupplierOffer[] = [];
    for (const w of this.calendarWindows(query.dateFrom, query.dateTo)) {
      try {
        const offers = await this.search({
          service: "hotels",
          country,
          // `destination` may hold the city — harmless here, the hotel-id local
          // filter short-circuits the city filter inside applyLocalFilters().
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
        if (err instanceof KompasCaptchaRequiredException) throw err;
        this.logger.warn(
          `KOMPAS hotels calendar window ${w.from}→${w.to} failed: ${(err as Error).message}`,
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
    // Guard against a malformed range (end < start) — one entry, no infinite loop.
    for (let guard = 0; cur <= end && guard < 400; guard++) {
      resultDates.push(cur.toISOString().slice(0, 10));
      cur.setUTCDate(cur.getUTCDate() + 1);
    }

    for (const date of resultDates) {
      const dayOffers = (byDate.get(date) ?? []).sort(
        (a, b) => a.price.amount - b.price.amount,
      );
      if (dayOffers.length === 0) {
        result.entries.push({
          date,
          price: null,
          currency: null,
          availability: "NOT_AVAILABLE",
          offerCount: 0,
          absenceCode: "SUPPLIER_NO_RESULT",
          absenceText: "Цена не получена — KOMPAS не предоставил предложение на эту дату",
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
          // Stay-only: no TOURINC program — an empty string keeps the shared
          // PriceCalendarEntryOffer shape (createTourRequest drops it via ||).
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
      `KOMPAS hotels calendar ${query.dateFrom}..${query.dateTo} ` +
        `STATEINC=${stateInc} hotel=${query.hotelExternalId ?? query.hotel ?? "*"}: ` +
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
      // Advance past the WINDOW END (the end may sit in a later month), and do
      // it on a COPY: `cursor.setUTCDate(capped.getUTCDate() + 1)` writes the
      // end's day-of-month back into the cursor's own month, so a cross-month
      // cap regresses the cursor (verified: 19 Oct..08 Nov yielded an endless
      // 09 Oct..08 Nov loop — 40 identical 36 s searches, 24 min total).
      const next = new Date(capped);
      next.setUTCDate(next.getUTCDate() + 1);
      cursor.setTime(next.getTime());
    }
    return windows;
  }

  /** Identical to the tour adapter's calendar dedupe (identity + keep-max). */
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

  // ── Normalization (hotel-specific mapping) ────────────────────────────

  private offerIdOf(row: KompasHotelRawRow): string {
    // Positive keys are real dictionary ids (inline PRICES rows) — stable
    // across sessions. Dynamic (DOLOAD) rows carry synthetic negatives or
    // INT_MIN sentinels (roomKey/mealKey = -2147483647): identity then falls
    // back to content tokens, because the variant lives in the room/meal TEXT
    // («…No Balcony, 2 Twin Beds…» vs «…No Balcony, 1 Queen Bed…»). Without
    // the fallback every dynamic row dedupes to one id (verified: BG Bansko).
    const dictKey = (v: string | undefined): string =>
      v && /^\d+$/.test(v) ? v : "";
    const hotel = dictKey(row.hotelKey) || this.idToken(row.hotelName);
    const room = dictKey(row.roomKey) || this.idToken(row.room);
    const meal = dictKey(row.mealKey) || this.idToken(row.meal);
    return [
      "KOMPASHTL",
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

  private availabilityOf(_row: KompasHotelRawRow): SupplierAvailability {
    // KOMPAS hotel rows expose no reliable seat/stop markers we parse yet —
    // UNKNOWN is the honest state (never fabricate availability).
    return "UNKNOWN";
  }

  private normalize(row: KompasHotelRawRow, query: SupplierSearchQuery, stateInc: string): SupplierOffer {
    const now = new Date();
    const amount = this.rowPrice(row);
    if (amount === null) {
      priceUnavailable(`KOMPAS-HOTEL search offer ${this.offerIdOf(row)} has no valid supplier price`);
    }
    const iso2 = hotelStateIncToIso(stateInc);
    return {
      supplierCode: this.code,
      service: "hotels",
      externalOfferId: this.offerIdOf(row),
      externalClaim: row.spoKey,
      hotel: row.hotelName ?? "",
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
        // data-converted-price-number is the visible supplier price; the
        // currency (data-currency_title, usually USD) is converted to AZN
        // downstream by SupplierPricingService via the KOMPAS SupplierFxRate.
        amount,
        currency: row.currency || "USD",
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
        checkOut: "", // derived downstream when needed
        city: row.city,
        hotelHref: row.hotelHref,
        meal: row.meal,
        room: row.room,
        priceCurrency: row.currency,
      },
    };
  }
}
