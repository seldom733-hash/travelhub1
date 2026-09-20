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
import { buildSummerSearchRequest } from "./summertour.request-builder";
import { parseSummerOffers } from "./summertour.response-parser";

/**
 * Summertour (Summer) Adapter — Summer-specific, NOT based on Kompas.
 *
 * Source: https://summertour.az/search_tour (SAMO, Turkey-only, Baku 1930).
 * - TOWNFROMINC 1930, STATEINC 9 (Turkey) — explicit per Test 1
 * - TOURINC, TOWNS, HOTELS, MEALS, FREIGHT, FILTER — proven mappings only
 * - STARS mapping NOT PROVEN — left as null
 * - Playwright required (SAMO AJAX), direct HTTP no longer returns prices
 * - Handles AVAILABLE / NO_RESULT / BLOCKED (CAPTCHA) distinctly
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
  private static readonly TOURINC_DELAY_MS = 2_000;
  private static readonly CALENDAR_WINDOW_DAYS = 31;

  // ── Program Discovery ─────────────────────────────────────────────

  async discoverPrograms(): Promise<Array<{ value: string; name: string }>> {
    let page: Page | null = null;
    try {
      const browser = await this.getBrowser();
      const context = await browser.newContext({
        userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        locale: "ru-RU",
      });
      page = await context.newPage();
      await page!.goto("https://summertour.az/search_tour", { waitUntil: "networkidle", timeout: 60_000 });
      await page!.waitForFunction(() => typeof (window as any).samo !== "undefined" && (window as any).samo.page_ready === true, { timeout: 15_000 });
      const programs = await page!.evaluate(() => {
        const sel = document.querySelector("select[name=TOURINC]") as HTMLSelectElement | null;
        if (!sel) return [];
        return Array.from(sel.options).filter(o => o.value !== "0" && o.value !== "").map(o => ({ value: o.value, name: o.text.trim() }));
      });
      await context.close();
      this.logger.log(`Summertour discovered ${programs.length} programs`);
      return programs;
    } catch (err) {
      this.logger.error(`Summertour discover failed: ${(err as Error).message}`);
      if (page) await page!.context().close().catch(() => {});
      return [];
    }
  }

  // ── Search ────────────────────────────────────────────────────────

  async search(query: SupplierSearchQuery): Promise<SupplierOffer[]> {
    const start = Date.now();
    let page: Page | null = null;
    let context: any = null;
    try {
      const browser = await this.getBrowser();
      context = await browser.newContext({
        userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        locale: "ru-RU",
      });
      page = await context.newPage();
      if (!page) throw new Error("Failed to create Summer page");
      const p = page!;

      // Navigate
      await p.goto("https://summertour.az/search_tour", { waitUntil: "networkidle", timeout: 60_000 });
      await p.waitForFunction(() => typeof (window as any).samo !== "undefined" && (window as any).samo.page_ready === true, { timeout: 15_000 });

      // Build Summer request via builder (proven mappings only)
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

      // Apply Summer SAMO form — Summer order: TOURINC first, then dates (TOURINC resets dates)
      await this.setSelect(p, "TOWNFROMINC", summerReq.TOWNFROMINC);
      await this.setSelect(p, "STATEINC", summerReq.STATEINC);
      if (summerReq.TOURINC && summerReq.TOURINC !== "0") {
        await p.evaluate((v: string) => {
          const s = document.querySelector("select[name=TOURINC]") as HTMLSelectElement | null;
          if (s) { s.value = v; s.dispatchEvent(new Event("change", { bubbles: true })); }
        }, summerReq.TOURINC);
        await p.waitForTimeout(SummertourNewAdapter.TOURINC_DELAY_MS);
      }
      if (summerReq.CHECKIN_BEG) await this.setInput(p, "CHECKIN_BEG", summerReq.CHECKIN_BEG);
      if (summerReq.CHECKIN_END) await this.setInput(p, "CHECKIN_END", summerReq.CHECKIN_END);
      if (summerReq.NIGHTS_FROM) await this.setSelect(p, "NIGHTS_FROM", summerReq.NIGHTS_FROM);
      if (summerReq.NIGHTS_TILL) await this.setSelect(p, "NIGHTS_TILL", summerReq.NIGHTS_TILL);
      if (summerReq.ADULT) await this.setSelect(p, "ADULT", summerReq.ADULT);
      if (summerReq.CHILD) await this.setSelect(p, "CHILD", summerReq.CHILD);
      if (summerReq.AGE1) await this.setSelect(p, "AGE1", summerReq.AGE1);
      if (summerReq.AGE2) await this.setSelect(p, "AGE2", summerReq.AGE2);
      if (summerReq.AGE3) await this.setSelect(p, "AGE3", summerReq.AGE3);
      if (summerReq.TOWNS) await this.setSelect(p, "TOWNS", summerReq.TOWNS);
      if (summerReq.MEALS) await this.setSelect(p, "MEALS", summerReq.MEALS);

      // Hotel filter via route (popup, no select)
      if (summerReq.HOTELS) {
        await p.route("**samo_action=PRICES**", route => {
          const url = route.request().url();
          const nu = url.replace(/HOTELS_ANY=\d*/g, `HOTELS_ANY=${summerReq.HOTELS_ANY}`)
            .replace(/HOTELS=[^&]*/g, `HOTELS=${summerReq.HOTELS}`)
            .replace(/PARTITION_PRICE=[^&]*/g, "PARTITION_PRICE=0")
            .replace(/FREIGHT=\d*/g, `FREIGHT=${summerReq.FREIGHT}`)
            .replace(/FILTER=\d*/g, `FILTER=${summerReq.FILTER}`);
          route.continue({ url: nu });
        });
      } else {
        // Still ensure FREIGHT/FILTER
        await p.route("**samo_action=PRICES**", route => {
          const url = route.request().url();
          const nu = url.replace(/FREIGHT=\d*/g, `FREIGHT=${summerReq.FREIGHT}`).replace(/FILTER=\d*/g, `FILTER=${summerReq.FILTER}`);
          route.continue({ url: nu });
        });
      }

      // Check for BLOCKED (CAPTCHA) before search
      const blockedBefore = await this.isBlocked(p);
      if (blockedBefore) {
        this.logger.warn("Summertour BLOCKED before search (CAPTCHA)");
        await context.close();
        return [];
      }

      const btn = await p.$(".load");
      if (!btn) {
        this.logger.warn("Summertour .load not found");
        await context.close();
        return [];
      }
      await btn.click();

      // Wait for prices or BLOCKED
      try {
        await p.waitForFunction(
          () => document.querySelectorAll("tr.price_info").length > 0 || !!document.querySelector("#captchaForm") || document.body.innerText.includes("CAPTCHA") || document.body.innerText.includes("заблокирован"),
          { timeout: 30_000 },
        );
      } catch {
        this.logger.warn("Summertour: no price_info nor BLOCKED marker");
        await context.close();
        return [];
      }

      if (await this.isBlocked(p)) {
        this.logger.warn("Summertour BLOCKED after search");
        await context.close();
        return [];
      }

      await p.waitForTimeout(1500);
      const all: any[] = [];
      let cur = await parseSummerOffers(p);
      all.push(...cur);
      for (let pg = 2; pg <= SummertourNewAdapter.MAX_PAGES; pg++) {
        const hasNext = await p.evaluate((n: number) => {
          const el = Array.from(document.querySelectorAll(".pager span.page")).find(s => s.getAttribute("data-page") === String(n));
          if (el) { (el as HTMLElement).click(); return true; }
          return false;
        }, pg);
        if (!hasNext) break;
        await p.waitForTimeout(SummertourNewAdapter.PAGE_DELAY_MS);
        try { await p.waitForSelector("tr.price_info", { timeout: 10000 }); } catch { break; }
        await p.waitForTimeout(800);
        cur = await parseSummerOffers(p);
        if (cur.length === 0) break;
        all.push(...cur);
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

  private async isBlocked(page: Page): Promise<boolean> {
    return page!.evaluate(() => {
      if (document.querySelector("#captchaForm") || document.querySelector("#icaptcha")) return true;
      const txt = document.body.innerText.toLowerCase();
      return txt.includes("captcha") || txt.includes("заблокирован") || txt.includes("blocked") || txt.includes("cloudflare");
    }).catch(() => false);
  }

  private async setInput(page: Page, name: string, value: string) {
    const ok = await page!.evaluate(({ n, v }: { n: string; v: string }) => {
      const el = document.querySelector(`input[name=${n}]`) as HTMLInputElement | null;
      if (!el) return false;
      el.value = v;
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    }, { n: name, v: value });
    if (ok) await page!.waitForTimeout(200);
  }

  private async setSelect(page: Page, name: string, value: string) {
    const ok = await page!.evaluate(({ n, v }: { n: string; v: string }) => {
      const s = document.querySelector(`select[name=${n}]`) as HTMLSelectElement | null;
      if (!s) return false;
      const o = Array.from(s.options).find(x => x.value === v);
      if (!o) return false;
      s.value = v;
      s.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    }, { n: name, v: value });
    if (ok) await page!.waitForTimeout(300);
    return ok;
  }

  private normalizeOffer(raw: any, query: SupplierSearchQuery): SupplierOffer {
    const now = new Date();
    const ds = raw.departureDate.replace(/\s+/g, " ").trim();
    const m = ds.match(/(\d{2})\.(\d{2})\.(\d{4})/);
    const departureDate = m ? `${m[3]}-${m[2]}-${m[1]}` : raw.checkIn;
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
    const windows = this.generateCalendarWindows(query.dateFrom, query.dateTo);
    const base: SupplierSearchQuery = {
      adults: query.adults, children: query.children, childAges: query.childAges,
      hotel: query.hotel, hotelExternalId: query.hotelExternalId, room: query.room, meal: query.meal,
      nightsFrom: query.nights, nightsTo: query.nights, departureDateFrom: query.dateFrom, departureDateTo: query.dateTo,
    };
    const programs = (query.tourIncValues?.length ?? 0) > 0 ? query.tourIncValues!.map((v, i) => ({ value: v, name: query.tourIncNames?.[i] })) : query.tourIncValue ? [{ value: query.tourIncValue, name: query.tourIncName }] : [];
    const collected: SupplierOffer[] = [];
    let total = 0;
    for (const w of windows) {
      if (programs.length > 0) {
        for (const pr of programs) {
          try {
            const off = await this.search({ ...base, departureDateFrom: w.from, departureDateTo: w.to, tourIncValue: pr.value, tourIncName: pr.name });
            collected.push(...off); total += off.length;
          } catch (e) { this.logger.warn(`window ${w.from}→${w.to} ${pr.value} ${(e as Error).message}`); }
        }
      } else {
        try {
          const off = await this.search({ ...base, departureDateFrom: w.from, departureDateTo: w.to });
          collected.push(...off); total += off.length;
        } catch (e) { this.logger.warn(`window ${w.from}→${w.to} ${(e as Error).message}`); }
      }
    }
    const filtered = query.hotel ? collected.filter(o => o.hotel === query.hotel || o.hotelExternalId === query.hotelExternalId) : collected;
    const deduped = this.dedup(filtered);
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

  private dedup(offers: SupplierOffer[]): SupplierOffer[] {
    const m = new Map<string, SupplierOffer>();
    for (const o of offers) {
      const k = `${o.externalOfferId}|${o.departureDate}|${o.room ?? ""}`;
      if (!m.has(k)) m.set(k, o);
      else if (o.price.amount > m.get(k)!.price.amount) m.set(k, o);
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
  async onModuleDestroy() { if (this.browser) { await this.browser.close().catch(() => {}); this.browser = null; } }
}
