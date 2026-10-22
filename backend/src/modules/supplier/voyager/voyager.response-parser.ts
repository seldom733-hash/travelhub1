/**
 * Voyager response parser (pure functions, no I/O).
 *
 * Fixtures: real PRICES responses from online.voyagergroup.az/search_tour
 * (verified live 2026-10-21). The engine is SAMO — the row markup is the same
 * `tr.price_info` family as Summertour/KazUnion with three verified deltas:
 *
 *  1. Departure-date cell is `<td class="arrival sortie">` (not bare
 *     `sortie`) and carries `div.samo_format_date[data-date="22.10.2026"]` —
 *     the data-date attribute is parsed first (exact), text is the fallback.
 *  2. Meal is a BARE `<td class="hotel-meals">BB</td>` cell (no helpalt link).
 *  3. The `<td class="tour">` cell carries the program display name
 *     («Baku-Kuala Lumpur (Malaysia/Air Arabia)») — used for tourIncName
 *     attribution since the engine fans out all programs of a country.
 */

// ── One parsed price_info row ────────────────────────────────────────────

export interface VoyagerOfferRow {
  hotelKey: string;
  spoKey: string;
  tourKey: string;
  mealKey: string;
  roomKey: string;
  nights: number;
  /** YYYYMMDD as returned in the class keys. */
  checkIn: string;
  adults: number;
  children: number;
  claim: string;
  hotel: string;
  /**
   * Trailing parenthetical of the hotel cell — on STAY rows it is the town
   * («Malibest Resort 2* (Langkawi)»); on tour rows a district («(Фатих)»).
   * Stripped from `hotel` in both cases (the tour adapter ignores this).
   */
  hotelCity?: string;
  /** Price in the requested currency (converted price preferred). */
  price: number;
  currency: string;
  /** Raw sortie text ("22.10.2026" or "22.10.2026, Ср"). */
  departureDateText: string;
  transport: string;
  roomText: string;
  mealText: string;
  /** Program display name from the tour cell («Baku-Dubai (UAE/FLYDUBAI)»). */
  tourText: string;
  /** True when the row carries flight-seat markers ("есть места"). */
  seatsAvailable: boolean;
  /** True when the row carries a stop-sale marker. */
  stopSale: boolean;
}

// ── JS envelope helpers ──────────────────────────────────────────────────

/** Unescape a JS string literal body (\uXXXX, \n, \t, \", \/, \\). */
export function unescapeJsString(s: string): string {
  return s
    .replace(/\\n/g, "\n")
    .replace(/\\t/g, "\t")
    .replace(/\\"/g, '"')
    .replace(/\\\//g, "/")
    .replace(/\\\\/g, "\\")
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, hex: string) => String.fromCharCode(parseInt(hex, 16)));
}

/**
 * Extract the HTML payload from the SAMO JS callback:
 *   samo.jQuery(samo.controls.resultset).ehtml("...HTML...");
 */
export function extractHtmlFromJs(body: string): string | null {
  const m = body.match(/\.ehtml\("((?:[^"\\]|\\.)*)"\)/);
  if (!m) return null;
  return unescapeJsString(m[1]);
}

const NAMED_ENTITIES: Record<string, string> = {
  nbsp: " ",
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  ndash: "–",
  mdash: "—",
  laquo: "«",
  raquo: "»",
};

/** Decode HTML entities (named + numeric) in supplier text. */
export function decodeEntities(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCharCode(parseInt(n, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex: string) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&([a-zA-Z]+);/g, (m, name: string) => NAMED_ENTITIES[name.toLowerCase()] ?? m);
}

// ── Antibot / no-data detection ──────────────────────────────────────────

