import { Injectable, Logger } from "@nestjs/common";
import * as https from "https";
import { recordCatalogPage } from "../catalog/catalog-coverage";
import {
  buildVoyagerFormUrl,
  buildVoyagerPricesParams,
  buildVoyagerHotelFormUrl,
  buildVoyagerHotelPricesParams,
  VOYAGER_HOTEL_BASE_URL,
  type VoyagerPricesParams,
} from "./voyager.request-builder";
import {
  extractHtmlFromJs,
  isCaptchaResponse,
  isNoDataResponse,
  parseChecklistbox,
  parsePriceRows,
  parseSelectOptions,
  parseTotalPages,
  type VoyagerOfferRow,
} from "./voyager.response-parser";
import { parseSamoHotelDynamic, type SamoHotelEntry } from "../samo-hotel-dict";

/**
 * Voyager HTTP transport (plain HTTPS — verified live 2026-10-21: no browser
 * session and no captcha on repeated probes).
 *
 * Mirrors kazunion-http.service (same SAMO engine family) minus the captcha
 * OCR machinery: Voyager has not served a challenge so far; the detector
 * stays and a challenge THROWS (never silently "0 rows").
 *
 *  • paced queue: MIN_REQUEST_INTERVAL_MS between requests, serialized;
 *  • PRICEPAGE pagination (100 rows/page), dedupe by row identity;
 *  • dictionary: STATEINC/TOURINC selects + TOWNS/STARS/MEALS checklistboxes
 *    + inline samo.hotelDynamic hotels, per-state form fetch, cached;
 *  • «Нет данных» is an explicit empty answer; anything else without rows
 *    throws (never fake "0 offers").
 */

export interface VoyagerState {
  value: string;
  name: string;
}

export interface VoyagerProgram {
  value: string;
  name: string;
}

export interface VoyagerDictionary {
  /** STATEINC options (all countries of the supplier). */
  states: VoyagerState[];
  /** TOURINC options for the state (program fan-out source). */
  programs: VoyagerProgram[];
  /** MEALS checklistbox (AI=10001 …). */
  meals: Array<{ value: string; name: string }>;
  /** TOWNS checklistbox (city/district filter). */
  towns: Array<{ value: string; name: string }>;
  /** STARS checklistbox (5* → 10012 …). */
  stars: Array<{ value: string; name: string }>;
  /** Inline samo.hotelDynamic hotel dictionary (state-scoped). */
  hotels: SamoHotelEntry[];
}

export type VoyagerFetchParams = VoyagerPricesParams;

@Injectable()
export class VoyagerHttpService {
  private static readonly BASE_URL = "https://online.voyagergroup.az/search_tour";
  /** Voyager answered plain probes instantly; 1.5s pacing stays polite. */
  private static readonly MIN_REQUEST_INTERVAL_MS = 1_500;

  private readonly logger = new Logger(VoyagerHttpService.name);

  /** Serialized request queue (search/sync callers cannot race the clock). */
  private requestQueue: Promise<unknown> = Promise.resolve();
  private lastRequestAt = 0;

  /** Dictionary cache: stateInc → dictionary (2h TTL). */
  private readonly dictCache = new Map<string, { dict: VoyagerDictionary; at: number }>();
  private static readonly DICT_TTL_MS = 2 * 60 * 60 * 1000;

  /** Hotel-form dictionary cache (SEPARATE from the tour form — verified:
   * /search_hotel serves 16 states vs 10 on /search_tour). */
  private readonly hotelDictCache = new Map<string, { dict: VoyagerDictionary; at: number }>();

  // ── Dictionary ─────────────────────────────────────────────────────────

  /** All states available (from the Baku form). */
  async discoverStates(): Promise<VoyagerState[]> {
    return (await this.fetchDictionary()).states;
  }

  /** All stay-only states (separate hotel dictionary). */
  async discoverHotelStates(): Promise<VoyagerState[]> {
    return (await this.fetchHotelDictionary("0")).states;
  }

  /** TOURINC programs for a state (cached form fetch). */
  async discoverPrograms(stateInc: string): Promise<VoyagerProgram[]> {
    return (await this.fetchDictionary(stateInc)).programs;
  }

