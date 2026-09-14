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
  PriceCalendarQuery,
  PriceCalendarResult,
  PriceCalendarEntry,
} from "../supplier.types";

/**
 * Summertour adapter — implements SupplierAdapter using Playwright.
 *
 * Source: summertour.az (SAMO engine, PHP).
 * The site uses a JavaScript SPA that loads prices via AJAX after DOM ready.
 * Direct HTTP no longer returns price data — Playwright is required.
 * Auth: anonymous (cookie SAMO auto-issued). Booking requires B2B login (out of scope).
 *
 * V3: Supports multi-program discovery (TOURINC), 31-day date windows,
 * and pagination (5 pages per search).
 */
@Injectable()
export class SummertourAdapter implements SupplierAdapter, OnModuleDestroy {
  readonly code = "SUMMERTOUR";
  readonly name = "Summertour (summertour.az)";
  readonly enabled = true;

  private readonly logger = new Logger(SummertourAdapter.name);
  private browser: Browser | null = null;
  private readonly browserLock = new Map<string, Promise<Browser>>();

  /** Maximum pages to scrape per search (SAMO shows up to 5). */
  private static readonly MAX_PAGES = 5;
  /** Delay between page clicks (ms) to avoid SAMO rate limiting. */
  private static readonly PAGE_DELAY_MS = 2_000;
  /** Delay after TOURINC selection (ms) to let SAMO re-render. */
  private static readonly TOURINC_DELAY_MS = 2_000;

  // ── Program Discovery ─────────────────────────────────────────────

  /** Discover all available TOURINC programs from SAMO form. */
  async discoverPrograms(): Promise<Array<{ value: string; name: string }>> {
    let page: Page | null = null;
    try {
      const browser = await this.getBrowser();
      const context = await browser.newContext({
        userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        locale: "ru-RU",
      });
      page = await context.newPage();

      await page.goto("https://summertour.az/search_tour", {
        waitUntil: "networkidle",
        timeout: 60_000,
      });
      await page.waitForFunction(
        () => typeof (window as any).samo !== "undefined" && (window as any).samo.page_ready === true,
        { timeout: 15_000 },
      );

      const programs = await page.evaluate(() => {
        const sel = document.querySelector("select[name=TOURINC]") as HTMLSelectElement | null;
        if (!sel) return [];
        return Array.from(sel.options)
          .filter((o) => o.value !== "0" && o.value !== "")
          .map((o) => ({ value: o.value, name: o.text.trim() }));
      });

      await context.close();
      this.logger.log(`Discovered ${programs.length} Summer programs`);
      return programs;
    } catch (err) {
      this.logger.error(`Program discovery failed: ${(err as Error).message}`);
      if (page) await page.context().close().catch(() => {});
      return [];
    }
  }

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

      // Set TOURINC program if specified
      if (query.tourIncValue) {
        await page.evaluate((val: string) => {
          const sel = document.querySelector("select[name=TOURINC]") as HTMLSelectElement | null;
          if (sel) {
            sel.value = val;
            sel.dispatchEvent(new Event("change", { bubbles: true }));
          }
        }, query.tourIncValue);
        await page.waitForTimeout(SummertourAdapter.TOURINC_DELAY_MS);
        this.logger.debug(`Set TOURINC to ${query.tourIncValue} (${query.tourIncName ?? "?"})`);
      }

      // Set date range via Playwright fill (triggers SAMO's internal handlers)
      if (query.departureDateFrom && query.departureDateTo) {
        const begInput = await page.$("input[name=CHECKIN_BEG]");
        const endInput = await page.$("input[name=CHECKIN_END]");
        if (begInput && endInput) {
          const begFormatted = this.isoToSamodate(query.departureDateFrom);
          const endFormatted = this.isoToSamodate(query.departureDateTo);
          await begInput.click({ clickCount: 3 });
          await begInput.fill(begFormatted);
          await page.waitForTimeout(200);
          await endInput.click({ clickCount: 3 });
          await endInput.fill(endFormatted);
          await page.waitForTimeout(200);
          this.logger.debug(`Set date range: ${begFormatted} → ${endFormatted}`);
        }
      }

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

      // Extract offers from current page
      const allOffers: any[] = [];
      let currentPageOffers = await this.extractPageOffers(page);
      allOffers.push(...currentPageOffers);

