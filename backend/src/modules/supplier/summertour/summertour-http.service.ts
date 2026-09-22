import { Injectable, Logger } from "@nestjs/common";
import * as https from "https";
import * as http from "http";
import type { SupplierSearchQuery, SupplierOffer } from "../supplier.types";

/**
 * Summertour HTTP Service — direct HTTP requests to summertour.az SAMO endpoint.
 *
 * No Playwright needed. The SAMO API accepts direct GET requests and returns
 * JavaScript callbacks with embedded HTML tables containing price data.
 *
 * Response format:
 *   (function() { ... samo.jQuery(samo.controls.resultset).ehtml("...HTML..."); ... })();
 *
 * Key insight from test cases: direct HTTP to ?samo_action=PRICES returns prices
 * without needing a browser session. Same parameters as the Playwright adapter.
 */

export interface HttpSummerOffer {
  hotelKey: string;
  spoKey: string;
  tourKey: string;
  mealKey: string;
  roomKey: string;
  nights: number;
  checkIn: string;
  adults: number;
  children: number;
  claim: string;
  hotel: string;
  price: number;
  currency: string;
  departureDate: string;
  transport: string;
  roomText: string;
  mealText: string;
}

interface HttpRequestParams {
  TOWNFROMINC: string;
  STATEINC: string;
  TOURINC: string;
  CHECKIN_BEG: string;
  CHECKIN_END: string;
  NIGHTS_FROM: string;
  NIGHTS_TILL: string;
  ADULT: string;
  CURRENCY: string;
  CHILD: string;
  hotelsearch: string;
  HOTELS_ANY: string;
  HOTELS: string;
  MEALS_ANY: string;
  MEALS: string;
  ROOMS_ANY: string;
  ROOMS: string;
  FREIGHT: string;
  FILTER: string;
  MOMENT_CONFIRM: string;
  PARTITION_PRICE: string;
  PRICEPAGE: string;
  DYN_SEPARATE: string;
  rev: string;
  _: string;
}

@Injectable()
export class SummertourHttpService {
  private readonly logger = new Logger(SummertourHttpService.name);
  private static readonly BASE_URL = "https://summertour.az/search_tour";
  private static readonly PARTITION_PRICE = "32"; // grouped by price on Summertour site

  /**
   * Fetch prices via direct HTTP GET request.
   * Returns parsed offers from the HTML table embedded in the JS response.
   */
  async fetchPrices(params: {
    tourIncValue: string;
    checkIn: string; // YYYYMMDD format
    nights: number;
    adults: number;
    children: number;
    childAges?: number[];
    hotelKey?: string;
    mealKey?: string;
    freight?: string;
    filter?: string;
    currency?: string;
    partitionPrice?: string;
  }): Promise<HttpSummerOffer[]> {
    const rev = String(Math.floor(Math.random() * 9000000000) + 1000000000);
    const ts = Date.now();

    const queryParams: HttpRequestParams = {
      TOWNFROMINC: "1930", // Baku
      STATEINC: "9", // Turkey
      TOURINC: params.tourIncValue,
      CHECKIN_BEG: params.checkIn,
      CHECKIN_END: params.checkIn,
      NIGHTS_FROM: String(params.nights),
      NIGHTS_TILL: String(params.nights),
      ADULT: String(params.adults),
      CURRENCY: params.currency ?? "2", // USD
      CHILD: String(params.children),
      hotelsearch: "0",
      HOTELS_ANY: params.hotelKey ? "0" : "1",
      HOTELS: params.hotelKey ?? "",
      MEALS_ANY: params.mealKey ? "0" : "1",
      MEALS: params.mealKey ?? "",
      ROOMS_ANY: "1",
      ROOMS: "",
      FREIGHT: params.freight ?? "0",
      FILTER: params.filter ?? "0",
      MOMENT_CONFIRM: "0",
      PARTITION_PRICE: params.partitionPrice ?? SummertourHttpService.PARTITION_PRICE,
      PRICEPAGE: "1",
      DYN_SEPARATE: "1",
      rev,
      _: String(ts),
    };

    // Add AGES if children > 0
    if (params.children > 0 && params.childAges?.length) {
      (queryParams as any).AGES = String(params.childAges[0]);
    }

    const url = this.buildUrl(queryParams);
    this.logger.debug(`HTTP GET ${url}`);

    const body = await this.httpGet(url);
    const html = this.extractHtmlFromJs(body);

    if (!html) {
      this.logger.warn("No HTML extracted from response");
      return [];
    }

    const offers = this.parseHtmlTable(html);
    this.logger.debug(`Parsed ${offers.length} offers from HTTP response`);
    return offers;
  }

