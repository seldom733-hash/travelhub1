import { Injectable, Logger, OnModuleDestroy } from "@nestjs/common";
import { chromium, type Browser, type Page } from "playwright";
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
 * Summertour adapter — implements SupplierAdapter using Playwright.
 *
 * Source: summertour.az (SAMO engine, PHP).
 * The site uses a JavaScript SPA that loads prices via AJAX after DOM ready.
 * Direct HTTP no longer returns price data — Playwright is required.
 * Auth: anonymous (cookie SAMO auto-issued). Booking requires B2B login (out of scope).
 */
@Injectable()
export class SummertourAdapter implements SupplierAdapter, OnModuleDestroy {
  readonly code = "SUMMERTOUR";
  readonly name = "Summertour (summertour.az)";
  readonly enabled = true;

  private readonly logger = new Logger(SummertourAdapter.name);
  private browser: Browser | null = null;
  private readonly browserLock = new Map<string, Promise<Browser>>();

  // ── Search (Playwright-based) ─────────────────────────────────────

  async search(query: SupplierSearchQuery): Promise<SupplierOffer[]> {
    const startTime = Date.now();
    let page: Page | null = null;

    try {
      const browser = await this.getBrowser();
      const context = await browser.newContext({
        userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        locale: "ru-RU",
      });
      page = await context.newPage();

      // Navigate to search page
      this.logger.debug("Summertour Playwright: navigating to search_tour");
      await page.goto("https://summertour.az/search_tour", {
        waitUntil: "networkidle",
        timeout: 60_000,
      });

      // Wait for SAMO framework
      await page.waitForFunction(
        () => typeof (window as any).samo !== "undefined" && (window as any).samo.page_ready === true,
        { timeout: 15_000 },
      );

      // Click the search button to trigger AJAX price loading
      const searchBtn = await page.$(".load");
      if (!searchBtn) {
        this.logger.warn("Summertour Playwright: .load button not found");
        await context.close();
        return [];
      }

      await searchBtn.click();

      // Wait for price rows
      try {
        await page.waitForSelector("tr.price_info", { timeout: 30_000 });
      } catch {
        this.logger.warn("Summertour Playwright: no price_info rows appeared");
        await context.close();
        return [];
      }

      // Wait for all rows to finish rendering
      await page.waitForTimeout(2_000);

      // Extract offers
      const offers = await page.evaluate(() => {
        const rows = document.querySelectorAll("tr.price_info");
        const results: any[] = [];
        for (const row of rows) {
          const classes = row.className;
          const hotelKey = classes.match(/hotelKey-(\d+)/)?.[1] ?? "";
          const spoKey = classes.match(/spoKey-(\d+)/)?.[1] ?? "";
          const tourKey = classes.match(/tourKey-(\d+)/)?.[1] ?? "";
          const mealKey = classes.match(/mealKey-(\d+)/)?.[1] ?? "";
          const roomKey = classes.match(/roomKey-(\d+)/)?.[1] ?? "";
          const nights = parseInt(classes.match(/nights-(\d+)/)?.[1] ?? "0");
          const checkIn = classes.match(/checkIn-(\d+)/)?.[1] ?? "";
          const adults = parseInt(classes.match(/adult-(\d+)/)?.[1] ?? "0");
          const children = parseInt(classes.match(/child-(\d+)/)?.[1] ?? "0");
          const claim = row.getAttribute("data-cat-claim") ?? "";

          const hotel = row.querySelector(".link-hotel")?.textContent?.trim() ?? "";
          const priceEl = row.querySelector("[data-cat-price]");
          const price = priceEl?.getAttribute("data-cat-price") ?? "0";
          const currency = priceEl?.getAttribute("data-currency_title") ?? "USD";
          const departureDate = row.querySelector(".sortie")?.textContent?.trim() ?? "";
          const transport = row.querySelector(".transport")?.textContent?.trim() ?? "";

          results.push({
            hotelKey, spoKey, tourKey, mealKey, roomKey,
            nights, checkIn, adults, children,
            claim, hotel, price: parseFloat(price), currency,
            departureDate, transport,
          });
        }
        return results;
      });

      await context.close();

      const latency = Date.now() - startTime;
      this.logger.log(`Summertour Playwright: ${offers.length} offers in ${latency}ms`);

      return offers.map((o) => this.normalizeOffer(o, query));
    } catch (err) {
      this.logger.error(`Summertour Playwright search failed: ${(err as Error).message}`);
      if (page) {
        await page.context().close().catch(() => {});
      }
      throw err;
    }
  }

