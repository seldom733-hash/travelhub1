/**
 * FSTravel (SAMO) Adapter — plain HTTP against b2b.fstravel.asia/search_tour.
 *
 * Verified live (2026-10-18): the PRICES endpoint answers plain GETs — no
 * browser session required. The response is a JS-wrapped HTML table whose
 * `<tr class="... price_info ... hotelKey-N checkIn-YYYYMMDD nights-N ...">`
 * rows carry the identity in the class list and the price in
 * `data-converted-price-number` / `data-currency_title` span attrs.
 * CURRENCY=25 returns native AZN (the site's own EUR→AZN rate), so no FX
 * conversion is involved downstream.
 *
 * Two verified quirks drive the query loop:
 *  - a query only ever spans [CHECKIN_BEG, CHECKIN_BEG + 7] regardless of
 *    CHECKIN_END → the range is split into 8-day windows;
 *  - a nights RANGE returns only the window's first date (≈2.4k-row result
 *    cap fills within one date), while a FIXED night count spans all 8
 *    dates → every window is iterated per night (NIGHTS_FROM=NIGHTS_TILL).
 *
 * Captcha (SAMO antibot — base64 JPEG in `<img id="icaptcha">`) trips on
 * request bursts. It is auto-solved by OCR (scripts/fstravel-captcha-ocr2.py,
 * rapidocr) + POST `antibot=<digits>&samo_action=antibot&captcha_id=…` to the
 * same URL — wrong answers do not invalidate the challenge (same protocol as
 * KazUnion); the retried GET round-trip verifies the unlock.
 */
import { Injectable, Logger } from "@nestjs/common";
import { execFile } from "child_process";
import * as fs from "fs";
import * as path from "path";
import type {
  SupplierAdapter,
  SupplierSearchQuery,
  SupplierOffer,
  SupplierOfferDetail,
  SupplierOfferRef,
  SupplierPriceSnapshot,
  SupplierAvailability,
  SupplierAvailabilitySnapshot,
  PriceCalendarQuery,
  PriceCalendarResult,
  SupplierGeoOption,
} from "../supplier.types";
import { priceUnavailable } from "../supplier.types";

const FSTRAVEL_BASE = "https://b2b.fstravel.asia";
const TOWNFROM_BAKU = "433614"; // Baku TOWNFROMINC for FSTravel
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const FSTRAVEL_STATES: Record<string, string> = {
  "Вьетнам": "293645", "Германия": "351392", "Грузия": "223991",
  "Египет": "18498", "Индия": "18028", "Индонезия": "250722",
  "Испания": "18747", "Италия": "18770", "Китай": "230826",
  "Маврикий": "293483", "Малайзия": "435746", "Мальдивы": "275410",
  "Марокко": "745206", "ОАЭ": "20613", "Польша": "287299",
  "Саудовская Аравия": "841186", "Сейшелы": "284350", "Сербия": "209834",
  "Сингапур": "251543", "Таиланд": "20625", "Танзания": "439254",
  "Турция": "18803", "Франция": "18808", "Шри-Ланка": "20629",
  "Южная Корея": "277390", "Япония": "337852",
};

/**
 * ISO-2 → STATEINC (same 26 countries). The universal live search passes
 * `country` as an ISO-2 code ("TR"), while the sync service passes the RU
 * name ("Турция") — both must resolve (verified: the SAMO STATEINC dictionary
 * is identical for both entry points).
 */
const FSTRAVEL_STATE_ISO: Record<string, string> = {
  AE: "20613", CN: "230826", DE: "351392", EG: "18498", ES: "18747", FR: "18808",
  GE: "223991", ID: "250722", IN: "18028", IT: "18770", JP: "337852", KR: "277390",
  LK: "20629", MA: "745206", MU: "293483", MY: "435746", MV: "275410", PL: "287299",
  RS: "209834", SA: "841186", SC: "284350", SG: "251543", TH: "20625", TZ: "439254",
  TR: "18803", VN: "293645",
};

