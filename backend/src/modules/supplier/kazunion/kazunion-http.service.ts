import { Injectable, Logger } from "@nestjs/common";
import * as https from "https";
import * as fs from "fs";
import * as path from "path";
import { execFile } from "child_process";
import { parseSamoHotelDynamic } from "../samo-hotel-dict";

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
  /** STARS checklistbox value → label (hotel categories, e.g. 10001 → "5*"). */
  stars: Array<{ value: string; name: string }>;
  /** Inline samo.hotelDynamic hotel dictionary (state-scoped). */
  hotels: Array<{ id: string; name: string; townKey?: string }>;
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
  /** TOWNS CSV (multiple ids) — city filter resolved from Master Geography. */
  townsCsv?: string;
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
  /**
   * PARTITION_PRICE=0 → no price grouping: return every room/meal/program
   * variant individually. The former value "232" grouped rows by price id and
   * hid most variants (verified live: NAI HARN 04.10 Oct'26 — 6 rows on the
   * supplier site, only 2 with 232; geo Oct — 31 vs 100 rows, shared keys keep
   * identical prices). Same approach as KOMPAS (PARTITION_PRICE=0).
   */
  private static readonly PARTITION_PRICE = "0";
  /** Dictionary cache: key = `${townFromInc}:${stateInc ?? ""}`. */
  private readonly dictCache = new Map<string, KazunionDictionary>();
  /** Global pacing: min interval between supplier requests (~30 rpm cap). */
  private static readonly MIN_REQUEST_INTERVAL_MS = 2_000;
  /** Backoff between captcha auto-solve attempts (fresh image each round). */
  private static readonly CAPTCHA_RETRY_DELAYS_MS = [15_000, 30_000, 60_000];
  /** Fresh-image rounds per solve attempt (all OCR candidates POSTed per round). */
  private static readonly CAPTCHA_SOLVE_ROUNDS = 3;
  /** Serializes every supplier request: pacing must not race concurrent callers. */
  private requestQueue: Promise<unknown> = Promise.resolve();
  private lastRequestAt = 0;
  /**
   * Persistent session cookie jar. Solving the antibot challenge unlocks the
   * whole session, so cookies survive backend restarts and a manual solve
   * between runs reuses the same SAMO session.
   */
  private readonly sessionFile = path.resolve(process.cwd(), ".kazunion-session.json");
  private jar: Record<string, string> = this.loadJar();
  private lastCaptchaImagePath: string | null = null;

  private loadJar(): Record<string, string> {
    try {
      const raw = JSON.parse(fs.readFileSync(this.sessionFile, "utf-8"));
      if (raw && typeof raw.cookies === "object" && raw.cookies) return raw.cookies;
    } catch {
      /* first run / missing file */
    }
    return {};
  }

  private saveJar(pending?: { url: string; image: string } | null): void {
    try {
      fs.writeFileSync(
        this.sessionFile,
        JSON.stringify({ cookies: this.jar, pending: pending ?? null }, null, 2),
        "utf-8",
      );
    } catch {
      /* non-fatal */
    }
  }

  private absorbCookies(setCookie: string[] | string | undefined): boolean {
    if (!setCookie) return false;
    const list = Array.isArray(setCookie) ? setCookie : [setCookie];
    let changed = false;
    for (const c of list) {
      const nv = c.split(";")[0];
      const eq = nv.indexOf("=");
      if (eq <= 0) continue;
      const name = nv.slice(0, eq).trim();
      const value = nv.slice(eq + 1).trim();
      if (this.jar[name] !== value) {
        this.jar[name] = value;
        changed = true;
      }
    }
    return changed;
  }

  private cookieHeader(): string {
    return Object.entries(this.jar)
      .map(([k, v]) => `${k}=${v}`)
      .join("; ");
  }

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
    let body = await this.pacedGet(url);
    let dict = this.parseDictionary(body);
    if (this.isEmptyDictionary(dict)) {
      // All-empty parse = the supplier served a non-form page (soft block).
      this.logger.warn(
        `KazUnion dictionary (town=${townFromInc}, state=${stateInc ?? "default"}) parsed empty ` +
          `(len=${body.length}, captcha=${this.isCaptchaResponse(body)}), retrying once in 10s`,
      );
      await new Promise((r) => setTimeout(r, 10_000));
      body = await this.pacedGet(url);
      dict = this.parseDictionary(body);
      if (this.isEmptyDictionary(dict)) {
        this.logger.warn(
          `KazUnion dictionary (state=${stateInc ?? "default"}) still empty after retry: ` +
            `len=${body.length} captcha=${this.isCaptchaResponse(body)} sample="` +
            `${body.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 160)}"`,
        );
      }
    }
    if (!this.isEmptyDictionary(dict)) this.dictCache.set(key, dict);
    this.logger.log(
      `KazUnion dictionary (town=${townFromInc}, state=${stateInc ?? "default"}): ` +
        `${dict.states.length} states, ${dict.programs.length} programs, ` +
        `${dict.meals.length} meals, ${dict.towns.length} towns, ${dict.stars.length} stars, ` +
        `${dict.hotels.length} hotels`,
    );
    return dict;
  }

  private parseDictionary(body: string): KazunionDictionary {
    return {
      states: this.parseSelectOptions(body, "STATEINC", true),
      programs: this.parseSelectOptions(body, "TOURINC", true),
      meals: this.parseChecklistbox(body, "MEALS"),
      towns: this.parseChecklistbox(body, "TOWNS"),
      stars: this.parseChecklistbox(body, "STARS"),
      hotels: parseSamoHotelDynamic(body),
    };
  }

  /** All-empty dictionary = challenge/block page instead of the search form. */
  private isEmptyDictionary(dict: KazunionDictionary): boolean {
    return (
      dict.states.length === 0 &&
      dict.programs.length === 0 &&
      dict.meals.length === 0 &&
      dict.towns.length === 0 &&
      dict.stars.length === 0
    );
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
        // Keep the country visible (empty programs) so sync reports it as an error
        // instead of silently shrinking the discovered country list.
        out.push({ countryId: state.value, countryName: state.name, programs: [] });
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
      if (page === startPage) {
        const u = new URL(url);
        this.logger.debug(
          `KazUnion PRICES ${params.tourInc} stars: STARS_ANY=${u.searchParams.get("STARS_ANY")}&STARS=${u.searchParams.get("STARS")}`,
        );
      }
      const body = await this.pacedGet(url);

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
      this.logger.debug(
        `KazUnion PRICES ${params.tourInc} page ${page}/${totalPages}: +${added} → ${rows.length} rows`,
      );
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
      // §TOWNS precision: normalize whitespace/CSV before the ANY-flag decision —
      // a whitespace-only townsCsv must behave like "no filter" (TOWNS_ANY=1),
      // never like a broken TOWNS=&TOWNS_ANY=0 pair (which widens the result
      // set instead of restricting it).
      TOWNS_ANY: params.townKey || params.townsCsv?.replace(/\s+/g, "") ? "0" : "1",
      TOWNS: params.townsCsv?.replace(/\s+/g, "") || params.townKey || "",
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

  /**
   * Paced GET with captcha backoff. All calls are serialized through a single
   * queue (so concurrent search/sync callers cannot race the pacing clock),
   * enforce MIN_REQUEST_INTERVAL_MS between requests, and retry the same URL
   * after CAPTCHA_RETRY_DELAYS_MS when the antibot challenge is served.
   * Throws the captcha error when all attempts are exhausted.
   */
  async pacedGet(url: string): Promise<string> {
    const task = this.requestQueue.then(() => this.fetchPaced(url));
    this.requestQueue = task.catch(() => undefined);
    return task;
  }

  private async fetchPaced(url: string): Promise<string> {
    for (let attempt = 0; ; attempt++) {
      const wait =
        KazunionHttpService.MIN_REQUEST_INTERVAL_MS - (Date.now() - this.lastRequestAt);
      if (wait > 0) await new Promise((r) => setTimeout(r, wait));
      this.lastRequestAt = Date.now();

      const body = await this.httpGet(url);
      if (!this.isCaptchaResponse(body)) return body;

      if (await this.tryAutoSolveCaptcha(url, body)) {
        this.logger.log("KazUnion: captcha solved automatically — session unlocked");
        continue; // retry the same URL with the now-trusted session
      }

      const delay = KazunionHttpService.CAPTCHA_RETRY_DELAYS_MS[attempt];
      if (delay === undefined) break;
      this.logger.warn(
        `KazUnion: captcha challenge on attempt ${attempt + 1}, retrying in ${delay / 1000}s`,
      );
      await new Promise((r) => setTimeout(r, delay));
    }
    await this.dumpManualCaptcha(url);
    throw new Error(
      `KazUnion: antibot/captcha challenge in response — manual solve required. ` +
        `Image: ${this.lastCaptchaImagePath ?? "n/a"}; ` +
        `run: node scripts/kazunion-captcha-solve.js <digits>`,
    );
  }

  /**
   * Auto-solve the kcaptcha challenge. Wrong digits do NOT invalidate the code
   * (verified live), so every round: fetch a fresh image, collect OCR
   * candidates, POST them all, and verify once with a GET — the server always
   * answers 301 to the POST, only the subsequent GET tells the truth.
   */
  private async tryAutoSolveCaptcha(pageUrl: string, pageBody: string): Promise<boolean> {
    try {
      let imgTag = pageBody.match(/src="([^"]*kcaptcha\/reg\.php[^"]*)"/);
      for (let round = 0; round < KazunionHttpService.CAPTCHA_SOLVE_ROUNDS && imgTag; round++) {
        const img = await this.httpGetRaw(imgTag[1].replace(/&amp;/g, "&"), 0, "image/*");
        const imgPath = path.resolve(process.cwd(), ".kazunion-captcha.jpg");
        fs.writeFileSync(imgPath, img);
        this.lastCaptchaImagePath = imgPath;

        const candidates = await this.ocrCaptcha(imgPath);
        if (candidates.length > 0) {
          this.logger.log(`KazUnion: captcha OCR guesses (round ${round + 1}): ${candidates.join(", ")}`);
        }
        for (const digits of candidates) {
          await this.httpPostForm(
            pageUrl,
            `antibot=${encodeURIComponent(digits)}&samo_action=antibot`,
          );
        }
        await new Promise((r) => setTimeout(r, 300));
        const verify = await this.httpGet(pageUrl);
        if (!this.isCaptchaResponse(verify)) return true;
        imgTag = verify.match(/src="([^"]*kcaptcha\/reg\.php[^"]*)"/);
      }
      return false;
    } catch (err) {
      this.logger.warn(`KazUnion: auto captcha solve failed: ${(err as Error).message}`);
      return false;
    }
  }

  /** OCR candidates via backend/scripts/kazunion-captcha-ocr.py (one per line). */
  private ocrCaptcha(imagePath: string): Promise<string[]> {
    const script = path.resolve(process.cwd(), "scripts", "kazunion-captcha-ocr.py");
    if (!fs.existsSync(script)) return Promise.resolve([]);
    return new Promise((resolve) => {
      execFile(
        "python",
        [script, imagePath],
        { timeout: 90_000, windowsHide: true },
        (err, stdout) => {
          if (err) {
            this.logger.warn(`KazUnion: OCR helper failed: ${err.message}`);
            resolve([]);
            return;
          }
          const candidates = (stdout || "")
            .split(/\r?\n/)
            .map((s) => s.replace(/[^0-9]/g, ""))
            .filter((s) => s.length >= 1);
          resolve([...new Set(candidates)].slice(0, 6));
        },
      );
    });
  }

  /** Save the challenge image + pending URL for a manual solve between runs. */
  private async dumpManualCaptcha(url: string): Promise<void> {
    try {
      const body = await this.httpGet(url);
      const imgTag = body.match(/src="([^"]*kcaptcha\/reg\.php[^"]*)"/);
      if (!imgTag) return;
      const img = await this.httpGetRaw(imgTag[1].replace(/&amp;/g, "&"), 0, "image/*");
      const imgPath = path.resolve(process.cwd(), ".kazunion-captcha.jpg");
      fs.writeFileSync(imgPath, img);
      this.lastCaptchaImagePath = imgPath;
      this.saveJar({ url, image: imgPath });
    } catch (err) {
      this.logger.warn(`KazUnion: failed to dump captcha for manual solve: ${(err as Error).message}`);
    }
  }

  /** Plain string GET (browser-like headers + session cookies). */
  httpGet(url: string, redirectDepth = 0): Promise<string> {
    return this.httpGetRaw(url, redirectDepth).then((b) => b.toString("utf-8"));
  }

  /** Raw byte GET (for captcha images) with cookie jar absorb. */
  private httpGetRaw(url: string, redirectDepth = 0, accept?: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      if (redirectDepth > 5) {
        reject(new Error("Too many redirects"));
        return;
      }
      const headers: Record<string, string> = {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: accept ?? "*/*",
        "Accept-Language": "ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7",
        Referer: "https://online.kazunion.com/search_tour",
      };
      const cookie = this.cookieHeader();
      if (cookie) headers.Cookie = cookie;

      const req = https.get(url, { headers, timeout: 30_000 }, (res) => {
        if (this.absorbCookies(res.headers["set-cookie"])) this.saveJar();
        if (
          res.statusCode &&
          res.statusCode >= 300 &&
          res.statusCode < 400 &&
          res.headers.location
        ) {
          const redirectUrl = new URL(res.headers.location, url).toString();
          this.httpGetRaw(redirectUrl, redirectDepth + 1, accept).then(resolve, reject);
          return;
        }
        if (res.statusCode && res.statusCode >= 400) {
          reject(new Error(`HTTP ${res.statusCode} from ${url}`));
          return;
        }
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => chunks.push(chunk));
        res.on("end", () => resolve(Buffer.concat(chunks)));
        res.on("error", reject);
      });

      req.on("error", reject);
      req.on("timeout", () => {
        req.destroy();
        reject(new Error(`Timeout fetching ${url}`));
      });
    });
  }

  /** urlencoded POST (does NOT follow redirects — the 301 status is the signal). */
  private httpPostForm(
    url: string,
    form: string,
  ): Promise<{ status: number; setCookie: string[] | undefined }> {
    return new Promise((resolve, reject) => {
      const headers: Record<string, string> = {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7",
        Referer: url,
        "Content-Type": "application/x-www-form-urlencoded",
        "Content-Length": String(Buffer.byteLength(form)),
      };
      const cookie = this.cookieHeader();
      if (cookie) headers.Cookie = cookie;

      const req = https.request(
        url,
        { method: "POST", headers, timeout: 30_000 },
        (res) => {
          if (this.absorbCookies(res.headers["set-cookie"])) this.saveJar();
          res.resume();
          res.on("end", () =>
            resolve({ status: res.statusCode ?? 0, setCookie: res.headers["set-cookie"] }),
          );
          res.on("error", reject);
        },
      );
      req.on("error", reject);
      req.on("timeout", () => {
        req.destroy();
        reject(new Error(`Timeout POST ${url}`));
      });
      req.write(form);
      req.end();
    });
  }
}
