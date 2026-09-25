import { Injectable, Logger, OnModuleDestroy } from "@nestjs/common";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import type { FlightSearchQuery } from "../azal/flight.types";
import { parseWizzAirOffers } from "./wizzair.response-parser";
import type {
  WizzAirDiscountClubResponse,
  WizzAirSearchResult,
} from "./wizzair.types";

const WIZZAIR_BASE_URL =
  process.env.WIZZAIR_BASE_URL?.trim() ||
  "https://be.wizzair.com/29.17.0/Api";

const SEARCH_PATH = "/search/search";
const WDC_PATH = "/search/wizzDiscountClub";

@Injectable()
export class WizzAirHttpService implements OnModuleDestroy {
  private readonly logger = new Logger(WizzAirHttpService.name);
  private lastWizzCall = 0;
  private wizzCache = new Map<string, { result: WizzAirSearchResult; timestamp: number }>();
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private cdpLock: Promise<void> = Promise.resolve();

  async search(query: FlightSearchQuery): Promise<WizzAirSearchResult> {
    const cacheKey = `${query.from}-${query.to}-${query.departureDate}-${query.passengers.adults}-${query.passengers.children}-${query.passengers.infants}`;
    const cached = this.wizzCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < 5 * 60 * 1000) {
      this.logger.log(`[WIZZ CACHE HIT] ${cacheKey}`);
      return cached.result;
    }
    // Throttle: ensure at least 5s between Wizz calls (also protects CDP page)
    const now = Date.now();
    const delay = this.lastWizzCall + 5000 - now;
    if (delay > 0) {
      this.logger.log(`[WIZZ THROTTLE] delay ${delay}ms`);
      await new Promise((r) => setTimeout(r, delay));
    }
    this.lastWizzCall = Date.now();
    this.logger.log(`[WIZZ SEARCH START] from=${query.from} to=${query.to} date=${query.departureDate}`);
    const useFixture = this.isFixtureMode();

    if (useFixture) {
      return this.searchFixture(query);
    }

    // Live: CDP Network interception (real Chrome generates KPSDK headers)
    let searchRaw: unknown;
    try {
      searchRaw = await this.searchViaCDP(query);
    } catch (e) {
      const msg = (e as Error).message;
      if (msg.includes("429") || msg.includes("rate limited")) {
        this.logger.warn(`[WIZZ 429] controlled empty result for ${query.from}->${query.to} ${query.departureDate}: ${msg}`);
        // Return empty result per supplier error contract, don't throw to aggregator
        return { source: "WIZZAIR", collectedAt: new Date().toISOString(), requested: query, currencyCode: null, flights: [], discountClub: null, raw: {}, rawDiscountClub: null } as WizzAirSearchResult;
      }
      throw e;
    }

    this.logger.log(
      `[WIZZAIR SEARCH API] status=200 flights=${Array.isArray((searchRaw as any)?.outboundFlights) ? (searchRaw as any).outboundFlights.length : 0}`,
    );

    let discountClub: WizzAirDiscountClubResponse | null = null;
    let rawDiscountClub: Record<string, unknown> | null = null;

