import { Injectable, Logger } from "@nestjs/common";
import type {
  SupplierAdapter,
  SupplierSearchQuery,
  SupplierOffer,
  SupplierOfferDetail,
  SupplierOfferRef,
  SupplierPriceSnapshot,
  SupplierAvailabilitySnapshot,
  SupplierAvailability,
} from "../supplier.types";

/**
 * Summertour adapter — implements SupplierAdapter.
 *
 * Source: summertour.az (SAMO engine, PHP).
 * Endpoint: GET /search_tour?samo_action=PRICES&... (text/html with JS-injected table).
 * Auth: anonymous (cookie SAMO auto-issued). Booking requires B2B login (out of scope).
 *
 * Parser: regex extraction from HTML table rows (data-* attributes + CSS classes).
 * Fallback: if HTML structure changes, schema drift detection catches it.
 */
@Injectable()
export class SummertourAdapter implements SupplierAdapter {
  readonly code = "SUMMERTOUR";
  readonly name = "Summertour (summertour.az)";
  readonly enabled = true;

  private readonly logger = new Logger(SummertourAdapter.name);
  private readonly baseUrl = "https://summertour.az";
  private readonly searchPath = "/search_tour";
  private sessionCookie = "";
  private sessionExpiresAt = 0;

  // Known mappings (from audit §6)
  private static readonly STATE_MAP: Record<string, string> = {
    turkey: "9",
    турция: "9",
  };

  private static readonly TOWN_MAP: Record<string, string> = {
    baku: "1930",
    баку: "1930",
  };

  private static readonly MEAL_MAP: Record<string, string> = {
    bb: "3",
    hb: "4",
    fb: "7",
    ai: "6",
    uai: "5",
    "all inclusive": "6",
  };

  private static readonly STAR_MAP: Record<string, string> = {
    "5": "5",
    "4": "4",
    "3": "3",
    "2": "2",
    "1": "1",
  };

  // ── Search ──────────────────────────────────────────────────────────

  // ── Session Management ──────────────────────────────────────────────

  private async ensureSession(): Promise<string> {
    if (this.sessionCookie && Date.now() < this.sessionExpiresAt) {
      return this.sessionCookie;
    }

    // GET /search_tour to establish SAMO session cookie
    const res = await fetch(`${this.baseUrl}${this.searchPath}`, {
      method: "GET",
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "ru-RU,ru;q=0.9,en;q=0.8",
      },
      signal: AbortSignal.timeout(15_000),
    });

    const setCookies = res.headers.getSetCookie?.() ?? [];
    const samoCookie = setCookies
      .map((c) => c.split(";")[0])
      .find((c) => c.startsWith("SAMO="));

    if (samoCookie) {
      this.sessionCookie = samoCookie;
      this.sessionExpiresAt = Date.now() + 30 * 60 * 1000; // 30 min
      this.logger.debug(`Summertour session established: ${samoCookie.substring(0, 20)}...`);
    }

    // Consume the response to free the connection
    await res.text();

