import { Injectable, Logger, OnModuleDestroy, Optional } from "@nestjs/common";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import type {
  SupplierAdapter,
  SupplierSearchQuery,
  SupplierOffer,
  SupplierOfferDetail,
  SupplierOfferRef,
  SupplierPriceSnapshot,
  SupplierAvailabilitySnapshot,
  PriceCalendarQuery,
  PriceCalendarResult,
  PriceCalendarEntry,
} from "../supplier.types";
import { buildSummerSearchRequest, buildSummerXhrUrl, SummerSearchRequest } from "./summertour.request-builder";
import { parseSummerOffers } from "./summertour.response-parser";
import { KompasCaptchaStore, type KompasCaptchaOperation } from "../kompas/kompas-captcha.store";
import { KompasCaptchaRequiredException } from "../kompas/kompas-captcha.exception";

/**
 * Summertour (SAMO) Adapter — XHR/fetch approach.
 *
 * Core strategy:
 *  1. Navigate to summertour.az/search_tour to initialize SAMO session + cookies
 *  2. Use page.evaluate(fetch(xhrUrl)) to make XHR requests (same origin, browser cookies)
 *  3. Parse the JS response to extract HTML table
 *  4. Inject HTML into DOM and parse with parseSummerOffers()
 *
 * This avoids the broken form-filling approach where TOURINC AJAX never fires.
 */

@Injectable()
export class SummertourNewAdapter implements SupplierAdapter, OnModuleDestroy {
  readonly code = "SUMMERTOUR";
  readonly name = "Summertour (summertour.az)";
  readonly enabled = true;

  private readonly logger = new Logger(SummertourNewAdapter.name);
  private browser: Browser | null = null;
  private readonly browserLock = new Map<string, Promise<Browser>>();

  private static readonly MAX_PAGES = 5;
  private static readonly PAGE_DELAY_MS = 2_000;
  private static readonly CALENDAR_WINDOW_DAYS = 31;

  constructor(@Optional() private readonly captchaStore?: KompasCaptchaStore) {}

  // ── Program Discovery ─────────────────────────────────────────────

  async discoverPrograms(): Promise<Array<{ value: string; name: string }>> {
    let page: Page | null = null;
    let context: BrowserContext | null = null;
    try {
      const browser = await this.getBrowser();
      context = await browser.newContext({
        userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        locale: "ru-RU",
      });
      page = await context.newPage();
      await page.goto("https://summertour.az/search_tour", { waitUntil: "networkidle", timeout: 60_000 });
      await page.waitForFunction(() => typeof (window as any).samo !== "undefined" && (window as any).samo.page_ready === true, { timeout: 15_000 });

      const captchaThrown = await this.createCaptchaChallengeIfNeeded(page, context, "search", { adults: 2 } as any);
      if (captchaThrown) throw captchaThrown;

      const programs = await page.evaluate(() => {
        const sel = document.querySelector("select[name=TOURINC]") as HTMLSelectElement | null;
        if (!sel) return [];
        return Array.from(sel.options).filter(o => o.value !== "0" && o.value !== "").map(o => ({ value: o.value, name: o.text.trim() }));
      });
      await context.close();
      this.logger.log(`Summertour discovered ${programs.length} programs`);
      return programs;
    } catch (err) {
      if (err instanceof KompasCaptchaRequiredException) throw err;
      this.logger.error(`Summertour discover failed: ${(err as Error).message}`);
      if (context) await context.close().catch(() => {});
      return [];
    }
  }

  // ── Search ────────────────────────────────────────────────────────

  async search(query: SupplierSearchQuery): Promise<SupplierOffer[]> {
    const start = Date.now();
    let page: Page | null = null;
    let context: BrowserContext | null = null;
    try {
      const browser = await this.getBrowser();
      context = await browser.newContext({
        userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        locale: "ru-RU",
      });
      page = await context.newPage();
      if (!page) throw new Error("Failed to create Summer page");

      // Step 1: Navigate to search page for session init (cookies + SAMO JS)
      await page.goto("https://summertour.az/search_tour", { waitUntil: "networkidle", timeout: 60_000 });
      await page.waitForFunction(() => typeof (window as any).samo !== "undefined" && (window as any).samo.page_ready === true, { timeout: 15_000 });

      // Step 2: Check for CAPTCHA before searching
      const blockedBefore = await this.isBlocked(page);
      if (blockedBefore) {
        const captchaThrown = await this.createCaptchaChallengeIfNeeded(page, context, "search", query);
        if (captchaThrown) throw captchaThrown;
        this.logger.warn("Summertour BLOCKED before search (no captcha store)");
        await context.close();
        return [];
      }

      // Step 3: Build XHR URL with YYYYMMDD dates (browser session cookies apply)
      const summerReq = buildSummerSearchRequest({
        tourIncValue: query.tourIncValue,
        towns: (query as any).towns,
        hotelExternalId: query.hotelExternalId,
        departureDateFrom: query.departureDateFrom,
        departureDateTo: query.departureDateTo,
        nightsFrom: query.nightsFrom,
        nightsTo: query.nightsTo,
        adults: query.adults,
        children: query.children,
        childAges: query.childAges,
        meal: (query as any).meal,
        freight: (query as any).freightType ?? "0",
        filter: "0",
      });

      // Step 3b: When HOTELS_ANY=1 (no specific hotel), discover towns from form, then query each
      if (!query.hotelExternalId && query.tourIncValue) {
        return await this.searchWithTownDiscovery(page, summerReq, query, start);
      }

      const xhrUrl = buildSummerXhrUrl(summerReq);
      this.logger.log(`[Summertour] XHR URL: ${xhrUrl}`);

      // Step 4: Fetch via page.evaluate (uses browser's cookies/session)
      const jsResponse: string = await page.evaluate(async (url: string) => {
        const resp = await fetch(url);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        return await resp.text();
      }, xhrUrl);

      this.logger.log(`[Summertour] XHR response length=${jsResponse.length} for TOURINC=${summerReq.TOURINC} HOTELS=${summerReq.HOTELS ?? "any"}`);

      if (!jsResponse || jsResponse.length < 50) {
        this.logger.warn(`Summertour: empty response for TOURINC=${summerReq.TOURINC}`);
        await context.close();
        return [];
      }

      // Step 5: Extract HTML from JS response
      const html = this.extractHtmlFromJsResponse(jsResponse);
      if (!html) {
        const isNoData = jsResponse.includes("Нет данных");
        this.logger.warn(`Summertour: no HTML in response (noData=${isNoData}) len=${jsResponse.length} for TOURINC=${summerReq.TOURINC} HOTELS=${summerReq.HOTELS ?? "any"}`);
        await context.close();
        return [];
      }
      this.logger.log(`[Summertour] extracted HTML length=${html.length} for TOURINC=${summerReq.TOURINC}`);

      // Step 6: Inject HTML into DOM and parse with parseSummerOffers
      await page.evaluate((h: string) => {
        const el = document.querySelector("#resultset, .resultset, [id*=result]");
        if (el) el.innerHTML = h;
      }, html);

      await page.waitForTimeout(500);

      // Step 7: Check for CAPTCHA after injecting
      if (await this.isBlocked(page)) {
        const captchaThrown = await this.createCaptchaChallengeIfNeeded(page, context, "search", query);
        if (captchaThrown) throw captchaThrown;
        this.logger.warn("Summertour BLOCKED after XHR search");
        await context.close();
        return [];
      }

      // Step 8: Parse offers from injected DOM
      const all: any[] = [];
      let cur = await parseSummerOffers(page);
      all.push(...cur);

      // Step 9: Pagination
      for (let pg = 2; pg <= SummertourNewAdapter.MAX_PAGES; pg++) {
        const pageXhrUrl = xhrUrl.replace(/PRICEPAGE=\d+/, `PRICEPAGE=${pg}`);
        try {
          const pageJs = await page.evaluate(async (url: string) => {
            const resp = await fetch(url);
            if (!resp.ok) return "";
            return await resp.text();
          }, pageXhrUrl);
          const pageHtml = this.extractHtmlFromJsResponse(pageJs);
          if (!pageHtml) break;
          await page.evaluate((h: string) => {
            const el = document.querySelector("#resultset, .resultset, [id*=result]");
            if (el) el.innerHTML = h;
          }, pageHtml);
          await page.waitForTimeout(SummertourNewAdapter.PAGE_DELAY_MS);
          cur = await parseSummerOffers(page);
          if (cur.length === 0) break;
          all.push(...cur);
        } catch {
          break;
        }
      }

      await context.close();
      const latency = Date.now() - start;
      this.logger.log(`Summertour: ${all.length} offers in ${latency}ms` + (query.tourIncName ? ` [${query.tourIncName}]` : ""));
      return all.map(o => this.normalizeOffer(o, query));
    } catch (err) {
      this.logger.error(`Summertour search failed: ${(err as Error).message}`);
      if (context) await context.close().catch(() => {});
      throw err;
    }
  }

