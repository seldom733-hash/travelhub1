/**
 * KOMPAS Supplier Adapter — Playwright-based web scraper.
 *
 * Implements SupplierAdapter for the KOMPAS/SAMO platform.
 * §7: Departure city fixed to Baku (TOWNFROMINC=1411).
 * §10: Discovers all countries and programs from Baku.
 *
 * CAPTCHA Human-in-the-Loop (implemented 20.09):
 * KOMPAS may return real CAPTCHA (#captchaForm / #icaptcha.captcha-self data:image/jpeg;base64).
 * Detected via isCaptchaPresent(); image extracted via getCaptchaImageSrc().
 * Challenge created in KompasCaptchaStore (same BrowserContext/Page, TTL 7m),
 * surfaced as {status:"CAPTCHA_REQUIRED"}; user solves in TravelHub modal (#fcaptcha),
 * verified via submitCaptchaAnswer() in SAME context, then original
 * search/priceCalendar/refreshPrice resumed via resumeOperationAfterCaptcha().
 * No OCR / bypass; no secrets logged. IP change remains aValid fallback but not required.
 */
import { Injectable, Logger, OnModuleDestroy, Optional } from "@nestjs/common";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import { KompasCaptchaRequiredException } from "./kompas-captcha.exception";
import { KompasCaptchaStore } from "./kompas-captcha.store";
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

export interface KompasSearchQuery extends SupplierSearchQuery {
  programGroupInc?: string;
  stars?: string;
  starsAny?: boolean;
  towns?: string;
  townsAny?: boolean;
  hotelTypes?: string;
  freightType?: string;
  userFilter?: string;
  showTheBest?: boolean;
  stateFrom?: string;
  catClaim?: string;
}

/** §7: Fixed departure city — Baku only */
const BAKU_TOWNFROMINC = "1411";

/**
 * KOMPAS SAMO NIGHTS_FROM select only contains options 3–14.
 * Values outside this range are NOT silently clamped — the adapter
 * throws to prevent silent fallback to wrong results.
 */
const KOMPAS_NIGHTS_MIN = 3;
const KOMPAS_NIGHTS_MAX = 14;

@Injectable()
export class KompasSupplierAdapter implements SupplierAdapter, OnModuleDestroy {
  readonly code = "KOMPAS";
  readonly name = "KOMPAS (SAMO)";
  readonly enabled = true;

  private readonly logger = new Logger(KompasSupplierAdapter.name);
  private browser: Browser | null = null;
  private readonly browserLock = new Map<string, Promise<Browser>>();

  private readonly baseUrl: string;
  private static readonly MAX_PAGES = 15;
  private static readonly PAGE_DELAY_MS = 2_000;
  private static readonly TOURINC_DELAY_MS = 3_000;
  private static readonly CALENDAR_WINDOW_DAYS = 31;

  constructor(@Optional() private readonly captchaStore?: KompasCaptchaStore) {
    this.baseUrl = process.env.KOMPAS_BASE_URL || "https://online.az.kompastour.com";
    this.logger.log(`KOMPAS adapter initialized: baseUrl=${this.baseUrl}`);
  }

  // ── Program Discovery ─────────────────────────────────────────────

  /**
   * §10: Discover all available countries from Baku, then all programs per country.
   * Returns complete tour dictionary for KOMPAS from Baku.
   */
  async discoverCountriesAndPrograms(): Promise<
    Array<{ countryId: string; countryName: string; programs: Array<{ value: string; name: string }> }>
  > {
    let page: Page | null = null;
    try {
      const browser = await this.getBrowser();
      const context = await browser.newContext({
        userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36",
        locale: "ru-RU",
      });
      page = await context.newPage();

      await page.goto(`${this.baseUrl}/search_tour`, { waitUntil: "networkidle", timeout: 60_000 });
      await page.waitForFunction(
        () => typeof (window as any).samo !== "undefined" && (window as any).samo.page_ready === true,
        { timeout: 15_000 },
      );

      // Close popups
      await page.evaluate(() => {
        document.getElementById("samo_popup")?.remove();
        document.getElementById("samo_popup_mini")?.remove();
      });

      // §7: Set TOWNFROMINC to Baku
      await this.setSamoSelect(page, "TOWNFROMINC", BAKU_TOWNFROMINC);
      await page.waitForTimeout(5_000);

      // Get all country options
      const countries = await page.evaluate(() => {
        const sel = document.querySelector("select[name=STATEINC]") as HTMLSelectElement | null;
        if (!sel) return [];
        return Array.from(sel.options)
          .filter((o) => o.value !== "0" && o.value !== "")
          .map((o) => ({ value: o.value, name: o.text.trim() }));
      });

      this.logger.log(`KOMPAS: ${countries.length} countries from Baku`);

      const result: Array<{ countryId: string; countryName: string; programs: Array<{ value: string; name: string }> }> = [];

      for (const country of countries) {
        // Select country
        await this.setSamoSelect(page, "STATEINC", country.value);
        await page.waitForTimeout(5_000);

        // SAMO may reset TOWNFROMINC — verify and re-set Baku
        const currentTown = await page.evaluate(() => {
          const sel = document.querySelector("select[name=TOWNFROMINC]") as HTMLSelectElement | null;
          return sel?.value ?? "";
        });
        if (currentTown !== BAKU_TOWNFROMINC) {
          this.logger.warn(`discover: TOWNFROMINC reset to ${currentTown} after STATEINC, re-setting Baku`);
          await this.setSamoSelect(page, "TOWNFROMINC", BAKU_TOWNFROMINC);
          await page.waitForTimeout(5_000);
          // Re-select the country after re-setting TOWNFROMINC
          await this.setSamoSelect(page, "STATEINC", country.value);
          await page.waitForTimeout(5_000);
        }

        // Read TOURINC options for this country
        const programs = await page.evaluate(() => {
          const sel = document.querySelector("select[name=TOURINC]") as HTMLSelectElement | null;
          if (!sel) return [];
          return Array.from(sel.options)
            .filter((o) => o.value !== "0" && o.value !== "")
            .map((o) => ({ value: o.value, name: o.text.trim() }));
        });

        this.logger.log(`KOMPAS country ${country.name} (${country.value}): ${programs.length} programs`);
        result.push({ countryId: country.value, countryName: country.name, programs });
      }

      await context.close();
      return result;
    } catch (err) {
      this.logger.error(`KOMPAS country/program discovery failed: ${(err as Error).message}`);
      if (page) await page.context().close().catch(() => {});
      return [];
    }
  }

  /**
   * Legacy: discover programs for a specific country from Baku.
   */
  async discoverPrograms(countryId?: string): Promise<Array<{ value: string; name: string }>> {
    let page: Page | null = null;
    try {
      const browser = await this.getBrowser();
      const context = await browser.newContext({
        userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36",
        locale: "ru-RU",
      });
      page = await context.newPage();

      await page.goto(`${this.baseUrl}/search_tour`, { waitUntil: "networkidle", timeout: 60_000 });
      await page.waitForFunction(
        () => typeof (window as any).samo !== "undefined" && (window as any).samo.page_ready === true,
        { timeout: 15_000 },
      );

      await page.evaluate(() => {
        document.getElementById("samo_popup")?.remove();
        document.getElementById("samo_popup_mini")?.remove();
      });

      // §7: Set Baku
      await this.setSamoSelect(page, "TOWNFROMINC", BAKU_TOWNFROMINC);
      await page.waitForTimeout(5_000);

      // If country specified, select it
      if (countryId) {
        await this.setSamoSelect(page, "STATEINC", countryId);
        await page.waitForTimeout(5_000);
      }

      const programs = await page.evaluate(() => {
        const sel = document.querySelector("select[name=TOURINC]") as HTMLSelectElement | null;
        if (!sel) return [];
        return Array.from(sel.options)
          .filter((o) => o.value !== "0" && o.value !== "")
          .map((o) => ({ value: o.value, name: o.text.trim() }));
      });

      await context.close();
      this.logger.log(`KOMPAS discovered ${programs.length} programs`);
      return programs;
    } catch (err) {
      this.logger.error(`KOMPAS program discovery failed: ${(err as Error).message}`);
      if (page) await page.context().close().catch(() => {});
      return [];
    }
  }

  // ── Search ─────────────────────────────────────────────────────────

