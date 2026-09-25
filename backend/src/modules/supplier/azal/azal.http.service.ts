import { Injectable, Logger, OnModuleDestroy } from "@nestjs/common";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import {
  AzalCalendarRequest,
  AzalCalendarResult,
  AzalFlightSearchQuery,
  AzalFlightSearchResult,
  AzalHistogramRequest,
  AzalHistogramResult,
} from "./azal.types";
import { parseAzalOffers } from "./azal.response-parser";
import path from "path";

@Injectable()
export class AzalHttpService implements OnModuleDestroy {
  private readonly logger = new Logger(AzalHttpService.name);

  private browser: Browser | null = null;

  /**
   * AZAL keeps authentication/session information in the browser context.
   * A fresh context for every request loses x-auth-token/x-conversation.
   *
   * Keep one context alive and refresh it only when it is no longer usable.
   */
  private context: BrowserContext | null = null;
  private page: Page | null = null;

  private authToken: string | null = null;
  private conversation: string | null = null;
  private lastSearchContext: {
    from: string;
    to: string;
    departureDate: string;
    tripType: string;
    adultCount: number;
    childCount: number;
    infantCount: number;
    isStudent: number;
  } | null = null;

  private pageClientError: string | null = null;
  private capturedPage: Page | null = null;

  private static readonly BASE_URL = "https://www.azal.az";
  private static readonly OFFERS_PATH =
    "/book/api/flights/search/by-deeplink/offers";
  private static readonly CALENDAR_PATH =
    "/book/api/flights/search/calendar";
  private static readonly HISTOGRAM_PATH =
    "/book/api/flights/search/histograms";

  private static readonly USER_AGENT =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
    "(KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36";

  async search(query: AzalFlightSearchQuery): Promise<AzalFlightSearchResult> {
    this.validateSearchQuery(query);

    this.lastSearchContext = {
      from: query.from,
      to: query.to,
      departureDate: query.departureDate,
      tripType: query.tripType,
      adultCount: query.adults,
      childCount: query.children ?? 0,
      infantCount: query.infants ?? 0,
      isStudent: query.isStudent ? 1 : 0,
    };

    return this.withPage(async (page) => {
      // IMPORTANT: do not depend on AZAL's Next.js bootstrap here.
      // In automated Chrome the native min-price/city bootstrap and several
      // _next chunks can be WAF-blocked. The browser page itself is reachable,
      // and the same persistent browser context can call the AZAL API directly.
      await this.ensureAzalBrowserClearance(page);

      // IMPORTANT: never navigate to /book/select here. That route is currently
      // Cloudflare-protected and can replace an otherwise usable AZAL page with
      // a Turnstile challenge. Keep the persistent browser on the normal AZAL
      // origin and call the flight API directly from that browser context.
      this.logger.log(
        `[AZAL SEARCH BROWSER] url=${page.url()} title=${await page.title().catch(() => "")}`,
      );

      const offersUrl = this.buildOffersUrl(query);
      this.logger.log(`[AZAL SEARCH API] ${offersUrl}`);

      const raw = await this.browserFetchJson(
        page,
        offersUrl,
        "GET",
        undefined,
        false,
        this.buildBookSelectReferrer(offersUrl),
      );

      const debugSearch =
		raw && typeof raw === "object"
			? (raw as any).search
			: null;

	  const debugOption =
		debugSearch?.optionSets?.[0]?.options?.[0];

	  this.logger.log(
		`[AZAL FIRST OPTION RAW] ${JSON.stringify(debugOption)}`
	  );
	  const root =
        raw && typeof raw === "object" ? (raw as Record<string, any>) : {};
      const search =
        root.search && typeof root.search === "object"
          ? (root.search as Record<string, any>)
          : {};
      const optionSets = Array.isArray(search.optionSets)
        ? search.optionSets
        : [];
      const optionCount = optionSets.reduce(
        (sum: number, set: any) =>
          sum + (Array.isArray(set?.options) ? set.options.length : 0),
        0,
      );

      this.logger.log(
        `[AZAL OFFERS JSON] search=${Boolean(root.search)} optionSets=${optionSets.length} options=${optionCount}`,
      );

      try {
        const parsed = parseAzalOffers(raw, query);
        const flights = Array.isArray((parsed as any)?.flights)
          ? (parsed as any).flights.length
          : 0;
        const fares = Array.isArray((parsed as any)?.fares)
          ? (parsed as any).fares.length
          : 0;

        this.logger.log(
          `[AZAL OFFERS PARSED] flights=${flights} fares=${fares}`,
        );

        return parsed;
      } catch (error) {
        this.logger.error(
          `[AZAL OFFERS PARSE ERROR] ${error instanceof Error ? error.stack || error.message : String(error)}`,
        );
        throw error;
      }
    });
  }