  // ── Browser Lifecycle ─────────────────────────────────────────────

  private async getBrowser(): Promise<Browser> {
    if (this.browser && this.browser.isConnected()) {
      return this.browser;
    }

    // Prevent multiple concurrent launches
    const lockKey = "default";
    if (this.browserLock.has(lockKey)) {
      return this.browserLock.get(lockKey)!;
    }

    const launchPromise = chromium.launch({ headless: true });
    this.browserLock.set(lockKey, launchPromise);

    try {
      this.browser = await launchPromise;
      this.logger.log("Summertour Playwright browser launched");
      return this.browser;
    } finally {
      this.browserLock.delete(lockKey);
    }
  }

  async onModuleDestroy() {
    if (this.browser) {
      await this.browser.close().catch(() => {});
      this.browser = null;
    }
  }

  // ── Normalize raw scraped data to SupplierOffer ───────────────────

  private normalizeOffer(raw: any, query: SupplierSearchQuery): SupplierOffer {
    const now = new Date();

    // Parse departure date: "15.09.2026, Вт\n                                    \n                                            07:55"
    const dateStr = raw.departureDate.replace(/\s+/g, " ").trim();
    const dateMatch = dateStr.match(/(\d{2})\.(\d{2})\.(\d{4})/);
    const departureDate = dateMatch
      ? `${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}`
      : this.parseCheckInDate(raw.checkIn);

    return {
      supplierCode: this.code,
      externalOfferId: raw.spoKey,
      externalClaim: raw.claim,
      hotel: raw.hotel,
      hotelExternalId: raw.hotelKey || undefined,
      tour: raw.tourKey || undefined,
      departureDate,
      nights: raw.nights,
      room: raw.roomKey || undefined,
      meal: raw.mealKey || undefined,
      adults: raw.adults || (query.adults ?? 2),
      children: raw.children || (query.children ?? 0),
      childAges: query.childAges ?? [],
      price: {
        amount: raw.price,
        currency: raw.currency,
        fetchedAt: now,
        expiresAt: new Date(now.getTime() + 5 * 60 * 1000),
        queryHash: "",
        source: this.code,
      },
      availability: "AVAILABLE" as SupplierAvailability,
      transport: raw.transport || undefined,
      fetchedAt: now,
      expiresAt: new Date(now.getTime() + 5 * 60 * 1000),
      rawMetadata: {
        spoKey: raw.spoKey,
        hotelKey: raw.hotelKey,
        tourKey: raw.tourKey,
        mealKey: raw.mealKey,
        roomKey: raw.roomKey,
        catClaim: raw.claim,
      },
    };
  }

  private parseCheckInDate(checkIn: string): string {
    if (/^\d{8}$/.test(checkIn)) {
      return `${checkIn.slice(0, 4)}-${checkIn.slice(4, 6)}-${checkIn.slice(6, 8)}`;
    }
    return checkIn;
  }

  // ── Stub methods (not used for search flow) ───────────────────────

  async getOffer(ref: SupplierOfferRef): Promise<SupplierOfferDetail> {
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
      packageComposition: "",
    };
  }

  async refreshPrice(ref: SupplierOfferRef): Promise<SupplierPriceSnapshot> {
    return {
      amount: 0,
      currency: "USD",
      fetchedAt: new Date(),
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      queryHash: JSON.stringify(ref.searchContext),
      source: this.code,
    };
  }

  async refreshAvailability(ref: SupplierOfferRef): Promise<SupplierAvailabilitySnapshot> {
    return {
      availability: "UNKNOWN",
      fetchedAt: new Date(),
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    };
  }
}
