/* Probe #3: validate the exact parsing the adapter will use —
 * capture raw PRICES response → extract the ehtml("...") table string →
 * unescape → DOMParser → structured tr.price_info rows.
 */
const { chromium } = require("playwright");

const BASE = process.env.KOMPAS_BASE_URL || "https://online.az.kompastour.com";
const STATEINC = process.argv[2] || "17";
const CHECKIN_BEG = process.argv[3] || "20261024";
const NIGHTS = process.argv[4] || "7";
const PAGE = process.argv[5] || "1";
const CHECKIN_END = (() => {
  const d = new Date(`${CHECKIN_BEG.slice(0,4)}-${CHECKIN_BEG.slice(4,6)}-${CHECKIN_BEG.slice(6,8)}`);
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,"0")}${String(d.getDate()).padStart(2,"0")}`;
})();

const PRICES_URL = `${BASE}/search_hotel?samo_action=PRICES&STATEINC=${STATEINC}&TOURINC=0&PROGRAMGROUPINC=0`
  + `&CHECKIN_BEG=${CHECKIN_BEG}&NIGHTS_FROM=${NIGHTS}&CHECKIN_END=${CHECKIN_END}&NIGHTS_TILL=${NIGHTS}`
  + `&ADULT=2&CURRENCY=2&CHILD=0&TOWNS_ANY=1&townssearch=0&TOWNS=&STARS_ANY=1&STARS=`
  + `&HOTELS_ANY=1&hotelsearch=0&HOTELS=&MEALS_ANY=1&MEALS=&ROOMS_ANY=1&ROOMS=`
  + `&FILTER=1&MOMENT_CONFIRM=0&UFILTER=&HOTELTYPES=&PARTITION_PRICE=&PRICEPAGE=${PAGE}&DYN_SEPARATE=1`;

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36",
    locale: "ru-RU",
  });
  const page = await context.newPage();

  let raw = null;
  await page.route("**samo_action=PRICES**", async (route) => {
    const response = await route.fetch();
    raw = await response.text();
    await route.fulfill({ response });
  });

  await page.goto(`${BASE}/search_hotel`, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForFunction(() => typeof window.samo !== "undefined" && window.samo.page_ready === true, { timeout: 15000 }).catch(() => {});
  await page.evaluate(() => { document.getElementById("samo_popup")?.remove(); document.getElementById("samo_popup_mini")?.remove(); });

  await page.goto(PRICES_URL, { waitUntil: "networkidle", timeout: 45000 }).catch((e) => console.log(`[parse] goto err: ${e.message}`));
  await page.waitForTimeout(1500);

  if (!raw) { console.log("[parse] raw NOT captured"); await context.close(); await browser.close(); return; }

  // Parse the raw response IN PAGE CONTEXT: extract ehtml("...") table, unescape, DOMParser.
  const parsed = await page.evaluate((rawText) => {
    // The response is <script>...samo.jQuery(samo.controls.resultset).ehtml(" <table ...> ... </table> ")...<\/script>
    const start = rawText.indexOf(".ehtml(\"");
    if (start < 0) return { error: "no .ehtml( found", head: rawText.slice(0, 200) };
    const strStart = start + ".ehtml(\"".length;
    // Find the closing unescaped quote: scan for \" not preceded by a backslash, then );</script>
    let i = strStart, esc = false, strEnd = -1;
    // The ehtml string ends at `")` followed by `;` — but escaped quotes inside. Simpler: find `");` after the table's </table>.
    const tableEnd = rawText.indexOf("<\\/table>", strStart);
    if (tableEnd < 0) return { error: "no <\\/table> found" };
    const closeQuote = rawText.indexOf("\"", tableEnd);
    strEnd = closeQuote;
    const escaped = rawText.slice(strStart, strEnd);
    // Unescape JS string: \/ → / , \n → newline, \uXXXX → char, \" → "
    const html = escaped
      .replace(/\\u([0-9a-fA-F]{4})/g, (m, h) => String.fromCharCode(parseInt(h, 16)))
      .replace(/\\\//g, "/")
      .replace(/\\n/g, "\n")
      .replace(/\\"/g, "\"")
      .replace(/\\t/g, "\t");
    const doc = new DOMParser().parseFromString(html, "text/html");
    const rows = Array.from(doc.querySelectorAll("tr.price_info"));
    const parseRow = (row) => {
      const cls = row.getAttribute("class") || "";
      const cells = row.querySelectorAll("td");
      const priceEl = row.querySelector("[data-cat-price]");
      const hotelLink = row.querySelector(".link-hotel a");
      // hotel name + city: .link-hotel has <a>NAME</a> (Бодрум)
      const hotelName = hotelLink?.textContent?.trim() ?? "";
      const linkHotelText = row.querySelector(".link-hotel")?.textContent?.trim() ?? "";
      const cityMatch = linkHotelText.match(/\(([^)]+)\)\s*$/);
      return {
        stateKey: cls.match(/stateKey-(\d+)/)?.[1] ?? "",
        hotelKey: cls.match(/hotelKey-(\d+)/)?.[1] ?? "",
        tourKey: cls.match(/tourKey-(\d+)/)?.[1] ?? "",
        spoKey: cls.match(/spoKey-(\d+)/)?.[1] ?? "",
        mealKey: cls.match(/mealKey-(\d+)/)?.[1] ?? "",
        roomKey: cls.match(/roomKey-(\d+)/)?.[1] ?? "",
        nights: cls.match(/nights-(\d+)/)?.[1] ?? "",
        checkIn: cls.match(/checkIn-(\d+)/)?.[1] ?? "",
        adult: cls.match(/adult-(\d+)/)?.[1] ?? "",
        child: cls.match(/child-(\d+)/)?.[1] ?? "",
        hotelName,
        city: cityMatch ? cityMatch[1] : "",
        price: priceEl?.getAttribute("data-converted-price-number") ?? "",
        currency: priceEl?.getAttribute("data-currency_title") ?? "",
        meal: cells[6]?.textContent?.trim() ?? "",
        room: row.querySelector(".nw span, td:nth-child(9) span")?.textContent?.trim() ?? cells[7]?.textContent?.trim() ?? "",
        hotelHref: hotelLink?.getAttribute("href") ?? "",
      };
    };
    const allKeys = rows.map((r) => r.getAttribute("class")?.match(/hotelKey-(\d+)/)?.[1] || "").filter(Boolean);
    return {
      htmlLen: html.length,
      rowCount: rows.length,
      distinctHotelKeys: Array.from(new Set(allKeys)).length,
      firstKeys: Array.from(new Set(allKeys)).slice(0, 20),
      rows: rows.slice(0, 2).map(parseRow),
    };
  }, raw);

  console.log(`[parse p${PAGE}] rows=${parsed.rowCount} distinctHotels=${parsed.distinctHotelKeys}`);
  console.log(`[parse p${PAGE}] firstKeys=${parsed.firstKeys.join(",")}`);
  console.log(`[parse p${PAGE}] sample=${JSON.stringify(parsed.rows?.[0] ?? {})}`);

  await context.close();
  await browser.close();
})().catch((e) => { console.error("[parse] FATAL", e); process.exit(1); });
