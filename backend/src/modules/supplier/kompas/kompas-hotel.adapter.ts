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
import {
  KOMPAS_HOTEL_STATEINC_TO_ISO,
  resolveHotelStateInc,
  hotelStateIncToIso,
} from "./kompas-hotel-countries";

/** Stay-nights bounds for a KOMPAS hotel search (soft clamp, not a hard reject). */
const HOTEL_NIGHTS_MIN = 1;
const HOTEL_NIGHTS_MAX = 30;
/** Search results cached for a re-check (matches the tour adapter's 5 min). */
const HOTEL_TTL_MS = 5 * 60 * 1000;

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
    });

    // Occupancy must match the request (rows carry adult-/child- class tokens).
    let filtered = rows.filter(
      (r) =>
        (r.adults === 0 || r.adults === adults) &&
        (r.children === 0 || r.children === children),
    );
    const droppedOccupancy = rows.length - filtered.length;

    filtered = this.applyLocalFilters(filtered, query);

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
   * Local post-filters: destination (city/town name) and hotel (name), mirroring
   * the tour adapter's local filtering. KOMPAS hotel rows carry the city in the
   * `.link-hotel` suffix («(Бодрум)») and the hotel name from the link.
   */
  private applyLocalFilters(rows: KompasHotelRawRow[], query: SupplierSearchQuery): KompasHotelRawRow[] {
    let out = rows;

    const dest = query.destination?.trim().toLowerCase().replace(/ё/g, "е");
    if (dest && !query.hotelExternalId) {
      out = out.filter((r) => {
        const c = r.city?.trim().toLowerCase().replace(/ё/g, "е");
        if (!c) return true; // no city on the row — cannot filter, keep
        return c === dest || c.includes(dest) || dest.includes(c);
      });
    }

    if (query.hotelExternalId) {
      const id = query.hotelExternalId.trim();
      out = out.filter((r) => r.hotelKey === id);
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
   * Hotels price calendar is not implemented for KOMPAS — an honest empty
   * result (no fabricated min/max prices), same as the ANEX hotel adapter.
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
      expiresAt: new Date(now.getTime() + HOTEL_TTL_MS),
      totalOffersScanned: 0,
    };
  }

  // ── Normalization (hotel-specific mapping) ────────────────────────────

  private offerIdOf(row: KompasHotelRawRow): string {
    return [
      "KOMPASHTL",
      row.stateInc,
      row.hotelKey,
      row.tourKey,
      row.spoKey,
      row.roomKey,
      row.mealKey,
      row.checkIn,
      row.nights,
      row.adults,
      row.children,
    ].join("-");
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