  private async ensureAzalBrowserClearance(page: Page): Promise<void> {
    const deadline = Date.now() + 120_000;

    while (Date.now() < deadline) {
      if (page.isClosed()) {
        throw new Error("AZAL Chrome page was closed during Cloudflare verification.");
      }

      const url = page.url();
      const title = await page.title().catch(() => "");
      const body = await page.locator("body").innerText().catch(() => "");
      const challenge =
        /just a moment|security verification|verify you are human|checking your browser/i.test(
          `${title} ${body.slice(0, 3000)}`,
        );

      if (url.includes("azal.az") && !challenge) {
        this.logger.log(
          `[AZAL CF READY] url=${url} title="${title}"`,
        );
        return;
      }

      if (challenge) {
        this.logger.warn(
          `[AZAL CF WAIT] Cloudflare verification is active in the user's Chrome. Complete the checkbox in that Chrome window; waiting up to 120s.`,
        );
      }

      await page.waitForTimeout(2_000);
    }

    throw new Error(
      `AZAL Cloudflare verification was not completed within 120s. ` +
        `Open the connected Chrome window, complete "Verify you are human", then retry the search.`,
    );
  }

  async calendar(request: AzalCalendarRequest): Promise<AzalCalendarResult> {
    if (!request.from || !request.to) {
      throw new Error("AZAL calendar requires from and to");
    }

    return this.withPage(async (page) => {
      await this.ensureAzalBrowserClearance(page);

      const payload = {
        searchParams: {
          citizenship: request.citizenship ?? null,
          passengersAmount: {
            adults: request.adults,
            children: request.children ?? 0,
            infants: request.infants ?? 0,
          },
          promoCode: request.promoCode ?? "",
          routes: [{ arrival: request.to, departure: request.from }],
          location: null,
          childrenDatesOfBirth: null,
        },
      };

      const raw = await this.browserFetchJson(
        page,
        `${AzalHttpService.BASE_URL}${AzalHttpService.CALENDAR_PATH}`,
        "POST",
        payload,
      );

      return {
        source: "AZAL",
        collectedAt: new Date().toISOString(),
        prices: this.normalizeCalendar(raw),
        raw,
      };
    });
  }

  async histograms(
    request: AzalHistogramRequest,
  ): Promise<AzalHistogramResult> {
    if (!request.optionSetId) {
      throw new Error("AZAL histogram requires optionSetId");
    }

    return this.withPage(async (page) => {
      await this.ensureAzalBrowserClearance(page);

      this.logger.log(
        `[AZAL HISTOGRAM SESSION] authToken=${Boolean(this.authToken)} conversation=${Boolean(this.conversation)}`,
      );

      const raw = await this.browserFetchJson(
        page,
        `${AzalHttpService.BASE_URL}${AzalHttpService.HISTOGRAM_PATH}`,
        "POST",
        request,
      );

      return {
        source: "AZAL",
        collectedAt: new Date().toISOString(),
        optionSetId: request.optionSetId,
        raw,
      };
    });
  }

  private buildOffersUrl(query: AzalFlightSearchQuery): string {
    const requestedLanguage = String((query as any).language ?? "en").toLowerCase();
    const lang = ["az", "en", "ru"].includes(requestedLanguage)
      ? requestedLanguage
      : "en";

    const params = new URLSearchParams({
      lang,
      from: query.from,
      to: query.to,
      departure_date: query.departureDate,
      tripType: query.tripType,
      adult_count: String(query.adults),
      child_count: String(query.children ?? 0),
      infant_count: String(query.infants ?? 0),
      is_student: query.isStudent ? "1" : "0",
      timestamp: String(Date.now()),
    });
    if (query.tripType === "RT" && query.returnDate) {
      params.set("return_date", query.returnDate);
      params.set("returnDate", query.returnDate);
    }

    return `${AzalHttpService.BASE_URL}${AzalHttpService.OFFERS_PATH}?${params.toString()}`;
  }

  private buildBookSelectReferrer(offersUrl: string): string {
    const url = new URL(offersUrl);
    return `${AzalHttpService.BASE_URL}/book/select?${url.searchParams.toString()}`;
  }