  /** Fetch + parse the search form for a state (cached per state, 2h). */
  async fetchDictionary(stateInc = "0"): Promise<VoyagerDictionary> {
    const cached = this.dictCache.get(stateInc);
    if (cached && Date.now() - cached.at < VoyagerHttpService.DICT_TTL_MS) {
      return cached.dict;
    }

    const body = await this.pacedGet(buildVoyagerFormUrl(stateInc));
    if (isCaptchaResponse(body)) {
      throw new Error("Voyager: captcha/antibot challenge on the form request");
    }

    const dict: VoyagerDictionary = {
      states: parseSelectOptions(body, "STATEINC", true),
      programs: parseSelectOptions(body, "TOURINC", true),
      meals: parseChecklistbox(body, "MEALS"),
      towns: parseChecklistbox(body, "TOWNS"),
      stars: parseChecklistbox(body, "STARS"),
      hotels: parseSamoHotelDynamic(body),
    };
    this.dictCache.set(stateInc, { dict, at: Date.now() });

    this.logger.debug(
      `Voyager dictionary STATEINC=${stateInc}: states=${dict.states.length} programs=${dict.programs.length} ` +
        `towns=${dict.towns.length} stars=${dict.stars.length} meals=${dict.meals.length} hotels=${dict.hotels.length}`,
    );
    return dict;
  }

  /** TOURINC hotel programs for a state (cached stay-form fetch). */
  async discoverHotelPrograms(stateInc: string): Promise<VoyagerProgram[]> {
    return (await this.fetchHotelDictionary(stateInc)).programs;
  }

  /** Fetch + parse the STAY-ONLY search form for a state (cached per state, 2h). */
  async fetchHotelDictionary(stateInc = "0"): Promise<VoyagerDictionary> {
    const cached = this.hotelDictCache.get(stateInc);
    if (cached && Date.now() - cached.at < VoyagerHttpService.DICT_TTL_MS) {
      return cached.dict;
    }

    const body = await this.pacedGet(buildVoyagerHotelFormUrl(stateInc));
    if (isCaptchaResponse(body)) {
      throw new Error("Voyager: captcha/antibot challenge on the HOTEL form request");
    }

    const dict: VoyagerDictionary = {
      states: parseSelectOptions(body, "STATEINC", true),
      programs: parseSelectOptions(body, "TOURINC", true),
      meals: parseChecklistbox(body, "MEALS"),
      towns: parseChecklistbox(body, "TOWNS"),
      stars: parseChecklistbox(body, "STARS"),
      hotels: parseSamoHotelDynamic(body),
    };
    this.hotelDictCache.set(stateInc, { dict, at: Date.now() });

    this.logger.debug(
      `Voyager HOTEL dictionary STATEINC=${stateInc}: states=${dict.states.length} programs=${dict.programs.length} ` +
        `towns=${dict.towns.length} stars=${dict.stars.length} meals=${dict.meals.length} hotels=${dict.hotels.length}`,
    );
    return dict;
  }

  // ── PRICES ─────────────────────────────────────────────────────────────

  /**
   * Fetch all price rows for the params, paginating PRICEPAGE until the pager
   * is exhausted or maxPages is reached. Default maxPages=5 (500 rows) keeps
   * UI searches fast; sync jobs raise it.
   */
  async fetchPrices(params: VoyagerFetchParams, maxPages = 5): Promise<VoyagerOfferRow[]> {
    return this.fetchPagedPrices(
      VoyagerHttpService.BASE_URL,
      buildVoyagerPricesParams,
      params,
      maxPages,
      `STATEINC=${params.stateInc}`,
    );
  }

  /**
   * Stay-only PRICES (`/search_hotel`) — same row family, separate endpoint.
   * Pagination contract verified live 2026-10-22: page 2 replays page 1
   * WITHOUT DOLOAD=1 (the builder always sends it).
   */
  async fetchHotelPrices(params: VoyagerFetchParams, maxPages = 5): Promise<VoyagerOfferRow[]> {
    return this.fetchPagedPrices(
      VOYAGER_HOTEL_BASE_URL,
      buildVoyagerHotelPricesParams,
      params,
      maxPages,
      `HOTELS STATEINC=${params.stateInc}`,
    );
  }