      // Paginate through remaining pages
      const maxPages = SummertourAdapter.MAX_PAGES;
      for (let p = 2; p <= maxPages; p++) {
        const hasNextPage = await page.evaluate((targetPage: number) => {
          const spans = document.querySelectorAll(".pager span.page");
          const target = Array.from(spans).find(
            (s) => s.getAttribute("data-page") === String(targetPage),
          );
          if (target) {
            (target as HTMLElement).click();
            return true;
          }
          return false;
        }, p);

        if (!hasNextPage) break;

        await page.waitForTimeout(SummertourAdapter.PAGE_DELAY_MS);

        // Wait for new rows to appear
        try {
          await page.waitForSelector("tr.price_info", { timeout: 10_000 });
        } catch {
          break;
        }
        await page.waitForTimeout(1_000);

        currentPageOffers = await this.extractPageOffers(page);
        if (currentPageOffers.length === 0) break;
        allOffers.push(...currentPageOffers);
        this.logger.debug(`Page ${p}: ${currentPageOffers.length} offers`);
      }

      await context.close();

      const latency = Date.now() - startTime;
      this.logger.log(
        `Summertour Playwright: ${allOffers.length} offers in ${latency}ms` +
        (query.tourIncName ? ` [program=${query.tourIncName}]` : ""),
      );