/** One parsed `<tr class="price_info …">` row. */
interface FstravelPriceRow {
  hotelKey: string;
  checkIn: string; // YYYYMMDD
  nights: number;
  amount: number;
  currency: string;
  hotel: string;
  meal: string;
  room: string;
  tour: string;
  spoKey: string;
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

@Injectable()
export class FstravelAdapter implements SupplierAdapter {
  readonly code = "FSTRAVEL";
  readonly name = "FSTravel (b2b.fstravel.asia)";
  readonly enabled = true;

  private readonly logger = new Logger(FstravelAdapter.name);

  /** Global pacing — SAMO antibot trips on request bursts (~3s proven). */
  private static readonly MIN_REQUEST_INTERVAL_MS = 3_000;
  /** Backoff when a captcha round did not unlock the session. */
  private static readonly CAPTCHA_RETRY_DELAYS_MS = [15_000, 30_000, 60_000];
  /** Safety cap for PRICEPAGE pagination (short page / added=0 stops first). */
  private static readonly MAX_PAGES_PER_QUERY = 25;
  /** Verified: one query spans exactly [CHECKIN_BEG, CHECKIN_BEG + 7]. */
  private static readonly WINDOW_DAYS = 8;

  private requestQueue: Promise<unknown> = Promise.resolve();
  private lastRequestAt = 0;
  private readonly sessionFile = path.resolve(process.cwd(), ".fstravel-session.json");
  private jar: Record<string, string> = this.loadJar();

  // ── Public API ────────────────────────────────────────────────────────

  async search(query: SupplierSearchQuery): Promise<SupplierOffer[]> {
    const requested = query.country ?? query.destination ?? "Турция";
    const stateInc = this.resolveStateInc(requested);
    if (!stateInc) {
      this.logger.warn(`FSTRAVEL: unknown country "${requested}" — skipped`);
      return [];
    }
    // Offers carry the canonical RU name (the live search sends ISO-2 "TR").
    const country = this.stateName(stateInc) ?? requested;

    const dateFrom = query.departureDateFrom ?? this.formatDate(new Date());
    const dateTo =
      query.departureDateTo && query.departureDateTo >= dateFrom
        ? query.departureDateTo
        : dateFrom;
    const nightsFrom = query.nightsFrom ?? 3;
    const nightsTo = query.nightsTo ?? nightsFrom;
    const adults = query.adults ?? 2;
    const children = query.children ?? 0;
    const windows = this.dateWindows(dateFrom, dateTo);

    const rowsByKey = new Map<string, FstravelPriceRow>();
    let queries = 0;
    let aborted: "captcha" | "ip-block" | null = null;

    outer: for (const window of windows) {
      for (let n = nightsFrom; n <= nightsTo; n++) {
        try {
          const rows = await this.fetchNightRows(
            stateInc, window.from, window.to, n, adults, children,
          );
          queries++;
          for (const row of rows) {
            const key = this.rowKey(row);
            if (!rowsByKey.has(key)) rowsByKey.set(key, row);
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          if (msg.startsWith("FSTRAVEL_CAPTCHA_BLOCKED")) {
            this.logger.warn(
              `FSTRAVEL ${country}: captcha blocked after ${FstravelAdapter.CAPTCHA_RETRY_DELAYS_MS.length} rounds — aborting country (kept ${rowsByKey.size} rows)`,
            );
            aborted = "captcha";
            // A blocked abort usually means a burned/restricted session —
            // drop the cookie jar so the next query starts with a fresh SAMO
            // session (verified 2026-10-18: a fresh session passes cleanly
            // once the burst window ends, same IP).
            this.jar = {};
            this.saveJar();
            break outer;
          }
          if (msg.startsWith("FSTRAVEL_IP_BLOCKED")) {
            // WAF IP-block (nginx Forbidden, no self-serve unlock): parsing it
            // as an empty page would silently mark the whole country empty
            // (Thailand 2026-10-18). Abort fast — the sync loop's
            // inter-country pause is the actual cooldown for the IP window.
            this.logger.warn(
              `FSTRAVEL ${country}: ${msg} — aborting country (kept ${rowsByKey.size} rows)`,
            );
            aborted = "ip-block";
            break outer;
          }
          this.logger.warn(
            `FSTRAVEL ${country} window ${window.from}..${window.to} nights=${n} failed: ${msg}`,
          );
        }
      }
      this.logger.log(
        `FSTRAVEL ${country}: window ${window.from}..${window.to} done — ${rowsByKey.size} rows total`,
      );
    }

    const offers: SupplierOffer[] = [];
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 5 * 60_000);
    for (const row of rowsByKey.values()) {
      if (!(row.amount > 0)) continue;
      offers.push({
        supplierCode: this.code,
        service: "tours",
        externalOfferId: this.rowKey(row),
        externalClaim: row.spoKey || undefined,
        tour: row.tour || undefined,
        hotel: row.hotel,
        hotelExternalId: row.hotelKey,
        country,
        departureDate: this.isoDate(row.checkIn),
        nights: row.nights,
        room: row.room || undefined,
        meal: row.meal || undefined,
        adults,
        children,
        childAges: query.childAges ?? [],
        price: {
          amount: row.amount,
          currency: row.currency,
          fetchedAt: now,
          expiresAt,
          queryHash: "",
          source: this.code,
        },
        availability: "AVAILABLE",
        fetchedAt: now,
        expiresAt,
      });
    }

    this.logger.log(
      `FSTRAVEL ${country}: ${queries} queries → ${rowsByKey.size} rows → ${offers.length} offers${aborted ? ` (aborted: ${aborted})` : ""}`,
    );
    return offers;
  }