  /** Shared paginated PRICES sweep (tour + hotel endpoints). */
  private async fetchPagedPrices(
    baseUrl: string,
    paramsBuilder: (params: VoyagerPricesParams, page: number) => Record<string, string>,
    params: VoyagerFetchParams,
    maxPages: number,
    label: string,
  ): Promise<VoyagerOfferRow[]> {
    const rows: VoyagerOfferRow[] = [];
    const seen = new Set<string>();
    let added = 0;

    for (let page = 1; page <= maxPages; page++) {
      const p = paramsBuilder(params, page);
      const qs = Object.entries(p)
        .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
        .join("&");
      const body = await this.pacedGet(`${baseUrl}?${qs}`);

      if (isCaptchaResponse(body)) {
        throw new Error(
          `Voyager: captcha/antibot challenge on PRICES (${label}, page ${page})`,
        );
      }

      const html = extractHtmlFromJs(body);
      if (!html) {
        // No results table: ONLY an explicit «Нет данных» is a legitimate
        // empty answer. Anything else (soft block, error page, unexpected
        // envelope) must throw — never silently record "0 offers".
        if (isNoDataResponse(body)) {
          this.logger.debug(
            `Voyager ${label}: supplier answered "no data" (page ${page})`,
          );
          break;
        }
        throw new Error(
          `Voyager: unexpected PRICES response for ${label} ` +
            `(page ${page}, len=${body.length}, captcha=${isCaptchaResponse(body)})`,
        );
      }

      const pageRows = parsePriceRows(html);
      added = 0;
      for (const row of pageRows) {
        const id = `${row.hotelKey}|${row.tourKey}|${row.spoKey}|${row.checkIn}|${row.roomKey}|${row.mealKey}`;
        if (seen.has(id)) continue;
        seen.add(id);
        rows.push(row);
        added++;
      }

      const totalPages = parseTotalPages(body, html);
      recordCatalogPage(page, totalPages, maxPages < totalPages);
      this.logger.debug(
        `Voyager ${label} page ${page}/${totalPages}: +${added} → ${rows.length} rows`,
      );
      if (added === 0 || page >= totalPages) break;
    }

    this.logger.debug(
      `Voyager ${label} ${params.checkInBeg}→${params.checkInEnd}: ${rows.length} rows`,
    );
    return rows;
  }

  // ── HTTP plumbing ──────────────────────────────────────────────────────

  /** Plain string GET (browser-like headers). Paced + serialized. */
  httpGet(url: string, redirectDepth = 0): Promise<string> {
    return this.httpGetRaw(url, redirectDepth).then((b) => b.toString("utf-8"));
  }

  /** Paced GET: all callers share one queue; MIN interval is enforced. */
  async pacedGet(url: string): Promise<string> {
    const task = this.requestQueue.then(async () => {
      const wait =
        VoyagerHttpService.MIN_REQUEST_INTERVAL_MS - (Date.now() - this.lastRequestAt);
      if (wait > 0) await new Promise((r) => setTimeout(r, wait));
      this.lastRequestAt = Date.now();
      return this.httpGet(url);
    });
    this.requestQueue = task.catch(() => undefined);
    return task;
  }

  private httpGetRaw(url: string, redirectDepth = 0): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      if (redirectDepth > 5) {
        reject(new Error("Too many redirects"));
        return;
      }
      const headers = {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "*/*",
        "Accept-Language": "ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7",
        Referer: "https://online.voyagergroup.az/search_tour",
      };

      const req = https.get(url, { headers, timeout: 60_000 }, (res) => {
        if (
          res.statusCode &&
          res.statusCode >= 300 &&
          res.statusCode < 400 &&
          res.headers.location
        ) {
          const redirectUrl = new URL(res.headers.location, url).toString();
          this.httpGetRaw(redirectUrl, redirectDepth + 1).then(resolve, reject);
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
}