  /**
   * When HOTELS_ANY=1 (calendar query, no specific hotel), discover available towns from the
   * page form, then query each town with samo_action=TOWNS to get results.
   * This mirrors what the website does: select program → discover towns → search by town.
   */
  private async searchWithTownDiscovery(
    page: Page, summerReq: SummerSearchRequest, query: SupplierSearchQuery, start: number,
  ): Promise<SupplierOffer[]> {
    const all: any[] = [];
    const tourIncValue = summerReq.TOURINC;
    this.logger.log(`[Summertour] DOLOAD search for TOURINC=${tourIncValue}`);

    // Step A: Navigate with DOLOAD=1 to trigger SAMO search directly
    const checkinBeg = summerReq.CHECKIN_BEG ?? "";
    const checkinEnd = summerReq.CHECKIN_END ?? "";
    const initUrl = `https://summertour.az/search_tour?TOWNFROMINC=${summerReq.TOWNFROMINC}&STATEINC=${summerReq.STATEINC}&TOURINC=${tourIncValue}&CHECKIN_BEG=${checkinBeg}&CHECKIN_END=${checkinEnd}&NIGHTS_FROM=${summerReq.NIGHTS_FROM ?? ""}&NIGHTS_TILL=${summerReq.NIGHTS_TILL ?? ""}&ADULT=${summerReq.ADULT ?? "2"}&CHILD=${summerReq.CHILD ?? "0"}&CURRENCY=2&MEALS_ANY=1&ROOMS_ANY=1&HOTELS_ANY=1&PARTITION_PRICE=32&PRICEPAGE=1&DOLOAD=1`;
    this.logger.log(`[Summertour] Navigating to: ${initUrl.slice(0, 150)}`);
    await page.goto(initUrl, { waitUntil: "networkidle", timeout: 60_000 });
    await page.waitForFunction(() => typeof (window as any).samo !== "undefined" && (window as any).samo.page_ready === true, { timeout: 15_000 }).catch(() => {});
    await page.waitForTimeout(2000);

    // Step B: Read results from initial page load
    const initialOffers = await parseSummerOffers(page);
    this.logger.log(`[Summertour] Initial page: ${initialOffers.length} offers`);
    all.push(...initialOffers);

    // Step C: Determine which dates have data, fetch missing dates individually
    if (query.departureDateFrom && query.departureDateTo) {
      // SAMO returns dates as DD.MM.YYYY; convert to YYYY-MM-DD for comparison
      const datesWithData = new Set<string>();
      for (const o of initialOffers) {
        const ds = (o.departureDate || "").replace(/\s+/g, " ").trim();
        const rawDate = ds.split(",")[0]?.trim() || ds.split(" ")[0]?.trim() || "";
        // Convert DD.MM.YYYY → YYYY-MM-DD
        const parts = rawDate.split(".");
        if (parts.length === 3) {
          datesWithData.add(`${parts[2]}-${parts[1]}-${parts[0]}`);
        } else {
          datesWithData.add(rawDate);
        }
      }

      const allNeededDates: string[] = [];
      let cur = new Date(query.departureDateFrom);
      const end = new Date(query.departureDateTo);
      while (cur <= end) {
        const y = cur.getFullYear();
        const m = String(cur.getMonth() + 1).padStart(2, "0");
        const d = String(cur.getDate()).padStart(2, "0");
        allNeededDates.push(`${y}-${m}-${d}`);
        cur.setDate(cur.getDate() + 1);
      }

      this.logger.log(`[Summertour] Dates with data: ${[...datesWithData].join(",")} | Needed: ${allNeededDates.join(",")}`);

      const missingDates = allNeededDates.filter(d => !datesWithData.has(d));
      // Only iterate per-date for small ranges (calendar). Large ranges (bulk sync) skip per-date fetch.
      if (missingDates.length > 0 && missingDates.length <= 10) {
        this.logger.log(`[Summertour] Fetching ${missingDates.length} missing dates individually`);

        for (const dateStr of missingDates) {
          const dmY = `${dateStr.slice(8, 10)}.${dateStr.slice(5, 7)}.${dateStr.slice(0, 4)}`;
          const dateUrl = `https://summertour.az/search_tour?TOWNFROMINC=${summerReq.TOWNFROMINC}&STATEINC=${summerReq.STATEINC}&TOURINC=${tourIncValue}&CHECKIN_BEG=${dmY}&CHECKIN_END=${dmY}&NIGHTS_FROM=${summerReq.NIGHTS_FROM ?? ""}&NIGHTS_TILL=${summerReq.NIGHTS_TILL ?? ""}&ADULT=${summerReq.ADULT ?? "2"}&CHILD=${summerReq.CHILD ?? "0"}&CURRENCY=2&MEALS_ANY=1&ROOMS_ANY=1&HOTELS_ANY=1&PARTITION_PRICE=32&PRICEPAGE=1&DOLOAD=1`;
          try {
            await page.goto(dateUrl, { waitUntil: "networkidle", timeout: 60_000 });
            await page.waitForFunction(() => typeof (window as any).samo !== "undefined" && (window as any).samo.page_ready === true, { timeout: 10_000 }).catch(() => {});
            await page.waitForTimeout(1500);
            const dateOffers = await parseSummerOffers(page);
            this.logger.log(`[Summertour] Date ${dateStr}: ${dateOffers.length} offers`);
            all.push(...dateOffers);
          } catch (e) {
            this.logger.warn(`[Summertour] Date ${dateStr} failed: ${(e as Error).message}`);
          }
        }
      }
    }

    const latency = Date.now() - start;
    this.logger.log(`Summertour: ${all.length} offers in ${latency}ms (DOLOAD)` + (query.tourIncName ? ` [${query.tourIncName}]` : ""));
    return all.map(o => this.normalizeOffer(o, query));
  }