  async getOffer(ref: SupplierOfferRef): Promise<SupplierOfferDetail> {
    const offers = await this.search({
      ...ref.searchContext,
      adults: ref.searchContext.adults ?? 2,
    });
    const m = offers.find((o) => o.externalOfferId === ref.externalOfferId);
    if (!m) {
      // §5.5: no synthetic zero snapshot — established PRICE_UNAVAILABLE model.
      priceUnavailable(
        `FSTRAVEL offer ${ref.externalOfferId} not found for the original search context`,
      );
    }
    return { ...m };
  }

  async refreshPrice(ref: SupplierOfferRef): Promise<SupplierPriceSnapshot> {
    const offers = await this.search({
      ...ref.searchContext,
      adults: ref.searchContext.adults ?? 2,
    });
    const m = offers.find((o) => o.externalOfferId === ref.externalOfferId);
    if (!m) {
      priceUnavailable(
        `FSTRAVEL offer ${ref.externalOfferId} no longer in search results`,
      );
    }
    return m.price;
  }

  async refreshAvailability(ref: SupplierOfferRef): Promise<SupplierAvailabilitySnapshot> {
    const offers = await this.search({
      ...ref.searchContext,
      adults: ref.searchContext.adults ?? 2,
    });
    const m = offers.find((o) => o.externalOfferId === ref.externalOfferId);
    const now = new Date();
    return {
      availability: m ? "AVAILABLE" : "NOT_AVAILABLE",
      fetchedAt: now,
      expiresAt: new Date(now.getTime() + 5 * 60_000),
    };
  }

  async getPriceCalendar(_query: PriceCalendarQuery): Promise<PriceCalendarResult> {
    // FSTravel is sync-only (not part of the live adapter registry);
    // per-date calendar browsing goes through the ANEX/Kompas adapters.
    return { entries: [] } as unknown as PriceCalendarResult;
  }

  async discoverGeoOptions(_countryExternalId?: string): Promise<SupplierGeoOption[]> {
    return [];
  }

  // ── Query loop ────────────────────────────────────────────────────────

