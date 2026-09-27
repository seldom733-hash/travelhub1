import { Injectable, Logger } from "@nestjs/common";
import * as https from "https";
import * as http from "http";

/**
 * KazUnion HTTP Service — direct HTTP requests to the KazUnion SAMO endpoint
 * (online.kazunion.com/search_tour), same protocol as Summertour (summertour.az):
 *
 *  - GET /search_tour?STATEINC=..&TOWNFROMINC=..  → form HTML with TOURINC /
 *    STATEINC / MEALS / TOWNS dictionaries (one fetch per departure town).
 *  - GET /search_tour?samo_action=PRICES&..       → JS callback with an HTML
 *    table of price_info rows embedded via samo.jQuery(...).ehtml("...").
 *
 * Verified live (2026-09-27): direct GET works without a browser session,
 * returns UTF-8, 100 rows per PRICEPAGE, pager pages via data-page spans.
 */

// ── Dictionary entries discovered from the form ──────────────────────────

export interface KazunionState {
  value: string;
  name: string;
}

export interface KazunionProgram {
  value: string;
  name: string;
}

export interface KazunionDictionary {
  /** STATEINC options available for the departure town. */
  states: KazunionState[];
  /** TOURINC options for the (town, state) pair. */
  programs: KazunionProgram[];
  /** MEALS checklistbox value → label (e.g. 10002 → "BB"). */
  meals: Array<{ value: string; name: string }>;
  /** TOWNS checklistbox value → label (city/district filter). */
  towns: Array<{ value: string; name: string }>;
}

// ── One parsed price_info row ────────────────────────────────────────────

export interface KazunionOfferRow {
  hotelKey: string;
  spoKey: string;
  tourKey: string;
  mealKey: string;
  roomKey: string;
  nights: number;
  /** YYYYMMDD as returned in the class keys. */
  checkIn: string;
  adults: number;
  children: number;
  claim: string;
  hotel: string;
  /** Price in the requested currency (converted price preferred). */
  price: number;
  currency: string;
  /** Raw sortie text ("05.10.2026, Пн"). */
  departureDateText: string;
  transport: string;
  roomText: string;
  mealText: string;
  /** True when the row carries flight-seat markers ("есть места"). */
  seatsAvailable: boolean;
  /** True when the row carries a stop-sale marker. */
  stopSale: boolean;
  /** Total rows on the pager page this row came from (0 = unknown). */
  pageRowCount: number;
}

export interface KazunionFetchParams {
  /** TOWNFROMINC (departure town id, KazUnion form). Default Baku = 849. */
  townFromInc?: string;
  /** STATEINC (country id on KazUnion). */
  stateInc: string;
  /** TOURINC program id. */
  tourInc: string;
  /** ISO dates (YYYY-MM-DD). */
  checkInBeg: string;
  checkInEnd: string;
  nightsFrom?: number;
  nightsTill?: number;
  adults?: number;
  children?: number;
  childAges?: number[];
  /** HOTELS checklistbox value (hotelKey). Omit = all hotels. */
  hotelKey?: string;
  /** MEALS checklistbox value. Omit = all meals. */
  mealKey?: string;
  /** TOWNS checklistbox value (city/district). Omit = all towns. */
  townKey?: string;
  /** FREIGHTTYPE select — KazUnion native transport filter (0 = any, 2 = regular). */
  freightType?: string;
  /** STARS checklistbox values (comma-separated KazUnion ids). Omit = any. */
  starsKey?: string;
  /** STARS_ANY checkbox ("1" = any category). Default true. */
  starsAny?: boolean;
  /** Currency id on KazUnion (2 = USD). */
  currency?: string;
  /** Start page (1-based). */
  startPage?: number;
  /** Stop after this many pages (safety). */
  maxPages?: number;
}

@Injectable()
export class KazunionHttpService {
  private readonly logger = new Logger(KazunionHttpService.name);
  private static readonly BASE_URL = "https://online.kazunion.com/search_tour";
  /** KazUnion groups results by price id 232 (default checked on the form). */
  private static readonly PARTITION_PRICE = "232";
  /** Dictionary cache: key = `${townFromInc}:${stateInc ?? ""}`. */
  private readonly dictCache = new Map<string, KazunionDictionary>();

  // ── Dictionary discovery ──────────────────────────────────────────────

