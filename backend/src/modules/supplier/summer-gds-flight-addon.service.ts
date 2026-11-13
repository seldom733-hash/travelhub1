import { Injectable, Logger } from "@nestjs/common";
import { AzalAdapter } from "./azal/azal.adapter";
import { SupplierPricingService } from "../pricing/supplier-pricing.service";
import type { PriceCalendarEntry, PriceCalendarQuery, SupplierOffer } from "./supplier.types";

/**
 * Summertour GDS packages expose only the hotel + transfer part of the price.
 * The flight is sold separately by AZAL, so the displayed package price must
 * be hotel/transfer + the cheapest AZAL round trip (GYD ⇄ destination).
 *
 * Only the two Summertour GDS programs are enriched:
 *   256 — Antalya (AYT)
 *   238 — Istanbul (IST)
 * They are marked by the supplier with class "gds transport" in TOURINC.
 */
@Injectable()
export class SummerGdsFlightAddonService {
  private readonly logger = new Logger(SummerGdsFlightAddonService.name);

  private static readonly GDS_AIRPORT: Record<string, string> = {
    "256": "AYT",
    "238": "IST",
  };

  private readonly flightCache = new Map<string, Promise<number | null>>();

  constructor(
    private readonly azal: AzalAdapter,
    private readonly pricing: SupplierPricingService,
  ) {}

  /** Add AZAL round-trip flight cost to Summertour GDS search offers. */
  async applyToOffers(
    offers: SupplierOffer[],
    passengers: { adults: number; children?: number; childAges?: number[] } = { adults: 1 },
  ): Promise<SupplierOffer[]> {
    if (offers.length === 0) return offers;
    const pax = {
      adults: Math.max(1, Number(passengers.adults) || 1),
      children: Math.max(0, Number(passengers.children) || 0),
      childAges: passengers.childAges ?? [],
    };
    const out: SupplierOffer[] = [];
    for (const offer of offers) {
      const airport = this.airportOfOffer(offer);
      if (!airport || !offer.departureDate || !offer.nights) {
        out.push(offer);
        continue;
      }
      const returnDate = addDays(offer.departureDate, offer.nights);
      const addon = await this.minRoundTrip(airport, offer.departureDate, returnDate, pax);
      if (addon == null) {
        out.push(offer);
        continue;
      }
      out.push({
        ...offer,
        price: {
          ...offer.price,
          amount: round2(offer.price.amount + addon),
          currency: "AZN",
        },
        flightAddon: {
          source: "AZAL",
          amount: addon,
          currency: "AZN",
          departureDate: offer.departureDate,
          returnDate,
        },
      });
    }
    return out;
  }

  /** Add AZAL round-trip cost to Summertour GDS calendar entries. */
  async applyToCalendar(
    entries: PriceCalendarEntry[],
    query: PriceCalendarQuery,
  ): Promise<PriceCalendarEntry[]> {
    const airport = this.airportOfQuery(query);
    if (!airport || entries.length === 0) return entries;
    const priced = entries.filter((e) => e.price != null);
    if (priced.length === 0) return entries;

    const nights = Math.max(1, Number(query.nights) || 1);
    const dates = priced.map((e) => e.date).sort();
    const minDate = dates[0];
    const maxDate = addDays(dates[dates.length - 1], nights);
    const pax = {
      adults: Math.max(1, Number(query.adults) || 1),
      children: Math.max(0, Number(query.children) || 0),
      childAges: query.childAges ?? [],
    };
    const [outbound, inbound] = await Promise.all([
      this.calendarPrices("GYD", airport, minDate, maxDate, pax),
      this.calendarPrices(airport, "GYD", minDate, maxDate, pax),
    ]);
    if (outbound.size === 0 || inbound.size === 0) return entries;

    const flights = new Map<string, number>();
    for (const entry of priced) {
      const returnDate = addDays(entry.date, nights);
      const out = outbound.get(entry.date);
      const back = inbound.get(returnDate);
      if (out == null || back == null) continue;
      const [outPublic, backPublic] = await Promise.all([
        this.publicFlightAmount(out),
        this.publicFlightAmount(back),
      ]);
      const addon = round2(outPublic + backPublic);
      flights.set(entry.date, addon);
    }
    if (flights.size === 0) return entries;

    return entries.map((entry) => {
      const addon = flights.get(entry.date);
      if (addon == null || entry.price == null) return entry;
      return {
        ...entry,
        price: round2(entry.price + addon),
        currency: "AZN",
        flightAddon: {
          source: "AZAL",
          amount: addon,
          currency: "AZN",
          departureDate: entry.date,
          returnDate: addDays(entry.date, nights),
        },
      };
    });
  }