/** True when the response is a captcha/antibot challenge (never "no data"). */
export function isCaptchaResponse(text: string): boolean {
  if (!text) return false;
  if (/kcaptcha/i.test(text)) return true;
  if (/samo_action\s*=\s*["']?antibot/i.test(text)) return true;
  if (text.includes("captchaForm") || text.includes("icaptcha")) return true;
  return false;
}

/**
 * True only for an EXPLICIT "nothing found" answer from the SAMO engine
 * («Нет данных» — literal or as \uXXXX escapes inside the ehtml payload).
 * Anything else without rows is a contract violation and must throw.
 */
export function isNoDataResponse(text: string): boolean {
  if (!text) return false;
  const decoded = unescapeJsString(text);
  const plain = decoded
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, " ");
  return /нет\s+данных/i.test(plain);
}

// ── Price rows ───────────────────────────────────────────────────────────

/** Parse all price_info rows of a results HTML table. */
export function parsePriceRows(html: string): VoyagerOfferRow[] {
  const offers: VoyagerOfferRow[] = [];
  const rowRegex = /<tr[^>]*class="[^"]*price_info[^"]*"[^>]*>([\s\S]*?)<\/tr>/gi;
  let rowMatch: RegExpExecArray | null;

  while ((rowMatch = rowRegex.exec(html)) !== null) {
    const fullRow = rowMatch[0];
    const rowContent = rowMatch[1];
    const classes = fullRow.match(/class="([^"]*)"/)?.[1] ?? "";

    const hotelKey = classes.match(/hotelKey-(\d+)/)?.[1] ?? "";
    const spoKey = classes.match(/spoKey-(\d+)/)?.[1] ?? "";
    const tourKey = classes.match(/tourKey-(\d+)/)?.[1] ?? "";
    const mealKey = classes.match(/mealKey-(\d+)/)?.[1] ?? "";
    const roomKey = classes.match(/roomKey-(\d+)/)?.[1] ?? "";
    const nights = parseInt(classes.match(/nights-(\d+)/)?.[1] ?? "0", 10);
    const checkIn = classes.match(/checkIn-(\d+)/)?.[1] ?? "";
    const adults = parseInt(classes.match(/adult-(\d+)/)?.[1] ?? "0", 10);
    const children = parseInt(classes.match(/child-(\d+)/)?.[1] ?? "0", 10);

    const claim = fullRow.match(/data-cat-claim="([^"]*)"/)?.[1] ?? "";
    const dataHotel = fullRow.match(/data-hotel="([^"]*)"/)?.[1] ?? "";

    // Hotel name cell (trailing «(Фатих)» district / «(Langkawi)» town
    // suffix stripped from the name and kept separately as `hotelCity`).
    const hotelCell = rowContent.match(/<td[^>]*class="[^"]*link-hotel[^"]*"[^>]*>([\s\S]*?)<\/td>/i)?.[1] ?? "";
    const hotelCellText = decodeEntities(
      hotelCell
        .replace(/<[\s\S]*?>/g, " ")
        .replace(/\s+/g, " ")
        .trim(),
    );
    const cityMatch = hotelCellText.match(/\s*\(([^)]*)\)\s*$/);
    const hotelCity = cityMatch ? cityMatch[1].trim() : undefined;
    const hotel = hotelCellText.replace(/\s*\([^)]*\)\s*$/, "").trim();

    // Converted price is in the requested currency (CURRENCY=2 → USD).
    const priceSpan = rowContent.match(
      /data-cat-price="([^"]*)"[\s\S]{0,300}?data-converted-price-number="([^"]*)"[\s\S]{0,200}?data-currency_title="([^"]*)"/,
    );
    const priceFallback = rowContent.match(
      /data-cat-price="([^"]*)"[\s\S]{0,300}?data-currency_title="([^"]*)"/,
    );
    let price = 0;
    let currency = "USD";
    if (priceSpan && priceSpan[2]) {
      price = parseFloat(priceSpan[2]);
      currency = priceSpan[3] || "USD";
    } else if (priceFallback) {
      price = parseFloat(priceFallback[1]);
      currency = priceFallback[2] || "USD";
    }

    // Departure date: exact data-date attribute first, text fallback.
    const dateAttr = rowContent.match(/class="[^"]*samo_format_date[^"]*"[\s\S]{0,200}?data-date="(\d{2}\.\d{2}\.\d{4})"/i)?.[1]
      ?? rowContent.match(/data-date="(\d{2}\.\d{2}\.\d{4})"/i)?.[1]
      ?? "";
    const departureDateText = dateAttr ||
      (rowContent.match(/<td[^>]*class="[^"]*\bsortie\b[^"]*"[^>]*>([\s\S]*?)<\/td>/i)?.[1] ?? "")
        .replace(/<[\s\S]*?>/g, " ")
        .replace(/\s+/g, " ")
        .trim();

    const transport = decodeEntities(
      rowContent.match(/<div class="transport">[\s\S]*?<span class="name">([^<]*)/i)?.[1]?.trim() ?? "",
    );

    // Program name from the tour cell («Baku-Dubai (UAE/FLYDUBAI)») — exact
    // class="tour" first (the row also has a `tour-nights` cell), then a
    // loose fallback; scripts and transport-image spans are stripped.
    const tourCell = rowContent.match(/<td[^>]*class="tour"[^>]*>([\s\S]*?)<\/td>/i)?.[1]
      ?? rowContent.match(/<td[^>]*class="[^"]*\btour\b[^"]*"[^>]*>([\s\S]*?)<\/td>/i)?.[1]
      ?? "";
    const tourText = decodeEntities(
      tourCell
        .replace(/<script[\s\S]*?<\/script>/gi, " ")
        .replace(/<[\s\S]*?>/g, " ")
        .replace(/\s+/g, " ")
        .trim(),
    );

    // Meal cell — Voyager ships a BARE `<td class="hotel-meals">BB</td>`
    // (verified live); the helpalt-link shape and the after-availability
    // fallback are kept for robustness (engine variants).
    let mealText = (rowContent.match(/<td[^>]*class="[^"]*hotel-meals[^"]*"[^>]*>([\s\S]*?)<\/td>/i)?.[1] ?? "")
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<[\s\S]*?>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (!mealText) {
      mealText = (rowContent.match(/<span class="helpalt link"(?![^>]*data-popup)[^>]*>([\s\S]*?)<script/i)?.[1] ?? "")
        .replace(/<[\s\S]*?>/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    }
    if (!mealText) {
      const availIdx = rowContent.search(/hotel_availability/i);
      if (availIdx >= 0) {
        const cell = rowContent.slice(availIdx).match(/<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>/i);
        if (cell) mealText = cell[1].replace(/<[\s\S]*?>/g, " ").replace(/\s+/g, " ").trim();
      }
    }
    mealText = decodeEntities(mealText);

    // Room cell: <span class="">Standard Room / 2 ADL</span>
    const roomText = decodeEntities(
      (rowContent.match(/<span class="">([\s\S]*?)<\/span>/)?.[1] ?? "")
        .replace(/<[\s\S]*?>/g, " ")
        .replace(/\s+/g, " ")
        .trim(),
    );

    const seatsAvailable = /fr_place_[rl]\s+Y/.test(rowContent) || /title="[^"]*есть места/i.test(rowContent);
    const stopSale = /stop_sale|red_row/.test(fullRow) || /title="[^"]*stop[- ]?sale/i.test(rowContent);

    if (!hotelKey && !spoKey && !claim) continue;
    if (!price || !isFinite(price)) continue;

    offers.push({
      hotelKey: hotelKey || dataHotel,
      spoKey,
      tourKey,
      mealKey,
      roomKey,
      nights,
      checkIn,
      adults,
      children,
      claim,
      hotel,
      ...(hotelCity ? { hotelCity } : {}),
      price,
      currency,
      departureDateText,
      transport,
      roomText,
      mealText,
      tourText,
      seatsAvailable,
      stopSale,
    });
  }

  return offers;
}