    try {
      const wdcRaw = await this.requestJson(`${WIZZAIR_BASE_URL}${WDC_PATH}`, {
        method: "GET",
      });

      if (wdcRaw && typeof wdcRaw === "object") {
        rawDiscountClub = wdcRaw as Record<string, unknown>;
        discountClub = this.normalizeDiscountClub(wdcRaw);
        this.logger.log(
          `[WIZZAIR WDC] memberships=${discountClub.wdcMemberships.length}`,
        );
      }
    } catch (error) {
      // WDC is supplementary. A valid flight search must not fail because
      // the separate membership endpoint is unavailable.
      this.logger.warn(
        `[WIZZAIR WDC] unavailable: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }

    const result = parseWizzAirOffers(searchRaw, query);
    result.discountClub = discountClub;
    result.rawDiscountClub = rawDiscountClub;

    this.logger.log(
      `[WIZZAIR SEARCH PARSED] flights=${result.flights.length} fares=${result.flights.reduce(
        (n, f) => n + f.fares.length,
        0,
      )}`,
    );
    this.logger.log(`[WIZZ SEARCH END] from=${query.from} to=${query.to} date=${query.departureDate}`);
    this.wizzCache.set(cacheKey, { result, timestamp: Date.now() });

    return result;
  }

  private async searchViaCDP(query: FlightSearchQuery): Promise<unknown> {
    // Serialize CDP searches on the same page (no concurrent Wizz searches)
    const release = await this.acquireCdpLock();
    const page = await this.getPage();
    const url = `https://www.wizzair.com/en-gb/booking/select-flight/${query.from.toUpperCase()}/${query.to.toUpperCase()}/${query.departureDate}/null/1/0/0/null`;
    this.logger.log(`[WIZZ CDP SEARCH REQUEST] ${url}`);
    let responseListener: any = () => {};
    let requestFailedListener: any = () => {};
    const timeoutMs = 30_000;
    try {
      const responsePromise = new Promise<{ status: number; body: string }>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error(`Wizz CDP search timeout after ${timeoutMs}ms`)), timeoutMs);
        responseListener = async (response: any) => {
          const req = response.request();
          const rUrl = req.url();
          const method = req.method();
          if (method === "POST" && rUrl.includes("/Api/search/search")) {
            const status = response.status();
            this.logger.log(`[WIZZ CDP SEARCH RESPONSE] status=${status} url=${rUrl}`);
            if (status === 429) {
              clearTimeout(timeout);
              page.off("response", responseListener);
              page.off("requestfailed", requestFailedListener);
              this.logger.warn(`[WIZZ CDP 429]`);
              reject(new Error("Wizz Air HTTP 429: rate limited"));
              return;
            }
            if (status < 200 || status >= 300) {
              clearTimeout(timeout);
              page.off("response", responseListener);
              page.off("requestfailed", requestFailedListener);
              response.text().then((body: string) => reject(new Error(`Wizz Air HTTP ${status}: ${body.slice(0, 500)}`))).catch(() => reject(new Error(`Wizz Air HTTP ${status}`)));
              return;
            }
            try {
              const body = await response.text();
              if (!body || body.trim().length === 0) {
                clearTimeout(timeout);
                page.off("response", responseListener);
                page.off("requestfailed", requestFailedListener);
                reject(new Error("Wizz Air empty response"));
                return;
              }
              clearTimeout(timeout);
              page.off("response", responseListener);
              page.off("requestfailed", requestFailedListener);
              resolve({ status, body });
            } catch (e) {
              clearTimeout(timeout);
              page.off("response", responseListener);
              page.off("requestfailed", requestFailedListener);
              reject(e);
            }
          }
        };
        requestFailedListener = (request: any) => {
          const rUrl = request.url();
          if (rUrl.includes("/Api/search/search") && request.method() === "POST") {
            const failure = request.failure()?.errorText ?? "unknown";
            this.logger.warn(`[WIZZ CDP REQUEST FAILED] ${rUrl} ${failure}`);
          }
        };
        page.on("response", responseListener);
        page.on("requestfailed", requestFailedListener);
        page.goto(url, { waitUntil: "domcontentloaded", timeout: 20_000 }).catch(() => {});
      });
      const { body } = await responsePromise;
      const parsed = JSON.parse(body);
      const result = parsed;
      return result;
    } finally {
      try { page.off("response", responseListener); } catch {}
      try { page.off("requestfailed", requestFailedListener); } catch {}
      release();
    }
  }

  private async acquireCdpLock(): Promise<() => void> {
    let release: () => void = () => {};
    const next = new Promise<void>((resolve) => (release = resolve));
    const prev = this.cdpLock;
    this.cdpLock = next;
    await prev;
    return release;
  }

  private buildSearchPayload(query: FlightSearchQuery) {
    const adults = query.passengers?.adults ?? 1;
    const children = query.passengers?.children ?? 0;
    const infants = query.passengers?.infants ?? 0;

    if (!query.from || !query.to || !query.departureDate) {
      throw new Error(
        "Wizz Air search requires from, to and departureDate.",
      );
    }

    const departureDate = this.toWizzDateTime(query.departureDate);

    return {
      adultCount: adults,
      childCount: children,
      infantCount: infants,
      isFlightChange: false,
      wdc: process.env.WIZZAIR_WDC !== "false",
      flightList: [
        {
          departureStation: query.from.toUpperCase(),
          arrivalStation: query.to.toUpperCase(),
          departureDate,
        },
      ],
    };
  }

  private toWizzDateTime(value: string): string {
    // Wizz's captured browser request uses midnight local ISO without Z:
    // 2026-10-10T00:00:00
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return `${value}T00:00:00`;
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      throw new Error(`Invalid Wizz Air departureDate: ${value}`);
    }

    return `${value.slice(0, 10)}T00:00:00`;
  }

  private async requestJson(
    url: string,
    options: {
      method: "GET" | "POST";
      body?: unknown;
    },
  ): Promise<unknown> {
    // Use browser context for Wizz Air to handle KPSDK/WAF correctly (as in curl with cookies)
    const page = await this.getPage();
    const maxRetries = 3;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const result = await page.evaluate(
        async ({ url, method, body }) => {
          const headers: Record<string, string> = {
            Accept: "application/json, text/plain, */*",
            "x-requestverificationtoken": (document.querySelector('input[name="__RequestVerificationToken"]') as HTMLInputElement)?.value ?? "",
          };
          if (method === "POST") headers["Content-Type"] = "application/json";
          const resp = await fetch(url, {
            method,
            credentials: "include",
            headers,
            body: method === "POST" ? JSON.stringify(body ?? {}) : undefined,
          });
          const text = await resp.text();
          const headersObj: Record<string, string> = {};
          resp.headers.forEach((v, k) => (headersObj[k.toLowerCase()] = v));
          return { status: resp.status, text, headers: headersObj };
        },
        { url, method: options.method, body: options.body },
      );

      const text: string = (result as any).text;
      const status: number = (result as any).status;
      const headers: Record<string, string> = (result as any).headers ?? {};

      if (text.includes("KPSDK") || text.includes("x-kpsdk") || headers["x-kpsdk-ct"]) {
        this.logger.warn(`[WIZZ WAF] KPSDK challenge detected, status=${status}`);
        if (attempt < maxRetries) {
          await new Promise((r) => setTimeout(r, 5000 * Math.pow(2, attempt)));
          continue;
        }
      }

      if (status === 429 && attempt < maxRetries) {
        const retryAfter = Number(headers["retry-after"] ?? headers["Retry-After"] ?? "2");
        const delayMs = (Number.isFinite(retryAfter) ? retryAfter : 2) * 1000 * Math.pow(2, attempt);
        this.logger.warn(`[WIZZ 429] retry ${attempt + 1}/${maxRetries} after ${delayMs}ms`);
        await new Promise((r) => setTimeout(r, delayMs));
        continue;
      }

      if (status < 200 || status >= 300) {
        throw new Error(`Wizz Air HTTP ${status}: ${text.slice(0, 1000)}`);
      }

      try {
        return JSON.parse(text);
      } catch {
        throw new Error(`Wizz Air returned non-JSON response: ${text.slice(0, 1000)}`);
      }
    }
    throw new Error("Wizz Air retry exhausted");
  }

  private async getPage(): Promise<Page> {
    if (this.page && !this.page.isClosed() && this.context && this.context.pages().includes(this.page)) return this.page;
    await this.getBrowser();
    if (!this.context) throw new Error("Wizz Air browser context not initialized");
    this.page = this.context.pages()[0] ?? (await this.context.newPage());
    if (!this.page.url().includes("wizzair.com")) {
      await this.page.goto("https://www.wizzair.com/en-gb", { waitUntil: "domcontentloaded", timeout: 30_000 }).catch(() => {});
      await this.page.waitForTimeout(2000);
    }
    return this.page;
  }

  private async getBrowser(): Promise<Browser> {
    if (this.browser) return this.browser;
    const endpoint = process.env.WIZZ_CHROME_CDP_URL || process.env.AZAL_CHROME_CDP_URL || "http://127.0.0.1:9222";
    this.logger.log(`[WIZZ CHROME CDP] connecting to ${endpoint}`);
    try {
      this.browser = await chromium.connectOverCDP(endpoint);
    } catch {
      // Fallback: launch new browser if CDP not available (for Wizz Air, use headless)
      this.logger.log("[WIZZ] CDP not available, launching headless");
      this.browser = await chromium.launch({ headless: true });
    }
    const contexts = this.browser.contexts();
    this.context = contexts[0] ?? (await this.browser.newContext({ userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/153.0.0.0 Safari/537.36" }));
    return this.browser;
  }

  async onModuleDestroy(): Promise<void> {
    this.browser = null; this.context = null; this.page = null;
  }

  private normalizeDiscountClub(raw: unknown): WizzAirDiscountClubResponse {
    const root =
      raw && typeof raw === "object"
        ? (raw as Record<string, any>)
        : {};

    const memberships = Array.isArray(root.wdcMemberships)
      ? root.wdcMemberships.map((membership: any) => ({
          membership:
            typeof membership?.membership === "string"
              ? membership.membership
              : null,
          membershipPrice: this.normalizeDiscount(membership?.membershipPrice),
          promotedMembershipPrice: this.normalizeDiscount(
            membership?.promotedMembershipPrice,
          ),
          code:
            typeof membership?.code === "string" ? membership.code : null,
          minimumDiscounts: {
            fares: Array.isArray(membership?.minimumDiscounts?.fares)
              ? membership.minimumDiscounts.fares.map((fare: any) => ({
                  discount: this.normalizeDiscount(fare?.discount),
                  minimumFare: this.normalizeDiscount(fare?.minimumFare),
                }))
              : [],
            baggage: this.normalizeDiscount(
              membership?.minimumDiscounts?.baggage,
            ),
            prb: this.normalizeDiscount(membership?.minimumDiscounts?.prb),
            seat: this.normalizeDiscount(membership?.minimumDiscounts?.seat),
          },
          promotionDetails: membership?.promotionDetails ?? null,
        }))
      : [];

    return {
      wdcMemberships: memberships,
      isAnyCustomerProgramChanges:
        root.isAnyCustomerProgramChanges === true,
    };
  }

  private normalizeDiscount(value: unknown) {
    if (!value || typeof value !== "object") return null;

    const p = value as Record<string, any>;

    return {
      amount:
        typeof p.amount === "number" && Number.isFinite(p.amount)
          ? p.amount
          : null,
      currencyCode:
        typeof p.currencyCode === "string" ? p.currencyCode : null,
      exchangedAmount:
        typeof p.exchangedAmount === "number" &&
        Number.isFinite(p.exchangedAmount)
          ? p.exchangedAmount
          : null,
      exchangedCurrencyCode:
        typeof p.exchangedCurrencyCode === "string"
          ? p.exchangedCurrencyCode
          : null,
    };
  }

  private isFixtureMode(): boolean {
    const mode = process.env.WIZZAIR_MODE?.trim().toLowerCase();

    if (mode === "fixture") return true;
    if (mode === "live") return false;

    // Live is now the default. Fixture is opt-in.
    return false;
  }

  private searchFixture(query: FlightSearchQuery): WizzAirSearchResult {
    const file = this.resolveResponseFile();

    if (!file) {
      throw new Error(
        "Wizz Air fixture not found. Set WIZZAIR_RESPONSE_FILE or place response_wizzair.txt in the backend working directory.",
      );
    }

    const rawText = readFileSync(file, "utf8");
    const raw = JSON.parse(rawText) as unknown;
    const result = parseWizzAirOffers(raw, query);

    this.logger.log(
      `[WIZZAIR SEARCH FIXTURE] file=${file} flights=${result.flights.length} fares=${result.flights.reduce(
        (n, f) => n + f.fares.length,
        0,
      )}`,
    );

    return result;
  }

  private resolveResponseFile(): string | null {
    const configured = process.env.WIZZAIR_RESPONSE_FILE?.trim();

    const candidates = [
      configured,
      resolve(process.cwd(), "response_wizzair.txt"),
      resolve(process.cwd(), "fixtures", "response_wizzair.txt"),
      resolve(process.cwd(), "data", "response_wizzair.txt"),
    ].filter((value): value is string => Boolean(value));

    return candidates.find((candidate) => existsSync(candidate)) ?? null;
  }
}