  /**
   * Country (RU name, ISO-2, en name) → STATEINC. The sync service passes RU
   * names, the universal live search passes ISO-2 — both must resolve.
   */
  private resolveStateInc(candidate: string): string | undefined {
    const raw = candidate.trim();
    if (!raw) return undefined;
    const direct = FSTRAVEL_STATES[raw] ?? FSTRAVEL_STATES[this.normKey(raw)];
    if (direct) return direct;
    if (/^[A-Za-z]{2}$/.test(raw)) {
      return FSTRAVEL_STATE_ISO[raw.toUpperCase()];
    }
    const wanted = this.normKey(raw);
    if (wanted.length < 3) return undefined;
    for (const [name, inc] of Object.entries(FSTRAVEL_STATES)) {
      const n = this.normKey(name);
      if (n === wanted || n.includes(wanted) || wanted.includes(n)) return inc;
    }
    return undefined;
  }

  /** Canonical RU country name for a STATEINC (offers/pickers display it). */
  private stateName(stateInc: string): string | undefined {
    return Object.entries(FSTRAVEL_STATES).find(([, inc]) => inc === stateInc)?.[0];
  }

  /** Lowercase, ё→е, alphanumerics only — matches the aggregator's normHotel. */
  private normKey(s: string): string {
    return s.trim().toLowerCase().replace(/ё/g, "е").replace(/[^a-zа-я0-9]/gi, "");
  }

  /** Split [from, to] into 8-day windows (the endpoint's real span). */
  private dateWindows(
    from: string,
    to: string,
  ): Array<{ from: string; to: string }> {
    const windows: Array<{ from: string; to: string }> = [];
    const cur = new Date(`${from}T00:00:00`);
    const end = new Date(`${to}T00:00:00`);
    while (cur <= end) {
      const winEnd = new Date(cur);
      winEnd.setDate(winEnd.getDate() + FstravelAdapter.WINDOW_DAYS - 1);
      if (winEnd > end) winEnd.setTime(end.getTime());
      windows.push({
        from: this.formatDate(cur),
        to: this.formatDate(winEnd),
      });
      cur.setDate(cur.getDate() + FstravelAdapter.WINDOW_DAYS);
    }
    return windows;
  }

  /** All rows for one (state, window, fixed night count), paginated. */
  private async fetchNightRows(
    stateInc: string,
    beg: string,
    end: string,
    nights: number,
    adults: number,
    children: number,
  ): Promise<FstravelPriceRow[]> {
    const rows: FstravelPriceRow[] = [];
    const seen = new Set<string>();
    for (let page = 1; page <= FstravelAdapter.MAX_PAGES_PER_QUERY; page++) {
      const url = this.buildPricesUrl({ stateInc, beg, end, nights, adults, children, page });
      const body = await this.pacedGet(url);
      if (body.includes("Нет данных") || body.includes("\\u041d\\u0435\\u0442")) break;
      const pageRows = this.parsePriceRows(this.unwrapJsHtml(body));
      let added = 0;
      for (const row of pageRows) {
        const key = this.rowKey(row);
        if (seen.has(key)) continue;
        seen.add(key);
        rows.push(row);
        added++;
      }
      if (pageRows.length === 0 || added === 0) break;
    }
    return rows;
  }

  private buildPricesUrl(params: {
    stateInc: string;
    beg: string;
    end: string;
    nights: number;
    adults: number;
    children: number;
    page: number;
  }): string {
    const q = new URLSearchParams({
      samo_action: "PRICES",
      PRICEPAGE: String(params.page),
      TOWNFROMINC: TOWNFROM_BAKU,
      STATEINC: params.stateInc,
      ADULT: String(params.adults),
      CHILD: String(params.children),
      MEALS_ANY: "1",
      ROOMS_ANY: "1",
      HOTELS_ANY: "1",
      FREIGHT: "1",
      FILTER: "1",
      PARTITION_PRICE: "0",
      CURRENCY: "25", // native AZN
      CHECKIN_BEG: params.beg,
      CHECKIN_END: params.end,
      NIGHTS_FROM: String(params.nights),
      NIGHTS_TILL: String(params.nights),
    });
    return `${FSTRAVEL_BASE}/search_tour?${q.toString()}`;
  }

  // ── Row parsing ───────────────────────────────────────────────────────