  /**
   * Returns the same AZAL browser context for the lifetime of the service.
   * This is important because x-auth-token/x-conversation belong to the
   * browser session, not to an individual NestJS request.
   */
  private async withPage<T>(fn: (page: Page) => Promise<T>): Promise<T> {
    const page = await this.getPage();

    try {
      return await fn(page);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

// Preserve the current AZAL browser session on API auth errors.
// Recreating the session here would destroy captured session headers and
// hide the actual AZAL response needed for diagnosis.

      if (this.page?.isClosed()) {
        this.page = null;
      }

      throw error;
    }
  }

  /** Our AZAL page: azal.az itself or a Cloudflare challenge on it. */
  private isOwnPage(page: Page): boolean {
    const url = page.url();
    return url.includes("azal.az") || url.includes("cloudflare.com");
  }

  /**
   * A tab we may keep without adopting someone else's page:
   * our AZAL tab or a fresh blank tab.
   */
  private isKeepablePage(page: Page | null): page is Page {
    return Boolean(
      this.isReusablePage(page) &&
        (this.isOwnPage(page) || page.url() === "about:blank"),
    );
  }

  private isReusablePage(page: Page | null): page is Page {
    return Boolean(
      page &&
        !page.isClosed() &&
        this.context &&
        this.context.pages().includes(page),
    );
  }

  private findAzalPage(): Page | null {
    if (!this.context) {
      return null;
    }

    return (
      this.context.pages().find(
        (p) => !p.isClosed() && this.isOwnPage(p),
      ) ?? null
    );
  }

