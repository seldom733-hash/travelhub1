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

    return this.withPage(async (page) => {
      const url = this.buildOffersUrl(query);
      const raw = await this.browserFetchJson(page, url, "GET");
      return parseAzalOffers(raw, query);
    });
  }

  async calendar(request: AzalCalendarRequest): Promise<AzalCalendarResult> {
    if (!request.from || !request.to) {
      throw new Error("AZAL calendar requires from and to");
    }

    return this.withPage(async (page) => {
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
    const params = new URLSearchParams({
      lang: "az",
      from: query.from,
      to: query.to,
      departure_date: query.departureDate,
      tripType: query.tripType,
      adult_count: String(query.adults),
      child_count: String(query.children ?? 0),
      infant_count: String(query.infants ?? 0),
      is_student: query.isStudent ? "true" : "false",
      timestamp: String(Date.now()),
    });

    return `${AzalHttpService.BASE_URL}${AzalHttpService.OFFERS_PATH}?${params.toString()}`;
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

      // AZAL explicitly reports expired/missing session in this form.
      // Recreate the browser session once and retry the operation.
      if (
        /auth\.token\.header\.required/i.test(message) ||
        /sessiyanızın vaxtı bitdi/i.test(message) ||
        /session.*expired/i.test(message)
      ) {
        this.logger.warn(
          "AZAL session expired or authentication headers are missing; recreating browser session",
        );

        await this.resetSession();

        return await fn(await this.getPage());
      }

      throw error;
    }
  }

  private async getPage(): Promise<Page> {
    if (
      this.page &&
      !this.page.isClosed() &&
      this.context &&
      this.context.pages().includes(this.page)
    ) {
      return this.page;
    }

    await this.resetSession();

    const browser = await this.getBrowser();

    this.context = await browser.newContext({
      userAgent: AzalHttpService.USER_AGENT,
      locale: "az-AZ",
      timezoneId: "Asia/Baku",
      extraHTTPHeaders: {
        Accept: "application/json, text/plain, */*",
        "x-application": "ibe",
        "x-client-id": "ibe",
        "x-locale": "az",
      },
    });

    this.page = await this.context.newPage();

    this.installSessionCapture(this.page);

    await this.page.goto(`${AzalHttpService.BASE_URL}/az/#flight`, {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });

    return this.page;
  }

  /**
   * Capture the session headers that AZAL attaches to its real browser
   * requests. Do not hardcode these values: both are session-specific.
   */
  private installSessionCapture(page: Page): void {
    page.on("request", (request) => {
      this.captureSessionHeaders(request.headers());
    });

    page.on("response", async (response) => {
      this.captureSessionHeaders(response.request().headers());

      // Some AZAL flows can return the session headers from a response.
      // Header access is intentionally best-effort.
      try {
        this.captureSessionHeaders(await response.allHeaders());
      } catch {
        // Ignore inaccessible/expired response headers.
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
  ): Promise<any> {
    const authToken = this.authToken;
    const conversation = this.conversation;

    const result = await page.evaluate(
      async ({ url, method, body, authToken, conversation }) => {
        const headers: Record<string, string> = {
          Accept: "application/json, text/plain, */*",
          "Content-Type": "application/json",
          "x-application": "ibe",
          "x-client-id": "ibe",
          "x-locale": "az",
        };

        if (authToken) {
          headers["x-auth-token"] = authToken;
        }

        if (conversation) {
          headers["x-conversation"] = conversation;
        }

        const response = await fetch(url, {
          method,
          credentials: "include",
          headers,
          body: method === "POST" ? JSON.stringify(body ?? {}) : undefined,
        });

        const text = await response.text();

        if (!response.ok) {
          throw new Error(
            `AZAL HTTP ${response.status}: ${text.slice(0, 500)}`,
          );
        }

        try {
          return JSON.parse(text);
        } catch {
          throw new Error(
            `AZAL returned non-JSON response: ${text.slice(0, 500)}`,
          );
        }
      },
      { url, method, body, authToken, conversation },
    );

    return result;
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

    this.browser = await chromium.launch({
      headless: true,
    });

    return this.browser;
  }

  private async resetSession(): Promise<void> {
    this.authToken = null;
    this.conversation = null;

    if (this.page) {
      await this.page.close().catch(() => {});
      this.page = null;
    }

    if (this.context) {
      await this.context.close().catch(() => {});
      this.context = null;
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.resetSession();

    if (this.browser) {
      await this.browser.close().catch(() => {});
      this.browser = null;
    }
  }
}
