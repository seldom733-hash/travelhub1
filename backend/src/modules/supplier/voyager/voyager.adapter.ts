import { Injectable, Logger } from "@nestjs/common";
import {
  VoyagerHttpService,
  type VoyagerState,
} from "./voyager-http.service";
import {
  VOYAGER_COUNTRY_ALIASES,
  VOYAGER_ISO_CODES,
  VOYAGER_MEALS_KEY,
  VOYAGER_STATE_NAMES,
  VOYAGER_STARS_KEY,
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
 * Voyager adapter (online.voyagergroup.az) — SAMO platform like KazUnion,
 * served over plain HTTP (verified live 2026-10-21: no browser, no captcha).
 *
 * Key engine difference vs KazUnion: TOURINC=0 (or absent) makes the engine
 * fan out ALL programs of a country in ONE PRICES request (verified: ОАЭ без
 * TOURINC вернули две программы одной страницей) — the adapter does NOT loop
 * programs per search. Currency: CURRENCY=2 (USD) is the only code the
 * supplier prices in; AZN is computed on our side via SupplierFxRateService.
 */

function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDays(iso: string, days: number): string {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return toIsoDate(d);
}

/**
 * Voyager TOURS accepts a check-in range of at most 16 dates (verified live
 * 2026-10-22: BEG→BEG+15d serves 291 rows, BEG+16d answers the «temporarily
 * unavailable» modal). Wider ranges are chunked into windows of this size.
 * (The HOTEL form has a similar bound — see HOTEL_SEARCH_WINDOW_DAYS.)
 */
const TOUR_MAX_DATE_WINDOW_DAYS = 14;

function generateWindows(from: string, to: string, sizeDays = TOUR_MAX_DATE_WINDOW_DAYS): Array<{ from: string; to: string }> {
  const windows: Array<{ from: string; to: string }> = [];
  const current = new Date(from);
  const end = new Date(to);
  while (current <= end) {
    const windowEnd = new Date(current);
    windowEnd.setDate(windowEnd.getDate() + sizeDays);
    if (windowEnd > end) windowEnd.setTime(end.getTime());
    windows.push({ from: toIsoDate(current), to: toIsoDate(windowEnd) });
    current.setTime(windowEnd.getTime());
    current.setDate(current.getDate() + 1);
  }
  return windows;
}

/** Voyager-specific search extensions (SupplierAdapter contract stays generic). */
export interface VoyagerSearchQuery extends SupplierSearchQuery {
  /** Max PRICES pages per request (100 rows/page). Default 5 for UI. */
  maxPages?: number;
}

@Injectable()
export class VoyagerAdapter implements SupplierAdapter {
  readonly code = "VOYAGER";
  readonly name = "Voyager (online.voyagergroup.az)";
  readonly enabled = true;

  private readonly logger = new Logger(VoyagerAdapter.name);

  constructor(private readonly http: VoyagerHttpService) {}

  // ── Resolution helpers ────────────────────────────────────────────────

  /**
   * Country → STATEINC: ISO-2 / ru / en aliases (static, verified dictionary).
   * Unknown input → undefined (caller logs and skips the supplier honestly).
   */
  private resolveStateInc(query: SupplierSearchQuery): VoyagerState | undefined {
    const raw = query.country ?? query.destination;
    if (!raw) return undefined;
    const byAlias = VOYAGER_COUNTRY_ALIASES[raw.trim().toLowerCase()];
    if (byAlias) {
      return { value: byAlias, name: VOYAGER_STATE_NAMES[byAlias] ?? raw.trim() };
    }
    return undefined;
  }

  /** Supplier-neutral stars ("5*" / 5) → Voyager STARS id. */
  private resolveStarsKey(query: VoyagerSearchQuery): string | undefined {
    // Supplier-native ids resolved by the aggregator win.
    const native = query.starKeys?.[this.code];
    if (native) return native.replace(/\s+/g, "").split(",")[0];

    for (const label of query.hotelStars ?? []) {
      const t = label.trim();
      if (/^\d+$/.test(t)) return VOYAGER_STARS_KEY[parseInt(t, 10)];
      const m = t.match(/^(\d)\s*\*?$/);
      if (m) return VOYAGER_STARS_KEY[parseInt(m[1], 10)];
      // "HV-1", "Бутик", "SPECIAL" — no Voyager equivalent (verified dict):
      // skip the filter instead of silently widening the answer? No: an
      // unmatched label must NOT be sent as a wrong id; treat as "any".
      this.logger.warn(`Voyager: star label "${label}" has no STARS id — no star filter`);
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
    this.logger.warn(`Voyager: meal "${meal}" not in dictionary — no meal filter`);
    return undefined;
  }

  // ── SupplierAdapter ───────────────────────────────────────────────────

  async search(query: VoyagerSearchQuery): Promise<SupplierOffer[]> {
    const start = Date.now();
    const state = this.resolveStateInc(query);
    if (!state) {
      this.logger.warn(
        `Voyager: UNSUPPORTED country "${query.country ?? query.destination ?? "?"}" ` +
          `(serves: ${VOYAGER_ISO_CODES.join(", ")}) — skipping supplier`,
      );
      return [];
    }

    const dict = await this.http.fetchDictionary(state.value);
    const starsKey = this.resolveStarsKey(query);
    const mealKey = this.resolveMealKey(query.meal, dict.meals);

    const dateFrom = query.departureDateFrom ?? toIsoDate(new Date());
    const dateTo = query.departureDateTo
      ? query.departureDateTo < dateFrom ? dateFrom : query.departureDateTo
      : addDays(dateFrom, 7);
    const nightsFrom = query.nightsFrom ?? 3;
    const nightsTill = query.nightsTo ?? (query.nightsFrom !== undefined ? query.nightsFrom : 14);

    // TOURINC stays "0" (engine fan-out); only an explicit program pins it.
    // The check-in range is chunked: the tour form answers the «temporarily
    // unavailable» modal for ranges wider than 16 dates (verified live).
    const rows: VoyagerOfferRow[] = [];
    for (const window of generateWindows(dateFrom, dateTo)) {
      rows.push(
        ...(await this.http.fetchPrices(
          {
            stateInc: state.value,
            tourInc: query.tourIncValue,
            checkInBeg: window.from,
            checkInEnd: window.to,
            nightsFrom,
            nightsTill,
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

    const offers = this.normalizeRows(rows, query, state);
    this.logger.log(
      `Voyager ${state.name} ${dateFrom}→${dateTo} ${nightsFrom}-${nightsTill}n: ` +
        `${offers.length} offers in ${Date.now() - start}ms`,
    );
    return offers;
  }

  async getOffer(ref: SupplierOfferRef): Promise<SupplierOfferDetail> {
    const offers = await this.search({ ...ref.searchContext, adults: ref.searchContext.adults ?? 2 });
    const m = offers.find((o) => o.externalOfferId === ref.externalOfferId);
    if (!m) {
      priceUnavailable(`VOYAGER offer ${ref.externalOfferId} not found for the original search context`);
    }
    return { ...m };
  }

  async refreshPrice(ref: SupplierOfferRef): Promise<SupplierPriceSnapshot> {
    const offers = await this.search({ ...ref.searchContext, adults: ref.searchContext.adults ?? 2 });
    const m = offers.find((o) => o.externalOfferId === ref.externalOfferId);
    if (!m) {
      priceUnavailable(`VOYAGER offer ${ref.externalOfferId} no longer in search results`);
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

  /**
   * Price calendar over a date range: one PRICES fan-out per 30-day window
   * (no program loop — the engine serves every program of the country at
   * once), entries grouped by departure date, offers sorted by price.
   */
  async getPriceCalendar(query: PriceCalendarQuery): Promise<PriceCalendarResult> {
    const now = new Date();
    const state = this.resolveStateInc({ adults: query.adults, country: query.country ?? query.destination });
    if (!state) {
      this.logger.warn(`Voyager calendar: UNSUPPORTED country "${query.country ?? query.destination ?? "?"}"`);
      return {
        supplierCode: this.code,
        contextHash: JSON.stringify({ country: query.country ?? query.destination, nights: query.nights }),
        entries: [],
        dateFrom: query.dateFrom,
        dateTo: query.dateTo,
        fetchedAt: now,
        expiresAt: new Date(now.getTime() + 5 * 60 * 1000),
        totalOffersScanned: 0,
      };
    }

    const collected: VoyagerOfferRow[] = [];
    const windows = generateWindows(query.dateFrom, query.dateTo);
    for (const window of windows) {
      try {
        const rows = await this.http.fetchPrices({
          stateInc: state.value,
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
          `Voyager calendar window ${window.from}→${window.to}: ${(err as Error).message}`,
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
        externalOfferId: this.offerId(r),
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
        availability: (r.stopSale
          ? "NOT_AVAILABLE"
          : r.seatsAvailable
            ? "AVAILABLE"
            : "UNKNOWN") as SupplierAvailability,
        price: r.price,
        currency: r.currency,
        transport: r.transport || undefined,
      }));
      entries.push({
        date,
        price: best.price,
        currency: best.currency,
        availability: (best.stopSale
          ? "NOT_AVAILABLE"
          : best.seatsAvailable
            ? "AVAILABLE"
            : "UNKNOWN") as SupplierAvailability,
        offerCount: rows.length,
        offers,
        bestOfferRef: {
          supplierCode: this.code,
          externalOfferId: this.offerId(best),
          externalClaim: best.claim || undefined,
          searchContext: {
            service: "tours",
            country: state.name,
            adults: query.adults ?? 2,
            children: query.children,
            childAges: query.childAges,
            departureDateFrom: date,
            departureDateTo: date,
            nightsFrom: query.nights,
            nightsTo: query.nights,
          },
        },
      });
    }

    return {
      supplierCode: this.code,
      contextHash: JSON.stringify({
        country: query.country ?? query.destination,
        hotel: query.hotel,
        adults: query.adults,
        children: query.children,
        nights: query.nights,
      }),
      entries,
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
      fetchedAt: now,
      expiresAt: new Date(now.getTime() + 5 * 60 * 1000),
      totalOffersScanned: collected.length,
    };
  }

  /**
   * Discover Voyager geo options for a country: TOWNS + STAR + HOTEL
   * (dictionary served over plain HTTP, no browser needed).
   */
  async discoverGeoOptions(countryExternalId?: string): Promise<SupplierGeoOption[]> {
    const stateInc = countryExternalId ?? "13"; // 13 = ОАЭ (verified)
    const dict = await this.http.fetchDictionary(stateInc);
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

  private offerId(raw: VoyagerOfferRow): string {
    return `${raw.spoKey}-${raw.hotelKey}-${raw.checkIn}-${raw.roomKey}-${raw.mealKey}`;
  }

  private normalizeRows(
    rows: VoyagerOfferRow[],
    query: VoyagerSearchQuery,
    state: VoyagerState,
  ): SupplierOffer[] {
    const now = new Date();
    const seen = new Set<string>();
    const out: SupplierOffer[] = [];

    for (const raw of rows) {
      if (!raw.hotel) continue;
      const departureDate = this.parseDepartureDate(raw);
      if (!departureDate) continue;

      // City filter (TOWNS) applies server-side; destination-name fallback
      // for the row's own town suffix is not needed (engine already filtered).
      const id = this.offerId(raw);
      const dedupKey = `${id}|${raw.claim ?? ""}`;
      if (seen.has(dedupKey)) continue;
      seen.add(dedupKey);

      out.push({
        supplierCode: this.code,
        externalOfferId: id,
        externalClaim: raw.claim || undefined,
        tour: raw.tourKey || undefined,
        hotel: raw.hotel,
        hotelExternalId: raw.hotelKey || undefined,
        country: state.name,
        destination: query.destination,
        departureDate,
        nights: raw.nights,
        room: raw.roomText || raw.roomKey || undefined,
        meal: raw.mealText || undefined,
        adults: raw.adults || query.adults || 2,
        children: raw.children || query.children || 0,
        childAges: query.childAges ?? [],
        price: {
          amount: raw.price,
          currency: raw.currency,
          fetchedAt: now,
          expiresAt: new Date(now.getTime() + 5 * 60 * 1000),
          queryHash: "",
          source: this.code,
        },
        // Honest availability: stop-sale → NOT_AVAILABLE, seat markers →
        // AVAILABLE, otherwise UNKNOWN (never fake AVAILABLE).
        availability: (raw.stopSale
          ? "NOT_AVAILABLE"
          : raw.seatsAvailable
            ? "AVAILABLE"
            : "UNKNOWN") as SupplierAvailability,
        transport: raw.transport || undefined,
        fetchedAt: now,
        expiresAt: new Date(now.getTime() + 5 * 60 * 1000),
        rawMetadata: {
          spoKey: raw.spoKey,
          hotelKey: raw.hotelKey,
          tourKey: raw.tourKey,
          tourText: raw.tourText,
          mealKey: raw.mealKey,
          roomKey: raw.roomKey,
          roomText: raw.roomText,
          mealText: raw.mealText,
          catClaim: raw.claim,
          stateInc: state.value,
          country: state.name,
          // Город отеля (суффикс «(Город)» в названии) — нужен реестру отелей
          // (catalog."Hotel"): без него карточка не привязывается к фото.
          hotelCity: raw.hotelCity,
          seatsAvailable: raw.seatsAvailable,
          stopSale: raw.stopSale,
        },
      });
    }

    return out;
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