  private async getPage(): Promise<Page> {
    if (
      this.isReusablePage(this.page) &&
      this.isOwnPage(this.page)
    ) {
      return this.page;
    }

    // Do NOT call resetSession() here: the persistent Chrome context contains
    // the Cloudflare clearance/cookies we need to preserve.
    await this.getBrowser();

    if (!this.context) {
      throw new Error("AZAL persistent browser context was not initialized");
    }

    // Adopt only an AZAL/Cloudflare tab or our own fresh tab
    // (e.g. about:blank after a failed goto) — never pages()[0]
    // blindly; otherwise create a dedicated AZAL tab.
    this.page =
      this.findAzalPage() ??
      (this.isKeepablePage(this.page) ? this.page : null) ??
      (await this.context.newPage());

    this.installSessionCapture(this.page);

    // The real AZAL frontend creates its own min-price/city request.
    // We only observe it; we never call it ourselves.
    if (!this.isOwnPage(this.page)) {
      await this.page.goto(`${AzalHttpService.BASE_URL}/az/#flight`, {
        waitUntil: "domcontentloaded",
        timeout: 60_000,
      });
    }

    this.logger.log(
      `[AZAL SESSION PAGE] url=${this.page.url()} title=${await this.page.title().catch(() => "")}`,
    );

    // Give the real browser flow a short opportunity to create the token.
    // Cloudflare-aware Search will handle manual verification if necessary.
    for (let i = 0; i < 10 && !this.authToken; i += 1) {
      if (!this.page || this.page.isClosed()) {
        throw new Error(
          `AZAL page closed during session initialization${
            this.pageClientError ? `: ${this.pageClientError}` : ""
          }`,
        );
      }

      try {
        await this.page.waitForTimeout(500);
      } catch (error) {
        throw new Error(
          `AZAL page/context closed during session initialization: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }

    this.logger.log(
      `[AZAL SESSION READY] authToken=${Boolean(this.authToken)} conversation=${Boolean(this.conversation)}`,
    );

    return this.page;
  }

  /**
   * Capture the session headers that AZAL attaches to its real browser
   * requests. Do not hardcode these values: both are session-specific.
   */
  private installSessionCapture(page: Page): void {
    if (this.capturedPage === page) {
      return;
    }

    this.capturedPage = page;
    this.pageClientError = null;

    page.on("pageerror", (error) => {
      const message = error?.stack || error?.message || String(error);
      this.pageClientError = message.slice(0, 2000);
      this.logger.error(`[AZAL PAGE ERROR] ${this.pageClientError}`);
    });

    page.on("console", (message) => {
      const type = message.type();
      if (!["error", "warning"].includes(type)) {
        return;
      }

      const location = message.location();
      this.logger.warn(
        `[AZAL CONSOLE ${type.toUpperCase()}] ${JSON.stringify({
          text: message.text().slice(0, 2000),
          url: location.url,
          lineNumber: location.lineNumber,
          columnNumber: location.columnNumber,
        })}`,
      );
    });

    page.on("requestfailed", (request) => {
      this.logger.error(
        `[AZAL REQUEST FAILED] ${JSON.stringify({
          method: request.method(),
          url: request.url(),
          failure: request.failure()?.errorText ?? "unknown",
          resourceType: request.resourceType(),
        })}`,
      );
    });

    page.on("request", (request) => {
      const url = request.url();

      if (url.includes("/book/api/flights/search/")) {
        const headers = request.headers();
        this.logger.log(
          `[AZAL DIAG REQUEST] ${JSON.stringify({
            method: request.method(),
            url,
            resourceType: request.resourceType(),
            hasAuth: Boolean(headers["x-auth-token"]),
            hasConversation: Boolean(headers["x-conversation"]),
          })}`,
        );
      }
      const headers = request.headers();

      const beforeAuth = Boolean(this.authToken);
      const beforeConversation = Boolean(this.conversation);

      this.captureSessionHeaders(headers);

      const hasInterestingSessionHeader =
        Boolean(headers["x-auth-token"]) ||
        Boolean(headers["x-conversation"]);
      const isAzalFlightApi =
        request.url().includes("/book/api/flights/search/");

      if (hasInterestingSessionHeader || isAzalFlightApi) {
        this.logger.log(
          `[AZAL SESSION REQUEST] ${JSON.stringify({
            method: request.method(),
            url: request.url(),
            xAuthToken: Boolean(headers["x-auth-token"]),
            xConversation: Boolean(headers["x-conversation"]),
            authTokenCaptured:
              !beforeAuth && Boolean(this.authToken),
            conversationCaptured:
              !beforeConversation && Boolean(this.conversation),
          })}`,
        );
      }
    });

    page.on("response", async (response) => {
      const url = response.url();

      if (url.includes("/book/api/flights/search/")) {
        const status = response.status();

        if (status >= 400) {
          this.logger.error(
            `[AZAL DIAG RESPONSE ERROR] ${JSON.stringify({
              status,
              url,
              resourceType: response.request().resourceType(),
              contentType: response.headers()["content-type"] ?? "",
            })}`,
          );
        }
      }

      const requestHeaders = response.request().headers();
      const beforeAuth = Boolean(this.authToken);
      const beforeConversation = Boolean(this.conversation);

      this.captureSessionHeaders(requestHeaders);

      try {
        const responseHeaders = await response.allHeaders();
        this.captureSessionHeaders(responseHeaders);

        const isAzalFlightApi =
          response.url().includes("/book/api/flights/search/");

        if (
          responseHeaders["x-auth-token"] ||
          responseHeaders["x-conversation"] ||
          isAzalFlightApi
        ) {
          this.logger.log(
            `[AZAL SESSION RESPONSE] ${JSON.stringify({
              status: response.status(),
              url: response.url(),
              xAuthToken: Boolean(responseHeaders["x-auth-token"]),
              xConversation: Boolean(responseHeaders["x-conversation"]),
              authTokenCaptured:
                !beforeAuth && Boolean(this.authToken),
              conversationCaptured:
                !beforeConversation && Boolean(this.conversation),
            })}`,
          );
        }
      } catch {
        // Some browser responses do not expose all headers.
      }
    });
  }

  private captureSessionHeaders(
    headers: Record<string, string | undefined>,
  ): void {
    const authToken =
      headers["x-auth-token"] ??
      headers["X-Auth-Token"] ??
      headers["x-authToken"];

    const conversation =
      headers["x-conversation"] ??
      headers["X-Conversation"] ??
      headers["x-conversation-id"];

    if (authToken) {
      this.authToken = authToken;
    }

    if (conversation) {
      this.conversation = conversation;
    }
  }

  private async browserFetchJson(
    page: Page,
    url: string,
    method: "GET" | "POST",
    body?: unknown,
    _includeSessionHeaders = false,
    referrer?: string,
  ): Promise<any> {
    // IMPORTANT: this request executes inside the user's real Chrome page.
    // Therefore Chrome supplies the current cf_clearance/__cf_bm/etc. cookies
    // automatically. We deliberately do not copy those secrets into Node.js.
    const result = await page.evaluate(
      async ({ url, method, body, referrer, authToken, conversation }) => {
        const headers: Record<string, string> = {
          Accept: "application/json, text/plain, */*",
          "x-application": "ibe",
          "x-client-id": "ibe",
          "x-locale": new URL(url).searchParams.get("lang") || "en",
        };

        if (authToken) {
          headers["x-auth-token"] = authToken;
        }

        if (conversation) {
          headers["x-conversation"] = conversation;
        }

        if (method === "POST") {
          headers["Content-Type"] = "application/json";
        }

        const response = await fetch(url, {
          method,
          credentials: "include",
          referrer: referrer || undefined,
          referrerPolicy: "strict-origin-when-cross-origin",
          headers,
          body: method === "POST" ? JSON.stringify(body ?? {}) : undefined,
        });

        const responseText = await response.text();
        const bodyBytes = new TextEncoder().encode(responseText).byteLength;

        if (!response.ok) {
          throw new Error(
            `AZAL HTTP ${response.status}: ${responseText.slice(0, 1000)}`,
          );
        }

        let parsed: any;
        try {
          parsed = JSON.parse(responseText);
        } catch {
          throw new Error(
            `AZAL returned non-JSON response: ${responseText.slice(0, 1000)}`,
          );
        }

        return {
          __azalMeta: {
            status: response.status,
            bodyBytes,
            contentType: response.headers.get("content-type") || "",
          },
          data: parsed,
        };
      },
      {
        url,
        method,
        body,
        referrer,
        authToken: this.authToken,
        conversation: this.conversation,
      },
    );

    const meta = result?.__azalMeta ?? {};
    const data = result?.data ?? result;

    this.logger.log(
      `[AZAL OFFERS RESPONSE] status=${meta.status ?? "?"} bytes=${meta.bodyBytes ?? "?"} contentType=${meta.contentType || "?"}`,
    );

    return data;
  }

  private normalizeCalendar(raw: unknown): Record<string, any> {
    const root =
      raw && typeof raw === "object" ? (raw as Record<string, any>) : {};

    const prices =
      root.prices && typeof root.prices === "object" ? root.prices : {};

    return Object.fromEntries(
      Object.entries(prices).map(([date, value]) => {
        const v =
          value && typeof value === "object"
            ? (value as Record<string, any>)
            : {};

        return [
          date,
          {
            date,
            outbound: v.outbound,
            inbound: v.inbound,
          },
        ];
      }),
    );
  }

  private validateSearchQuery(query: AzalFlightSearchQuery): void {
    if (!query.from || !query.to) {
      throw new Error("AZAL search requires from and to");
    }

    if (!query.departureDate) {
      throw new Error("AZAL search requires departureDate");
    }

    if (!["OW", "RT"].includes(query.tripType)) {
      throw new Error("AZAL tripType must be OW or RT");
    }

    if (!Number.isInteger(query.adults) || query.adults < 1) {
      throw new Error("AZAL adults must be an integer >= 1");
    }
  }

  private async getBrowser(): Promise<Browser> {
    if (this.browser) {
      return this.browser;
    }

    const endpoint =
      process.env.AZAL_CHROME_CDP_URL || "http://127.0.0.1:9222";

    this.logger.log(`[AZAL CHROME CDP] connecting to ${endpoint}`);

    try {
      this.browser = await chromium.connectOverCDP(endpoint);
    } catch (error) {
      throw new Error(
        `Cannot connect to the user's Chrome over CDP at ${endpoint}. ` +
          `Start Chrome with --remote-debugging-port=9222 and keep the AZAL tab open. ` +
          `Original error: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    const contexts = this.browser.contexts();
    this.context = contexts[0] ?? null;

    if (!this.context) {
      throw new Error("Connected Chrome has no browser context.");
    }

    // Adopt only an existing AZAL tab (or keep our own fresh tab,
    // or create one). Never fall back to context.pages()[0] blindly.
    this.page =
      this.findAzalPage() ??
      (this.isKeepablePage(this.page) ? this.page : null) ??
      (await this.context.newPage());

    this.installSessionCapture(this.page);

    if (!this.isOwnPage(this.page)) {
      await this.page.goto(`${AzalHttpService.BASE_URL}/az/#flight`, {
        waitUntil: "domcontentloaded",
        timeout: 60_000,
      });
    }

    this.logger.log(
      `[AZAL CDP PAGE] url=${this.page.url()} title=${await this.page.title().catch(() => "")}`,
    );

    return this.browser;
  }

  private async resetSession(): Promise<void> {
    // CDP is attached to the user's Chrome. Never close the user's context or
    // browser from NestJS; only forget our Playwright references.
    this.authToken = null;
    this.conversation = null;
    this.pageClientError = null;
    this.capturedPage = null;
    this.page = null;
    this.context = null;

    // The Browser object is attached to the user's real Chrome through CDP.
    // Do not disconnect/close the user's Chrome process from NestJS.
    this.browser = null;
  }

  async onModuleDestroy(): Promise<void> {
    await this.resetSession();
  }

}
