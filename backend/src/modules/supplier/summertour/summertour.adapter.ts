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

      // Set date range via Playwright FIRST (before TOURINC — SAMO resets dates on TOURINC change).
      // P0 (HIMEROS matrix E2E): click+fill was fragile — on a warm browser the
      // input lookup could fail silently and SAMO searched its default dates
      // (tomorrow) returning 0 rows. Use evaluate-based set + explicit logging.
      if (query.departureDateFrom && query.departureDateTo) {
        await this.setSamoDateInput(page, "CHECKIN_BEG", query.departureDateFrom);
        await this.setSamoDateInput(page, "CHECKIN_END", query.departureDateTo);
      }

      // Set nights/adults/children/ages AFTER dates, BEFORE TOURINC.
      // P0 (HIMEROS matrix E2E): without these, SAMO silently applies form
      // defaults (7 nights / 2 adults / 0 children) — 7n vs 8n searches were
      // returning identical offers. Order: dates → occupancy → TOURINC.
      if (query.nightsFrom) {
        await this.setSamoSelect(page, "NIGHTS_FROM", String(query.nightsFrom));
      }
      if (query.nightsTo) {
        await this.setSamoSelect(page, "NIGHTS_TILL", String(query.nightsTo));
      }
      if (query.adults && query.adults > 0) {
        await this.setSamoSelect(page, "ADULT", String(query.adults));
      }
      if (query.children !== undefined && query.children !== null) {
        await this.setSamoSelect(page, "CHILD", String(query.children));
      }
      const ages = query.childAges ?? [];
      if (ages.length >= 1) {
        await this.setSamoSelect(page, "AGE1", String(ages[0]));
      }
      if (ages.length >= 2) {
        await this.setSamoSelect(page, "AGE2", String(ages[1]));
      }
      if (ages.length >= 3) {
        await this.setSamoSelect(page, "AGE3", String(ages[2]));
      }

      // Set TOURINC program if specified (AFTER dates — SAMO change event may reset date inputs)
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

  /**
   * Set a SAMO date input (DD.MM.YYYY) via evaluate (no visibility requirement)
   * with input/change event dispatch. Warns loudly when the input is missing so
   * silent default-date searches cannot happen unnoticed.
   */
  private async setSamoDateInput(page: Page, name: string, isoDate: string): Promise<void> {
    const value = this.isoToSamodate(isoDate);
    try {
      const ok = await page.evaluate(
        ({ name, value }: { name: string; value: string }) => {
          const input = document.querySelector(`input[name=${name}]`) as HTMLInputElement | null;
          if (!input) return false;
          input.value = value;
          input.dispatchEvent(new Event("input", { bubbles: true }));
          input.dispatchEvent(new Event("change", { bubbles: true }));
          return true;
        },
        { name, value },
      );
      if (ok) {
        await page.waitForTimeout(200);
        this.logger.debug(`Set SAMO ${name} = ${value} (evaluate)`);
      } else {
        const inputs = await page.evaluate(() =>
          Array.from(document.querySelectorAll("input")).map((i) => i.name).filter(Boolean).join(","),
        );
        this.logger.warn(`SAMO input ${name} NOT FOUND — date not applied. Page inputs: [${inputs.slice(0, 300)}]`);
      }
    } catch (err) {
      this.logger.warn(`SAMO input ${name} set failed: ${(err as Error).message}`);
    }
  }

  /**
   * Set a SAMO form <select> by name with change event dispatch.
   * Returns false if the select or option value does not exist (caller proceeds with SAMO default).
   */
  private async setSamoSelect(page: Page, name: string, value: string): Promise<boolean> {
    try {
      const ok = await page.evaluate(
        ({ name, value }: { name: string; value: string }) => {
          const sel = document.querySelector(`select[name=${name}]`) as HTMLSelectElement | null;
          if (!sel) return false;
          const opt = Array.from(sel.options).find((o) => o.value === value);
          if (!opt) return false;
          sel.value = value;
          sel.dispatchEvent(new Event("change", { bubbles: true }));
          return true;
        },
        { name, value },
      );
      if (ok) {
        await page.waitForTimeout(300);
        this.logger.debug(`Set SAMO ${name} = ${value}`);
      } else {
        this.logger.warn(`SAMO select ${name} = ${value} not set (missing select/option)`);
      }
      return ok;
    } catch {
      return false;
    }
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

  /** Maximum days per SAMO search window (SAMO enforces ≤31). */
  private static readonly CALENDAR_WINDOW_DAYS = 31;

  /**
   * Split a date range into contiguous ≤31-day windows.
   * No gaps between windows: window[i].to + 1 day = window[i+1].from.
   */
  generateCalendarWindows(from: string, to: string): Array<{ from: string; to: string }> {
    const windows: Array<{ from: string; to: string }> = [];
    const maxDays = SummertourAdapter.CALENDAR_WINDOW_DAYS;
    let current = new Date(from);
    const end = new Date(to);

    while (current <= end) {
      const windowEnd = new Date(current);
      windowEnd.setDate(windowEnd.getDate() + maxDays - 1);
      if (windowEnd > end) windowEnd.setTime(end.getTime());

      windows.push({
        from: this.formatDate(current),
        to: this.formatDate(windowEnd),
      });

      // Next window starts day after this one ends (contiguous, no gaps).
      current = new Date(windowEnd);
      current.setDate(current.getDate() + 1);
    }

    return windows;
  }

  private formatDate(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  async getPriceCalendar(query: PriceCalendarQuery): Promise<PriceCalendarResult> {
    const now = new Date();

    // Split the requested range into ≤31-day windows (§6/§7).
    const windows = this.generateCalendarWindows(query.dateFrom, query.dateTo);
    this.logger.debug(
      `PriceCalendar: ${query.dateFrom}→${query.dateTo} split into ${windows.length} window(s)`,
    );

    // Base search params shared by every program search in this calendar request.
    const baseSearch: SupplierSearchQuery = {
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
    };

    // Determine program list: explicit multi-program merge, single program, or none.
    const programs = (query.tourIncValues?.length ?? 0) > 0
      ? query.tourIncValues!.map((v, i) => ({ value: v, name: query.tourIncNames?.[i] }))
      : query.tourIncValue
        ? [{ value: query.tourIncValue, name: query.tourIncName }]
        : [];

    // Run one real search per (window × program) combination.
    // Windows × programs = total SAMO searches. Sequential to respect rate limits.
    const collected: SupplierOffer[] = [];
    let totalScanned = 0;

    for (const window of windows) {
      if (programs.length > 0) {
        for (const program of programs) {
          try {
            const offers = await this.search({
              ...baseSearch,
              departureDateFrom: window.from,
              departureDateTo: window.to,
              tourIncValue: program.value,
              tourIncName: program.name,
            });
            collected.push(...offers);
            totalScanned += offers.length;
            this.logger.debug(
              `Calendar window ${window.from}→${window.to} program ${program.value}: ${offers.length} offers`,
            );
          } catch (err) {
            this.logger.warn(
              `Calendar window ${window.from}→${window.to} program ${program.value} failed: ${(err as Error).message}`,
            );
          }
        }
      } else {
        // No program specified — single unfiltered search per window (legacy behavior).
        try {
          const offers = await this.search({
            ...baseSearch,
            departureDateFrom: window.from,
            departureDateTo: window.to,
          });
          collected.push(...offers);
          totalScanned += offers.length;
        } catch (err) {
          this.logger.warn(
            `Calendar window ${window.from}→${window.to} failed: ${(err as Error).message}`,
          );
        }
      }
    }

    // Filter to matching hotel if specified
    const filtered = query.hotel
      ? collected.filter((o) => o.hotel === query.hotel || o.hotelExternalId === query.hotelExternalId)
      : collected;

    // Deduplicate by spoKey across windows (same offer may appear in adjacent windows).
    const deduped = this.deduplicateCalendarOffers(filtered);

    // Group by departure date, then keep ALL real offers per date (per program).
    const dateMap = new Map<string, SupplierOffer[]>();
    for (const offer of deduped) {
      const existing = dateMap.get(offer.departureDate) || [];
      existing.push(offer);
      dateMap.set(offer.departureDate, existing);
    }

    // §8 Generate COMPLETE date set from dateFrom to dateTo inclusive.
    // Every date must appear in the calendar — with price OR absence reason.
    const allDates: string[] = [];
    {
      let cur = new Date(query.dateFrom);
      const end = new Date(query.dateTo);
      while (cur <= end) {
        allDates.push(this.formatDate(cur));
        cur.setDate(cur.getDate() + 1);
      }
    }

    const entries: PriceCalendarEntry[] = [];
    for (const date of allDates) {
      const dateOffers = dateMap.get(date);

      if (dateOffers && dateOffers.length > 0) {
        // Best (lowest price) offer for this date across all programs
        const sorted = dateOffers.sort((a, b) => a.price.amount - b.price.amount);
        const best = sorted[0];

        entries.push({
          date,
          price: best.price.amount,
          currency: best.price.currency,
          availability: best.availability,
          offerCount: dateOffers.length,
          offers: sorted.map((o) => ({
            tourIncValue: (o.rawMetadata?.tourIncValue as string) ?? "",
            tourIncName: (o.rawMetadata?.tourIncName as string) ?? undefined,
            externalOfferId: o.externalOfferId,
            externalClaim: o.externalClaim,
            price: o.price.amount,
            currency: o.price.currency,
            transport: o.transport,
            oneWay: /no return|без обратного/i.test((o.rawMetadata?.tourIncName as string) ?? ""),
          })),
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
              tourIncValue: (best.rawMetadata?.tourIncValue as string) ?? query.tourIncValue,
              tourIncName: (best.rawMetadata?.tourIncName as string) ?? query.tourIncName,
            },
          },
        });
      } else {
        // §10 Absence: no Summer offer on this date.
        entries.push({
          date,
          price: null,
          currency: null,
          availability: "NOT_AVAILABLE",
          offerCount: 0,
          absenceCode: "SUPPLIER_NO_RESULT",
          absenceText: "Цена не получена — Summer не предоставил предложение на эту дату",
        });
      }
    }

    // Sort entries by date
    entries.sort((a, b) => a.date.localeCompare(b.date));

    this.logger.log(
      `PriceCalendar: ${entries.length} dates from ${deduped.length} deduped offers ` +
      `(${filtered.length} raw, ${totalScanned} across ${windows.length} windows × ${programs.length || 1} programs)`,
    );

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
        tourIncValues: query.tourIncValues ?? (query.tourIncValue ? [query.tourIncValue] : []),
      }),
      entries,
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
      fetchedAt: now,
      expiresAt: new Date(now.getTime() + 5 * 60 * 1000),
      totalOffersScanned: deduped.length,
    };
  }

  /** Deduplicate calendar offers by spoKey (same offer may appear in adjacent windows). */
  private deduplicateCalendarOffers(offers: SupplierOffer[]): SupplierOffer[] {
    const seen = new Map<string, SupplierOffer>();
    for (const offer of offers) {
      const key = offer.externalOfferId;
      if (!seen.has(key)) {
        seen.set(key, offer);
      } else {
        // Keep the one with higher price (more recent scrape) or the existing one.
        const existing = seen.get(key)!;
        if (offer.price.amount > existing.price.amount) {
          seen.set(key, offer);
        }
      }
    }
    return Array.from(seen.values());
  }
}