  // ── XHR Response Parsing ──────────────────────────────────────────

  private extractHtmlFromJsResponse(js: string): string | null {
    const m = js.match(/\.ehtml\("((?:[^"\\]|\\.)*)"\)/);
    if (!m) return null;
    let html = m[1];
    html = html.replace(/\\n/g, "\n").replace(/\\t/g, "\t").replace(/\\"/g, '"').replace(/\\\//g, "/").replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
    return html;
  }

  private isCaptchaInResponseText(text: string): boolean {
    // Mirrors script Test-CaptchaRequired: captchaForm / bfcaptcha / samo_action=antibot
    if (/<form[^>]+captchaForm/i.test(text)) return true;
    if (/\bfcaptcha\b/i.test(text)) return true;
    if (/samo_action\s*=\s*["']?antibot/i.test(text)) return true;
    if (text.includes("captchaForm") || text.includes("icaptcha")) return true;
    return false;
  }

  private async isBlocked(page: Page): Promise<boolean> {
    return page.evaluate(() => {
      if (document.querySelector("#captchaForm") || document.querySelector("#icaptcha")) return true;
      const txt = document.body.innerText.toLowerCase();
      return txt.includes("captcha") || txt.includes("заблокирован") || txt.includes("blocked") || txt.includes("cloudflare");
    }).catch(() => false);
  }

  private normalizeOffer(raw: any, query: SupplierSearchQuery): SupplierOffer {
    const now = new Date();
    const ds = (raw.departureDate || "").replace(/\s+/g, " ").trim();
    const m = ds.match(/(\d{2})\.(\d{2})\.(\d{4})/);
    let departureDate: string;
    if (m) {
      departureDate = `${m[3]}-${m[2]}-${m[1]}`;
    } else if (raw.checkIn && /^\d{8}$/.test(raw.checkIn)) {
      departureDate = `${raw.checkIn.slice(0, 4)}-${raw.checkIn.slice(4, 6)}-${raw.checkIn.slice(6, 8)}`;
    } else {
      departureDate = raw.checkIn || "";
    }
    return {
      supplierCode: this.code,
      externalOfferId: raw.spoKey,
      externalClaim: raw.claim,
      hotel: raw.hotel || query.hotel || undefined,
      hotelExternalId: raw.hotelKey || query.hotelExternalId || undefined,
      tour: raw.tourKey || undefined,
      departureDate,
      nights: raw.nights,
      room: raw.roomText || raw.roomKey || undefined,
      meal: raw.mealText || raw.mealKey || undefined,
      adults: raw.adults || (query.adults ?? 2),
      children: raw.children || (query.children ?? 0),
      childAges: query.childAges ?? [],
      price: { amount: raw.price, currency: raw.currency, fetchedAt: now, expiresAt: new Date(now.getTime() + 5 * 60 * 1000), queryHash: "", source: this.code },
      availability: "AVAILABLE",
      transport: raw.transport || undefined,
      fetchedAt: now,
      expiresAt: new Date(now.getTime() + 5 * 60 * 1000),
      rawMetadata: {
        spoKey: raw.spoKey, hotelKey: raw.hotelKey, tourKey: raw.tourKey, mealKey: raw.mealKey, roomKey: raw.roomKey,
        roomText: raw.roomText, mealText: raw.mealText, catClaim: raw.claim,
        tourIncValue: query.tourIncValue, tourIncName: query.tourIncName,
        flightSeatsAvailable: raw.flightSeatsAvailable, stopSale: raw.stopSale,
      },
    };
  }

  async getOffer(ref: SupplierOfferRef): Promise<SupplierOfferDetail> {
    const q: SupplierSearchQuery = {
      country: ref.searchContext.country, departureCity: ref.searchContext.departureCity, destination: ref.searchContext.destination,
      adults: ref.searchContext.adults, children: ref.searchContext.children, childAges: ref.searchContext.childAges,
      hotel: ref.searchContext.hotel, room: ref.searchContext.room, meal: ref.searchContext.meal,
      nightsFrom: ref.searchContext.nightsFrom, nightsTo: ref.searchContext.nightsTo,
      departureDateFrom: ref.searchContext.departureDateFrom, departureDateTo: ref.searchContext.departureDateTo,
      tourIncValue: ref.searchContext.tourIncValue, tourIncName: ref.searchContext.tourIncName,
    };
    const offers = await this.search(q);
    const m = offers.find(o => o.externalOfferId === ref.externalOfferId);
    if (m) return { ...m, packageComposition: undefined, oldPrice: undefined, priceType: undefined };
    return {
      supplierCode: this.code, externalOfferId: ref.externalOfferId, externalClaim: ref.externalClaim,
      hotel: ref.searchContext.hotel ?? "", departureDate: ref.searchContext.departureDateFrom ?? "", nights: ref.searchContext.nightsFrom ?? 0,
      adults: ref.searchContext.adults, children: ref.searchContext.children ?? 0, childAges: ref.searchContext.childAges ?? [],
      price: { amount: 0, currency: "USD", fetchedAt: new Date(), expiresAt: new Date(), queryHash: "", source: this.code },
      availability: "NOT_AVAILABLE", fetchedAt: new Date(), expiresAt: new Date(),
    };
  }

  async refreshPrice(ref: SupplierOfferRef): Promise<SupplierPriceSnapshot> {
    const q: SupplierSearchQuery = {
      country: ref.searchContext.country, departureCity: ref.searchContext.departureCity, destination: ref.searchContext.destination,
      adults: ref.searchContext.adults, children: ref.searchContext.children, childAges: ref.searchContext.childAges,
      hotel: ref.searchContext.hotel, hotelExternalId: ref.searchContext.hotelExternalId, room: ref.searchContext.room, meal: ref.searchContext.meal,
      nightsFrom: ref.searchContext.nightsFrom, nightsTo: ref.searchContext.nightsTo,
      departureDateFrom: ref.searchContext.departureDateFrom, departureDateTo: ref.searchContext.departureDateTo,
      tourIncValue: ref.searchContext.tourIncValue, tourIncName: ref.searchContext.tourIncName,
    };
    const offers = await this.search(q);
    const m = offers.find(o => o.externalOfferId === ref.externalOfferId);
    return m ? m.price : { amount: 0, currency: "USD", fetchedAt: new Date(), expiresAt: new Date(Date.now() + 5 * 60 * 1000), queryHash: JSON.stringify(ref.searchContext), source: this.code };
  }

  async refreshAvailability(ref: SupplierOfferRef): Promise<SupplierAvailabilitySnapshot> {
    const q: SupplierSearchQuery = {
      country: ref.searchContext.country, departureCity: ref.searchContext.departureCity, destination: ref.searchContext.destination,
      adults: ref.searchContext.adults, children: ref.searchContext.children, childAges: ref.searchContext.childAges,
      hotel: ref.searchContext.hotel, hotelExternalId: ref.searchContext.hotelExternalId, room: ref.searchContext.room, meal: ref.searchContext.meal,
      nightsFrom: ref.searchContext.nightsFrom, nightsTo: ref.searchContext.nightsTo,
      departureDateFrom: ref.searchContext.departureDateFrom, departureDateTo: ref.searchContext.departureDateTo,
      tourIncValue: ref.searchContext.tourIncValue, tourIncName: ref.searchContext.tourIncName,
    };
    const offers = await this.search(q);
    const m = offers.find(o => o.externalOfferId === ref.externalOfferId);
    return { availability: m ? "AVAILABLE" : "NOT_AVAILABLE", fetchedAt: new Date(), expiresAt: new Date(Date.now() + 5 * 60 * 1000) };
  }

  async getPriceCalendar(query: PriceCalendarQuery): Promise<PriceCalendarResult> {
    const now = new Date();
    const programs = (query.tourIncValues?.length ?? 0) > 0 ? query.tourIncValues!.map((v, i) => ({ value: v, name: query.tourIncNames?.[i] })) : query.tourIncValue ? [{ value: query.tourIncValue, name: query.tourIncName }] : [];
    const collected: SupplierOffer[] = [];

    if (query.hotelExternalId && programs.length > 0) {
      // Hotel-specific calendar: iterate per-date (SAMO XHR paginates, so range queries miss dates)
      // Captcha: script D:\test.ps1 flow — detect captchaForm/bfcaptcha/antibot in response → show image + input → POST antibot
      this.logger.log(`[Summertour calendar] hotel-specific mode: iterating per-date for extId=${query.hotelExternalId}`);
      const browser = await this.getBrowser();
      const context = await browser.newContext({
        userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        locale: "ru-RU",
      });
      const page = await context.newPage();
      let captchaThrown = false;
      try {
        await page.goto("https://summertour.az/search_tour", { waitUntil: "domcontentloaded", timeout: 15_000 });
        await page.waitForFunction(() => typeof (window as any).samo !== "undefined" && (window as any).samo.page_ready === true, { timeout: 8_000 }).catch(() => {});

        // Initial captcha check (script Ensure-CaptchaSolved after initial GET)
        if (await this.isCaptchaPresent(page)) {
          const ex = await this.createCaptchaChallengeIfNeeded(page, context, "priceCalendar", query as unknown as SupplierSearchQuery);
          if (ex) { captchaThrown = true; throw ex; }
        }

        const allDates: string[] = [];
        { let cur = new Date(query.dateFrom); const end = new Date(query.dateTo); while (cur <= end) { allDates.push(this.formatDate(cur)); cur.setDate(cur.getDate() + 1); } }

        const parserPage = await context.newPage();
        try {
          for (const dateStr of allDates) {
            for (const pr of programs) {
              const p = new URLSearchParams();
              p.set("samo_action", "PRICES");
              p.set("TOWNFROMINC", "1930");
              p.set("STATEINC", "9");
              p.set("TOURINC", pr.value);
              p.set("CHECKIN_BEG", `${dateStr.slice(0, 4)}${dateStr.slice(5, 7)}${dateStr.slice(8, 10)}`);
              p.set("CHECKIN_END", `${dateStr.slice(0, 4)}${dateStr.slice(5, 7)}${dateStr.slice(8, 10)}`);
              p.set("NIGHTS_FROM", String(query.nights));
              p.set("NIGHTS_TILL", String(query.nights));
              p.set("ADULT", String(query.adults));
              p.set("CHILD", String(query.children));
              p.set("CURRENCY", "2");
              p.set("MEALS_ANY", "1");
              p.set("MEALS", "");
              p.set("ROOMS_ANY", "1");
              p.set("ROOMS", "");
              p.set("HOTELS_ANY", "0");
              p.set("HOTELS", query.hotelExternalId);
              p.set("FREIGHT", "0");
              p.set("FILTER", "0");
              p.set("MOMENT_CONFIRM", "0");
              p.set("hotelsearch", "0");
              p.set("PARTITION_PRICE", "");
              p.set("PRICEPAGE", "1");
              p.set("DYN_SEPARATE", "1");
              p.set("rev", String(Math.floor(Math.random() * 1e9)));
              p.set("_", String(Date.now()));
              const xhrUrl = `https://summertour.az/search_tour?${p.toString()}`;

              try {
                const jsResponse: string = await page.evaluate(async (url: string) => {
                  const resp = await fetch(url);
                  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
                  return await resp.text();
                }, xhrUrl);

                // Captcha detection in XHR response (script Test-CaptchaRequired) — string-based as in D:\test.ps1
                if (this.isCaptchaInResponseText(jsResponse)) {
                  // Extract image URL via script's Get-CaptchaImageUrl logic, then fetch to data URI
                  const imgMatch = jsResponse.match(/<img\b[^>]*\bsrc\s*=\s*["']([^"']*(?:kcaptcha|captcha)[^"']*)["']/i);
                  let imgSrc: string | null = imgMatch ? imgMatch[1] : null;
                  if (imgSrc) {
                    imgSrc = imgSrc.replace(/&amp;/g, "&").replace(/&#39;/g, "'").replace(/&quot;/g, '"');
                    if (imgSrc.startsWith("/")) imgSrc = `https://summertour.az${imgSrc}`;
                    else if (!imgSrc.startsWith("http")) imgSrc = `https://summertour.az/${imgSrc}`;
                    let dataUri: string | null = null;
                    try {
                      dataUri = await page.evaluate(async (url: string) => {
                        const r = await fetch(url);
                        if (!r.ok) throw new Error(`HTTP ${r.status}`);
                        const blob = await r.blob();
                        return new Promise<string>((resolve, reject) => {
                          const fr = new FileReader();
                          fr.onloadend = () => resolve(fr.result as string);
                          fr.onerror = reject;
                          fr.readAsDataURL(blob);
                        });
                      }, imgSrc);
                    } catch {}
                    if (dataUri && this.captchaStore) {
                      const ch = this.captchaStore.create({ supplier: "SUMMERTOUR", operation: "priceCalendar", originalQuery: query as unknown as SupplierSearchQuery, context, page, captchaImage: dataUri, mimeType: this.inferMimeType(dataUri) });
                      this.logger.log(`[Summertour] CAPTCHA challenge created via XHR ${ch.challengeId}`);
                      captchaThrown = true;
                      throw new KompasCaptchaRequiredException(ch.challengeId, dataUri, this.inferMimeType(dataUri), "SUMMERTOUR");
                    }
                  }
                  // Fallback: render HTML and use DOM-based extraction
                  await page.setContent(jsResponse, { waitUntil: "domcontentloaded" }).catch(() => {});
                  const ex2 = await this.createCaptchaChallengeIfNeeded(page, context, "priceCalendar", query as unknown as SupplierSearchQuery);
                  if (ex2) { captchaThrown = true; throw ex2; }
                  this.logger.warn(`[Summertour calendar] captcha without challenge for ${dateStr}`);
                  continue;
                }

                if (jsResponse && jsResponse.length > 50) {
                  const html = this.extractHtmlFromJsResponse(jsResponse);
                  // Captcha may be inside ehtml payload
                  if (html && this.isCaptchaInResponseText(html)) {
                    const imgMatch2 = html.match(/<img\b[^>]*\bsrc\s*=\s*["']([^"']*(?:kcaptcha|captcha)[^"']*)["']/i);
                    let imgSrc2: string | null = imgMatch2 ? imgMatch2[1] : null;
                    if (imgSrc2) {
                      imgSrc2 = imgSrc2.replace(/&amp;/g, "&");
                      if (imgSrc2.startsWith("/")) imgSrc2 = `https://summertour.az${imgSrc2}`;
                      else if (!imgSrc2.startsWith("http")) imgSrc2 = `https://summertour.az/${imgSrc2}`;
                      let dataUri2: string | null = null;
                      try {
                        dataUri2 = await page.evaluate(async (url: string) => {
                          const r = await fetch(url);
                          const blob = await r.blob();
                          return new Promise<string>((resolve) => {
                            const fr = new FileReader();
                            fr.onloadend = () => resolve(fr.result as string);
                            fr.readAsDataURL(blob);
                          });
                        }, imgSrc2);
                      } catch {}
                      if (dataUri2 && this.captchaStore) {
                        const ch2 = this.captchaStore.create({ supplier: "SUMMERTOUR", operation: "priceCalendar", originalQuery: query as unknown as SupplierSearchQuery, context, page, captchaImage: dataUri2, mimeType: this.inferMimeType(dataUri2) });
                        captchaThrown = true;
                        throw new KompasCaptchaRequiredException(ch2.challengeId, dataUri2, this.inferMimeType(dataUri2), "SUMMERTOUR");
                      }
                    }
                    await page.setContent(html, { waitUntil: "domcontentloaded" }).catch(() => {});
                    const ex3 = await this.createCaptchaChallengeIfNeeded(page, context, "priceCalendar", query as unknown as SupplierSearchQuery);
                    if (ex3) { captchaThrown = true; throw ex3; }
                    continue;
                  }
                  if (html) {
                    await parserPage.setContent(`<table>${html}</table>`, { waitUntil: "domcontentloaded" });
                    const rawOffers = await parseSummerOffers(parserPage);
                    this.logger.log(`[Summertour calendar] date ${dateStr} rawOffers=${rawOffers.length} htmlLen=${html.length}`);
                    const off = rawOffers.map(o => this.normalizeOffer(o, { tourIncValue: pr.value, tourIncName: pr.name, adults: query.adults, children: query.children, childAges: query.childAges, hotel: query.hotel, hotelExternalId: query.hotelExternalId }));
                    collected.push(...off);
                  }
                }
              } catch (e) {
                if (e instanceof KompasCaptchaRequiredException) throw e;
                this.logger.warn(`[Summertour calendar] date ${dateStr} failed: ${(e as Error).message}`);
              }
            }
          }
        } finally { await parserPage.close().catch(() => {}); }
      } catch (e) {
        if (e instanceof KompasCaptchaRequiredException) throw e;
        throw e;
      } finally {
        if (!captchaThrown) await context.close().catch(() => {});
      }
      this.logger.log(`[Summertour calendar] collected=${collected.length} from per-date iteration`);
    } else {
      // No specific hotel: use existing windowed approach
      const windows = this.generateCalendarWindows(query.dateFrom, query.dateTo);
      const base: SupplierSearchQuery = {
        adults: query.adults, children: query.children, childAges: query.childAges,
        room: query.room, meal: query.meal,
        nightsFrom: query.nights, nightsTo: query.nights, departureDateFrom: query.dateFrom, departureDateTo: query.dateTo,
      };
      for (const w of windows) {
        if (programs.length > 0) {
          for (const pr of programs) {
            try {
              const off = await this.search({ ...base, departureDateFrom: w.from, departureDateTo: w.to, tourIncValue: pr.value, tourIncName: pr.name });
              collected.push(...off);
            } catch (e) { this.logger.warn(`window ${w.from}→${w.to} ${pr.value} ${(e as Error).message}`); }
          }
        } else {
          try {
            const off = await this.search({ ...base, departureDateFrom: w.from, departureDateTo: w.to });
            collected.push(...off);
          } catch (e) { this.logger.warn(`window ${w.from}→${w.to} ${(e as Error).message}`); }
        }
      }
      this.logger.log(`[Summertour calendar] collected=${collected.length} from windowed approach`);
    }
    const filtered = query.hotel ? collected.filter(o => o.hotel === query.hotel || o.hotelExternalId === query.hotelExternalId) : collected;
    const deduped = this.dedup(filtered);
    this.logger.log(`[Summertour calendar] deduped=${deduped.length} dates=${[...new Set(deduped.map(o => o.departureDate))].join(",")}`);
    const map = new Map<string, SupplierOffer[]>();
    for (const o of deduped) {
      const arr = map.get(o.departureDate) || [];
      arr.push(o);
      map.set(o.departureDate, arr);
    }
    const allDates: string[] = [];
    { let cur = new Date(query.dateFrom); const end = new Date(query.dateTo); while (cur <= end) { allDates.push(this.formatDate(cur)); cur.setDate(cur.getDate() + 1); } }
    const entries: PriceCalendarEntry[] = [];
    for (const d of allDates) {
      const arr = map.get(d);
      if (arr && arr.length > 0) {
        const sorted = arr.sort((a, b) => a.price.amount - b.price.amount);
        const best = sorted[0];
        entries.push({
          date: d, price: best.price.amount, currency: best.price.currency, availability: best.availability, offerCount: arr.length,
          offers: sorted.map(o => ({
            tourIncValue: (o.rawMetadata?.tourIncValue as string) ?? "", tourIncName: (o.rawMetadata?.tourIncName as string) ?? undefined,
            externalOfferId: o.externalOfferId, externalClaim: o.externalClaim, hotel: o.hotel, hotelExternalId: o.hotelExternalId,
            departureDate: o.departureDate, nights: o.nights, room: o.room, meal: o.meal, adults: o.adults, children: o.children, childAges: o.childAges,
            availability: o.availability, price: o.price.amount, currency: o.price.currency, transport: o.transport,
          })),
          bestOfferRef: { supplierCode: this.code, externalOfferId: best.externalOfferId, externalClaim: best.externalClaim, searchContext: { adults: query.adults, children: query.children, childAges: query.childAges, hotel: query.hotel, room: query.room, meal: query.meal, nightsFrom: query.nights, nightsTo: query.nights, tourIncValue: (best.rawMetadata?.tourIncValue as string) ?? query.tourIncValue, tourIncName: (best.rawMetadata?.tourIncName as string) ?? query.tourIncName } },
        });
      } else {
        entries.push({ date: d, price: null, currency: null, availability: "NOT_AVAILABLE", offerCount: 0, absenceCode: "SUPPLIER_NO_RESULT", absenceText: "Цена не получена — Summer не предоставил предложение на эту дату" });
      }
    }
    entries.sort((a, b) => a.date.localeCompare(b.date));
    return { supplierCode: this.code, contextHash: JSON.stringify({ hotel: query.hotel, room: query.room, meal: query.meal, adults: query.adults, children: query.children, nights: query.nights }), entries, dateFrom: query.dateFrom, dateTo: query.dateTo, fetchedAt: now, expiresAt: new Date(now.getTime() + 5 * 60 * 1000), totalOffersScanned: deduped.length };
  }

  async resumeOperationAfterCaptcha(challengeId: string): Promise<PriceCalendarResult> {
    const ch = this.captchaStore?.get(challengeId);
    if (!ch || ch.supplier !== "SUMMERTOUR") throw new Error("SESSION_LOST");
    const query = ch.originalQuery as unknown as PriceCalendarQuery;
    if (!query || !query.dateFrom || !query.dateTo) throw new Error("SESSION_LOST");
    // Reuse the solved page/context to fetch prices (keeps antibot cookie)
    const page = ch.page;
    const context = ch.context;
    const programs = (query.tourIncValues?.length ?? 0) > 0 ? query.tourIncValues!.map((v, i) => ({ value: v, name: query.tourIncNames?.[i] })) : query.tourIncValue ? [{ value: query.tourIncValue, name: query.tourIncName }] : [];
    const collected: SupplierOffer[] = [];
    const allDates: string[] = [];
    { let cur = new Date(query.dateFrom); const end = new Date(query.dateTo); while (cur <= end) { allDates.push(this.formatDate(cur)); cur.setDate(cur.getDate() + 1); } }
    const parserPage = await context.newPage();
    try {
      for (const dateStr of allDates) {
        for (const pr of programs) {
          const p = new URLSearchParams();
          p.set("samo_action", "PRICES");
          p.set("TOWNFROMINC", "1930");
          p.set("STATEINC", "9");
          p.set("TOURINC", pr.value);
          p.set("CHECKIN_BEG", `${dateStr.slice(0, 4)}${dateStr.slice(5, 7)}${dateStr.slice(8, 10)}`);
          p.set("CHECKIN_END", `${dateStr.slice(0, 4)}${dateStr.slice(5, 7)}${dateStr.slice(8, 10)}`);
          p.set("NIGHTS_FROM", String(query.nights));
          p.set("NIGHTS_TILL", String(query.nights));
          p.set("ADULT", String(query.adults));
          p.set("CHILD", String(query.children ?? 0));
          p.set("CURRENCY", "2");
          p.set("MEALS_ANY", "1"); p.set("MEALS", "");
          p.set("ROOMS_ANY", "1"); p.set("ROOMS", "");
          p.set("HOTELS_ANY", "0"); p.set("HOTELS", query.hotelExternalId!);
          p.set("FREIGHT", "0"); p.set("FILTER", "0"); p.set("MOMENT_CONFIRM", "0"); p.set("hotelsearch", "0");
          p.set("PARTITION_PRICE", ""); p.set("PRICEPAGE", "1"); p.set("DYN_SEPARATE", "1");
          p.set("rev", String(Math.floor(Math.random() * 1e9))); p.set("_", String(Date.now()));
          const xhrUrl = `https://summertour.az/search_tour?${p.toString()}`;
          try {
            const jsResponse: string = await page.evaluate(async (url: string) => {
              const resp = await fetch(url);
              if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
              return await resp.text();
            }, xhrUrl);
            if (this.isCaptchaInResponseText(jsResponse)) throw new KompasCaptchaRequiredException(challengeId, "", "image/jpeg", "SUMMERTOUR");
            const html = this.extractHtmlFromJsResponse(jsResponse);
            if (!html || !html.includes("price_info")) continue;
            await parserPage.setContent(`<table>${html}</table>`, { waitUntil: "domcontentloaded" });
            const rawOffers = await parseSummerOffers(parserPage);
            const off = rawOffers.map(o => this.normalizeOffer(o, { tourIncValue: pr.value, tourIncName: pr.name, adults: query.adults, children: query.children, childAges: query.childAges, hotel: query.hotel, hotelExternalId: query.hotelExternalId }));
            collected.push(...off);
          } catch (e) {
            if (e instanceof KompasCaptchaRequiredException) throw e;
          }
        }
      }
    } finally { await parserPage.close().catch(() => {}); }

    const filtered = collected;
    const deduped = this.dedup(filtered);
    const map = new Map<string, SupplierOffer[]>();
    for (const o of deduped) { const arr = map.get(o.departureDate) || []; arr.push(o); map.set(o.departureDate, arr); }
    const allDates2: string[] = [];
    { let cur = new Date(query.dateFrom); const end = new Date(query.dateTo); while (cur <= end) { allDates2.push(this.formatDate(cur)); cur.setDate(cur.getDate() + 1); } }
    const entries: PriceCalendarEntry[] = [];
    for (const d of allDates2) {
      const arr = map.get(d);
      if (arr && arr.length > 0) {
        const sorted = arr.sort((a, b) => a.price.amount - b.price.amount);
        const best = sorted[0];
        entries.push({ date: d, price: best.price.amount, currency: best.price.currency, availability: best.availability, offerCount: arr.length, offers: sorted.map(o => ({ tourIncValue: (o.rawMetadata?.tourIncValue as string) ?? "", tourIncName: (o.rawMetadata?.tourIncName as string) ?? undefined, externalOfferId: o.externalOfferId, externalClaim: o.externalClaim, hotel: o.hotel, hotelExternalId: o.hotelExternalId, departureDate: o.departureDate, nights: o.nights, room: o.room, meal: o.meal, adults: o.adults, children: o.children, childAges: o.childAges, availability: o.availability, price: o.price.amount, currency: o.price.currency, transport: o.transport })), bestOfferRef: { supplierCode: this.code, externalOfferId: best.externalOfferId, externalClaim: best.externalClaim, searchContext: { adults: query.adults, children: query.children, childAges: query.childAges, hotel: query.hotel, room: query.room, meal: query.meal, nightsFrom: query.nights, nightsTo: query.nights, tourIncValue: (best.rawMetadata?.tourIncValue as string) ?? query.tourIncValue, tourIncName: (best.rawMetadata?.tourIncName as string) ?? query.tourIncName } } });
      } else {
        entries.push({ date: d, price: null, currency: null, availability: "NOT_AVAILABLE", offerCount: 0, absenceCode: "SUPPLIER_NO_RESULT", absenceText: "Цена не получена — Summer не предоставил предложение на эту дату" });
      }
    }
    entries.sort((a, b) => a.date.localeCompare(b.date));
    const now = new Date();
    return { supplierCode: this.code, contextHash: JSON.stringify({ hotel: query.hotel, room: query.room, meal: query.meal, adults: query.adults, children: query.children, nights: query.nights }), entries, dateFrom: query.dateFrom, dateTo: query.dateTo, fetchedAt: now, expiresAt: new Date(now.getTime() + 5 * 60 * 1000), totalOffersScanned: deduped.length };
  }

  private dedup(offers: SupplierOffer[]): SupplierOffer[] {
    const m = new Map<string, SupplierOffer>();
    for (const o of offers) {
      const k = `${o.externalOfferId}|${o.departureDate}|${o.room ?? ""}|${o.meal ?? ""}`;
      if (!m.has(k)) m.set(k, o);
      else if (o.price.amount < m.get(k)!.price.amount) m.set(k, o);
    }
    return Array.from(m.values());
  }

  private generateCalendarWindows(from: string, to: string): Array<{ from: string; to: string }> {
    const w: Array<{ from: string; to: string }> = [];
    let cur = new Date(from); const end = new Date(to);
    while (cur <= end) {
      const e = new Date(cur); e.setDate(e.getDate() + 30);
      if (e > end) e.setTime(end.getTime());
      w.push({ from: this.formatDate(cur), to: this.formatDate(e) });
      cur = new Date(e); cur.setDate(cur.getDate() + 1);
    }
    return w;
  }
  private formatDate(d: Date): string { const y = d.getFullYear(); const m = String(d.getMonth() + 1).padStart(2, "0"); const day = String(d.getDate()).padStart(2, "0"); return `${y}-${m}-${day}`; }

  private async getBrowser(): Promise<Browser> {
    if (this.browser && this.browser.isConnected()) return this.browser;
    const k = "default";
    if (this.browserLock.has(k)) return this.browserLock.get(k)!;
    const p = chromium.launch({ headless: true });
    this.browserLock.set(k, p);
    try { this.browser = await p; this.logger.log("Summertour (new) browser launched"); return this.browser; } finally { this.browserLock.delete(k); }
  }

  // ── CAPTCHA Human-in-the-Loop (SAMO — same as KOMPAS) ──────────────

  private async isCaptchaPresent(page: Page): Promise<boolean> {
    try {
      const hasForm = await page.locator("#captchaForm").count().then((c) => c > 0).catch(() => false);
      const hasImg = await page.locator("#icaptcha").count().then((c) => c > 0).catch(() => false);
      if (hasForm && hasImg) return true;
      const generic = await page.evaluate(() => {
        const f = document.querySelector('#captchaForm, form[name="captchaForm"]');
        const img = document.querySelector('#icaptcha, img.captcha-self');
        const fcaptcha = document.querySelector('#fcaptcha, input[name="antibot"]');
        const samoBlock = document.querySelector('.samo-block, .captcha-block, .samo_message');
        return !!(f || img || fcaptcha || samoBlock);
      }).catch(() => false);
      if (generic) return true;
      const bodyCheck = await page.evaluate(() => {
        const text = document.body?.innerText?.toLowerCase() ?? "";
        return text.includes("captcha") || text.includes("капча") || text.includes("проверка на робота") || text.includes("подтвердите, что вы не робот");
      }).catch(() => false);
      return bodyCheck;
    } catch {
      return false;
    }
  }

  private async getCaptchaImageSrc(page: Page): Promise<string | null> {
    try {
      const src = await page.locator("#icaptcha").getAttribute("src").catch(() => null);
      if (src && src.startsWith("data:image/")) return src;
      const fallback = await page.evaluate(() => {
        const el = document.querySelector("#icaptcha") as HTMLImageElement | null;
        if (!el) return null;
        const s = el.getAttribute("src") || el.src || null;
        return s;
      }).catch(() => null);
      if (fallback && fallback.startsWith("data:image/")) return fallback;
      return null;
    } catch {
      return null;
    }
  }

  private inferMimeType(dataUri: string): string {
    const m = dataUri.match(/^data:([^;]+);base64,/);
    return m?.[1] ?? "image/jpeg";
  }

  private async createCaptchaChallengeIfNeeded(
    page: Page,
    context: BrowserContext,
    operation: KompasCaptchaOperation,
    originalQuery: SupplierSearchQuery | PriceCalendarQuery | SupplierOfferRef,
  ): Promise<KompasCaptchaRequiredException | null> {
    const hasCaptcha = await this.isCaptchaPresent(page);
    if (!hasCaptcha) return null;

    const src = await this.getCaptchaImageSrc(page);
    if (!src) {
      this.logger.warn("Summertour CAPTCHA detected but #icaptcha src missing");
      return null;
    }
    if (!this.captchaStore) {
      this.logger.warn("Summertour CAPTCHA detected but KompasCaptchaStore not injected");
      return null;
    }

    const ch = this.captchaStore.create({
      supplier: "SUMMERTOUR",
      operation,
      originalQuery,
      context,
      page,
      captchaImage: src,
      mimeType: this.inferMimeType(src),
    });

    this.logger.log(`Summertour CAPTCHA challenge created: ${ch.challengeId}`);
    return new KompasCaptchaRequiredException(ch.challengeId, src, ch.mimeType, "SUMMERTOUR");
  }

  async submitCaptchaAnswer(challengeId: string, answer: string): Promise<{ status: string; newImage?: string }> {
    const ch = this.captchaStore?.get(challengeId);
    if (!ch) return { status: "SESSION_LOST" };
    if (ch.supplier !== "SUMMERTOUR") return { status: "SESSION_LOST" };
    if (ch.status === "EXPIRED") return { status: "EXPIRED" };

    const { page } = ch;
    this.logger.log(JSON.stringify({ event: "SUMMERTOUR_CAPTCHA_SUBMIT_STARTED", challengeId }));

    try {
      this.captchaStore!.setStatus(challengeId, "SUBMITTING");

      const fcaptcha = page.locator("#fcaptcha");
      await fcaptcha.waitFor({ state: "visible", timeout: 5_000 }).catch(() => {});
      await fcaptcha.fill(answer);
      await page.waitForTimeout(300);

      await page.evaluate(() => {
        const form = document.querySelector('#captchaForm, form[name="captchaForm"]') as HTMLFormElement | null;
        if (form) form.submit();
        else {
          const btn = document.querySelector('#captchaForm input[type="submit"], #captchaForm button[type="submit"]') as HTMLElement | null;
          if (btn) btn.click();
        }
      });

      await page.waitForTimeout(3_000);

      const stillCaptcha = await this.isCaptchaPresent(page);
      if (stillCaptcha) {
        const newImage = await this.getCaptchaImageSrc(page);
        if (newImage) this.captchaStore!.updateImage(challengeId, newImage, this.inferMimeType(newImage));
        this.captchaStore!.setStatus(challengeId, "WAITING_FOR_USER");
        return { status: "INVALID_ANSWER", newImage: newImage ?? undefined };
      }

      this.captchaStore!.setStatus(challengeId, "SUCCESS");
      this.logger.log(JSON.stringify({ event: "SUMMERTOUR_CAPTCHA_SOLVED", challengeId }));
      return { status: "SUCCESS" };
    } catch (err) {
      this.logger.error(`Summertour CAPTCHA submit failed: ${(err as Error).message}`);
      this.captchaStore!.setStatus(challengeId, "SESSION_LOST");
      return { status: "SESSION_LOST" };
    }
  }

  async refreshCaptcha(challengeId: string): Promise<{ newImage: string } | null> {
    const ch = this.captchaStore?.get(challengeId);
    if (!ch || ch.supplier !== "SUMMERTOUR") return null;
    const { page } = ch;

    try {
      const refreshed = await page.evaluate(() => {
        const samo = (window as any).samo;
        if (samo?.captchaRefreshUrl) {
          samo.captchaRefresh?.();
          return true;
        }
        const btn = document.querySelector('#captchaForm .refresh, #captchaForm [onclick*="captcha"], .captcha-refresh') as HTMLElement | null;
        if (btn) { btn.click(); return true; }
        return false;
      }).catch(() => false);

      if (refreshed) {
        await page.waitForTimeout(2_000);
        const newImage = await this.getCaptchaImageSrc(page);
        if (newImage) {
          this.captchaStore!.updateImage(challengeId, newImage, this.inferMimeType(newImage));
          return { newImage };
        }
      }
    } catch (err) {
      this.logger.warn(`Summertour CAPTCHA refresh failed: ${(err as Error).message}`);
    }
    return null;
  }

  async onModuleDestroy() { if (this.browser) { await this.browser.close().catch(() => {}); this.browser = null; } }
}