  /** Unescape the JS-wrapped payload (`\n`, `\"`, `\/`, `\uXXXX`). */
  private unwrapJsHtml(body: string): string {
    return body
      .replace(/\\n/g, "\n")
      .replace(/\\r/g, "\r")
      .replace(/\\t/g, "\t")
      .replace(/\\"/g, '"')
      .replace(/\\'/g, "'")
      .replace(/\\\//g, "/")
      .replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) =>
        String.fromCharCode(parseInt(hex, 16)),
      );
  }

  private parsePriceRows(html: string): FstravelPriceRow[] {
    const rows: FstravelPriceRow[] = [];
    const re = /<tr class="(?:even|odd) price_info[^"]*"[^>]*>([\s\S]*?)<\/tr>/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(html)) !== null) {
      const head = m[0].slice(0, 600);
      const body = m[1];
      const hotelKey = (head.match(/hotelKey-(-?\d+)/) || [])[1];
      const checkIn = (head.match(/checkIn-(\d{8})/) || [])[1];
      const nights = Number((head.match(/nights-(\d+)/) || [])[1] ?? 0);
      if (!hotelKey || !checkIn) continue;
      const amount = Number(
        (body.match(/data-converted-price-number="([^"]*)"/) || [])[1] ?? 0,
      );
      const currency =
        (body.match(/data-currency_title="([^"]*)"/) || [])[1] ?? "AZN";
      const hotel = (
        (body.match(/class="link-hotel"[\s\S]*?<a [^>]*>([^<]+)<\/a>/) || [])[1] ?? ""
      ).trim();
      const meal = this.cellText(body, "hotel-meals");
      const room = this.cellText(body, "hotel-room");
      const tour = (
        (body.match(/<td class="tour">([\s\S]*?)<span/) || [])[1] ?? ""
      ).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      const spoKey = (head.match(/spoKey-(-?\d+)/) || [])[1] ?? "";
      if (!(amount > 0)) continue;
      rows.push({ hotelKey, checkIn, nights, amount, currency, hotel, meal, room, tour, spoKey });
    }
    return rows;
  }