  /**
   * Fetch (and cache) the search form for a departure town — parsed into
   * states / programs / meals / towns. One HTTP request per town+state.
   */
  async fetchDictionary(townFromInc = "849", stateInc?: string): Promise<KazunionDictionary> {
    const key = `${townFromInc}:${stateInc ?? ""}`;
    const cached = this.dictCache.get(key);
    if (cached) return cached;

    const url = `${KazunionHttpService.BASE_URL}?TOWNFROMINC=${townFromInc}${stateInc ? `&STATEINC=${stateInc}` : ""}`;
    const body = await this.httpGet(url);

    const dict: KazunionDictionary = {
      states: this.parseSelectOptions(body, "STATEINC", true),
      programs: this.parseSelectOptions(body, "TOURINC", true),
      meals: this.parseChecklistbox(body, "MEALS"),
      towns: this.parseChecklistbox(body, "TOWNS"),
    };
    this.dictCache.set(key, dict);
    this.logger.log(
      `KazUnion dictionary (town=${townFromInc}, state=${stateInc ?? "default"}): ` +
      `${dict.states.length} states, ${dict.programs.length} programs, ` +
      `${dict.meals.length} meals, ${dict.towns.length} towns`,
    );
    return dict;
  }

  /** All states available for a departure town. */
  async discoverStates(townFromInc = "849"): Promise<KazunionState[]> {
    return (await this.fetchDictionary(townFromInc)).states;
  }

  /** TOURINC programs for a state (one form fetch per town+state, cached). */
  async discoverPrograms(stateInc: string, townFromInc = "849"): Promise<KazunionProgram[]> {
    return (await this.fetchDictionary(townFromInc, stateInc)).programs;
  }

  /** States + programs for a departure town (KOMPAS-style discovery shape). */
  async discoverCountriesAndPrograms(
    townFromInc = "849",
  ): Promise<Array<{ countryId: string; countryName: string; programs: KazunionProgram[] }>> {
    const states = await this.discoverStates(townFromInc);
    const out: Array<{ countryId: string; countryName: string; programs: KazunionProgram[] }> = [];
    for (const state of states) {
      try {
        const programs = await this.discoverPrograms(state.value, townFromInc);
        out.push({ countryId: state.value, countryName: state.name, programs });
      } catch (err) {
        this.logger.warn(`KazUnion discovery for state ${state.name} failed: ${(err as Error).message}`);
      }
    }
    return out;
  }

  // ── Price search ──────────────────────────────────────────────────────

  /**
   * Fetch prices for one program over a date range via samo_action=PRICES,
   * paginating PRICEPAGE until the pager is exhausted (or maxPages).
   */
  async fetchPrices(params: KazunionFetchParams): Promise<KazunionOfferRow[]> {
    const rows: KazunionOfferRow[] = [];
    const seen = new Set<string>();
    const startPage = params.startPage ?? 1;
    const maxPages = params.maxPages ?? 5;

    for (let page = startPage; page < startPage + maxPages; page++) {
      const url = this.buildPricesUrl(params, page);
      const body = await this.httpGet(url);

      if (this.isCaptchaResponse(body)) {
        throw new Error(
          "KazUnion: antibot/captcha challenge in response — supplier temporarily blocked, retry later",
        );
      }

      const html = this.extractHtmlFromJs(body);
      if (!html) {
        if (body.includes("Нет данных") || body.includes("\\u041d\\u0435\\u0442")) break;
        this.logger.warn(`KazUnion PRICES: no HTML in response (len=${body.length}, page=${page})`);
        break;
      }

      const pageRows = this.parsePriceRows(html);
      let added = 0;
      for (const row of pageRows) {
        const id = `${row.claim}|${row.spoKey}|${row.hotelKey}|${row.checkIn}|${row.roomKey}|${row.mealKey}`;
        if (seen.has(id)) continue;
        seen.add(id);
        rows.push(row);
        added++;
      }

      const totalPages = this.parseTotalPages(body, html);
      if (added === 0) break;
      if (page >= totalPages) break;
    }

    this.logger.debug(
      `KazUnion PRICES ${params.tourInc} ${params.checkInBeg}→${params.checkInEnd}: ${rows.length} rows`,
    );
    return rows;
  }

  // ── Response parsing ──────────────────────────────────────────────────