  async search(query: SupplierSearchQuery): Promise<SupplierOffer[]> {
    const startTime = Date.now();
    let page: Page | null = null;

    // §4: Validate nights range BEFORE launching browser.
    // KOMPAS SAMO NIGHTS_FROM has options 3–14 only.
    // Values outside this range cause silent fallback (browser clears selection).
    // We reject explicitly to prevent wrong results.
    if (query.nightsFrom && (query.nightsFrom < KOMPAS_NIGHTS_MIN || query.nightsFrom > KOMPAS_NIGHTS_MAX)) {
      throw new Error(
        `KOMPAS supports nights ${KOMPAS_NIGHTS_MIN}–${KOMPAS_NIGHTS_MAX} in the verified context. ` +
        `Requested nightsFrom: ${query.nightsFrom}.`
      );
    }
    if (query.nightsTo && (query.nightsTo < KOMPAS_NIGHTS_MIN || query.nightsTo > KOMPAS_NIGHTS_MAX)) {
      throw new Error(
        `KOMPAS supports nights ${KOMPAS_NIGHTS_MIN}–${KOMPAS_NIGHTS_MAX} in the verified context. ` +
        `Requested nightsTo: ${query.nightsTo}.`
      );
    }

    try {
      const browser = await this.getBrowser();
      const context = await browser.newContext({
        userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36",
        locale: "ru-RU",
      });
      page = await context.newPage();

      this.logger.debug("KOMPAS: navigating to search_tour");
      await page.goto(`${this.baseUrl}/search_tour`, { waitUntil: "networkidle", timeout: 60_000 });

      await page.waitForFunction(
        () => typeof (window as any).samo !== "undefined" && (window as any).samo.page_ready === true,
        { timeout: 15_000 },
      );

      // CAPTCHA check immediately after navigation — KOMPAS may show it before any filters.
      if (await this.isCaptchaPresent(page)) {
        await this.createCaptchaChallengeAndThrow(page, context, "search", query);
      }

      // Close popups
      await page.evaluate(() => {
        document.getElementById("samo_popup")?.remove();
        document.getElementById("samo_popup_mini")?.remove();
      });

      // §7: TOWNFROMINC = Baku ALWAYS
      await this.setSamoSelect(page, "TOWNFROMINC", BAKU_TOWNFROMINC);
      await page.waitForTimeout(2_000);
      // Wait for STATEINC options to populate for Baku (Turkey 17 should appear)
      if (this.mapStateInc(query.destination ?? query.country)) {
        try {
          await page.waitForFunction(
            (sid: string) => !!document.querySelector(`select[name=STATEINC] option[value="${sid}"]`),
            this.mapStateInc(query.destination ?? query.country)!,
            { timeout: 10_000 },
          );
        } catch {}
      }
      await page.waitForTimeout(1_000);

// STATEINC (destination country) — set from query if provided
      const stateId = this.mapStateInc(query.destination ?? query.country);
      if (stateId) {
        await this.setSamoSelect(page, "STATEINC", stateId);
        await page.waitForTimeout(2_000);
        // Wait for TOURINC options for this country to populate
        if (query.tourIncValue) {
          try {
            await page.waitForFunction(
              (tid: string) => !!document.querySelector(`select[name=TOURINC] option[value="${tid}"]`),
              query.tourIncValue,
              { timeout: 10_000 },
            );
          } catch {}
        }
        await page.waitForTimeout(1_000);
        // SAMO may reset TOWNFROMINC after STATEINC change — verify and re-set Baku
        const currentTown = await page.evaluate(() => {
          const sel = document.querySelector("select[name=TOWNFROMINC]") as HTMLSelectElement | null;
          return sel?.value ?? "";
        });
        if (currentTown !== BAKU_TOWNFROMINC) {
          this.logger.warn(`TOWNFROMINC was reset to ${currentTown} after STATEINC, re-setting Baku`);
          await this.setSamoSelect(page, "TOWNFROMINC", BAKU_TOWNFROMINC);
          await page.waitForTimeout(5_000);
          await this.setSamoSelect(page, "STATEINC", stateId);
          await page.waitForTimeout(5_000);
        }
      }

// TOURINC program
      if (query.tourIncValue) {
        await page.evaluate((val: string) => {
          const sel = document.querySelector("select[name=TOURINC]") as HTMLSelectElement | null;
          if (sel) {
            sel.value = val;
            sel.dispatchEvent(new Event("change", { bubbles: true }));
          }
        }, query.tourIncValue);
        await page.waitForTimeout(KompasSupplierAdapter.TOURINC_DELAY_MS);
        this.logger.debug(`Set TOURINC to ${query.tourIncValue} (${query.tourIncName ?? "?"})`);
        // Wait for hotel list for this tour to populate if hotel filter is needed
        if (query.hotelExternalId) {
          try {
            await page.waitForFunction(
              (hid: string) => !!document.querySelector(`#hotel${hid}`),
              query.hotelExternalId,
              { timeout: 10_000 },
            );
          } catch {}
          await page.waitForTimeout(500);
        }
      }

      // Nights, adults, children
      // Validation already done at top of search() — no need to re-check here.
      const nightsFrom = query.nightsFrom;
      const nightsTo = query.nightsTo;
      if (nightsFrom) await this.setSamoSelect(page, "NIGHTS_FROM", String(nightsFrom));
      if (nightsTo) await this.setSamoSelect(page, "NIGHTS_TILL", String(nightsTo));
      if (query.adults && query.adults > 0) await this.setSamoSelect(page, "ADULT", String(query.adults));
      if (query.children !== undefined && query.children !== null) {
        await this.setSamoSelect(page, "CHILD", String(query.children));
      }
      const ages = query.childAges ?? [];
      if (ages.length >= 1) await this.setSamoSelect(page, "AGE1", String(ages[0]));
      if (ages.length >= 2) await this.setSamoSelect(page, "AGE2", String(ages[1]));
      if (ages.length >= 3) await this.setSamoSelect(page, "AGE3", String(ages[2]));

      // Additional KOMPAS-specific filters
      const kq = query as KompasSearchQuery;
      if (kq.stars) await this.setSamoSelect(page, "STARS", kq.stars);
      if (kq.towns) await this.setSamoSelect(page, "TOWNS", kq.towns);
      if (kq.freightType) await this.setSamoSelect(page, "FREIGHTTYPE", kq.freightType);
      if (kq.hotelTypes) await this.setSamoSelect(page, "HOTELTYPES", kq.hotelTypes);

      // §8: Hotel checkbox — check specific hotel when hotelExternalId is provided.
      // This causes the PRICES request to include HOTELS=<id> + HOTELS_ANY=0,
      // returning only offers for the selected hotel (server-side filtering).
      let hotelFilterApplied = false;
      if (query.hotelExternalId) {
        const hotelId = query.hotelExternalId;
        hotelFilterApplied = await page.evaluate((id: string) => {
          // Enable hotel selection mode
          const sel = document.querySelector('input[name=HOTELS_SEL]') as HTMLInputElement | null;
          if (sel && !sel.checked) sel.click();

          // Uncheck "any hotel" to enable specific hotel filtering
          const any = document.querySelector('input[name=HOTELS_ANY]') as HTMLInputElement | null;
          if (any && any.checked) any.click();

          // Check the specific hotel checkbox
          const cb = document.querySelector(`#hotel${id}`) as HTMLInputElement | null;
          if (cb && !cb.checked) {
            cb.click();
            return true;
          }
          return cb?.checked ?? false;
        }, hotelId);
        if (hotelFilterApplied) {
          this.logger.debug(`KOMPAS: checked hotel checkbox for ID ${hotelId}`);
        } else {
          this.logger.warn(`KOMPAS: hotel checkbox #hotel${hotelId} not found in DOM`);
        }
        await page.waitForTimeout(1_000);
      }

      // Set dates via DOM
      if (query.departureDateFrom && query.departureDateTo) {
        const begDate = this.isoToSamodate(query.departureDateFrom);
        const endDate = this.isoToSamodate(query.departureDateTo);
        await page.evaluate(
          ({ beg, end }: { beg: string; end: string }) => {
            for (const [name, val] of [["CHECKIN_BEG", beg], ["CHECKIN_END", end]]) {
              const input = document.querySelector(`input[name=${name}]`) as HTMLInputElement | null;
              if (input) {
                input.value = val;
                input.dispatchEvent(new Event("change", { bubbles: true }));
              }
            }
          },
          { beg: begDate, end: endDate },
        );
      }

      // Intercept PRICES request to force hotel filter and rewrite dates
      const routeDates = query.departureDateFrom && query.departureDateTo
        ? { beg: query.departureDateFrom.replace(/-/g, ""), end: query.departureDateTo.replace(/-/g, "") }
        : null;

      await page.route("**samo_action=PRICES**", (route) => {
        let url = route.request().url();
        const origUrl = url;
        // When hotel checkbox was checked, HOTELS=<id> is already in the URL from the form.
        // Only strip HOTELS when doing a generic search (no hotel checkbox).
        // With the checkbox properly checked, KOMPAS returns hotel-specific results.
        if (!hotelFilterApplied) {
          url = url.replace(/HOTELS=\d+&?/g, "").replace(/HOTELS_ANY=\d+&?/g, "");
        }
        if (routeDates) {
          url = url.replace(/CHECKIN_BEG=\d*/g, `CHECKIN_BEG=${routeDates.beg}`)
                   .replace(/CHECKIN_END=\d*/g, `CHECKIN_END=${routeDates.end}`);
        }
        // §9: Force FREIGHT=1 (seats available on flight), FILTER=1 (no sales stop),
        // and PARTITION_PRICE=0 (no grouping — return all individual room/meal variants).
        if (!url.includes("FREIGHT=")) {
          url += "&FREIGHT=1";
        } else {
          url = url.replace(/FREIGHT=\d+/g, "FREIGHT=1");
        }
        if (!url.includes("FILTER=")) {
          url += "&FILTER=1";
        } else {
          url = url.replace(/FILTER=\d+/g, "FILTER=1");
        }
        if (!url.includes("PARTITION_PRICE=")) {
          url += "&PARTITION_PRICE=0";
        } else {
          url = url.replace(/PARTITION_PRICE=\d+/g, "PARTITION_PRICE=0");
        }
        this.logger.debug(`KOMPAS PRICES intercept: ${origUrl.slice(0,400)} -> ${url.slice(0,400)} hotelFilter=${hotelFilterApplied}`);
        route.continue({ url });
      });

      // Click search
      await page.evaluate(() => {
        document.getElementById("samo_popup")?.remove();
      });
      const searchBtn = await page.$(".load");
      if (!searchBtn) {
        this.logger.warn("KOMPAS: .load button not found");
        await context.close();
        return [];
      }

      await searchBtn.click({ force: true });

      try {
        await page.waitForSelector("tr.price_info", { timeout: 30_000 });
      } catch {
        // Check if absence is due to CAPTCHA rather than NO_RESULT.
        if (await this.isCaptchaPresent(page)) {
          await this.createCaptchaChallengeAndThrow(page, context, "search", query);
        }
        // Debug: dump page title + first 500 chars of body for diagnostics
        const dbg = await page.evaluate(() => ({
          title: document.title,
          url: location.href,
          bodySnippet: document.body?.innerText?.slice(0, 500) ?? "",
          hasCaptcha: !!document.querySelector("#captchaForm, #icaptcha, #fcaptcha"),
          rowPrice: document.querySelectorAll("tr.price_info").length,
          rowAll: document.querySelectorAll("tr").length,
        })).catch(() => null);
        const dbgLine = `[KOMPAS] NO_ROWS page=${JSON.stringify(dbg)} | ${new Date().toISOString()}\n`;
        try { require("fs").appendFileSync("D:\\travelhub_v1\\backend_price_chain.log", dbgLine); } catch {}
        this.logger.warn(`KOMPAS: no price_info rows appeared. page=${JSON.stringify(dbg)}`);
        await context.close();
        return [];
      }

      // CAPTCHA may also appear together with empty result (anti-bot HTML).
      if (await this.isCaptchaPresent(page)) {
        await this.createCaptchaChallengeAndThrow(page, context, "search", query);
      }

      await page.waitForTimeout(2_000);

      // §6: DOM/result consistency — verify at least one row matches expected tour.
      // With PARTITION_PRICE=0, rows from different tours may appear; only stateKey/townFromKey must match.
      const expectedTourKey = query.tourIncValue ?? "";
      const expectedStateKey = this.mapStateInc(query.destination ?? query.country) ?? "";
      const expectedTownFromKey = BAKU_TOWNFROMINC;
      const consistencyIssue = await page.evaluate(
        (expected: { tourKey: string; stateKey: string; townFromKey: string }) => {
          const rows = Array.from(document.querySelectorAll("tr.price_info"));
          if (rows.length === 0) return "no rows";
          const firstRow = rows[0];
          const cls = firstRow.className;
          const stateKey = cls.match(/stateKey-(\d+)/)?.[1] ?? "";
          const townFromKey = cls.match(/townFromKey-(\d+)/)?.[1] ?? "";
          const mismatches: string[] = [];
          // stateKey and townFromKey must match on first row
          if (expected.stateKey && stateKey !== expected.stateKey) mismatches.push(`stateKey: expected ${expected.stateKey}, got ${stateKey}`);
          if (expected.townFromKey && townFromKey !== expected.townFromKey) mismatches.push(`townFromKey: expected ${expected.townFromKey}, got ${townFromKey}`);
          // tourKey: check if ANY row has the expected tour (soft check — with PARTITION_PRICE=0 other tours may be first)
          if (expected.tourKey) {
            const hasTour = rows.some((r) => {
              const m = r.className.match(/tourKey-(\d+)/);
              return m?.[1] === expected.tourKey;
            });
            if (!hasTour) mismatches.push(`tourKey: expected ${expected.tourKey} but no row has it`);
          }
          return mismatches.length > 0 ? mismatches.join("; ") : null;
        },
        { tourKey: expectedTourKey, stateKey: expectedStateKey, townFromKey: expectedTownFromKey },
      );
      if (consistencyIssue) {
        const cLine = `[KOMPAS] CONSISTENCY_FAIL ${consistencyIssue} | ${new Date().toISOString()}\n`;
        try { require("fs").appendFileSync("D:\\travelhub_v1\\backend_price_chain.log", cLine); } catch {}
        await context.close();
        throw new Error(
          `KOMPAS DOM consistency hard-fail: ${consistencyIssue}. ` +
          `Result would be presented as response to a different query — rejecting.`
        );
      }

      const allOffers: any[] = [];
      let currentPageOffers = await this.extractPageOffers(page);
      allOffers.push(...currentPageOffers);

      for (let p = 2; p <= KompasSupplierAdapter.MAX_PAGES; p++) {
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
        await page.waitForTimeout(KompasSupplierAdapter.PAGE_DELAY_MS);
        try {
          await page.waitForSelector("tr.price_info", { timeout: 10_000 });
        } catch { break; }
        await page.waitForTimeout(1_000);
        currentPageOffers = await this.extractPageOffers(page);
        allOffers.push(...currentPageOffers);
      }

      await context.close();

      const latencyMs = Date.now() - startTime;
      this.logger.log(`KOMPAS search: ${allOffers.length} raw offers in ${latencyMs}ms`);

      return allOffers.map((raw) => this.normalizeOffer(raw, query));
    } catch (err) {
      // CAPTCHA flow owns its context — do NOT close it here.
      if (err instanceof KompasCaptchaRequiredException) throw err;
      this.logger.error(`KOMPAS search failed: ${(err as Error).message}`);
      if (page) await page.context().close().catch(() => {});
      throw err;
    }
  }