      return allOffers.map((o) => this.normalizeOffer(o, query));
    } catch (err) {
      this.logger.error(`Summertour Playwright search failed: ${(err as Error).message}`);
      if (page) {
        await page.context().close().catch(() => {});
      }
      throw err;
    }
  }

  /** Extract offers from the current page's tr.price_info rows. */
  private async extractPageOffers(page: Page): Promise<any[]> {
    return page.evaluate(() => {
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

        // Table columns: [0]checkbox [1]Заезд [2]Тур [3]Ночей [4]Гостиница [5]Места [6]Питание [7]Номер/Размещение [8-9]empty [10]Цена [11-12]empty [13]Транспорт [14]Класс
        const cells = row.querySelectorAll("td");
        let roomText = "";
        let mealText = "";
        if (cells.length >= 8) {
          mealText = cells[6]?.textContent?.trim() ?? "";
          roomText = cells[7]?.textContent?.trim() ?? "";
        }

        results.push({
          hotelKey, spoKey, tourKey, mealKey, roomKey,
          nights, checkIn, adults, children,
          claim, hotel, price: parseFloat(price), currency,
          departureDate, transport,
          roomText, mealText,
        });
      }
      return results;
    });
  }

  /** Convert ISO date (YYYY-MM-DD) to SAMO format (DD.MM.YYYY). */
  private isoToSamodate(iso: string): string {
    const [y, m, d] = iso.split("-");
    return `${d}.${m}.${y}`;
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
      room: raw.roomText || raw.roomKey || undefined,
      meal: raw.mealText || raw.mealKey || undefined,
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
        roomText: raw.roomText,
        mealText: raw.mealText,
        catClaim: raw.claim,
        tourIncValue: query.tourIncValue,
        tourIncName: query.tourIncName,
      },
    };
  }

  private parseCheckInDate(checkIn: string): string {
    if (/^\d{8}$/.test(checkIn)) {
      return `${checkIn.slice(0, 4)}-${checkIn.slice(4, 6)}-${checkIn.slice(6, 8)}`;
    }
    return checkIn;
  }

  // ── Re-check via targeted search ─────────────────────────────────

  async getOffer(ref: SupplierOfferRef): Promise<SupplierOfferDetail> {
    const ctx = ref.searchContext;
    const query: SupplierSearchQuery = {
      country: ctx.country,
      departureCity: ctx.departureCity,
      destination: ctx.destination,
      adults: ctx.adults,
      children: ctx.children,
      childAges: ctx.childAges,
      hotel: ctx.hotel,
      room: ctx.room,
      meal: ctx.meal,
      nightsFrom: ctx.nightsFrom,
      nightsTo: ctx.nightsTo,
      departureDateFrom: ctx.departureDateFrom,
      departureDateTo: ctx.departureDateTo,
      tourIncValue: ctx.tourIncValue,
      tourIncName: ctx.tourIncName,
    };

    const offers = await this.search(query);
    const match = offers.find((o) => o.externalOfferId === ref.externalOfferId);

    if (match) {
      return {
        ...match,
        packageComposition: undefined,
        oldPrice: undefined,
        priceType: undefined,
      };
    }

    // Fallback: return not-found snapshot
    return {
      supplierCode: this.code,
      externalOfferId: ref.externalOfferId,
      externalClaim: ref.externalClaim,
      hotel: ref.searchContext.hotel ?? "Unknown",
      departureDate: ctx.departureDateFrom ?? "",
      nights: ctx.nightsFrom ?? 0,
      adults: ctx.adults,
      children: ctx.children ?? 0,
      childAges: ctx.childAges ?? [],
      price: { amount: 0, currency: "USD", fetchedAt: new Date(), expiresAt: new Date(), queryHash: "", source: this.code },
      availability: "NOT_AVAILABLE",
      fetchedAt: new Date(),
      expiresAt: new Date(),
      packageComposition: "",
    };
  }

  async refreshPrice(ref: SupplierOfferRef): Promise<SupplierPriceSnapshot> {
    const ctx = ref.searchContext;
    const query: SupplierSearchQuery = {
      country: ctx.country,
      departureCity: ctx.departureCity,
      destination: ctx.destination,
      adults: ctx.adults,
      children: ctx.children,
      childAges: ctx.childAges,
      hotel: ctx.hotel,
      room: ctx.room,
      meal: ctx.meal,
      nightsFrom: ctx.nightsFrom,
      nightsTo: ctx.nightsTo,
      departureDateFrom: ctx.departureDateFrom,
      departureDateTo: ctx.departureDateTo,
      tourIncValue: ctx.tourIncValue,
      tourIncName: ctx.tourIncName,
    };

    const offers = await this.search(query);
    const match = offers.find((o) => o.externalOfferId === ref.externalOfferId);

    if (match) {
      return match.price;
    }

    // Not found — return zero price
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
    const ctx = ref.searchContext;
    const query: SupplierSearchQuery = {
      country: ctx.country,
      departureCity: ctx.departureCity,
      destination: ctx.destination,
      adults: ctx.adults,
      children: ctx.children,
      childAges: ctx.childAges,
      hotel: ctx.hotel,
      room: ctx.room,
      meal: ctx.meal,
      nightsFrom: ctx.nightsFrom,
      nightsTo: ctx.nightsTo,
      departureDateFrom: ctx.departureDateFrom,
      departureDateTo: ctx.departureDateTo,
      tourIncValue: ctx.tourIncValue,
      tourIncName: ctx.tourIncName,
    };

    const offers = await this.search(query);
    const match = offers.find((o) => o.externalOfferId === ref.externalOfferId);

    return {
      availability: match ? match.availability : "NOT_AVAILABLE",
      fetchedAt: new Date(),
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    };
  }

  // ── Price Calendar ───────────────────────────────────────────────

  async getPriceCalendar(query: PriceCalendarQuery): Promise<PriceCalendarResult> {
    const searchQuery: SupplierSearchQuery = {
      country: "turkey",
      departureCity: "baku",
      destination: undefined,
      adults: query.adults,
      children: query.children,
      childAges: query.childAges,
      hotel: query.hotel,
      hotelExternalId: query.hotelExternalId,
      room: query.room,
      meal: query.meal,
      nightsFrom: query.nights,
      nightsTo: query.nights,
      departureDateFrom: query.dateFrom,
      departureDateTo: query.dateTo,
      tourIncValue: (query as any).tourIncValue,
      tourIncName: (query as any).tourIncName,
    };

    const offers = await this.search(searchQuery);

    // Filter to matching hotel if specified
    const filtered = query.hotel
      ? offers.filter((o) => o.hotel === query.hotel || o.hotelExternalId === query.hotelExternalId)
      : offers;

    // Group by departure date, find best price per date
    const dateMap = new Map<string, SupplierOffer[]>();
    for (const offer of filtered) {
      const existing = dateMap.get(offer.departureDate) || [];
      existing.push(offer);
      dateMap.set(offer.departureDate, existing);
    }

    const entries: PriceCalendarEntry[] = [];
    for (const [date, dateOffers] of dateMap) {
      // Find best (lowest price) offer for this date
      const sorted = dateOffers.sort((a, b) => a.price.amount - b.price.amount);
      const best = sorted[0];

      entries.push({
        date,
        price: best.price.amount,
        currency: best.price.currency,
        availability: best.availability,
        offerCount: dateOffers.length,
        bestOfferRef: {
          supplierCode: this.code,
          externalOfferId: best.externalOfferId,
          externalClaim: best.externalClaim,
          searchContext: {
            adults: query.adults,
            children: query.children,
            childAges: query.childAges,
            hotel: query.hotel,
            room: query.room,
            meal: query.meal,
            nightsFrom: query.nights,
            nightsTo: query.nights,
            tourIncValue: (query as any).tourIncValue,
            tourIncName: (query as any).tourIncName,
          },
        },
      });
    }

    // Sort entries by date
    entries.sort((a, b) => a.date.localeCompare(b.date));

    const now = new Date();
    return {
      supplierCode: this.code,
      contextHash: JSON.stringify({
        hotel: query.hotel,
        room: query.room,
        meal: query.meal,
        adults: query.adults,
        children: query.children,
        childAges: query.childAges,
        nights: query.nights,
      }),
      entries,
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
      fetchedAt: now,
      expiresAt: new Date(now.getTime() + 5 * 60 * 1000),
      totalOffersScanned: filtered.length,
    };
  }
}