    return this.sessionCookie;
  }

  async search(query: SupplierSearchQuery): Promise<SupplierOffer[]> {
    const params = this.buildSearchParams(query);
    const url = `${this.baseUrl}${this.searchPath}?${params.toString()}`;

    this.logger.debug(`Summertour search: ${url}`);

    const cookie = await this.ensureSession();

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "ru-RU,ru;q=0.9,en;q=0.8",
        "X-Requested-With": "XMLHttpRequest",
        "Referer": `${this.baseUrl}${this.searchPath}`,
        ...(cookie ? { "Cookie": cookie } : {}),
      },
      signal: AbortSignal.timeout(30_000),
    });

    if (!response.ok) {
      throw new Error(`Summertour search failed: HTTP ${response.status}`);
    }

    const html = await response.text();
    return this.parseSearchResults(html, query);
  }

  // ── Get Detail (CONTENT endpoint) ───────────────────────────────────

  async getOffer(ref: SupplierOfferRef): Promise<SupplierOfferDetail> {
    const url = `${this.baseUrl}${this.searchPath}?samo_action=CONTENT&CATCLAIM=${ref.externalClaim}`;

    this.logger.debug(`Summertour detail: ${url}`);

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "X-Requested-With": "XMLHttpRequest",
        "Referer": `${this.baseUrl}${this.searchPath}`,
      },
      signal: AbortSignal.timeout(30_000),
    });

    if (!response.ok) {
      throw new Error(`Summertour detail failed: HTTP ${response.status}`);
    }

    const html = await response.text();
    const composition = this.parseContentResponse(html);

    // Build a minimal detail from the ref — caller should supply base offer
    return {
      supplierCode: this.code,
      externalOfferId: ref.externalOfferId,
      externalClaim: ref.externalClaim,
      hotel: "Unknown",
      departureDate: "",
      nights: 0,
      adults: ref.searchContext.adults,
      children: ref.searchContext.children ?? 0,
      childAges: ref.searchContext.childAges ?? [],
      price: { amount: 0, currency: "USD", fetchedAt: new Date(), expiresAt: new Date(), queryHash: "", source: this.code },
      availability: "UNKNOWN",
      fetchedAt: new Date(),
      expiresAt: new Date(),
      packageComposition: composition,
    };
  }

  // ── Refresh Price ───────────────────────────────────────────────────

  async refreshPrice(ref: SupplierOfferRef): Promise<SupplierPriceSnapshot> {
    // Re-run search with the same context and find the matching offer
    const offers = await this.search(ref.searchContext);
    const match = offers.find((o) => o.externalOfferId === ref.externalOfferId);

    return {
      amount: match?.price.amount ?? 0,
      currency: match?.price.currency ?? "USD",
      fetchedAt: new Date(),
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      queryHash: JSON.stringify(ref.searchContext),
      source: this.code,
    };
  }

  // ── Refresh Availability ────────────────────────────────────────────

  async refreshAvailability(ref: SupplierOfferRef): Promise<SupplierAvailabilitySnapshot> {
    const offers = await this.search(ref.searchContext);
    const match = offers.find((o) => o.externalOfferId === ref.externalOfferId);

    return {
      availability: match?.availability ?? "UNKNOWN",
      fetchedAt: new Date(),
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    };
  }

  // ── Build Search Params ─────────────────────────────────────────────

  private buildSearchParams(query: SupplierSearchQuery): URLSearchParams {
    const params = new URLSearchParams();

    params.set("samo_action", "PRICES");
    params.set("TOWNFROMINC", SummertourAdapter.TOWN_MAP[(query.departureCity ?? "").toLowerCase()] ?? "1930");
    params.set("STATEINC", SummertourAdapter.STATE_MAP[(query.country ?? "").toLowerCase()] ?? "9");
    params.set("TOURINC", "0"); // all tours
    params.set("ADULT", String(query.adults));
    params.set("CHILD", String(query.children ?? 0));

    if (query.childAges?.length) {
      params.set("AGES", query.childAges.join(","));
      query.childAges.forEach((age, i) => {
        params.set(`AGE${i + 1}`, String(age));
      });
    }

    if (query.departureDateFrom) {
      params.set("CHECKIN_BEG", query.departureDateFrom.replace(/-/g, ""));
    } else {
      // Summertour requires CHECKIN_BEG — default to today
      const today = new Date();
      params.set("CHECKIN_BEG", `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, "0")}${String(today.getDate()).padStart(2, "0")}`);
    }
    if (query.departureDateTo) {
      params.set("CHECKIN_END", query.departureDateTo.replace(/-/g, ""));
    } else {
      // Default to 30 days from now
      const end = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      params.set("CHECKIN_END", `${end.getFullYear()}${String(end.getMonth() + 1).padStart(2, "0")}${String(end.getDate()).padStart(2, "0")}`);
    }

    if (query.nightsFrom) params.set("NIGHTS_FROM", String(query.nightsFrom));
    if (query.nightsTo) params.set("NIGHTS_TILL", String(query.nightsTo));

    if (query.hotelStars?.length) {
      params.set("STARS", query.hotelStars.join(","));
    } else {
      params.set("STARS_ANY", "1");
    }

    if (query.meal) {
      const mealId = SummertourAdapter.MEAL_MAP[query.meal.toLowerCase()];
      if (mealId) params.set("MEALS", mealId);
    } else {
      params.set("MEALS_ANY", "1");
    }

    params.set("ROOMS_ANY", "1");
    params.set("HOTELS_ANY", "1");
    params.set("TOWNS_ANY", "1");
    params.set("CURRENCY", "2"); // USD
    params.set("FREIGHT", "0");
    params.set("FILTER", "0");
    params.set("MOMENT_CONFIRM", "0");
    params.set("PARTITION_PRICE", "32");
    params.set("DYN_SEPARATE", "1");
    params.set("PRICEPAGE", String(query.page ?? 1));

    return params;
  }

  // ── Parse Search Results ────────────────────────────────────────────

  private parseSearchResults(html: string, query: SupplierSearchQuery): SupplierOffer[] {
    // The response is a JS script: jQuery(...).ehtml("escaped HTML...")
    // We need to extract the HTML string from the ehtml() call and unescape it.
    const ehtmlMatch = html.match(/\.ehtml\("([\s\S]*?)"\)/);
    const rawHtml = ehtmlMatch ? ehtmlMatch[1] : html;

    // Unescape JS string: \" → ", \n → newline, \\ → \, \/ → /
    const unescaped = rawHtml
      .replace(/\\"/g, '"')
      .replace(/\\n/g, "\n")
      .replace(/\\\//g, "/")
      .replace(/\\\\/g, "\\");

    const offers: SupplierOffer[] = [];
    const now = new Date();

    // Match table rows: <tr class="...price_info..." ... data-cat-claim="0x...">
    const rowRegex = /<tr\s+class="([^"]*price_info[^"]*)"[^>]*data-cat-claim="(0x[0-9a-fA-F]+)"[^>]*>([\s\S]*?)<\/tr>/gi;
    let rowMatch: RegExpExecArray | null;

    while ((rowMatch = rowRegex.exec(unescaped)) !== null) {
      try {
        const rowClass = rowMatch[1];
        const catClaim = rowMatch[2];
        const rowHtml = rowMatch[3];

        // Extract CSS class keys
        const hotelKey = this.extractClassKey(rowClass, /hotelKey-(\d+)/);
        const spoKey = this.extractClassKey(rowClass, /spoKey-(\d+)/);
        const tourKey = this.extractClassKey(rowClass, /tourKey-(\d+)/);
        const mealKey = this.extractClassKey(rowClass, /mealKey-(\d+)/);
        const roomKey = this.extractClassKey(rowClass, /roomKey-(\d+)/);
        const nightsFromClass = this.extractClassKey(rowClass, /nights-(\d+)/);
        const checkinFromClass = this.extractClassKey(rowClass, /checkIn-(\d+)/);
        const adultFromClass = this.extractClassKey(rowClass, /adult-(\d+)/);
        const childFromClass = this.extractClassKey(rowClass, /child-(\d+)/);

        // Extract hotel name from TD
        const hotelName = this.extractHotelName(rowHtml);
        const departureDate = this.extractDepartureDate(rowHtml, checkinFromClass);
        const nights = parseInt(nightsFromClass || "0", 10);
        const price = this.extractPrice(rowHtml);
        const availability = this.extractAvailability(rowHtml);
        const transport = this.extractTransport(rowHtml);

        if (!spoKey || !hotelName || !price) continue;

        offers.push({
          supplierCode: this.code,
          externalOfferId: spoKey,
          externalClaim: catClaim,
          hotel: hotelName,
          hotelExternalId: hotelKey || undefined,
          tour: tourKey || undefined,
          departureDate: this.normalizeDate(departureDate),
          nights,
          room: roomKey || undefined,
          meal: mealKey || undefined,
          adults: parseInt(adultFromClass || String(query.adults), 10),
          children: parseInt(childFromClass || String(query.children ?? 0), 10),
          childAges: query.childAges ?? [],
          price,
          availability,
          transport: transport || undefined,
          fetchedAt: now,
          expiresAt: new Date(now.getTime() + 5 * 60 * 1000),
          rawMetadata: { spoKey, hotelKey, tourKey, mealKey, roomKey, catClaim },
        });
      } catch (err) {
        this.logger.debug(`Failed to parse Summertour row: ${(err as Error).message}`);
      }
    }

    return offers;
  }

  // ── Parse Content Response ──────────────────────────────────────────

  private parseContentResponse(html: string): string {
    // CONTENT returns a jQuery.modal with service table
    const serviceRegex = /service_\d+[^<]*<\/td>\s*<td[^>]*>([^<]+)/gi;
    const services: string[] = [];
    let match: RegExpExecArray | null;
    while ((match = serviceRegex.exec(html)) !== null) {
      services.push(match[1].trim());
    }
    return services.join(", ") || html.substring(0, 500);
  }

  // ── Extraction Helpers ──────────────────────────────────────────────

  private extractClassKey(classes: string, pattern: RegExp): string {
    const match = classes.match(pattern);
    return match?.[1] ?? "";
  }

  private extractHotelName(rowHtml: string): string {
    // Hotel name is in <td class="link-hotel"> with text content (may have inner spans)
    const linkHotelRegex = /class="link-hotel"[^>]*>([\s\S]*?)<\/td>/i;
    const match = rowHtml.match(linkHotelRegex);
    if (match) {
      // Strip HTML tags and extract text
      const text = match[1].replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").trim();
      if (text) return text;
    }

    // Fallback: look for known hotel name patterns
    const nameRegex = />([A-Z][A-Z\s]{3,}(?:\s+\d\*)?)\s*(?:\([^)]*\))?/g;
    const nameMatch = nameRegex.exec(rowHtml);
    return nameMatch?.[1]?.trim() ?? "";
  }

  private extractDepartureDate(rowHtml: string, fallback: string): string {
    const dateRegex = /class="[^"]*sortie[^"]*"[^>]*>([^<]+)/i;
    const match = rowHtml.match(dateRegex);
    if (match) return match[1].trim();
    return fallback;
  }

  private extractPrice(rowHtml: string): SupplierPriceSnapshot | undefined {
    const priceRegex = /data-cat-price="([\d.]+)"[^>]*data-currency="(\d+)"[^>]*data-currency_title="([A-Z]+)"/i;
    const match = rowHtml.match(priceRegex);
    if (!match) return undefined;

    const amount = parseFloat(match[1]);
    if (isNaN(amount) || amount <= 0) return undefined;

    const now = new Date();
    return {
      amount,
      currency: match[3],
      fetchedAt: now,
      expiresAt: new Date(now.getTime() + 5 * 60 * 1000),
      queryHash: "",
      source: this.code,
    };
  }

  private extractAvailability(rowHtml: string): SupplierAvailability {
    if (/hotel_availability_R/i.test(rowHtml)) return "AVAILABLE";
    if (/hotel_availability_N/i.test(rowHtml)) return "NOT_AVAILABLE";
    return "UNKNOWN";
  }

  private extractTransport(rowHtml: string): string {
    const transportRegex = /class="[^"]*transport[^"]*"[^>]*>([^<]+)/i;
    const match = rowHtml.match(transportRegex);
    return match?.[1]?.trim() ?? "";
  }

  private normalizeDate(dateStr: string): string {
    // Convert "26.09.2026, 07:55" or "20260926" to ISO-8601
    if (/^\d{8}$/.test(dateStr)) {
      return `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`;
    }
    const dmyMatch = dateStr.match(/(\d{2})\.(\d{2})\.(\d{4})/);
    if (dmyMatch) {
      return `${dmyMatch[3]}-${dmyMatch[2]}-${dmyMatch[1]}`;
    }
    return dateStr;
  }
}