  // ── CAPTCHA Human-in-the-Loop ─────────────────────────────────────

  private async isCaptchaPresent(page: Page): Promise<boolean> {
    try {
      const hasForm = await page.locator("#captchaForm").count().then((c) => c > 0).catch(() => false);
      const hasImg = await page.locator("#icaptcha").count().then((c) => c > 0).catch(() => false);
      if (hasForm && hasImg) return true;
      // Fallback: generic captchaForm name or class
      const generic = await page.evaluate(() => {
        const f = document.querySelector('#captchaForm, form[name="captchaForm"]');
        const img = document.querySelector('#icaptcha, img.captcha-self');
        const fcaptcha = document.querySelector('#fcaptcha, input[name="antibot"]');
        const samoBlock = document.querySelector('.samo-block, .captcha-block, .samo_message');
        return !!(f || img || fcaptcha || samoBlock);
      }).catch(() => false);
      if (generic) return true;
      // Last resort: check if page title/body contains captcha keywords
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
      // Fallback: evaluate directly
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

  private async createCaptchaChallengeAndThrow(
    page: Page,
    context: BrowserContext,
    operation: "search" | "priceCalendar" | "refreshPrice" | "refreshAvailability" | "getOffer",
    originalQuery: SupplierSearchQuery | PriceCalendarQuery | SupplierOfferRef,
  ): Promise<never> {
    const src = await this.getCaptchaImageSrc(page);
    if (!src) {
      throw new Error("KOMPAS CAPTCHA detected but #icaptcha src is missing or not data:image — cannot present to user");
    }
    if (!this.captchaStore) {
      throw new Error("KompasCaptchaStore not injected — cannot create human-in-the-loop challenge");
    }
    const ch = this.captchaStore.create({
      supplier: "KOMPAS",
      operation,
      originalQuery,
      context,
      page,
      captchaImage: src,
      mimeType: this.inferMimeType(src),
    });
    throw new KompasCaptchaRequiredException(ch.challengeId, src, ch.mimeType);
  }

  /**
   * Submit CAPTCHA answer in the SAME browser context/page.
   * Fills #fcaptcha and submits #captchaForm via real KOMPAS mechanism.
   * Does NOT close the page/context — caller owns lifecycle via store.
   */
  async submitCaptchaAnswer(challengeId: string, answer: string): Promise<{ status: string; newImage?: string }> {
    const ch = this.captchaStore?.get(challengeId);
    if (!ch) return { status: "EXPIRED" };
    if (ch.expiresAt.getTime() < Date.now()) {
      ch.status = "EXPIRED";
      return { status: "EXPIRED" };
    }
    if (!ch.page || ch.page.isClosed()) {
      ch.status = "SESSION_LOST";
      return { status: "SESSION_LOST" };
    }
    ch.status = "SUBMITTING";
    this.logger.log(JSON.stringify({ event: "KOMPAS_CAPTCHA_SUBMIT_STARTED", challengeId, operation: ch.operation }));
    const page = ch.page;
    try {
      // Fill #fcaptcha
      const fcaptcha = page.locator("#fcaptcha");
      if (await fcaptcha.count() === 0) {
        // Fallback: generic
        const alt = page.locator('input[name="fcaptcha"], input[name="captcha"]');
        if (await alt.count() > 0) {
          await alt.first().fill(answer);
        } else {
          ch.status = "KOMPAS_ERROR";
          return { status: "KOMPAS_ERROR" };
        }
      } else {
        await fcaptcha.fill(answer);
      }

      // Submit #captchaForm via real mechanism.
      // Prefer form.submit() to ensure SAMO handlers fire.
      const submitted = await page.evaluate(() => {
        const form = document.querySelector("#captchaForm") as HTMLFormElement | null;
        if (form) {
          // Trigger submit event so KOMPAS JS can handle it
          const ev = new Event("submit", { bubbles: true, cancelable: true });
          const notCancelled = form.dispatchEvent(ev);
          // If not prevented, submit normally
          if (notCancelled) form.submit();
          return true;
        }
        const btn = document.querySelector('#captchaForm button[type="submit"], #captchaForm input[type="submit"]') as HTMLElement | null;
        if (btn) {
          btn.click();
          return true;
        }
        return false;
      }).catch(() => false);

      if (!submitted) {
        // Try clicking submit button via locator
        const btn = page.locator('#captchaForm button[type="submit"], #captchaForm input[type="submit"]');
        if (await btn.count() > 0) {
          await btn.first().click({ force: true });
        }
      }

      // Wait for KOMPAS response: either captcha gone or samo.showCaptchaError or new image
      await page.waitForTimeout(2_000);
      // Wait for either price_info or captcha re-appears or error
      try {
        await page.waitForFunction(
          () => {
            const hasCaptcha = !!document.querySelector("#captchaForm") && !!document.querySelector("#icaptcha");
            const hasPrices = document.querySelectorAll("tr.price_info").length > 0;
            const hasError = !!document.querySelector(".captcha-error, #captchaError, [class*='captcha-error']");
            // Also check samo state
            const samoReady = (window as any).samo && (window as any).samo.page_ready === true;
            return hasPrices || !hasCaptcha || hasError || samoReady;
          },
          { timeout: 15_000 },
        );
      } catch {}

      await page.waitForTimeout(1_000);

      // Determine result
      const stillCaptcha = await this.isCaptchaPresent(page);
      if (!stillCaptcha) {
        // Check if there is an explicit error message via samo.showCaptchaError path
        const hasError = await page.evaluate(() => {
          const el = document.querySelector(".captcha-error, #captchaError, [class*='captcha-error']");
          if (el && el.textContent && el.textContent.trim().length > 0) return true;
          // Check if page still shows same captcha form due to invalid
          return false;
        }).catch(() => false);
        if (hasError) {
          ch.status = "INVALID_ANSWER";
          const newImg = await this.getCaptchaImageSrc(page);
          this.logger.log(JSON.stringify({ event: "KOMPAS_CAPTCHA_INVALID", challengeId }));
          return { status: "INVALID_ANSWER", newImage: newImg ?? undefined };
        }
        ch.status = "SUCCESS";
        this.logger.log(JSON.stringify({ event: "KOMPAS_CAPTCHA_SUCCESS", challengeId, operation: ch.operation }));
        return { status: "SUCCESS" };
      }

      // Still captcha -> either invalid answer (new image) or same image (error)
      const newImg = await this.getCaptchaImageSrc(page);
      if (newImg && newImg !== ch.captchaImage) {
        // New image indicates KOMPAS issued a fresh challenge (common after invalid)
        this.captchaStore?.updateImage(challengeId, newImg, this.inferMimeType(newImg));
        ch.status = "INVALID_ANSWER";
        this.logger.log(JSON.stringify({ event: "KOMPAS_CAPTCHA_INVALID", challengeId }));
        return { status: "INVALID_ANSWER", newImage: newImg };
      }

      // Same image still present — likely invalid without new image, or not yet refreshed
      ch.status = "INVALID_ANSWER";
      this.logger.log(JSON.stringify({ event: "KOMPAS_CAPTCHA_INVALID", challengeId }));
      return { status: "INVALID_ANSWER", newImage: newImg ?? undefined };
    } catch (err) {
      const msg = (err as Error).message;
      this.logger.error(`submitCaptchaAnswer failed challengeId=${challengeId}: ${msg}`);
      // Distinguish session lost
      if (page.isClosed()) {
        ch.status = "SESSION_LOST";
        return { status: "SESSION_LOST" };
      }
      ch.status = "KOMPAS_ERROR";
      return { status: "KOMPAS_ERROR" };
    }
  }

  async refreshCaptchaImage(challengeId: string): Promise<{ status: string; newImage?: string }> {
    const ch = this.captchaStore?.get(challengeId);
    if (!ch) return { status: "EXPIRED" };
    if (ch.expiresAt.getTime() < Date.now()) {
      ch.status = "EXPIRED";
      return { status: "EXPIRED" };
    }
    if (!ch.page || ch.page.isClosed()) {
      ch.status = "SESSION_LOST";
      return { status: "SESSION_LOST" };
    }
    const page = ch.page;
    try {
      const oldSrc = ch.captchaImage;
      // Trigger KOMPAS refresh: click #recaptcha or evaluate samo.captchaRefreshUrl
      const refreshed = await page.evaluate(() => {
        const recaptcha = document.querySelector("#recaptcha") as HTMLElement | null;
        if (recaptcha) {
          recaptcha.click();
          return "recaptcha-click";
        }
        const samo = (window as any).samo;
        if (samo && samo.captchaRefreshUrl) {
          // KOMPAS expects a GET to refreshUrl which returns new base64
          // But clicking the image or link usually triggers fetch. Try to call a known handler.
          const img = document.querySelector("#icaptcha") as HTMLImageElement | null;
          if (img) img.click();
          return "samo-click";
        }
        return "no-op";
      }).catch(() => "error");

      // Wait for image src to change
      try {
        await page.waitForFunction(
          (old) => {
            const el = document.querySelector("#icaptcha") as HTMLImageElement | null;
            return !!el && el.src !== old && el.src.startsWith("data:image/");
          },
          oldSrc,
          { timeout: 10_000 },
        );
      } catch {}

      await page.waitForTimeout(800);
      const newSrc = await this.getCaptchaImageSrc(page);
      if (newSrc && newSrc !== oldSrc) {
        this.captchaStore?.updateImage(challengeId, newSrc, this.inferMimeType(newSrc));
        this.logger.log(JSON.stringify({ event: "KOMPAS_CAPTCHA_REFRESHED", challengeId }));
        return { status: "WAITING_FOR_USER", newImage: newSrc };
      }
      // Even if same, return current
      const current = newSrc ?? oldSrc;
      this.captchaStore?.updateImage(challengeId, current, this.inferMimeType(current));
      return { status: "WAITING_FOR_USER", newImage: current };
    } catch (err) {
      this.logger.error(`refreshCaptchaImage failed ${challengeId}: ${(err as Error).message}`);
      return { status: "KOMPAS_ERROR" };
    }
  }

  /** Resume original operation after successful CAPTCHA using SAME page/context. */
  async resumeOperationAfterCaptcha(challengeId: string): Promise<SupplierOffer[] | PriceCalendarResult | SupplierPriceSnapshot | SupplierAvailabilitySnapshot | SupplierOfferDetail> {
    const ch = this.captchaStore?.get(challengeId);
    if (!ch) throw new Error("EXPIRED");
    if (ch.page.isClosed()) {
      ch.status = "SESSION_LOST";
      throw new Error("SESSION_LOST");
    }

    const op = ch.operation;
    const query = ch.originalQuery;
    const page = ch.page;

    // After success, the page should have prices or be ready to re-run logic.
    // We reuse the page: for search/priceCalendar we will attempt to extract offers.
    // For simplicity, we delegate to a helper that waits for price_info and extracts.
    this.logger.log(JSON.stringify({ event: "KOMPAS_CAPTCHA_RESUME", challengeId, operation: op }));

    if (op === "search") {
      const q = query as SupplierSearchQuery;
      // Try to wait for prices after captcha solve — KOMPAS often stays on same page with results.
      try {
        await page.waitForSelector("tr.price_info", { timeout: 20_000 });
      } catch {
        // If not found, try to re-trigger search by clicking .load again (same page already configured)
        const btn = await page.$(".load");
        if (btn) {
          await btn.click({ force: true });
          await page.waitForSelector("tr.price_info", { timeout: 20_000 }).catch(() => {});
        }
      }
      const offers = await this.extractPageOffers(page);
      // Handle pagination as in search — but we already have page, reuse logic
      const all: any[] = [...offers];
      for (let p = 2; p <= KompasSupplierAdapter.MAX_PAGES; p++) {
        const hasNext = await page.evaluate((tp: number) => {
          const spans = document.querySelectorAll(".pager span.page");
          const target = Array.from(spans).find((s) => s.getAttribute("data-page") === String(tp));
          if (target) { (target as HTMLElement).click(); return true; }
          return false;
        }, p);
        if (!hasNext) break;
        await page.waitForTimeout(KompasSupplierAdapter.PAGE_DELAY_MS);
        try { await page.waitForSelector("tr.price_info", { timeout: 10_000 }); } catch { break; }
        await page.waitForTimeout(500);
        const pg = await this.extractPageOffers(page);
        all.push(...pg);
      }
      return all.map((raw) => this.normalizeOffer(raw, q));
    }

    if (op === "priceCalendar") {
      const q = query as PriceCalendarQuery;
      // For calendar, we need to re-run the window loop using SAME page — we cannot call this.search (creates new page).
      // Instead we run a simplified calendar fetch using the current page as base for each window.
      // To keep store ownership correct, we will run getPriceCalendar logic but bypass per-window new page creation
      // by calling a helper that uses the provided page for the first window and creates fresh contexts for rest.
      // Simpler: close this captcha page's context is NOT closed yet; we will run the original getPriceCalendar
      // but reuse the already-solved session by copying cookies? However probe showed new context gets new SAMO session.
      // So we must run calendar windows sequentially reusing the SAME context/page where possible.
      // We'll implement: for each window, navigate/apply filters on the SAME page (instead of new context per window) after first.
      return this.getPriceCalendarSameContext(page, page.context(), q);
    }

    if (op === "refreshPrice") {
      const ref = query as SupplierOfferRef;
      // After captcha success, re-run refreshPrice logic using same page
      // Build query from ref.searchContext
      const q: SupplierSearchQuery = {
        country: (ref.searchContext as any).country,
        departureCity: (ref.searchContext as any).departureCity,
        destination: (ref.searchContext as any).destination,
        adults: (ref.searchContext as any).adults,
        children: (ref.searchContext as any).children,
        childAges: (ref.searchContext as any).childAges,
        hotel: (ref.searchContext as any).hotel,
        hotelExternalId: (ref.searchContext as any).hotelExternalId,
        room: (ref.searchContext as any).room,
        meal: (ref.searchContext as any).meal,
        nightsFrom: (ref.searchContext as any).nightsFrom,
        nightsTo: (ref.searchContext as any).nightsTo,
        departureDateFrom: (ref.searchContext as any).departureDateFrom,
        departureDateTo: (ref.searchContext as any).departureDateTo,
        tourIncValue: (ref.searchContext as any).tourIncValue,
        tourIncName: (ref.searchContext as any).tourIncName,
      };
      const offers = await this.searchWithPage(page, q);
      const match = this.matchOffer(offers, ref);
      if (match) return match.price;
      return {
        amount: 0,
        currency: "USD",
        fetchedAt: new Date(),
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
        queryHash: JSON.stringify(ref.searchContext),
        source: this.code,
      } as SupplierPriceSnapshot;
    }

    throw new Error(`Unsupported resume operation: ${op}`);
  }

  /**
   * Helper: run a search using a provided Page (same context) instead of creating a new one.
   * Used for resume after CAPTCHA.
   */
  private async searchWithPage(page: Page, query: SupplierSearchQuery): Promise<SupplierOffer[]> {
    // This is a lightweight variant that assumes TOWNFROMINC/STATEINC already set on page
    // but re-applies dates and clicks search. For full correctness we reuse the same
    // filter-setting logic but without creating a new context.
    await page.waitForTimeout(500);
    // Re-apply dates if present
    if (query.departureDateFrom && query.departureDateTo) {
      const begDate = this.isoToSamodate(query.departureDateFrom);
      const endDate = this.isoToSamodate(query.departureDateTo);
      await page.evaluate(({ beg, end }: { beg: string; end: string }) => {
        for (const [name, val] of [["CHECKIN_BEG", beg], ["CHECKIN_END", end]]) {
          const input = document.querySelector(`input[name=${name}]`) as HTMLInputElement | null;
          if (input) {
            input.value = val;
            input.dispatchEvent(new Event("change", { bubbles: true }));
          }
        }
      }, { beg: begDate, end: endDate });
    }
    // Click search if button exists
    const btn = await page.$(".load");
    if (btn) {
      await btn.click({ force: true });
      try { await page.waitForSelector("tr.price_info", { timeout: 20_000 }); } catch {}
      await page.waitForTimeout(1_000);
      const rows = await this.extractPageOffers(page);
      return rows.map((r) => this.normalizeOffer(r, query));
    }
    // Fallback: try direct PRICES fetch via page.goto with same session (keeps cookies)
    const routeDates = query.departureDateFrom && query.departureDateTo
      ? { beg: query.departureDateFrom.replace(/-/g, ""), end: query.departureDateTo.replace(/-/g, "") }
      : null;
    let pricesUrl = `${this.baseUrl}/search_tour?samo_action=PRICES`;
    if (routeDates) pricesUrl += `&CHECKIN_BEG=${routeDates.beg}&CHECKIN_END=${routeDates.end}`;
    pricesUrl += `&FREIGHT=1&FILTER=1`;
    if (query.hotelExternalId) pricesUrl += `&HOTELS=${query.hotelExternalId}&HOTELS_ANY=0`;
    await page.goto(pricesUrl, { waitUntil: "networkidle", timeout: 30_000 }).catch(() => {});
    try { await page.waitForSelector("tr.price_info", { timeout: 15_000 }); } catch {}
    const rows = await this.extractPageOffers(page);
    return rows.map((r) => this.normalizeOffer(r, query));
  }

  private async getPriceCalendarSameContext(page: Page, context: BrowserContext, query: PriceCalendarQuery): Promise<PriceCalendarResult> {
    const now = new Date();
    const windows = this.generateCalendarWindows(query.dateFrom, query.dateTo);
    const baseSearch: SupplierSearchQuery = {
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
      destination: query.destination ?? this.deriveCountryFromTourIncName(query.tourIncName) ?? this.deriveCountryFromTourIncName(query.tourIncNames?.[0]) ?? undefined,
    };
    const programs = (query.tourIncValues?.length ?? 0) > 0
      ? query.tourIncValues!.map((v, i) => ({ value: v, name: query.tourIncNames?.[i] }))
      : query.tourIncValue ? [{ value: query.tourIncValue, name: query.tourIncName }] : [];
    const collected: SupplierOffer[] = [];
    let totalScanned = 0;
    // Reuse SAME page for all windows after captcha solve — navigate fresh per window but keep session.
    for (const window of windows) {
      if (programs.length > 0) {
        for (const program of programs) {
          try {
            const offers = await this.searchReusePage(page, { ...baseSearch, departureDateFrom: window.from, departureDateTo: window.to, tourIncValue: program.value, tourIncName: program.name });
            collected.push(...offers);
            totalScanned += offers.length;
          } catch (err) {
            if ((err as Error).message.includes("CAPTCHA_REQUIRED") || (err as Error).name === "KompasCaptchaRequiredException") throw err;
            this.logger.warn(`window ${window.from}→${window.to} program ${program.value} failed: ${(err as Error).message}`);
          }
        }
      } else {
        try {
          const offers = await this.searchReusePage(page, { ...baseSearch, departureDateFrom: window.from, departureDateTo: window.to });
          collected.push(...offers);
          totalScanned += offers.length;
        } catch (err) {
          if ((err as Error).message.includes("CAPTCHA_REQUIRED") || (err as Error).name === "KompasCaptchaRequiredException") throw err;
          this.logger.warn(`window ${window.from}→${window.to} failed: ${(err as Error).message}`);
        }
      }
    }
    // Deduplicate + build entries (same as getPriceCalendar tail)
    let filtered = collected;
    if (query.hotel) {
      const norm = (s: string) => s.toLowerCase().replace(/\s*\r?\n\s*/g, " ").replace(/\s{2,}/g, " ").trim();
      const h = norm(query.hotel);
      filtered = collected.filter((o) => (o.hotel && norm(o.hotel).includes(h)) || (query.hotelExternalId != null && o.hotelExternalId === query.hotelExternalId));
    }
    console.log(`[KOMPAS dedup ctx] filtered=${filtered.length} offers, before dedup`);
    for (const o of filtered.slice(0, 10)) {
      const rm = o.rawMetadata as any;
      console.log(`  offer: spoKey=${o.externalOfferId} date=${o.departureDate} roomKey=${rm?.roomKey} mealKey=${rm?.mealKey} room="${o.room}" meal="${o.meal}" price=${o.price.amount} tourKey=${rm?.tourKey}`);
    }
    const deduped = this.deduplicateCalendarOffers(filtered);
    console.log(`[KOMPAS dedup ctx] after dedup: ${deduped.length} offers`);
    const dateMap = new Map<string, SupplierOffer[]>();
    for (const offer of deduped) {
      const list = dateMap.get(offer.departureDate) || [];
      list.push(offer);
      dateMap.set(offer.departureDate, list);
    }
    const allDates: string[] = [];
    const current = new Date(query.dateFrom);
    const end = new Date(query.dateTo);
    while (current <= end) { allDates.push(this.formatDate(current)); current.setDate(current.getDate() + 1); }
    const entries: PriceCalendarEntry[] = [];
    for (const date of allDates) {
      const dateOffers = dateMap.get(date);
      if (dateOffers && dateOffers.length > 0) {
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
            hotel: o.hotel,
            hotelExternalId: o.hotelExternalId,
            departureDate: o.departureDate,
            nights: o.nights,
            room: o.room,
            meal: o.meal,
            adults: o.adults,
            children: o.children,
            childAges: o.childAges,
            availability: o.availability,
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
              hotelExternalId: query.hotelExternalId,
              room: query.room,
              meal: query.meal,
              nightsFrom: query.nights,
              nightsTo: query.nights,
              tourIncValue: (best.rawMetadata?.tourIncValue as string) ?? query.tourIncValue,
              tourIncName: (best.rawMetadata?.tourIncName as string) ?? query.tourIncName,
              destination: query.destination,
              country: query.destination,
            },
          },
        });
      } else {
        entries.push({ date, price: null, currency: null, availability: "NOT_AVAILABLE", offerCount: 0, absenceCode: "SUPPLIER_NO_RESULT", absenceText: "Цена не получена — KOMPAS не предоставил предложение на эту дату" });
      }
    }
    entries.sort((a, b) => a.date.localeCompare(b.date));
    return { supplierCode: this.code, contextHash: JSON.stringify({ hotel: query.hotel, room: query.room, meal: query.meal, adults: query.adults, children: query.children, nights: query.nights }), entries, dateFrom: query.dateFrom, dateTo: query.dateTo, fetchedAt: now, expiresAt: new Date(now.getTime() + 5 * 60 * 1000), totalOffersScanned: totalScanned };
  }

  private async searchReusePage(page: Page, query: SupplierSearchQuery): Promise<SupplierOffer[]> {
    // Navigate fresh search_tour on SAME page/context to keep SAMO session (captcha already passed)
    await page.goto(`${this.baseUrl}/search_tour`, { waitUntil: "networkidle", timeout: 60_000 });
    await page.waitForFunction(() => typeof (window as any).samo !== "undefined" && (window as any).samo.page_ready === true, { timeout: 15_000 });
    await page.evaluate(() => { document.getElementById("samo_popup")?.remove(); document.getElementById("samo_popup_mini")?.remove(); });
    await this.setSamoSelect(page, "TOWNFROMINC", BAKU_TOWNFROMINC);
    await page.waitForTimeout(2_000);
    const stateId = this.mapStateInc(query.destination ?? query.country);
    if (stateId) {
      await this.setSamoSelect(page, "STATEINC", stateId);
      await page.waitForTimeout(2_000);
      const cur = await page.evaluate(() => (document.querySelector("select[name=TOWNFROMINC]") as HTMLSelectElement | null)?.value ?? "");
      if (cur !== BAKU_TOWNFROMINC) {
        await this.setSamoSelect(page, "TOWNFROMINC", BAKU_TOWNFROMINC);
        await page.waitForTimeout(2_000);
        await this.setSamoSelect(page, "STATEINC", stateId);
        await page.waitForTimeout(2_000);
      }
    }
    if (query.tourIncValue) {
      await page.evaluate((val: string) => {
        const sel = document.querySelector("select[name=TOURINC]") as HTMLSelectElement | null;
        if (sel) { sel.value = val; sel.dispatchEvent(new Event("change", { bubbles: true })); }
      }, query.tourIncValue);
      await page.waitForTimeout(KompasSupplierAdapter.TOURINC_DELAY_MS);
    }
    if (query.nightsFrom) await this.setSamoSelect(page, "NIGHTS_FROM", String(query.nightsFrom));
    if (query.nightsTo) await this.setSamoSelect(page, "NIGHTS_TILL", String(query.nightsTo));
    if (query.adults) await this.setSamoSelect(page, "ADULT", String(query.adults));
    if (query.children !== undefined) await this.setSamoSelect(page, "CHILD", String(query.children));
    const ages = query.childAges ?? [];
    if (ages.length >= 1) await this.setSamoSelect(page, "AGE1", String(ages[0]));
    if (ages.length >= 2) await this.setSamoSelect(page, "AGE2", String(ages[1]));
    if (ages.length >= 3) await this.setSamoSelect(page, "AGE3", String(ages[2]));
    const kq = query as KompasSearchQuery;
    if (kq.stars) await this.setSamoSelect(page, "STARS", kq.stars);
    if (kq.towns) await this.setSamoSelect(page, "TOWNS", kq.towns);
    if (kq.freightType) await this.setSamoSelect(page, "FREIGHTTYPE", kq.freightType);
    if (kq.hotelTypes) await this.setSamoSelect(page, "HOTELTYPES", kq.hotelTypes);
    let hotelFilterApplied = false;
    if (query.hotelExternalId) {
      hotelFilterApplied = await page.evaluate((id: string) => {
        const sel = document.querySelector('input[name=HOTELS_SEL]') as HTMLInputElement | null;
        if (sel && !sel.checked) sel.click();
        const any = document.querySelector('input[name=HOTELS_ANY]') as HTMLInputElement | null;
        if (any && any.checked) any.click();
        const cb = document.querySelector(`#hotel${id}`) as HTMLInputElement | null;
        if (cb && !cb.checked) { cb.click(); return true; }
        return cb?.checked ?? false;
      }, query.hotelExternalId);
      await page.waitForTimeout(800);
    }
    if (query.departureDateFrom && query.departureDateTo) {
      const begDate = this.isoToSamodate(query.departureDateFrom);
      const endDate = this.isoToSamodate(query.departureDateTo);
      await page.evaluate(({ beg, end }: { beg: string; end: string }) => {
        for (const [name, val] of [["CHECKIN_BEG", beg], ["CHECKIN_END", end]]) {
          const input = document.querySelector(`input[name=${name}]`) as HTMLInputElement | null;
          if (input) { input.value = val; input.dispatchEvent(new Event("change", { bubbles: true })); }
        }
      }, { beg: begDate, end: endDate });
    }
    const routeDates = query.departureDateFrom && query.departureDateTo ? { beg: query.departureDateFrom.replace(/-/g, ""), end: query.departureDateTo.replace(/-/g, "") } : null;
    // Use page.route for this page instance (must unroute after)
    await page.route("**samo_action=PRICES**", (route) => {
      let url = route.request().url();
      if (!hotelFilterApplied) url = url.replace(/HOTELS=\d+&?/g, "").replace(/HOTELS_ANY=\d+&?/g, "");
      if (routeDates) url = url.replace(/CHECKIN_BEG=\d*/g, `CHECKIN_BEG=${routeDates.beg}`).replace(/CHECKIN_END=\d*/g, `CHECKIN_END=${routeDates.end}`);
      if (!url.includes("FREIGHT=")) url += "&FREIGHT=1"; else url = url.replace(/FREIGHT=\d+/g, "FREIGHT=1");
      if (!url.includes("FILTER=")) url += "&FILTER=1"; else url = url.replace(/FILTER=\d+/g, "FILTER=1");
      if (!url.includes("PARTITION_PRICE=")) url += "&PARTITION_PRICE=0"; else url = url.replace(/PARTITION_PRICE=\d+/g, "PARTITION_PRICE=0");
      route.continue({ url });
    });
    await page.evaluate(() => document.getElementById("samo_popup")?.remove());
    const btn = await page.$(".load");
    if (!btn) { await page.unroute("**samo_action=PRICES**"); return []; }
    await btn.click({ force: true });
    try { await page.waitForSelector("tr.price_info", { timeout: 20_000 }); } catch {
      // Check captcha before giving up
      if (await this.isCaptchaPresent(page)) {
        await page.unroute("**samo_action=PRICES**");
        throw new KompasCaptchaRequiredException("reuse-captcha", (await this.getCaptchaImageSrc(page)) ?? "");
      }
      await page.unroute("**samo_action=PRICES**");
      return [];
    }
    await page.waitForTimeout(800);
    if (await this.isCaptchaPresent(page)) {
      await page.unroute("**samo_action=PRICES**");
      const src = await this.getCaptchaImageSrc(page);
      throw new KompasCaptchaRequiredException("reuse-captcha", src ?? "");
    }
    await page.unroute("**samo_action=PRICES**");
    const offers = await this.extractPageOffers(page);
    return offers.map((r) => this.normalizeOffer(r, query));
  }

  // ── DOM Extraction ────────────────────────────────────────────────

  private async extractPageOffers(page: Page): Promise<any[]> {
    return page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll("tr.price_info"));
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
        const stateKey = classes.match(/stateKey-(\d+)/)?.[1] ?? "";
        const townFromKey = classes.match(/townFromKey-(\d+)/)?.[1] ?? "";
        const claim = row.getAttribute("data-cat-claim") ?? "";

        const hotel = row.querySelector(".link-hotel")?.textContent?.trim() ?? "";
        const priceEl = row.querySelector("[data-cat-price]");
        // §1A: use converted/visible price (data-converted-price-number) — matches what user sees on site.
        // data-cat-price is base package price WITHOUT transfer/flight cost.
        const price = priceEl?.getAttribute("data-converted-price-number")
          ?? priceEl?.getAttribute("data-cat-price")
          ?? "0";
        const currency = priceEl?.getAttribute("data-currency_title") ?? "USD";
        const departureDate = row.querySelector(".sortie")?.textContent?.trim() ?? "";
        const transport = row.querySelector(".transport")?.textContent?.trim() ?? "";

        const cells = row.querySelectorAll("td");
        let roomText = "";
        let mealText = "";
        if (cells.length >= 8) {
          mealText = cells[6]?.textContent?.trim() ?? "";
          roomText = cells[7]?.textContent?.trim() ?? "";
        }

        results.push({
          hotelKey, spoKey, tourKey, mealKey, roomKey,
          nights, checkIn, adults, children, stateKey, townFromKey,
          claim, hotel, price: parseFloat(price), currency,
          departureDate, transport,
          roomText, mealText,
        });
      }
      if (results.length > 0) {
        const sample = results.slice(0, 5).map((r: any) => ({
          hotelKey: r.hotelKey, tourKey: r.tourKey, roomKey: r.roomKey, mealKey: r.mealKey,
          roomText: r.roomText, mealText: r.mealText, price: r.price, spoKey: r.spoKey,
        }));
        console.log(`[KOMPAS extract] rows=${results.length} sample=${JSON.stringify(sample)}`);
      }
      return results;
    });
  }

  // ── Normalize Raw Offer ───────────────────────────────────────────

  private normalizeOffer(raw: any, query: SupplierSearchQuery): SupplierOffer {
    const now = new Date();
    const dateStr = raw.departureDate.replace(/\s+/g, " ").trim();
    const dateMatch = dateStr.match(/(\d{2})\.(\d{2})\.(\d{4})/);
    const departureDate = dateMatch
      ? `${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}`
      : this.parseCheckInDate(raw.checkIn);

    return {
      supplierCode: this.code,
      externalOfferId: raw.spoKey,
      externalClaim: raw.claim,
      hotel: raw.hotel || query.hotel || undefined,
      hotelExternalId: raw.hotelKey || query.hotelExternalId || undefined,
      tour: raw.tourKey || undefined,
      departureDate,
      nights: raw.nights,
      room: raw.roomText || raw.roomKey || query.room || undefined,
      meal: raw.mealText || raw.mealKey || query.meal || undefined,
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
        programGroupInc: (query as KompasSearchQuery).programGroupInc,
        stars: (query as KompasSearchQuery).stars,
        towns: (query as KompasSearchQuery).towns,
        freightType: (query as KompasSearchQuery).freightType,
        // §1A: geography from KOMPAS DOM stateKey, NOT from query/tour name
        stateKey: raw.stateKey,
        townFromKey: raw.townFromKey,
        country: KompasSupplierAdapter.STATE_INC_TO_COUNTRY[raw.stateKey] ?? "Unknown",
      },
    };
  }

  private parseCheckInDate(checkIn: string): string {
    if (/^\d{8}$/.test(checkIn)) {
      return `${checkIn.slice(0, 4)}-${checkIn.slice(4, 6)}-${checkIn.slice(6, 8)}`;
    }
    return checkIn;
  }

  // ── Re-check ──────────────────────────────────────────────────────

  private async promoteCaptcha(err: unknown, newOperation: "search" | "priceCalendar" | "refreshPrice" | "refreshAvailability" | "getOffer", originalQuery: SupplierSearchQuery | PriceCalendarQuery | SupplierOfferRef): Promise<never> {
    if (err instanceof KompasCaptchaRequiredException && this.captchaStore) {
      const prev = this.captchaStore.get(err.challengeId);
      if (prev) {
        await this.captchaStore.consume(err.challengeId);
        const ch = this.captchaStore.create({
          supplier: "KOMPAS",
          operation: newOperation as any,
          originalQuery,
          context: prev.context,
          page: prev.page,
          captchaImage: err.captchaImage,
          mimeType: err.mimeType,
        });
        throw new KompasCaptchaRequiredException(ch.challengeId, ch.captchaImage, ch.mimeType);
      }
    }
    throw err as Error;
  }

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

    let offers: SupplierOffer[];
    try {
      offers = await this.search(query);
    } catch (err) {
      await this.promoteCaptcha(err, "getOffer", ref);
      throw err;
    }
    const match = this.matchOffer(offers, ref);

    if (match) {
      return { ...match, packageComposition: undefined, oldPrice: undefined, priceType: undefined };
    }

    return {
      supplierCode: this.code,
      externalOfferId: ref.externalOfferId,
      externalClaim: ref.externalClaim,
      hotel: ctx.hotel ?? "",
      departureDate: (ctx.departureDateFrom as string) ?? "",
      nights: ctx.nightsFrom ?? 0,
      adults: ctx.adults,
      children: ctx.children ?? 0,
      childAges: ctx.childAges ?? [],
      price: {
        amount: 0,
        currency: "USD",
        fetchedAt: new Date(),
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
        queryHash: "",
        source: this.code,
      },
      availability: "NOT_AVAILABLE" as SupplierAvailability,
      fetchedAt: new Date(),
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
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
      hotelExternalId: ctx.hotelExternalId,
      room: ctx.room,
      meal: ctx.meal,
      nightsFrom: ctx.nightsFrom,
      nightsTo: ctx.nightsTo,
      departureDateFrom: ctx.departureDateFrom,
      departureDateTo: ctx.departureDateTo,
      tourIncValue: ctx.tourIncValue,
      tourIncName: ctx.tourIncName,
    };

    let offers: SupplierOffer[];
    try {
      offers = await this.search(query);
    } catch (err) {
      await this.promoteCaptcha(err, "refreshPrice", ref);
      throw err;
    }
    const match = this.matchOffer(offers, ref);

    if (match) return match.price;

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
      hotelExternalId: ctx.hotelExternalId,
      room: ctx.room,
      meal: ctx.meal,
      nightsFrom: ctx.nightsFrom,
      nightsTo: ctx.nightsTo,
      departureDateFrom: ctx.departureDateFrom,
      departureDateTo: ctx.departureDateTo,
      tourIncValue: ctx.tourIncValue,
      tourIncName: ctx.tourIncName,
    };

    let offers: SupplierOffer[];
    try {
      offers = await this.search(query);
    } catch (err) {
      await this.promoteCaptcha(err, "refreshAvailability", ref);
      throw err;
    }
    const match = this.matchOffer(offers, ref);

    return {
      availability: match ? "AVAILABLE" : "NOT_AVAILABLE",
      fetchedAt: new Date(),
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    };
  }

  // ── Offer Matching ────────────────────────────────────────────────

  private matchOffer(offers: SupplierOffer[], ref: SupplierOfferRef): SupplierOffer | undefined {
    const ctx = ref.searchContext;
    const targetDate = ctx.departureDateFrom as string | undefined;
    const targetTourInc = ctx.tourIncValue as string | undefined;
    const targetRoom = (ctx.room as string | undefined) ?? (ref as any).room as string | undefined;

    if (targetDate && targetTourInc) {
      const exact = offers.find(
        (o) =>
          o.externalOfferId === ref.externalOfferId &&
          o.departureDate === targetDate &&
          (o.rawMetadata?.tourIncValue as string | undefined) === targetTourInc &&
          (!targetRoom || o.room === targetRoom || o.rawMetadata?.roomText === targetRoom),
      );
      if (exact) return exact;
    }

    if (targetDate && targetTourInc) {
      const byTourInc = offers.find(
        (o) =>
          o.externalOfferId === ref.externalOfferId &&
          o.departureDate === targetDate &&
          (o.rawMetadata?.tourIncValue as string | undefined) === targetTourInc,
      );
      if (byTourInc) return byTourInc;
    }

    if (targetDate) {
      const byDate = offers.find(
        (o) => o.externalOfferId === ref.externalOfferId && o.departureDate === targetDate,
      );
      if (byDate) return byDate;
    }

    return offers.find((o) => o.externalOfferId === ref.externalOfferId);
  }

  // ── Price Calendar ────────────────────────────────────────────────

  async getPriceCalendar(query: PriceCalendarQuery): Promise<PriceCalendarResult> {
    const now = new Date();

    const windows = this.generateCalendarWindows(query.dateFrom, query.dateTo);

    const baseSearch: SupplierSearchQuery = {
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
      // §1A: derive destination from tourIncName prefix so search() sets STATEINC.
      // Explicit query.destination (from the search UI) takes precedence — without it
      // STATEINC is never set and KOMPAS returns 0 offers for the whole calendar.
      destination: query.destination
        ?? this.deriveCountryFromTourIncName(query.tourIncName)
        ?? this.deriveCountryFromTourIncName(query.tourIncNames?.[0])
        ?? undefined,
    };

    const programs = (query.tourIncValues?.length ?? 0) > 0
      ? query.tourIncValues!.map((v, i) => ({ value: v, name: query.tourIncNames?.[i] }))
      : query.tourIncValue
        ? [{ value: query.tourIncValue, name: query.tourIncName }]
        : [];

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
          } catch (err) {
            if (err instanceof KompasCaptchaRequiredException) {
              await this.promoteCaptcha(err, "priceCalendar", query);
              throw err;
            }
            this.logger.warn(
              `KOMPAS window ${window.from}→${window.to} program ${program.value} failed: ${(err as Error).message}`,
            );
          }
        }
      } else {
        try {
          const offers = await this.search({
            ...baseSearch,
            departureDateFrom: window.from,
            departureDateTo: window.to,
          });
          collected.push(...offers);
          totalScanned += offers.length;
        } catch (err) {
          if (err instanceof KompasCaptchaRequiredException) {
            await this.promoteCaptcha(err, "priceCalendar", query);
            throw err;
          }
          this.logger.warn(
            `KOMPAS window ${window.from}→${window.to} failed: ${(err as Error).message}`,
          );
        }
      }
    }

    let filtered = collected;
    if (query.hotel) {
      // Normalize whitespace: supplier hotel strings contain line breaks and
      // runs of spaces; the query hotel may come pre-normalized from the UI.
      const norm = (s: string) => s.toLowerCase().replace(/\s*\r?\n\s*/g, " ").replace(/\s{2,}/g, " ").trim();
      const h = norm(query.hotel);
      filtered = collected.filter(
        (o) => (o.hotel && norm(o.hotel).includes(h)) ||
          (query.hotelExternalId != null && o.hotelExternalId === query.hotelExternalId),
      );
    }

    console.log(`[KOMPAS dedup] filtered=${filtered.length} offers by hotel, before dedup`);
    for (const o of filtered.slice(0, 10)) {
      const rm = o.rawMetadata as any;
      console.log(`  offer: spoKey=${o.externalOfferId} date=${o.departureDate} roomKey=${rm?.roomKey} mealKey=${rm?.mealKey} room="${o.room}" meal="${o.meal}" price=${o.price.amount} tourKey=${rm?.tourKey}`);
    }

    const deduped = this.deduplicateCalendarOffers(filtered);
    console.log(`[KOMPAS dedup] after dedup: ${deduped.length} offers`);

    const dateMap = new Map<string, SupplierOffer[]>();
    for (const offer of deduped) {
      const existing = dateMap.get(offer.departureDate) || [];
      existing.push(offer);
      dateMap.set(offer.departureDate, existing);
    }

    const allDates: string[] = [];
    const current = new Date(query.dateFrom);
    const end = new Date(query.dateTo);
    while (current <= end) {
      allDates.push(this.formatDate(current));
      current.setDate(current.getDate() + 1);
    }

    const entries: PriceCalendarEntry[] = [];
    for (const date of allDates) {
      const dateOffers = dateMap.get(date);

      if (dateOffers && dateOffers.length > 0) {
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
            hotel: o.hotel,
            hotelExternalId: o.hotelExternalId,
            departureDate: o.departureDate,
            nights: o.nights,
            room: o.room,
            meal: o.meal,
            adults: o.adults,
            children: o.children,
            childAges: o.childAges,
            availability: o.availability,
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
              hotelExternalId: query.hotelExternalId,
              room: query.room,
              meal: query.meal,
              nightsFrom: query.nights,
              nightsTo: query.nights,
              tourIncValue: (best.rawMetadata?.tourIncValue as string) ?? query.tourIncValue,
              tourIncName: (best.rawMetadata?.tourIncName as string) ?? query.tourIncName,
              destination: query.destination,
              country: query.destination,
            },
          },
        });
      } else {
        entries.push({
          date,
          price: null,
          currency: null,
          availability: "NOT_AVAILABLE",
          offerCount: 0,
          absenceCode: "SUPPLIER_NO_RESULT",
          absenceText: "Цена не получена — KOMPAS не предоставил предложение на эту дату",
        });
      }
    }

    entries.sort((a, b) => a.date.localeCompare(b.date));

    return {
      supplierCode: this.code,
      contextHash: JSON.stringify({
        hotel: query.hotel,
        room: query.room,
        meal: query.meal,
        adults: query.adults,
        children: query.children,
        nights: query.nights,
      }),
      entries,
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
      fetchedAt: now,
      expiresAt: new Date(now.getTime() + 5 * 60 * 1000),
      totalOffersScanned: totalScanned,
    };
  }

  // ── Helpers ───────────────────────────────────────────────────────

  private generateCalendarWindows(from: string, to: string): Array<{ from: string; to: string }> {
    const windows: Array<{ from: string; to: string }> = [];
    const maxDays = KompasSupplierAdapter.CALENDAR_WINDOW_DAYS;
    let current = new Date(from);
    const end = new Date(to);
    while (current < end) {
      const windowEnd = new Date(current);
      windowEnd.setDate(windowEnd.getDate() + maxDays - 1);
      if (windowEnd > end) windowEnd.setTime(end.getTime());
      windows.push({ from: this.formatDate(current), to: this.formatDate(windowEnd) });
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

  private isoToSamodate(iso: string): string {
    const [y, m, d] = iso.split("-");
    return `${d}.${m}.${y}`;
  }

  private deduplicateCalendarOffers(offers: SupplierOffer[]): SupplierOffer[] {
    const seen = new Map<string, SupplierOffer>();
    for (const offer of offers) {
      const roomKey = (offer.rawMetadata as any)?.roomKey ?? "";
      const mealKey = (offer.rawMetadata as any)?.mealKey ?? "";
      const roomText = offer.room ?? "";
      const mealText = offer.meal ?? "";
      const key = `${offer.externalOfferId}|${offer.departureDate}|${roomKey}|${mealKey}|${roomText}|${mealText}`;
      if (!seen.has(key)) {
        seen.set(key, offer);
      } else {
        const existing = seen.get(key)!;
        if (offer.price.amount > existing.price.amount) {
          seen.set(key, offer);
        }
      }
    }
    return Array.from(seen.values());
  }

  // ── KOMPAS-specific Mappings ─────────────────────────────────────

  private static readonly STATE_INC_TO_COUNTRY: Record<string, string> = {
    "17": "Turkey", "37": "Egypt", "23": "UAE", "40": "Maldives",
    "28": "Thailand", "6": "India", "11": "Indonesia", "27": "Sri Lanka",
    "30": "Georgia", "31": "China", "33": "Singapore", "12": "Malaysia",
    "7": "Kazakhstan", "14": "Uzbekistan", "22": "USA", "59": "Switzerland",
    "94": "Japan", "86": "Mauritius", "109": "Zanzibar", "111": "Qatar",
    "139": "Kenya", "51": "Austria", "77": "Seychelles",
  };

  private static readonly TOWN_INC_MAP: Record<string, string> = {
    "baku": "1411", "баку": "1411",
    "vienna": "538", "вена": "538",
    "minsk": "873", "минск": "873",
    "moscow": "1", "москва": "1",
    "stpetersburg": "2", "петербург": "2", "санкт-петербург": "2",
  };

  private mapDepartureCity(city?: string): string | null {
    if (!city) return null;
    return KompasSupplierAdapter.TOWN_INC_MAP[city.trim().toLowerCase()] ?? null;
  }

  private mapStateInc(country?: string): string | null {
    if (!country) return null;
    const norm = country.trim().toLowerCase();
    const stateIncMap: Record<string, string> = {
      "turkey": "17", "türkiye": "17", "turkiye": "17", "turquía": "17", "tr": "17", "турция": "17",
      "egypt": "37", "egypte": "37", "misr": "37",
      "uae": "23", "оаэ": "23", "dubai": "23",
      "maldives": "40", "мальдивы": "40",
      "thailand": "28", "таиланд": "28",
      "india": "6", "индия": "6",
      "indonesia": "11", "индонезия": "11",
      "sri lanka": "27", "шри-ланка": "27", "srilanka": "27",
      "georgia": "30", "грузия": "30",
      "china": "31", "китай": "31",
      "singapore": "33", "сингапур": "33",
      "malaysia": "12", "малайзия": "12",
      "kazakhstan": "7", "казахстан": "7",
      "uzbekistan": "14", "узбекистан": "14",
      "usa": "22", "сша": "22", "united states": "22",
      "switzerland": "59", "швейцария": "59",
      "japan": "94", "япония": "94",
      "mauritius": "86", "маврикий": "86",
      "zanzibar": "109", "занзибар": "109", "tanzania": "109",
      "qatar": "111", "катар": "111",
      "kenya": "139", "кения": "139",
      "austria": "51", "австрия": "51",
      "seychelles": "77", "сейшелы": "77",
    };
    return stateIncMap[norm] ?? null;
  }

  /**
   * Derive STATEINC from tourIncName prefix (e.g. "TR: ..." → "17" for Turkey).
   * KOMPAS tourIncName format: "XX: ..." where XX is a country code.
   */
  private deriveStateIncFromTourIncName(tourIncName?: string): string | null {
    if (!tourIncName) return null;
    const prefix = tourIncName.split(":")[0]?.trim().toUpperCase();
    if (!prefix) return null;
    const prefixMap: Record<string, string> = {
      "TR": "17", "EG": "37", "AE": "23", "MDV": "40", "TH": "28",
      "IND": "6", "ID": "11", "SL": "27", "GE": "30", "CH": "31",
      "SIN": "33", "MY": "12", "KZ": "7", "UZB": "14", "US": "22",
      "CHE": "59", "JP": "94", "MRU": "86", "TZ": "109", "QA": "111",
      "KE": "139", "AUT": "51",
    };
    return prefixMap[prefix] ?? null;
  }

  /**
   * Derive country name from tourIncName prefix for use with mapStateInc.
   * E.g. "TR: Стамбул из Баку" → "Turkey"
   */
  private deriveCountryFromTourIncName(tourIncName?: string): string | null {
    const stateId = this.deriveStateIncFromTourIncName(tourIncName);
    if (!stateId) return null;
    return KompasSupplierAdapter.STATE_INC_TO_COUNTRY[stateId] ?? null;
  }

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
        this.logger.debug(`Set KOMPAS ${name} = ${value}`);
      } else {
        this.logger.warn(`KOMPAS select ${name} = ${value} not set (missing select/option)`);
      }
      return ok;
    } catch {
      return false;
    }
  }

  // ── Browser Lifecycle ─────────────────────────────────────────────

  private async getBrowser(): Promise<Browser> {
    if (this.browser && this.browser.isConnected()) {
      return this.browser;
    }
    const lockKey = "default";
    if (this.browserLock.has(lockKey)) {
      return this.browserLock.get(lockKey)!;
    }
    const launchPromise = chromium.launch({ headless: true });
    this.browserLock.set(lockKey, launchPromise);
    try {
      this.browser = await launchPromise;
      this.logger.log("KOMPAS Playwright browser launched");
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
}
