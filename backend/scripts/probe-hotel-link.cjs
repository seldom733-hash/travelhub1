/* Одноразовый probe: почему у части строк пустое имя отеля (.link-hotel a).
 * Дump'ит .link-hotel outerHTML для строк с пустым именем и для нормальных.
 *   node probe-hotel-link.cjs [STATEINC] [CHECKIN_BEG] [NIGHTS] [PAGE]
 */
const { chromium } = require("playwright");

const BASE = process.env.KOMPAS_BASE_URL || "https://online.az.kompastour.com";
const STATEINC = process.argv[2] || "14"; // UZ
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
  + `&HOTELS_ANY=1&HOTELS=&hotelsearch=0&PRICE_ANY=1&PRICE_FROM=&PRICE_TO=`
  + `&FILTER=1&MOMENT_CONFIRM=0&UFILTER=&HOTELTYPES=&PARTITION_PRICE=&PRICEPAGE=${PAGE}&DYN_SEARCH=1`
  + `&PARTITION_PRICE=&PRICEPAGE=${PAGE}&DYN_SEPARATE=1`;

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

  await page.goto(PRICES_URL, { waitUntil: "networkidle", timeout: 45000 }).catch((e) => console.log(`[link] goto err: ${e.message}`));
  await page.waitForTimeout(1500);

  if (!raw) { console.log("[link] raw NOT captured"); await context.close(); await browser.close(); return; }

  const out = await page.evaluate((rawText) => {
    const start = rawText.indexOf(".ehtml(\"");
    if (start < 0) return { error: "no .ehtml(" };
    const strStart = start + ".ehtml(\"".length;
    const tableEnd = rawText.indexOf("<\\/table>", strStart);
    if (tableEnd < 0) return { error: "no <\\/table>" };
    const closeQuote = rawText.indexOf("\"", tableEnd);
    const escaped = rawText.slice(strStart, closeQuote);
    const html = escaped
      .replace(/\\u([0-9a-fA-F]{4})/g, (m, h) => String.fromCharCode(parseInt(h, 16)))
      .replace(/\\\//g, "/")
      .replace(/\\n/g, "\n")
      .replace(/\\"/g, "\"")
      .replace(/\\t/g, "\t");
    const doc = new DOMParser().parseFromString(html, "text/html");
    const rows = Array.from(doc.querySelectorAll("tr.price_info"));
    const empty = [], normal = [];
    let emptyCount = 0;
    for (const row of rows) {
      const a = row.querySelector(".link-hotel a");
      const linkHotel = row.querySelector(".link-hotel");
      const aText = (a?.textContent || "").trim();
      if (!aText) {
        emptyCount++;
        if (empty.length < 4) {
          empty.push({
            hotelKey: (row.getAttribute("class") || "").match(/hotelKey-(\d+)/)?.[1] || "",
            hasLinkHotel: !!linkHotel,
            linkHotelTag: linkHotel ? linkHotel.tagName : null,
            linkHotelClass: linkHotel?.getAttribute("class") || null,
            linkHotelText: (linkHotel?.textContent || "").trim().slice(0, 120),
            linkHotelHtml: (linkHotel?.outerHTML || "NULL").slice(0, 500),
            aHref: a?.getAttribute("href") || null,
            parentTdHtml: (linkHotel?.parentElement?.outerHTML || "").slice(0, 600),
          });
        }
      } else if (normal.length < 3) {
        normal.push({
          aText: aText.slice(0, 80),
          linkHotelHtml: (linkHotel?.outerHTML || "NULL").slice(0, 500),
        });
      }
    }
    return { rowCount: rows.length, emptyCount, empty, normal };
  }, raw);

  console.log(`[link] rows=${out.rowCount} emptyName=${out.emptyCount}`);
  console.log("=== СТРОКИ С ПУСТЫМ ИМЕНЕМ ===");
  for (const e of out.empty || []) console.log(JSON.stringify(e, null, 2));
  console.log("=== НОРМАЛЬНЫЕ СТРОКИ ===");
  for (const n of out.normal || []) console.log(JSON.stringify(n, null, 2));

  await context.close();
  await browser.close();
})().catch((e) => { console.error("[link] FATAL", e); process.exit(1); });