  /**
   * Fetch the list of available tour programs (TOURINC options).
   * Uses the SAMO form page to extract select options.
   */
  async discoverPrograms(): Promise<Array<{ value: string; name: string }>> {
    const url = SummertourHttpService.BASE_URL;
    const body = await this.httpGet(url);

    // Extract <select name=TOURINC> options from the HTML
    const selectMatch = body.match(/<select[^>]*name=["']?TOURINC["']?[^>]*>([\s\S]*?)<\/select>/i);
    if (!selectMatch) {
      this.logger.warn("TOURINC select not found in page");
      return [];
    }

    const options: Array<{ value: string; name: string }> = [];
    const optionRegex = /<option[^>]*value=["']?(\d+)["']?[^>]*>([\s\S]*?)<\/option>/gi;
    let m: RegExpExecArray | null;
    while ((m = optionRegex.exec(selectMatch[1])) !== null) {
      const value = m[1];
      const name = m[2].replace(/<[^>]*>/g, "").trim();
      if (value !== "0" && name) {
        options.push({ value, name });
      }
    }

    this.logger.log(`Discovered ${options.length} programs via HTTP`);
    return options;
  }

  /**
   * Extract HTML from SAMO JavaScript response.
   * Response format: samo.jQuery(samo.controls.resultset).ehtml("...HTML...");
   */
  private extractHtmlFromJs(body: string): string | null {
    // Method 1: Match ehtml("...") with escaped quotes
    const ehtmlMatch = body.match(/samo\.jQuery\s*\(\s*samo\.controls\.resultset\s*\)\s*\.ehtml\s*\(\s*"([\s\S]*?)"\s*\)/);
    if (ehtmlMatch) {
      // Unescape the HTML string (remove backslash escapes)
      let html = ehtmlMatch[1];
      html = html.replace(/\\"/g, '"').replace(/\\'/g, "'").replace(/\\\//g, "/").replace(/\\n/g, "\n").replace(/\\t/g, "\t").replace(/\\\\/g, "\\");
      return html;
    }

    // Method 2: Match ehtml('...') with single quotes
    const ehtmlMatch2 = body.match(/samo\.jQuery\s*\(\s*samo\.controls\.resultset\s*\)\s*\.ehtml\s*\(\s*'([\s\S]*?)'\s*\)/);
    if (ehtmlMatch2) {
      let html = ehtmlMatch2[1];
      html = html.replace(/\\'/g, "'").replace(/\\"/g, '"').replace(/\\\//g, "/").replace(/\\n/g, "\n").replace(/\\t/g, "\t").replace(/\\\\/g, "\\");
      return html;
    }

    // Method 3: Check for "Нет данных" (no data) response
    if (body.includes("\\u041d\\u0435\\u0442 \\u0434\\u0430\\u043d\\u043d\\u044b\\u0445") || body.includes("Нет данных")) {
      this.logger.debug("Response contains 'Нет данных' (no data)");
      return null;
    }

    // Method 4: Look for any ehtml call with backtick template or other formats
    const ehtmlMatch3 = body.match(/\.ehtml\s*\(\s*[`"']([\s\S]*?)[`"']\s*\)/);
    if (ehtmlMatch3) {
      let html = ehtmlMatch3[1];
      html = html.replace(/\\"/g, '"').replace(/\\'/g, "'").replace(/\\\//g, "/").replace(/\\n/g, "\n").replace(/\\t/g, "\t");
      return html;
    }

    this.logger.warn("Could not extract HTML from JS response");
    return null;
  }

  /**
   * Parse HTML table rows to extract offer data.
   * Parses tr.price_info rows with CSS class keys and data attributes.
   */
  private parseHtmlTable(html: string): HttpSummerOffer[] {
    const offers: HttpSummerOffer[] = [];

    // Find all <tr class="...price_info..."> blocks
    const rowRegex = /<tr\s+class="[^"]*price_info[^"]*"[^>]*>([\s\S]*?)<\/tr>/gi;
    let rowMatch: RegExpExecArray | null;

    while ((rowMatch = rowRegex.exec(html)) !== null) {
      const fullRow = rowMatch[0];
      const rowContent = rowMatch[1];

      // Extract CSS class keys from the opening <tr> tag
      const classMatch = fullRow.match(/class="([^"]*)"/);
      const classes = classMatch?.[1] ?? "";

      const hotelKey = classes.match(/hotelKey-(\d+)/)?.[1] ?? "";
      const spoKey = classes.match(/spoKey-(\d+)/)?.[1] ?? "";
      const tourKey = classes.match(/tourKey-(\d+)/)?.[1] ?? "";
      const mealKey = classes.match(/mealKey-(\d+)/)?.[1] ?? "";
      const roomKey = classes.match(/roomKey-(\d+)/)?.[1] ?? "";
      const nights = parseInt(classes.match(/nights-(\d+)/)?.[1] ?? "0");
      const checkIn = classes.match(/checkIn-(\d+)/)?.[1] ?? "";
      const adults = parseInt(classes.match(/adult-(\d+)/)?.[1] ?? "0");
      const children = parseInt(classes.match(/child-(\d+)/)?.[1] ?? "0");

      // Extract data attributes from the <tr> tag
      const claim = this.extractAttr(fullRow, "data-cat-claim") ?? "";
      const dataHotel = this.extractAttr(fullRow, "data-hotel") ?? "";

      // Extract hotel name from .link-hotel element
      const hotelMatch = rowContent.match(/<[^>]*class="[^"]*link-hotel[^"]*"[^>]*>([\s\S]*?)<\/[^>]*>/);
      const hotel = hotelMatch?.[1]?.replace(/<[^>]*>/g, "").trim() ?? "";

      // Extract price from [data-cat-price] element
      const priceMatch = rowContent.match(/data-cat-price="([^"]*)"/);
      const price = parseFloat(priceMatch?.[1] ?? "0");

      // Extract currency from [data-currency_title] element
      const currencyMatch = rowContent.match(/data-currency_title="([^"]*)"/);
      const currency = currencyMatch?.[1] ?? "USD";

      // Extract departure date from .sortie element
      const sortieMatch = rowContent.match(/<[^>]*class="[^"]*sortie[^"]*"[^>]*>([\s\S]*?)<\/[^>]*>/);
      const departureDate = sortieMatch?.[1]?.replace(/<[^>]*>/g, "").trim() ?? "";

      // Extract transport from .transport element
      const transportMatch = rowContent.match(/<[^>]*class="[^"]*transport[^"]*"[^>]*>([\s\S]*?)<\/[^>]*>/);
      const transport = transportMatch?.[1]?.replace(/<[^>]*>/g, "").trim() ?? "";

      // Extract meal and room text from table cells
      // Column order: sortie, tour, nights, hotel, seating, meal, room, ...
      const cells = this.extractTdCells(rowContent);
      let mealText = "";
      let roomText = "";
      if (cells.length >= 7) {
        mealText = cells[5]?.trim() ?? "";
        roomText = cells[6]?.trim() ?? "";
      }

      if (!hotelKey && !spoKey) continue;

      offers.push({
        hotelKey: hotelKey || dataHotel,
        spoKey,
        tourKey,
        mealKey,
        roomKey,
        nights,
        checkIn,
        adults,
        children,
        claim,
        hotel,
        price,
        currency,
        departureDate,
        transport,
        roomText,
        mealText,
      });
    }

    return offers;
  }

  /** Extract attribute value from an HTML tag string. */
  private extractAttr(tag: string, attrName: string): string | null {
    const regex = new RegExp(`${attrName}="([^"]*)"`, "i");
    const match = tag.match(regex);
    return match?.[1] ?? null;
  }

  /** Extract text content from each <td> cell in a table row. */
  private extractTdCells(rowContent: string): string[] {
    const cells: string[] = [];
    const tdRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    let m: RegExpExecArray | null;
    while ((m = tdRegex.exec(rowContent)) !== null) {
      cells.push(m[1].replace(/<[^>]*>/g, "").trim());
    }
    return cells;
  }

  /** Build URL with query parameters. */
  private buildUrl(params: Record<string, string> | HttpRequestParams): string {
    const qs = Object.entries(params)
      .filter(([, v]) => v !== "")
      .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
      .join("&");
    return `${SummertourHttpService.BASE_URL}?samo_action=PRICES&${qs}`;
  }

  /** Simple HTTPS GET request. Returns response body as string. */
  private httpGet(url: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const parsedUrl = new URL(url);
      const client = parsedUrl.protocol === "https:" ? https : http;

      const req = client.get(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept": "*/*",
          "Accept-Language": "ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7",
          "Referer": "https://summertour.az/search_tour",
        },
        timeout: 30_000,
      }, (res) => {
        // Handle redirects
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          const redirectUrl = new URL(res.headers.location, url).toString();
          this.httpGet(redirectUrl).then(resolve).catch(reject);
          return;
        }

        if (res.statusCode && res.statusCode >= 400) {
          reject(new Error(`HTTP ${res.statusCode} from ${url}`));
          return;
        }

        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => chunks.push(chunk));
        res.on("end", () => {
          const body = Buffer.concat(chunks).toString("utf-8");
          resolve(body);
        });
        res.on("error", reject);
      });

      req.on("error", reject);
      req.on("timeout", () => {
        req.destroy();
        reject(new Error(`Timeout fetching ${url}`));
      });
    });
  }
}