  private airportOfOffer(offer: SupplierOffer): string | null {
    const program = String(
      (offer.rawMetadata as Record<string, unknown> | undefined)?.tourKey ??
        offer.tour ??
        "",
    );
    return SummerGdsFlightAddonService.GDS_AIRPORT[program] ?? null;
  }

  private airportOfQuery(query: PriceCalendarQuery): string | null {
    const programs = [
      query.tourIncValue,
      ...(query.tourIncValues ?? []),
    ].filter((v): v is string => typeof v === "string" && v.length > 0);
    for (const p of programs) {
      const airport = SummerGdsFlightAddonService.GDS_AIRPORT[p];
      if (airport) return airport;
    }
    return this.airportOfText(`${query.destination ?? ""} ${(query.tourIncNames ?? []).join(" ")}`);
  }

  private airportOfText(text: string): string | null {
    const value = text.toLowerCase();
    if (/antalya|белек|кемер|сиде|алания/.test(value)) return "AYT";
    if (/istanbul|стамбул/.test(value)) return "IST";
    return null;
  }

  private minRoundTrip(
    airport: string,
    departureDate: string,
    returnDate: string,
    passengers: { adults: number; children: number; childAges: number[] },
  ): Promise<number | null> {
    const key = `${airport}:${departureDate}:${returnDate}:${passengers.adults}:${passengers.children}:${passengers.childAges.join(",")}`;
    const cached = this.flightCache.get(key);
    if (cached) return cached;
    const promise = this.loadMinRoundTrip(airport, departureDate, returnDate, passengers);
    this.flightCache.set(key, promise);
    // Short-lived cache: AZAL prices move; keep the map bounded.
    if (this.flightCache.size > 500) {
      const oldest = this.flightCache.keys().next().value;
      if (oldest) this.flightCache.delete(oldest);
    }
    return promise;
  }

  private async loadMinRoundTrip(
    airport: string,
    departureDate: string,
    returnDate: string,
    passengers: { adults: number; children: number; childAges: number[] },
  ): Promise<number | null> {
    try {
      const result = await this.azal.search({
        from: "GYD",
        to: airport,
        departureDate,
        returnDate,
        tripType: "RT",
        passengers: {
          adults: passengers.adults,
          children: passengers.children,
          infants: 0,
          childAges: passengers.childAges,
        },
      });
      const flights = result.flights;
      const rt = flights.filter((f) => f.optionId?.endsWith("_RT"));
      const candidates = (rt.length > 0 ? rt : flights)
        .flatMap((f) => f.fares)
        .filter((f) => f.available && Number(f.total.amount) > 0)
        .map((f) => Number(f.total.amount));
      if (candidates.length === 0) return null;
      return this.publicFlightAmount(Math.min(...candidates));
    } catch (err) {
      this.logger.warn(`AZAL add-on ${airport} ${departureDate}/${returnDate}: ${(err as Error).message}`);
      return null;
    }
  }

  private async calendarPrices(
    from: string,
    to: string,
    dateFrom: string,
    dateTo: string,
    passengers: { adults: number; children: number; childAges: number[] },
  ): Promise<Map<string, number>> {
    try {
      const result = await this.azal.calendar({
        from,
        to,
        passengers: {
          adults: passengers.adults,
          children: passengers.children,
          infants: 0,
          childAges: passengers.childAges,
        },
        dates: { from: dateFrom, to: dateTo },
      });
      const map = new Map<string, number>();
      for (const [date, day] of Object.entries(result.prices ?? {})) {
        const amount = Number(day.outbound?.price?.amount ?? 0);
        if (amount > 0) map.set(date, amount);
      }
      return map;
    } catch (err) {
      this.logger.warn(`AZAL calendar ${from}->${to}: ${(err as Error).message}`);
      return new Map();
    }
  }

  private publicFlightAmount(amount: number): Promise<number> {
    return this.pricing.publicAmountFor(amount, "AZN", "AZAL", "flights");
  }
}

function addDays(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