/** Max page number from the pager (data-page spans). */
export function parseTotalPages(body: string, html: string): number {
  const src = html || body;
  let max = 1;
  for (const m of src.matchAll(/data-page="(\d+)"/g)) {
    const n = parseInt(m[1], 10);
    if (isFinite(n) && n > max) max = n;
  }
  return max;
}

// ── Form dictionary helpers ──────────────────────────────────────────────

/** Parse <select name=NAME> options → {value,label}. */
export function parseSelectOptions(
  html: string,
  selectName: string,
  skipZero = false,
): Array<{ value: string; name: string }> {
  const selectMatch = html.match(
    new RegExp(`<select[^>]*name=["']?${selectName}["']?[^>]*>([\\s\\S]*?)<\\/select>`, "i"),
  );
  if (!selectMatch) return [];
  const out: Array<{ value: string; name: string }> = [];
  const optionRegex = /<option[^>]*value=["']?([^"'>\s]+)["']?[^>]*>([\s\S]*?)<\/option>/gi;
  let m: RegExpExecArray | null;
  while ((m = optionRegex.exec(selectMatch[1])) !== null) {
    const value = m[1];
    const name = decodeEntities(m[2].replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim());
    if (skipZero && (value === "0" || !name)) continue;
    if (!name) continue;
    out.push({ value, name });
  }
  return out;
}

/** Parse checklistbox NAME checkbox inputs → {value,label}. */
export function parseChecklistbox(html: string, boxName: string): Array<{ value: string; name: string }> {
  const startMatch = html.match(new RegExp(`<div[^>]*name="${boxName}"[^>]*>`, "i"));
  if (!startMatch || startMatch.index === undefined) return [];
  const rest = html.slice(startMatch.index + startMatch[0].length);

  // The box ends at the next checklistbox sibling, the closing cell, or the
  // end of the fragment — whichever comes first.
  let end = rest.length;
  const nextBox = rest.search(/<div[^>]*class="[^"]*checklistbox/i);
  if (nextBox >= 0) end = nextBox;
  const closeCell = rest.search(/<\/td>/i);
  if (closeCell >= 0 && closeCell < end) end = closeCell;
  const slice = rest.slice(0, end);

  const out: Array<{ value: string; name: string }> = [];
  const inputRegex =
    /<input[^>]*type="checkbox"[^>]*value="(\d+)"[^>]*>([\s\S]*?)(?=<label|<\/label>|<input|<\/div>)/gi;
  let m: RegExpExecArray | null;
  while ((m = inputRegex.exec(slice)) !== null) {
    const value = m[1];
    const name = decodeEntities(m[2].replace(/<[\s\S]*?>/g, " ").replace(/\s+/g, " ").trim());
    if (name) out.push({ value, name });
  }
  return out;
}