  /** Detect SAMO captcha/antibot pages (same markers as Summertour/KOMPAS). */
  isCaptchaResponse(text: string): boolean {
    if (/<form[^>]+captchaForm/i.test(text)) return true;
    if (/\bfcaptcha\b/i.test(text)) return true;
    if (/samo_action\s*=\s*["']?antibot/i.test(text)) return true;
    if (text.includes("captchaForm") || text.includes("icaptcha")) return true;
    return false;
  }

  /**
   * Extract the HTML payload from the SAMO JS callback:
   *   samo.jQuery(samo.controls.resultset).ehtml("...HTML...");
   * Handles \n \t \" \/ \\ and \uXXXX escapes.
   */
  extractHtmlFromJs(body: string): string | null {
    const m = body.match(/\.ehtml\("((?:[^"\\]|\\.)*)"\)/);
    if (!m) return null;
    return this.unescapeJsString(m[1]);
  }

  /** Unescape a JS string literal body (\uXXXX, \n, \t, \", \/, \\). */
  unescapeJsString(s: string): string {
    return s
      .replace(/\\n/g, "\n")
      .replace(/\\t/g, "\t")
      .replace(/\\"/g, '"')
      .replace(/\\\//g, "/")
      .replace(/\\\\/g, "\\")
      .replace(/\\u([0-9a-fA-F]{4})/g, (_, hex: string) => String.fromCharCode(parseInt(hex, 16)));
  }

  /** Parse all price_info rows of a results HTML table. */
  parsePriceRows(html: string): KazunionOfferRow[] {
    const offers: KazunionOfferRow[] = [];
    const rowRegex = /<tr[^>]*class="[^"]*price_info[^"]*"[^>]*>([\s\S]*?)<\/tr>/gi;
    let rowMatch: RegExpExecArray | null;

    while ((rowMatch = rowRegex.exec(html)) !== null) {
      const fullRow = rowMatch[0];
      const rowContent = rowMatch[1];
      const classMatch = fullRow.match(/class="([^"]*)"/);
      const classes = classMatch?.[1] ?? "";

      const hotelKey = classes.match(/hotelKey-(\d+)/)?.[1] ?? "";
      const spoKey = classes.match(/spoKey-(\d+)/)?.[1] ?? "";
      const tourKey = classes.match(/tourKey-(\d+)/)?.[1] ?? "";
      const mealKey = classes.match(/mealKey-(\d+)/)?.[1] ?? "";
      const roomKey = classes.match(/roomKey-(\d+)/)?.[1] ?? "";
      const nights = parseInt(classes.match(/nights-(\d+)/)?.[1] ?? "0", 10);
      const checkIn = classes.match(/checkIn-(\d+)/)?.[1] ?? "";
      const adults = parseInt(classes.match(/adult-(\d+)/)?.[1] ?? "0", 10);
      const children = parseInt(classes.match(/child-(\d+)/)?.[1] ?? "0", 10);

      const claim = fullRow.match(/data-cat-claim="([^"]*)"/)?.[1] ?? "";
      const dataHotel = fullRow.match(/data-hotel="([^"]*)"/)?.[1] ?? "";

      // Hotel name cell (+ trailing district "(Фатих)" is stripped).
      const hotelCell = rowContent.match(/<td[^>]*class="[^"]*link-hotel[^"]*"[^>]*>([\s\S]*?)<\/td>/i)?.[1] ?? "";
      const hotel = this.decodeEntities(
        hotelCell
          .replace(/<[\s\S]*?>/g, " ")
          .replace(/\s+/g, " ")
          .trim()
          .replace(/\s*\([^)]*\)\s*$/, ""),
      );

      // Converted price is in the requested currency (CURRENCY=2 → USD);
      // data-cat-price may be denominated in data-cat-currency (e.g. EUR).
      const priceSpan = rowContent.match(
        /data-cat-price="([^"]*)"[\s\S]{0,300}?data-converted-price-number="([^"]*)"[\s\S]{0,200}?data-currency_title="([^"]*)"/,
      );
      const priceFallback = rowContent.match(/data-cat-price="([^"]*)"[\s\S]{0,300}?data-currency_title="([^"]*)"/);
      let price = 0;
      let currency = "USD";
      if (priceSpan && priceSpan[2]) {
        price = parseFloat(priceSpan[2]);
        currency = priceSpan[3] || "USD";
      } else if (priceFallback) {
        price = parseFloat(priceFallback[1]);
        currency = priceFallback[2] || "USD";
      }

      const departureDateText = (rowContent.match(/<td[^>]*class="sortie"[^>]*>([\s\S]*?)<\/td>/i)?.[1] ?? "")
        .replace(/<[\s\S]*?>/g, " ")
        .replace(/\s+/g, " ")
        .trim();

      const transport = this.decodeEntities(
        rowContent.match(/<div class="transport">[\s\S]*?<span class="name">([^<]*)</i)?.[1]?.trim() ?? "",
      );

      // Meal cell — two native shapes:
      //   1) SAMO/Summer: <span class="helpalt link">BB <script>Завтраки</script>
      //      (popup spans like <span class="helpalt link" data-popup="PROMO"> excluded).
      //   2) KazUnion: bare <td>AO.</td> right after the availability cell.
      let mealText = (
        rowContent.match(/<span class="helpalt link"(?![^>]*data-popup)[^>]*>([\s\S]*?)<script/i)?.[1] ?? ""
      )
        .replace(/<[\s\S]*?>/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      if (!mealText) {
        const availIdx = rowContent.search(/hotel_availability/i);
        if (availIdx >= 0) {
          const cell = rowContent.slice(availIdx).match(/<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>/i);
          if (cell) {
            mealText = cell[1].replace(/<[\s\S]*?>/g, " ").replace(/\s+/g, " ").trim();
          }
        }
      }
      mealText = this.decodeEntities(mealText);

      // Room cell: <span class="">Standard Room / 2 ADL</span>
      const roomText = this.decodeEntities(
        (rowContent.match(/<span class="">([\s\S]*?)<\/span>/)?.[1] ?? "")
          .replace(/<[\s\S]*?>/g, " ")
          .replace(/\s+/g, " ")
          .trim(),
      );

      const seatsAvailable = /fr_place_[rl]\s+Y/.test(rowContent) || /title="[^"]*есть места/i.test(rowContent);
      const stopSale = /stop_sale|red_row/.test(fullRow) || /title="[^"]*stop[- ]?sale/i.test(rowContent);

      if (!hotelKey && !spoKey && !claim) continue;
      if (!price || !isFinite(price)) continue;

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
        departureDateText,
        transport,
        roomText,
        mealText,
        seatsAvailable,
        stopSale,
        pageRowCount: 0,
      });
    }

    return offers;
  }

  /** Max page number from the pager (data-page spans + current_page). */
  parseTotalPages(body: string, html: string): number {
    const src = html || body;
    let max = 1;
    for (const m of src.matchAll(/data-page="(\d+)"/g)) {
      const n = parseInt(m[1], 10);
      if (isFinite(n) && n > max) max = n;
    }
    const current = src.match(/class="current_page">(\d+)/);
    if (current) {
      const n = parseInt(current[1], 10);
      if (isFinite(n) && n > max) max = n;
    }
    return max;
  }

  // ── Form parsing helpers ──────────────────────────────────────────────

  /** Decode the few HTML entities that appear in SAMO labels. */
  decodeEntities(s: string): string {
    return s
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, " ");
  }

  /** Parse <select name=NAME> options → {value,label}. */
  parseSelectOptions(html: string, selectName: string, skipZero = false): Array<{ value: string; name: string }> {
    const selectMatch = html.match(
      new RegExp(`<select[^>]*name=["']?${selectName}["']?[^>]*>([\\s\\S]*?)<\\/select>`, "i"),
    );
    if (!selectMatch) return [];
    const out: Array<{ value: string; name: string }> = [];
    const optionRegex = /<option[^>]*value=["']?([^"'>\s]+)["']?[^>]*>([\s\S]*?)<\/option>/gi;
    let m: RegExpExecArray | null;
    while ((m = optionRegex.exec(selectMatch[1])) !== null) {
      const value = m[1];
      const name = this.decodeEntities(m[2].replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim());
      if (skipZero && (value === "0" || !name)) continue;
      if (!name) continue;
      out.push({ value, name });
    }
    return out;
  }

  /** Parse checklistbox NAME checkbox inputs → {value,label}. */
  parseChecklistbox(html: string, boxName: string): Array<{ value: string; name: string }> {
    const startMatch = html.match(new RegExp(`<div[^>]*name="${boxName}"[^>]*>`, "i"));
    if (!startMatch || startMatch.index === undefined) return [];
    const rest = html.slice(startMatch.index + startMatch[0].length);

    // The box ends at the next checklistbox sibling, the closing cell, or the
    // end of the fragment — whichever comes first.
    let end = rest.length;
    const nextBox = rest.search(/<div[^>]*class="[^"]*checklistbox/i);
    if (nextBox >= 0) end = nextBox;
    const closeCell = rest.search(/<\/td>/i);
    if (closeCell >= 0 && closeCell < end) end = closeCell;
    const slice = rest.slice(0, end);

    const out: Array<{ value: string; name: string }> = [];
    const inputRegex =
      /<input[^>]*type="checkbox"[^>]*value="(\d+)"[^>]*>([\s\S]*?)(?=<label|<\/label>|<input|<\/div>)/gi;
    let m: RegExpExecArray | null;
    while ((m = inputRegex.exec(slice)) !== null) {
      const value = m[1];
      const name = this.decodeEntities(m[2].replace(/<[\s\S]*?>/g, " ").replace(/\s+/g, " ").trim());
      if (name) out.push({ value, name });
    }
    return out;
  }

  // ── URL / HTTP ────────────────────────────────────────────────────────

  private buildPricesUrl(params: KazunionFetchParams, page: number): string {
    const p: Record<string, string> = {
      samo_action: "PRICES",
      TOWNFROMINC: params.townFromInc ?? "849",
      STATEINC: params.stateInc,
      TOURINC: params.tourInc,
      CHECKIN_BEG: this.toSamodate(params.checkInBeg),
      CHECKIN_END: this.toSamodate(params.checkInEnd),
      NIGHTS_FROM: String(params.nightsFrom ?? 3),
      NIGHTS_TILL: String(params.nightsTill ?? params.nightsFrom ?? 15),
      ADULT: String(params.adults ?? 2),
      CHILD: String(params.children ?? 0),
      CURRENCY: params.currency ?? "2",
      hotelsearch: "0",
      HOTELS_ANY: params.hotelKey ? "0" : "1",
      HOTELS: params.hotelKey ?? "",
      MEALS_ANY: params.mealKey ? "0" : "1",
      MEALS: params.mealKey ?? "",
      TOWNS_ANY: params.townKey ? "0" : "1",
      TOWNS: params.townKey ?? "",
      ROOMS_ANY: "1",
      ROOMS: "",
      // Native KazUnion form fields — same shape as the supplier's own request.
      FREIGHTTYPE: params.freightType ?? "0",
      townssearch: "0",
      STARS_ANY: params.starsAny === false ? "0" : "1",
      STARS: params.starsKey ?? "",
      UFILTER: "",
      // FREIGHT=1 → only rows with flight seats; FILTER=1 → no stop-sale.
      FREIGHT: "1",
      FILTER: "1",
      MOMENT_CONFIRM: "0",
      PARTITION_PRICE: KazunionHttpService.PARTITION_PRICE,
      PRICEPAGE: String(page),
      DYN_SEPARATE: "1",
      rev: String(Math.floor(Math.random() * 9000000000) + 1000000000),
      _: String(Date.now()),
    };

    const ages = params.childAges ?? [];
    for (let i = 0; i < Math.min(ages.length, 4); i++) {
      p[`AGE${i + 1}`] = String(ages[i]);
    }

    // Empty values are kept (HOTELS=, STARS=, ROOMS= …) — mirrors the native request.
    const qs = Object.entries(p)
      .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
      .join("&");
    return `${KazunionHttpService.BASE_URL}?${qs}`;
  }

  /** ISO YYYY-MM-DD → SAMO YYYYMMDD. */
  private toSamodate(iso: string): string {
    return iso.replace(/-/g, "");
  }

  /** Simple HTTPS GET with browser-like headers. Returns body as UTF-8 string. */
  httpGet(url: string, redirectDepth = 0): Promise<string> {
    return new Promise((resolve, reject) => {
      if (redirectDepth > 5) {
        reject(new Error("Too many redirects"));
        return;
      }
      const parsedUrl = new URL(url);
      const client = parsedUrl.protocol === "https:" ? https : http;

      const req = client.get(
        url,
        {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            Accept: "*/*",
            "Accept-Language": "ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7",
            Referer: "https://online.kazunion.com/search_tour",
          },
          timeout: 30_000,
        },
        (res) => {
          if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            const redirectUrl = new URL(res.headers.location, url).toString();
            this.httpGet(redirectUrl, redirectDepth + 1).then(resolve, reject);
            return;
          }
          if (res.statusCode && res.statusCode >= 400) {
            reject(new Error(`HTTP ${res.statusCode} from ${url}`));
            return;
          }
          const chunks: Buffer[] = [];
          res.on("data", (chunk: Buffer) => chunks.push(chunk));
          res.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
          res.on("error", reject);
        },
      );

      req.on("error", reject);
      req.on("timeout", () => {
        req.destroy();
        reject(new Error(`Timeout fetching ${url}`));
      });
    });
  }
}