  /** First `<span>` text inside the given td class (script tags stripped). */
  private cellText(body: string, tdClass: string): string {
    const m = body.match(
      new RegExp(`class="${tdClass}"[\\s\\S]*?<span[^>]*>([\\s\\S]*?)<\\/span>`),
    );
    if (!m) return "";
    return m[1]
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  private rowKey(row: FstravelPriceRow): string {
    return `FSTRAVEL|${row.hotelKey}|${row.checkIn}|${row.nights}|${row.meal}|${row.room}|${row.amount}`;
  }

  // ── HTTP + captcha ────────────────────────────────────────────────────

  /** Paced, serialized GET (global queue keeps the ~3s interval). */
  private pacedGet(url: string): Promise<string> {
    const task = this.requestQueue.then(() => this.fetchPaced(url));
    this.requestQueue = task.catch(() => undefined);
    return task;
  }

  private async fetchPaced(url: string): Promise<string> {
    for (let attempt = 0; ; attempt++) {
      const wait = FstravelAdapter.MIN_REQUEST_INTERVAL_MS - (Date.now() - this.lastRequestAt);
      if (wait > 0) await sleep(wait);
      this.lastRequestAt = Date.now();
      let body: string;
      try {
        body = await this.httpGet(url);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        // One 30s retry absorbs a transient WAF blip; a persistent block
        // throws through — the country aborts fast and the sync loop's
        // inter-country pause cools the IP block window down.
        if (!msg.startsWith("FSTRAVEL_IP_BLOCKED") || attempt > 0) throw err;
        this.logger.warn(`WAF 403 block — one retry after 30s`);
        await sleep(30_000);
        body = await this.httpGet(url);
      }
      if (!this.isCaptchaResponse(body)) return body;
      if (await this.tryAutoSolveCaptcha(url, body)) continue;
      const delay = FstravelAdapter.CAPTCHA_RETRY_DELAYS_MS[attempt];
      if (delay === undefined) {
        throw new Error(
          `FSTRAVEL_CAPTCHA_BLOCKED: captcha did not unlock after ${FstravelAdapter.CAPTCHA_RETRY_DELAYS_MS.length} rounds`,
        );
      }
      this.logger.warn(`captcha challenge — backoff ${delay}ms (round ${attempt + 1})`);
      await sleep(delay);
    }
  }

  private async httpGet(url: string): Promise<string> {
    const headers: Record<string, string> = { "User-Agent": USER_AGENT, Accept: "*/*" };
    const cookie = this.cookieHeader();
    if (cookie) headers.Cookie = cookie;
    const resp = await fetch(url, { headers });
    this.absorbCookies(resp.headers.getSetCookie?.() ?? []);
    if (resp.status === 403 || resp.status === 429) {
      const body = await resp.text();
      // A 403 that still carries the captcha form is the normal antibot flow
      // — let the caller solve it. The plain nginx "Forbidden" page is a WAF
      // IP-block with no self-serve unlock (verified 2026-10-18): parsing it
      // as an empty page would silently mark the whole country empty
      // (Thailand lost its sync that way) — throw instead.
      if (!this.isCaptchaResponse(body)) {
        const reqId = body.match(/ID:\s*([A-Za-z0-9]+)/)?.[1] ?? "n/a";
        try {
          fs.writeFileSync(path.resolve(process.cwd(), ".fstravel-forbidden.html"), body);
        } catch {
          // evidence file is best-effort
        }
        throw new Error(
          `FSTRAVEL_IP_BLOCKED: HTTP ${resp.status} WAF Forbidden (request id ${reqId})`,
        );
      }
      return body;
    }
    return resp.text();
  }

  private isCaptchaResponse(text: string): boolean {
    return /captchaForm|fcaptcha|samo_action\s*=\s*["']?antibot|icaptcha/i.test(text);
  }

  /**
   * Auto-solve the SAMO antibot challenge. The FSTravel captcha is the SAME
   * engine as Summertour/KOMPAS (captchaForm/fcaptcha/samo_action=antibot):
   * a wrong answer does not invalidate the code but ROTATES it — so post
   * ONE candidate per image and re-GET a FRESH image next round. Rounds
   * default to 4 (env FSTRAVEL_CAPTCHA_SOLVE_ROUNDS), matching
   * KOMPAS/Summertour; the caller's backoff repeats this block 3 more times.
   */
  private async tryAutoSolveCaptcha(pageUrl: string, pageBody: string): Promise<boolean> {
    let body = pageBody;
    for (let round = 1; round <= FstravelAdapter.captchaSolveRounds(); round++) {
      if (!this.isCaptchaResponse(body)) return true; // already unlocked
      const img = body.match(
        /<img id="icaptcha"[^>]*src="data:image\/jpeg;base64,([^"]+)"/,
      );
      if (!img) return false;
      const captchaId = body.match(/name="captcha_id" value="([^"]*)"/)?.[1] ?? "";
      const imgPath = path.resolve(process.cwd(), ".fstravel-captcha.jpg");
      fs.writeFileSync(imgPath, Buffer.from(img[1], "base64"));
      const candidates = await this.ocrCandidates(imgPath);
      // SAMO rotates the code on a wrong answer → exactly ONE post per image.
      const answer = candidates[0] ?? "0000";
      if (candidates.length === 0) {
        // OCR miss — the antibot still counts the attempt (wrong answers
        // unlock, verified 2026-10-18), so post a blind guess rather than
        // burn the round with no submission at all.
        this.logger.warn(`captcha OCR round ${round}: no digits — blind guess (image kept at ${imgPath})`);
      } else {
        this.logger.log(`captcha OCR round ${round}: guess ${answer} (${candidates.join(", ")})`);
      }
      await this.postCaptchaAnswer(pageUrl, captchaId, answer);
      // Verify with a GET — only it tells the truth (and re-paces the queue).
      const wait = FstravelAdapter.MIN_REQUEST_INTERVAL_MS - (Date.now() - this.lastRequestAt);
      if (wait > 0) await sleep(wait);
      this.lastRequestAt = Date.now();
      body = await this.httpGet(pageUrl);
    }
    return !this.isCaptchaResponse(body);
  }

  private async postCaptchaAnswer(pageUrl: string, captchaId: string, digits: string): Promise<void> {
    const headers: Record<string, string> = {
      "User-Agent": USER_AGENT,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "*/*",
    };
    const cookie = this.cookieHeader();
    if (cookie) headers.Cookie = cookie;
    try {
      const resp = await fetch(pageUrl, {
        method: "POST",
        headers,
        body: new URLSearchParams({
          antibot: digits,
          samo_action: "antibot",
          captcha_id: captchaId,
        }).toString(),
        redirect: "manual",
      });
      this.absorbCookies(resp.headers.getSetCookie?.() ?? []);
    } catch {
      // network hiccup — the verify GET decides anyway
    }
  }

  private static captchaSolveRounds(): number {
    const n = Number(process.env.FSTRAVEL_CAPTCHA_SOLVE_ROUNDS ?? "");
    return n > 0 ? n : 4;
  }

  /**
   * OCR candidates via ALL four supplier scripts (union). The FSTravel image
   * is the SAMO engine: ddddocr reads it where RapidOCR often returns nothing
   * (the Summertour/KOMPAS scripts are ddddocr-based and share the engine) —
   * verified 2026-10-18: all four scripts read the sample as "326".
   */
  private ocrCandidates(imagePath: string): Promise<string[]> {
    const run = (script: string): Promise<string[]> =>
      new Promise((resolve) => {
        execFile(
          "python",
          [path.resolve(process.cwd(), "scripts", script), imagePath],
          { timeout: 90_000, windowsHide: true },
          (err, stdout) => {
            if (err) return resolve([]);
            const digits = String(stdout)
              .split(/\r?\n/)
              .map((s) => s.trim())
              .filter((s) => /^\d{3,8}$/.test(s));
            resolve([...new Set(digits)]);
          },
        );
      });
    return Promise.all([
      run("fstravel-captcha-ocr2.py"),
      run("summertour-captcha-ocr.py"),
      run("kompas-captcha-ocr.py"),
      run("kazunion-captcha-ocr.py"),
    ]).then((sets) => {
      const union: string[] = [];
      for (const set of sets) for (const c of set) if (!union.includes(c)) union.push(c);
      return union;
    });
  }

  // ── Cookie jar ────────────────────────────────────────────────────────

  private cookieHeader(): string {
    const pairs = Object.entries(this.jar).map(([k, v]) => `${k}=${v}`);
    return pairs.join("; ");
  }

  private absorbCookies(setCookies: string[]): void {
    let changed = false;
    for (const raw of setCookies) {
      const pair = raw.split(";")[0];
      const eq = pair.indexOf("=");
      if (eq <= 0) continue;
      this.jar[pair.slice(0, eq).trim()] = pair.slice(eq + 1).trim();
      changed = true;
    }
    if (changed) this.saveJar();
  }

  private loadJar(): Record<string, string> {
    try {
      if (fs.existsSync(this.sessionFile)) {
        const data = JSON.parse(fs.readFileSync(this.sessionFile, "utf8"));
        if (data && typeof data === "object" && !Array.isArray(data)) {
          return data as Record<string, string>;
        }
      }
    } catch {
      // corrupt jar — start fresh
    }
    return {};
  }

  private saveJar(): void {
    try {
      fs.writeFileSync(this.sessionFile, JSON.stringify(this.jar, null, 2));
    } catch {
      // non-fatal: jar simply won't persist across restarts
    }
  }

  // ── Dates ─────────────────────────────────────────────────────────────

  private formatDate(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  private isoDate(yyyymmdd: string): string {
    return `${yyyymmdd.slice(0, 4)}-${yyyymmdd.slice(4, 6)}-${yyyymmdd.slice(6, 8)}`;
  }
}
